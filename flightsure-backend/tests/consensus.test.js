import test from 'node:test';
import assert from 'node:assert/strict';
import { consensusFor } from '../src/oracle/consensus.js';

const report = (sourceId, delayMinutes, status = 'RECEIVED') => ({ sourceId, delayMinutes, status });

test('requires two fresh valid sources within the configured tolerance', () => {
  const result = consensusFor([
    report('SOURCE_A', 62),
    report('SOURCE_B', 66),
    report('SOURCE_C', 100)
  ], 5);
  assert.equal(result.status, 'VERIFIED');
  assert.deepEqual(result.agreeingSourceIds, ['SOURCE_A', 'SOURCE_B']);
  assert.equal(result.delayMinutes, 64);
});

test('keeps disagreement pending instead of reporting consensus', () => {
  const result = consensusFor([
    report('SOURCE_A', 20),
    report('SOURCE_B', 45),
    report('SOURCE_C', 90)
  ], 5);
  assert.equal(result.status, 'VERIFICATION_PENDING');
  assert.deepEqual(result.agreeingSourceIds, []);
  assert.equal(result.delayMinutes, undefined);
});

test('does not count stale or unavailable observations', () => {
  const result = consensusFor([
    report('SOURCE_A', 30),
    report('SOURCE_B', 30, 'STALE'),
    report('SOURCE_C', 31, 'UNAVAILABLE')
  ], 5);
  assert.equal(result.status, 'VERIFICATION_PENDING');
});
