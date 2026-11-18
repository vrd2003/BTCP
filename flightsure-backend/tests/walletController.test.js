import test from 'node:test';
import assert from 'node:assert/strict';
import User from '../src/models/User.js';
import { createWalletNonce } from '../src/controllers/authController.js';

test('creates a wallet challenge with an atomic update instead of saving a partial user document', async () => {
  const originalUpdateOne = User.updateOne;
  let update;
  const response = {
    statusCode: null,
    body: null,
    status(statusCode) { this.statusCode = statusCode; return this; },
    json(body) { this.body = body; return this; }
  };
  User.updateOne = async (...args) => {
    update = args;
    return { matchedCount: 1 };
  };

  try {
    await createWalletNonce({
      body: { address: '0x0000000000000000000000000000000000000001' },
      user: { _id: '507f1f77bcf86cd799439011' }
    }, response);

    assert.equal(response.statusCode, 200);
    assert.match(response.body.data.message, /FlightSure wallet ownership verification/);
    assert.match(response.body.data.message, /Nonce: [a-f0-9]{64}/);
    assert.equal(update[0]._id, '507f1f77bcf86cd799439011');
    assert.match(update[1].$set.walletNonce, /^[a-f0-9]{64}$/);
    assert.ok(update[1].$set.walletNonceExpiresAt instanceof Date);
    assert.equal(update[2].runValidators, true);
  } finally {
    User.updateOne = originalUpdateOne;
  }
});
