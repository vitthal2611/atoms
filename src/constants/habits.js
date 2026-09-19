// Identity colors and labels
export const IDENTITY_COLORS = [
  "#00C48C", "#4E7AFF", "#FF6B35", "#FFB300",
  "#8B5CF6", "#FF3D8B", "#00BBDD", "#FF7043"
];

export const IDENTITY_DIMS = [
  "#00291E", "#0A1A4A", "#3D1800", "#3D2900",
  "#1A0047", "#3D0024", "#003040", "#3D1800"
];

export const COLOR_NAMES = [
  "Teal", "Blue", "Orange", "Amber",
  "Purple", "Pink", "Cyan", "Red-Orange"
];

export const ICONS = [
  "🏃", "📚", "👨‍👧", "❤️", "💰", "🧘",
  "🎯", "💪", "🌱", "🎨", "🏋️", "✍️",
  "🧠", "🌟", "🍎", "🎵"
];

// Milestone definitions
export const MILESTONES = [
  { days: 3,   label: "3-Day Spark",    emoji: "✨" },
  { days: 7,   label: "1-Week Warrior", emoji: "⚡" },
  { days: 14,  label: "2-Week Forge",   emoji: "🔨" },
  { days: 21,  label: "21-Day Habit",   emoji: "🧠" },
  { days: 30,  label: "Month Master",   emoji: "🏆" },
  { days: 66,  label: "Automatic",      emoji: "🚀" },
  { days: 100, label: "Century",        emoji: "💎" },
];

// Cue emoji mapping
export const CUE_EMOJI = [
  [/brush|teeth|floss|dental/, "🪥"],
  [/coffee/, "☕"],
  [/\btea\b/, "🍵"],
  [/dinner|lunch|breakfast|\bmeal|\beat|food|hungry|nutrition/, "🍽️"],
  [/medic|syrup|pill|tablet|\bdrop|nasal|nosal|dose/, "💊"],
  [/\bbed\b|sleep|goodnight|\bnight\b/, "🛏️"],
  [/alarm|\bclock|wake|\bam\b|\bpm\b/, "⏰"],
  [/\bcab\b|\bcar\b|driv|commut|taxi|travel/, "🚗"],
  [/\bcall|phone|whatsapp/, "📞"],
  [/walk|stroll|steps/, "🚶"],
  [/meditat|mindful|breath/, "🧘"],
  [/office|\bwork|desk|logout|login|meeting|promotion|task/, "💼"],
  [/\bhome\b|return|arrive/, "🏠"],
  [/shower|bath/, "🚿"],
  [/\bwater\b|hydrat/, "💧"],
  [/gym|workout|exercise|lift/, "🏋️"],
  [/\bread\b|book|study|learn/, "📖"],
  [/pray|spiritual|worship|temple|god/, "🙏"],
  [/kid|child|daughter|\bson\b|yashashri|story/, "🧒"],
  [/wife|husband|partner|spouse/, "💑"],
  [/laptop|code|coding|comput|side income|income/, "💻"],
  [/money|expense|budget|finance|payment/, "💰"],
];

// Available cue icons for picker
export const CUE_ICONS = [
  "🪥","🦷","☕","🍵","🍽️","🍔","🥤","💊","🛏️","⏰","🌅","🌙",
  "🚗","🚶","🏃","📞","💻","💼","🏠","🚿","💧","🧘","🙏",
  "🏋️","📖","✍️","🎨","🎵","🎧","🧒","💑","💰","🧹","🐕",
  "🎯","🔔","⚡","🚭","📵","🌿",
];

// Day labels
export const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Default frequency
export const DEFAULT_FREQUENCY = {
  cadence: "weekly",
  days: [0, 1, 2, 3, 4, 5, 6]
};

// Habit review constants
export const REVIEW_WINDOW = 14;
export const REVIEW_MIN_DUE = 4;
export const REVIEW_MAX_RATE = 0.5;
export const REVIEW_SNOOZE = 14;
export const REVIEW_FOLLOWUP = 14;
export const REVIEW_STUCK_AT = 2;

// Diagnoses for habit review
export const DIAGNOSES = [
  {
    id: "forgot",
    field: "trigger",
    law: "Law 1 · Obvious",
    icon: "bulb",
    text: "I forgot it existed",
    fieldLabel: "Cue",
    why: "A habit you forget doesn't need more willpower — it needs a louder cue.",
    fallback: () => "After I pour my morning coffee"
  },
  {
    id: "unwilling",
    field: "attractive",
    law: "Law 2 · Attractive",
    icon: "spark",
    text: "Remembered, didn't want to",
    fieldLabel: "Attractive",
    why: "Willpower loses to boredom. Tie it to something you already look forward to.",
    fallback: (h) => `Only listen to my favourite podcast while I ${h.label.split(/\s+/).slice(0, 3).join(" ").toLowerCase()}`
  },
  {
    id: "toobig",
    field: "starter",
    law: "Law 3 · Easy",
    icon: "mountain",
    text: "Too big, no time",
    fieldLabel: "2-minute starter",
    why: "A habit you skip is too big. Shrink it until it's hard to say no.",
    fallback: (h) => {
      const shrunk = h.label.replace(/\b(\d+)\s*(pages?|minutes?|mins?|reps?|km|miles?|chapters?)\b/i,
        (_, n, unit) => {
          const one = /^(pages?|chapters?|reps?)$/i.test(unit);
          const singular = one ? unit.replace(/s$/i, "") : unit;
          return `${one ? 1 : 2} ${singular}`;
        });
      return shrunk === h.label ? `Just start — two minutes of "${h.label}"` : shrunk;
    }
  },
  {
    id: "flat",
    field: "satisfying",
    law: "Law 4 · Satisfying",
    icon: "gift",
    text: "Did it, felt like nothing",
    fieldLabel: "Reward",
    why: "Behaviour that isn't rewarded doesn't repeat. Close the loop immediately.",
    fallback: () => "Tick it off on the wall calendar"
  },
  {
    id: "schedule",
    field: "frequency",
    law: "Scheduling",
    icon: "clock",
    text: "Wrong days or wrong time",
    fieldLabel: "Frequency",
    why: "The habit may be fine — the schedule isn't.",
    fallback: () => ""
  },
];

// Task priorities
export const PRIORITIES = {
  high: { rank: 1, label: "High", color: "#EF4444", bg: "#FEE2E2" },
  med:  { rank: 2, label: "Med",  color: "#F59E0B", bg: "#FEF3C7" },
  low:  { rank: 3, label: "Low",  color: "#10B981", bg: "#D1FAE5" },
};
