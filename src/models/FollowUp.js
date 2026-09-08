import mongoose from 'mongoose';

const followUpSchema = new mongoose.Schema({
  customerName: { type: String, required: true },
  type: {
    type: String,
    enum: ['Quotation Follow-up', 'Proforma Advance Reminder', 'Invoice Due Reminder', 'Overdue Invoice Escalation', 'Service Follow-up', 'Manual'],
    default: 'Manual',
  },
  source: {
    type: String,
    enum: ['Quotation', 'Proforma', 'Invoice', 'Service', 'Manual'],
    default: 'Manual',
  },
  sourceRef: { type: String, default: '' }, // e.g. quotationNo / proformaNo / invoiceNo / requestId
  owner: { type: String, default: 'Sales Team' },
  dueDate: { type: Date, required: true },
  priority: { type: String, enum: ['Low', 'Medium', 'High'], default: 'Medium' },
  status: { type: String, enum: ['Pending', 'Completed', 'Snoozed'], default: 'Pending' },
  note: { type: String, default: '' },
  completedAt: { type: Date, default: null },
  completedBy: { type: String, default: '' },
}, { timestamps: true });

// One auto-generated follow-up per triggering document per rule -- reruns of
// the generator shouldn't spam duplicates for the same quotation/invoice/etc.
followUpSchema.index(
  { source: 1, sourceRef: 1, type: 1 },
  { unique: true, partialFilterExpression: { sourceRef: { $type: 'string', $ne: '' } } }
);

export default mongoose.model('FollowUp', followUpSchema);
