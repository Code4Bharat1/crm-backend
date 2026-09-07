import SalesInvoice from '../models/SalesInvoice.js';

const normalize = (str = '') => str.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

// Token-overlap similarity (0-1): how many of the shorter name's words appear
// in the longer one. Cheap and dependency-free, but tolerant of bank
// statements mangling company names ("SHAKTI ENGG" vs "Shakti Engineering
// Works Pvt Ltd") in ways a strict string-distance metric wouldn't be.
const nameSimilarity = (a, b) => {
  const wordsA = normalize(a).split(' ').filter((w) => w.length > 2);
  const wordsB = normalize(b).split(' ').filter((w) => w.length > 2);
  if (!wordsA.length || !wordsB.length) return 0;
  const [shorter, longer] = wordsA.length <= wordsB.length ? [wordsA, wordsB] : [wordsB, wordsA];
  const longerSet = new Set(longer);
  const hits = shorter.filter((w) => longerSet.has(w)).length;
  return hits / shorter.length;
};

/**
 * Matches an incoming bank credit against open (unpaid/partially paid)
 * invoices: name similarity against the invoice's customer name carries most
 * of the weight, with a bonus when the amount exactly matches the invoice's
 * outstanding balance. Never auto-finalises anything -- just proposes a
 * best-guess invoice + confidence for a human to review or confirm.
 */
export const findMatchForTransaction = async ({ amount, senderName }) => {
  const openInvoices = await SalesInvoice.find({ balanceAmount: { $gt: 0 } })
    .select('invoiceNo customer balanceAmount grandTotal')
    .limit(500);

  let best = null;
  for (const inv of openInvoices) {
    const nameScore = nameSimilarity(senderName, inv.customer?.name || '');
    const amountMatches = Math.abs((inv.balanceAmount || 0) - amount) < 1;
    const confidence = Math.min(1, nameScore * 0.6 + (amountMatches ? 0.4 : 0));

    if (!best || confidence > best.confidence) {
      best = { invoice: inv, confidence };
    }
  }

  if (!best || best.confidence < 0.3) {
    return { status: 'Unmatched', confidence: 0, invoice: null };
  }

  const status = best.confidence >= 0.75 ? 'Suggested' : 'Needs Review';
  return { status, confidence: Math.round(best.confidence * 100) / 100, invoice: best.invoice };
};
