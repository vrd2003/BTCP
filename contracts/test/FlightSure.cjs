const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('FlightSure', function () {
  async function deploy() {
    const [owner, passenger, oracle, unauthorized] = await ethers.getSigners();
    const contract = await ethers.deployContract('FlightSure');
    await contract.setOracle(oracle.address, true);
    return { contract, owner, passenger, oracle, unauthorized };
  }

  async function buyPolicy(contract, passenger, overrides = {}) {
    const now = BigInt((await ethers.provider.getBlock('latest')).timestamp);
    const scheduledArrival = now + 3600n;
    const flightKey = ethers.keccak256(ethers.toUtf8Bytes('provider-flight-123'));
    const tx = await contract.connect(passenger).purchasePolicy(
      flightKey,
      scheduledArrival,
      now + 60n,
      scheduledArrival + 3600n,
      60,
      ethers.parseEther('0.01'),
      [60, 120],
      [ethers.parseEther('0.002'), ethers.parseEther('0.005')],
      { value: ethers.parseEther('0.001'), ...overrides }
    );
    await tx.wait();
    return { flightKey, scheduledArrival };
  }

  async function setChainTime(timestamp) {
    await ethers.provider.send('evm_setNextBlockTimestamp', [Number(timestamp)]);
    await ethers.provider.send('evm_mine');
  }

  it('collects premium, verifies a 2-of-3 event, and pays the purchased tier once', async function () {
    const { contract, owner, passenger, oracle } = await deploy();
    const { flightKey, scheduledArrival } = await buyPolicy(contract, passenger);
    const actualArrival = scheduledArrival + 130n * 60n;
    const evidenceHash = ethers.keccak256(ethers.toUtf8Bytes('independent source evidence'));

    await contract.fundPool({ value: ethers.parseEther('0.01') });
    await setChainTime(actualArrival);
    await contract.connect(oracle).verifyArrival(
      flightKey, scheduledArrival, actualArrival, 3, evidenceHash
    );
    await contract.connect(oracle).payCompensation(1);

    expect(await contract.poolBalance()).to.equal(ethers.parseEther('0.006'));
    const policy = await contract.getPolicy(1);
    expect(policy.passenger).to.equal(passenger.address);
    expect(policy.paid).to.equal(true);
    expect(policy.settled).to.equal(true);
    await expect(contract.connect(oracle).payCompensation(1)).to.be.revertedWithCustomError(contract, 'PolicyUnavailable');
    await expect(contract.connect(passenger).fundPool({ value: 1n })).to.be.revertedWithCustomError(contract, 'OwnableUnauthorizedAccount');
    expect(await contract.owner()).to.equal(owner.address);
  });

  it('rejects fewer than two agreeing source reports', async function () {
    const { contract, passenger, oracle } = await deploy();
    const { flightKey, scheduledArrival } = await buyPolicy(contract, passenger);
    const evidenceHash = ethers.keccak256(ethers.toUtf8Bytes('single source'));

    await setChainTime(scheduledArrival + 600n);
    await expect(contract.connect(oracle).verifyArrival(
      flightKey, scheduledArrival, scheduledArrival + 600n, 1, evidenceHash
    )).to.be.revertedWithCustomError(contract, 'InvalidOracleEvidence');
  });

  it('rejects unauthorized oracle submissions', async function () {
    const { contract, passenger, unauthorized } = await deploy();
    const { flightKey, scheduledArrival } = await buyPolicy(contract, passenger);
    const evidenceHash = ethers.keccak256(ethers.toUtf8Bytes('source evidence'));

    await setChainTime(scheduledArrival + 600n);
    await expect(contract.connect(unauthorized).verifyArrival(
      flightKey, scheduledArrival, scheduledArrival + 600n, 3, evidenceHash
    )).to.be.revertedWithCustomError(contract, 'InvalidOracleEvidence');
  });

  it('rejects the payout if verified delay is below the stored threshold', async function () {
    const { contract, passenger, oracle } = await deploy();
    const { flightKey, scheduledArrival } = await buyPolicy(contract, passenger);
    const evidenceHash = ethers.keccak256(ethers.toUtf8Bytes('on-time source evidence'));
    await setChainTime(scheduledArrival + 30n * 60n);
    await contract.connect(oracle).verifyArrival(flightKey, scheduledArrival, scheduledArrival + 30n * 60n, 3, evidenceHash);

    await expect(contract.connect(oracle).payCompensation(1)).to.be.revertedWithCustomError(contract, 'DelayNotEligible');
    await contract.connect(oracle).settleIneligiblePolicy(1);
    expect((await contract.getPolicy(1)).settled).to.equal(true);
  });

  it('does not execute a payout when the premium pool lacks liquidity', async function () {
    const { contract, passenger, oracle } = await deploy();
    const { flightKey, scheduledArrival } = await buyPolicy(contract, passenger);
    const evidenceHash = ethers.keccak256(ethers.toUtf8Bytes('verified delay'));
    await setChainTime(scheduledArrival + 130n * 60n);
    await contract.connect(oracle).verifyArrival(flightKey, scheduledArrival, scheduledArrival + 130n * 60n, 3, evidenceHash);

    await expect(contract.connect(oracle).payCompensation(1)).to.be.revertedWithCustomError(contract, 'InsufficientPoolBalance');
    expect((await contract.getPolicy(1)).settled).to.equal(false);
  });
});
