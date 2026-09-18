/**
 * Dashboard period semantics, kept identical to the mobile client's
 * getPeriodRange (CRM_APP/src/app/(drawer)/index.tsx) so both platforms
 * agree on what "This quarter" / "FY 2026-27" mean. Indian financial year
 * runs Apr-Mar; "This quarter" follows the same fiscal quarters.
 */
export function getPeriodRange(period, now = new Date()) {
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-11

  if (period === 'This quarter') {
    const fiscalMonth = (month - 3 + 12) % 12; // months since Apr
    const quarterStartOffset = Math.floor(fiscalMonth / 3) * 3;
    const quarterStartMonth = (3 + quarterStartOffset) % 12;
    const quarterStartYear = quarterStartMonth <= month ? year : year - 1;
    return { start: new Date(quarterStartYear, quarterStartMonth, 1), end: now };
  }

  const fyMatch = /FY\s*(\d{4})/.exec(period || '');
  if (fyMatch) {
    const fyStartYear = parseInt(fyMatch[1], 10);
    return { start: new Date(fyStartYear, 3, 1), end: new Date(fyStartYear + 1, 2, 31, 23, 59, 59, 999) };
  }

  if (period === 'This month') {
    return { start: new Date(year, month, 1), end: now };
  }

  // Unrecognized or absent -> caller keeps its existing unfiltered behavior.
  return null;
}

/**
 * Calendar months (as {year, month} pairs, month 0-11) spanned by
 * [start, end] inclusive, oldest first. Capped defensively at maxMonths
 * (the largest legal span from getPeriodRange is a full FY = 12 months).
 */
export function monthsBetween(start, end, maxMonths = 12) {
  const months = [];
  let cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);

  while (cursor <= last && months.length < maxMonths) {
    months.push({ year: cursor.getFullYear(), month: cursor.getMonth() });
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }

  return months;
}
