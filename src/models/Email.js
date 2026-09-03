import mongoose from 'mongoose';

const emailSchema = new mongoose.Schema({
  uid: { type: String, unique: true, required: true },
  subject: { type: String },
  from: { type: String },
  to: { type: String },
  text: { type: String },
  date: { type: Date },
  mailbox: { type: String },
  direction: { type: String, default: 'Incoming' },
  read: { type: Boolean, default: false },
  followedUp: { type: Boolean, default: false }
}, { timestamps: true });

export default mongoose.model('Email', emailSchema);
