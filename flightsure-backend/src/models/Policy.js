import mongoose from 'mongoose';

const policyTermsSchema = new mongoose.Schema({
  version: { type: String, required: true },
  coverageThresholdMinutes: { type: Number, required: true, min: 0 },
  tiers: [{
    minimumDelayMinutes: { type: Number, required: true, min: 0 },
    amountMinor: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true }
  }],
  maximumPayoutMinor: { type: Number, required: true, min: 0 },
  coverageStartsAt: Date,
  coverageEndsAt: Date
}, { _id: false, strict: 'throw' });

const policySchema = new mongoose.Schema({
  policyId: { type: String, required: true, unique: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  flightId: { type: mongoose.Schema.Types.ObjectId, ref: 'Flight', required: true, index: true },
  walletAddress: { type: String, lowercase: true },
  premiumMinor: { type: Number, required: true, min: 0 },
  currency: { type: String, required: true },
  policyTermsSnapshot: { type: policyTermsSchema, required: true, immutable: true },
  status: { type: String, enum: ['PENDING_PAYMENT', 'PENDING_CONFIRMATION', 'ACTIVE', 'CLAIMED', 'EXPIRED', 'CANCELLED', 'FAILED'], default: 'PENDING_PAYMENT', index: true },
  blockchainTxHash: String,
  contractPolicyId: String,
  chainId: Number,
  idempotencyKey: { type: String, required: true },
  monitoringLeaseUntil: Date
}, { timestamps: true, strict: 'throw' });

policySchema.index({ userId: 1, idempotencyKey: 1 }, { unique: true });
export default mongoose.models.Policy || mongoose.model('Policy', policySchema);
