import { useState, useEffect, useCallback, useRef, useMemo, useId, memo, Fragment } from "react";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, initializeFirestore, doc, getDoc, setDoc } from "firebase/firestore";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut as fbSignOut } from "firebase/auth";
import { getMessaging, getToken, isSupported } from "firebase/messaging";

// ─── FIREBASE ────────────────────────────────────────────────────────────────
// Config is read from .env (VITE_ prefix exposes vars to the browser bundle).
// Copy .env.example → .env and fill in your values. Never commit .env.
const _fbConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};
const _hadApp = getApps().length > 0;   // true only on HMR re-runs, where Firestore is already started
const _fbApp  = _hadApp ? getApps()[0] : initializeApp(_fbConfig);
// ignoreUndefinedProperties: a single `undefined` field anywhere in the payload
// makes setDoc throw and silently fail the whole save — this drops them instead.
// initializeFirestore can only run once per app, so reuse the instance on HMR.
const _db     = _hadApp
  ? getFirestore(_fbApp)
  : initializeFirestore(_fbApp, { ignoreUndefinedProperties: true });
const _auth  = getAuth(_fbApp);

// Web-push VAPID public key (Firebase console → Cloud Messaging → Web Push certificates).
const _vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;

function identitiesRef(uid) { return doc(_db, "users", uid, "atomicHabits", "identities"); }
function checkInsRef(uid)    { return doc(_db, "users", uid, "atomicHabits", "checkIns"); }
function dailyTasksRef(uid)  { return doc(_db, "users", uid, "atomicHabits", "dailyTasks"); }
function habitNotesRef(uid)  { return doc(_db, "users", uid, "atomicHabits", "habitNotes"); }
function pushTokensRef(uid)  { return doc(_db, "pushTokens", uid); }

// Turn on per-habit reminders: ask permission, register the FCM service worker,
// fetch the device token, and store it (+ timezone) so the Cloud Function can push.
async function enableHabitReminders(uid) {
  if (!(await isSupported().catch(() => false))) throw new Error("unsupported");
  if (!_vapidKey) throw new Error("no-vapid");
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("denied");
  // Pass the Firebase config to the SW via query params (it can't read import.meta.env).
  const swUrl = "/firebase-messaging-sw.js?" + new URLSearchParams({
    apiKey: _fbConfig.apiKey, authDomain: _fbConfig.authDomain, projectId: _fbConfig.projectId,
    storageBucket: _fbConfig.storageBucket, messagingSenderId: _fbConfig.messagingSenderId, appId: _fbConfig.appId,
  }).toString();
  const reg = await navigator.serviceWorker.register(swUrl);
  const token = await getToken(getMessaging(_fbApp), { vapidKey: _vapidKey, serviceWorkerRegistration: reg });
  if (!token) throw new Error("no-token");
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  await setDoc(pushTokensRef(uid), { uid, token, timezone, updatedAt: Date.now() });
  return token;
}

// Detect missing env vars early — surfaces a helpful screen instead of cryptic Firebase errors
const _envMissing = Object.entries(_fbConfig).filter(([, v]) => !v).map(([k]) => k);

// ─── THEME PALETTE — Ocean Depth ─────────────────────────────────────────────
// Defined early so ALL helpers and components can reference T safely.
const T = {
  bg:      "#F0F9FF",
  surface: "#FFFFFF",
  surf2:   "#E0F2FE",
  border:  "#D6E9F2",   // softer hairline than the old cyan #BAE6FD
  border2: "#7DD3FC",
  text:    "#26333B",   // warm charcoal — calmer than the old ocean blue #0C4A6E
  text2:   "#4A6572",   // muted slate for secondary text
  muted:   "#7C8A94",   // neutral gray for tertiary/meta text
  accent:  "#0EA5E9",
  primary: "#0284C7",   // was called "green" — renamed for semantic clarity
  green:   "#0284C7",   // alias kept for any legacy references
  gold:    "#F59E0B",
  red:     "#EF4444",
};

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const IDENTITY_COLORS = ["#00C48C","#4E7AFF","#FF6B35","#FFB300","#8B5CF6","#FF3D8B","#00BBDD","#FF7043"];
const IDENTITY_DIMS   = ["#00291E","#0A1A4A","#3D1800","#3D2900","#1A0047","#3D0024","#003040","#3D1800"];
const COLOR_NAMES     = ["Teal","Blue","Orange","Amber","Purple","Pink","Cyan","Red-Orange"];
const ICONS = ["🏃","📚","👨‍👧","❤️","💰","🧘","🎯","💪","🌱","🎨","🏋️","✍️","🧠","🌟","🍎","🎵"];

const MILESTONES = [
  { days: 3,   label: "3-Day Spark",    emoji: "✨" },
  { days: 7,   label: "1-Week Warrior", emoji: "⚡" },
  { days: 14,  label: "2-Week Forge",   emoji: "🔨" },
  { days: 21,  label: "21-Day Habit",   emoji: "🧠" },
  { days: 30,  label: "Month Master",   emoji: "🏆" },
  { days: 66,  label: "Automatic",      emoji: "🚀" },
  { days: 100, label: "Century",        emoji: "💎" },
];

function getMilestone(s) { let b=null; for(const m of MILESTONES) if(s>=m.days) b=m; return b; }
function getNextMilestone(s) { return MILESTONES.find(m=>m.days>s)||null; }


function to24h(timeStr) {
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
  return `${String(h).padStart(2,"0")}:${m}`;
}

// Use local calendar date (not UTC) so the key matches what the user sees on their clock.
// toISOString() always returns UTC, which shifts the date backward in UTC+ timezones (e.g. IST).
function dateToKey(d) {
  return d.getFullYear() + "-" +
    String(d.getMonth() + 1).padStart(2, "0") + "-" +
    String(d.getDate()).padStart(2, "0");
}
function getTodayKey() { return dateToKey(new Date()); }
// Use crypto.randomUUID when available (more collision-safe than Math.random)
function uid() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2,10);
}

// Strip the "I am a / I am an / I am " prefix from identity labels for compact display
function shortLabel(label) {
  return label.replace(/^I am an? /i, "").replace(/^I am /i, "");
}

// Capitalize only the first letter for display — e.g. a trigger typed in
// lowercase renders as "After i finish my morning walk".
function capFirst(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

// ─── FREQUENCY HELPERS ────────────────────────────────────────────────────────
// shape: { cadence:"weekly"|"monthly", days:[0-6], dates:[1-31,32] }
// days: 0=Mon … 6=Sun  |  dates: 1-31 = day of month, 32 = last day of month
const DEFAULT_FREQUENCY = { cadence:"weekly", days:[0,1,2,3,4,5,6] };

function isScheduledOn(frequency, dateKey) {
  const freq = frequency || DEFAULT_FREQUENCY;
  const [y, mo, d] = dateKey.split("-").map(Number);
  const date = new Date(y, mo - 1, d);
  if (freq.cadence === "monthly") {
    const dates = freq.dates || [1];
    const lastDay = new Date(y, mo, 0).getDate();
    return dates.some(dt => dt === 32 ? d === lastDay : dt === d);
  }
  const jsDay = date.getDay();
  const ourDay = jsDay === 0 ? 6 : jsDay - 1;
  return (freq.days || [0,1,2,3,4,5,6]).includes(ourDay);
}

function getFreqLabel(frequency) {
  const freq = frequency || DEFAULT_FREQUENCY;
  if (freq.cadence === "monthly") {
    const dates = (freq.dates || []).sort((a,b)=>a-b);
    if (!dates.length) return "Monthly";
    const ordinal = n => { const s=["th","st","nd","rd"],v=n%100; return n+(s[(v-20)%10]||s[v]||s[0]); };
    return dates.map(d => d===32 ? "Last day" : ordinal(d)).join(", ") + " of month";
  }
  const days = freq.days || [0,1,2,3,4,5,6];
  if (days.length === 7) return "Every day";
  if (days.length === 5 && [0,1,2,3,4].every(d=>days.includes(d))) return "Mon – Fri";
  if (days.length === 2 && [5,6].every(d=>days.includes(d))) return "Sat & Sun";
  const labels = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  return [...days].sort((a,b)=>a-b).map(d=>labels[d]).join(" · ");
}

// A contextual emoji for a habit's cue/action (🪥 for "brush", ☕ for "coffee"…).
// Returns "" when nothing matches, so the card falls back to the generic bolt.
const CUE_EMOJI = [
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
function cueEmoji(text) {
  const s = (text || "").toLowerCase();
  for (const [re, emoji] of CUE_EMOJI) if (re.test(s)) return emoji;
  return "";
}
// Palette the user can pick from to override the auto-mapped cue icon.
// Covers every trigger in CUE_EMOJI plus common extras.
const CUE_ICONS = [
  "🪥","🦷","☕","🍵","🍽️","🍔","🥤","💊","🛏️","⏰","🌅","🌙",
  "🚗","🚶","🏃","📞","💻","💼","🏠","🚿","💧","🧘","🙏",
  "🏋️","📖","✍️","🎨","🎵","🎧","🧒","💑","💰","🧹","🐕",
  "🎯","🔔","⚡","🚭","📵","🌿",
];

function getFreqColor(frequency) {
  const freq = frequency || DEFAULT_FREQUENCY;
  if (freq.cadence === "monthly") return { bg:"#EDE9FE", color:"#5B21B6" };
  const days = freq.days || [0,1,2,3,4,5,6];
  if (days.length === 7) return { bg: T.primary + "18", color: T.primary };
  if (days.length === 5 && [0,1,2,3,4].every(d=>days.includes(d))) return { bg:"#E0F2FE", color:"#0369A1" };
  if (days.length === 2 && [5,6].every(d=>days.includes(d))) return { bg:"#FEF3C7", color:"#92400E" };
  return { bg:"#FEF3C7", color:"#92400E" };
}

function getWeekDates() {
  const today=new Date(), mon=new Date(today);
  mon.setDate(today.getDate()-((today.getDay()+6)%7));
  return Array.from({length:7},(_,i)=>{ const d=new Date(mon); d.setDate(mon.getDate()+i); return dateToKey(d); });
}
const DAY_LABELS=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

// ─── HABIT REVIEW — analytics ─────────────────────────────────────────────────
// A review is offered only when the data says a habit is genuinely struggling,
// never on a schedule. Reviewing a habit that's working is how you train someone
// to dismiss the prompt without reading it.
const REVIEW_WINDOW    = 14;   // days of history to walk back over
const REVIEW_MIN_DUE   = 4;    // need at least this many scheduled days to judge
const REVIEW_MAX_RATE  = 0.5;  // struggling if kept ≤ half its scheduled days
const REVIEW_SNOOZE    = 14;   // days of silence after "just an unusual week"
const REVIEW_FOLLOWUP  = 14;   // days before we check whether a fix worked
const REVIEW_STUCK_AT  = 2;    // failed fixes before offering to pause/archive

function addDaysKey(dateKey, n) {
  const [y, mo, d] = dateKey.split("-").map(Number);
  const dt = new Date(y, mo - 1, d);
  dt.setDate(dt.getDate() + n);
  return dateToKey(dt);
}
function daysBetweenKeys(a, b) {
  const [y1,m1,d1] = a.split("-").map(Number);
  const [y2,m2,d2] = b.split("-").map(Number);
  return Math.round((new Date(y2,m2-1,d2) - new Date(y1,m1-1,d1)) / 86400000);
}

// The day a habit began counting — so streaks, votes, history and completion %
// never penalise the days before it existed. Uses the stored createdAt when
// present; for older habits saved before we tracked it, infers the earliest
// day that has any entry for this habit. Returns null when there's nothing to
// gate against (no createdAt and no history).
function habitStartKey(habit, allData) {
  if (habit && habit.createdAt) return habit.createdAt;
  if (!habit || !allData) return null;
  let earliest = null;
  for (const k in allData) {
    const day = allData[k];
    if (day && day[habit.id] !== undefined && (earliest === null || k < earliest)) earliest = k;
  }
  return earliest;
}

// How many days the habit was actually due between its start and endKey
// (inclusive) — the denominator for "X of Y days" on the card.
function scheduledDaysSince(frequency, startKey, endKey) {
  if (!startKey || startKey > endKey) return 0;
  const span = daysBetweenKeys(startKey, endKey); // whole days, >= 0
  let n = 0;
  for (let i = 0; i <= span && i <= 400; i++) {
    if (isScheduledOn(frequency, addDaysKey(startKey, i))) n++;
  }
  return n;
}

// Walk back over the window and record every day this habit was actually due.
// `days` holds the most recent scheduled days, oldest first, each { key, dow, kept }.
function habitReviewStats(habit, allData, todayKey, window = REVIEW_WINDOW) {
  const days = [];
  for (let i = window; i >= 1; i--) {          // yesterday backwards; today is still in play
    const key = addDaysKey(todayKey, -i);
    if (!isScheduledOn(habit.frequency, key)) continue;
    const [y, mo, d] = key.split("-").map(Number);
    const jsDay = new Date(y, mo - 1, d).getDay();
    days.push({ key, dow: jsDay === 0 ? 6 : jsDay - 1, kept: (allData[key] || {})[habit.id] === true });
  }
  const due  = days.length;
  const kept = days.filter(d => d.kept).length;
  return { days, due, kept, rate: due ? kept / due : 1 };
}

// Which days actually worked? Used both to rank the diagnosis list and to build
// the "trim to the days you kept it" fix — the schedule change writes itself.
function missPattern(stats) {
  const { days } = stats;
  if (days.length < REVIEW_MIN_DUE) return null;
  const keptDows = [...new Set(days.filter(d => d.kept).map(d => d.dow))].sort((a,b)=>a-b);
  const missDows = [...new Set(days.filter(d => !d.kept).map(d => d.dow))].sort((a,b)=>a-b);
  if (!keptDows.length || !missDows.length) return null;
  // A day only counts as reliable if it was never missed, and vice versa
  const cleanKept = keptDows.filter(d => !missDows.includes(d));
  if (!cleanKept.length) return null;

  const isWeekend = d => d >= 5;
  const allKeptWeekend  = cleanKept.every(isWeekend);
  const allMissWeekday  = missDows.every(d => !isWeekend(d));
  if (allKeptWeekend && allMissWeekday)
    return { kind: "schedule", days: cleanKept, text: "Missed every weekday, kept the weekend." };

  const allKeptWeekday = cleanKept.every(d => !isWeekend(d));
  const allMissWeekend = missDows.every(isWeekend);
  if (allKeptWeekday && allMissWeekend)
    return { kind: "schedule", days: cleanKept, text: "Kept it on weekdays, missed both weekend days." };

  if (cleanKept.length <= 3)
    return { kind: "schedule", days: cleanKept,
             text: `Only stuck on ${cleanKept.map(d => DAY_LABELS[d]).join(", ")}.` };
  return null;
}

const reviewLog = (habit) => Array.isArray(habit.reviews) ? habit.reviews : [];

// Fixes that were applied and then didn't lift the habit out of trouble.
const failedFixCount = (habit) => reviewLog(habit).filter(r => r.field && r.worked === false).length;

// A review already applied, old enough to judge, and not yet reported on.
function pendingFollowUp(habit, todayKey) {
  const last = reviewLog(habit).filter(r => r.field && r.worked == null).pop();
  if (!last) return null;
  return daysBetweenKeys(last.at, todayKey) >= REVIEW_FOLLOWUP ? last : null;
}

// Pick at most ONE habit to talk about — the worst offender. A bad week can put
// several habits in trouble at once, and a stack of prompts reads as a pile-on.
function pickReviewTarget(identities, allData, todayKey) {
  let best = null;
  for (const identity of identities) {
    for (const habit of identity.habits) {
      if (habit.archived) continue;
      if (habit.reviewSnoozeUntil && habit.reviewSnoozeUntil > todayKey) continue;
      const stats = habitReviewStats(habit, allData, todayKey);
      if (stats.due < REVIEW_MIN_DUE) continue;

      const followUp = pendingFollowUp(habit, todayKey);
      if (followUp) {
        // Follow-ups jump the queue: they're usually good news, and they're
        // the only way a fix ever gets marked as having worked.
        return { habit, identity, stats, pattern: missPattern(stats), followUp, mode: "followup" };
      }
      if (stats.rate > REVIEW_MAX_RATE) continue;
      if (!best || stats.rate < best.stats.rate) {
        best = { habit, identity, stats, pattern: missPattern(stats), followUp: null, mode: "review" };
      }
    }
  }
  return best;
}

// ─── HABIT REVIEW — diagnoses ─────────────────────────────────────────────────
// One answer per Law, plus scheduling. Each maps to exactly one habit field, so
// the diagnosis decides what gets rewritten — no second question needed.
// `fallback(habit)` supplies a suggestion when the AI call can't be made.
const DIAGNOSES = [
  { id:"forgot", field:"trigger", law:"Law 1 · Obvious", icon:"bulb", text:"I forgot it existed",
    fieldLabel:"Cue",
    why:"A habit you forget doesn't need more willpower — it needs a louder cue.",
    fallback:() => "After I pour my morning coffee" },
  { id:"unwilling", field:"attractive", law:"Law 2 · Attractive", icon:"spark", text:"Remembered, didn't want to",
    fieldLabel:"Attractive",
    why:"Willpower loses to boredom. Tie it to something you already look forward to.",
    fallback:(h) => `Only listen to my favourite podcast while I ${firstWords(h.label)}` },
  { id:"toobig", field:"starter", law:"Law 3 · Easy", icon:"mountain", text:"Too big, no time",
    fieldLabel:"2-minute starter",
    why:"A habit you skip is too big. Shrink it until it's hard to say no.",
    fallback:(h) => shrinkLabel(h.label) },
  { id:"flat", field:"satisfying", law:"Law 4 · Satisfying", icon:"gift", text:"Did it, felt like nothing",
    fieldLabel:"Reward",
    why:"Behaviour that isn't rewarded doesn't repeat. Close the loop immediately.",
    fallback:() => "Tick it off on the wall calendar" },
  // Scheduling is the odd one out: it rewrites `frequency`, an object, so it
  // gets a one-tap confirm built from the observed pattern rather than a textarea.
  { id:"schedule", field:"frequency", law:"Scheduling", icon:"clock", text:"Wrong days or wrong time",
    fieldLabel:"Frequency",
    why:"The habit may be fine — the schedule isn't.",
    fallback:() => "" },
];
const diagnosisById = (id) => DIAGNOSES.find(d => d.id === id);

// "Read 10 pages" → "Read 1 page"; "Meditate 20 minutes" → "Meditate 2 minutes".
// Deliberately dumb — it only has to be sane when the AI is unavailable.
function shrinkLabel(label = "") {
  const shrunk = label.replace(/\b(\d+)\s*(pages?|minutes?|mins?|reps?|km|miles?|chapters?)\b/i,
    (_, n, unit) => {
      const one = /^(pages?|chapters?|reps?)$/i.test(unit);
      const singular = one ? unit.replace(/s$/i, "") : unit;
      return `${one ? 1 : 2} ${singular}`;
    });
  return shrunk === label ? `Just start — two minutes of "${label}"` : shrunk;
}
const firstWords = (s = "") => s.split(/\s+/).slice(0, 3).join(" ").toLowerCase();

// Ask the Gemini-backed callable for a tailored rewrite of one field. Resolves to
// { value, note } on success and null on any failure — the caller falls back to a
// static suggestion, because a struggling habit is the worst moment to dead-end.
async function fetchFieldSuggestion(habit, identityLabel, field) {
  try {
    const { getFunctions, httpsCallable } = await import("firebase/functions");
    const call = httpsCallable(getFunctions(), "askJamesClear", { timeout: 20000 });
    const res = await call({
      mode: "field",
      field,
      habit: {
        label: habit.label, identity: identityLabel,
        trigger: habit.trigger, attractive: habit.attractive, easy: habit.easy,
        starter: habit.starter, satisfying: habit.satisfying,
        time: habit.time, location: habit.location,
        frequency: getFreqLabel(habit.frequency),
      },
    });
    const value = String(res?.data?.suggestion?.value || "").trim();
    if (!value) return null;
    return { value, note: String(res?.data?.suggestion?.note || "").trim() };
  } catch {
    return null;   // offline, over quota, cold start — all handled the same way
  }
}

// ─── MODAL ────────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children, descriptionId }) {
  const titleId      = useId();
  const panelRef     = useRef(null);
  const prevFocusRef = useRef(null);

  useEffect(() => {
    // Remember what had focus so we can restore it on close
    prevFocusRef.current = document.activeElement;

    const el = panelRef.current;
    if (!el) return;

    // Focus first focusable element on mount
    const focusable = () => el.querySelectorAll('button,input,select,textarea,[tabindex]:not([tabindex="-1"])');
    const first = focusable()[0];
    if (first) first.focus();

    // Tab focus trap
    const trap = (e) => {
      if (e.key !== "Tab") return;
      const els = focusable();
      if (!els.length) return;
      const f = els[0], l = els[els.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === f) { e.preventDefault(); l.focus(); }
      } else {
        if (document.activeElement === l) { e.preventDefault(); f.focus(); }
      }
    };
    // Escape to close
    const esc = (e) => { if (e.key === "Escape") onClose(); };

    el.addEventListener("keydown", trap);
    document.addEventListener("keydown", esc);
    return () => {
      el.removeEventListener("keydown", trap);
      document.removeEventListener("keydown", esc);
      // Restore focus to the element that opened the modal
      prevFocusRef.current?.focus();
    };
  }, [onClose]);

  return (
    <div style={S.overlay} onClick={onClose} role="presentation">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        style={S.modal}
        className="sheet-in"
        onClick={e => e.stopPropagation()}
      >
        <div style={S.modalDrag} aria-hidden="true"/>
        <div style={S.modalHeader}>
          <span id={titleId} style={S.modalTitle}>{title}</span>
          <button onClick={onClose} style={S.modalClose} aria-label="Close dialog">
            <span aria-hidden="true">✕</span>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── FREQUENCY PICKER ─────────────────────────────────────────────────────────
function FrequencyPicker({ value, onChange }) {
  const freq     = value || DEFAULT_FREQUENCY;
  const cadence  = freq.cadence || "weekly";
  const selDays  = freq.days  || [0,1,2,3,4,5,6];
  const selDates = freq.dates || [];

  const DAY_FULL = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
  const DAY_PILLS = ["Mo","Tu","We","Th","Fr","Sa","Su"];

  const isAll      = selDays.length===7;
  const isWeekdays = selDays.length===5 && [0,1,2,3,4].every(d=>selDays.includes(d));
  const isWeekends = selDays.length===2 && [5,6].every(d=>selDays.includes(d));
  const isCustom   = !isAll && !isWeekdays && !isWeekends;

  const setCadence = (c) => {
    if (c === "weekly")  onChange({ cadence:"weekly",  days:[0,1,2,3,4,5,6] });
    if (c === "monthly") onChange({ cadence:"monthly", dates:[1] });
  };

  const applyShortcut = (type) => {
    if (type==="all")      onChange({ cadence:"weekly", days:[0,1,2,3,4,5,6] });
    if (type==="weekdays") onChange({ cadence:"weekly", days:[0,1,2,3,4] });
    if (type==="weekends") onChange({ cadence:"weekly", days:[5,6] });
  };

  const toggleDay = (i) => {
    const next = selDays.includes(i) ? selDays.filter(d=>d!==i) : [...selDays,i];
    if (next.length === 0) return; // keep at least 1
    onChange({ cadence:"weekly", days: next });
  };

  const toggleDate = (d) => {
    const next = selDates.includes(d) ? selDates.filter(x=>x!==d) : [...selDates,d];
    if (next.length === 0) return; // keep at least 1 date selected
    onChange({ cadence:"monthly", dates: next });
  };

  const segBtn = (label, active, onClick) => (
    <button onClick={onClick} style={{
      flex:1, padding:"7px 4px", fontSize:14, fontWeight:600, border:"none",
      borderRadius:8, cursor:"pointer", transition:"all 0.15s",
      background: active ? T.accent : "transparent",
      color: active ? "#fff" : T.muted,
    }} aria-pressed={active}>{label}</button>
  );

  const shortcut = (label, active, onClick) => (
    <button onClick={onClick} style={{
      padding:"5px 12px", borderRadius:20, fontSize:13, fontWeight:600,
      cursor:"pointer", border:`1.5px solid ${active ? T.accent : T.border}`,
      background: active ? T.accent : T.surface,
      color: active ? "#fff" : T.text2, transition:"all 0.15s",
      WebkitTapHighlightColor:"transparent",
    }} aria-pressed={active}>{label}</button>
  );

  return (
    <div>
      {/* Cadence toggle */}
      <div style={{ display:"flex", background:T.surf2, borderRadius:10, padding:3, gap:2, marginBottom:14 }}
           role="group" aria-label="Frequency cadence">
        {segBtn("Weekly",  cadence==="weekly",  ()=>setCadence("weekly"))}
        {segBtn("Monthly", cadence==="monthly", ()=>setCadence("monthly"))}
      </div>

      {cadence === "weekly" && (
        <>
          {/* Shortcut pills */}
          <div style={{ display:"flex", gap:6, marginBottom:10, flexWrap:"wrap" }} role="group" aria-label="Frequency shortcuts">
            {shortcut("Every day", isAll,      ()=>applyShortcut("all"))}
            {shortcut("Weekdays",  isWeekdays, ()=>applyShortcut("weekdays"))}
            {shortcut("Weekends",  isWeekends, ()=>applyShortcut("weekends"))}
            {isCustom && shortcut("Custom", true, ()=>{})}
          </div>
          {/* Day pills */}
          <div style={{ display:"flex", gap:6 }} role="group" aria-label="Select days">
            {DAY_PILLS.map((label, i) => {
              const on = selDays.includes(i);
              return (
                <button key={i} onClick={()=>toggleDay(i)}
                  aria-pressed={on}
                  aria-label={DAY_FULL[i]}
                  style={{
                    flex:1, aspectRatio:"1", borderRadius:"50%", border:`1.5px solid ${on ? T.accent : T.border}`,
                    background: on ? T.accent : T.surface, color: on ? "#fff" : T.muted,
                    fontSize:13, fontWeight:700, cursor:"pointer",
                    display:"flex", alignItems:"center", justifyContent:"center",
                    WebkitTapHighlightColor:"transparent", transition:"all 0.15s",
                  }}>{label}</button>
              );
            })}
          </div>
        </>
      )}

      {cadence === "monthly" && (
        <>
          <div style={{ fontSize:12, color:T.muted, marginBottom:8 }}>Select one or more dates</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:5 }}
               role="group" aria-label="Select dates of month">
            {Array.from({length:31},(_,i)=>i+1).map(d => {
              const on = selDates.includes(d);
              return (
                <button key={d} onClick={()=>toggleDate(d)}
                  aria-pressed={on}
                  aria-label={`Day ${d}`}
                  style={{
                    aspectRatio:"1", borderRadius:8,
                    border:`1.5px solid ${on ? T.accent : T.border}`,
                    background: on ? T.accent : T.surface,
                    color: on ? "#fff" : T.text2,
                    fontSize:12, fontWeight:600, cursor:"pointer",
                    display:"flex", alignItems:"center", justifyContent:"center",
                    WebkitTapHighlightColor:"transparent", transition:"all 0.15s",
                  }}>{d}</button>
              );
            })}
            {/* Last day of month */}
            {(() => {
              const on = selDates.includes(32);
              return (
                <button onClick={()=>toggleDate(32)}
                  aria-pressed={on}
                  aria-label="Last day of month"
                  style={{
                    gridColumn:"span 2", padding:"6px 4px", borderRadius:8,
                    border:`1.5px solid ${on ? T.accent : T.border}`,
                    background: on ? T.accent : T.surface,
                    color: on ? "#fff" : T.text2,
                    fontSize:12, fontWeight:600, cursor:"pointer",
                    WebkitTapHighlightColor:"transparent", transition:"all 0.15s",
                  }}>Last day</button>
              );
            })()}
          </div>
          <div style={{ fontSize:12, color:T.muted, marginTop:8, lineHeight:1.5 }}>
            Months with fewer days will run on the last available day.
          </div>
        </>
      )}
    </div>
  );
}

