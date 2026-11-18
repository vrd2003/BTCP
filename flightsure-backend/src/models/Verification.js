import mongoose from 'mongoose';

const sourceRecordSchema = new mongoose.Schema({
  sourceId: { type: String, required: true },
  flightNumber: String,
  eventType: String,
  scheduledTime: Date,
  actualTime: Date,
  delayMinutes: Number,
  fetchedAt: Date,
  status: { type: String, enum: ['RECEIVED', 'STALE', 'INVALID', 'UNAVAILABLE', 'DISAGREES'], required: true },
  errorCode: String
}, { _id: false, strict: 'throw' });

const verificationSchema = new mongoose.Schema({
  flightId: { type: mongoose.Schema.Types.ObjectId, ref: 'Flight', required: true, index: true },
  sourceRecords: { type: [sourceRecordSchema], default: [] },
  consensusStatus: { type: String, enum: ['VERIFICATION_PENDING', 'VERIFIED', 'REJECTED'], default: 'VERIFICATION_PENDING', index: true },
  verifiedDelayMinutes: Number,
  agreeingSourceIds: { type: [String], default: [] },
  eventId: { type: String, unique: true, sparse: true, index: true },
  oracleTxHash: String,
  status: { type: String, enum: ['VERIFICATION_PENDING', 'VERIFIED', 'SUBMITTED', 'FAILED'], default: 'VERIFICATION_PENDING' }
}, { timestamps: true, strict: 'throw' });

verificationSchema.index({ flightId: 1, createdAt: -1 });
export default mongoose.models.Verification || mongoose.model('Verification', verificationSchema);
