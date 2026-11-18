import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import Policy from '../src/models/Policy.js';
import { monitoringPolicyFilter } from '../src/workers/flightMonitor.js';

test('preserves the trusted lease expiry operator with Mongo filter sanitization enabled', () => {
  const previous = mongoose.get('sanitizeFilter');
  mongoose.set('sanitizeFilter', true);
  const now = new Date();

  try {
    const filter = monitoringPolicyFilter(now);
    Policy.find(filter).cast(Policy);
    assert.equal(filter.$or[1].monitoringLeaseUntil.$lt, now);
  } finally {
    mongoose.set('sanitizeFilter', previous);
  }
});