// ─── HABIT FORM ───────────────────────────────────────────────────────────────
function HabitForm({ initial={}, identities, onSave, onCancel, mode="add" }) {
  const [form, setForm] = useState({
    label:      initial.label      || "",
    trigger:    initial.trigger    || "",
    attractive: initial.attractive || "",
    easy:       initial.easy       || "",
    starter:    initial.starter    || "",
    satisfying: initial.satisfying || "",
    time:       initial.time       || "",
    location:   initial.location   || "",
    icon:       initial.icon       || "",
    identityId: initial.identityId || identities[0]?.id || "",
    frequency:  initial.frequency  || DEFAULT_FREQUENCY,
    kind:       initial.kind       || "good",
  });
  const [submitted, setSubmitted] = useState(false);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const valid = form.label.trim().length > 0 && form.identityId;
  const breaking = form.kind === "bad";

  // Cue suggestions for the combobox — pick one or type a custom cue.
  const cueOptions = breaking
    ? ["When I get into bed", "When I feel bored", "When I reach for my phone", "When I sit on the couch", "When I feel stressed", "Late at night"]
    : [
        "After I wake up", "After I pour my morning coffee", "After I brush my teeth",
        "After breakfast", "After lunch", "After I get home from work", "After I sit at my desk", "Before bed",
        ...identities.flatMap(i => (i.habits || []).map(h => h.label)).filter(l => l && l !== initial.label).slice(0, 6).map(l => `After ${l}`),
      ];

  const fId = useId();
  const ids = {
    label:      fId + "-label",
    identityId: fId + "-identity",
    trigger:    fId + "-trigger",
    attractive: fId + "-attractive",
    easy:       fId + "-easy",
    starter:    fId + "-starter",
    satisfying: fId + "-satisfying",
    time:       fId + "-time",
    location:   fId + "-location",
  };

  // ── Draft with James Clear — fills only the EMPTY fields, never overwrites you ──
  const [aiLoading, setAiLoading] = useState(false);
  const [aiErr, setAiErr] = useState("");
  const [fieldLoading, setFieldLoading] = useState(""); // which single field is regenerating
  const parseTime = (s) => {
    const m = (s || "").trim().match(/^(\d{1,2})(?::(\d{2}))?\s*([ap]\.?m\.?)?$/i);
    if (!m) return "";
    let h = parseInt(m[1], 10); const min = m[2] || "00";
    const ap = (m[3] || "").toLowerCase().replace(/\./g, "");
    if (ap === "pm" && h < 12) h += 12;
    if (ap === "am" && h === 12) h = 0;
    if (h < 0 || h > 23 || +min > 59) return "";
    return String(h).padStart(2, "0") + ":" + min;
  };
  const draftWithJames = async () => {
    if (!form.label.trim()) { setSubmitted(true); return; }
    setAiLoading(true); setAiErr("");
    try {
      const { getFunctions, httpsCallable } = await import("firebase/functions");
      const call = httpsCallable(getFunctions(), "askJamesClear", { timeout: 20000 });
      const identityLabel = identities.find(i => i.id === form.identityId)?.label || "";
      const filled = ["trigger","attractive","easy","starter","satisfying"].some(k => form[k].trim());
      const res = await call({ mode: filled ? "review" : "create", habit: {
        label: form.label, identity: identityLabel, kind: form.kind,
        trigger: form.trigger, attractive: form.attractive, easy: form.easy,
        starter: form.starter, satisfying: form.satisfying,
        time: form.time, location: form.location, frequency: getFreqLabel(form.frequency),
      }});
      const s = res?.data?.suggestion;
      if (!s) { setAiErr("Couldn't draft that — please try again."); return; }
      const keep = (cur, next) => (cur && cur.trim() ? cur : (next || cur));
      setForm(f => ({ ...f,
        trigger:    keep(f.trigger,    s.trigger),
        attractive: keep(f.attractive, s.attractive),
        easy:       keep(f.easy,       s.easy),
        starter:    keep(f.starter,    s.starter),
        satisfying: keep(f.satisfying, s.satisfying),
        location:   keep(f.location,   s.location),
        time:       (f.time && f.time.trim()) ? f.time : (parseTime(s.time) || f.time),
      }));
    } catch { setAiErr("Couldn't reach the coach. Please try again."); }
    finally { setAiLoading(false); }
  };

  // ── Suggest a SINGLE field with James Clear (mode:"field") ──
  const regenField = async (field) => {
    // Every field needs a habit name first — except suggesting the name itself.
    if (field !== "label" && !form.label.trim()) { setSubmitted(true); return; }
    setFieldLoading(field); setAiErr("");
    try {
      const { getFunctions, httpsCallable } = await import("firebase/functions");
      const call = httpsCallable(getFunctions(), "askJamesClear", { timeout: 20000 });
      const identityLabel = identities.find(i => i.id === form.identityId)?.label || "";
      const res = await call({ mode: "field", field, habit: {
        label: form.label, identity: identityLabel, kind: form.kind,
        trigger: form.trigger, attractive: form.attractive, easy: form.easy,
        starter: form.starter, satisfying: form.satisfying,
        time: form.time, location: form.location, frequency: getFreqLabel(form.frequency),
      }});
      const s = res?.data?.suggestion;
      let val = s == null ? "" : (typeof s === "string" ? s : s.value);
      // Store a suggested habit name sentence-cased (the card lowercases it for display).
      if (field === "label" && val) val = val.charAt(0).toUpperCase() + val.slice(1);
      if (val) { if (field === "time") set("time", parseTime(val) || form.time); else set(field, val); }
      else setAiErr("Couldn't suggest that one — try again.");
    } catch { setAiErr("Couldn't reach the coach. Please try again."); }
    finally { setFieldLoading(""); }
  };
  // Compact per-field "suggest" icon button — sits beside a field's label.
  const suggestBtn = (field) => (
    <button type="button" onClick={() => regenField(field)} disabled={!!fieldLoading || aiLoading}
      aria-label="Suggest this field with James Clear" title="Suggest with James Clear"
      style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", width:22, height:22, flexShrink:0,
        color:T.primary, background:T.primary+"12", border:`1px solid ${T.primary}44`, borderRadius:6, padding:0,
        cursor:(fieldLoading||aiLoading)?"default":"pointer", opacity:(fieldLoading && fieldLoading!==field)?0.4:1,
        WebkitTapHighlightColor:"transparent" }}>
      {fieldLoading===field ? <span style={{ fontSize:11, fontWeight:800 }}>…</span> : <Ic name="spark" size={12} color={T.primary} />}
    </button>
  );

  const lawHead = { display:"flex", alignItems:"center", gap:7, marginTop:22 };
  const lawNum  = (c) => ({ width:19, height:19, borderRadius:"50%", background:c, color:"#fff", fontSize:12, fontWeight:800, display:"inline-flex", alignItems:"center", justifyContent:"center", flexShrink:0 });
  const lawTxt  = (c) => ({ fontSize:12, fontWeight:800, letterSpacing:"0.06em", textTransform:"uppercase", color:c });

  return (
    <div style={{ padding: "0 20px 20px" }}>
      {/* Build vs break — drives the Four Laws vs their inversion */}
      <label style={S.fieldLabel}>What do you want to do?</label>
      <div style={{ display:"flex", gap:8, marginBottom:6 }} role="group" aria-label="Habit type">
        {[["good","➕ Build a good habit", T.primary], ["bad","🚫 Break a bad habit", "#D4537E"]].map(([k,txt,c])=>(
          <button key={k} type="button" onClick={()=>set("kind",k)} aria-pressed={form.kind===k}
            style={{ flex:1, padding:"10px 8px", borderRadius:10, fontFamily:"inherit", fontSize:12.5, fontWeight:700, cursor:"pointer", WebkitTapHighlightColor:"transparent",
              border:`1.5px solid ${form.kind===k ? c : T.border}`, background: form.kind===k ? c+"12" : T.surface, color: form.kind===k ? c : T.text2 }}>
            {txt}
          </button>
        ))}
      </div>

      {/* Identity anchor — who you're becoming (foundation of every check) */}
      <label htmlFor={ids.identityId} style={{ ...S.fieldLabel, marginTop:16 }}>You're becoming</label>
      <select id={ids.identityId} style={S.input} value={form.identityId} onChange={e=>set("identityId",e.target.value)}>
        {identities.map(i=><option key={i.id} value={i.id}>{i.icon} {i.label}</option>)}
      </select>
      <div style={{ fontSize:11.5, color:T.muted, fontStyle:"italic", marginTop:6 }}>{breaking ? "Every clean day is a vote for this person." : "Every check is a vote for this person."}</div>

      {/* The habit + the minimum-effort lever */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8, marginTop:18 }}>
        <label htmlFor={ids.label} style={S.fieldLabel}>{breaking ? "The habit to break *" : "The habit *"}</label>
        {suggestBtn("label")}
      </div>
      <input id={ids.label} style={S.input} value={form.label} onChange={e=>set("label",e.target.value)} placeholder={breaking ? "e.g. Scroll my phone in bed" : "e.g. Meditate 10 minutes"} autoFocus maxLength={80} />
      <div style={{ fontSize:11, color:T.muted, marginTop:5 }}>Type a name, or tap <Ic name="spark" size={10} color={T.primary} /> to have James Clear suggest one from your identity.</div>

      {breaking ? (
        <div style={{ marginTop:10, background:"#FAECE7", border:"1px solid #F5C4B3", borderRadius:10, padding:"10px 12px" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6 }}>
            <label htmlFor={ids.starter} style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, fontWeight:800, color:"#712B13" }}>
              <Ic name="warn" size={13} color="#712B13" /> If tempted (make it hard)
            </label>
            {suggestBtn("starter")}
          </div>
          <input id={ids.starter} style={{ ...S.input, marginTop:0, background:"#fff" }} value={form.starter} onChange={e=>set("starter",e.target.value)} placeholder="e.g. Phone charges in the kitchen" maxLength={100} />
          <div style={{ fontSize:11.5, color:"#993C1D", fontStyle:"italic", marginTop:6, lineHeight:1.45 }}>Add friction so the bad habit is harder than resisting it.</div>
        </div>
      ) : (
        <div style={{ marginTop:10, background:"#E1F5EE", border:"1px solid #9FE1CB", borderRadius:10, padding:"10px 12px" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6 }}>
            <label htmlFor={ids.starter} style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, fontWeight:800, color:"#085041" }}>
              <Ic name="clock" size={13} color="#085041" /> Two-minute version
            </label>
            {suggestBtn("starter")}
          </div>
          <input id={ids.starter} style={{ ...S.input, marginTop:0, background:"#fff" }} value={form.starter} onChange={e=>set("starter",e.target.value)} placeholder="e.g. Meditate for one minute" maxLength={100} />
          <div style={{ fontSize:11.5, color:"#0F6E56", fontStyle:"italic", marginTop:6, lineHeight:1.45 }}>Your no-excuses minimum. On hard days, only this counts — and it still keeps the streak.</div>
        </div>
      )}

      {/* Draft with James Clear — fills the empty fields below */}
      <button type="button" onClick={draftWithJames} disabled={aiLoading}
        style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:7, width:"100%", marginTop:12, padding:"10px 14px", borderRadius:10, border:`1px solid ${T.primary}55`, background:T.primary+"0F", color:T.primary, fontFamily:"inherit", fontSize:13.5, fontWeight:800, cursor: aiLoading?"default":"pointer", opacity: aiLoading?0.7:1, WebkitTapHighlightColor:"transparent" }}>
        <Ic name="spark" size={15} color={T.primary} /> {aiLoading ? "Drafting…" : "Draft with James Clear"}
      </button>
      <div style={{ fontSize:11, color:T.muted, textAlign:"center", marginTop:5 }}>Fills the empty fields below — or tap <Ic name="spark" size={10} color={T.primary} /> on any field for a single suggestion.</div>
      {aiErr && <div role="alert" style={{ fontSize:12, color:T.red, textAlign:"center", marginTop:6 }}>{aiErr}</div>}

      {/* Law 1 · obvious (build) / invisible (break) */}
      <div style={lawHead}><span aria-hidden="true" style={lawNum(T.primary)}>1</span><span style={lawTxt(T.primary)}>{breaking ? "Make it invisible" : "Make it obvious"}</span></div>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8 }}>
        <label htmlFor={ids.trigger} style={S.fieldLabel}>{breaking ? "When are you tempted? (cue)" : "After what? (cue)"}</label>
        {suggestBtn("trigger")}
      </div>
      <input id={ids.trigger} list={ids.trigger + "-list"} style={S.input} value={form.trigger} onChange={e=>set("trigger",e.target.value)} placeholder={breaking ? "e.g. When I get into bed" : "e.g. After I pour my morning coffee"} maxLength={120} />
      <datalist id={ids.trigger + "-list"}>
        {cueOptions.map(o => <option key={o} value={o} />)}
      </datalist>
      <div style={{ fontSize:11, color:T.muted, marginTop:5 }}>Pick a suggestion or type your own.</div>

      {/* Cue icon — auto-picked from the trigger words; tap any to override */}
      <label style={S.fieldLabel}>Cue icon</label>
      <div style={{ display:"flex", flexWrap:"wrap", gap:7 }} role="group" aria-label="Choose the cue icon">
        <button type="button" onClick={()=>set("icon","")} aria-pressed={!form.icon}
          title="Match the icon to your cue words automatically"
          style={{ display:"inline-flex", alignItems:"center", gap:5, height:38, padding:"0 11px", borderRadius:10, cursor:"pointer",
            border:`2px solid ${!form.icon ? T.gold : T.border}`, background:!form.icon ? T.surf2 : "transparent",
            fontSize:13, fontWeight:800, color:T.text, WebkitTapHighlightColor:"transparent" }}>
          <span aria-hidden="true" style={{ fontSize:17 }}>{cueEmoji(form.trigger) || "⚡"}</span> Auto
        </button>
        {CUE_ICONS.map(ic=>(
          <button key={ic} type="button" onClick={()=>set("icon",ic)} aria-pressed={form.icon===ic} aria-label={`${ic} cue icon`}
            style={{ width:38, height:38, borderRadius:10, cursor:"pointer", fontSize:19,
              display:"flex", alignItems:"center", justifyContent:"center", WebkitTapHighlightColor:"transparent",
              border:`2px solid ${form.icon===ic ? T.gold : T.border}`, background:form.icon===ic ? T.surf2 : "transparent" }}>
            <span aria-hidden="true">{ic}</span>
          </button>
        ))}
      </div>
      <div style={{ fontSize:11, color:T.muted, marginTop:5 }}>{form.icon ? "Custom icon set." : "Auto-matched from your cue — tap an icon to override."}</div>

      <div style={{ display:"flex", gap:10, marginTop:10 }}>
        <div style={{ flex:1, minWidth:0 }}>
          <label htmlFor={ids.time} style={S.fieldLabel}>Time</label>
          <input id={ids.time} style={S.input} type="time" value={form.time} onChange={e=>set("time",e.target.value)} />
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <label htmlFor={ids.location} style={S.fieldLabel}>Where</label>
          <input id={ids.location} style={S.input} value={form.location} onChange={e=>set("location",e.target.value)} placeholder="e.g. Kitchen" maxLength={50} />
        </div>
      </div>
      <label style={S.fieldLabel}>Frequency</label>
      <FrequencyPicker value={form.frequency} onChange={v=>set("frequency",v)} />

      {/* Laws 2 & 3 — accelerants, compact two-up */}
      <div style={{ display:"flex", gap:10, marginTop:22 }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:7 }}><span aria-hidden="true" style={lawNum("#534AB7")}>2</span><span style={{ fontSize:11.5, fontWeight:800, color:"#534AB7" }}>{breaking ? "Unattractive" : "Attractive"}</span><span style={{ marginLeft:"auto" }}>{suggestBtn("attractive")}</span></div>
          <input id={ids.attractive} aria-label={breaking ? "Make it unattractive — highlight the cost" : "Make it attractive — pair it with something you enjoy"} style={{ ...S.input, marginTop:0 }} value={form.attractive} onChange={e=>set("attractive",e.target.value)} placeholder={breaking ? "The real cost…" : "Pair with…"} maxLength={140} />
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:7 }}><span aria-hidden="true" style={lawNum("#0F6E56")}>3</span><span style={{ fontSize:11.5, fontWeight:800, color:"#0F6E56" }}>{breaking ? "Difficult" : "Easy"}</span><span style={{ marginLeft:"auto" }}>{suggestBtn("easy")}</span></div>
          <input id={ids.easy} aria-label={breaking ? "Make it difficult — add friction" : "Make it easy — set up the environment"} style={{ ...S.input, marginTop:0 }} value={form.easy} onChange={e=>set("easy",e.target.value)} placeholder={breaking ? "Add friction" : "Set up the space"} maxLength={140} />
        </div>
      </div>

      {/* Law 4 · satisfying (build) / unsatisfying — accountability (break) */}
      <div style={lawHead}><span aria-hidden="true" style={lawNum("#854F0B")}>4</span><span style={lawTxt("#854F0B")}>{breaking ? "Make it unsatisfying" : "Make it satisfying"}</span><span style={{ marginLeft:"auto" }}>{suggestBtn("satisfying")}</span></div>
      <input id={ids.satisfying} aria-label={breaking ? "Accountability or a cost for slipping" : "Immediate reward after the habit"} style={{ ...S.input, marginTop:10 }} value={form.satisfying} onChange={e=>set("satisfying",e.target.value)} placeholder={breaking ? "A cost for slipping… e.g. tell a friend" : "Reward right after… e.g. a square of chocolate"} maxLength={140} />
      <div style={{ display:"flex", alignItems:"center", gap:9, marginTop:10, background:T.bg, borderRadius:10, padding:"9px 11px" }}>
        <Ic name="check" size={15} color="#0F6E56" />
        <span style={{ flex:1, fontSize:12, color:T.text2, lineHeight:1.4 }}><span style={{ fontWeight:800, color:T.text }}>Never miss twice</span> — {breaking ? "one slip is a mistake; two starts the habit again." : "miss once and we nudge you the next day."}</span>
      </div>

      <div style={{ display:"flex", gap:8, marginTop:22 }}>
        <button type="button" style={S.btnSecondary} onClick={onCancel}>Cancel</button>
        <button type="button" style={{ ...S.btnPrimary, opacity: valid?1:0.4 }}
          onClick={() => { setSubmitted(true); if (valid) onSave(form); }}
          aria-disabled={!valid}>
          {mode==="add" ? "Create habit" : "Save changes"}
        </button>
      </div>
      {submitted && !valid && (
        <div role="alert" style={{ fontSize:13, color:T.red, marginTop:8, textAlign:"center" }}>
          {!form.label.trim() ? "Habit name is required" : "Select an identity to continue"}
        </div>
      )}
    </div>
  );
}

// ─── IDENTITY FORM ────────────────────────────────────────────────────────────
function IdentityForm({ initial={}, onSave, onCancel, mode="add" }) {
  const [form, setForm] = useState({
    label:    initial.label    || "",
    icon:     initial.icon     || "🎯",
    colorIdx: initial.colorIdx ?? 0,
  });
  const [submitted, setSubmitted] = useState(false);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const valid = form.label.trim().length > 0;
  const labelId = useId() + "-identity-label";

  return (
    <div style={{ padding:"0 20px 20px" }}>
      <label htmlFor={labelId} style={S.fieldLabel}>Identity Statement *</label>
      <input id={labelId} style={S.input} value={form.label} onChange={e=>set("label",e.target.value)} placeholder="e.g. I am a Creative Person" autoFocus maxLength={60} />

      <label style={S.fieldLabel}>Icon</label>
      <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:16 }} role="group" aria-label="Choose icon">
        {ICONS.map(ic=>(
          <button key={ic} onClick={()=>set("icon",ic)}
            aria-label={`${ic} icon${form.icon===ic ? " (selected)" : ""}`} aria-pressed={form.icon===ic}
            style={{ ...S.iconBtn, background: form.icon===ic ? T.surf2 : "transparent", borderColor: form.icon===ic ? T.gold : T.border }}>
            <span aria-hidden="true">{ic}</span>
          </button>
        ))}
      </div>

      <label style={S.fieldLabel}>Color</label>
      <div style={{ display:"flex", flexWrap:"wrap", gap:10, marginBottom:24 }} role="group" aria-label="Choose color">
        {IDENTITY_COLORS.map((c,i)=>(
          <button key={c} onClick={()=>set("colorIdx",i)}
            aria-label={`${COLOR_NAMES[i]} color${form.colorIdx===i ? " (selected)" : ""}`} aria-pressed={form.colorIdx===i}
            style={{ width:36, height:36, borderRadius:"50%", background:c, border: form.colorIdx===i ? "3px solid " + T.text : "3px solid transparent", cursor:"pointer" }} />
        ))}
      </div>

      <div style={{ display:"flex", gap:10 }}>
        <button type="button" style={S.btnSecondary} onClick={onCancel}>Cancel</button>
        <button type="button" style={{ ...S.btnPrimary, opacity:valid?1:0.4 }}
          onClick={() => { setSubmitted(true); if (valid) onSave(form); }}
          aria-disabled={!valid}>
          {mode==="add" ? "Add Identity" : "Save Changes"}
        </button>
      </div>
      {submitted && !valid && (
        <div role="alert" style={{ fontSize:13, color:T.red, marginTop:8, textAlign:"center" }}>
          Identity statement is required
        </div>
      )}
    </div>
  );
}

