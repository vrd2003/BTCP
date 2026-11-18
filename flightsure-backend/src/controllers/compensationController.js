import Policy from '../models/Policy.js';
import Verification from '../models/Verification.js';
import Compensation from '../models/Compensation.js';
import { calculatePolicyCompensation } from '../services/compensationService.js';
import { AppError } from '../utils/errors.js';
import { sendSuccess } from '../utils/respond.js';

async function ownedPolicy(request, policyId) {
  const policy = await Policy.findOne({ policyId });
  if (!policy) throw new AppError(404, 'POLICY_NOT_FOUND', 'No policy matches this identifier.');
  if (request.user.role !== 'Admin' && !policy.userId.equals(request.user._id)) {
    throw new AppError(403, 'FORBIDDEN', 'You can only view claims for your own policy.');
  }
  return policy;
}

export async function calculate(request, response) {
  const policy = await ownedPolicy(request, request.body.policyId);
  const verification = await Verification.findOne({ flightId: policy.flightId, consensusStatus: 'VERIFIED', status: 'VERIFIED' }).sort({ createdAt: -1 });
  if (!verification) throw new AppError(409, 'VERIFICATION_PENDING', 'No independently verified arrival event is available for this policy.');
  const result = calculatePolicyCompensation(policy, verification);
  return sendSuccess(response, 200, result.eligible ? 'Policy terms indicate eligibility. No payout was submitted.' : 'The verified event does not meet the policy payout terms.', {
    ...result,
    policyId: policy.policyId,
    verificationId: verification.id,
    payoutStatus: 'NOT_SUBMITTED'
  });
}

export async function process(_request, _response) {
  throw new AppError(503, 'PAYOUT_PROCESSING_NOT_CONFIGURED', 'Payouts are disabled until an authorized contract signer, deployed contract, and funded test network are configured.');
}

export async function getPolicyCompensation(request, response) {
  const policy = await ownedPolicy(request, request.params.policyId);
  const compensation = await Compensation.find({ policyId: policy._id }).sort({ createdAt: -1 });
  return sendSuccess(response, 200, 'Compensation records.', { compensation });
}

export async function history(request, response) {
  const compensation = await Compensation.find({
    policyId: { $in: (await Policy.find({ userId: request.user._id }).select('_id')).map(item => item._id) }
  }).sort({ createdAt: -1 }).limit(100);
  return sendSuccess(response, 200, 'Your compensation history.', { compensation });
}
