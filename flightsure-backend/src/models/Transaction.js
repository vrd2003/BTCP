import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  policyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Policy', index: true },
  transactionType: { type: String, enum: ['PREMIUM', 'COMPENSATION'], required: true },
  transactionHash: { type: String, required: true, unique: true, index: true },
  amountMinor: { type: Number, min: 0 },
  currency: String,
  network: String,
  status: { type: String, enum: ['SUBMITTED', 'CONFIRMED', 'FAILED'], required: true, index: true },
  blockNumber: Number
}, { timestamps: true, strict: 'throw' });

export default mongoose.models.Transaction || mongoose.model('Transaction', transactionSchema);
