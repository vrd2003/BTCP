import test from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../src/config/env.js';

test('requires an explicitly configured access-token secret', () => {
  assert.throws(
    () => loadConfig({ JWT_ACCESS_SECRET: '' }),
    /JWT_ACCESS_SECRET/
  );
});

test('treats blank optional integrations as unconfigured', () => {
  const config = loadConfig({
    JWT_ACCESS_SECRET: 'test-only-secret-that-is-long-enough-to-satisfy-validation',
    ORACLE_SOURCE_A_URL: '',
    ORACLE_SOURCE_A_FEED_ID: '',
    BLOCKCHAIN_RPC_URL: '',
    BLOCKCHAIN_CHAIN_ID: '',
    ADMIN_BOOTSTRAP_EMAIL: '',
    ADMIN_BOOTSTRAP_PASSWORD: ''
  });

  assert.equal(config.ORACLE_SOURCE_A_URL, undefined);
  assert.equal(config.BLOCKCHAIN_CHAIN_ID, undefined);
  assert.equal(config.ADMIN_BOOTSTRAP_EMAIL, undefined);
  assert.equal(config.MONGODB_URI, 'mongodb://127.0.0.1:27017/flightsure');
  assert.equal(config.GROQ_API_KEY, undefined);
  assert.equal(config.GROQ_MODEL, 'openai/gpt-oss-120b');
});

test('accepts safe Sepolia ETH terms and requires a payout tier at the threshold', () => {
  const config = loadConfig({
    JWT_ACCESS_SECRET: 'test-only-secret-that-is-long-enough-to-satisfy-validation',
    POLICY_CATALOG_JSON: JSON.stringify([{
      planId: 'basic-test',
      name: 'Basic',
      currency: 'ETH',
      premiumMinor: 100000000000000,
      policyTerms: {
        version: 'sepolia-test-v1',
        coverageThresholdMinutes: 60,
        tiers: [
          { minimumDelayMinutes: 60, amountMinor: 200000000000000, currency: 'ETH' },
          { minimumDelayMinutes: 120, amountMinor: 400000000000000, currency: 'ETH' }
        ],
        maximumPayoutMinor: 400000000000000
      }
    }])
  });
  assert.equal(config.POLICY_CATALOG[0].currency, 'ETH');
  assert.throws(() => loadConfig({
    JWT_ACCESS_SECRET: 'test-only-secret-that-is-long-enough-to-satisfy-validation',
    POLICY_CATALOG_JSON: JSON.stringify([{
      planId: 'invalid-test',
      name: 'Invalid',
      currency: 'ETH',
      premiumMinor: 100000000000000,
      policyTerms: {
        version: 'test-v1',
        coverageThresholdMinutes: 60,
        tiers: [{ minimumDelayMinutes: 120, amountMinor: 200000000000000, currency: 'ETH' }],
        maximumPayoutMinor: 200000000000000
      }
    }])
  }), /payout tier at its coverage threshold/);
});
