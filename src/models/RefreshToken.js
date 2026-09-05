import mongoose from 'mongoose';

const refreshTokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  tokenHash: {
    type: String,
    required: true,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
  revokedAt: {
    type: Date,
    default: null,
  },
  replacedByTokenHash: {
    type: String,
    default: null,
  },
  userAgent: {
    type: String,
  },
  ipAddress: {
    type: String,
  },
}, { timestamps: true });

// TTL index to automatically remove expired tokens
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Index for fast lookups
refreshTokenSchema.index({ tokenHash: 1 });
refreshTokenSchema.index({ userId: 1 });

export default mongoose.model('RefreshToken', refreshTokenSchema);
