import Policy from '../models/Policy.js';
import Transaction from '../models/Transaction.js';
import { AppError } from '../utils/errors.js';
import { sendSuccess } from '../utils/respond.js';

export async function createPolicyOnChain(_request, _response) {
  throw new AppError(503, 'BLOCKCHAIN_ADAPTER_NOT_CONFIGURED', 'Policy transactions are disabled until the audited contract and transaction signer are configured.');
}

export async function submitVerificationOnChain(_request, _response) {
  throw new AppError(503, 'BLOCKCHAIN_ADAPTER_NOT_CONFIGURED', 'Oracle submissions are disabled until an authorized oracle signer and deployed contract are configured.');
}

export async function processPayoutOnChain(_request, _response) {
  throw new AppError(503, 'BLOCKCHAIN_ADAPTER_NOT_CONFIGURED', 'Payout transactions are disabled until the contract, authorization, liquidity, and transaction-confirmation adapter are configured.');
}

export async function getTransaction(request, response) {
  const transaction = await Transaction.findOne({ transactionHash: request.params.txHash });
  if (!transaction) throw new AppError(404, 'TRANSACTION_NOT_FOUND', 'No recorded transaction matches this hash.');
  if (request.user.role !== 'Admin' && !transaction.userId?.equals(request.user._id)) {
    throw new AppError(403, 'FORBIDDEN', 'You can only view your own transaction.');
  }
  return sendSuccess(response, 200, 'Recorded transaction state.', { transaction });
}

export async function getPolicyOnChain(request, response) {
  const policy = await Policy.findOne({ policyId: request.params.policyId });
  if (!policy) throw new AppError(404, 'POLICY_NOT_FOUND', 'No policy matches this identifier.');
  if (request.user.role !== 'Admin' && !policy.userId.equals(request.user._id)) {
    throw new AppError(403, 'FORBIDDEN', 'You can only view your own policy.');
  }
  return sendSuccess(response, 200, 'Recorded policy state.', {
    policyId: policy.policyId,
    status: policy.status,
    blockchainTxHash: policy.blockchainTxHash || null,
    chainRead: 'DATABASE_REFERENCE_ONLY'
  });
}

export async function listTransactions(request, response) {
  const transactions = await Transaction.find({ userId: request.user._id }).sort({ createdAt: -1 }).limit(100);
  return sendSuccess(response, 200, 'Your recorded transactions.', { transactions });
}
