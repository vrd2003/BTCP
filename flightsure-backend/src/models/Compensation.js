import mongoose from 'mongoose';

const compensationSchema = new mongoose.Schema({
  policyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Policy', required: true, index: true },
  verificationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Verification', required: true },
  delayMinutes: { type: Number, required: true, min: 0 },
  compensationAmountMinor: { type: Number, required: true, min: 0 },
  currency: { type: String, required: true },
  payoutStatus: { type: String, enum: ['ELIGIBILITY_PENDING', 'ELIGIBLE', 'SUBMITTED', 'CONFIRMED', 'FAILED'], default: 'ELIGIBILITY_PENDING', index: true },
  transactionHash: String,
  paidAt: Date,
  idempotencyKey: { type: String, required: true }
}, { timestamps: true, strict: 'throw' });

compensationSchema.index({ policyId: 1, verificationId: 1 }, { unique: true });
export default mongoose.models.Compensation || mongoose.model('Compensation', compensationSchema);
