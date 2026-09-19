import { MILESTONES } from "../constants/habits.js";

/**
 * Get the highest milestone earned for a streak
 */
export function getMilestone(streak) {
  let best = null;
  for (const m of MILESTONES) {
    if (streak >= m.days) best = m;
  }
  return best;
}

/**
 * Get the next milestone to reach
 */
export function getNextMilestone(streak) {
  return MILESTONES.find(m => m.days > streak) || null;
}
