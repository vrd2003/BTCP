import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  action: { type: String, required: true },
  resourceType: { type: String, required: true },
  resourceId: String,
  requestId: String,
  outcome: { type: String, enum: ['SUCCESS', 'DENIED', 'FAILED'], required: true },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true, strict: 'throw' });

auditLogSchema.index({ createdAt: -1 });
export default mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);
