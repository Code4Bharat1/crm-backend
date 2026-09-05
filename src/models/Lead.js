import mongoose from 'mongoose';

const leadSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true }, // e.g., LD-1001
  customerName: { type: String, required: true },
  date: { type: Date, default: Date.now },
  source: { type: String, enum: ["Reference", "IndiaMART", "Cold Call", "Website", "Exhibition", "WhatsApp", "Existing Customer", "Email Inquiry"] },
  stage: { type: String, enum: ["New", "Contacted", "Potential", "Hot", "Quotation Sent", "Negotiation", "Won", "Lost", "On Hold"], default: "New" },
  priority: { type: String, enum: ["Low", "Medium", "High", "Critical"], default: "Medium" },
  value: { type: Number, default: 0 },
  salesperson: { type: String },
  area: { type: String },
  notes: { type: String },
  sourceEmailId: { type: String, default: null }, // UID of the email this lead was created from
  customerEmail: { type: String, default: null },
  lastRepliedAt: { type: Date },
  convertedCustomerId: { type: String, default: null }, // CUST-xxx created/linked when the lead was Won
  convertedAt: { type: Date, default: null },
}, { timestamps: true });

export default mongoose.model('Lead',leadSchema);