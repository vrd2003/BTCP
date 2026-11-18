import Policy from '../models/Policy.js';
import Transaction from '../models/Transaction.js';
import Flight from '../models/Flight.js';
import { AppError } from '../utils/errors.js';
import { sendSuccess } from '../utils/respond.js';
import { isBlockchainConfigured, preparePolicyPurchase, verifyPolicyPurchase } from '../services/blockchainService.js';

export async function listCatalog(request, response) {
  const config = request.app.locals.config;
  const catalog = (config.POLICY_CATALOG || []).map(plan => ({
    ...plan,
    purchaseEnabled: isBlockchainConfigured(config)
  }));
  return sendSuccess(response, 200, catalog.length ? 'Available policy terms.' : 'No policy offerings are configured.', { catalog });
}

export async function createPolicy(request, response) {
  const { planId, flightId } = request.body;
  if (!request.user.walletAddress) {
    throw new AppError(409, 'WALLET_REQUIRED', 'Link and verify a wallet before purchasing a policy.');
  }
  const config = request.app.locals.config;
  const [flight, existing] = await Promise.all([
    Flight.findById(flightId),
    Policy.findOne({ userId: request.user._id, idempotencyKey: request.body.idempotencyKey })
  ]);
  if (!flight) throw new AppError(404, 'FLIGHT_NOT_FOUND', 'No stored flight matches this identifier.');
  if (existing) throw new AppError(409, 'POLICY_PURCHASE_ALREADY_CONFIRMED', 'This purchase request has already been confirmed.');
  const plan = config.POLICY_CATALOG.find(item => item.planId === planId);
  if (!plan) throw new AppError(404, 'POLICY_PLAN_NOT_FOUND', 'No configured policy plan matches this selection.');
  const purchase = await preparePolicyPurchase(config, flight, plan);
  return sendSuccess(response, 200, 'Review and confirm this policy purchase in your verified wallet.', {
    ...purchase,
    planId,
    flightId: flight.id,
    idempotencyKey: request.body.idempotencyKey,
    walletAddress: request.user.walletAddress,
    policyTerms: plan.policyTerms,
    policyName: plan.name,
    currency: plan.currency
  });
}

export async function confirmPolicy(request, response) {
  const { planId, flightId, idempotencyKey, transactionHash } = request.body;
  const existing = await Policy.findOne({ userId: request.user._id, idempotencyKey });
  if (existing) {
    if (existing.blockchainTxHash !== transactionHash) {
      throw new AppError(409, 'IDEMPOTENCY_KEY_REUSED', 'This purchase key is already associated with a different confirmed transaction.');
    }
    await recordPremiumTransaction(existing, request.user._id);
    return sendSuccess(response, 200, 'The confirmed policy purchase is already recorded.', { policy: existing });
  }
  if (!request.user.walletAddress) {
    throw new AppError(409, 'WALLET_REQUIRED', 'Link and verify a wallet before confirming a policy purchase.');
  }

  const flight = await Flight.findById(flightId);
  const config = request.app.locals.config;
  if (!flight) throw new AppError(404, 'FLIGHT_NOT_FOUND', 'No stored flight matches this identifier.');
  const plan = config.POLICY_CATALOG.find(item => item.planId === planId);
  if (!plan) throw new AppError(404, 'POLICY_PLAN_NOT_FOUND', 'No configured policy plan matches this selection.');
  const expected = await preparePolicyPurchase(config, flight, plan);
  const confirmed = await verifyPolicyPurchase(config, transactionHash, {
    ...expected,
    walletAddress: request.user.walletAddress
  });

  let policy;
  try {
    policy = await Policy.create({
      policyId: `${confirmed.chainId}:${confirmed.contractPolicyId}`,
      userId: request.user._id,
      flightId: flight._id,
      walletAddress: request.user.walletAddress,
      premiumMinor: plan.premiumMinor,
      currency: plan.currency,
      policyTermsSnapshot: plan.policyTerms,
      status: 'ACTIVE',
      blockchainTxHash: confirmed.transactionHash,
      contractPolicyId: confirmed.contractPolicyId,
      chainId: confirmed.chainId,
      idempotencyKey
    });
  } catch (error) {
    if (error.code !== 11000) throw error;
    const duplicate = await Policy.findOne({ userId: request.user._id, idempotencyKey });
    if (!duplicate || duplicate.blockchainTxHash !== confirmed.transactionHash) throw error;
    policy = duplicate;
  }
  await recordPremiumTransaction(policy, request.user._id, confirmed.blockNumber);
  return sendSuccess(response, 201, 'Policy activation confirmed on Sepolia.', { policy });
}

export async function listPolicies(request, response) {
  const policies = await Policy.find({ userId: request.user._id }).sort({ createdAt: -1 }).populate('flightId');
  return sendSuccess(response, 200, 'Your policies.', { policies });
}

export async function policiesForUser(request, response) {
  const targetId = request.params.userId;
  if (request.user.role !== 'Admin' && request.user.id !== targetId) {
    throw new AppError(403, 'FORBIDDEN', 'You can only view your own policies.');
  }
  const policies = await Policy.find({ userId: targetId }).sort({ createdAt: -1 }).populate('flightId');
  return sendSuccess(response, 200, 'Policies for the requested user.', { policies });
}

export async function getPolicy(request, response) {
  const policy = await Policy.findOne({ policyId: request.params.policyId }).populate('flightId');
  if (!policy) throw new AppError(404, 'POLICY_NOT_FOUND', 'No policy matches this identifier.');
  if (request.user.role !== 'Admin' && !policy.userId.equals(request.user._id)) {
    throw new AppError(403, 'FORBIDDEN', 'You can only view your own policy.');
  }
  return sendSuccess(response, 200, 'Policy details.', { policy });
}

export async function getPolicyStatus(request, response) {
  const policy = await Policy.findOne({ policyId: request.params.policyId }).select('userId policyId status blockchainTxHash updatedAt');
  if (!policy) throw new AppError(404, 'POLICY_NOT_FOUND', 'No policy matches this identifier.');
  if (request.user.role !== 'Admin' && !policy.userId.equals(request.user._id)) {
    throw new AppError(403, 'FORBIDDEN', 'You can only view your own policy.');
  }
  return sendSuccess(response, 200, 'Policy status.', { policyId: policy.policyId, status: policy.status, blockchainTxHash: policy.blockchainTxHash || null, updatedAt: policy.updatedAt });
}

export async function policyFlights(request, response) {
  const policies = await Policy.find({ userId: request.user._id }).select('flightId');
  const flightIds = policies.map(policy => policy.flightId);
  const flights = flightIds.length ? await Flight.find({ _id: { $in: flightIds } }).sort({ scheduledDeparture: 1 }) : [];
  return sendSuccess(response, 200, 'Flights associated with your policies.', { flights });
}

async function recordPremiumTransaction(policy, userId, blockNumber) {
  const transaction = await Transaction.findOneAndUpdate(
    { transactionHash: policy.blockchainTxHash },
    {
      $setOnInsert: {
        userId,
        policyId: policy._id,
        transactionType: 'PREMIUM',
        transactionHash: policy.blockchainTxHash,
        amountMinor: policy.premiumMinor,
        currency: policy.currency,
        network: 'sepolia',
        status: 'CONFIRMED',
        ...(blockNumber ? { blockNumber } : {})
      }
    },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );
  if (!transaction.policyId?.equals(policy._id) || !transaction.userId?.equals(userId)) {
    throw new AppError(409, 'BLOCKCHAIN_TRANSACTION_ALREADY_RECORDED', 'This transaction is already associated with another account record.');
  }
}
