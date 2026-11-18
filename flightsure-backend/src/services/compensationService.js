import { AppError } from '../utils/errors.js';

export function calculatePolicyCompensation(policy, verification, now = new Date()) {
  if (verification.consensusStatus !== 'VERIFIED' || verification.status !== 'VERIFIED') {
    throw new AppError(409, 'VERIFICATION_PENDING', 'Compensation cannot be calculated before independent source consensus is verified.');
  }
  if (policy.status !== 'ACTIVE') {
    throw new AppError(409, 'POLICY_NOT_ACTIVE', 'Compensation requires an active policy.');
  }
  const terms = policy.policyTermsSnapshot;
  if (terms.coverageStartsAt && now < terms.coverageStartsAt) {
    throw new AppError(409, 'COVERAGE_NOT_STARTED', 'The policy coverage window has not started.');
  }
  if (terms.coverageEndsAt && now > terms.coverageEndsAt) {
    throw new AppError(409, 'COVERAGE_ENDED', 'The policy coverage window has ended.');
  }
  const delayMinutes = verification.verifiedDelayMinutes;
  if (!Number.isFinite(delayMinutes) || delayMinutes < 0) {
    throw new AppError(409, 'VERIFIED_DELAY_MISSING', 'The verified arrival delay is unavailable.');
  }
  if (delayMinutes < terms.coverageThresholdMinutes) {
    return { eligible: false, delayMinutes, amountMinor: 0, currency: terms.tiers[0]?.currency, policyTermsVersion: terms.version };
  }
  const tier = [...terms.tiers]
    .filter(item => item.minimumDelayMinutes <= delayMinutes)
    .sort((left, right) => right.minimumDelayMinutes - left.minimumDelayMinutes)[0];
  if (!tier) {
    return { eligible: false, delayMinutes, amountMinor: 0, currency: terms.tiers[0]?.currency, policyTermsVersion: terms.version };
  }
  return {
    eligible: true,
    delayMinutes,
    amountMinor: Math.min(tier.amountMinor, terms.maximumPayoutMinor),
    currency: tier.currency,
    policyTermsVersion: terms.version
  };
}
