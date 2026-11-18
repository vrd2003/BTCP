import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  read: { type: Boolean, default: false }
}, { timestamps: true, strict: 'throw' });

notificationSchema.index({ userId: 1, createdAt: -1 });
export default mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
