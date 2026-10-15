// Next auto-generated code under `prefix`, e.g. nextDocNumber(Quotation, 'quotationNo', 'QT-2026-') -> 'QT-2026-018'.
// Takes the highest existing sequence rather than countDocuments(): a count reissues an
// existing code as soon as any record is deleted, and the unique index then rejects every create.
// Prefixes are plain letters/digits/dashes, so they go into the regex unescaped.
// ponytail: two simultaneous creates can still pick the same number; move to an atomic counter collection if that shows up.
export async function nextDocNumber(Model, field, prefix, pad = 3) {
  const docs = await Model.find({ [field]: { $regex: `^${prefix}\\d+$` } }, { [field]: 1 }).lean();
  const max = docs.reduce((m, d) => Math.max(m, parseInt(d[field].slice(prefix.length), 10) || 0), 0);
  return `${prefix}${String(max + 1).padStart(pad, '0')}`;
}
