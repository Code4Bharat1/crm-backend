const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/**
 * Calendar date (YYYY-MM-DD) for a moment in IST, regardless of the server's
 * own timezone. Attendance day-boundaries (punch-in/out, "today") must line
 * up with IST midnight, not UTC midnight -- otherwise anyone punching in
 * between 12:00am-5:30am IST gets attributed to the wrong day.
 */
export const getISTDateString = (date = new Date()) => {
  return new Date(date.getTime() + IST_OFFSET_MS).toISOString().split('T')[0];
};
