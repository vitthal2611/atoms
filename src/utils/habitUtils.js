import { CUE_EMOJI } from "../constants/habits.js";
import { dateToKey } from "./dateUtils.js";

/**
 * Get contextual emoji for a habit's cue/action
 */
export function cueEmoji(text) {
  const s = (text || "").toLowerCase();
  for (const [re, emoji] of CUE_EMOJI) {
    if (re.test(s)) return emoji;
  }
  return "";
}

/**
 * Generate cohort key from identity label
 */
export function cohortKey(identityLabel) {
  return (identityLabel || "")
    .toLowerCase()
    .replace(/^i am (a |an |the )?/, "")
    .replace(/^(a |an |the )/, "")
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "unnamed";
}

/**
 * Resolve cue text to anchor habit ID for habit stacking
 */
export function anchorHabitId(trigger, identities, selfId) {
  const t = (trigger || "").toLowerCase();
  if (!t) return "";
  
  for (const idn of identities) {
    for (const h of idn.habits || []) {
      if (h.id === selfId) continue;
      const lbl = (h.label || "").trim().toLowerCase();
      if (lbl.length >= 3 && t.includes(lbl)) return h.id;
    }
  }
  
  return "";
}

/**
 * Generate mailto link for accountability partner
 */
export function partnerMailto(habit, kind, info = {}) {
  const to = habit.partnerEmail || "";
  const name = (habit.partnerName || "").trim();
  const hi = name ? `Hi ${name},` : "Hi,";
  const sig = "\n\n— shared from my Atomic Habits tracker";
  
  let subject, body;
  
  if (kind === "miss") {
    subject = `Accountability: I missed "${habit.label}"`;
    body = `${hi}\n\nI committed to "${habit.label}" and I missed it today.${
      habit.stakes ? `\nMy stake for skipping: ${habit.stakes}.` : ""
    }\n\nHold me to it — I'm back on it tomorrow (never miss twice).${sig}`;
  } else {
    subject = `Progress on "${habit.label}"`;
    body = `${hi}\n\nQuick update on "${habit.label}"${
      info.streak ? ` — ${info.streak}-day streak` : ""
    }${info.votes ? `, ${info.votes} check-ins so far` : ""}.\n\nThanks for keeping me accountable.${sig}`;
  }
  
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/**
 * Get the date when a habit started counting
 */
export function habitStartKey(habit, allData) {
  if (habit && habit.createdAt) return habit.createdAt;
  if (!habit || !allData) return null;
  
  let earliest = null;
  for (const k in allData) {
    const day = allData[k];
    if (day && day[habit.id] !== undefined && (earliest === null || k < earliest)) {
      earliest = k;
    }
  }
  
  return earliest;
}
