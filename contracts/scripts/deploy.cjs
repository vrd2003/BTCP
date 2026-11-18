const { ethers } = require('hardhat');

async function main() {
  if (!process.env.SEPOLIA_RPC_URL || !process.env.DEPLOYER_PRIVATE_KEY || !process.env.ORACLE_PRIVATE_KEY) {
    throw new Error('Set SEPOLIA_RPC_URL, DEPLOYER_PRIVATE_KEY, and ORACLE_PRIVATE_KEY in contracts/.env before deploying.');
  }
  const network = await ethers.provider.getNetwork();
  if (network.chainId !== 11155111n) {
    throw new Error(`Refusing deployment: expected Sepolia (11155111), connected to ${network.chainId}.`);
  }
  const [deployer] = await ethers.getSigners();
  const oracle = new ethers.Wallet(process.env.ORACLE_PRIVATE_KEY, ethers.provider);
  const contract = await ethers.deployContract('FlightSure');
  await contract.waitForDeployment();
  const authorization = await contract.setOracle(oracle.address, true);
  await authorization.wait();
  console.log(JSON.stringify({
    network: 'sepolia',
    chainId: network.chainId.toString(),
    deployer: deployer.address,
    contractAddress: await contract.getAddress(),
    authorizedOracle: oracle.address
  }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
