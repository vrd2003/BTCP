import mongoose from 'mongoose';

const predictionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  flightId: { type: mongoose.Schema.Types.ObjectId, ref: 'Flight', required: true, index: true },
  delayProbability: { type: Number, min: 0, max: 1, required: true },
  riskLevel: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH'], required: true },
  modelVersion: { type: String, required: true },
  rationale: { type: String, maxlength: 500 },
  predictionTime: { type: Date, required: true },
  modelMode: { type: String, enum: ['TRAINED', 'GROQ_HEURISTIC', 'GROK_HEURISTIC'], required: true }
}, { timestamps: true, strict: 'throw' });

predictionSchema.index({ flightId: 1, predictionTime: -1 });
export default mongoose.models.Prediction || mongoose.model('Prediction', predictionSchema);
