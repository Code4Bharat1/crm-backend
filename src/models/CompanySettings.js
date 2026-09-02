import mongoose from 'mongoose';

const companySettingsSchema = new mongoose.Schema({
  name:        { type: String, default: 'Nexcore Alliance Pvt. Ltd.' },
  tagline:     { type: String, default: 'Automation & Industrial Solutions' },
  address: {
    line1:   { type: String, default: '123, Industrial Area, Phase II' },
    line2:   { type: String, default: 'Bhosari, Pune - 411026' },
    city:    { type: String, default: 'Pune' },
    state:   { type: String, default: 'Maharashtra' },
    pinCode: { type: String, default: '411026' },
    country: { type: String, default: 'India' },
  },
  phone:       { type: String, default: '+91 20 1234 5678' },
  email:       { type: String, default: 'info@nexcorealliance.com' },
  website:     { type: String, default: 'www.nexcorealliance.com' },
  gstNumber:   { type: String, default: '27AABCN1234A1Z5' },
  panNumber:   { type: String, default: 'AABCN1234A' },
  cinNumber:   { type: String },
  logoUrl:     { type: String },
  bankDetails: {
    bankName:      { type: String, default: 'HDFC Bank Ltd.' },
    branch:        { type: String, default: 'Bhosari, Pune' },
    accountNumber: { type: String, default: '50100123456789' },
    ifscCode:      { type: String, default: 'HDFC0001234' },
    accountName:   { type: String, default: 'Nexcore Alliance Pvt. Ltd.' },
  },
  signatureText:   { type: String, default: 'For Nexcore Alliance Pvt. Ltd.' },
  footerNote:      { type: String, default: 'This is a computer generated document. No signature required.' },
  termsAndConditions: { type: String, default: '1. Payment due within 30 days of invoice date.\n2. Goods once sold will not be taken back.\n3. Subject to Pune jurisdiction.' },
}, { timestamps: true });

export default mongoose.model('CompanySettings', companySettingsSchema);