// ─── CONFIRM DIALOG ───────────────────────────────────────────────────────────
function Confirm({ message, onConfirm, onCancel }) {
  const msgId = useId();
  return (
    <Modal title="Confirm Delete" onClose={onCancel} descriptionId={msgId}>
      <div style={{ padding:"0 20px 20px" }}>
        <p id={msgId} style={{ color:T.text2, fontSize:16, lineHeight:1.7, marginTop:8 }}>{message}</p>
        <div style={{ display:"flex", gap:10, marginTop:20 }}>
          <button style={S.btnSecondary} onClick={onCancel}>Cancel</button>
          <button style={{ ...S.btnPrimary, background: T.red }} onClick={onConfirm}>Delete</button>
        </div>
      </div>
    </Modal>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [user,         setUser]        = useState(undefined); // undefined = loading
  const [dataLoading,  setDataLoading] = useState(false);   // true while Firestore fetch is in-flight
  const [identities,   setIdentities]  = useState([]);
  const [data,         setData]        = useState({});
  const [view,         setView]        = useState("today");
  const [selectedDate, setSelectedDate] = useState(getTodayKey());
  const [justChecked,  setJustChecked]  = useState(null);
  const [syncing,      setSyncing]     = useState(false);
  const [saveError,    setSaveError]   = useState(false);
  const [signInError,  setSignInError] = useState(null);
  const [signingIn,    setSigningIn]   = useState(false);
  const [isOffline,    setIsOffline]   = useState(() => !navigator.onLine);

  // Views share one scroll container, so without this a tab switch lands mid-page.
  // Depending on content height the scroller is either <main> or the window itself.
  const scrollRef = useRef(null);
  useEffect(() => { scrollRef.current?.scrollTo(0, 0); window.scrollTo(0, 0); }, [view]);
  const [undoDelete,   setUndoDelete]  = useState(null);
  const [dailyTasks,   setDailyTasks]  = useState({});       // { [dateKey]: [{id, text, done}] }
  const [habitNotes,   setHabitNotes]  = useState({});       // { [dateKey]: { [habitId]: "note" } } — daily reflection per habit

  // Modal states
  const [modal,    setModal]    = useState(null);
  const [modalCtx, setModalCtx] = useState(null);

  const [todayKey, setTodayKey] = useState(getTodayKey);
  const todayData    = data[todayKey]    || {};
  const selectedData = data[selectedDate] || {};
  // Archived habits stay in storage (history and streaks survive) but drop out
  // of every tracking surface. Raw `identities` is kept for CRUD by id.
  const liveIdentities = useMemo(
    () => identities.map(i => ({ ...i, habits: i.habits.filter(h => !h.archived) })),
    [identities]
  );
  const allHabits    = useMemo(() => liveIdentities.flatMap(i => i.habits), [liveIdentities]);

  // At most one habit is ever up for review — see pickReviewTarget.
  const reviewTarget = useMemo(
    () => pickReviewTarget(liveIdentities, data, todayKey),
    [liveIdentities, data, todayKey]
  );
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewDismissed, setReviewDismissed] = useState(null); // habit id, this session only
  const [manualReview, setManualReview] = useState(null);       // review opened from a habit's ⋯ menu
  const openReviewFor = useCallback((habit, identity) => {
    const stats = habitReviewStats(habit, data, todayKey);
    setManualReview({ habit, identity, stats, pattern: missPattern(stats), followUp: null, mode: "review" });
    setReviewOpen(true);
  }, [data, todayKey]);

  // ── Habit reminders (web push) ──
  const [notifStatus, setNotifStatus] = useState(() => (typeof Notification !== "undefined" ? Notification.permission : "unsupported"));
  const [notifBusy, setNotifBusy] = useState(false);
  const handleEnableReminders = useCallback(async () => {
    if (!user) return;
    setNotifBusy(true);
    try {
      await enableHabitReminders(user.uid);
      setNotifStatus("granted");
    } catch (e) {
      const msg = e.message === "unsupported" ? "Reminders aren't supported in this browser."
        : e.message === "no-vapid"    ? "Reminders aren't set up yet — the notification key is missing."
        : e.message === "denied"      ? "Notifications are blocked. Enable them for this site in your browser settings."
        : "Couldn't turn on reminders. Please try again.";
      setNotifStatus(typeof Notification !== "undefined" ? Notification.permission : "unsupported");
      alert(msg);
    } finally { setNotifBusy(false); }
  }, [user]);

  // ── Scores — must be before early returns (Rules of Hooks) ──
  const scheduledToday = useMemo(
    () => allHabits.filter(h => {
      if (!isScheduledOn(h.frequency, selectedDate)) return false;
      const sKey = habitStartKey(h, data);          // exclude days before the habit existed
      return !sKey || selectedDate >= sKey;
    }),
    [allHabits, selectedDate, data]
  );
  const { totalDone, totalTotal, pct } = useMemo(() => {
    const done  = scheduledToday.filter(h => selectedData[h.id] === true).length;
    const total = scheduledToday.length;
    return { totalDone: done, totalTotal: total, pct: total > 0 ? Math.round((done/total)*100) : 0 };
  }, [scheduledToday, selectedData]);

  // ── Debounced Firestore saves ──
  const idTimer   = useRef(null);
  const ciTimer   = useRef(null);
  const isFirstId = useRef(true);
  const isFirstCi = useRef(true);
  // Dirty flags: a debounced save is pending. Used to flush immediately when the
  // tab hides / the page unloads, so a quick refresh never loses a recent change.
  const idDirty   = useRef(false);
  const ciDirty   = useRef(false);
  const dtDirty   = useRef(false);
  const hnDirty   = useRef(false);
  const latestRef = useRef({});   // most recent state, for the unload-flush closure

  // ── Streak cache — avoids 400-iteration loop per habit on every render ──
  const streakCacheRef      = useRef({});
  const streakDataRef       = useRef(null);   // tracks the data ref the cache was built against
  // ── Timers stored in refs so they can be cleared on re-fire or unmount ──
  const justCheckedTimerRef = useRef(null);
  const undoTimerRef        = useRef(null);
  // Latest check-in data, read inside toggle without adding it to the callback deps
  // (keeps `toggle` stable so memo'd rows don't re-render on every check-in).
  const dataRef             = useRef({});
  dataRef.current           = data;
  const dtTimer             = useRef(null);
  const isFirstDt           = useRef(true);
  const hnTimer             = useRef(null);
  const isFirstHn           = useRef(true);
  const hasLoadedRef        = useRef(false); // saves stay blocked until the initial fetch succeeds — otherwise a failed load + local edit could overwrite cloud data with empty state
  const didBackfillRef      = useRef(false); // one-time createdAt backfill for habits saved before we tracked it

  // ── Auth listener ──
  useEffect(() => {
    return onAuthStateChanged(_auth, async (u) => {
      isFirstId.current = true;
      isFirstCi.current = true;
      isFirstDt.current = true;
      isFirstHn.current = true;
      hasLoadedRef.current = false;
      didBackfillRef.current = false;
      streakCacheRef.current = {};
      setUser(u);
      if (u) {
        setDataLoading(true);
        try {
          const [idSnap, ciSnap, dtSnap, hnSnap] = await Promise.all([
            getDoc(identitiesRef(u.uid)),
            getDoc(checkInsRef(u.uid)),
            getDoc(dailyTasksRef(u.uid)),
            getDoc(habitNotesRef(u.uid)),
          ]);
          // Re-arm each first-run guard when applying fetched data, so the load
          // itself doesn't echo straight back to Firestore as a spurious save
          if (idSnap.exists()) { isFirstId.current = true; setIdentities(idSnap.data().data); }
          // Prune entries older than 366 days to prevent Firestore 1MB doc limit
          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - 366);
          const cutoffKey = dateToKey(cutoff);
          if (ciSnap.exists()) {
            const raw = ciSnap.data().data || {};
            const pruned = Object.fromEntries(Object.entries(raw).filter(([k]) => k >= cutoffKey));
            isFirstCi.current = true;
            setData(pruned);
          }
          if (dtSnap.exists()) {
            const raw = dtSnap.data().data || {};
            const pruned = Object.fromEntries(Object.entries(raw).filter(([k]) => k >= cutoffKey));
            isFirstDt.current = true;
            setDailyTasks(pruned);
          }
          if (hnSnap.exists()) {
            const raw = hnSnap.data().data || {};
            const pruned = Object.fromEntries(Object.entries(raw).filter(([k]) => k >= cutoffKey));
            isFirstHn.current = true;
            setHabitNotes(pruned);
          }
          hasLoadedRef.current = true;
        } catch (err) {
          console.error("Failed to load data from Firestore:", err);
          setSaveError(true); // reuse the existing error banner
        } finally {
          setDataLoading(false);
        }
      }
    });
  }, []);

  useEffect(() => {
    if (!user || isFirstId.current) { isFirstId.current = false; return; }
    if (!hasLoadedRef.current) return;
    idDirty.current = true;
    clearTimeout(idTimer.current);
    idTimer.current = setTimeout(() => {
      setSyncing(true);
      setSaveError(false);
      setDoc(identitiesRef(user.uid), { data: identities })
        .then(() => { idDirty.current = false; })
        .catch(err => { console.error("Identity save failed:", err); setSaveError(true); })
        .finally(() => setSyncing(false));
    }, 500);
  }, [identities, user]);

  useEffect(() => {
    if (!user || isFirstCi.current) { isFirstCi.current = false; return; }
    if (!hasLoadedRef.current) return;
    ciDirty.current = true;
    clearTimeout(ciTimer.current);
    ciTimer.current = setTimeout(() => {
      setSyncing(true);
      setSaveError(false);
      setDoc(checkInsRef(user.uid), { data })
        .then(() => { ciDirty.current = false; })
        .catch(err => { console.error("Check-in save failed:", err); setSaveError(true); })
        .finally(() => setSyncing(false));
    }, 500);
  }, [data, user]);

  useEffect(() => {
    if (!user || isFirstDt.current) { isFirstDt.current = false; return; }
    if (!hasLoadedRef.current) return;
    dtDirty.current = true;
    clearTimeout(dtTimer.current);
    dtTimer.current = setTimeout(() => {
      setSyncing(true);
      setSaveError(false);
      setDoc(dailyTasksRef(user.uid), { data: dailyTasks })
        .then(() => { dtDirty.current = false; })
        .catch(err => { console.error("Daily tasks save failed:", err); setSaveError(true); })
        .finally(() => setSyncing(false));
    }, 500);
  }, [dailyTasks, user]);

  useEffect(() => {
    if (!user || isFirstHn.current) { isFirstHn.current = false; return; }
    if (!hasLoadedRef.current) return;
    hnDirty.current = true;
    clearTimeout(hnTimer.current);
    hnTimer.current = setTimeout(() => {
      setSyncing(true);
      setSaveError(false);
      setDoc(habitNotesRef(user.uid), { data: habitNotes })
        .then(() => { hnDirty.current = false; })
        .catch(err => { console.error("Habit notes save failed:", err); setSaveError(true); })
        .finally(() => setSyncing(false));
    }, 500);
  }, [habitNotes, user]);

  // Keep the latest state handy for the unload-flush closure (which is created once).
  latestRef.current = { user, identities, data, dailyTasks, habitNotes };

  // Flush any pending debounced save the instant the tab is hidden or the page is
  // being unloaded (refresh, close, app backgrounded), so a quick refresh can't
  // roll a recent change back. Fire-and-forget — we can't await during unload.
  useEffect(() => {
    const flush = () => {
      const { user, identities, data, dailyTasks, habitNotes } = latestRef.current;
      if (!user || !hasLoadedRef.current) return;
      if (idDirty.current) { clearTimeout(idTimer.current); idDirty.current = false; setDoc(identitiesRef(user.uid), { data: identities }).catch(() => {}); }
      if (ciDirty.current) { clearTimeout(ciTimer.current); ciDirty.current = false; setDoc(checkInsRef(user.uid), { data }).catch(() => {}); }
      if (dtDirty.current) { clearTimeout(dtTimer.current); dtDirty.current = false; setDoc(dailyTasksRef(user.uid), { data: dailyTasks }).catch(() => {}); }
      if (hnDirty.current) { clearTimeout(hnTimer.current); hnDirty.current = false; setDoc(habitNotesRef(user.uid), { data: habitNotes }).catch(() => {}); }
    };
    const onVisibility = () => { if (document.visibilityState === "hidden") flush(); };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
    };
  }, []);

  // One-time backfill: stamp a createdAt on every habit saved before we tracked
  // it. Uses the earliest recorded check-in as a safe start (you can't have
  // logged a day before the habit existed); falls back to today if there's no
  // history. Runs once per load; the resulting setIdentities persists normally.
  useEffect(() => {
    if (!user || !hasLoadedRef.current || didBackfillRef.current) return;
    if (!identities.length) return;
    const today = getTodayKey();
    let changed = false;
    const next = identities.map(ident => {
      let identChanged = false;
      const habits = ident.habits.map(h => {
        if (h.createdAt) return h;
        identChanged = true; changed = true;
        return { ...h, createdAt: habitStartKey(h, data) || today };
      });
      return identChanged ? { ...ident, habits } : ident;
    });
    didBackfillRef.current = true;
    if (changed) setIdentities(next);
  }, [identities, data, user]);

  // ── Google sign-in ──
  const signIn = async () => {
    if (signingIn) return;
    setSigningIn(true);
    setSignInError(null);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      await signInWithPopup(_auth, provider);
    } catch (e) {
      console.error(e);
      setSignInError("Sign-in failed. Please try again.");
    } finally {
      setSigningIn(false);
    }
  };

  // ── Streak — declared BEFORE any early returns (Rules of Hooks) ──
  const getStreakForHabit = useCallback((habitId, frequency) => {
    const freqKey  = frequency ? `${frequency.cadence}:${(frequency.days||frequency.dates||[]).join(",")}` : "d";
    const cacheKey = `${habitId}|${freqKey}|${Object.keys(data).length}`;
    if (streakCacheRef.current[cacheKey] !== undefined) return streakCacheRef.current[cacheKey];

    let streak = 0;
    const d = new Date();
    for (let i = 0; i < 400; i++) {
      const key = dateToKey(d);
      const scheduled = isScheduledOn(frequency, key);
      if (scheduled) {
        if (data[key] && data[key][habitId] === true) {
          streak++;
        } else {
          if (i > 0) break;
        }
      }
      d.setDate(d.getDate() - 1);
    }
    streakCacheRef.current[cacheKey] = streak;
    return streak;
  }, [data]);

  // Invalidate the streak cache synchronously (during render) the moment `data`
  // changes, so a just-made check is reflected in the SAME render — not one
  // render later. (The old post-commit useEffect left the streak stale until
  // the next re-render, e.g. when checking a 2nd habit on the same day.)
  if (streakDataRef.current !== data) { streakDataRef.current = data; streakCacheRef.current = {}; }

  // ── Toggle — must be before early returns ──
  const toggle = useCallback((habitId, frequency, identity) => {
    // Read the committed data up front (a ref, always current) — do NOT compute
    // totals inside the setData updater; React may not run it synchronously.
    const cur = dataRef.current;
    const wasChecked = cur[selectedDate]?.[habitId] === true;
    setData(prev=>{
      const day=prev[selectedDate]||{};
      // Checking a habit always sets done — including from the "miss" state
      const next = {...day};
      if (day[habitId] === true) delete next[habitId]; else next[habitId] = true;
      return {...prev,[selectedDate]:next};
    });
    clearTimeout(justCheckedTimerRef.current);
    setJustChecked(habitId);
    // Long enough to read the reward before the row fades out (see .row-leaving delay)
    justCheckedTimerRef.current = setTimeout(()=>setJustChecked(null),3400);
    // Check-in celebration popup intentionally disabled — a check-in shows only
    // the inline row reward (justChecked), no full-screen popup message.
  }, [selectedDate]);

  // ── Mark a habit as missed (tap again to clear) — "miss" breaks the streak
  // and feeds the never-miss-twice warning the next day ──
  const markMiss = useCallback((habitId) => {
    setData(prev => {
      const day = prev[selectedDate] || {};
      const next = { ...day };
      if (next[habitId] === "miss") delete next[habitId];
      else next[habitId] = "miss";
      return { ...prev, [selectedDate]: next };
    });
  }, [selectedDate]);

  // Daily reflection note per habit — a short "what did I do today" for later review.
  const setHabitNote = useCallback((dateKey, habitId, text) => {
    setHabitNotes(prev => {
      const trimmed = (text || "").trim();
      const day = { ...(prev[dateKey] || {}) };
      if (trimmed) day[habitId] = trimmed;
      else delete day[habitId];
      if (Object.keys(day).length === 0) {           // drop empty day buckets
        const { [dateKey]: _drop, ...rest } = prev;
        return rest;
      }
      return { ...prev, [dateKey]: day };
    });
  }, []);

  // Cleanup all timers on unmount
  useEffect(() => () => {
    clearTimeout(justCheckedTimerRef.current);
    clearTimeout(undoTimerRef.current);
  }, []);

  // ── Midnight key refresh — keeps todayKey accurate if app runs overnight ──
  useEffect(() => {
    const msToMidnight = () => {
      const now = new Date();
      return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1) - now;
    };
    let t = setTimeout(function tick() {
      setTodayKey(getTodayKey());
      t = setTimeout(tick, msToMidnight());
    }, msToMidnight());
    return () => clearTimeout(t);
  }, []);

  // ── Stable modal-open callbacks (useCallback so memo'd child views don't re-render on every syncing/toast state change) ──
  const openEditHabit     = useCallback((identityId, habit) => { setModalCtx({ identityId, habitId: habit.id, habit }); setModal("editHabit"); }, []);
  const openDeleteHabit   = useCallback((identityId, habit) => { setModalCtx({ identityId, habitId: habit.id, habit }); setModal("confirmDeleteHabit"); }, []);
  const openEditIdentity  = useCallback((ident) => { const colorIdx = IDENTITY_COLORS.indexOf(ident.color); setModalCtx({ identityId: ident.id, ident, colorIdx: colorIdx>=0?colorIdx:0 }); setModal("editIdentity"); }, []);
  const openDeleteIdentity= useCallback((ident) => { setModalCtx({ identityId: ident.id, ident }); setModal("confirmDeleteIdentity"); }, []);
  const openAddHabit      = useCallback((defaultIdentityId) => { setModalCtx(defaultIdentityId ? { defaultIdentityId } : null); setModal("addHabit"); }, []);
  const openAddIdentity   = useCallback(() => setModal("addIdentity"), []);

  // ── Habit review mutations ──
  // Every one writes onto the habit inside `identities`, so it persists with the
  // rest of the habit — no separate collection to keep in sync.
  const mutateHabit = useCallback((habitId, identityId, fn) => {
    setIdentities(prev => prev.map(ident =>
      ident.id !== identityId ? ident
        : { ...ident, habits: ident.habits.map(h => h.id !== habitId ? h : fn(h)) }
    ));
  }, []);

  const applyReviewFix = useCallback((habitId, identityId, entry) => {
    const at = getTodayKey();
    mutateHabit(habitId, identityId, h => {
      const patch = entry.field === "frequency"
        ? { frequency: entry.frequency }
        : { [entry.field]: entry.to };
      return {
        ...h, ...patch,
        // `worked: null` marks it as awaiting the two-week verdict
        reviews: [...reviewLog(h), {
          at, dx: entry.dx, field: entry.field,
          from: entry.from, to: entry.to, baseRate: entry.baseRate, worked: null,
        }],
      };
    });
  }, [mutateHabit]);

  const snoozeReview = useCallback((habitId, identityId, days) => {
    const until = addDaysKey(getTodayKey(), days);
    mutateHabit(habitId, identityId, h => ({
      ...h, reviewSnoozeUntil: until,
      reviews: [...reviewLog(h), { at: getTodayKey(), dx: "fine", field: null, snoozedTo: until }],
    }));
  }, [mutateHabit]);

  // Record the verdict on a past fix and reset the clock either way, so a habit
  // that's still failing gets a fresh window rather than nagging tomorrow.
  const resolveFollowUp = useCallback((habitId, identityId, reviewAt, worked) => {
    mutateHabit(habitId, identityId, h => ({
      ...h,
      reviewSnoozeUntil: addDaysKey(getTodayKey(), worked ? REVIEW_SNOOZE : 3),
      reviews: reviewLog(h).map(r => r.at === reviewAt && r.worked == null ? { ...r, worked } : r),
    }));
  }, [mutateHabit]);

  const archiveHabit = useCallback((habitId, identityId) => {
    mutateHabit(habitId, identityId, h => ({ ...h, archived: true }));
  }, [mutateHabit]);

  // ── Daily task CRUD (stable callbacks — only touch setDailyTasks) ──
  // Tasks carry `star`: true for one of the day's Big 3, false for the backlog.
  // (Legacy tasks may still carry `priority`/`quadrant` — see migrateStars below.)
  const addTask = useCallback((dateKey, text, priority = "med") => {
    const p = PRIORITIES[priority] ? priority : "med";
    setDailyTasks(prev => {
      const existing = prev[dateKey] || [];
      return { ...prev, [dateKey]: [...existing, { id: uid(), text, done: false, priority: p }] };
    });
  }, []);

  // Add a task straight into a vacant Top-3 slot (created already focused).
  const FOCUS_CAP_ADD = 3;
  const addFocusTask = useCallback((dateKey, text) => {
    setDailyTasks(prev => {
      const existing = prev[dateKey] || [];
      if (existing.filter(t => t.focus && !t.done).length >= FOCUS_CAP_ADD) return prev; // no free slot
      return { ...prev, [dateKey]: [...existing, { id: uid(), text, done: false, priority: "med", focus: true, focusAt: Date.now() }] };
    });
  }, []);

  // Cycle a task's priority: High → Med → Low → High. (Kept the name `toggleStar`
  // so the prop threading through TodayView/TopTasksCard stays intact.)
  const toggleStar = useCallback((dateKey, taskId) => {
    setDailyTasks(prev => {
      const list = prev[dateKey] || [];
      const target = list.find(t => t.id === taskId);
      if (!target) return prev;
      const cur  = PRIORITIES[target.priority] ? target.priority : (target.star ? "high" : "med");
      const next = PRIORITY_ORDER[(PRIORITY_ORDER.indexOf(cur) + 1) % PRIORITY_ORDER.length];
      return {
        ...prev,
        [dateKey]: list.map(t => {
          if (t.id !== taskId) return t;
          const { star, ...rest } = t; // drop the legacy star field entirely
          return { ...rest, priority: next };
        }),
      };
    });
  }, []);

  // Promote/demote a task to "Top 3 focus" — at most 3 focus tasks per day.
  const FOCUS_CAP = 3;
  const toggleFocus = useCallback((dateKey, taskId) => {
    setDailyTasks(prev => {
      const list = prev[dateKey] || [];
      const target = list.find(t => t.id === taskId);
      if (!target) return prev;
      if (!target.focus && list.filter(t => t.focus && !t.done).length >= FOCUS_CAP) return prev; // cap counts only live focus tasks; a completed one frees its slot
      return { ...prev, [dateKey]: list.map(t => {
        if (t.id !== taskId) return t;
        // focusAt records selection order so slots read first-picked → last-picked.
        return t.focus ? { ...t, focus: false } : { ...t, focus: true, focusAt: Date.now() };
      }) };
    });
  }, []);

  const toggleTask = useCallback((dateKey, taskId) => {
    setDailyTasks(prev => {
      const list = prev[dateKey] || [];
      const target = list.find(t => t.id === taskId);
      if (!target) return prev;
      // Re-opening a completed star tries to rejoin the Big 3. If its old slot
      // has since been filled, it comes back unstarred rather than making four.
      const reopening = target.done && isStarred(target);
      const noRoom    = reopening && countStarred(list) >= STAR_LIMIT;
      return {
        ...prev,
        [dateKey]: list.map(t =>
          t.id === taskId ? { ...t, done: !t.done, star: noRoom ? false : t.star } : t
        ),
      };
    });
  }, []);

  const deleteTask = useCallback((dateKey, taskId) => {
    const list = dailyTasks[dateKey] || [];
    const idx = list.findIndex(t => t.id === taskId);
    if (idx === -1) return;
    const victim = list[idx];
    setDailyTasks(prev => ({
      ...prev,
      [dateKey]: (prev[dateKey] || []).filter(t => t.id !== taskId),
    }));
    clearTimeout(undoTimerRef.current);
    setUndoDelete({
      label: `"${victim.text}" deleted`,
      restore: () => setDailyTasks(prev => {
        const l = prev[dateKey] || [];
        const at = Math.min(idx, l.length);
        return { ...prev, [dateKey]: [...l.slice(0, at), victim, ...l.slice(at)] };
      }),
    });
    undoTimerRef.current = setTimeout(() => setUndoDelete(null), 5000);
  }, [dailyTasks]);

  // Push a task to tomorrow — same carried/carriedFrom bookkeeping as the
  // midnight rollover, so neither mechanism ever duplicates a task
  const deferTask = useCallback((dateKey, taskId) => {
    setDailyTasks(prev => {
      const list = prev[dateKey] || [];
      const src = list.find(t => t.id === taskId);
      if (!src) return prev;
      const d = new Date(dateKey + "T12:00:00"); d.setDate(d.getDate() + 1);
      const nextKey = dateToKey(d);
      const nextList = prev[nextKey] || [];
      if (nextList.some(t => t.carriedFrom === taskId)) return prev;
      // The star travels with the task — a starred item you push to tomorrow is
      // still important tomorrow. Clamped so the destination day can't exceed the cap.
      const keepStar = isStarred(src) && countStarred(nextList) < STAR_LIMIT;
      return {
        ...prev,
        [dateKey]: list.map(t => t.id === taskId ? { ...t, carried: true } : t),
        [nextKey]: [...nextList, { ...src, id: uid(), done: false, carried: false, star: keepStar, carriedFrom: taskId }],
      };
    });
  }, []);

  const editTask = useCallback((dateKey, taskId, text) => {
    setDailyTasks(prev => ({
      ...prev,
      [dateKey]: (prev[dateKey] || []).map(t => t.id === taskId ? { ...t, text } : t),
    }));
  }, []);

  // One-time migration: tasks created under the old High/Medium/Low system have
  // no `star` field. Promote up to STAR_LIMIT of that day's High tasks so the
  // signal survives the switch, and mark the day migrated by writing `star` on
  // every task. Runs per day-bucket, and is a no-op once every task has `star`.
  const migrateStars = useCallback(() => {
    setDailyTasks(prev => {
      let changed = false;
      const next = {};
      for (const [dateKey, list] of Object.entries(prev)) {
        if (list.every(t => typeof t.star === "boolean")) { next[dateKey] = list; continue; }
        let used = countStarred(list); // stars already set on this day count against the cap
        next[dateKey] = list.map(t => {
          if (typeof t.star === "boolean") return t;
          const wasHigh = taskPriority(t) === "H" && !t.done && !t.carried;
          const star = wasHigh && used < STAR_LIMIT;
          if (star) used++;
          return { ...t, star };
        });
        changed = true;
      }
      return changed ? next : prev;
    });
  }, []);

  // ── Task rollover — runs on every refresh/mount and at midnight.
  // Idempotent via `carriedFrom`: each carried task records the source ID,
  // so the same task is never duplicated even across multiple refreshes.
  const performRollover = useCallback(() => {
    const today = getTodayKey();
    const d = new Date(); d.setDate(d.getDate() - 1);
    const yesterday = dateToKey(d);
    setDailyTasks(prev => {
      const undone = (prev[yesterday] || []).filter(t => !t.done && !t.carried);
      if (!undone.length) return prev;
      const todayTasks = prev[today] || [];
      // IDs already carried from yesterday → today
      const alreadyCarried = new Set(todayTasks.map(t => t.carriedFrom).filter(Boolean));
      const toCarry = undone.filter(t => !alreadyCarried.has(t.id));
      if (!toCarry.length) return prev;
      const carriedIds = new Set(toCarry.map(t => t.id));
      // Mark source tasks in yesterday as carried so they hide from that day's view
      const updatedYesterday = (prev[yesterday] || []).map(t =>
        carriedIds.has(t.id) ? { ...t, carried: true } : t
      );
      // Stars survive the midnight rollover — an unfinished priority is still a
      // priority today. Fill the day's remaining slots in order; anything past
      // the cap lands unstarred in the backlog rather than blowing through it.
      let slots = STAR_LIMIT - countStarred(todayTasks);
      const newToday = [...todayTasks, ...toCarry.map(t => {
        const keepStar = isStarred(t) && slots > 0;
        if (keepStar) slots--;
        return { ...t, id: uid(), done: false, star: keepStar, carriedFrom: t.id };
      })];
      return { ...prev, [yesterday]: updatedYesterday, [today]: newToday };
    });
  }, []);

  // Fire rollover at midnight (12 AM) every day; also runs on login/load in case it's overdue.
  useEffect(() => {
    if (!user || dataLoading) return;
    const msToMidnight = () => {
      const now = new Date();
      return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1) - now;
    };
    migrateStars();    // no-op once every task carries a `star` field
    performRollover(); // safe on every mount — carriedFrom dedup prevents duplicates
    let t = setTimeout(function tick() {
      performRollover();
      t = setTimeout(tick, msToMidnight());
    }, msToMidnight());
    return () => clearTimeout(t);
  }, [user, dataLoading, performRollover, migrateStars]);

  // ── Online / offline detection ──
  useEffect(() => {
    const goOnline  = () => setIsOffline(false);
    const goOffline = () => setIsOffline(true);
    window.addEventListener("online",  goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online",  goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  // ── Loading / Auth gates ──
  if (_envMissing.length) {
    return (
      <div style={{ ...S.root, alignItems:"center", justifyContent:"center", padding:32 }}>
        <div style={{ fontSize:40, marginBottom:16 }} aria-hidden="true">⚙️</div>
        <div style={{ fontSize:18, fontWeight:700, color:T.red, marginBottom:8 }}>Configuration Error</div>
        <div style={{ fontSize:14, color:T.text2, marginBottom:16, textAlign:"center", lineHeight:1.7 }}>
          Missing Firebase environment variables. Copy <code>.env.example</code> → <code>.env</code> and fill in your values.
        </div>
        <div style={{ background:T.red+"12", border:`1px solid ${T.red}44`, borderRadius:12, padding:"12px 16px", width:"100%", maxWidth:340 }}>
          {_envMissing.map(k => <div key={k} style={{ fontSize:13, fontFamily:"monospace", color:T.red, padding:"2px 0" }}>✗ {k}</div>)}
        </div>
      </div>
    );
  }
  if (user === undefined) {
    return (
      <div style={{ ...S.root, alignItems:"center", justifyContent:"center" }}>
        <div style={S.spinner} aria-label="Loading" role="status"/>
        <div style={{ color:T.muted, fontSize:15, marginTop:16 }}>Loading…</div>
      </div>
    );
  }
  if (!user) {
    return (
      <div style={{ ...S.root }}>
        <main style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:24, padding:32, flex:1 }}>
          <div style={{ fontSize:52 }} aria-hidden="true">🧠</div>
          <div style={{ fontFamily:FONT_DISPLAY, fontWeight:800, fontSize:24, color:T.text, textAlign:"center", letterSpacing:"-0.03em" }}>
            Atomic Habits
          </div>
          <div style={{ fontSize:15, color:T.muted, textAlign:"center", lineHeight:1.6 }}>
            Sign in with your Google account to sync your habits across devices.
          </div>
          {signInError && (
            <div role="alert" style={{ fontSize:14, color:T.red, background:T.red+"12", border:`1px solid ${T.red}44`, borderRadius:10, padding:"10px 14px", textAlign:"center", width:"100%", maxWidth:320 }}>
              {signInError}
            </div>
          )}
          <button onClick={signIn} disabled={signingIn} aria-busy={signingIn}
            style={{ width:"100%", maxWidth:320, display:"flex", alignItems:"center", justifyContent:"center", gap:12, fontSize:16, fontWeight:700, padding:"15px 20px", background:"#fff", border:`1.5px solid ${T.border}`, borderRadius:14, color:T.text, cursor: signingIn ? "wait" : "pointer", fontFamily:"inherit", WebkitTapHighlightColor:"transparent", boxShadow:"0 1px 4px #00000010", opacity: signingIn ? 0.65 : 1, transition:"opacity 0.2s" }}>
            {signingIn
              ? <><div aria-hidden="true" style={{width:20,height:20,borderRadius:"50%",border:`2px solid ${T.border}`,borderTopColor:T.accent,animation:"spin 0.8s linear infinite",flexShrink:0}}/> Signing in…</>
              : <>
                  <svg width="20" height="20" viewBox="0 0 18 18" aria-hidden="true">
                    <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 002.38-5.88c0-.57-.05-.66-.15-1.18z"/>
                    <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2.01c-.72.48-1.63.76-2.7.76-2.1 0-3.8-1.36-4.42-3.21H1.87v2.09A8 8 0 008.98 17z"/>
                    <path fill="#FBBC05" d="M4.56 10.6A4.6 4.6 0 014.3 9c0-.56.1-1.1.26-1.6V5.31H1.87A8 8 0 001 9c0 1.3.31 2.52.87 3.6l2.69-2z"/>
                    <path fill="#EA4335" d="M8.98 3.8c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 008.98 1a8 8 0 00-7.11 4.31l2.69 2.09C5.18 5.16 6.89 3.8 8.98 3.8z"/>
                  </svg>
                  Sign in with Google
                </>
            }
          </button>
        </main>
      </div>
    );
  }

  // ── Data loading gate — prevents flash of empty state while Firestore fetch is in-flight ──
  if (dataLoading) {
    return (
      <div style={{ ...S.root, alignItems:"center", justifyContent:"center" }}>
        <div style={S.spinner} aria-label="Loading your habits" role="status"/>
        <div style={{ color:T.muted, fontSize:15, marginTop:16 }}>Loading your habits…</div>
      </div>
    );
  }

  // ── CRUD: Habits ──
  const addHabit = ({ label, trigger, attractive, easy, starter, satisfying, time, location, icon, identityId, frequency, kind }) => {
    setIdentities(prev => prev.map(ident =>
      ident.id !== identityId ? ident :
      { ...ident, habits: [...ident.habits, { id: uid(), label, trigger, attractive, easy, starter, satisfying, time, location, icon: icon || "", kind: kind || "good", frequency: frequency || DEFAULT_FREQUENCY, createdAt: getTodayKey() }] }
    ));
    setModal(null);
  };

  const updateHabit = ({ label, trigger, attractive, easy, starter, satisfying, time, location, icon, identityId: newIdentityId, frequency, kind }) => {
    const { identityId: oldIdentityId, habitId } = modalCtx;
    const freq = frequency || DEFAULT_FREQUENCY;
    const k = kind || "good";
    if (newIdentityId === oldIdentityId) {
      setIdentities(prev => prev.map(ident =>
        ident.id !== oldIdentityId ? ident :
        { ...ident, habits: ident.habits.map(h => h.id !== habitId ? h : { ...h, label, trigger, attractive, easy, starter, satisfying, time, location, icon: icon || "", kind: k, frequency: freq }) }
      ));
    } else {
      setIdentities(prev => {
        const habitData = prev.find(i => i.id === oldIdentityId)?.habits.find(h => h.id === habitId);
        return prev.map(ident => {
          if (ident.id === oldIdentityId) return { ...ident, habits: ident.habits.filter(h => h.id !== habitId) };
          if (ident.id === newIdentityId) return { ...ident, habits: [...ident.habits, { ...habitData, label, trigger, attractive, easy, starter, satisfying, time, location, icon: icon || "", kind: k, frequency: freq }] };
          return ident;
        });
      });
    }
    setModal(null);
  };

  const deleteHabit = () => {
    const { identityId, habitId } = modalCtx;
    const ident = identities.find(i => i.id === identityId);
    const habitIdx = ident?.habits.findIndex(h => h.id === habitId) ?? -1;
    const deletedHabit = ident?.habits[habitIdx];
    setIdentities(prev => prev.map(i =>
      i.id !== identityId ? i : { ...i, habits: i.habits.filter(h => h.id !== habitId) }
    ));
    setModal(null);
    if (deletedHabit) {
      clearTimeout(undoTimerRef.current);
      setUndoDelete({
        label: `"${deletedHabit.label}" deleted`,
        restore: () => setIdentities(prev => prev.map(i =>
          i.id !== identityId ? i : {
            ...i,
            habits: [...i.habits.slice(0, habitIdx), deletedHabit, ...i.habits.slice(habitIdx)],
          }
        )),
      });
      undoTimerRef.current = setTimeout(() => setUndoDelete(null), 5000);
    }
  };

  // ── CRUD: Identities ──
  const addIdentity = ({ label, icon, colorIdx }) => {
    const color    = IDENTITY_COLORS[colorIdx];
    const colorDim = IDENTITY_DIMS[colorIdx];
    setIdentities(prev => [...prev, { id: uid(), label, icon, color, colorDim, habits: [] }]);
    setModal(null);
  };

  const updateIdentity = ({ label, icon, colorIdx }) => {
    const { identityId } = modalCtx;
    const color    = IDENTITY_COLORS[colorIdx];
    const colorDim = IDENTITY_DIMS[colorIdx];
    setIdentities(prev => prev.map(ident =>
      ident.id !== identityId ? ident : { ...ident, label, icon, color, colorDim }
    ));
    setModal(null);
  };

  const deleteIdentity = () => {
    const { identityId } = modalCtx;
    const identIdx = identities.findIndex(i => i.id === identityId);
    const deletedIdent = identities[identIdx];
    setIdentities(prev => prev.filter(i => i.id !== identityId));
    setModal(null);
    if (deletedIdent) {
      clearTimeout(undoTimerRef.current);
      setUndoDelete({
        label: `Identity "${shortLabel(deletedIdent.label)}" deleted`,
        restore: () => setIdentities(prev => [
          ...prev.slice(0, identIdx),
          deletedIdent,
          ...prev.slice(identIdx),
        ]),
      });
      undoTimerRef.current = setTimeout(() => setUndoDelete(null), 5000);
    }
  };


  return (
    <div style={S.root}>
      <style>{css}</style>

      {/* ── Save Error Banner ── */}
      {saveError && (
        <div role="alert" style={{
          position:"fixed", top:0, left:"50%", transform:"translateX(-50%)",
          width:"100%", maxWidth:430, zIndex:200,
          background:T.red, color:"#fff", fontSize:14, fontWeight:600,
          textAlign:"center", padding:"10px 20px",
          paddingTop:"calc(env(safe-area-inset-top,0px) + 10px)",
        }}>
          ⚠️ Save failed — check your connection.{" "}
          <button onClick={()=>setSaveError(false)} style={{ color:"#fff", background:"transparent", border:"none", cursor:"pointer", textDecoration:"underline", fontWeight:700 }}>Dismiss</button>
        </div>
      )}

      {/* ── Offline Banner ── */}
      {isOffline && (
        <div role="status" aria-live="polite" style={{
          position:"fixed", top:0, left:"50%", transform:"translateX(-50%)",
          width:"100%", maxWidth:430, zIndex:201,
          background:"#374151", color:"#fff", fontSize:14, fontWeight:600,
          textAlign:"center", padding:"10px 20px",
          paddingTop:"calc(env(safe-area-inset-top,0px) + 10px)",
        }}>
          📶 You're offline — changes will sync when reconnected
        </div>
      )}


      {/* ── Modals ── */}
      {reviewOpen && (manualReview || reviewTarget) && (
        <HabitReview
          target={manualReview || reviewTarget}
          onApply={applyReviewFix}
          onSnooze={snoozeReview}
          onFollowUp={resolveFollowUp}
          onArchive={archiveHabit}
          onClose={() => { setReviewOpen(false); setManualReview(null); }}
        />
      )}
      {modal==="addHabit" && (
        <Modal title="Add New Habit" onClose={()=>setModal(null)}>
          <HabitForm
            initial={modalCtx?.defaultIdentityId ? { identityId: modalCtx.defaultIdentityId } : {}}
            identities={identities} onSave={addHabit} onCancel={()=>setModal(null)} mode="add" />
        </Modal>
      )}
      {modal==="editHabit" && modalCtx && (
        <Modal title="Edit Habit" onClose={()=>setModal(null)}>
          <HabitForm initial={{ ...modalCtx.habit, identityId: modalCtx.identityId }} identities={identities} onSave={updateHabit} onCancel={()=>setModal(null)} mode="edit" />
        </Modal>
      )}
      {modal==="addIdentity" && (
        <Modal title="Add New Identity" onClose={()=>setModal(null)}>
          <IdentityForm onSave={addIdentity} onCancel={()=>setModal(null)} mode="add" />
        </Modal>
      )}
      {modal==="editIdentity" && modalCtx && (
        <Modal title="Edit Identity" onClose={()=>setModal(null)}>
          <IdentityForm initial={{ ...modalCtx.ident, colorIdx: modalCtx.colorIdx }} onSave={updateIdentity} onCancel={()=>setModal(null)} mode="edit" />
        </Modal>
      )}
      {modal==="confirmDeleteHabit" && modalCtx && (
        <Confirm
          message={`Delete "${modalCtx.habit?.label}"? This will remove all its tracking data.`}
          onConfirm={deleteHabit} onCancel={()=>setModal(null)} />
      )}
      {modal==="confirmDeleteIdentity" && modalCtx && (
        <Confirm
          message={`Delete the identity "${modalCtx.ident?.label}" and ALL its habits? This cannot be undone.`}
          onConfirm={deleteIdentity} onCancel={()=>setModal(null)} />
      )}

      {/* ── Header ── */}
      <header style={S.header}>
        <div>
          <div style={S.eyebrow}>
            Atomic Habits
            {syncing && <span style={{opacity:0.6}} aria-hidden="true">{" "}· saving…</span>}
          </div>
          {syncing && (
            <div role="status" aria-live="polite" style={{ position:"absolute", width:1, height:1, overflow:"hidden", clip:"rect(0,0,0,0)", whiteSpace:"nowrap" }}>
              Saving your habits
            </div>
          )}
          <h1 style={S.title}>
            {view==="today"
              ? (selectedDate === todayKey ? "Today" : formatNavDate(selectedDate))
              : view==="identity" ? "Identity"
              : view==="week" ? "This Week"
              : view==="streaks" ? "Streaks"
              : "Manage"}
          </h1>
          <div style={S.dateLabel}>
            {view === "today"
              ? new Date(selectedDate + "T12:00:00").toLocaleDateString(navigator.language||undefined,{weekday:"long",day:"numeric",month:"short"})
              : new Date().toLocaleDateString(navigator.language||undefined,{weekday:"long",day:"numeric",month:"short"})}
          </div>
          {view === "today" && totalDone > 0 && (
            <span aria-label={`${totalDone} votes cast ${selectedDate === todayKey ? "today" : "this day"}`} style={{
              display:"inline-flex", alignItems:"center", gap:5, marginTop:6,
              fontSize:12, fontWeight:700, color:"#92400E", background:T.gold+"1f",
              borderRadius:20, padding:"3px 10px",
            }}>
              <Ic name="vote" size={13} color="#92400E" /> {totalDone} vote{totalDone !== 1 ? "s" : ""}{selectedDate === todayKey ? " today" : ""}
            </span>
          )}
        </div>
        <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:6 }}>
          <div style={S.ringWrap}>
            {(() => {
              const ringTitleId = "ring-title-" + view;
              return (
                <svg width="68" height="68" viewBox="0 0 68 68" role="img" aria-labelledby={ringTitleId}
                  className={pct===100 ? "pop" : ""}>
                  <title id={ringTitleId}>
                    {totalTotal === 0
                      ? "No habits scheduled"
                      : `${pct}% complete ${selectedDate === todayKey ? "today" : "on " + formatNavDate(selectedDate)}`}
                  </title>
                  <circle cx="34" cy="34" r="28" fill="none" stroke={T.border} strokeWidth="5"/>
                  <circle cx="34" cy="34" r="28" fill="none"
                    stroke={pct===100?T.gold:T.primary} strokeWidth="5"
                    strokeDasharray={`${(pct/100)*176} 176`} strokeLinecap="round"
                    transform="rotate(-90 34 34)" style={{transition:"stroke-dasharray 0.6s ease"}}/>
                  <text x="34" y="39" textAnchor="middle" fill={T.text} fontSize="15" fontWeight="800" fontFamily={FONT_DISPLAY} style={{fontVariantNumeric:"tabular-nums"}} aria-hidden="true">
                    {totalTotal === 0 ? "—" : `${pct}%`}
                  </text>
                </svg>
              );
            })()}
            <div style={{...S.ringLabel, fontVariantNumeric:"tabular-nums"}} aria-hidden="true">
              {totalTotal === 0 ? "none today" : `${totalDone}/${totalTotal} done`}
            </div>
          </div>
        </div>
      </header>

      {/* ── Scrollable Content ── */}
      <main style={S.scrollArea} ref={scrollRef}>
        {view==="today" && (
          <TodayView
            identities={liveIdentities}
            allHabits={allHabits}
            todayData={selectedData}
            allData={data}
            toggle={toggle}
            markMiss={markMiss}
            habitNotes={habitNotes}
            setHabitNote={setHabitNote}
            justChecked={justChecked}
            getStreakForHabit={getStreakForHabit}
            openEditHabit={openEditHabit}
            openDeleteHabit={openDeleteHabit}
            openReviewFor={openReviewFor}
            setModal={setModal}
            openAddHabit={openAddHabit}
            openAddIdentity={openAddIdentity}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            todayKey={todayKey}
            dailyTasks={dailyTasks}
            addTask={addTask}
            addFocusTask={addFocusTask}
            toggleTask={toggleTask}
            deleteTask={deleteTask}
            editTask={editTask}
            toggleStar={toggleStar}
            toggleFocus={toggleFocus}
            deferTask={deferTask}
            reviewTarget={reviewTarget && reviewTarget.habit.id !== reviewDismissed ? reviewTarget : null}
            onOpenReview={() => setReviewOpen(true)}
            onDismissReview={() => setReviewDismissed(reviewTarget?.habit.id ?? null)}
          />
        )}

        {view==="identity" && (
          <IdentityView
            identities={liveIdentities}
            todayData={selectedData}
            allData={data}
            toggle={toggle}
            todayKey={todayKey}
            openAddHabit={openAddHabit}
            openAddIdentity={openAddIdentity}
          />
        )}
        {view==="week"    && <WeekView data={data} todayKey={todayKey} identities={liveIdentities}/>}
        {view==="streaks" && <StreaksView data={data} getStreak={getStreakForHabit} identities={liveIdentities}/>}
        {view==="manage"  && (
          <ManageView
            identities={liveIdentities}
            onAddHabit={openAddHabit}
            onEditHabit={openEditHabit}
            onDeleteHabit={openDeleteHabit}
            onAddIdentity={openAddIdentity}
            onEditIdentity={openEditIdentity}
            onDeleteIdentity={openDeleteIdentity}
            userName={user.displayName || ""}
            userEmail={user.email || ""}
            onSignOut={()=>fbSignOut(_auth)}
            notifStatus={notifStatus}
            notifBusy={notifBusy}
            onEnableReminders={handleEnableReminders}
          />
        )}
      </main>

      {/* ── Undo Delete Toast ── */}
      {undoDelete && (
        <div role="status" aria-live="polite" className="toast-in" style={{
          position:"fixed",
          bottom:"calc(env(safe-area-inset-bottom,0px) + 72px)",
          left:"50%", transform:"translateX(-50%)",
          background:T.text, color:"#fff", borderRadius:14,
          padding:"12px 14px", display:"flex", alignItems:"center", gap:10,
          zIndex:998, boxShadow:"0 4px 24px #00000030",
          maxWidth:"calc(100vw - 32px)", width:390, fontSize:14, fontWeight:600,
        }}>
          <span style={{flex:1,lineHeight:1.4}}>{undoDelete.label}</span>
          <button
            onClick={() => {
              undoDelete.restore();
              clearTimeout(undoTimerRef.current);
              setUndoDelete(null);
            }}
            style={{ background:"transparent", border:"1.5px solid rgba(255,255,255,0.45)", borderRadius:8, color:"#fff", fontSize:13, fontWeight:700, padding:"5px 12px", cursor:"pointer", flexShrink:0, WebkitTapHighlightColor:"transparent" }}>
            Undo
          </button>
          <button
            onClick={() => { clearTimeout(undoTimerRef.current); setUndoDelete(null); }}
            aria-label="Dismiss"
            style={{ background:"transparent", border:"none", color:"rgba(255,255,255,0.55)", fontSize:16, cursor:"pointer", padding:"0 2px", lineHeight:1, WebkitTapHighlightColor:"transparent" }}>
            ✕
          </button>
        </div>
      )}

      {/* ── Bottom Nav ── */}
      <nav style={S.bottomNav} aria-label="Main navigation">
        {[
          {id:"today",    icon:"☀️",  label:"Today"},
          {id:"identity", icon:"🪪",  label:"Identity"},
          {id:"week",     icon:"📅",  label:"Week"},
          {id:"streaks",  icon:"🔥",  label:"Streaks"},
          {id:"manage",   icon:"⚙️",  label:"Manage"},
        ].map(t=>(
          <button key={t.id} onClick={()=>{ setView(t.id); if(t.id==="today") setSelectedDate(todayKey); }}
            style={{ ...S.navBtn, background: view===t.id ? T.accent+"14" : "transparent", borderRadius:12, margin:"4px 4px 0" }}
            aria-current={view===t.id?"page":undefined}>
            <span style={S.navIcon} aria-hidden="true">{t.icon}</span>
            <span style={{...S.navLabel, color:view===t.id?T.primary:T.muted, fontWeight:view===t.id?700:500}}>{t.label}</span>
            {view===t.id && <div style={{width:4,height:4,borderRadius:"50%",background:T.gold,marginTop:1}} aria-hidden="true"/>}
          </button>
        ))}
      </nav>
    </div>
  );
}

