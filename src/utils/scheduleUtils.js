import { DEFAULT_FREQUENCY } from "../constants/habits.js";
import { DAY_LABELS } from "../constants/habits.js";
import { daysBetweenKeys, addDaysKey } from "./dateUtils.js";

/**
 * Check if a habit is scheduled on a given date
 */
export function isScheduledOn(frequency, dateKey) {
  const freq = frequency || DEFAULT_FREQUENCY;
  const [y, mo, d] = dateKey.split("-").map(Number);
  const date = new Date(y, mo - 1, d);
  
  if (freq.cadence === "monthly") {
    const dates = freq.dates || [1];
    const lastDay = new Date(y, mo, 0).getDate();
    return dates.some(dt => dt === 32 ? d === lastDay : dt === d);
  }
  
  const jsDay = date.getDay();
  const ourDay = jsDay === 0 ? 6 : jsDay - 1; // Convert to Monday-first
  return (freq.days || [0, 1, 2, 3, 4, 5, 6]).includes(ourDay);
}

/**
 * Get human-readable label for frequency
 */
export function getFreqLabel(frequency) {
  const freq = frequency || DEFAULT_FREQUENCY;
  
  if (freq.cadence === "monthly") {
    const dates = (freq.dates || []).sort((a, b) => a - b);
    if (!dates.length) return "Monthly";
    
    const ordinal = n => {
      const s = ["th", "st", "nd", "rd"];
      const v = n % 100;
      return n + (s[(v - 20) % 10] || s[v] || s[0]);
    };
    
    return dates.map(d => d === 32 ? "Last day" : ordinal(d)).join(", ") + " of month";
  }
  
  const days = freq.days || [0, 1, 2, 3, 4, 5, 6];
  
  if (days.length === 7) return "Every day";
  if (days.length === 5 && [0, 1, 2, 3, 4].every(d => days.includes(d))) return "Mon – Fri";
  if (days.length === 2 && [5, 6].every(d => days.includes(d))) return "Sat & Sun";
  
  return [...days].sort((a, b) => a - b).map(d => DAY_LABELS[d]).join(" · ");
}

/**
 * Get color styling for frequency badge
 */
export function getFreqColor(frequency) {
  const freq = frequency || DEFAULT_FREQUENCY;
  
  if (freq.cadence === "monthly") {
    return { bg: "#EDE9FE", color: "#5B21B6" };
  }
  
  const days = freq.days || [0, 1, 2, 3, 4, 5, 6];
  
  if (days.length === 7) {
    return { bg: "#0284C718", color: "#0284C7" };
  }
  if (days.length === 5 && [0, 1, 2, 3, 4].every(d => days.includes(d))) {
    return { bg: "#E0F2FE", color: "#0369A1" };
  }
  if (days.length === 2 && [5, 6].every(d => days.includes(d))) {
    return { bg: "#FEF3C7", color: "#92400E" };
  }
  
  return { bg: "#FEF3C7", color: "#92400E" };
}

/**
 * Count how many days a habit was scheduled between start and end
 */
export function scheduledDaysSince(frequency, startKey, endKey) {
  if (!startKey || startKey > endKey) return 0;
  
  const span = daysBetweenKeys(startKey, endKey);
  let n = 0;
  
  for (let i = 0; i <= span && i <= 400; i++) {
    if (isScheduledOn(frequency, addDaysKey(startKey, i))) n++;
  }
  
  return n;
}
