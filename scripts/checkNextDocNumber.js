// Self-check for nextDocNumber: `node scripts/checkNextDocNumber.js`
import assert from 'node:assert/strict';
import { nextDocNumber } from '../src/utils/nextDocNumber.js';

// Minimal stand-in for a Mongoose model: find(filter).lean() honouring the $regex filter.
const fakeModel = (codes) => ({
  find: (filter) => {
    const [[field, { $regex }]] = Object.entries(filter);
    return { lean: async () => codes.filter((c) => new RegExp($regex).test(c)).map((c) => ({ [field]: c })) };
  },
});

// A deleted record left a gap: count would reissue CUST-008, max+1 must not.
assert.equal(await nextDocNumber(fakeModel(['CUST-001', 'CUST-003', 'CUST-008']), 'id', 'CUST-'), 'CUST-009');
assert.equal(await nextDocNumber(fakeModel([]), 'id', 'CUST-'), 'CUST-001');
// Other years and malformed codes don't count; past 999 keeps going numerically.
assert.equal(await nextDocNumber(fakeModel(['QT-2025-050', 'QT-2026-999', 'QT-2026-ABC']), 'quotationNo', 'QT-2026-'), 'QT-2026-1000');
assert.equal(await nextDocNumber(fakeModel(['SN-2026-0007']), 'serialNo', 'SN-2026-', 4), 'SN-2026-0008');
console.log('nextDocNumber: all checks passed');