// ─── MANAGE VIEW ──────────────────────────────────────────────────────────────
const ManageView = memo(function ManageView({ identities, onAddHabit, onEditHabit, onDeleteHabit, onAddIdentity, onEditIdentity, onDeleteIdentity, userName, userEmail, onSignOut, notifStatus, notifBusy, onEnableReminders }) {
  return (
    <div style={S.content}>

      {identities.length === 0 && (
        <div style={{textAlign:"center",padding:"40px 16px",color:T.muted}}>
          <div style={{fontSize:40,marginBottom:12}} aria-hidden="true">🌱</div>
          <div style={{fontSize:16,fontWeight:700,color:T.text,marginBottom:6}}>No identities yet</div>
          <div style={{fontSize:14,lineHeight:1.6}}>Create an identity to start tracking habits.</div>
        </div>
      )}

      {identities.map(identity=>(
        <div key={identity.id} style={S.card}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
            <span style={{fontSize:24}} aria-hidden="true">{identity.icon}</span>
            <div style={{flex:1}}>
              <div style={{...S.cardLabel,color:identity.color}}>{identity.label}</div>
              <div style={{fontSize:12,color:T.muted,marginTop:2,fontWeight:500}}>{identity.habits.length} habit{identity.habits.length!==1?"s":""}</div>
            </div>
            <button onClick={()=>onEditIdentity(identity)} style={S.crudBtn} aria-label={`Edit identity: ${identity.label}`}>
              <span aria-hidden="true">✎</span>
            </button>
            <button onClick={()=>onDeleteIdentity(identity)} style={{...S.crudBtn,color:T.red}} aria-label={`Delete identity: ${identity.label}`}>
              <span aria-hidden="true">🗑</span>
            </button>
          </div>

          {identity.habits.length>0 && (
            <div style={{borderTop:`1px solid ${T.border}`,paddingTop:10,marginBottom:10}}>
              {[...identity.habits].sort(byHabitTime).map(habit=>(
                <div key={habit.id} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 0",borderBottom:`1px solid ${T.surf2}`}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,color:T.text,fontWeight:600}}>{habit.label}</div>
                    {habit.trigger&&<div style={{fontSize:12,color:T.muted,marginTop:2}}><span aria-hidden="true">⚡</span> {habit.trigger}</div>}
                  </div>
                  <button onClick={()=>onEditHabit(identity.id,habit)} style={S.crudBtn} aria-label={`Edit habit: ${habit.label}`}>
                    <span aria-hidden="true">✎</span>
                  </button>
                  <button onClick={()=>onDeleteHabit(identity.id,habit)} style={{...S.crudBtn,color:T.red}} aria-label={`Delete habit: ${habit.label}`}>
                    <span aria-hidden="true">🗑</span>
                  </button>
                </div>
              ))}
            </div>
          )}

          {identity.habits.length===0&&(
            <div style={{fontSize:13,color:T.muted,marginBottom:12,textAlign:"center",padding:"8px 0"}}>No habits yet — add one below</div>
          )}

          <button onClick={()=>onAddHabit(identity.id)} style={{...S.addHabitBtn,borderColor:identity.color+"55"}}>
            <span style={{fontSize:16,color:identity.color,fontWeight:700}} aria-hidden="true">+</span>
            <span style={{fontSize:14,color:T.text2}}>Add habit to {shortLabel(identity.label)}</span>
          </button>
        </div>
      ))}

      <button onClick={onAddIdentity} style={S.addIdentityBtn}>+ Add New Identity</button>

      {/* Account & settings — sign out + reminders live here, keeping the header clean */}
      <div style={{ ...S.card, marginTop:18 }}>
        <div style={{ fontSize:11, fontWeight:800, letterSpacing:"0.08em", textTransform:"uppercase", color:T.muted, marginBottom:12 }}>Account &amp; settings</div>

        {notifStatus !== "unsupported" && (
          <div style={{ display:"flex", alignItems:"center", gap:10, paddingBottom:12, marginBottom:12, borderBottom:`1px solid ${T.surf2}` }}>
            <span style={{ fontSize:18 }} aria-hidden="true">🔔</span>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:14, fontWeight:700, color:T.text }}>Habit reminders</div>
              <div style={{ fontSize:12.5, color:T.muted, marginTop:1 }}>A push at each habit's time.</div>
            </div>
            {notifStatus === "granted" ? (
              <span style={{ display:"inline-flex", alignItems:"center", gap:4, fontSize:12.5, fontWeight:700, color:T.primary, flexShrink:0 }}>
                <Ic name="check" size={13} color={T.primary} /> On
              </span>
            ) : (
              <button onClick={onEnableReminders} disabled={notifBusy}
                style={{ background:T.primary, border:"none", borderRadius:20, fontSize:13, fontWeight:700, color:"#fff", padding:"7px 15px", cursor: notifBusy ? "default" : "pointer", fontFamily:"inherit", opacity: notifBusy ? 0.6 : 1, flexShrink:0, WebkitTapHighlightColor:"transparent" }}>
                {notifBusy ? "Enabling…" : "Turn on"}
              </button>
            )}
          </div>
        )}

        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ width:34, height:34, borderRadius:"50%", background:T.surf2, display:"flex", alignItems:"center", justifyContent:"center", fontSize:15, fontWeight:800, color:T.primary, flexShrink:0 }} aria-hidden="true">
            {(userName || userEmail || "?").charAt(0).toUpperCase()}
          </span>
          <div style={{ flex:1, minWidth:0 }}>
            {userName && <div style={{ fontSize:14, fontWeight:700, color:T.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{userName}</div>}
            {userEmail && <div style={{ fontSize:12.5, color:T.muted, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{userEmail}</div>}
          </div>
          <button onClick={onSignOut}
            style={{ background:"transparent", border:`1px solid ${T.border}`, borderRadius:20, fontSize:13, fontWeight:700, color:T.text2, padding:"7px 15px", cursor:"pointer", fontFamily:"inherit", flexShrink:0, WebkitTapHighlightColor:"transparent" }}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
});

// ─── TIME SLOT CLASSIFIER ────────────────────────────────────────────────────
const TIME_SLOTS = [
  { id: "morning",   label: "Morning",   emoji: "🌅", range: [5, 12] },
  { id: "afternoon", label: "Afternoon", emoji: "☀️", range: [12, 17] },
  { id: "evening",   label: "Evening",   emoji: "🌆", range: [17, 21] },
  { id: "night",     label: "Night",     emoji: "🌙", range: [21, 24] },
  { id: "anytime",   label: "Anytime",   emoji: "🔄", range: null },
];

function parseHour(timeStr) {
  if (!timeStr) return null;
  const t = timeStr.toLowerCase().trim();
  if (t === "all day" || t === "always" || t === "anytime" || t === "immediate" || t === "evening" || t === "due date") return null;
  const match = t.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (!match) return null;
  let h = parseInt(match[1]);
  const period = match[3];
  if (period === "pm" && h !== 12) h += 12;
  if (period === "am" && h === 12) h = 0;
  if (isNaN(h) || h > 23) return null;
  return h;
}

function getSlotId(timeStr) {
  const h = parseHour(timeStr);
  if (h === null) return "anytime";
  for (const slot of TIME_SLOTS) {
    if (slot.range && h >= slot.range[0] && h < slot.range[1]) return slot.id;
  }
  return "anytime";
}

// Habit's time as total minutes for sorting — handles "HH:MM" (time input)
// and legacy "6:45 AM" style strings; no time sorts last
function habitSortMinutes(habit) {
  const t = habit.time;
  if (!t) return Infinity;
  const hm = t.match(/^(\d{1,2}):(\d{2})$/);
  if (hm) return parseInt(hm[1]) * 60 + parseInt(hm[2]);
  const m = t.toLowerCase().trim().match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (!m) return Infinity;
  let h = parseInt(m[1]);
  const min = m[2] ? parseInt(m[2]) : 0;
  if (m[3] === "pm" && h !== 12) h += 12;
  if (m[3] === "am" && h === 12) h = 0;
  if (isNaN(h) || h > 23) return Infinity;
  return h * 60 + min;
}
const byHabitTime = (a, b) => habitSortMinutes(a) - habitSortMinutes(b);

// ─── ICONS — crisp inline SVG strokes, consistent across devices ──────────────
const IC_PATHS = {
  bolt:   <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>,
  clock:  <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  home:   <><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></>,
  gift:   <><path d="M20 12v10H4V12"/><path d="M2 7h20v5H2z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></>,
  spark:  <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z"/>,
  flame:  <path d="M12 2s5 4.5 5 9.5a5 5 0 0 1-10 0C7 9.5 8 8 9 6.5c.3 1.8 1.2 3 3 3.5-.5-3-.5-5.5 0-8z"/>,
  check:  <path d="M20 6L9 17l-5-5"/>,
  x:      <path d="M18 6L6 18M6 6l12 12"/>,
  dots:   <><circle cx="5" cy="12" r="1.7" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.7" fill="currentColor" stroke="none"/></>,
  vote:   <><path d="M21 9v12H3V9"/><path d="M1 4h22v5H1z"/><path d="M9 4l3-2 3 2"/></>,
  warn:   <><path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/></>,
  pencil: <path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/>,
  trash:  <><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></>,
  play:   <polygon points="7 4 20 12 7 20 7 4"/>,
  skip:   <><polygon points="5 4 15 12 5 20 5 4"/><path d="M19 5v14"/></>,
  rows:   <><path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/></>,
  rail:   <><path d="M7 4v16"/><path d="M11 7h9"/><path d="M11 12h9"/><path d="M11 17h9"/><circle cx="7" cy="7" r="1.6" fill="currentColor" stroke="none"/><circle cx="7" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="7" cy="17" r="1.6" fill="currentColor" stroke="none"/></>,
  star:   <polygon points="12 2.6 15 9 22 9.9 17 14.6 18.3 21.4 12 18.1 5.7 21.4 7 14.6 2 9.9 9 9"/>,
  bulb:   <><path d="M9 18h6"/><path d="M10 22h4"/><path d="M8 14a6 6 0 1 1 8 0c-.8.7-1.3 1.5-1.5 2.5h-5c-.2-1-.7-1.8-1.5-2.5z"/></>,
  mountain: <><path d="M3 20h18L14 6l-3.5 7L8 10z"/></>,
  trend:  <><path d="M3 17l6-6 4 4 8-8"/><path d="M21 7v5h-5"/></>,
};
// `fill` lets an outline glyph render solid — used by the Big 3 star toggle
const Ic = ({ name, size = 13, color = "currentColor", fill = "none", style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color}
    strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true" style={{ flexShrink: 0, ...style }}>
    {IC_PATHS[name]}
  </svg>
);

// ─── RING CHECKBOX — the circle IS the milestone bar ──────────────────────────
// Pending: ring fills with streak/next-milestone progress in the identity color.
// Checked: solid disc with a check. Missed: red-tinted ring with an x.
function HabitRing({ checked, missed, color, streak, next, onClick, label, size = 28 }) {
  const r = (size / 2) - 2;
  const c = 2 * Math.PI * r;
  const pct = next ? Math.min(1, streak / next.days) : (streak > 0 ? 1 : 0);
  const mid = size / 2;
  return (
    <button
      className="habit-toggle"
      onClick={onClick}
      aria-pressed={checked}
      aria-label={label}
      style={{
        width: size, height: size, flexShrink: 0, background: "transparent",
        border: "none", padding: 0, cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        {checked ? (
          <>
            <circle cx={mid} cy={mid} r={r + 1} fill={color} />
            <path d={`M${size*0.3} ${size*0.52}l${size*0.13} ${size*0.13} ${size*0.27} -${size*0.27}`} fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="check-pop" />
          </>
        ) : (
          <>
            <circle cx={mid} cy={mid} r={r} fill="none" stroke={missed ? T.red + "44" : T.surf2} strokeWidth="3" />
            {!missed && pct > 0 && (
              <circle cx={mid} cy={mid} r={r} fill="none" stroke={color} strokeWidth="3"
                strokeDasharray={`${pct * c} ${c}`} strokeLinecap="round"
                transform={`rotate(-90 ${mid} ${mid})`} style={{ transition: "stroke-dasharray 0.4s ease" }} />
            )}
            {missed && (
              <path d={`M${mid-4} ${mid-4}l8 8M${mid+4} ${mid-4}l-8 8`} stroke={T.red} strokeWidth="2.2" strokeLinecap="round" />
            )}
          </>
        )}
      </svg>
    </button>
  );
}

// ─── NOTES JOURNAL — edit today's note + scroll (and edit) past days ───────────
// James Clear's "Reflection & Review", per habit: one scrollable log where any
// day's note is editable. Opened from the card's note link and the ⋯ menu.
function NotesJournalModal({ habit, identity, allData = {}, habitNotes = {}, onSaveNote, onClose }) {
  const todayK = getTodayKey();
  const [editingKey, setEditingKey] = useState(todayK);   // today open for writing by default
  const [draft, setDraft] = useState((habitNotes[todayK] || {})[habit.id] || "");

  // Today is editable; earlier days are a read-only log. Show today plus any past
  // day that has a status or a note, newest first.
  const rows = useMemo(() => {
    const out = [];
    for (let i = 0; i < 366 && out.length < 120; i++) {
      const k = addDaysKey(todayK, -i);
      const st = (allData[k] || {})[habit.id];
      const nt = (habitNotes[k] || {})[habit.id];
      if (i === 0 || st !== undefined || nt) out.push({ k, st, nt });
    }
    return out;
  }, [habit.id, allData, habitNotes, todayK]);

  const editingToday = editingKey === todayK;
  const saveToday = () => { onSaveNote(todayK, draft); setEditingKey(null); };

  return (
    <Modal title={`${habit.label} · notes`} onClose={onClose}>
      <div style={{ padding: "2px 16px 18px", maxHeight: "62vh", overflowY: "auto" }}>
        {rows.map(({ k, st, nt }, idx) => {
          const isToday = k === todayK;
          const dateLabel = new Date(k + "T00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
          const done = st === true, miss = st === "miss";
          const Badge = (
            <span aria-hidden="true" style={{ width: 18, height: 18, borderRadius: "50%", flexShrink: 0, marginTop: 1, display: "flex", alignItems: "center", justifyContent: "center", background: done ? identity.color : miss ? "#D98AA9" : T.surf2 }}>
              {done && <Ic name="check" size={11} color="#fff" />}
              {miss && <Ic name="x" size={10} color="#fff" />}
            </span>
          );
          const heading = <span style={{ fontSize: 12, fontWeight: 800, color: T.text2 }}>{isToday ? "Today · " : ""}{dateLabel}{done ? " · done" : miss ? " · missed" : ""}</span>;

          // Today — editable entry
          if (isToday) {
            return (
              <div key={k} style={{ borderTop: idx === 0 ? "none" : `1px solid ${T.surf2}`, padding: "11px 0" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 7 }}>{Badge}{heading}</div>
                {editingToday ? (
                  <div style={{ paddingLeft: 27 }}>
                    <textarea
                      value={draft}
                      onChange={e => setDraft(e.target.value)}
                      autoFocus
                      maxLength={280}
                      rows={3}
                      placeholder="What did you do today? (for your own review)"
                      style={{ width: "100%", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit", fontSize: 13, color: T.text, background: T.surface, border: `1px solid ${identity.color}`, borderRadius: 9, padding: "8px 10px", lineHeight: 1.45 }}
                    />
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
                      <span style={{ fontSize: 10.5, color: T.muted }}>{draft.length}/280</span>
                      <span style={{ display: "flex", gap: 8 }}>
                        <button type="button" onClick={() => { setDraft((habitNotes[todayK] || {})[habit.id] || ""); setEditingKey(null); }} style={{ fontSize: 12, fontWeight: 700, color: T.muted, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", WebkitTapHighlightColor: "transparent" }}>Cancel</button>
                        <button type="button" onClick={saveToday} style={{ fontSize: 12, fontWeight: 800, color: "#fff", background: identity.color, border: "none", borderRadius: 8, padding: "5px 13px", cursor: "pointer", fontFamily: "inherit", WebkitTapHighlightColor: "transparent" }}>Save</button>
                      </span>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => { setDraft(nt || ""); setEditingKey(todayK); }} aria-label="Add or edit today's note"
                    style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", background: "none", border: "none", padding: "0 0 0 27px", cursor: "pointer", fontFamily: "inherit", WebkitTapHighlightColor: "transparent" }}>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: nt ? T.text : "#534AB7", fontWeight: nt ? 400 : 600, lineHeight: 1.45, wordBreak: "break-word" }}>{nt || "+ add today's note"}</span>
                    <Ic name="pencil" size={14} color={T.muted} />
                  </button>
                )}
              </div>
            );
          }

          // Earlier days — read-only log
          return (
            <div key={k} style={{ display: "flex", gap: 9, padding: "11px 0", borderTop: idx === 0 ? "none" : `1px solid ${T.surf2}` }}>
              {Badge}
              <div style={{ flex: 1, minWidth: 0 }}>
                {heading}
                <div style={{ fontSize: 13, color: nt ? T.text : T.muted, fontStyle: nt ? "normal" : "italic", lineHeight: 1.45, marginTop: 2, wordBreak: "break-word" }}>{nt || "— no note"}</div>
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

// ─── ROW MENU — notes / miss / edit / delete behind one ⋯ button ──────────────
function RowMenu({ habit, identity, missed, onMiss, openEditHabit, openDeleteHabit, onReview, habitNotes = {}, allData = {}, setHabitNote }) {
  const [open, setOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const menuItem = {
    display: "flex", alignItems: "center", gap: 10, width: "100%",
    padding: "13px 8px", background: "transparent", border: "none",
    borderBottom: `1px solid ${T.surf2}`, cursor: "pointer", textAlign: "left",
    fontSize: 14, fontWeight: 600, color: T.text, fontFamily: "inherit",
    WebkitTapHighlightColor: "transparent",
  };
  return (
    <>
      <button
        onClick={e => { e.stopPropagation(); setOpen(true); }}
        aria-label={`Options for ${habit.label}`}
        aria-haspopup="menu"
        style={{ background: "transparent", border: "none", cursor: "pointer", padding: "3px 4px", lineHeight: 1, WebkitTapHighlightColor: "transparent" }}
      >
        <Ic name="dots" size={17} color={missed ? T.red : T.muted} />
      </button>
      {open && (
        <Modal title={habit.label} onClose={() => setOpen(false)}>
          <div style={{ padding: "0 20px 16px" }}>
            <button onClick={() => { setOpen(false); setNotesOpen(true); }} style={menuItem}>
              <Ic name="info" size={15} color={identity.colorDim || T.text2} /> Notes &amp; history
            </button>
            {onReview && (
              <button onClick={() => { setOpen(false); onReview(habit, identity); }} style={menuItem}>
                <Ic name="spark" size={15} color={T.primary} /> Review &amp; adjust
              </button>
            )}
            <button onClick={() => { setOpen(false); onMiss(habit.id); }} style={menuItem}>
              <Ic name="x" size={15} color={T.red} />
              {missed ? "Clear missed" : "Mark as missed"}
            </button>
            <button onClick={() => { setOpen(false); openEditHabit(identity.id, habit); }} style={menuItem}>
              <Ic name="pencil" size={15} color={T.text2} /> Edit habit
            </button>
            <button onClick={() => { setOpen(false); openDeleteHabit(identity.id, habit); }} style={{ ...menuItem, color: T.red, borderBottom: "none" }}>
              <Ic name="trash" size={15} color={T.red} /> Delete habit
            </button>
          </div>
        </Modal>
      )}
      {notesOpen && (
        <NotesJournalModal
          habit={habit}
          identity={identity}
          allData={allData}
          habitNotes={habitNotes}
          onSaveNote={(dateKey, text) => setHabitNote && setHabitNote(dateKey, habit.id, text)}
          onClose={() => setNotesOpen(false)}
        />
      )}
    </>
  );
}

// ─── HABIT ROW ────────────────────────────────────────────────────────────────
// One habit on the timeline: cue → action → coaching (identity header is above).
function HabitRow({ habit, identity, checked, missed, warnMissedYesterday, streak, toggle, onMiss, note = "", allData = {}, habitNotes = {}, setHabitNote, first, showIdentity, hideTime, history, votes = 0, voteTotal = 0 }) {
  const next = getNextMilestone(streak);

  // One cue line above the label: trigger · time · location · frequency.
  // The milestone countdown lives in the micro-bar, not as text.
  const freq = habit.frequency;
  const isEveryDay = freq && freq.cadence === "weekly" && (freq.days || []).length === 7;
  // The habit renders as a full implementation-intention + identity sentence:
  // "I will {habit} at {time} at {location}, so I can become {identity}".
  // Lowercase the first letter unless it's an acronym (starts with two capitals).
  const habitPhrase = /^[A-Z][A-Z]/.test(habit.label || "")
    ? habit.label
    : (habit.label || "").charAt(0).toLowerCase() + (habit.label || "").slice(1);

  // Attractive + Easy collapse behind a "plan" toggle (tap to open).
  const [showDetails, setShowDetails] = useState(false);
  const hasPlan = !!(habit.attractive || habit.easy);

  // Daily reflection note — the footer link opens the scrollable journal.
  const [journalOpen, setJournalOpen] = useState(false);

  // Breaking a bad habit inverts the whole loop (resist, clean days, accountability).
  const breaking = habit.kind === "bad";

  return (
    <div className="habit-card" style={{
      background: checked ? identity.color + "1f" : missed ? T.red + "10" : "transparent",
      borderTop: first ? "none" : `1px solid ${identity.color}22`,
      transition: "background 0.2s ease",
    }}>

      {/* ── Card body — cue, action, coaching (same layout as the Up Next hero) ── */}
      <div style={{ padding: "10px 12px 9px" }}>
        {/* ⏱ time · ✓ ring · intention sentence (place lives in the header banner) */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 11 }}>
          {/* Left part — check-in on top, then time · place · streak, divided from the action */}
          <span style={{ flexShrink:0, display:"flex", flexDirection:"column", alignItems:"center", gap:3,
            ...((habit.time || habit.location) ? { minWidth:46, paddingRight:11, borderRight:`1.5px solid ${T.surf2}` } : {}) }}>
            <HabitRing
              checked={checked}
              missed={missed}
              color={identity.color}
              streak={streak}
              next={next}
              onClick={() => toggle(habit.id, habit.frequency, identity)}
              label={checked ? `Uncheck: ${habit.label}` : (breaking ? `Mark clean: ${habit.label}` : `Check: ${habit.label}`)}
            />
            {habit.time && (
              <span style={{ fontSize:13, fontWeight:900, lineHeight:1.05, color: checked ? T.muted : breaking ? "#B23A6B" : "#2F6FD0", fontVariantNumeric:"tabular-nums" }}>
                {to24h(habit.time)}
              </span>
            )}
            {habit.location && (
              <span style={{ fontSize:9.5, fontWeight:700, lineHeight:1.1, color:T.muted, textAlign:"center", maxWidth:"100%", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                {habit.location}
              </span>
            )}
          </span>
          <span
            onClick={() => toggle(habit.id, habit.frequency, identity)}
            role="button"
            tabIndex={0}
            onKeyDown={e => { if (e.key === "Enter") toggle(habit.id, habit.frequency, identity); }}
            aria-label={checked ? `Uncheck: ${habit.label}` : `Check: ${habit.label}`}
            style={{ flex: 1, minWidth: 0, cursor: "pointer" }}
          >
            <span style={{
              display:"block", wordBreak:"break-word", fontSize:16, lineHeight: 1.45,
              color: checked ? T.text2 : missed ? T.muted : T.text,
              textDecoration: checked ? "line-through" : "none",
              textDecorationColor: identity.color + "88",
            }}>
              {breaking ? "I won't" : "I will"} <span style={{ fontWeight:800, color: breaking ? "#993556" : "inherit" }}>{habitPhrase}</span>, because I am{" "}
              <span style={{
                fontWeight:900, letterSpacing:"-0.01em",
                color: identity.colorDim || identity.color,
                borderBottom: `2px solid ${identity.color}55`,
              }}>{shortLabel(identity.label)}</span>.
            </span>
          </span>
          {/* "Mark as missed" lives in the ⋯ menu, so no ✕ ring on the card face. */}
          {missed && (
            <span style={{
              fontSize:12, fontWeight: 800, color: T.red, flexShrink: 0, whiteSpace: "nowrap",
              background: T.red + "14", padding: "2px 8px", borderRadius: 20,
            }}>
              Missed
            </span>
          )}
        </div>

        {/* Never-miss-twice nudge — this habit was missed yesterday */}
        {warnMissedYesterday && !checked && !missed && (
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 9, marginLeft: 0, fontSize:12, fontWeight: 800, color: "#C0392B" }}>
            <Ic name="warn" size={13} color="#C0392B" /> Missed yesterday — never miss twice!
          </div>
        )}

        {/* Payoff the moment it's checked — reward (build) or a clean day (break) */}
        {checked && (breaking ? (
          <div style={{ marginTop:9, marginLeft:0, minWidth:0 }}>
            <div style={{ display:"flex", alignItems:"center", gap:11, background:"#EAF3DE", border:"1px solid #97C459", borderRadius:12, padding:"11px 13px" }}>
              <Ic name="check" size={22} color="#3B6D11" />
              <span style={{ flex:1, minWidth:0 }}>
                <span style={{ display:"block", fontSize:10.5, fontWeight:700, letterSpacing:"0.04em", textTransform:"uppercase", color:"#639922" }}>{streak} {streak === 1 ? "day" : "days"} clean</span>
                <span style={{ display:"block", fontSize:14.5, fontWeight:600, color:"#173404" }}>You resisted — well done.</span>
              </span>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:9, paddingLeft:2 }}>
              <Ic name="check" size={13} color="#3B6D11" />
              <span style={{ flex:1, minWidth:0, fontSize:12, color:"#3B6D11", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>+1 vote toward <span style={{ fontWeight:700 }}>{shortLabel(identity.label)}</span></span>
            </div>
          </div>
        ) : (
          <div style={{ marginTop:9, marginLeft:0, minWidth:0 }}>
            {habit.satisfying && (
              <div style={{ display:"flex", alignItems:"center", gap:11, background:"#FAEEDA", border:"1px solid #FAC775", borderRadius:12, padding:"11px 13px" }}>
                <Ic name="gift" size={22} color="#854F0B" />
                <span style={{ flex:1, minWidth:0 }}>
                  <span style={{ display:"block", fontSize:10.5, fontWeight:700, letterSpacing:"0.04em", textTransform:"uppercase", color:"#BA7517" }}>Your reward</span>
                  <span style={{ display:"block", fontSize:14.5, fontWeight:600, color:"#633806", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{habit.satisfying}</span>
                </span>
              </div>
            )}
            <div style={{ display:"flex", alignItems:"center", gap:6, marginTop: habit.satisfying ? 9 : 0, paddingLeft:2 }}>
              <Ic name="check" size={13} color="#0F6E56" />
              <span style={{ flex:1, minWidth:0, fontSize:12, color:"#0F6E56", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>+1 vote toward <span style={{ fontWeight:700 }}>{shortLabel(identity.label)}</span></span>
              <span style={{ flexShrink:0, display:"inline-flex", alignItems:"center", gap:3, fontSize:12, fontWeight:700, color:"#854F0B" }}><Ic name="flame" size={12} color="#854F0B" /> {streak}</span>
            </div>
          </div>
        ))}

        {/* Details toggle — a quiet, centered pill (not a heavy full-width bar) */}
        {!checked && !missed && (
          <div style={{ display:"flex", justifyContent:"center", marginTop:2 }}>
            <button type="button" onClick={() => setShowDetails(p => !p)} aria-expanded={showDetails}
              aria-label={showDetails ? "Hide details" : "Show plan and proof"}
              style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"4px 13px", borderRadius:20, border:`1px solid ${showDetails ? T.border2 : T.border}`, background: showDetails ? T.surf2 : "transparent", cursor:"pointer", fontFamily:"inherit", fontSize:11.5, fontWeight:700, letterSpacing:"0.02em", color:T.muted, WebkitTapHighlightColor:"transparent" }}>
              {showDetails ? "Hide details" : "Details"} <span aria-hidden="true">{showDetails ? "▴" : "▾"}</span>
            </button>
          </div>
        )}
      </div>

      {/* ── Details panel — Plan + Your proof + note, revealed by the Details toggle ── */}
      {showDetails && !checked && !missed && Array.isArray(history) && history.length > 0 && (() => {
        const heroColor = breaking ? "#12694E" : identity.color;
        const total = Math.max(voteTotal, votes);          // never show "53 of 50"
        const pct   = total > 0 ? Math.min(100, Math.round((votes / total) * 100)) : 0;
        return (
        <div style={{ background:T.bg, borderTop:`1px solid ${T.surf2}`, padding:"12px 12px 12px" }}
          aria-label={`${votes} of ${total} ${breaking ? "days clean" : "days kept"} toward ${shortLabel(identity.label)}, ${pct} percent${streak > 0 ? `, ${streak} ${breaking ? "days clean streak" : "day streak"}` : ""}`}>
          {(habit.starter || habit.satisfying) && (
            <div style={{ marginBottom:15 }}>
              <div style={{ fontSize:10, fontWeight:800, letterSpacing:"0.05em", textTransform:"uppercase", color:T.muted, marginBottom:7 }}>{breaking ? "Make it hard" : "Make it easy"}</div>
              {habit.starter && (breaking ? (
                <span style={{ display:"inline-flex", alignItems:"center", gap:6, fontSize:12.5, fontWeight:700, color:"#712B13", background:"#FAECE7", border:"1px solid #F5C4B3", borderRadius:20, padding:"6px 13px", maxWidth:"100%" }}>
                  <Ic name="warn" size={13} color="#712B13" />
                  <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>If tempted: {habit.starter}</span>
                </span>
              ) : (
                <button onClick={() => toggle(habit.id, habit.frequency, identity)} aria-label={`Do the two-minute version: ${habit.starter}`}
                  style={{ display:"inline-flex", alignItems:"center", gap:6, fontSize:12.5, fontWeight:700, color:"#085041", background:"#E1F5EE", border:"1px solid #9FE1CB", borderRadius:20, padding:"6px 13px", cursor:"pointer", fontFamily:"inherit", WebkitTapHighlightColor:"transparent", maxWidth:"100%" }}>
                  <Ic name="clock" size={13} color="#085041" />
                  <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>2-min: {habit.starter}</span>
                  <Ic name="check" size={12} color="#085041" />
                </button>
              ))}
              {habit.satisfying && (
                <div style={{ display:"flex", alignItems:"center", gap:6, marginTop: habit.starter ? 8 : 0, fontSize:12, minWidth:0 }}>
                  <Ic name={breaking ? "warn" : "gift"} size={13} color={breaking ? "#B23A6B" : "#BA7517"} />
                  <span style={{ flex:1, minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", color: breaking ? "#8A2F52" : "#8A5A12" }}>
                    <span style={{ fontWeight:800 }}>{breaking ? "If you slip: " : "Reward: "}</span>{habit.satisfying}
                  </span>
                </div>
              )}
            </div>
          )}
          {hasPlan && (
            <div style={{ marginBottom:15 }}>
              <div style={{ fontSize:10, fontWeight:800, letterSpacing:"0.05em", textTransform:"uppercase", color:T.muted, marginBottom:7 }}>{breaking ? "Plan · invert the laws" : "Plan"}</div>
              {habit.attractive && (
                <span style={{ display:"flex", alignItems:"flex-start", gap:7, fontSize:12, color:T.text2, minWidth:0, marginBottom:5 }}>
                  <Ic name="spark" size={13} color="#534AB7" />
                  <span><span style={{ fontWeight:700, color:"#534AB7" }}>{breaking ? "Unattractive: " : "Attractive: "}</span>{habit.attractive}</span>
                </span>
              )}
              {habit.easy && (
                <span style={{ display:"flex", alignItems:"flex-start", gap:7, fontSize:12, color:T.text2, minWidth:0 }}>
                  <Ic name="home" size={13} color="#0F6E56" />
                  <span><span style={{ fontWeight:700, color:"#0F6E56" }}>{breaking ? "Difficult: " : "Easy: "}</span>{habit.easy}</span>
                </span>
              )}
            </div>
          )}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8, marginBottom:8 }}>
            <span aria-hidden="true" style={{ fontSize:10, fontWeight:800, letterSpacing:"0.05em", textTransform:"uppercase", color:T.muted }}>{breaking ? "Clean record" : "Your proof"}</span>
            <span aria-hidden="true" style={{ flexShrink:0, display:"inline-flex", alignItems:"baseline", gap:5, fontSize:11.5, color:T.text2 }}>
              <span><b style={{ color:heroColor, fontWeight:800 }}>{votes}</b>/<b style={{ color:heroColor, fontWeight:800 }}>{total}</b> days{breaking ? " clean" : ""}</span>
              {!checked && streak > 0 && (
                <span style={{ display:"inline-flex", alignItems:"center", gap:2, color: breaking ? "#3B6D11" : "#A9741E" }}>
                  <span style={{ color:T.border2 }}>·</span>
                  <Ic name={breaking ? "check" : "flame"} size={11} color={breaking ? "#3B6D11" : "#C2751A"} />{streak}
                </span>
              )}
            </span>
          </div>
          <div style={{ display:"flex", gap:5 }} aria-hidden="true">
            {history.map((d, i) => {
              const doneColor = breaking ? "#639922" : identity.color;
              const done = d.status === "done";
              const miss = d.status === "miss";
              // Muted slots that aren't trackable this day: before the habit existed
              // (pre → tiny dot) or a day it simply isn't due (off → faint hollow ring).
              if (d.pre || (d.off && d.status === "none")) {
                return (
                  <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                    <span style={{ fontSize:9, fontWeight:700, color:T.border2 }}>{d.letter}</span>
                    <span style={{ width:20, height:20, display:"flex", alignItems:"center", justifyContent:"center" }}>
                      {d.pre
                        ? <span style={{ width:4, height:4, borderRadius:"50%", background:T.border2 }} />
                        : <span style={{ width:10, height:10, borderRadius:"50%", border:`1px solid ${T.border2}`, boxSizing:"border-box" }} />}
                    </span>
                  </div>
                );
              }
              const bg     = done ? doneColor : miss ? "transparent" : (d.today ? doneColor + "1f" : T.surf2);
              const border = done ? "none" : miss ? "1.5px solid #F0997B" : d.today ? `2px solid ${doneColor}` : "1px solid transparent";
              return (
                <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                  <span style={{ fontSize:9, fontWeight:700, color: d.today ? T.text2 : T.muted }}>{d.letter}</span>
                  <span style={{ width:20, height:20, borderRadius:"50%", background:bg, boxSizing:"border-box", border, display:"flex", alignItems:"center", justifyContent:"center" }}>
                    {done && <Ic name="check" size={12} color="#fff" />}
                    {miss && <Ic name="x" size={11} color="#D85A30" />}
                  </span>
                </div>
              );
            })}
          </div>
          {!checked && (
            <div aria-hidden="true" style={{ height:6, borderRadius:5, background:T.surf2, overflow:"hidden", marginTop:8 }}>
              <div style={{ height:"100%", width:`${pct}%`, borderRadius:5, background:heroColor, transition:"width 0.35s ease" }} />
            </div>
          )}

          {/* Daily note — just the link; opens the journal. Note content isn't shown here. */}
          {setHabitNote && (
          <div style={{ marginTop:10 }}>
            <button type="button" onClick={() => setJournalOpen(true)} aria-label={note ? "Open note" : "Add a note for today"}
              style={{ display:"inline-flex", alignItems:"center", gap:6, fontSize:12, fontWeight:600, color: note ? "#534AB7" : T.muted, background:"none", border:"none", padding:0, cursor:"pointer", fontFamily:"inherit", WebkitTapHighlightColor:"transparent" }}>
              <Ic name="pencil" size={12} color="#534AB7" /> {note ? "Note" : "Add note"}
            </button>
          </div>
          )}
        </div>
        );
      })()}

      {journalOpen && setHabitNote && (
        <NotesJournalModal
          habit={habit}
          identity={identity}
          allData={allData}
          habitNotes={habitNotes}
          onSaveNote={(dateKey, text) => setHabitNote(dateKey, habit.id, text)}
          onClose={() => setJournalOpen(false)}
        />
      )}

    </div>
  );
}

// ─── FOCUS MODE — one habit at a time, full screen ────────────────────────────
// A slot's worth of habits as a flow instead of a list: Skip / Done / 2-min.
function FocusMode({ items, toggle, onClose }) {
  const [i, setI] = useState(0);
  const [states, setStates] = useState(() => items.map(() => null)); // 'done' | 'skip'
  const doneCount = states.filter(s => s === "done").length;
  const cur = items[i];
  const advance = (status) => {
    setStates(prev => prev.map((s, idx) => (idx === i ? status : s)));
    setI(n => n + 1);
  };
  const doDone = () => { toggle(cur.habit.id, cur.habit.frequency, cur.identity); advance("done"); };

  return (
    <div role="dialog" aria-label="Focus mode" style={{
      position: "fixed", inset: 0, zIndex: 300, background: T.bg,
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: "calc(env(safe-area-inset-top,0px) + 16px) 20px calc(env(safe-area-inset-bottom,0px) + 24px)",
    }}>
      <div style={{ width: "100%", maxWidth: 430, flex: 1, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize:12, fontWeight:800, letterSpacing:"0.08em", textTransform:"uppercase", color:T.accent }}>Focus</span>
          <button onClick={onClose} aria-label="Close focus mode" style={{ background:T.surf2, border:"none", borderRadius:"50%", width:34, height:34, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", WebkitTapHighlightColor:"transparent" }}>
            <Ic name="x" size={15} color={T.muted} />
          </button>
        </div>

        {cur ? (
          <div style={{ flex:1, display:"flex", flexDirection:"column", justifyContent:"center", textAlign:"center" }}>
            <div style={{ fontSize:12, fontWeight:800, letterSpacing:"0.06em", textTransform:"uppercase", color: cur.identity.colorDim || T.text2 }}>
              <span aria-hidden="true">{cur.identity.icon}</span> {shortLabel(cur.identity.label)} · {i + 1} of {items.length}
            </div>
            <div style={{ fontSize:22, fontWeight:800, color:T.text, lineHeight:1.3, margin:"14px 0 6px" }}>
              {cur.habit.label}
            </div>
            {(cur.habit.trigger || cur.habit.time || cur.habit.location) && (
              <div style={{ display:"inline-flex", alignItems:"center", gap:5, fontSize:13, fontWeight:700, color:cur.identity.colorDim || T.text, background:cur.identity.color+"1f", border:`1px solid ${cur.identity.color}44`, borderRadius:8, padding:"3px 9px", boxSizing:"border-box" }}>
                <Ic name="bolt" size={12} color={cur.identity.colorDim || T.text} style={{ verticalAlign:"-1px" }} /> {[cur.habit.trigger, cur.habit.time && to24h(cur.habit.time), cur.habit.location].filter(Boolean).join(" · ")}
              </div>
            )}
            {cur.habit.attractive && (
              <div style={{ fontSize:13, color:"#534AB7", fontWeight:600, marginTop:5 }}>
                <Ic name="spark" size={13} color="#534AB7" style={{ verticalAlign:"-2px" }} /> {cur.habit.attractive}
              </div>
            )}
            {cur.habit.satisfying && (
              <div style={{ fontSize:13, color:"#854F0B", fontWeight:600, marginTop:5 }}>
                <Ic name="gift" size={13} color="#854F0B" style={{ verticalAlign:"-2px" }} /> then: {cur.habit.satisfying}
              </div>
            )}

            <div style={{ display:"flex", gap:9, justifyContent:"center", flexWrap:"wrap", marginTop:26 }}>
              <button onClick={() => advance("skip")} style={{ display:"inline-flex", alignItems:"center", gap:6, fontSize:13.5, fontWeight:700, color:T.muted, background:T.surf2, border:"none", borderRadius:24, padding:"12px 18px", cursor:"pointer", fontFamily:"inherit", WebkitTapHighlightColor:"transparent" }}>
                <Ic name="skip" size={14} color={T.muted} /> Skip
              </button>
              <button onClick={doDone} style={{ display:"inline-flex", alignItems:"center", gap:8, fontSize:15, fontWeight:800, color:"#fff", background:cur.identity.color, border:"none", borderRadius:24, padding:"12px 24px", cursor:"pointer", fontFamily:"inherit", WebkitTapHighlightColor:"transparent" }}>
                <Ic name="check" size={16} color="#fff" /> Done · +1 vote
              </button>
              {cur.habit.starter && (
                <button onClick={doDone} aria-label={`Two-minute version: ${cur.habit.starter}`} style={{ display:"inline-flex", alignItems:"center", gap:6, fontSize:13.5, fontWeight:700, color:"#085041", background:"#E1F5EE", border:"none", borderRadius:24, padding:"12px 16px", cursor:"pointer", fontFamily:"inherit", WebkitTapHighlightColor:"transparent" }}>
                  <Ic name="clock" size={14} color="#085041" /> 2-min
                </button>
              )}
            </div>
            {cur.habit.starter && (
              <div style={{ fontSize:12.5, color:T.muted, marginTop:12 }}>2-min version: {cur.habit.starter}</div>
            )}
          </div>
        ) : (
          <div style={{ flex:1, display:"flex", flexDirection:"column", justifyContent:"center", alignItems:"center", textAlign:"center", gap:10 }}>
            <div style={{ fontSize:44 }} aria-hidden="true">🎉</div>
            <div style={{ fontSize:19, fontWeight:800, color:T.text }}>{doneCount} vote{doneCount !== 1 ? "s" : ""} cast</div>
            <div style={{ fontSize:14, color:T.muted, lineHeight:1.6 }}>
              {doneCount === items.length ? "Every habit done — the system works." : `${items.length - doneCount} skipped — they'll be waiting on the list.`}
            </div>
            <button onClick={onClose} style={{ ...S.btnPrimary, flex:"none", width:"100%", maxWidth:260, marginTop:12 }}>Back to Today</button>
          </div>
        )}

        {/* Session progress dots */}
        <div style={{ display:"flex", gap:4, justifyContent:"center", flexWrap:"wrap", paddingTop:12 }} aria-label={`${doneCount} of ${items.length} done`}>
          {items.map((it, idx) => (
            <span key={it.habit.id} aria-hidden="true" style={{
              width:16, height:4, borderRadius:99,
              background: states[idx] === "done" ? "#1D9E75"
                : states[idx] === "skip" ? T.border2
                : idx === i ? it.identity.color
                : T.surf2,
            }} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── DAY NAVIGATOR ────────────────────────────────────────────────────────────
function formatNavDate(dateKey) {
  const [y,mo,d] = dateKey.split("-").map(Number);
  const date = new Date(y, mo-1, d);
  const today = getTodayKey();
  if (dateKey === today) return "Today";
  const yest = new Date(); yest.setDate(yest.getDate()-1);
  if (dateKey === dateToKey(yest)) return "Yesterday";
  const tom = new Date(); tom.setDate(tom.getDate()+1);
  if (dateKey === dateToKey(tom)) return "Tomorrow";
  return date.toLocaleDateString(navigator.language||undefined,{weekday:"short",day:"numeric",month:"short"});
}

function DayNavigator({ selectedDate, setSelectedDate, todayKey }) {
  // Recomputed daily (keyed on todayKey) so it stays accurate if the app is kept open overnight
  const minNavDate = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - 90); return dateToKey(d);
  }, [todayKey]);
  const maxNavDate = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() + 30); return dateToKey(d);
  }, [todayKey]);

  const isToday = selectedDate === todayKey;
  const canPrev = selectedDate > minNavDate;
  const canNext = selectedDate < maxNavDate;

  const go = (delta) => {
    const [y,mo,d] = selectedDate.split("-").map(Number);
    const date = new Date(y, mo-1, d);
    date.setDate(date.getDate() + delta);
    const next = dateToKey(date);
    if (next >= minNavDate && next <= maxNavDate) setSelectedDate(next);
  };

  return (
    <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:14 }} role="group" aria-label="Day navigation">
      <button onClick={()=>canPrev&&go(-1)} aria-label="Previous day" aria-disabled={!canPrev} style={{
        width:36, height:36, borderRadius:"50%", border:`1.5px solid ${canPrev?T.border:T.surf2}`,
        background:T.surface, color:canPrev?T.text2:T.border, fontSize:18, lineHeight:1,
        cursor:canPrev?"pointer":"default", display:"flex", alignItems:"center", justifyContent:"center",
        flexShrink:0, WebkitTapHighlightColor:"transparent", opacity: canPrev ? 1 : 0.35, transition:"opacity 0.2s",
      }}><span aria-hidden="true">‹</span></button>

      <div style={{ flex:1, textAlign:"center" }}>
        <div style={{ fontSize:16, fontWeight:700, color:T.text, fontFamily:FONT_DISPLAY }}>
          {formatNavDate(selectedDate)}
        </div>
        {!isToday && (
          <button onClick={()=>setSelectedDate(todayKey)} aria-label="Go to today" style={{
            marginTop:3, fontSize:12, fontWeight:700, color:T.accent,
            background:T.accent+"18", border:`1px solid ${T.accent}44`,
            borderRadius:20, padding:"8px 12px", cursor:"pointer",
            letterSpacing:"0.04em", textTransform:"uppercase",
            WebkitTapHighlightColor:"transparent", minHeight:36, lineHeight:1,
          }}>← Today</button>
        )}
      </div>

      <button onClick={()=>canNext&&go(1)} aria-label="Next day" aria-disabled={!canNext} style={{
        width:36, height:36, borderRadius:"50%", border:`1.5px solid ${canNext?T.border:T.surf2}`,
        background:T.surface, color:canNext?T.text2:T.border, fontSize:18, lineHeight:1,
        cursor:canNext?"pointer":"default", display:"flex", alignItems:"center", justifyContent:"center",
        flexShrink:0, WebkitTapHighlightColor:"transparent",
        opacity: canNext ? 1 : 0.35,
      }}><span aria-hidden="true">›</span></button>
    </div>
  );
}

// ─── DAILY TASKS CARD ─────────────────────────────────────────────────────────
// The Big 3: each day you pick at most three tasks that actually matter.
// The cap is the feature — an uncapped "important" flag drifts back into
// everything-is-important, which is exactly what the old H/M/L system did.
const STAR_LIMIT = 3;
// Every user-facing label derives from the cap, so changing STAR_LIMIT alone
// renames the feature everywhere — no stale "Big N" strings left behind.
const BIG_LABEL  = `Big ${STAR_LIMIT}`;
const STAR_COLOR = T.gold;                       // amber — reserved for the Big 3
const STAR_DARK  = "#633806";                    // readable text on an amber tint
const isStarred  = (t) => t.star === true;
// The Big 3 is a live commitment, not a tally: a finished task leaves it
// entirely. Only open stars count, so completing one vacates its slot and the
// card stops referring to it — the done work lives in the Completed strip.
const countStarred = (list) => list.reduce((n, t) => n + (isStarred(t) && !t.done && !t.carried ? 1 : 0), 0);
// Split a day's open tasks into [big3, rest], each keeping insertion order
const splitByStar = (list) => [list.filter(isStarred), list.filter(t => !isStarred(t))];

// ─── PRIORITY — simple High / Med / Low, sorts the list and tags each row ─────
const PRIORITIES = {
  high: { label:"High", rank:0, ring:"#E24B4A", tagBg:"#FCEBEB", tagText:"#A32D2D", pillBg:"#E24B4A", pillText:"#FFFFFF", pillBorder:"#E24B4A" },
  med:  { label:"Med",  rank:1, ring:"#EF9F27", tagBg:"#FAEEDA", tagText:"#854F0B", pillBg:"#FAEEDA", pillText:"#854F0B", pillBorder:"#FAC775" },
  low:  { label:"Low",  rank:2, ring:"#85B7EB", tagBg:"#E6F1FB", tagText:"#185FA5", pillBg:"#E6F1FB", pillText:"#185FA5", pillBorder:"#B5D4F4" },
};
const PRIORITY_ORDER = ["high", "med", "low"];
// Old data used a `star` flag; treat a star as High and everything else as Med.
const priorityOf = (t) => (t && PRIORITIES[t.priority]) ? t.priority : (t && t.star ? "high" : "med");
const taskRank   = (t) => PRIORITIES[priorityOf(t)].rank;
const byPriority = (a, b) => taskRank(a) - taskRank(b);

// Small colour-coded priority tag; tap to cycle High → Med → Low.
function PriorityTag({ priority, onCycle }) {
  const p = PRIORITIES[priority] || PRIORITIES.med;
  return (
    <button type="button" onClick={onCycle} aria-label={`Priority: ${p.label}. Tap to change.`}
      style={{ flexShrink:0, fontSize:10.5, fontWeight:800, color:p.tagText, background:p.tagBg, border:"none", borderRadius:6, padding:"3px 9px", cursor: onCycle ? "pointer" : "default", fontFamily:"inherit", WebkitTapHighlightColor:"transparent" }}>
      {p.label}
    </button>
  );
}

// ─── STAR TOGGLE — promote a task into the day's Big 3 ────────────────────────
// At the cap the button stays visible but inert, so the tradeoff is legible:
// you can see there's no room left without the control vanishing on you.
function StarButton({ starred, atCap, onToggle, size = 20, label }) {
  const blocked = !starred && atCap;
  return (
    <button
      onClick={blocked ? undefined : onToggle}
      aria-pressed={starred}
      disabled={blocked}
      title={blocked ? `${BIG_LABEL} is full — unstar one first` : starred ? `Remove from ${BIG_LABEL}` : `Add to ${BIG_LABEL}`}
      aria-label={blocked ? `${BIG_LABEL} is full. Unstar another task first.` : starred ? `Remove from ${BIG_LABEL}: ${label}` : `Add to ${BIG_LABEL}: ${label}`}
      style={{
        display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0,
        width:size + 10, height:size + 10, padding:0, borderRadius:8,
        background:"transparent", border:"none",
        cursor: blocked ? "default" : "pointer",
        opacity: blocked ? 0.28 : 1,
        WebkitTapHighlightColor:"transparent", transition:"opacity 0.15s",
      }}
    >
      <Ic name="star" size={size} color={starred ? STAR_COLOR : T.muted} fill={starred ? STAR_COLOR : "none"} />
    </button>
  );
}

// ─── SWIPE ROW — swipe right to complete, left to delete ──────────────────────
function SwipeRow({ onRight, onLeft, radius = 0, children }) {
  const [dx, setDx] = useState(0);
  const start = useRef({ x: 0, y: 0, active: false, horiz: false });
  const THRESHOLD = 72;
  const onStart = e => {
    const t = e.touches[0];
    start.current = { x: t.clientX, y: t.clientY, active: true, horiz: false };
  };
  const onMove = e => {
    if (!start.current.active) return;
    const t = e.touches[0];
    const mx = t.clientX - start.current.x;
    const my = t.clientY - start.current.y;
    if (!start.current.horiz) {
      if (Math.abs(mx) > 8 && Math.abs(mx) > Math.abs(my)) start.current.horiz = true;
      else if (Math.abs(my) > 8) { start.current.active = false; return; }
      else return;
    }
    setDx(Math.max(-120, Math.min(120, mx)));
  };
  const onEnd = () => {
    if (dx > THRESHOLD && onRight) onRight();
    else if (dx < -THRESHOLD && onLeft) onLeft();
    setDx(0);
    start.current.active = false;
  };
  const revealRight = dx > 0; // finger moved right → "Done" shown on the left
  return (
    <div style={{ position: "relative", overflow: "hidden", borderRadius: radius }}>
      <div aria-hidden="true" style={{
        position: "absolute", inset: 0, display: "flex", alignItems: "center",
        justifyContent: revealRight ? "flex-start" : "flex-end", padding: "0 16px",
        background: revealRight ? "#E1F5EE" : "#FEE2E2",
        color: revealRight ? "#0F6E56" : "#A32D2D", fontSize: 13, fontWeight: 800,
        opacity: Math.min(1, Math.abs(dx) / THRESHOLD),
      }}>
        {revealRight ? <span><Ic name="check" size={15} color="#0F6E56" style={{ verticalAlign: "-2px" }} /> Done</span>
                     : <span>Delete <Ic name="trash" size={14} color="#A32D2D" style={{ verticalAlign: "-2px" }} /></span>}
      </div>
      <div
        onTouchStart={onStart}
        onTouchMove={onMove}
        onTouchEnd={onEnd}
        style={{
          transform: `translateX(${dx}px)`,
          transition: dx === 0 ? "transform 0.2s ease" : "none",
          background: T.surface, position: "relative", touchAction: "pan-y",
        }}
      >
        {children}
      </div>
    </div>
  );
}
// Back-compat only — read by migrateStars() to decide which legacy tasks
// become one of the Big 3. Tasks from the Eisenhower-matrix era carry a
// `quadrant` instead of `priority`; anything unrecognized falls back to Medium.
function taskPriority(t) {
  if (t.priority === "H" || t.priority === "M" || t.priority === "L") return t.priority;
  if (t.quadrant === "do") return "H";
  if (t.quadrant === "eliminate") return "L";
  return "M";
}

// ─── QUICK ADD TASK — always-visible one-row composer ─────────────────────────
// Dead-simple add: a roomy full-width field + Add button. New tasks land in the
// backlog unstarred — promoting one into the Big 3 is a deliberate second act.
function QuickAddTask({ dateKey, onAdd }) {
  const [val, setVal] = useState("");
  const [prio, setPrio] = useState("med");
  const inputRef = useRef(null);
  useEffect(() => { setVal(""); }, [dateKey]);
  const add = () => {
    const t = val.trim();
    if (!t) return;
    onAdd(dateKey, t, prio);
    setVal("");
    inputRef.current?.focus();
  };
  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", gap:10, background:T.bg, borderRadius:12, padding:"6px 6px 6px 14px" }}>
        <input
          ref={inputRef}
          value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter")  add();
            if (e.key === "Escape") setVal("");
          }}
          placeholder="Add a task…"
          maxLength={80}
          aria-label="New task text"
          style={{ flex:1, minWidth:0, border:"none", background:"transparent", fontSize:16, color:T.text, outline:"none", fontFamily:"inherit", padding:"7px 0" }}
        />
        <button
          onClick={add}
          aria-label="Add task"
          style={{
            flexShrink:0, width:34, height:34, borderRadius:10, border:"none",
            background: val.trim() ? T.primary : T.border2,
            color:"#fff", fontSize:20, fontWeight:800, lineHeight:1,
            display:"flex", alignItems:"center", justifyContent:"center",
            cursor:"pointer", WebkitTapHighlightColor:"transparent", transition:"background 0.15s",
          }}
        >
          <span aria-hidden="true">+</span>
        </button>
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:7, marginTop:9, paddingLeft:2 }} role="group" aria-label="Priority for the new task">
        <span style={{ fontSize:11.5, color:T.muted }}>Priority</span>
        {PRIORITY_ORDER.map(k => {
          const p = PRIORITIES[k]; const on = prio === k;
          return (
            <button key={k} type="button" onClick={() => setPrio(k)} aria-pressed={on}
              style={{ fontSize:11.5, fontWeight:700, borderRadius:20, padding:"4px 12px", cursor:"pointer", fontFamily:"inherit", WebkitTapHighlightColor:"transparent",
                color: on ? p.pillText : T.text2, background: on ? p.pillBg : "transparent", border:`1px solid ${on ? p.pillBorder : T.border}` }}>
              {p.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Inline input for typing a new task straight into a free Top-3 slot.
function FocusSlotAdd({ index, onAdd, onClose }) {
  const [val, setVal] = useState("");
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, []);
  const add = () => {
    const t = val.trim();
    if (!t) { onClose(); return; }
    onAdd(t);
    setVal("");
    inputRef.current?.focus();
  };
  return (
    <div style={{ display:"flex", alignItems:"center", gap:11, padding:"8px 8px 8px 11px", borderRadius:12, marginBottom:7, background:"#F7FBF9", border:"1.5px solid #9FE1CB" }}>
      <input ref={inputRef} value={val} onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") add(); if (e.key === "Escape") { setVal(""); onClose(); } }}
        onBlur={() => { if (!val.trim()) onClose(); }}
        placeholder="New focus task…" maxLength={80} aria-label="New focus task"
        style={{ flex:1, minWidth:0, border:"none", background:"transparent", fontSize:15, fontWeight:600, color:T.text, outline:"none", fontFamily:"inherit", padding:"5px 0" }} />
      <button onMouseDown={e => e.preventDefault()} onClick={add} aria-label="Add focus task"
        style={{ flexShrink:0, width:30, height:30, borderRadius:9, border:"none", background: val.trim() ? T.primary : T.border2, color:"#fff", fontSize:19, fontWeight:800, lineHeight:1, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", WebkitTapHighlightColor:"transparent" }}>
        <span aria-hidden="true">+</span>
      </button>
    </div>
  );
}

const TopTasksCard = memo(function TopTasksCard({ tasks, dateKey, isToday, onAdd, onToggle, onDelete, onEdit, onStar, onDefer, addBar }) {
  const [editingId,    setEditingId]    = useState(null);
  const [editVal,      setEditVal]      = useState("");
  const [completedOpen, setCompletedOpen] = useState(false);
  const [sheetTask,    setSheetTask]    = useState(null); // task with its action sheet open
  const editRef  = useRef(null);

  // Reset input state when navigating to a different date
  useEffect(() => {
    setEditingId(null);
    setEditVal("");
    setCompletedOpen(false);
    setSheetTask(null);
  }, [dateKey]);

  useEffect(() => {
    if (editingId && editRef.current) editRef.current.focus();
  }, [editingId]);

  const startEdit = (task) => {
    setEditingId(task.id);
    setEditVal(task.text);
  };

  const commitEdit = (taskId) => {
    const t = editVal.trim();
    if (t) onEdit(dateKey, taskId, t);
    setEditingId(null); setEditVal("");
  };

  // Hide tasks that were carried forward to the next day (shown there instead)
  const activeTasks = tasks.filter(t => !t.carried);
  const total   = activeTasks.length;
  const doneCnt = activeTasks.filter(t => t.done).length;
  const allDone = total > 0 && doneCnt === total;
  const starCount = countStarred(activeTasks);   // open stars — done ones left the Big 3
  const openSlots = Math.max(0, STAR_LIMIT - starCount);
  const atCap     = starCount >= STAR_LIMIT;

  return (
    <div>
      {/* Open tasks — the Big 3 pinned on top, everything else below the divider */}
      {(() => {
        const openTasks = activeTasks.filter(t => !t.done);
        if (openTasks.length === 0) {
          return (
            <div style={{ fontSize:14, color:T.muted, fontStyle:"italic", textAlign:"center", padding:"14px 0" }}>
              No open tasks
            </div>
          );
        }
        const sorted = openTasks.slice().sort(byPriority);
        const renderRow = (task, i) => {
          const isEditing = editingId === task.id;
          const pri = priorityOf(task);
          const row = (
                <div style={{ display:"flex", alignItems:"center", gap:11, padding:"9px 2px" }}>
                  {/* Check circle */}
                  <button
                    onClick={() => onToggle(dateKey, task.id)}
                    aria-pressed={task.done}
                    aria-label={task.done ? `Uncheck: ${task.text}` : `Check: ${task.text}`}
                    style={{
                      width:22, height:22, borderRadius:"50%", flexShrink:0, boxSizing:"border-box",
                      border:`2px solid ${PRIORITIES[pri].ring}`, background:"transparent",
                      cursor:"pointer", WebkitTapHighlightColor:"transparent", transition:"all 0.15s",
                    }}
                  />

                  {/* Task text / edit input */}
                  {isEditing ? (
                    <input
                      ref={editRef}
                      value={editVal}
                      onChange={e => setEditVal(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter")  commitEdit(task.id);
                        if (e.key === "Escape") { setEditingId(null); setEditVal(""); }
                      }}
                      onBlur={() => commitEdit(task.id)}
                      maxLength={80}
                      aria-label="Edit task"
                      style={{ flex:1, minWidth:0, border:`1px solid ${T.accent}`, borderRadius:8, padding:"6px 8px", fontSize:16, background:"#fff", color:T.text, outline:"none", fontFamily:"inherit" }}
                    />
                  ) : (
                    <span
                      onClick={() => isToday && setSheetTask(task)}
                      title={isToday ? "Tap for options" : undefined}
                      style={{
                        flex:1, minWidth:0, fontSize:15, lineHeight:1.4, color:T.text,
                        fontWeight: 500,
                        cursor: isToday ? "pointer" : "default",
                      }}
                    >
                      {task.text}
                    </span>
                  )}

                  {/* Priority tag — tap to cycle High → Med → Low */}
                  {isToday && <PriorityTag priority={pri} onCycle={() => onStar(dateKey, task.id)} />}
                </div>
              );
          return (
            <div key={task.id} style={{ borderTop: i === 0 ? "none" : `1px solid ${T.surf2}` }}>
              {isToday && !isEditing
                ? <SwipeRow onRight={() => onToggle(dateKey, task.id)} onLeft={() => onDelete(dateKey, task.id)}>{row}</SwipeRow>
                : row}
            </div>
          );
        };
        return (
          <div style={{ padding:"2px 0", maxHeight:320, overflowY:"auto", WebkitOverflowScrolling:"touch" }}>
            {sorted.map(renderRow)}
          </div>
        );
      })()}

      {/* Add bar — sits between open tasks and the completed strip */}
      {addBar}

      {/* Completed strip — collapsed by default, tap a row to send it back to its quadrant */}
      {(() => {
        const completedTasks = activeTasks.filter(t => t.done);
        if (completedTasks.length === 0) return null;
        return (
          <div style={{ borderTop:`1px solid ${T.surf2}`, padding:"8px 0" }}>
            <button
              onClick={() => setCompletedOpen(o => !o)}
              aria-expanded={completedOpen}
              style={{
                display:"flex", alignItems:"center", gap:8, width:"100%",
                background:T.primary+"0e", border:"none", borderRadius:10, padding:"7px 10px",
                cursor:"pointer", WebkitTapHighlightColor:"transparent",
              }}
            >
              <div aria-hidden="true" style={{ width:18, height:18, borderRadius:"50%", background:T.primary, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
                <span style={{ fontSize:12, color:"#fff", fontWeight:900, lineHeight:1 }}>✓</span>
              </div>
              <span style={{ flex:1, textAlign:"left", fontSize:13, fontWeight:500, color:T.primary }}>
                {completedTasks.length} completed
              </span>
              <span aria-hidden="true" style={{ fontSize:12, color:T.primary, transition:"transform 0.2s", display:"inline-block", transform: completedOpen ? "rotate(180deg)" : "none" }}>▼</span>
            </button>

            {completedOpen && (
              <div style={{ display:"flex", flexDirection:"column", gap:6, padding:"8px 4px 2px" }}>
                {completedTasks.map(task => {
                  return (
                    <button
                      key={task.id}
                      onClick={() => onToggle(dateKey, task.id)}
                      aria-label={`Uncheck: ${task.text}`}
                      style={{
                        display:"flex", alignItems:"center", gap:8, background:"transparent", border:"none",
                        padding:"2px 0", cursor:"pointer", WebkitTapHighlightColor:"transparent", textAlign:"left",
                      }}
                    >
                      {/* No star here — a completed task has left the Big 3 entirely */}
                      <span aria-hidden="true" style={{ width:10, height:10, borderRadius:"50%", background:T.border2, flexShrink:0 }} />
                      <span style={{ fontSize:13, color:T.muted, textDecoration:"line-through", textDecorationColor:T.muted, lineHeight:1.3 }}>
                        {task.text}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* All-done celebration */}
      {allDone && (
        <div style={{ padding:"8px 14px 10px", fontSize:12, color:T.primary, textAlign:"center", fontWeight:600 }}>
          All done — great work! 🎉
        </div>
      )}

      {/* Task action sheet — tap a task to move it, edit it, or delete it */}
      {sheetTask && (
        <Modal title={sheetTask.text} onClose={() => setSheetTask(null)}>
          <div style={{ padding:"4px 20px 20px" }}>
            {/* Priority — set directly */}
            <div style={{ display:"flex", gap:8, marginBottom:12 }} role="group" aria-label="Priority">
              {PRIORITY_ORDER.map(k => {
                const p = PRIORITIES[k]; const on = priorityOf(sheetTask) === k;
                const steps = (PRIORITY_ORDER.indexOf(k) - PRIORITY_ORDER.indexOf(priorityOf(sheetTask)) + 3) % 3;
                return (
                  <button key={k} type="button" aria-pressed={on}
                    onClick={() => { for (let i = 0; i < steps; i++) onStar(dateKey, sheetTask.id); setSheetTask(null); }}
                    style={{ flex:1, padding:"11px 8px", borderRadius:10, fontFamily:"inherit", fontSize:13, fontWeight:700, cursor:"pointer", WebkitTapHighlightColor:"transparent",
                      color: on ? p.pillText : T.text2, background: on ? p.pillBg : T.surf2, border:`1.5px solid ${on ? p.pillBorder : "transparent"}` }}>
                    {p.label}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => { onDefer(dateKey, sheetTask.id); setSheetTask(null); }}
              style={{
                display:"flex", alignItems:"center", justifyContent:"center", gap:8, width:"100%",
                padding:"12px 10px", background:T.surf2, border:"none", borderRadius:10,
                cursor:"pointer", marginBottom:16, fontSize:14, fontWeight:700, color:T.text2,
                fontFamily:"inherit", WebkitTapHighlightColor:"transparent",
              }}
            >
              <span aria-hidden="true">⏭</span> Move to tomorrow
            </button>
            <div style={{ display:"flex", gap:8, borderTop:`1px solid ${T.surf2}`, paddingTop:14 }}>
              <button
                onClick={() => { startEdit(sheetTask); setSheetTask(null); }}
                style={{ flex:1, background:T.primary+"12", border:"none", borderRadius:10, color:T.primary, fontSize:14, fontWeight:700, cursor:"pointer", padding:"12px 10px", fontFamily:"inherit", WebkitTapHighlightColor:"transparent" }}
              >
                Edit text
              </button>
              <button
                onClick={() => { onDelete(dateKey, sheetTask.id); setSheetTask(null); }}
                style={{ flex:1, background:T.red+"12", border:"none", borderRadius:10, color:T.red, fontSize:14, fontWeight:700, cursor:"pointer", padding:"12px 10px", fontFamily:"inherit", WebkitTapHighlightColor:"transparent" }}
              >
                Delete
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
});

// ─── HABIT REVIEW — week strip ────────────────────────────────────────────────
function ReviewWeekStrip({ days }) {
  const recent = days.slice(-7);
  return (
    <div style={{ display:"flex", gap:5, marginBottom:10 }} aria-label={`${recent.filter(d=>d.kept).length} of ${recent.length} kept`}>
      {recent.map(d => (
        <div key={d.key} style={{ flex:1, textAlign:"center" }}>
          <div style={{
            height:22, borderRadius:6, display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:11, fontWeight:700, lineHeight:1,
            background: d.kept ? "#E1F5EE" : T.red + "12",
            border: `1px solid ${d.kept ? "#0F6E5644" : T.red + "33"}`,
            color: d.kept ? "#0F6E56" : T.red,
          }}>{d.kept ? "✓" : "×"}</div>
          <div style={{ fontSize:9.5, color:T.muted, marginTop:2 }}>{DAY_LABELS[d.dow]}</div>
        </div>
      ))}
    </div>
  );
}

// ─── HABIT REVIEW — the flow ──────────────────────────────────────────────────
// Steps: ask → diagnose → fix → done, with "unusual week" and the stuck/retire
// branch hanging off diagnose. Follow-ups enter at their own step.
const HabitReview = memo(function HabitReview({ target, onApply, onSnooze, onFollowUp, onArchive, onClose }) {
  const { habit, identity, stats, pattern, followUp, mode } = target;
  const [step, setStep]   = useState(mode === "followup" ? "followup" : "ask");
  const [dxId, setDxId]   = useState(null);
  const [value, setValue] = useState("");
  const [note, setNote]   = useState("");
  const [busy, setBusy]   = useState(false);
  const stuck = failedFixCount(habit) >= REVIEW_STUCK_AT;
  const dx = dxId ? diagnosisById(dxId) : null;

  // Pattern-matched diagnosis floats to the top — the data usually knows
  // better than a week-old memory does.
  const ordered = useMemo(() => {
    if (!pattern) return DIAGNOSES;
    const hit = DIAGNOSES.find(d => d.id === pattern.kind);
    return hit ? [hit, ...DIAGNOSES.filter(d => d !== hit)] : DIAGNOSES;
  }, [pattern]);

  const loadSuggestion = useCallback(async (diag) => {
    setBusy(true); setNote("");
    const ai = await fetchFieldSuggestion(habit, identity.label, diag.field);
    setValue(ai ? ai.value : diag.fallback(habit));
    setNote(ai ? ai.note : "");
    setBusy(false);
  }, [habit, identity.label]);

  const chooseDx = (diag) => {
    setDxId(diag.id);
    setStep("fix");
    if (diag.id !== "schedule") loadSuggestion(diag);
  };

  const applyFix = () => {
    if (dx.id === "schedule") {
      onApply(habit.id, identity.id, {
        dx: dx.id, field: "frequency",
        from: getFreqLabel(habit.frequency),
        to: getFreqLabel({ cadence:"weekly", days: pattern.days }),
        frequency: { cadence:"weekly", days: pattern.days },
        baseRate: stats.rate,
      });
    } else {
      const v = value.trim();
      if (!v) return;
      onApply(habit.id, identity.id, {
        dx: dx.id, field: dx.field, from: habit[dx.field] || "", to: v, baseRate: stats.rate,
      });
    }
    setStep("done");
  };

  const head = (
    <div style={{ display:"flex", alignItems:"center", gap:9, marginBottom:12 }}>
      <span style={{ width:30, height:30, borderRadius:"50%", background:identity.color+"22", display:"flex", alignItems:"center", justifyContent:"center", fontSize:15, flexShrink:0 }} aria-hidden="true">{identity.icon}</span>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:15, fontWeight:700, color:T.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{habit.label}</div>
        <div style={{ fontSize:11.5, color:T.muted }}>{shortLabel(identity.label)}</div>
      </div>
      <span style={{ fontSize:11, fontWeight:700, color:T.muted, background:T.surf2, borderRadius:20, padding:"2px 8px", flexShrink:0 }}>
        {stats.kept} of {stats.due}
      </span>
    </div>
  );

  const primaryBtn = { width:"100%", background:T.primary, color:"#fff", border:"none", borderRadius:9, padding:"11px", fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:"inherit", WebkitTapHighlightColor:"transparent" };
  const ghostBtn   = { flex:1, background:"transparent", border:`1px solid ${T.border}`, borderRadius:9, padding:"11px", fontSize:13.5, color:T.text, cursor:"pointer", fontFamily:"inherit", WebkitTapHighlightColor:"transparent" };

  return (
    <Modal title="Habit review" onClose={onClose}>
      <div style={{ padding:"4px 20px 20px" }}>
        {head}

        {step === "ask" && (
          <>
            <ReviewWeekStrip days={stats.days} />
            <div style={{ border:`1px solid ${T.border}`, borderRadius:12, padding:"12px" }}>
              <div style={{ fontSize:13.5, color:T.text, lineHeight:1.55, marginBottom:4 }}>
                You kept this {stats.kept} of {stats.due} scheduled days.
              </div>
              <div style={{ fontSize:12.5, color:T.muted, lineHeight:1.5, marginBottom:12 }}>
                Want to adjust how it's set up?
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={() => setStep(stuck ? "stuck" : "diagnose")} style={{ ...primaryBtn, flex:1 }}>Adjust it</button>
                <button onClick={onClose} style={{ background:"transparent", border:"none", color:T.muted, fontSize:13.5, padding:"11px 12px", cursor:"pointer", fontFamily:"inherit" }}>Not now</button>
              </div>
            </div>
          </>
        )}

        {step === "stuck" && (
          <>
            <div style={{ border:`1px solid ${T.border}`, borderRadius:12, padding:"11px 12px", marginBottom:12 }}>
              <div style={{ fontSize:11.5, fontWeight:800, color:T.muted, textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:8 }}>Already tried</div>
              {reviewLog(habit).filter(r => r.field && r.worked === false).map((r, i) => (
                <div key={i} style={{ display:"flex", alignItems:"center", gap:7, padding:"3px 0" }}>
                  <Ic name="x" size={13} color={T.red} />
                  <span style={{ fontSize:12.5, color:T.muted }}>
                    {diagnosisById(r.dx)?.fieldLabel || r.field} — {daysBetweenKeys(r.at, getTodayKey())} days ago
                  </span>
                </div>
              ))}
            </div>
            <div style={{ fontSize:13.5, color:T.text, lineHeight:1.55, marginBottom:14 }}>
              Two changes haven't moved this. It may be the wrong habit for this season rather than the wrong design.
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              <button onClick={() => setStep("diagnose")} style={primaryBtn}>Try a different angle</button>
              <button onClick={() => { onSnooze(habit.id, identity.id, 30); onClose(); }} style={{ ...ghostBtn, flex:"none" }}>Pause for a month</button>
              <button onClick={() => { onArchive(habit.id, identity.id); onClose(); }} style={{ background:"transparent", border:"none", color:T.red, fontSize:13, padding:"8px", cursor:"pointer", fontFamily:"inherit" }}>Archive this habit</button>
            </div>
          </>
        )}

        {step === "diagnose" && (
          <>
            <ReviewWeekStrip days={stats.days} />
            {pattern && (
              <div style={{ background:T.primary+"0d", border:`1px solid ${T.primary}33`, borderRadius:11, padding:"9px 10px", marginBottom:12, display:"flex", gap:8 }}>
                <Ic name="rows" size={15} color={T.primary} />
                <span style={{ fontSize:12.5, color:T.text, lineHeight:1.5 }}>{pattern.text}</span>
              </div>
            )}
            <div style={{ fontSize:14, fontWeight:700, color:T.text, marginBottom:11 }}>
              On the days you missed it, what happened?
            </div>
            {ordered.map((d, i) => {
              const hinted = pattern && d.id === pattern.kind;
              return (
                <button key={d.id} onClick={() => chooseDx(d)} style={{
                  display:"flex", alignItems:"center", gap:10, width:"100%", textAlign:"left",
                  background:"transparent", border:`1px solid ${hinted ? T.primary+"55" : T.surf2}`,
                  borderRadius:11, padding:"10px 11px", marginBottom:7, cursor:"pointer",
                  fontFamily:"inherit", WebkitTapHighlightColor:"transparent",
                }}>
                  <Ic name={d.icon} size={17} color={hinted ? T.primary : T.muted} />
                  <span style={{ flex:1, minWidth:0 }}>
                    <span style={{ display:"block", fontSize:13.5, color:T.text }}>{d.text}</span>
                    {hinted && <span style={{ display:"block", fontSize:10.5, color:T.primary, marginTop:2 }}>matches your pattern</span>}
                  </span>
                </button>
              );
            })}
            <button onClick={() => { onSnooze(habit.id, identity.id, REVIEW_SNOOZE); setStep("snoozed"); }} style={{
              display:"flex", alignItems:"center", gap:10, width:"100%", textAlign:"left",
              background:"#0F6E560d", border:"1px dashed #0F6E5655", borderRadius:11,
              padding:"10px 11px", marginTop:3, cursor:"pointer", fontFamily:"inherit",
            }}>
              <Ic name="check" size={17} color="#0F6E56" />
              <span style={{ flex:1, fontSize:13.5, color:"#0F6E56" }}>Nothing — just an unusual week</span>
            </button>
          </>
        )}

        {step === "fix" && dx && (
          <>
            <div style={{ marginBottom:10 }}>
              <span style={{ fontSize:10.5, fontWeight:800, letterSpacing:"0.06em", textTransform:"uppercase", color:"#633806", background:T.gold+"22", borderRadius:20, padding:"2px 8px" }}>{dx.law}</span>
            </div>
            <div style={{ fontSize:13, color:T.text, lineHeight:1.55, marginBottom:13 }}>{dx.why}</div>
            <div style={{ fontSize:11.5, fontWeight:800, color:T.muted, textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:6 }}>{dx.fieldLabel}</div>

            {dx.id === "schedule" ? (
              pattern ? (
                <>
                  <div style={{ fontSize:13, color:T.muted, textDecoration:"line-through", marginBottom:6 }}>{getFreqLabel(habit.frequency)}</div>
                  <div style={{ border:`1px solid ${T.gold}88`, borderRadius:10, padding:"10px 11px", fontSize:14, color:T.text, fontWeight:700 }}>
                    {getFreqLabel({ cadence:"weekly", days: pattern.days })}
                  </div>
                  <div style={{ fontSize:11.5, color:T.muted, margin:"7px 0 13px", lineHeight:1.5 }}>
                    Trimmed to the days you actually kept it. Three good days beat seven broken ones.
                  </div>
                  <button onClick={applyFix} style={primaryBtn}>Save change</button>
                </>
              ) : (
                <div style={{ fontSize:13, color:T.muted, lineHeight:1.55, padding:"8px 0" }}>
                  No clear day pattern yet — edit the schedule from the habit menu.
                </div>
              )
            ) : (
              <>
                {habit[dx.field]
                  ? <div style={{ fontSize:13, color:T.muted, textDecoration:"line-through", marginBottom:6 }}>“{habit[dx.field]}”</div>
                  : <div style={{ fontSize:12.5, color:T.muted, fontStyle:"italic", marginBottom:6 }}>Nothing set yet</div>}
                {busy ? (
                  <div style={{ border:`1px solid ${T.surf2}`, borderRadius:10, padding:"16px", textAlign:"center", fontSize:12.5, color:T.muted }}>
                    Asking for a suggestion…
                  </div>
                ) : (
                  <textarea
                    value={value}
                    onChange={e => setValue(e.target.value)}
                    rows={2}
                    maxLength={200}
                    aria-label={`${dx.fieldLabel} — suggested wording`}
                    style={{ width:"100%", boxSizing:"border-box", fontSize:15, fontFamily:"inherit", color:T.text, border:`1px solid ${T.gold}88`, borderRadius:10, padding:"9px 10px", resize:"none", outline:"none", background:"#fff" }}
                  />
                )}
                <div style={{ display:"flex", alignItems:"flex-start", gap:6, margin:"7px 0 13px" }}>
                  <Ic name="spark" size={13} color="#633806" style={{ marginTop:2 }} />
                  <span style={{ fontSize:11.5, color:T.muted, lineHeight:1.5 }}>
                    {note || "Suggested wording — edit it to fit your day."}{" "}
                    <button onClick={() => loadSuggestion(dx)} disabled={busy} style={{ border:"none", background:"transparent", color:T.primary, fontSize:11.5, padding:0, cursor:"pointer", textDecoration:"underline", fontFamily:"inherit" }}>try another</button>
                  </span>
                </div>
                <button onClick={applyFix} disabled={busy || !value.trim()} style={{ ...primaryBtn, opacity: busy || !value.trim() ? 0.5 : 1 }}>Save change</button>
              </>
            )}
          </>
        )}

        {step === "snoozed" && (
          <>
            <div style={{ background:"#E1F5EE", borderRadius:12, padding:"12px" }}>
              <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:6 }}>
                <Ic name="check" size={14} color="#0F6E56" />
                <span style={{ fontSize:12.5, fontWeight:700, color:"#0F6E56" }}>Left as it is</span>
              </div>
              <div style={{ fontSize:13, color:T.text, lineHeight:1.55 }}>
                Nothing changed. We won't ask about this habit again for two weeks.
              </div>
            </div>
            <button onClick={onClose} style={{ ...primaryBtn, marginTop:13 }}>Done</button>
          </>
        )}

        {step === "done" && dx && (
          <>
            <div style={{ background:"#E1F5EE", borderRadius:12, padding:"12px", marginBottom:12 }}>
              <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:8 }}>
                <Ic name="check" size={14} color="#0F6E56" />
                <span style={{ fontSize:12.5, fontWeight:700, color:"#0F6E56" }}>{dx.fieldLabel} updated</span>
              </div>
              {(dx.id === "schedule" ? getFreqLabel(habit.frequency) : habit[dx.field]) && (
                <div style={{ fontSize:12.5, color:T.muted, textDecoration:"line-through", marginBottom:4 }}>
                  “{dx.id === "schedule" ? getFreqLabel(habit.frequency) : habit[dx.field]}”
                </div>
              )}
              <div style={{ fontSize:13.5, color:T.text, fontWeight:700 }}>
                “{dx.id === "schedule" ? getFreqLabel({ cadence:"weekly", days: pattern.days }) : value.trim()}”
              </div>
            </div>
            <div style={{ border:`1px dashed ${T.surf2}`, borderRadius:11, padding:"10px 11px", marginBottom:13, fontSize:11.5, color:T.muted, lineHeight:1.55 }}>
              Streak and history untouched. We'll check in two weeks to see whether it helped.
            </div>
            <button onClick={onClose} style={primaryBtn}>Done</button>
          </>
        )}

        {step === "followup" && followUp && (() => {
          const improved = stats.rate > (followUp.baseRate ?? 0) + 0.15;
          const then = Math.round((followUp.baseRate ?? 0) * 100);
          return (
            <>
              <ReviewWeekStrip days={stats.days} />
              <div style={{ background: improved ? "#E1F5EE" : T.surf2, borderRadius:12, padding:"12px", marginBottom:12 }}>
                <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:7 }}>
                  <Ic name={improved ? "trend" : "rows"} size={15} color={improved ? "#0F6E56" : T.text2} />
                  <span style={{ fontSize:12.5, fontWeight:700, color: improved ? "#0F6E56" : T.text2 }}>
                    {improved ? "That worked" : "Still not sticking"}
                  </span>
                </div>
                <div style={{ fontSize:13, color:T.text, lineHeight:1.55 }}>
                  You changed the {diagnosisById(followUp.dx)?.fieldLabel.toLowerCase() || "habit"} to “{followUp.to}” two weeks ago.
                  {" "}From {then}% to {Math.round(stats.rate * 100)}%.
                </div>
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={() => { onFollowUp(habit.id, identity.id, followUp.at, improved); onClose(); }} style={ghostBtn}>
                  {improved ? "Leave it" : "Not now"}
                </button>
                <button onClick={() => { onFollowUp(habit.id, identity.id, followUp.at, improved); improved ? onClose() : setStep("diagnose"); }} style={{ ...primaryBtn, flex:1, width:"auto" }}>
                  {improved ? "Raise it" : "Try something else"}
                </button>
              </div>
            </>
          );
        })()}
      </div>
    </Modal>
  );
});

// ─── TODAY VIEW ───────────────────────────────────────────────────────────────
const TodayView = memo(function TodayView({ identities, allHabits, todayData, allData, toggle, markMiss, habitNotes, setHabitNote, justChecked, getStreakForHabit, openEditHabit, openDeleteHabit, openReviewFor, setModal, openAddHabit, openAddIdentity, selectedDate, setSelectedDate, todayKey, dailyTasks, addTask, addFocusTask, toggleTask, deleteTask, editTask, toggleStar, toggleFocus, deferTask, reviewTarget, onOpenReview, onDismissReview }) {
  const [notTodayExpanded, setNotTodayExpanded] = useState(false);
  const notTodayListId = useId();
  const [matrixExpanded, setMatrixExpanded] = useState(false);
  const [laterOpen, setLaterOpen] = useState(false);
  const [doneOpen, setDoneOpen] = useState(false); // Completed section — collapsed by default
  const [focusAdding, setFocusAdding] = useState(false); // inline "add to a free Top-3 slot" input

  // Focus mode — snapshot of pending habits taken when the session starts
  const [focusItems, setFocusItems] = useState(null);
  const startFocus = () => {
    const pending = scheduledHabits.filter(({ habit }) => todayData[habit.id] == null);
    if (pending.length > 0) setFocusItems(pending);
  };

  // Build enriched habit list with identity ref, time slot, and sort key
  // (habitSortMinutes handles HH:MM and legacy am/pm formats, minutes included)
  const enrichedHabits  = useMemo(() =>
    identities.flatMap(identity =>
      identity.habits.map(habit => (
        { habit, identity, slotId: getSlotId(habit.time), sortMinutes: habitSortMinutes(habit) }
      ))
    ), [identities]);

  const [scheduledHabits, notTodayHabits] = useMemo(() => {
    // A habit only exists from its start date on — never show it on earlier days.
    const existing = enrichedHabits.filter(({habit}) => {
      const sKey = habitStartKey(habit, allData);
      return !sKey || selectedDate >= sKey;
    });
    const scheduled = existing
      .filter(({habit}) => isScheduledOn(habit.frequency, selectedDate))
      .sort((a, b) => a.sortMinutes - b.sortMinutes); // earliest time first; no-time habits (Infinity) go last
    const notToday  = existing.filter(({habit}) => !isScheduledOn(habit.frequency, selectedDate));
    return [scheduled, notToday];
  }, [enrichedHabits, selectedDate, allData]);

  const quote = useMemo(() => getDailyQuote(), []);

  // Habits scheduled both today and yesterday that were NOT done yesterday —
  // fuels the "never miss twice" warning (Atomic Habits rule)
  const missedYesterdayIds = useMemo(() => {
    const [y, mo, d] = selectedDate.split("-").map(Number);
    const dt = new Date(y, mo - 1, d); dt.setDate(dt.getDate() - 1);
    const yKey = dateToKey(dt);
    const yd = allData[yKey] || {};
    const ids = new Set();
    for (const { habit } of scheduledHabits) {
      const sKey = habitStartKey(habit, allData);
      if (isScheduledOn(habit.frequency, yKey) && yd[habit.id] !== true && (!sKey || yKey >= sKey)) ids.add(habit.id);
    }
    return ids;
  }, [allData, selectedDate, scheduledHabits]);
  const missedWarnCount = useMemo(() =>
    selectedDate === todayKey
      ? scheduledHabits.filter(({ habit }) => missedYesterdayIds.has(habit.id) && todayData[habit.id] == null).length
      : 0,
    [selectedDate, todayKey, scheduledHabits, missedYesterdayIds, todayData]);

  // The Focus card's pill shows the live Big 3 commitment — open stars only.
  // Completed work has left the Big 3 and is counted nowhere here.
  const taskCounts = useMemo(() => {
    const active = (dailyTasks[selectedDate] || []).filter(t => !t.carried);
    return {
      total: active.length,
      done:  active.filter(t => t.done).length,
    };
  }, [dailyTasks, selectedDate]);

  // ── Empty state — no identities yet ──
  if (identities.length === 0) {
    return (
      <div style={{...S.content, alignItems:"center", paddingTop:40, textAlign:"center"}}>
        <DayNavigator selectedDate={selectedDate} setSelectedDate={setSelectedDate} todayKey={todayKey}/>
        <div style={{fontSize:52,marginBottom:16}} aria-hidden="true">🌱</div>
        <div style={{fontSize:20,fontWeight:700,color:T.text,marginBottom:8}}>Start building your identity</div>
        <div style={{fontSize:15,color:T.muted,lineHeight:1.7,maxWidth:280,marginBottom:28}}>
          Create your first identity — who do you want to become? Then add habits that reinforce it.
        </div>
        <button onClick={openAddIdentity} style={{...S.btnPrimary, width:"100%", maxWidth:280}}>
          + Create First Identity
        </button>
        <div style={{...S.footer, width:"100%", marginTop:40}}>
          <span style={S.footerQuote}>"Every action is a vote for the type of person you wish to become."</span>
          <span style={S.footerAuthor}>— James Clear, Atomic Habits</span>
        </div>
      </div>
    );
  }

  return (
    <div style={S.content}>
      {/* Day Navigator */}
      <DayNavigator selectedDate={selectedDate} setSelectedDate={setSelectedDate} todayKey={todayKey} />

      {/* Today's Focus — compact task preview, expands into the full task list */}
      <div style={{ ...S.card, padding:"12px 14px" }}>
        <div style={{ position:"relative", display:"flex", alignItems:"center", justifyContent: matrixExpanded ? "flex-start" : "center", gap:8, marginBottom:10, minHeight:23 }}>
          <span style={{ fontSize:12, color:T.muted, letterSpacing:"0.1em", fontWeight:700, textTransform:"uppercase" }}>
            <span aria-hidden="true">🎯</span> Today's Focus
          </span>
          {taskCounts.total > 0 && (
            <span
              aria-label={`${taskCounts.done} of ${taskCounts.total} tasks done`}
              style={{
                fontSize:12, fontWeight:800, color:T.primary, background:T.primary + "18",
                borderRadius:20, padding:"2px 9px", lineHeight:1.4, fontVariantNumeric:"tabular-nums",
                ...(matrixExpanded ? {} : { position:"absolute", right:0 }),
              }}
            >
              {taskCounts.done}/{taskCounts.total} done
            </span>
          )}
          {matrixExpanded && (
            <button onClick={() => setMatrixExpanded(false)} style={{
              marginLeft:"auto", background:"transparent", border:"none", cursor:"pointer",
              fontSize:12, fontWeight:700, color:T.primary, padding:0, WebkitTapHighlightColor:"transparent",
            }}>
              Collapse <span aria-hidden="true">▲</span>
            </button>
          )}
        </div>

        {matrixExpanded ? (
          <TopTasksCard
            tasks={dailyTasks[selectedDate] || []}
            dateKey={selectedDate}
            isToday={selectedDate >= todayKey}
            onAdd={addTask}
            onToggle={toggleTask}
            onDelete={deleteTask}
            onEdit={editTask}
            onStar={toggleStar}
            onDefer={deferTask}
            addBar={selectedDate >= todayKey ? (
              <div style={{ borderTop:`1px solid ${T.surf2}`, marginTop:10, paddingTop:10 }}>
                <QuickAddTask dateKey={selectedDate} onAdd={addTask} />
              </div>
            ) : null}
          />
        ) : (() => {
          const dayTasks   = (dailyTasks[selectedDate] || []).filter(t => !t.carried);
          const editable   = selectedDate >= todayKey;
          const focusTasks = dayTasks.filter(t => t.focus && !t.done).slice().sort((a, b) => (a.focusAt || 0) - (b.focusAt || 0)).slice(0, 3); // selection order; completed ones drop to the Completed strip
          const laterTasks = dayTasks.filter(t => !t.focus && !t.done).slice().sort(byPriority);
          const doneTasks  = dayTasks.filter(t => t.done);
          if (dayTasks.length === 0) {
            return (
              <div style={{ fontSize:13, color:T.muted, textAlign:"center", padding:"6px 0" }}>
                Nothing here —{" "}
                <button onClick={() => setMatrixExpanded(true)} style={{ background:"none", border:"none", color:T.primary, fontWeight:700, cursor:"pointer", padding:0, fontSize:13, WebkitTapHighlightColor:"transparent" }}>add a task</button>
              </div>
            );
          }
          return (
            <>
              {/* Focus slots (chosen tasks) */}
              {focusTasks.map((t, i) => (
                <div key={t.id} style={{ display:"flex", alignItems:"center", gap:11, padding:"10px 11px", borderRadius:12, marginBottom:7, background:"#F7FBF9", border:"1px solid #E6F0EA" }}>
                  <button onClick={() => toggleTask(selectedDate, t.id)} aria-label={`Complete: ${t.text}`}
                    style={{ width:22, height:22, borderRadius:"50%", flexShrink:0, boxSizing:"border-box", border:`2px solid ${T.primary}`, background: t.done ? T.primary : "transparent", cursor:"pointer", padding:0, display:"flex", alignItems:"center", justifyContent:"center", WebkitTapHighlightColor:"transparent" }}>
                    {t.done && <Ic name="check" size={12} color="#fff" />}
                  </button>
                  <span style={{ flex:1, minWidth:0, fontSize:15, fontWeight:600, lineHeight:1.35, color: t.done ? T.muted : T.text, textDecoration: t.done ? "line-through" : "none", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{t.text}</span>
                  {editable && (
                    <button onClick={() => toggleFocus(selectedDate, t.id)} aria-label="Remove from Top 3" title="Remove from Top 3"
                      style={{ background:"none", border:"none", cursor:"pointer", padding:0, flexShrink:0, WebkitTapHighlightColor:"transparent" }}>
                      <Ic name="star" size={15} color={T.gold} />
                    </button>
                  )}
                </div>
              ))}
              {editable && focusTasks.length < 3 && (
                focusAdding ? (
                  <FocusSlotAdd index={focusTasks.length}
                    onAdd={text => addFocusTask(selectedDate, text)}
                    onClose={() => setFocusAdding(false)} />
                ) : (
                  <button onClick={() => setFocusAdding(true)}
                    style={{ display:"flex", alignItems:"center", gap:11, width:"100%", padding:"10px 11px", borderRadius:12, marginBottom:7, background:"transparent", border:"1.5px dashed #CFE3D9", cursor:"pointer", fontFamily:"inherit", WebkitTapHighlightColor:"transparent" }}>
                    <span aria-hidden="true" style={{ width:22, height:22, borderRadius:"50%", border:"1.5px dashed #9FE1CB", color:"#3d9c7c", display:"flex", alignItems:"center", justifyContent:"center", fontSize:15, flexShrink:0 }}>+</span>
                    <span style={{ flex:1, textAlign:"left", fontSize:14, fontWeight:600, color:"#3d9c7c" }}>{focusTasks.length === 0 ? "Pick your Top 3 focus tasks" : "Add a focus task"}</span>
                  </button>
                )
              )}
              {editable && focusTasks.length < 3 && laterTasks.length > 0 && !focusAdding && (
                <div style={{ fontSize:11.5, color:T.muted, textAlign:"center", marginTop:-2, marginBottom:7 }}>or ★ a task from Later below</div>
              )}

              {/* Later bucket */}
              {laterTasks.length > 0 && (
                <>
                  <button onClick={() => setLaterOpen(o => !o)} aria-expanded={laterOpen}
                    style={{ display:"flex", alignItems:"center", gap:8, width:"100%", background:"#F4F1EB", border:"none", borderRadius:11, padding:"9px 12px", marginTop:4, cursor:"pointer", fontFamily:"inherit", fontSize:12.5, fontWeight:700, color:T.text2, WebkitTapHighlightColor:"transparent" }}>
                    <Ic name="dots" size={13} color={T.muted} /> Later
                    <span style={{ background:"#e5e0d7", borderRadius:20, padding:"1px 8px", fontSize:11 }}>{laterTasks.length}</span>
                    <span style={{ marginLeft:"auto", color:T.muted }}>{laterOpen ? "▴" : "▾"}</span>
                  </button>
                  {laterOpen && laterTasks.map((t, i) => {
                    const pri = priorityOf(t);
                    const canPromote = focusTasks.length < 3;
                    return (
                      <div key={t.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 4px", borderTop: i === 0 ? "none" : `1px solid ${T.surf2}` }}>
                        <button onClick={() => toggleTask(selectedDate, t.id)} aria-label={`Complete: ${t.text}`}
                          style={{ width:19, height:19, borderRadius:"50%", flexShrink:0, boxSizing:"border-box", border:`2px solid ${PRIORITIES[pri].ring}`, background:"transparent", cursor:"pointer", padding:0, WebkitTapHighlightColor:"transparent" }} />
                        <span onClick={() => setMatrixExpanded(true)} style={{ flex:1, minWidth:0, fontSize:14, fontWeight:500, color:T.text, cursor:"pointer", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                          {t.text}{t.carriedFrom && <span style={{ marginLeft:6, fontSize:10, fontWeight:700, color:"#9A6410", background:"#FAEEDA", borderRadius:10, padding:"1px 6px" }}>↩ carried</span>}
                        </span>
                        {editable && (
                          <button onClick={() => toggleFocus(selectedDate, t.id)} disabled={!canPromote} aria-label={canPromote ? "Add to Top 3" : "Top 3 is full"} title={canPromote ? "Add to Top 3" : "Top 3 is full"}
                            style={{ background:"none", border:"none", cursor: canPromote ? "pointer" : "default", padding:0, flexShrink:0, opacity: canPromote ? 1 : 0.3, WebkitTapHighlightColor:"transparent" }}>
                            <Ic name="star" size={15} color={T.border2} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </>
              )}

              {/* Completed strip — done tasks drop here; tap a row to send it back */}
              {doneTasks.length > 0 && (
                <div style={{ borderTop:`1px solid ${T.surf2}`, marginTop:4, paddingTop:8 }}>
                  <button onClick={() => setDoneOpen(o => !o)} aria-expanded={doneOpen}
                    style={{ display:"flex", alignItems:"center", gap:8, width:"100%", background:T.primary+"0e", border:"none", borderRadius:11, padding:"9px 12px", cursor:"pointer", fontFamily:"inherit", WebkitTapHighlightColor:"transparent" }}>
                    <span aria-hidden="true" style={{ width:18, height:18, borderRadius:"50%", background:T.primary, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
                      <Ic name="check" size={11} color="#fff" />
                    </span>
                    <span style={{ flex:1, textAlign:"left", fontSize:12.5, fontWeight:700, color:T.primary }}>{doneTasks.length} completed</span>
                    <span style={{ marginLeft:"auto", color:T.primary }}>{doneOpen ? "▴" : "▾"}</span>
                  </button>
                  {doneOpen && doneTasks.map((t, i) => (
                    <button key={t.id} onClick={() => toggleTask(selectedDate, t.id)} aria-label={`Uncheck: ${t.text}`}
                      style={{ display:"flex", alignItems:"center", gap:10, width:"100%", background:"transparent", border:"none", borderTop: i === 0 ? "none" : `1px solid ${T.surf2}`, padding:"8px 6px", cursor:"pointer", textAlign:"left", WebkitTapHighlightColor:"transparent" }}>
                      <span aria-hidden="true" style={{ width:19, height:19, borderRadius:"50%", flexShrink:0, background:T.primary, display:"flex", alignItems:"center", justifyContent:"center" }}>
                        <Ic name="check" size={11} color="#fff" />
                      </span>
                      <span style={{ flex:1, minWidth:0, fontSize:14, color:T.muted, textDecoration:"line-through", textDecorationColor:T.border2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{t.text}</span>
                    </button>
                  ))}
                </div>
              )}

              {focusTasks.length === 0 && laterTasks.length === 0 && doneTasks.length === 0 && (
                <div style={{ fontSize:13, color:T.muted, textAlign:"center", padding:"6px 0" }}>All done <span aria-hidden="true">🎉</span></div>
              )}

              <button onClick={() => setMatrixExpanded(true)} style={{ display:"block", width:"100%", textAlign:"center", background:"none", border:"none", cursor:"pointer", fontSize:13, fontWeight:700, color:T.primary, padding:"10px 0 3px", fontFamily:"inherit", WebkitTapHighlightColor:"transparent" }}>
                view all <span aria-hidden="true">▾</span>
              </button>
            </>
          );
        })()}

      </div>

      {/* Empty identities — one compact block of "add a habit" chips (not N full cards) */}
      {(() => {
        const empties = identities.filter(i => i.habits.length === 0);
        if (empties.length === 0) return null;
        return (
          <div style={{ borderRadius:14, border:`1px dashed ${T.border2}`, background:T.surface, padding:"11px 13px" }}>
            <div style={{ fontSize:11, fontWeight:800, letterSpacing:"0.06em", textTransform:"uppercase", color:T.muted, marginBottom:9 }}>
              {empties.length === 1 ? "This identity needs a habit" : "These identities need a habit"}
            </div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
              {empties.map(i => (
                <button key={i.id} onClick={()=>openAddHabit(i.id)}
                  style={{ display:"inline-flex", alignItems:"center", gap:6, background:`${i.color}14`, border:`1px solid ${i.color}44`,
                    borderRadius:20, padding:"6px 12px", cursor:"pointer", fontFamily:"inherit", fontSize:13, fontWeight:700,
                    color:i.colorDim || i.color, WebkitTapHighlightColor:"transparent" }}>
                  <span aria-hidden="true">{i.icon}</span> {shortLabel(i.label)} <span aria-hidden="true" style={{ fontWeight:900, opacity:0.65 }}>＋</span>
                </button>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Never-miss-twice alert — habits missed yesterday and still pending today */}
      {missedWarnCount > 0 && (
        <div role="alert" style={{ display:"flex", alignItems:"center", gap:11, background:T.red+"10", border:`1.5px solid ${T.red}44`, borderRadius:14, padding:"11px 14px" }}>
          <Ic name="warn" size={19} color={T.red} />
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:14, fontWeight:800, color:T.red, lineHeight:1.3 }}>Never miss twice</div>
            <div style={{ fontSize:12.5, color:T.text2, marginTop:2, lineHeight:1.45 }}>
              {missedWarnCount === 1 ? "1 habit was missed yesterday — win it back today." : `${missedWarnCount} habits were missed yesterday — win them back today.`}
            </div>
          </div>
        </div>
      )}

      {/* Focus entry — a guided, one-at-a-time run through today's pending habits */}
      {selectedDate === todayKey && (() => {
        const pending = scheduledHabits.filter(({ habit }) => todayData[habit.id] == null).length;
        if (!pending) return null;
        return (
          <button onClick={startFocus}
            style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8, width:"100%",
              padding:"11px 14px", borderRadius:12, border:`1.5px solid ${T.primary}55`, background:T.primary+"0e",
              cursor:"pointer", fontFamily:"inherit", fontSize:14, fontWeight:800, color:T.primary, WebkitTapHighlightColor:"transparent" }}>
            <Ic name="play" size={14} color={T.primary} /> Focus mode · {pending} to go
          </button>
        );
      })()}

      {/* Focus mode overlay */}
      {focusItems && (
        <FocusMode items={focusItems} toggle={toggle} onClose={() => setFocusItems(null)} />
      )}

      {/* Timeline — habits on a time rail */}
      {(() => {
        const visible = scheduledHabits.filter(({ habit }) => {
          const st = todayData[habit.id];
          // Active list = neither done nor missed. Checked habits move to Completed instantly.
          return st !== true && st !== "miss";
        });
        if (visible.length === 0) return null;
        const firstPending = scheduledHabits.find(({ habit }) => todayData[habit.id] == null);
        const firstPendingId = firstPending ? firstPending.habit.id : null;
        return (
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            {visible.map(({ habit, identity }) => {
              // Missed yesterday & still pending today → flag the whole card red (never miss twice).
              const warnMissed = selectedDate === todayKey && missedYesterdayIds.has(habit.id) && todayData[habit.id] == null;
              // Streak badge for the card header — current run for this habit.
              const st = getStreakForHabit(habit.id, habit.frequency);
              const bad = habit.kind === "bad";
              const streakBadge = st > 0 ? (
                <span aria-label={`${st} ${bad ? "days clean" : "day"} streak`} style={{ flexShrink:0, display:"inline-flex", alignItems:"center", gap:3, fontSize:11.5, fontWeight:900, lineHeight:1,
                  color: bad ? "#3B6D11" : "#C2751A", background: bad ? "#EAF3DE" : "#FBF0DA", borderRadius:20, padding:"3px 9px" }}>
                  <Ic name={bad ? "check" : "flame"} size={12} color={bad ? "#3B6D11" : "#C2751A"} />{st}
                </span>
              ) : null;
              return (
              <div key={habit.id} style={{
                background: warnMissed ? "#FEF4F4" : T.surface, borderRadius:14,
                border: warnMissed
                  ? "1px solid #F0B4B4"
                  : habit.kind === "bad"
                  ? (habit.id === firstPendingId ? "1.5px solid #D4537E" : "1px solid #F4C0D1")
                  : (habit.id === firstPendingId ? `1.5px solid ${identity.color}` : `1px solid #C7DDEB`),
                // Left accent — red when missed yesterday, else the identity colour
                borderLeft: `4px solid ${warnMissed ? "#E24B4A" : (habit.kind === "bad" ? "#D4537E" : identity.color)}`,
                boxShadow: warnMissed
                  ? "0 6px 20px #E24B4A22"
                  : habit.id === firstPendingId
                  ? (habit.kind === "bad" ? "0 8px 22px #D4537E2e" : `0 8px 22px ${identity.color}2e`)
                  : "0 1px 2px rgba(9,45,75,0.06), 0 5px 14px rgba(9,45,75,0.10)",
                overflow:"hidden",
              }}>
                {/* Header — full-width cue BANNER (trigger) · ⋯ menu. Time & place sit by the ring. */}
                {habit.trigger ? (
                  <div style={{ display:"flex", alignItems:"center", gap:9, padding:"10px 8px 10px 13px",
                    background: habit.kind === "bad" ? "#FBEAF0" : "#EAF1FC",
                    borderBottom: `1px solid ${habit.kind === "bad" ? "#F4C0D1" : "#D7E4F7"}` }}>
                    {(() => {
                      const em = habit.icon || cueEmoji(habit.trigger || "");
                      const bad = habit.kind === "bad";
                      return (
                        <span aria-hidden="true" style={{ width:24, height:24, borderRadius:8, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", lineHeight:1, fontSize: em ? 14 : undefined, background: em ? (bad ? "#FBDCE7" : "#DCE8FA") : (bad ? "#C85C88" : "#3B7DD8") }}>
                          {em || <Ic name={bad ? "warn" : "bolt"} size={14} color="#fff" />}
                        </span>
                      );
                    })()}
                    <span style={{ flex:1, minWidth:0, fontSize:14.5, fontWeight:800, letterSpacing:"-0.005em", color: habit.kind === "bad" ? "#8A2F52" : "#1C4A8C", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      {habit.kind === "bad" && <span style={{ fontSize:9.5, fontWeight:900, letterSpacing:"0.09em", color:"#B23A6B", marginRight:6 }}>BREAKING</span>}
                      {capFirst(habit.trigger) || (habit.kind === "bad" ? "When tempted" : "Reminder")}
                    </span>
                    {streakBadge}
                    <RowMenu habit={habit} identity={identity} missed={todayData[habit.id] === "miss"} onMiss={markMiss} openEditHabit={openEditHabit} openDeleteHabit={openDeleteHabit} onReview={openReviewFor} habitNotes={habitNotes} allData={allData} setHabitNote={setHabitNote} />
                  </div>
                ) : (
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"flex-end", gap:8, padding:"9px 8px 0 12px" }}>
                    {habit.kind === "bad" && (
                      <span style={{ marginRight:"auto", flexShrink:0, display:"inline-flex", alignItems:"center", gap:3, fontSize:10, fontWeight:800, color:"#993556", background:"#FBEAF0", border:"1px solid #F4C0D1", borderRadius:20, padding:"2px 7px" }}><Ic name="x" size={10} color="#993556" /> breaking</span>
                    )}
                    {streakBadge}
                    <RowMenu habit={habit} identity={identity} missed={todayData[habit.id] === "miss"} onMiss={markMiss} openEditHabit={openEditHabit} openDeleteHabit={openDeleteHabit} onReview={openReviewFor} habitNotes={habitNotes} allData={allData} setHabitNote={setHabitNote} />
                  </div>
                )}
                <HabitRow
                  habit={habit}
                  identity={identity}
                  checked={todayData[habit.id] === true}
                  missed={todayData[habit.id] === "miss"}
                  warnMissedYesterday={selectedDate === todayKey && missedYesterdayIds.has(habit.id) && todayData[habit.id] == null}
                  streak={getStreakForHabit(habit.id, habit.frequency)}
                  toggle={toggle}
                  onMiss={markMiss}
                  first={true}
                  showIdentity={false}
                  hideTime={true}
                  history={(() => {
                    const startKey = habitStartKey(habit, allData);
                    return [...Array(7)].map((_, i) => {
                      const k = addDaysKey(todayKey, i - 6);
                      const v = (allData[k] || {})[habit.id];
                      const d = new Date(k + "T00:00");
                      const pre = startKey && k < startKey;
                      const off = !isScheduledOn(habit.frequency, k); // not due this day
                      return { status: v === true ? "done" : v === "miss" ? "miss" : "none", letter: "SMTWTFS"[d.getDay()], today: i === 6, pre, off };
                    });
                  })()}
                  votes={Object.entries(allData).reduce((n, [k, day]) => n + (day && day[habit.id] === true && isScheduledOn(habit.frequency, k) ? 1 : 0), 0)}
                  voteTotal={scheduledDaysSince(habit.frequency, habitStartKey(habit, allData), todayKey)}
                  note={(habitNotes[selectedDate] || {})[habit.id] || ""}
                  allData={allData}
                  habitNotes={habitNotes}
                  setHabitNote={setHabitNote}
                />
              </div>
              );
            })}
          </div>
        );
      })()}

      {/* Completed section — resolved habits (done + missed), collapsed by default */}
      {(() => {
        // Both outcomes land here: a tap on the ring (done) or the ✕ Miss pill (missed).
        const resolved = scheduledHabits.filter(({habit}) => {
          const st = todayData[habit.id];
          return st === true || st === "miss";
        });
        if (resolved.length === 0) return null;
        return (
          <div style={{ marginTop:8 }}>
            <button
              onClick={() => setDoneOpen(o => !o)}
              aria-expanded={doneOpen}
              style={{
                display:"flex", alignItems:"center", gap:8, width:"100%",
                margin:"4px 0 10px", padding:"9px 12px",
                background:T.primary+"0e", border:"none", borderRadius:14,
                cursor:"pointer", fontFamily:"inherit", WebkitTapHighlightColor:"transparent",
              }}
            >
              <span style={{ fontSize:16 }} aria-hidden="true">✅</span>
              <span style={{ fontSize:14, fontWeight:700, color:T.primary, fontFamily:FONT_DISPLAY }}>Completed</span>
              <span style={{ fontSize:12, color:T.primary, marginLeft:"auto", fontWeight:700, background:T.primary+"18", borderRadius:20, padding:"2px 9px" }} aria-label={`${resolved.length} resolved`}>{resolved.length}</span>
              <span aria-hidden="true" style={{ fontSize:11, color:T.primary, transition:"transform 0.2s", display:"inline-block", transform: doneOpen ? "rotate(180deg)" : "none" }}>▼</span>
            </button>
            {doneOpen && (
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {resolved.map(({ habit, identity }) => {
                const isMiss = todayData[habit.id] === "miss";
                if (isMiss) {
                  return (
                    <button
                      key={habit.id}
                      onClick={() => markMiss(habit.id)}
                      aria-label={`Undo missed: ${habit.label}`}
                      style={{
                        display:"flex", alignItems:"center", gap:10,
                        background:"#FBEAF1", border:"1.5px solid #F0C4D7",
                        borderRadius:14, padding:"10px 14px",
                        cursor:"pointer", textAlign:"left", width:"100%",
                        WebkitTapHighlightColor:"transparent", transition:"opacity 0.2s",
                      }}
                    >
                      <div aria-hidden="true" style={{ width:32, height:32, borderRadius:"50%", flexShrink:0, background:"#D98AA9", display:"flex", alignItems:"center", justifyContent:"center" }}>
                        <Ic name="x" size={16} color="#fff" />
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:15, fontWeight:600, color:"#8A3A5E", lineHeight:1.2 }}>{habit.label}</div>
                        <div style={{ fontSize:12, color:T.muted, marginTop:2 }}><span aria-hidden="true">{identity.icon}</span> {shortLabel(identity.label)} · {habit.kind === "bad" ? "slipped" : "missed"}</div>
                      </div>
                      <span style={{ fontSize:12, color:T.muted, flexShrink:0, opacity:0.6 }}>undo</span>
                    </button>
                  );
                }
                const streak = getStreakForHabit(habit.id, habit.frequency);
                const milestone = getMilestone(streak);
                return (
                  <button
                    key={habit.id}
                    onClick={() => toggle(habit.id, habit.frequency, identity)}
                    aria-pressed={true}
                    aria-label={`Undo: ${habit.label}`}
                    style={{
                      display:"flex", alignItems:"center", gap:10,
                      background: T.primary+"0e", border:`1.5px solid ${T.primary}33`,
                      borderRadius:14, padding:"10px 14px",
                      cursor:"pointer", textAlign:"left", width:"100%",
                      WebkitTapHighlightColor:"transparent",
                      transition:"opacity 0.2s",
                    }}
                  >
                    <div aria-hidden="true" style={{ width:32, height:32, borderRadius:"50%", flexShrink:0, background:T.primary, display:"flex", alignItems:"center", justifyContent:"center", boxShadow:`0 0 0 3px ${T.primary}22` }}>
                      <span style={{ fontSize:16, color:"#fff", fontWeight:900, lineHeight:1 }}>✓</span>
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:15, fontWeight:600, color:T.primary, textDecoration:"line-through", textDecorationColor:T.primary+"77", lineHeight:1.2 }}>{habit.label}</div>
                      <div style={{ fontSize:12, color:T.muted, marginTop:2 }}><span aria-hidden="true">{identity.icon}</span> {shortLabel(identity.label)}</div>
                      {habit.satisfying && (
                        <div style={{ fontSize:12, color:"#854F0B", fontWeight:600, marginTop:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                          <span aria-hidden="true">🎁</span> {habit.satisfying}
                        </div>
                      )}
                    </div>
                    {streak >= 2 && (
                      <span style={{ fontSize:12, fontWeight:800, color:T.gold, background:T.gold+"20", padding:"2px 8px", borderRadius:20, flexShrink:0 }} aria-label={`${streak} day streak`}>
                        <span aria-hidden="true">{milestone ? milestone.emoji : "🔥"}</span> {streak}d
                      </span>
                    )}
                    <span style={{ fontSize:12, color:T.muted, flexShrink:0, opacity:0.6 }}>undo</span>
                  </button>
                );
              })}
            </div>
            )}
          </div>
        );
      })()}

      {/* Not scheduled today section */}
      {notTodayHabits.length > 0 && (
        <div style={{ marginTop:12 }}>
          <button
            onClick={() => setNotTodayExpanded(e => !e)}
            aria-expanded={notTodayExpanded}
            aria-controls={notTodayListId}
            style={{
              display:"flex", alignItems:"center", gap:8, width:"100%",
              background:"transparent", border:"none", cursor:"pointer", padding:"4px 2px",
              WebkitTapHighlightColor:"transparent",
            }}
          >
            <span style={{ fontSize:15, opacity:0.5 }} aria-hidden="true">⏭</span>
            <span style={{ fontSize:13, fontWeight:700, color:T.muted }}>
              {selectedDate === todayKey ? "Not scheduled today" : `Not scheduled · ${formatNavDate(selectedDate)}`}
            </span>
            <span style={{ fontSize:12, color:T.muted, background:T.surf2, borderRadius:20, padding:"1px 8px", marginLeft:"auto" }}>{notTodayHabits.length}</span>
            <span style={{ fontSize:13, color:T.muted }} aria-hidden="true">{notTodayExpanded ? "▲" : "▼"}</span>
          </button>
          {notTodayExpanded && (
            <div id={notTodayListId} style={{ marginTop:8, display:"flex", flexDirection:"column", gap:5 }}>
              {notTodayHabits.map(({ habit, identity }) => {
                const { bg, color } = getFreqColor(habit.frequency);
                return (
                  <div key={habit.id} style={{
                    display:"flex", alignItems:"center", gap:10,
                    background:T.surf2, border:`1px dashed ${T.border}`,
                    borderRadius:12, padding:"10px 14px", opacity:0.65,
                  }}>
                    <div aria-hidden="true" style={{ width:30, height:30, borderRadius:"50%", border:`1.5px solid ${T.border}`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                      <span style={{ fontSize:13, color:T.muted }}>○</span>
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:14, fontWeight:600, color:T.muted }}>{habit.label}</div>
                      <div style={{ fontSize:12, color:T.muted, marginTop:2 }}><span aria-hidden="true">{identity.icon}</span> {shortLabel(identity.label)}</div>
                    </div>
                    <span style={{ fontSize:12, fontWeight:700, color, background:bg, padding:"3px 8px", borderRadius:20, flexShrink:0, whiteSpace:"nowrap" }}>
                      {getFreqLabel(habit.frequency)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <button onClick={()=>openAddHabit()} style={S.addHabitBtn}>
        <span style={{ fontSize:18, color:T.primary, fontWeight:700 }} aria-hidden="true">+</span>
        <span style={{ fontSize:14, color:T.text2, fontWeight:500 }}>Add a new habit</span>
      </button>
      <button onClick={openAddIdentity} style={S.addIdentityBtn}>+ Add New Identity</button>

      <div style={S.footer}>
        <span style={S.footerQuote}>"Habits are the compound interest of self-improvement."</span>
        <span style={S.footerAuthor}>— James Clear, Atomic Habits</span>
      </div>
    </div>
  );
});

// ─── WEEK VIEW ────────────────────────────────────────────────────────────────
const WeekView = memo(function WeekView({ data, todayKey, identities }) {
  const [weekOffset, setWeekOffset] = useState(0);

  // Compute the 7 dates for the currently displayed week (Mon–Sun)
  const weekDates = useMemo(() => {
    const today = new Date();
    today.setDate(today.getDate() - weekOffset * 7);
    const mon = new Date(today);
    mon.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(mon);
      d.setDate(mon.getDate() + i);
      return dateToKey(d);
    });
  }, [weekOffset]);

  const weekLabel = weekOffset === 0 ? "This Week" : weekOffset === 1 ? "Last Week" : `${weekOffset} weeks ago`;

  return (
    <div style={S.content}>
      {/* Week navigation + dot legend */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", background:T.surface, borderRadius:14, border:`1px solid ${T.border}`, padding:"8px 12px" }}>
        <button onClick={() => setWeekOffset(o => o + 1)} aria-label="Previous week"
          style={{ ...S.crudBtn, width:36, height:36, fontSize:20 }}>
          <span aria-hidden="true">‹</span>
        </button>
        <span style={{ fontSize:14, fontWeight:700, color:T.text, fontFamily:FONT_DISPLAY }}>{weekLabel}</span>
        <button onClick={() => setWeekOffset(o => Math.max(0, o - 1))} aria-label="Next week"
          disabled={weekOffset === 0}
          style={{ ...S.crudBtn, width:36, height:36, fontSize:20, opacity: weekOffset === 0 ? 0.3 : 1 }}>
          <span aria-hidden="true">›</span>
        </button>
      </div>

      {/* Dot legend */}
      <div style={{ display:"flex", gap:14, fontSize:12, color:T.muted, paddingLeft:4, flexWrap:"wrap" }} aria-hidden="true">
        <span style={{ display:"flex", alignItems:"center", gap:4 }}>
          <span style={{ display:"inline-block", width:10, height:10, borderRadius:3, background:T.primary }}/>Done
        </span>
        <span style={{ display:"flex", alignItems:"center", gap:4 }}>
          <span style={{ display:"inline-block", width:10, height:10, borderRadius:3, border:`1px solid ${T.border}`, background:T.surf2 }}/>Missed
        </span>
        <span style={{ display:"flex", alignItems:"center", gap:4 }}>
          <span style={{ display:"inline-block", width:10, height:10, borderRadius:3, border:`1px dashed ${T.border}` }}/>Not scheduled
        </span>
      </div>

      {identities.map(identity=>(
        <div key={identity.id} style={S.card}>
          <div style={{...S.cardLabel,color:identity.color,marginBottom:12}}>
            <span aria-hidden="true">{identity.icon}</span> {identity.label}
          </div>
          {identity.habits.length===0
            ? <div style={{fontSize:13,color:T.muted,textAlign:"center",padding:"8px 0"}}>No habits yet</div>
            : (
              <div style={S.weekGrid}>
                <div/>
                {weekDates.map((d,i)=>(
                  <div key={d} style={{...S.weekDayH,color:d===todayKey?identity.color:T.muted,fontWeight:d===todayKey?700:500}}>{DAY_LABELS[i]}</div>
                ))}
                {[...identity.habits].sort(byHabitTime).map(habit=>{
                  const startKey = habitStartKey(habit, data);
                  return (
                  <Fragment key={habit.id}>
                    <div style={S.weekHabitLabel}>{habit.label}</div>
                    {weekDates.map(d=>{
                      const val       = data[d] && data[d][habit.id];
                      const done      = val === true;
                      const missed    = val === "miss";
                      const pre       = startKey && d < startKey;
                      const scheduled = !pre && isScheduledOn(habit.frequency, d);
                      const future    = d > todayKey;
                      const dotLabel  = pre ? "Before start" : done ? "Done" : missed ? "Missed" : future ? "Future" : scheduled ? "Not done" : "Not scheduled";
                      return (
                        <div key={d} aria-label={dotLabel} style={{
                          ...S.weekDot,
                          background: done ? identity.color : missed ? T.red+"1c" : (scheduled && !pre) ? T.surf2 : "transparent",
                          border: pre ? "1px solid transparent" : done ? `1px solid ${identity.color}` : missed ? `1px solid ${T.red}66` : scheduled ? `1px solid ${T.border}` : `1px dashed ${T.border}`,
                          opacity: pre ? 0.25 : future ? 0.35 : scheduled ? 1 : 0.4,
                          display:"flex", alignItems:"center", justifyContent:"center",
                        }}>
                          {pre && <span style={{width:3,height:3,borderRadius:"50%",background:T.border2}} aria-hidden="true" />}
                          {done && <span style={{fontSize:12,color:"#fff",fontWeight:900,lineHeight:1}} aria-hidden="true">✓</span>}
                          {missed && <span style={{fontSize:12,color:T.red,fontWeight:900,lineHeight:1}} aria-hidden="true">✕</span>}
                        </div>
                      );
                    })}
                  </Fragment>
                  );
                })}
              </div>
            )
          }
        </div>
      ))}
      <div style={S.card}>
        <div style={{...S.cardLabel,color:T.gold,marginBottom:14}}><span aria-hidden="true">📊</span> Weekly Score</div>
        {identities.map(identity=>{
          const done = weekDates.reduce((a,d) =>
            a + identity.habits.filter(h => isScheduledOn(h.frequency, d) && data[d]?.[h.id] === true).length, 0);
          const possible = weekDates
            .filter(d => d <= todayKey)
            .reduce((a,d) => a + identity.habits.filter(h => {
              const sKey = habitStartKey(h, data);
              return isScheduledOn(h.frequency, d) && (!sKey || d >= sKey);
            }).length, 0);
          const pct=possible>0?Math.round((done/possible)*100):0;
          return (
            <div key={identity.id} style={S.summaryRow}>
              <span style={{fontSize:13,color:T.text2,minWidth:110,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontWeight:500}}>
                <span aria-hidden="true">{identity.icon}</span> {shortLabel(identity.label)}
              </span>
              <div style={S.summaryBar}><div style={{...S.summaryFill,width:`${pct}%`,background:identity.color}}/></div>
              <span style={{fontSize:13,color:identity.color,minWidth:36,textAlign:"right",fontWeight:700}}>{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
});

// ─── IDENTITY VIEW — habits grouped under the person each one votes for ───────
// Collapsible identity sections (flat + accordion): tap to open a self's habits.
const IdentityView = memo(function IdentityView({ identities, todayData, allData, toggle, todayKey, openAddHabit, openAddIdentity }) {
  const [open, setOpen] = useState({});
  const linkBtn = { background:"none", border:"none", color:T.primary, fontWeight:700, cursor:"pointer", padding:0, fontSize:"inherit", fontFamily:"inherit", WebkitTapHighlightColor:"transparent" };
  return (
    <div style={S.content}>
      <div style={{ fontSize:11, fontWeight:800, letterSpacing:"0.08em", textTransform:"uppercase", color:T.muted, textAlign:"center", margin:"2px 0 14px" }}>Who you're becoming</div>

      {identities.length === 0 ? (
        <div style={{ ...S.card, padding:"22px 16px", textAlign:"center", fontSize:13.5, color:T.muted }}>
          No identities yet — <button onClick={openAddIdentity} style={linkBtn}>add your first</button>
        </div>
      ) : (
        <div style={{ ...S.card, padding:0, overflow:"hidden" }}>
          {identities.map((identity, idx) => {
            const habits = [...identity.habits].sort(byHabitTime);
            const dueToday = habits.filter(h => isScheduledOn(h.frequency, todayKey));
            const doneToday = dueToday.filter(h => todayData[h.id] === true).length;
            const votes = habits.reduce((n, h) => n + Object.values(allData).filter(day => day && day[h.id] === true).length, 0);
            const isOpen = !!open[identity.id];
            const allDone = dueToday.length > 0 && doneToday === dueToday.length;
            const cntColor = allDone ? "#12694E" : doneToday > 0 ? "#9A6410" : T.muted;
            const cntBg    = allDone ? "#DFF3EA" : doneToday > 0 ? "#FAEEDA" : T.surf2;
            return (
              <div key={identity.id} style={{ borderTop: idx === 0 ? "none" : `1px solid ${T.surf2}` }}>
                <button onClick={() => setOpen(o => ({ ...o, [identity.id]: !o[identity.id] }))} aria-expanded={isOpen} aria-label={`${shortLabel(identity.label)}, ${doneToday} of ${dueToday.length} today`}
                  style={{ display:"flex", alignItems:"center", gap:9, width:"100%", padding:"12px 14px", background:"none", border:"none", cursor:"pointer", fontFamily:"inherit", WebkitTapHighlightColor:"transparent" }}>
                  <span style={{ fontSize:16, flexShrink:0 }} aria-hidden="true">{identity.icon}</span>
                  <span style={{ flex:1, minWidth:0, fontSize:12, fontWeight:800, letterSpacing:"0.03em", textTransform:"uppercase", color: identity.colorDim || T.text, textAlign:"left", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{shortLabel(identity.label)}</span>
                  {dueToday.length > 0 && (
                    <span aria-hidden="true" style={{ flexShrink:0, fontSize:11, fontWeight:800, borderRadius:20, padding:"2px 8px", color:cntColor, background:cntBg, fontVariantNumeric:"tabular-nums" }}>{doneToday}/{dueToday.length}</span>
                  )}
                  <span aria-hidden="true" style={{ flexShrink:0, fontSize:11, fontWeight:700, color:T.muted }}>{votes} vote{votes !== 1 ? "s" : ""}</span>
                  <span aria-hidden="true" style={{ flexShrink:0, color:T.border2, fontSize:12, width:12, textAlign:"center" }}>{isOpen ? "▴" : "▾"}</span>
                </button>
                {isOpen && (
                  <div style={{ padding:"0 14px 11px 43px" }}>
                    {habits.length === 0 ? (
                      <div style={{ fontSize:12.5, color:T.muted, padding:"2px 0 6px" }}>No habits yet — <button onClick={() => openAddHabit(identity.id)} style={linkBtn}>add one</button></div>
                    ) : habits.map(h => {
                      const done = todayData[h.id] === true;
                      const missed = todayData[h.id] === "miss";
                      const scheduled = isScheduledOn(h.frequency, todayKey);
                      return (
                        <div key={h.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"6px 0", opacity: scheduled ? 1 : 0.55 }}>
                          <button onClick={() => scheduled && !missed && toggle(h.id, h.frequency, identity)} disabled={!scheduled || missed}
                            aria-label={done ? `Uncheck ${h.label}` : `Check ${h.label}`}
                            style={{ width:18, height:18, borderRadius:"50%", flexShrink:0, boxSizing:"border-box", border:`2px solid ${done ? identity.color : missed ? T.red + "66" : "#cfcbc2"}`, background: done ? identity.color : "transparent", cursor: (scheduled && !missed) ? "pointer" : "default", padding:0, display:"flex", alignItems:"center", justifyContent:"center", WebkitTapHighlightColor:"transparent" }}>
                            {done && <Ic name="check" size={10} color="#fff" />}
                            {missed && <Ic name="x" size={9} color={T.red} />}
                          </button>
                          <span style={{ flex:1, minWidth:0, fontSize:13.5, color: done ? T.muted : T.text, textDecoration: done ? "line-through" : "none", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{h.label}</span>
                          {!scheduled && <span style={{ fontSize:10.5, color:T.muted, flexShrink:0 }}>not today</span>}
                          {scheduled && h.time && <span style={{ fontSize:11, color:T.muted, flexShrink:0, fontVariantNumeric:"tabular-nums" }}>{to24h(h.time)}</span>}
                        </div>
                      );
                    })}
                    <button onClick={() => openAddHabit(identity.id)} style={{ ...linkBtn, fontSize:12, marginTop:4, color:T.muted }}>＋ Add a habit</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <button onClick={openAddIdentity} style={{ ...S.addHabitBtn, marginTop:12 }}>
        <span aria-hidden="true" style={{ fontSize:18, color:T.primary }}>＋</span>
        <span style={{ fontSize:14, fontWeight:700, color:T.text2 }}>Add a new identity</span>
      </button>
    </div>
  );
});

// ─── STREAKS VIEW ─────────────────────────────────────────────────────────────
const StreaksView = memo(function StreaksView({ getStreak, identities }) {
  const allHabits = useMemo(() =>
    identities.flatMap(i => i.habits.map(h => ({ ...h, identity:i, streak:getStreak(h.id, h.frequency) }))),
    [identities, getStreak]
  );
  const sorted    = useMemo(() => [...allHabits].sort((a,b) => b.streak - a.streak), [allHabits]);
  const topStreak = sorted[0]?.streak || 0;
  return (
    <div style={S.content}>
      {topStreak === 0 && identities.some(i => i.habits.length > 0) && (
        <div style={{ textAlign:"center", padding:"32px 16px" }}>
          <div style={{ fontSize:48, marginBottom:12 }} aria-hidden="true">🔥</div>
          <div style={{ fontSize:16, fontWeight:700, color:T.text, marginBottom:6 }}>No active streaks yet</div>
          <div style={{ fontSize:14, color:T.muted, lineHeight:1.7 }}>
            Check in today to start your first streak.
          </div>
        </div>
      )}
      {topStreak>0&&(
        <div style={{...S.card,background:`linear-gradient(135deg,${T.gold}18,${T.accent}10)`,borderColor:T.gold+"55",textAlign:"center",padding:"28px 16px"}}>
          <div style={{fontSize:52}} aria-hidden="true">🔥</div>
          <div style={{fontSize:40,fontWeight:800,color:T.gold,fontFamily:FONT_DISPLAY,lineHeight:1}}>{topStreak}</div>
          <div style={{fontSize:14,color:T.text2,marginTop:6,fontWeight:500}}>Best active streak</div>
          <div style={{fontSize:15,color:T.text,marginTop:4,fontWeight:600}}>{sorted[0]?.label}</div>
        </div>
      )}
      {identities.map(identity=>(
        <div key={identity.id} style={S.card}>
          <div style={{...S.cardLabel,color:identity.color,marginBottom:12}}>
            <span aria-hidden="true">{identity.icon}</span> {identity.label}
          </div>
          {identity.habits.length===0
            ? <div style={{fontSize:13,color:T.muted,textAlign:"center",padding:"8px 0"}}>No habits yet</div>
            : [...identity.habits].sort(byHabitTime).map(habit=>{
              const streak=getStreak(habit.id, habit.frequency);
              const milestone=getMilestone(streak);
              const next=getNextMilestone(streak);
              const pct=next?Math.round((streak/next.days)*100):100;
              return (
                <div key={habit.id} style={S.streakItem}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                    <div>
                      <span style={{fontSize:14,color:streak>0?T.text:T.muted,fontWeight:600}}>{habit.label}</span>
                      {milestone&&<span style={{marginLeft:8,fontSize:12,color:identity.color,fontWeight:600}}><span aria-hidden="true">{milestone.emoji}</span> {milestone.label}</span>}
                    </div>
                    <span style={{fontSize:16,fontWeight:800,color:streak>0?identity.color:T.border2}} aria-label={streak>0?`${streak} day streak`:"No active streak"}>
                      {streak>0?`🔥 ${streak}d`:"—"}
                    </span>
                  </div>
                  {habit.trigger&&<div style={{fontSize:12,color:T.muted,marginBottom:6}}>
                    <span aria-hidden="true">⚡</span> {habit.trigger}
                    {habit.time && <> · <span aria-hidden="true">🕐</span> {habit.time}</>}
                    {habit.location && <> · <span aria-hidden="true">📍</span> {habit.location}</>}
                  </div>}
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <div style={{flex:1,height:5,background:T.surf2,borderRadius:99,overflow:"hidden",border:`1px solid ${T.border}`}}
                         role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                      <div style={{height:"100%",width:`${pct}%`,background:identity.color,borderRadius:99,transition:"width 0.5s"}}/>
                    </div>
                    <span style={{fontSize:12,color:T.muted,flexShrink:0,fontWeight:600}}>{next?`→ ${next.emoji} ${next.days}d`:"💎 Max"}</span>
                  </div>
                </div>
              );
            })
          }
        </div>
      ))}
      <div style={S.card}>
        <div style={{...S.cardLabel,color:T.gold,marginBottom:14}}><span aria-hidden="true">🏅</span> Milestone Map</div>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {MILESTONES.map(m=>(
            <div key={m.days} style={{display:"flex",alignItems:"center",gap:12}}>
              <span style={{fontSize:20,minWidth:28}} aria-hidden="true">{m.emoji}</span>
              <span style={{fontSize:14,color:T.text,flex:1,fontWeight:600}}>{m.label}</span>
              <span style={{fontSize:13,color:T.muted,fontWeight:500}}>{m.days} days</span>
            </div>
          ))}
        </div>
      </div>
      <div style={S.footer}>
        <span style={S.footerQuote}>"You do not rise to the level of your goals. You fall to the level of your systems."</span>
        <span style={S.footerAuthor}>— James Clear</span>
      </div>
    </div>
  );
});

// ─── MOTIVATIONAL QUOTES ──────────────────────────────────────────────────────
const QUOTES = [
  { text: "Small steps every day build the life you dream of.", author: "James Clear" },
  { text: "You don't rise to the level of your goals. You fall to the level of your systems.", author: "James Clear" },
  { text: "Every action is a vote for the type of person you wish to become.", author: "James Clear" },
  { text: "The secret to getting results that last is to never stop making improvements.", author: "James Clear" },
  { text: "Success is the product of daily habits — not once-in-a-lifetime transformations.", author: "James Clear" },
  { text: "Make it obvious. Make it attractive. Make it easy. Make it satisfying.", author: "James Clear" },
  { text: "Habits are the compound interest of self-improvement.", author: "James Clear" },
  { text: "The most practical way to change who you are is to change what you do.", author: "James Clear" },
  { text: "Each day is a fresh start. Own it fully.", author: "" },
  { text: "Discipline is choosing between what you want now and what you want most.", author: "" },
  { text: "You are what you repeatedly do. Excellence is not an act, but a habit.", author: "Aristotle" },
  { text: "The groundwork for all happiness is good health.", author: "Leigh Hunt" },
  { text: "Take care of your body — it's the only place you have to live.", author: "Jim Rohn" },
  { text: "An investment in knowledge pays the best interest.", author: "Benjamin Franklin" },
];
function getDailyQuote() {
  const day = Math.floor(Date.now() / 86400000);
  return QUOTES[day % QUOTES.length];
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const FONT_DISPLAY = "'Nunito',-apple-system,BlinkMacSystemFont,sans-serif";
const FONT_BODY    = "'Nunito',-apple-system,BlinkMacSystemFont,sans-serif";

const S = {
  root:{minHeight:"100dvh",background:T.bg,fontFamily:FONT_BODY,color:T.text,width:"100%",maxWidth:430,margin:"0 auto",display:"flex",flexDirection:"column"},
  header:{position:"sticky",top:0,zIndex:50,background:T.bg+"f0",backdropFilter:"blur(16px)",WebkitBackdropFilter:"blur(16px)",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 20px 14px",paddingTop:"calc(env(safe-area-inset-top,0px) + 16px)"},
  eyebrow:{fontSize:12,letterSpacing:"0.14em",color:T.accent,fontWeight:700,marginBottom:4,textTransform:"uppercase",fontFamily:FONT_BODY},
  title:{margin:0,fontSize:24,fontWeight:800,fontFamily:FONT_DISPLAY,letterSpacing:"-0.04em",color:T.text,lineHeight:1.05},
  dateLabel:{fontSize:14,color:T.muted,marginTop:4,fontWeight:500,letterSpacing:"0.01em"},
  ringWrap:{flexShrink:0,textAlign:"center"},
  ringLabel:{fontSize:12,color:T.muted,marginTop:2,fontWeight:600},
  scrollArea:{flex:1,overflowY:"auto",WebkitOverflowScrolling:"touch",paddingBottom:"calc(env(safe-area-inset-bottom,0px) + 80px)"},
  content:{padding:"12px 14px 0",display:"flex",flexDirection:"column",gap:10},
  bottomNav:{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:430,background:T.bg+"f8",backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",borderTop:`1px solid ${T.border}`,display:"flex",alignItems:"center",paddingBottom:"env(safe-area-inset-bottom,8px)",zIndex:50},
  navBtn:{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,padding:"10px 0 6px",background:"transparent",border:"none",cursor:"pointer",minHeight:56,WebkitTapHighlightColor:"transparent"},
  navIcon:{fontSize:20,lineHeight:1},
  navLabel:{fontSize:12,fontWeight:600,letterSpacing:"0.02em",fontFamily:FONT_BODY},
  toast:{position:"fixed",top:"calc(env(safe-area-inset-top,0px) + 12px)",left:"50%",transform:"translateX(-50%)",background:T.surface,border:`2px solid ${T.gold}`,borderRadius:18,padding:"14px 18px",display:"flex",alignItems:"center",gap:14,zIndex:999,boxShadow:"0 8px 32px #00000018",minWidth:240,maxWidth:"calc(100vw - 32px)"},
  overlay:{position:"fixed",inset:0,background:"#00000044",zIndex:100,display:"flex",alignItems:"flex-end",justifyContent:"center"},
  modal:{background:T.surface,borderRadius:"24px 24px 0 0",width:"100%",maxWidth:430,maxHeight:"92dvh",overflowY:"auto",paddingBottom:"env(safe-area-inset-bottom,16px)",boxShadow:"0 -8px 40px #00000018"},
  modalDrag:{width:40,height:4,background:T.border2,borderRadius:99,margin:"12px auto 0"},
  modalHeader:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 20px 14px",borderBottom:`1px solid ${T.border}`},
  modalTitle:{fontSize:18,fontWeight:700,color:T.text,fontFamily:FONT_DISPLAY,letterSpacing:"-0.02em"},
  modalClose:{background:T.surf2,border:"none",color:T.muted,fontSize:16,cursor:"pointer",width:34,height:34,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",WebkitTapHighlightColor:"transparent"},
  fieldLabel:{display:"block",fontSize:12,letterSpacing:"0.08em",color:T.muted,fontWeight:700,marginBottom:8,marginTop:18,textTransform:"uppercase",fontFamily:FONT_BODY},
  input:{width:"100%",background:T.surf2,border:`1.5px solid ${T.border}`,borderRadius:12,padding:"14px 14px",color:T.text,fontSize:16,fontFamily:"inherit",outline:"none",boxSizing:"border-box",appearance:"none",WebkitAppearance:"none"},
  iconBtn:{width:46,height:46,border:`2px solid ${T.border}`,borderRadius:12,cursor:"pointer",fontSize:20,display:"flex",alignItems:"center",justifyContent:"center",WebkitTapHighlightColor:"transparent",background:T.surf2},
  btnPrimary:{flex:1,background:T.primary,color:"#fff",border:"none",borderRadius:12,padding:"15px 20px",fontSize:16,fontWeight:700,cursor:"pointer",fontFamily:"inherit",WebkitTapHighlightColor:"transparent",transition:"opacity 0.2s"},
  btnSecondary:{flex:1,background:T.surf2,color:T.text2,border:`1.5px solid ${T.border}`,borderRadius:12,padding:"15px 20px",fontSize:16,fontWeight:700,cursor:"pointer",fontFamily:"inherit",WebkitTapHighlightColor:"transparent"},
  addHabitBtn:{display:"flex",alignItems:"center",gap:10,background:T.surface,border:`1.5px dashed ${T.border}`,borderRadius:14,padding:"14px 16px",cursor:"pointer",width:"100%",WebkitTapHighlightColor:"transparent",marginTop:4},
  addIdentityBtn:{display:"flex",alignItems:"center",justifyContent:"center",background:"transparent",border:`1.5px dashed ${T.border2}`,borderRadius:14,padding:"14px 16px",cursor:"pointer",width:"100%",WebkitTapHighlightColor:"transparent",color:T.primary,fontSize:15,fontWeight:700,fontFamily:"inherit"},
  card:{background:T.surface,borderRadius:16,border:`1px solid ${T.border}`,boxShadow:"0 4px 16px rgba(2,80,130,0.05)",padding:"14px 16px"},
  cardLabel:{fontSize:14,fontWeight:700,color:T.text,fontFamily:FONT_DISPLAY,letterSpacing:"-0.01em",display:"flex",alignItems:"center",gap:6},
  weekGrid:{display:"grid",gridTemplateColumns:"120px repeat(7, 1fr)",gap:6,overflowX:"auto"},
  weekDayH:{fontSize:12,fontWeight:700,color:T.muted,textAlign:"center",padding:"2px 0",letterSpacing:"0.06em"},
  weekHabitLabel:{fontSize:12,color:T.text2,fontWeight:500,display:"flex",alignItems:"center",paddingRight:6,lineHeight:1.3},
  weekDot:{width:"100%",aspectRatio:"1",borderRadius:5,minWidth:22},
  crudBtn:{background:"transparent",border:"none",color:T.muted,cursor:"pointer",fontSize:16,padding:"6px 8px",lineHeight:1,borderRadius:8,WebkitTapHighlightColor:"transparent",display:"flex",alignItems:"center",justifyContent:"center"},
  footer:{textAlign:"center",padding:"20px 0 8px",display:"flex",flexDirection:"column",gap:4},
  footerQuote:{fontSize:13,color:T.muted,fontStyle:"italic",lineHeight:1.6},
  footerAuthor:{fontSize:12,color:T.border2,fontWeight:700},
  streakItem:{display:"flex",flexDirection:"column",gap:4,padding:"10px 0",borderBottom:`1px solid ${T.surf2}`},
  summaryRow:{display:"flex",alignItems:"center",gap:10,padding:"4px 0"},
  summaryBar:{flex:1,height:5,background:T.surf2,borderRadius:99,overflow:"hidden",border:`1px solid ${T.border}`},
  summaryFill:{height:"100%",borderRadius:99,transition:"width 0.5s"},
  spinner:{width:32,height:32,border:`3px solid ${T.border}`,borderTopColor:T.primary,borderRadius:"50%",animation:"spin 0.8s linear infinite"},
};

const css = `
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body, #root { height: 100%; }
#root ::-webkit-scrollbar { display: none; }
#root * { scrollbar-width: none; }
.habit-toggle:active { opacity: 0.7; transform: scale(0.98); }
.check-pop { animation: pop 0.25s cubic-bezier(0.34,1.56,0.64,1) both; }
.card-leaving { animation: fadeOut 0.3s ease forwards; }
.row-leaving { animation: fadeOut 0.35s ease 3s forwards; }
.sheet-in { animation: slideUp 0.28s cubic-bezier(0.32,0.72,0,1) both; }
.toast-in { animation: fadeSlideDown 0.3s cubic-bezier(0.32,0.72,0,1) both; }
.toast-in-up { animation: fadeSlideUp 0.3s cubic-bezier(0.32,0.72,0,1) both; }
.toast-in-center { animation: fadeScaleIn 0.25s cubic-bezier(0.34,1.56,0.64,1) both; }
.pop { animation: pop 0.35s cubic-bezier(0.34,1.56,0.64,1) both; }
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes pop { 0%,100% { transform: scale(1); } 50% { transform: scale(1.18); } }
@keyframes fadeOut { to { opacity: 0; transform: scale(0.95); } }
@keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
@keyframes fadeSlideDown { from { transform: translateX(-50%) translateY(-10px); opacity: 0; } to { transform: translateX(-50%) translateY(0); opacity: 1; } }
@keyframes fadeSlideUp { from { transform: translateX(-50%) translateY(10px); opacity: 0; } to { transform: translateX(-50%) translateY(0); opacity: 1; } }
@keyframes fadeScaleIn { from { transform: translate(-50%, -50%) scale(0.9); opacity: 0; } to { transform: translate(-50%, -50%) scale(1); opacity: 1; } }
`;
