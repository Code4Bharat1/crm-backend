import axios from 'axios';

/**
 * !! PLACEHOLDER -- NOT VERIFIED AGAINST HDFC'S ACTUAL API SPEC !!
 *
 * HDFC's real request/response shapes live behind their Developer Portal
 * login (developer.hdfc.bank.in -> Accounts and Deposits -> "Corporate
 * Aggregator Large Statement Generation"), which requires their own
 * sandbox/production approval to view. This implements the *general*
 * pattern almost every Indian corporate banking API follows (OAuth2
 * client-credentials -> bearer token -> GET statement by account + date
 * range), so the surrounding app (matching, reconciliation, ledger) has a
 * real seam to plug into today.
 *
 * Once you have real HDFC API docs, the only thing that should need
 * rewriting is the body of getAccessToken() and fetchHdfcStatement() below
 * -- the endpoint paths, auth flow, and field names in the response mapping
 * are all best guesses and will very likely need adjusting to match what
 * HDFC actually returns.
 *
 * Required env vars (none of this runs without them):
 *   HDFC_API_BASE_URL   e.g. https://api.hdfcbank.com (sandbox or prod URL from the portal)
 *   HDFC_CLIENT_ID
 *   HDFC_CLIENT_SECRET
 *   HDFC_ACCOUNT_NUMBER  the account whose statement you're pulling
 */

export const isHdfcConfigured = () =>
  !!(process.env.HDFC_API_BASE_URL && process.env.HDFC_CLIENT_ID && process.env.HDFC_CLIENT_SECRET && process.env.HDFC_ACCOUNT_NUMBER);

const getAccessToken = async () => {
  // PLACEHOLDER: adjust path/body to whatever HDFC's actual token endpoint expects.
  const res = await axios.post(`${process.env.HDFC_API_BASE_URL}/oauth/token`, {
    grant_type: 'client_credentials',
    client_id: process.env.HDFC_CLIENT_ID,
    client_secret: process.env.HDFC_CLIENT_SECRET,
  });
  return res.data.access_token || res.data.accessToken;
};

/**
 * Fetches incoming credit transactions for the configured account between
 * two dates and normalizes them into the shape the rest of the app expects.
 * Throws a clear, actionable error if HDFC isn't configured yet -- callers
 * should catch this and surface it, not silently swallow it.
 */
export const fetchHdfcStatement = async ({ fromDate, toDate }) => {
  if (!isHdfcConfigured()) {
    throw new Error(
      'HDFC API is not configured. Set HDFC_API_BASE_URL, HDFC_CLIENT_ID, HDFC_CLIENT_SECRET and HDFC_ACCOUNT_NUMBER in .env first.'
    );
  }

  const token = await getAccessToken();

  // PLACEHOLDER: adjust path/params to whatever HDFC's statement API actually expects.
  const res = await axios.get(`${process.env.HDFC_API_BASE_URL}/statement`, {
    headers: { Authorization: `Bearer ${token}` },
    params: {
      accountNumber: process.env.HDFC_ACCOUNT_NUMBER,
      fromDate,
      toDate,
    },
  });

  const rows = res.data?.transactions || res.data?.data || [];

  // PLACEHOLDER: field names below (transactionId, transactionDate, amount,
  // remitterName, drCr, utrNumber) are guesses at common naming -- rename to
  // match HDFC's real response once you can see it.
  return rows
    .filter((r) => /credit|cr/i.test(r.type || r.drCr || r.transactionType || ''))
    .map((r) => ({
      externalId: String(r.transactionId || r.txnId || r.id || `${r.transactionDate}-${r.amount}`),
      date: new Date(r.transactionDate || r.date || r.valueDate),
      amount: Number(r.amount || r.txnAmount || 0),
      senderName: r.remitterName || r.narration || r.description || 'Unknown',
      reference: r.utrNumber || r.reference || r.chequeNumber || '',
      bankAccount: process.env.HDFC_ACCOUNT_NUMBER,
      rawPayload: r,
    }));
};
