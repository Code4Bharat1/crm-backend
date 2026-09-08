import FollowUp from '../models/FollowUp.js';
import Quotation from '../models/Quotation.js';
import ProformaInvoice from '../models/ProformaInvoice.js';
import SalesInvoice from '../models/SalesInvoice.js';
import ServiceRequest from '../models/ServiceRequest.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Upserts one follow-up per triggering document, keyed by (source,
 * sourceRef, type). Uses $setOnInsert so a rerun never overwrites a status
 * change, priority edit, or note a human already made -- it only ever
 * creates the row the first time its trigger condition is met.
 */
const upsertFollowUp = async ({ source, sourceRef, type, customerName, owner, dueDate, priority, note }) => {
  await FollowUp.findOneAndUpdate(
    { source, sourceRef, type },
    { $setOnInsert: { source, sourceRef, type, customerName, owner, dueDate, priority, note, status: 'Pending' } },
    { upsert: true, setDefaultsOnInsert: true }
  );
};

/**
 * Scans real business documents for the reminder rules the Follow-up Engine
 * is meant to enforce and creates a FollowUp for anything that has crossed
 * its trigger point and doesn't already have one. Safe to call on every
 * page load / dashboard load -- idempotent by design.
 */
export const generateFollowUps = async () => {
  const now = new Date();

  // 1. Quotation follow-up: 3 days after sending, still not accepted/rejected.
  const staleQuotations = await Quotation.find({
    status: { $in: ['Sent', 'Viewed'] },
    date: { $lte: new Date(now - 3 * DAY_MS) },
  }).select('quotationNo customer salesperson date grandTotal');

  for (const q of staleQuotations) {
    await upsertFollowUp({
      source: 'Quotation',
      sourceRef: q.quotationNo,
      type: 'Quotation Follow-up',
      customerName: q.customer?.name || 'Customer',
      owner: q.salesperson || 'Sales Team',
      dueDate: new Date(q.date.getTime() + 3 * DAY_MS),
      priority: 'Medium',
      note: `Quotation ${q.quotationNo} sent, no response yet.`,
    });
  }

  // 2. Proforma advance reminder: advance not fully received.
  const unpaidProformas = await ProformaInvoice.find({
    status: { $nin: ['Cancelled', 'Converted'] },
    $expr: { $lt: ['$advanceReceived', '$advanceRequired'] },
    advanceRequired: { $gt: 0 },
  }).select('proformaNo customer salesperson date advanceRequired advanceReceived');

  for (const p of unpaidProformas) {
    const pending = (p.advanceRequired || 0) - (p.advanceReceived || 0);
    await upsertFollowUp({
      source: 'Proforma',
      sourceRef: p.proformaNo,
      type: 'Proforma Advance Reminder',
      customerName: p.customer?.name || 'Customer',
      owner: p.salesperson || 'Sales Team',
      dueDate: new Date(p.date ? p.date.getTime() + 8 * DAY_MS : now),
      priority: 'High',
      note: `Advance of ₹${pending.toLocaleString('en-IN')} still pending on ${p.proformaNo}.`,
    });
  }

  // 3. Invoice due reminder: due within the next 5 days, not yet paid.
  const dueSoonInvoices = await SalesInvoice.find({
    status: { $in: ['Sent', 'Partially Paid'] },
    dueDate: { $gte: now, $lte: new Date(now.getTime() + 5 * DAY_MS) },
  }).select('invoiceNo customer salesperson dueDate balanceAmount');

  for (const inv of dueSoonInvoices) {
    await upsertFollowUp({
      source: 'Invoice',
      sourceRef: inv.invoiceNo,
      type: 'Invoice Due Reminder',
      customerName: inv.customer?.name || 'Customer',
      owner: inv.salesperson || 'Accounts Team',
      dueDate: new Date(inv.dueDate.getTime() - 5 * DAY_MS),
      priority: 'Medium',
      note: `Invoice ${inv.invoiceNo} (₹${(inv.balanceAmount || 0).toLocaleString('en-IN')}) due ${inv.dueDate.toLocaleDateString('en-IN')}.`,
    });
  }

  // 4. Overdue invoice escalation.
  const overdueInvoices = await SalesInvoice.find({ status: 'Overdue' })
    .select('invoiceNo customer dueDate balanceAmount');

  for (const inv of overdueInvoices) {
    await upsertFollowUp({
      source: 'Invoice',
      sourceRef: inv.invoiceNo,
      type: 'Overdue Invoice Escalation',
      customerName: inv.customer?.name || 'Customer',
      owner: 'Accounts Manager',
      dueDate: inv.dueDate || now,
      priority: 'High',
      note: `Invoice ${inv.invoiceNo} overdue -- balance ₹${(inv.balanceAmount || 0).toLocaleString('en-IN')}.`,
    });
  }

  // 5. Service follow-up: 7 days after job completion.
  const completedJobs = await ServiceRequest.find({
    status: { $in: ['Resolved', 'Closed'] },
    resolvedOn: { $ne: null, $lte: new Date(now - 7 * DAY_MS) },
  }).select('requestId customer engineer resolvedOn productName');

  for (const s of completedJobs) {
    await upsertFollowUp({
      source: 'Service',
      sourceRef: s.requestId,
      type: 'Service Follow-up',
      customerName: s.customer?.name || 'Customer',
      owner: s.engineer?.name || 'Service Team',
      dueDate: new Date(s.resolvedOn.getTime() + 7 * DAY_MS),
      priority: 'Low',
      note: `Check in on ${s.productName || 'service job'} (${s.requestId}) after completion.`,
    });
  }
};

/** Pending/overdue/due-today/completed counts, for KPI cards. */
export const getFollowUpCounts = async () => {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(startOfToday.getTime() + DAY_MS);

  const [pending, overdue, dueToday, completed] = await Promise.all([
    FollowUp.countDocuments({ status: 'Pending' }),
    FollowUp.countDocuments({ status: 'Pending', dueDate: { $lt: startOfToday } }),
    FollowUp.countDocuments({ status: 'Pending', dueDate: { $gte: startOfToday, $lt: endOfToday } }),
    FollowUp.countDocuments({ status: 'Completed' }),
  ]);

  return { pending, overdue, dueToday, completed };
};
