import { readFileSync } from 'node:fs';
import { Contract, JsonRpcProvider, getAddress, keccak256, toUtf8Bytes } from 'ethers';
import { fileURLToPath } from 'node:url';
import { AppError } from '../utils/errors.js';

const flightSureAbi = JSON.parse(readFileSync(
  fileURLToPath(new URL('../../../src/chain/FlightSure.json', import.meta.url)),
  'utf8'
));
const SEPOLIA_CHAIN_ID = 11155111n;

export function isBlockchainConfigured(config) {
  return Boolean(
    config.BLOCKCHAIN_RPC_URL &&
    config.BLOCKCHAIN_CHAIN_ID &&
    config.BLOCKCHAIN_CONTRACT_ADDRESS
  );
}

export function flightKeyFor(flight) {
  if (!flight.providerId) throw new AppError(409, 'FLIGHT_PROVIDER_ID_MISSING', 'The flight does not have a stable provider identifier.');
  return keccak256(toUtf8Bytes(flight.providerId));
}

export async function preparePolicyPurchase(config, flight, plan) {
  if (plan.currency !== 'ETH' || plan.policyTerms.tiers.some(tier => tier.currency !== 'ETH')) {
    throw new AppError(409, 'POLICY_ASSET_UNSUPPORTED', 'Sepolia policy purchases currently accept ETH-denominated test terms only.');
  }
  const provider = await getProvider(config);
  const network = await getNetwork(provider);
  if (network.chainId !== BigInt(config.BLOCKCHAIN_CHAIN_ID)) {
    throw new AppError(503, 'BLOCKCHAIN_NETWORK_MISMATCH', 'The configured RPC is connected to a different blockchain network.');
  }
  if (!flight.scheduledDeparture || !flight.scheduledArrival) {
    throw new AppError(409, 'FLIGHT_SCHEDULE_UNAVAILABLE', 'A scheduled departure and arrival are required to create coverage.');
  }
  const scheduledDeparture = Math.floor(flight.scheduledDeparture.getTime() / 1000);
  const scheduledArrival = Math.floor(flight.scheduledArrival.getTime() / 1000);
  if (scheduledDeparture <= Math.floor(Date.now() / 1000)) {
    throw new AppError(409, 'FLIGHT_ALREADY_DEPARTED', 'Coverage cannot be purchased after the scheduled departure.');
  }
  const premiumWei = BigInt(plan.premiumMinor);
  const tiers = plan.policyTerms.tiers;
  return {
    chainId: Number(network.chainId),
    contractAddress: getContractAddress(config),
    flightKey: flightKeyFor(flight),
    scheduledDeparture,
    scheduledArrival,
    coverageThresholdMinutes: plan.policyTerms.coverageThresholdMinutes,
    maximumPayoutWei: String(plan.policyTerms.maximumPayoutMinor),
    tierDelayMinutes: tiers.map(tier => tier.minimumDelayMinutes),
    tierAmountsWei: tiers.map(tier => String(tier.amountMinor)),
    premiumWei: String(premiumWei)
  };
}

