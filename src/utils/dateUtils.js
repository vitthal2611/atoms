// Date utility functions

/**
 * Convert a Date object to local calendar date key (YYYY-MM-DD)
 */
export function dateToKey(d) {
  return d.getFullYear() + "-" +
    String(d.getMonth() + 1).padStart(2, "0") + "-" +
    String(d.getDate()).padStart(2, "0");
}

/**
 * Get today's date key in local timezone
 */
export function getTodayKey() {
  return dateToKey(new Date());
}

/**
 * Add days to a date key and return new date key
 */
export function addDaysKey(dateKey, n) {
  const [y, mo, d] = dateKey.split("-").map(Number);
  const dt = new Date(y, mo - 1, d);
  dt.setDate(dt.getDate() + n);
  return dateToKey(dt);
}

/**
 * Calculate days between two date keys
 */
export function daysBetweenKeys(a, b) {
  const [y1, m1, d1] = a.split("-").map(Number);
  const [y2, m2, d2] = b.split("-").map(Number);
  return Math.round((new Date(y2, m2 - 1, d2) - new Date(y1, m1 - 1, d1)) / 86400000);
}

/**
 * Get Monday start of the week containing dateKey
 */
export function weekStartKey(dateKey) {
  const d = new Date(dateKey + "T00:00");
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return dateToKey(d);
}

/**
 * Get all 7 day keys (Mon-Sun) for a week starting from weekKey
 */
export function weekDaysFrom(weekKey) {
  const d = new Date(weekKey + "T00:00");
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(d);
    x.setDate(d.getDate() + i);
    return dateToKey(x);
  });
}

/**
 * Get week dates starting from Monday
 */
export function getWeekDates() {
  const today = new Date();
  const mon = new Date(today);
  mon.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    return dateToKey(d);
  });
}

/**
 * Format date key for navigation display
 */
export function formatNavDate(dateKey) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date();
  const todayKey = dateToKey(today);
  
  if (dateKey === todayKey) return "Today";
  
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (dateKey === dateToKey(yesterday)) return "Yesterday";
  
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (dateKey === dateToKey(tomorrow)) return "Tomorrow";
  
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[m - 1]} ${d}`;
}
