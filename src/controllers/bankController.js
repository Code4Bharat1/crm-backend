import BankTransaction from '../models/BankTransaction.js';
import SalesInvoice from '../models/SalesInvoice.js';
import { findMatchForTransaction } from '../utils/bankMatching.js';
import { fetchHdfcStatement, isHdfcConfigured } from '../utils/hdfcBankConnector.js';

// GET /api/bank/transactions
export const getBankTransactions = async (req, res) => {
  try {
    const { status } = req.query;
    const query = status ? { status } : {};
    const transactions = await BankTransaction.find(query).sort({ date: -1 });
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching bank transactions', error: error.message });
  }
};

// GET /api/bank/status -- whether a live bank connection is configured yet
export const getBankStatus = async (req, res) => {
  res.json({ hdfcConfigured: isHdfcConfigured() });
};

// POST /api/bank/transactions -- manual entry (statement upload fallback /
// testing the reconciliation workflow before a live bank API is wired up)
export const addBankTransaction = async (req, res) => {
  try {
    const { date, amount, senderName, reference, bankAccount } = req.body;
    if (!date || !amount) {
      return res.status(400).json({ message: 'date and amount are required' });
    }

    const match = await findMatchForTransaction({ amount: Number(amount), senderName: senderName || '' });

    const txn = await BankTransaction.create({
      source: 'Manual',
      date,
      amount: Number(amount),
      senderName: senderName || 'Unknown',
      reference: reference || '',
      bankAccount: bankAccount || '',
      status: match.status,
      confidence: match.confidence,
      suggestedCustomerId: match.invoice?.customer?.id || null,
      suggestedCustomerName: match.invoice?.customer?.name || '',
      suggestedInvoiceId: match.invoice?._id || null,
      suggestedInvoiceNo: match.invoice?.invoiceNo || '',
    });

    res.status(201).json(txn);
  } catch (error) {
    res.status(400).json({ message: 'Error adding bank transaction', error: error.message });
  }
};

// POST /api/bank/sync -- pull real credits from HDFC for the last N days,
// de-duping against already-imported transactions, and run each new one
// through the matching engine.
export const syncHdfcTransactions = async (req, res) => {
  try {
    if (!isHdfcConfigured()) {
      return res.status(400).json({
        message: 'HDFC API is not configured yet. Add HDFC_API_BASE_URL, HDFC_CLIENT_ID, HDFC_CLIENT_SECRET and HDFC_ACCOUNT_NUMBER to .env, then try again.',
        configured: false,
      });
    }

    const days = Number(req.query.days) || 30;
    const toDate = new Date();
    const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const rows = await fetchHdfcStatement({
      fromDate: fromDate.toISOString().split('T')[0],
      toDate: toDate.toISOString().split('T')[0],
    });

    let created = 0;
    for (const row of rows) {
      const exists = await BankTransaction.findOne({ source: 'HDFC', externalId: row.externalId });
      if (exists) continue;

      const match = await findMatchForTransaction({ amount: row.amount, senderName: row.senderName });

      await BankTransaction.create({
        source: 'HDFC',
        externalId: row.externalId,
        date: row.date,
        amount: row.amount,
        senderName: row.senderName,
        reference: row.reference,
        bankAccount: row.bankAccount,
        rawPayload: row.rawPayload,
        status: match.status,
        confidence: match.confidence,
        suggestedCustomerId: match.invoice?.customer?.id || null,
        suggestedCustomerName: match.invoice?.customer?.name || '',
        suggestedInvoiceId: match.invoice?._id || null,
        suggestedInvoiceNo: match.invoice?.invoiceNo || '',
      });
      created += 1;
    }

    res.json({ configured: true, fetched: rows.length, created });
  } catch (error) {
    res.status(500).json({ message: 'Error syncing HDFC statement', error: error.message });
  }
};

// POST /api/bank/transactions/:id/reconcile -- confirm a match: records a
// real payment against the invoice (same effect as the manual "Record
// Payment" flow on Sales Invoices) and marks the transaction Reconciled.
export const reconcileTransaction = async (req, res) => {
  try {
    const txn = await BankTransaction.findById(req.params.id);
    if (!txn) return res.status(404).json({ message: 'Bank transaction not found' });
    if (txn.status === 'Reconciled') {
      return res.status(400).json({ message: 'This transaction is already reconciled' });
    }

    const invoiceId = req.body?.invoiceId || txn.suggestedInvoiceId;
    if (!invoiceId) {
      return res.status(400).json({ message: 'No invoice specified and no suggested match to reconcile against' });
    }

    const invoice = await SalesInvoice.findById(invoiceId);
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });

    invoice.payments.push({
      date: txn.date,
      amount: txn.amount,
      mode: 'NEFT',
      reference: txn.reference,
      notes: `Reconciled from bank transaction (${txn.source}${txn.senderName ? `, ${txn.senderName}` : ''})`,
      recordedBy: req.user?.name || req.user?.email || 'Bank Reconciliation',
    });
    await invoice.save(); // pre-save hook recalculates receivedAmount/balanceAmount/status

    txn.status = 'Reconciled';
    txn.reconciledInvoiceId = invoice._id;
    txn.reconciledInvoiceNo = invoice.invoiceNo;
    txn.reconciledAt = new Date();
    txn.reconciledBy = req.user?.name || req.user?.email || 'Bank Reconciliation';
    await txn.save();

    res.json({ transaction: txn, invoice });
  } catch (error) {
    res.status(400).json({ message: 'Error reconciling transaction', error: error.message });
  }
};

// POST /api/bank/transactions/:id/dismiss -- mark reviewed with no match
// (keeps the row for audit instead of deleting it)
export const dismissTransaction = async (req, res) => {
  try {
    const txn = await BankTransaction.findById(req.params.id);
    if (!txn) return res.status(404).json({ message: 'Bank transaction not found' });
    if (txn.status === 'Reconciled') {
      return res.status(400).json({ message: 'This transaction is already reconciled' });
    }

    txn.status = 'Unmatched';
    txn.suggestedCustomerId = null;
    txn.suggestedCustomerName = '';
    txn.suggestedInvoiceId = null;
    txn.suggestedInvoiceNo = '';
    txn.confidence = 0;
    await txn.save();

    res.json(txn);
  } catch (error) {
    res.status(400).json({ message: 'Error dismissing transaction', error: error.message });
  }
};

// DELETE /api/bank/transactions/:id -- remove a manually-added erroneous row
export const deleteBankTransaction = async (req, res) => {
  try {
    const txn = await BankTransaction.findById(req.params.id);
    if (!txn) return res.status(404).json({ message: 'Bank transaction not found' });
    if (txn.status === 'Reconciled') {
      return res.status(400).json({ message: 'Cannot delete a reconciled transaction' });
    }
    await BankTransaction.deleteOne({ _id: req.params.id });
    res.json({ message: 'Bank transaction deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting bank transaction', error: error.message });
  }
};