export async function verifyPolicyPurchase(config, transactionHash, expected) {
  const provider = await getProvider(config);
  const network = await getNetwork(provider);
  if (network.chainId !== BigInt(config.BLOCKCHAIN_CHAIN_ID)) {
    throw new AppError(503, 'BLOCKCHAIN_NETWORK_MISMATCH', 'The configured RPC is connected to a different blockchain network.');
  }
  let receipt;
  let transaction;
  try {
    [receipt, transaction] = await Promise.all([
      provider.getTransactionReceipt(transactionHash),
      provider.getTransaction(transactionHash)
    ]);
  } catch {
    throw new AppError(502, 'BLOCKCHAIN_RPC_UNAVAILABLE', 'The configured blockchain RPC could not verify the purchase transaction.');
  }
  if (!receipt || !transaction) {
    throw new AppError(409, 'BLOCKCHAIN_TRANSACTION_PENDING', 'The purchase transaction is not confirmed on the configured network yet.');
  }
  if (receipt.status !== 1) {
    throw new AppError(409, 'BLOCKCHAIN_TRANSACTION_FAILED', 'The purchase transaction failed on-chain.');
  }
  if (
    !transaction.to ||
    getAddress(transaction.to) !== getContractAddress(config) ||
    getAddress(transaction.from) !== getAddress(expected.walletAddress)
  ) {
    throw new AppError(400, 'BLOCKCHAIN_TRANSACTION_MISMATCH', 'The confirmed transaction does not match the configured contract and linked wallet.');
  }

  const contract = new Contract(getContractAddress(config), flightSureAbi, provider);
  let purchaseEvent;
  for (const log of receipt.logs) {
    if (getAddress(log.address) !== getContractAddress(config)) continue;
    try {
      const parsed = contract.interface.parseLog(log);
      if (parsed?.name === 'PolicyPurchased') purchaseEvent = parsed.args;
    } catch {
      continue;
    }
  }
  if (!purchaseEvent) {
    throw new AppError(400, 'BLOCKCHAIN_PURCHASE_EVENT_MISSING', 'The confirmed transaction did not create a FlightSure policy.');
  }
  if (
    getAddress(purchaseEvent.passenger) !== getAddress(expected.walletAddress) ||
    purchaseEvent.flightKey !== expected.flightKey ||
    purchaseEvent.scheduledArrival !== BigInt(expected.scheduledArrival) ||
    purchaseEvent.premiumWei !== BigInt(expected.premiumWei)
  ) {
    throw new AppError(400, 'BLOCKCHAIN_PURCHASE_MISMATCH', 'The on-chain policy does not match the selected flight and configured terms.');
  }

  let policy;
  try {
    policy = await contract.getPolicy(purchaseEvent.policyId);
  } catch {
    throw new AppError(502, 'BLOCKCHAIN_POLICY_UNAVAILABLE', 'The policy created by this transaction could not be read from the configured contract.');
  }
  const tiersMatch = policy.tiers.length === expected.tierAmountsWei.length &&
    policy.tiers.every((tier, index) =>
      Number(tier.minimumDelayMinutes) === expected.tierDelayMinutes[index] &&
      tier.amountWei === BigInt(expected.tierAmountsWei[index])
    );
  if (
    getAddress(policy.passenger) !== getAddress(expected.walletAddress) ||
    policy.flightKey !== expected.flightKey ||
    policy.scheduledArrival !== BigInt(expected.scheduledArrival) ||
    policy.coverageStartsAt !== BigInt(expected.scheduledDeparture) ||
    policy.coverageEndsAt !== BigInt(expected.scheduledArrival) ||
    Number(policy.coverageThresholdMinutes) !== expected.coverageThresholdMinutes ||
    policy.maximumPayoutWei !== BigInt(expected.maximumPayoutWei) ||
    policy.premiumWei !== BigInt(expected.premiumWei) ||
    !tiersMatch
  ) {
    throw new AppError(400, 'BLOCKCHAIN_POLICY_TERMS_MISMATCH', 'The on-chain policy terms differ from the selected catalog version.');
  }

  return {
    contractPolicyId: String(purchaseEvent.policyId),
    blockNumber: receipt.blockNumber,
    transactionHash: receipt.hash,
    network: 'sepolia',
    chainId: Number(network.chainId)
  };
}

export async function getInsurancePool(config) {
  const provider = await getProvider(config);
  const network = await getNetwork(provider);
  if (network.chainId !== SEPOLIA_CHAIN_ID) {
    throw new AppError(503, 'BLOCKCHAIN_NETWORK_MISMATCH', 'The configured RPC is not connected to Sepolia.');
  }
  const contract = new Contract(getContractAddress(config), flightSureAbi, provider);
  try {
    return String(await contract.poolBalance());
  } catch {
    throw new AppError(502, 'BLOCKCHAIN_POOL_UNAVAILABLE', 'The FlightSure contract pool balance could not be read.');
  }
}

async function getProvider(config) {
  if (!isBlockchainConfigured(config)) {
    throw new AppError(503, 'BLOCKCHAIN_ADAPTER_NOT_CONFIGURED', 'Policy purchases are unavailable until a Sepolia RPC and deployed FlightSure contract are configured.');
  }
  if (Number(config.BLOCKCHAIN_CHAIN_ID) !== Number(SEPOLIA_CHAIN_ID)) {
    throw new AppError(503, 'BLOCKCHAIN_NETWORK_MISMATCH', 'This deployment is configured for Sepolia (chain 11155111).');
  }
  try {
    return new JsonRpcProvider(config.BLOCKCHAIN_RPC_URL, Number(config.BLOCKCHAIN_CHAIN_ID));
  } catch {
    throw new AppError(503, 'BLOCKCHAIN_RPC_UNAVAILABLE', 'The configured blockchain RPC could not be initialized.');
  }
}

async function getNetwork(provider) {
  try {
    return await provider.getNetwork();
  } catch {
    throw new AppError(503, 'BLOCKCHAIN_RPC_UNAVAILABLE', 'The configured Sepolia RPC could not be reached.');
  }
}

function getContractAddress(config) {
  try {
    return getAddress(config.BLOCKCHAIN_CONTRACT_ADDRESS);
  } catch {
    throw new AppError(503, 'BLOCKCHAIN_CONTRACT_INVALID', 'The configured FlightSure contract address is invalid.');
  }
}
