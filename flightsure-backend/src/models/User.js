import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  passwordHash: { type: String, required: true, select: false },
  walletAddress: { type: String, lowercase: true, unique: true, sparse: true, index: true },
  walletNonce: { type: String, select: false },
  walletNonceExpiresAt: { type: Date, select: false },
  role: { type: String, enum: ['Passenger', 'Admin'], default: 'Passenger', immutable: true },
  tokenVersion: { type: Number, default: 0, select: false }
}, { timestamps: true, strict: 'throw' });

userSchema.set('toJSON', {
  transform(_document, result) {
    delete result.passwordHash;
    delete result.walletNonce;
    delete result.walletNonceExpiresAt;
    delete result.tokenVersion;
    delete result.__v;
    return result;
  }
});

export default mongoose.models.User || mongoose.model('User', userSchema);
