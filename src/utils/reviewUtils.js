import {
  REVIEW_WINDOW,
  REVIEW_MIN_DUE,
  REVIEW_MAX_RATE,
  REVIEW_FOLLOWUP,
  DAY_LABELS,
  DIAGNOSES
} from "../constants/habits.js";
import { addDaysKey, daysBetweenKeys } from "./dateUtils.js";
import { isScheduledOn } from "./scheduleUtils.js";

/**
 * Get review log for a habit
 */
export const reviewLog = (habit) => Array.isArray(habit.reviews) ? habit.reviews : [];

/**
 * Count failed fix attempts
 */
export const failedFixCount = (habit) =>
  reviewLog(habit).filter(r => r.field && r.worked === false).length;

/**
 * Check for pending follow-up review
 */
export function pendingFollowUp(habit, todayKey) {
  const last = reviewLog(habit).filter(r => r.field && r.worked == null).pop();
  if (!last) return null;
  return daysBetweenKeys(last.at, todayKey) >= REVIEW_FOLLOWUP ? last : null;
}

/**
 * Analyze habit performance over review window
 */
export function habitReviewStats(habit, allData, todayKey, window = REVIEW_WINDOW) {
  const days = [];
  
  for (let i = window; i >= 1; i--) {
    const key = addDaysKey(todayKey, -i);
    if (!isScheduledOn(habit.frequency, key)) continue;
    
    const [y, mo, d] = key.split("-").map(Number);
    const jsDay = new Date(y, mo - 1, d).getDay();
    days.push({
      key,
      dow: jsDay === 0 ? 6 : jsDay - 1,
      kept: (allData[key] || {})[habit.id] === true
    });
  }
  
  const due = days.length;
  const kept = days.filter(d => d.kept).length;
  
  return {
    days,
    due,
    kept,
    rate: due ? kept / due : 1
  };
}

/**
 * Identify patterns in missed days
 */
export function missPattern(stats) {
  const { days } = stats;
  if (days.length < REVIEW_MIN_DUE) return null;
  
  const keptDows = [...new Set(days.filter(d => d.kept).map(d => d.dow))].sort((a, b) => a - b);
  const missDows = [...new Set(days.filter(d => !d.kept).map(d => d.dow))].sort((a, b) => a - b);
  
  if (!keptDows.length || !missDows.length) return null;
  
  const cleanKept = keptDows.filter(d => !missDows.includes(d));
  if (!cleanKept.length) return null;
  
  const isWeekend = d => d >= 5;
  const allKeptWeekend = cleanKept.every(isWeekend);
  const allMissWeekday = missDows.every(d => !isWeekend(d));
  
  if (allKeptWeekend && allMissWeekday) {
    return {
      kind: "schedule",
      days: cleanKept,
      text: "Missed every weekday, kept the weekend."
    };
  }
  
  const allKeptWeekday = cleanKept.every(d => !isWeekend(d));
  const allMissWeekend = missDows.every(isWeekend);
  
  if (allKeptWeekday && allMissWeekend) {
    return {
      kind: "schedule",
      days: cleanKept,
      text: "Kept it on weekdays, missed both weekend days."
    };
  }
  
  if (cleanKept.length <= 3) {
    return {
      kind: "schedule",
      days: cleanKept,
      text: `Only stuck on ${cleanKept.map(d => DAY_LABELS[d]).join(", ")}.`
    };
  }
  
  return null;
}

/**
 * Pick the worst-performing habit for review
 */
export function pickReviewTarget(identities, allData, todayKey) {
  let best = null;
  
  for (const identity of identities) {
    for (const habit of identity.habits) {
      if (habit.archived) continue;
      if (habit.reviewSnoozeUntil && habit.reviewSnoozeUntil > todayKey) continue;
      
      const stats = habitReviewStats(habit, allData, todayKey);
      if (stats.due < REVIEW_MIN_DUE) continue;
      
      const followUp = pendingFollowUp(habit, todayKey);
      if (followUp) {
        return {
          habit,
          identity,
          stats,
          pattern: missPattern(stats),
          followUp,
          mode: "followup"
        };
      }
      
      if (stats.rate > REVIEW_MAX_RATE) continue;
      
      if (!best || stats.rate < best.stats.rate) {
        best = {
          habit,
          identity,
          stats,
          pattern: missPattern(stats),
          followUp: null,
          mode: "review"
        };
      }
    }
  }
  
  return best;
}

/**
 * Get diagnosis by ID
 */
export const diagnosisById = (id) => DIAGNOSES.find(d => d.id === id);
