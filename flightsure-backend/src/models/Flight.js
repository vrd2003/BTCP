import mongoose from 'mongoose';

const flightSchema = new mongoose.Schema({
  providerId: { type: String, required: true },
  flightNumber: { type: String, required: true, uppercase: true, trim: true, index: true },
  airline: { type: String, trim: true },
  origin: { type: String, uppercase: true, trim: true },
  destination: { type: String, uppercase: true, trim: true },
  scheduledDeparture: Date,
  scheduledArrival: Date,
  actualDeparture: Date,
  actualArrival: Date,
  status: { type: String, trim: true },
  delayMinutes: Number,
  lastFetchedAt: Date,
  provider: { type: String, required: true }
}, { timestamps: true, strict: 'throw' });

flightSchema.index({ provider: 1, providerId: 1 }, { unique: true });
export default mongoose.models.Flight || mongoose.model('Flight', flightSchema);
