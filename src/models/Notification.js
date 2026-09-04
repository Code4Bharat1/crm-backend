import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  recipient: { type: String, required: true }, // e.g. "karan jfaskljfds" or "all"
  recipientEmail: { type: String, default: '' },
  recipientRole: { type: String, default: 'project manager' },
  title: { type: String, required: true },
  detail: { type: String, required: true },
  type: {
    type: String,
    enum: ['Project', 'Lead', 'Quotation', 'Order', 'Service', 'System', 'HR'],
    default: 'Project'
  },
  severity: {
    type: String,
    enum: ['info', 'warning', 'danger', 'accent', 'success'],
    default: 'info'
  },
  link: { type: String, default: '' },
  projectId: { type: String, default: '' },
  projectName: { type: String, default: '' },
  customerName: { type: String, default: '' },
  revenue: { type: Number, default: 0 },
  read: { type: Boolean, default: false },
  at: { type: Date, default: Date.now }
}, { timestamps: true });

export default mongoose.model('Notification', notificationSchema);
