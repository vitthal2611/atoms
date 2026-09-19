// Formatting utility functions

/**
 * Round to at most one decimal for display
 */
export function fmtNum(n) {
  return Number.isInteger(n) ? String(n) : (Math.round(n * 10) / 10).toFixed(1);
}

/**
 * Normalize time to 24h format (handles "7:30 am" style inputs)
 */
export function to24h(timeStr) {
  if (!timeStr) return timeStr;
  const t = timeStr.toLowerCase().trim();
  if (!t.includes("am") && !t.includes("pm")) return timeStr;
  
  const match = t.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/);
  if (!match) return timeStr;
  
  let h = parseInt(match[1]);
  const m = match[2] || "00";
  const period = match[3];
  
  if (period === "pm" && h !== 12) h += 12;
  if (period === "am" && h === 12) h = 0;
  
  return `${String(h).padStart(2, "0")}:${m}`;
}

/**
 * Strip "I am a/an" prefix from identity labels
 */
export function shortLabel(label) {
  return label.replace(/^I am an? /i, "").replace(/^I am /i, "");
}

/**
 * Capitalize only the first letter
 */
export function capFirst(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/**
 * Generate a unique ID
 */
export function uid() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Get hour from time string for sorting
 */
export function parseHour(timeStr) {
  if (!timeStr) return 25;
  const match = timeStr.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?/i);
  if (!match) return 25;
  
  let h = parseInt(match[1]);
  const period = match[3];
  
  if (period) {
    const p = period.toLowerCase();
    if (p === "pm" && h !== 12) h += 12;
    if (p === "am" && h === 12) h = 0;
  }
  
  return h + (match[2] ? parseInt(match[2]) / 60 : 0);
}

/**
 * Get time slot ID for grouping habits
 */
export function getSlotId(timeStr) {
  const h = parseHour(timeStr);
  if (h < 6) return "midnight";
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  if (h < 21) return "evening";
  return "night";
}

/**
 * Convert habit time to sortable minutes
 */
export function habitSortMinutes(habit) {
  if (!habit.time) return 25 * 60;
  const h = parseHour(habit.time);
  return Math.round(h * 60);
}

/**
 * Sort habits by time
 */
export const byHabitTime = (a, b) => habitSortMinutes(a) - habitSortMinutes(b);
