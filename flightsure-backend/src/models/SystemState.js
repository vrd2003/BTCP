import mongoose from 'mongoose';

const systemStateSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: mongoose.Schema.Types.Mixed, required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true, strict: 'throw' });

export default mongoose.models.SystemState || mongoose.model('SystemState', systemStateSchema);
