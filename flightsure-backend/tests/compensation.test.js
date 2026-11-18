import test from 'node:test';
import assert from 'node:assert/strict';
import { calculatePolicyCompensation } from '../src/services/compensationService.js';

const policy = {
  status: 'ACTIVE',
  policyTermsSnapshot: {
    version: '2026-01',
    coverageThresholdMinutes: 60,
    maximumPayoutMinor: 150000,
    tiers: [
      { minimumDelayMinutes: 60, amountMinor: 30000, currency: 'INR' },
      { minimumDelayMinutes: 120, amountMinor: 70000, currency: 'INR' },
      { minimumDelayMinutes: 240, amountMinor: 150000, currency: 'INR' }
    ]
  }
};

const verified = delay => ({ status: 'VERIFIED', consensusStatus: 'VERIFIED', verifiedDelayMinutes: delay });

test('calculates the highest tier from immutable policy terms', () => {
  const result = calculatePolicyCompensation(policy, verified(180));
  assert.equal(result.eligible, true);
  assert.equal(result.amountMinor, 70000);
  assert.equal(result.currency, 'INR');
  assert.equal(result.policyTermsVersion, '2026-01');
});

test('never calculates compensation from an unverified event', () => {
  assert.throws(
    () => calculatePolicyCompensation(policy, { ...verified(180), status: 'VERIFICATION_PENDING' }),
    error => error.code === 'VERIFICATION_PENDING'
  );
});

test('does not make a policy eligible below its purchased threshold', () => {
  const result = calculatePolicyCompensation(policy, verified(59));
  assert.equal(result.eligible, false);
  assert.equal(result.amountMinor, 0);
});

test('caps the amount at the policy maximum', () => {
  const cappedPolicy = {
    ...policy,
    policyTermsSnapshot: { ...policy.policyTermsSnapshot, maximumPayoutMinor: 50000 }
  };
  assert.equal(calculatePolicyCompensation(cappedPolicy, verified(240)).amountMinor, 50000);
});
