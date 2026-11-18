import mongoose from 'mongoose';

const flightSourceRecordSchema = new mongoose.Schema({
  flightId: { type: mongoose.Schema.Types.ObjectId, ref: 'Flight', required: true, index: true },
  sourceId: { type: String, required: true },
  eventType: { type: String, enum: ['DEPARTURE', 'ARRIVAL'], required: true },
  scheduledTime: { type: Date, required: true },
  actualTime: Date,
  delayMinutes: Number,
  fetchedAt: { type: Date, required: true },
  status: { type: String, enum: ['RECEIVED', 'STALE', 'INVALID', 'UNAVAILABLE', 'DISAGREES'], required: true },
  errorCode: String
}, { timestamps: true, strict: 'throw' });

flightSourceRecordSchema.index({ flightId: 1, sourceId: 1, eventType: 1, fetchedAt: -1 });
export default mongoose.models.FlightSourceRecord || mongoose.model('FlightSourceRecord', flightSourceRecordSchema);
