import mongoose from 'mongoose';

const bankTransactionSchema = new mongoose.Schema({
  source: { type: String, enum: ['HDFC', 'Manual'], default: 'Manual' },
  externalId: { type: String, default: null }, // bank's own transaction id, for de-duping repeat syncs
  bankAccount: { type: String, default: '' },
  date: { type: Date, required: true },
  amount: { type: Number, required: true },
  senderName: { type: String, default: 'Unknown' },
  reference: { type: String, default: '' },
  rawPayload: { type: mongoose.Schema.Types.Mixed, default: null }, // original API/CSV row, for audit

  status: {
    type: String,
    enum: ['Suggested', 'Needs Review', 'Unmatched', 'Reconciled'],
    default: 'Unmatched',
  },
  confidence: { type: Number, default: 0, min: 0, max: 1 },
  suggestedCustomerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },
  suggestedCustomerName: { type: String, default: '' },
  suggestedInvoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'SalesInvoice', default: null },
  suggestedInvoiceNo: { type: String, default: '' },

  reconciledInvoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'SalesInvoice', default: null },
  reconciledInvoiceNo: { type: String, default: '' },
  reconciledAt: { type: Date, default: null },
  reconciledBy: { type: String, default: '' },
}, { timestamps: true });

// A given bank transaction (by external id) should only ever be imported
// once per sync. Manual entries never set externalId, so a plain `sparse`
// index doesn't work here -- sparse only skips documents where the field is
// truly *missing*, and our schema default (null) still counts as present,
// which would wrongly cap manual entries at one document total. A partial
// index scoped to real string ids is the correct way to make uniqueness
// apply only to HDFC-sourced rows.
bankTransactionSchema.index(
  { source: 1, externalId: 1 },
  { unique: true, partialFilterExpression: { externalId: { $type: 'string' } } }
);

export default mongoose.model('BankTransaction', bankTransactionSchema);
