import mongoose from 'mongoose';
import { nextDocNumber } from '../utils/nextDocNumber.js';

const supplierSchema = new mongoose.Schema({
  supplierCode: { type: String, unique: true }, // e.g., SUP-001
  name:         { type: String, required: true },
  contactPerson:{ type: String },
  phone:        { type: String },
  email:        { type: String },
  address: {
    street: { type: String },
    city:   { type: String },
    state:  { type: String },
    pinCode:{ type: String },
    country:{ type: String, default: 'India' },
  },
  gstNumber:    { type: String },
  panNumber:    { type: String },
  bankDetails: {
    bankName:      { type: String },
    accountNumber: { type: String },
    ifscCode:      { type: String },
    accountName:   { type: String },
    branch:        { type: String },
  },
  paymentTerms: { type: String, default: '30 Days Net' },
  creditLimit:  { type: Number, default: 0 },
  status:       { type: String, enum: ['Active', 'Inactive', 'Blacklisted'], default: 'Active' },
  notes:        { type: String },
}, { timestamps: true });

supplierSchema.pre('validate', async function () {
  if (!this.supplierCode) {
    this.supplierCode = await nextDocNumber(mongoose.model('Supplier'), 'supplierCode', `SUP-`);
  }
});

export default mongoose.model('Supplier', supplierSchema);
