import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userName: { type: String },
  userRole: { type: String },
  
  action: { type: String, required: true },
  module: { type: String, required: true },
  
  resourceType: { type: String },
  resourceId: { type: String },
  
  description: { type: String, required: true },
  
  ipAddress: { type: String },
  userAgent: { type: String },
  
  severity: { type: String, enum: ['INFO', 'WARNING', 'CRITICAL'], default: 'INFO' },
  status: { type: String, enum: ['SUCCESS', 'FAILED'], default: 'SUCCESS' },
  
  metadata: { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true });

// Indexes for faster querying
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ userId: 1 });
auditLogSchema.index({ action: 1 });
auditLogSchema.index({ module: 1 });
auditLogSchema.index({ severity: 1 });
auditLogSchema.index({ resourceId: 1 });

export default mongoose.model('AuditLog', auditLogSchema);
