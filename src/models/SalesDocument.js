import mongoose from 'mongoose';

const itemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  qty: { type: Number, required: true, min: 1 },
  rate: { type: Number, required: true, min: 0 },
  amount: { type: Number, required: true }
});

const salesDocumentSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true }, // e.g., QT-1001, SO-1024, INV-1004
  type: { type: String, required: true, enum: ["Quotation", "Sales Order", "Invoice"] },
  customerName: { type: String, required: true },
  date: { type: Date, default: Date.now },
  dueDate: { type: Date }, // Especially for Invoices
  status: { type: String, required: true }, // "Draft", "Sent", "Confirmed", "Paid", "Overdue", etc.
  items: [itemSchema],
  subtotal: { type: Number, required: true },
  taxAmount: { type: Number, default: 0 },
  totalAmount: { type: Number, required: true },
  receivedAmount: { type: Number, default: 0 }, // For Invoices
  salesperson: { type: String },
  notes: { type: String }
}, { timestamps: true });

export default mongoose.model('SalesDocument',salesDocumentSchema);