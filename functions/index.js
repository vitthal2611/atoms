// ─── James Clear AI coach — Firebase callable function (Google Gemini) ───────
// Proxies the browser to the Gemini API so the API key stays server-side.
// The app calls this via httpsCallable(_functions, "askJamesClear").
//
// Setup (one-time):
//   1. Get a FREE key at https://aistudio.google.com/apikey
//   2. cd functions && npm install
//   3. firebase functions:secrets:set GEMINI_API_KEY   (paste your key)
//   4. firebase deploy --only functions:askJamesClear   (requires the Blaze plan)

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const { setGlobalOptions } = require("firebase-functions/v2");
const { GoogleGenAI } = require("@google/genai");
const admin = require("firebase-admin");

admin.initializeApp();

const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");

setGlobalOptions({ region: "us-central1", maxInstances: 5 });

// Same schedule logic as the client, so reminders only fire on days a habit is due.
function isScheduledOn(frequency, dateKey) {
  const freq = frequency || { cadence: "weekly", days: [0, 1, 2, 3, 4, 5, 6] };
  const [y, mo, d] = dateKey.split("-").map(Number);
  const date = new Date(y, mo - 1, d);
  if (freq.cadence === "monthly") {
    const dates = freq.dates || [1];
    const lastDay = new Date(y, mo, 0).getDate();
    return dates.some((dt) => (dt === 32 ? d === lastDay : dt === d));
  }
  const jsDay = date.getDay();
  const ourDay = jsDay === 0 ? 6 : jsDay - 1;
  return (freq.days || [0, 1, 2, 3, 4, 5, 6]).includes(ourDay);
}
const lower = (s) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);

// ─── Per-habit reminders — runs every minute, pushes for habits due right now ──
exports.sendHabitReminders = onSchedule(
  { schedule: "every 1 minutes", region: "us-central1", timeoutSeconds: 120, maxInstances: 1 },
  async () => {
    const db = admin.firestore();
    const snap = await db.collection("pushTokens").get();
    if (snap.empty) return;
    const now = new Date();

    for (const tokenDoc of snap.docs) {
      const { token, timezone, uid } = tokenDoc.data() || {};
      if (!token || !uid) continue;

      // The user's local date + HH:MM, so a 21:00 habit fires at their 21:00.
      let dateKey, hhmm;
      try {
        const parts = new Intl.DateTimeFormat("en-CA", {
          timeZone: timezone || "UTC", year: "numeric", month: "2-digit", day: "2-digit",
          hour: "2-digit", minute: "2-digit", hour12: false,
        }).formatToParts(now);
        const g = (t) => (parts.find((p) => p.type === t) || {}).value;
        let hh = g("hour"); if (hh === "24") hh = "00";
        dateKey = `${g("year")}-${g("month")}-${g("day")}`;
        hhmm = `${hh}:${g("minute")}`;
      } catch (e) { continue; }

      let idSnap, ciSnap;
      try {
        [idSnap, ciSnap] = await Promise.all([
          db.doc(`users/${uid}/atomicHabits/identities`).get(),
          db.doc(`users/${uid}/atomicHabits/checkIns`).get(),
        ]);
      } catch (e) { continue; }
      const identities = (idSnap.exists && idSnap.data().data) || [];
      const checkIns = (ciSnap.exists && ciSnap.data().data) || {};
      const today = checkIns[dateKey] || {};

      for (const identity of identities) {
        for (const habit of identity.habits || []) {
          if (!habit || habit.archived || !habit.time) continue;
          if (habit.time !== hhmm) continue;                  // exact-minute match
          if (!isScheduledOn(habit.frequency, dateKey)) continue;
          const st = today[habit.id];
          if (st === true || st === "miss") continue;          // already resolved today

          const breaking = habit.kind === "bad";
          const label = String(habit.label || "your habit").trim();
          const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
          const title = breaking ? `Resist — don't ${lower(label)}` : `Time to ${lower(label)}`;
          // Lead with the smallest step (2-min rule) so it's easy to start right from the notification.
          let body;
          if (breaking) {
            body = habit.starter ? `If tempted: ${habit.starter}` : "Notice the urge and let it pass — you're in control.";
          } else if (habit.starter) {
            body = `Just start — ${habit.starter}`;
          } else if (habit.trigger || habit.location) {
            body = [habit.trigger, habit.location].filter(Boolean).join(" · ");
          } else {
            body = `One small vote for ${cap(identity.label || "who you're becoming")}.`;
          }

          try {
            // Data-only message — the service worker builds the notification (no duplicates).
            await admin.messaging().send({
              token,
              data: { title, body, habitId: String(habit.id), link: "https://budgetbuddy-9d7da.web.app/" },
              webpush: { headers: { Urgency: "high", TTL: "300" } },
            });
            console.log(`reminder sent to ${uid} for "${habit.label}" at ${hhmm}`);
          } catch (err) {
            console.error("reminder push failed for", uid, err && err.code);
            if (err && (err.code === "messaging/registration-token-not-registered" ||
                        err.code === "messaging/invalid-registration-token")) {
              await tokenDoc.ref.delete().catch(() => {});   // prune dead tokens
            }
          }
        }
      }
    }
  }
);

const SYSTEM_PROMPT = `You are James Clear, author of Atomic Habits. EVERY suggestion you give must embody the book's philosophy — never generic self-help, never "try harder."

CORE PRINCIPLES you apply to every single suggestion:
- SYSTEMS OVER GOALS & MOTIVATION: Never rely on willpower, motivation, discipline, or "remember to." Design the system and the environment so the desired behavior is the path of least resistance. "You do not rise to the level of your goals; you fall to the level of your systems."
- IDENTITY-BASED HABITS: Every habit is a vote for the type of person the user wishes to become. Anchor every field to their stated identity — the aim is not to do the task, but to BECOME that person. Never suggest anything that conflicts with that identity.
- ATOMIC — SMALL & SUSTAINABLE: Always prefer the smallest sustainable step over an ambitious one. 1% better, repeated, compounds. Favor two-minute versions, tiny wins, and consistency over intensity. Never propose something big, vague, or dependent on a burst of willpower.
- HABIT STACKING & IMPLEMENTATION INTENTIONS: Anchor the cue to an existing daily habit or a specific time + place — the form "After [current habit], I will [new habit]." Make cues concrete in time and space so they are impossible to miss.

THE FOUR LAWS OF BEHAVIOR CHANGE (and how each maps to a field):
  BUILD a good habit:  1) Make it OBVIOUS (environment design + habit stacking)  2) Make it ATTRACTIVE (temptation bundling / a compelling reframe)  3) Make it EASY (reduce friction / the two-minute rule)  4) Make it SATISFYING (an immediate reward or tracking).
  BREAK a bad habit — invert each law:  1) Make it INVISIBLE (remove/hide the cue)  2) Make it UNATTRACTIVE (highlight the real cost)  3) Make it DIFFICULT (add friction / a commitment device)  4) Make it UNSATISFYING (accountability or an immediate cost).

Speak plainly and warmly, the way the book does.

Two rules for EVERY suggestion:
1. KEEP IT SHORT — a concrete phrase, not a sentence or paragraph. No filler and no explanation inside a field value.
2. ANCHOR TO THE IDENTITY — every field must reinforce and cohere with the person's stated identity; all fields together should read as one consistent identity.`;

// Both variants use the SAME JSON keys so the app maps each one to the same
// form field regardless of good/bad — only the meaning of each field inverts.
const JSON_GOOD = `Respond with ONLY a JSON object (no markdown, no code fences) with these exact string keys:
- "identity": the identity this habit votes for, phrased "I am ..." or "I am someone who ...", e.g. "I am a healthy person". Under ~45 chars.
- "label": a clear, specific habit name — this is the "I will [...]" action, a verb + object (+ quantity), e.g. "Meditate 10 minutes". Do NOT prefix it with "I will". Under ~45 chars.
- "trigger": Law 1 (obvious) — ONLY the cue anchor: a short "After [an existing daily habit or action]" clause, e.g. "After I pour my morning coffee". Do NOT include the clock time, the place, or the "I will [habit]" part — time and place are separate fields and the habit belongs in "label". Under ~90 chars.
- "time": the time of day for this habit in 24-hour "HH:MM" format (e.g. "06:00", "18:30"). If a time was provided keep it; otherwise suggest a sensible one, or "" if no specific time fits.
- "location": a short place where the habit happens, e.g. "Kitchen". If a place was provided keep it; otherwise suggest one, or "".
- "attractive": Law 2 (attractive) — a temptation bundle pairing the habit with something enjoyed. Under ~90 chars.
- "easy": Law 3 (easy) — an environment tweak that reduces friction, e.g. "Lay clothes out the night before". Under ~90 chars.
- "starter": Law 3 (easy) — the two-minute version, the smallest possible first step. Under ~60 chars.
- "satisfying": Law 4 (satisfying) — an immediate reward right after completing it. Under ~90 chars.
- "note": one short, warm sentence of coaching in James Clear's voice. Under ~160 chars.`;

const JSON_BAD = `This is a BAD habit the person wants to BREAK. Invert the Four Laws. Respond with ONLY a JSON object (no markdown, no code fences) with these exact string keys:
- "identity": the identity of the person who no longer does this, phrased "I am ...", e.g. "I am someone in control of my evenings". Under ~45 chars.
- "label": a clear, specific name for the habit being broken, e.g. "Late-night phone scrolling". Under ~45 chars.
- "trigger": Law 1 INVERTED — Make it INVISIBLE. A concrete way to remove or hide the cue from the environment, e.g. "Charge the phone in another room overnight". Under ~120 chars.
- "attractive": Law 2 INVERTED — Make it UNATTRACTIVE. Reframe the habit to highlight its real cost or how it feels afterward. Under ~120 chars.
- "easy": Law 3 INVERTED — Make it DIFFICULT. A concrete friction to add, e.g. "Log out and use a website blocker after 9pm". Under ~120 chars.
- "starter": Law 3 INVERTED — a one-time COMMITMENT DEVICE that locks in the friction, e.g. "Give the charger to a housemate at night". Under ~90 chars.
- "time": the time of day the bad habit tends to strike, 24-hour "HH:MM" (e.g. "21:00"). Keep a provided time; otherwise "" if none fits.
- "location": the place it usually happens, e.g. "Bedroom". Keep a provided place; otherwise "".
- "satisfying": Law 4 INVERTED — Make it UNSATISFYING. Add accountability or an immediate cost, e.g. "Put money in a jar for each slip; tell a friend". Under ~120 chars.
- "note": one short, warm sentence of coaching in James Clear's voice. Under ~160 chars.`;

// One-line meaning of each field, for regenerating a single field on its own.
const FIELD_DEFS = {
  good: {
    label:      'the habit name — the "I will" action (verb + object + quantity), no "I will" prefix.',
    identity:   'the identity this habit votes for, phrased "I am ...".',
    trigger:    'the cue anchor: "After [an existing action]" with time/place woven in; NO "I will" part.',
    time:       'a time of day in 24-hour "HH:MM" format, or "".',
    location:   'a short place where it happens, or "".',
    attractive: 'Law 2 (attractive) — a temptation bundle pairing it with something enjoyed.',
    easy:       'Law 3 (easy) — an environment tweak that reduces friction.',
    starter:    'Law 3 (easy) — the two-minute version, the smallest possible first step.',
    satisfying: 'Law 4 (satisfying) — an immediate reward right after completing it.',
  },
  bad: {
    label:      'a clear name for the bad habit being broken.',
    identity:   'the identity of the person who no longer does this, phrased "I am ...".',
    trigger:    'Law 1 inverted (invisible) — a concrete way to remove or hide the cue.',
    time:       'a time of day in 24-hour "HH:MM" the habit tends to strike, or "".',
    location:   'the place it usually happens, or "".',
    attractive: 'Law 2 inverted (unattractive) — reframe to highlight its real cost.',
    easy:       'Law 3 inverted (difficult) — a concrete friction to add.',
    starter:    'Law 3 inverted — a one-time commitment device that locks in the friction.',
    satisfying: 'Law 4 inverted (unsatisfying) — add accountability or an immediate cost.',
  },
};

exports.askJamesClear = onCall(
  { secrets: [GEMINI_API_KEY], cors: true, timeoutSeconds: 60 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Please sign in to use the coach.");
    }

    const { mode = "create", habit = {}, field = "" } = request.data || {};
    const kind = habit.kind === "bad" ? "bad" : "good";
    const label = String(habit.label || "").trim().slice(0, 120);
    // A name is required for everything EXCEPT suggesting the name itself,
    // which is generated from the chosen identity.
    if (!label && field !== "label") {
      throw new HttpsError("invalid-argument", "A habit name is required.");
    }

    const identity  = String(habit.identity || "").trim().slice(0, 80);
    const time      = String(habit.time || "").trim().slice(0, 20);
    const location  = String(habit.location || "").trim().slice(0, 60);
    const frequency = String(habit.frequency || "").trim().slice(0, 60);

    const current = {
      cue:         String(habit.trigger || "").trim().slice(0, 200),
      bundle:      String(habit.attractive || "").trim().slice(0, 200),
      environment: String(habit.easy || "").trim().slice(0, 200),
      twoMinute:   String(habit.starter || "").trim().slice(0, 200),
      reward:      String(habit.satisfying || "").trim().slice(0, 200),
    };

    const kindLine = kind === "bad"
      ? `This is a BAD habit to BREAK.`
      : `This is a GOOD habit to BUILD.`;

    // Single-field regenerate: improve just one field and return {value, note}.
    const wantField = field && FIELD_DEFS[kind][field] ? field : "";
    const currentByField = {
      label, identity, trigger: current.cue, time, location,
      attractive: current.bundle, easy: current.environment,
      starter: current.twoMinute, satisfying: current.reward,
    };

    const userPrompt = wantField
      ? (wantField === "label"
          // Suggest the habit NAME itself, generated from the chosen identity.
          ? `${kindLine} Suggest ONE specific habit NAME — the "I will ..." action (a verb + object, optionally a quantity), with NO "I will" prefix — for a person becoming: "${identity || "(none given)"}".` +
            (label ? ` Their current draft name is "${label}"; offer a clearer, more specific and sustainable alternative — do not just repeat it.` : ` It should be a small, sustainable, identity-reinforcing habit (think two-minute-rule small, not ambitious).`) +
            `\nContext — Time: ${time || "(none)"} · Place: ${location || "(none)"} · Frequency: ${frequency || "(none)"}. Keep it SHORT and concrete.` +
            `\n\nRespond with ONLY a JSON object (no markdown, no code fences): {"value": "<the habit name>", "note": "<one short reason in James Clear's voice>"}`
          : `${kindLine} Improve ONLY the "${wantField}" field for the habit "${label}". This field means: ${FIELD_DEFS[kind][wantField]}` +
            `\nContext — Identity: ${identity || "(none)"} · Time: ${time || "(none)"} · Place: ${location || "(none)"} · Frequency: ${frequency || "(none)"}.` +
            `\nThe rest of this habit so far — cue: "${current.cue || "(empty)"}"; attractive: "${current.bundle || "(empty)"}"; easy: "${current.environment || "(empty)"}"; two-minute: "${current.twoMinute || "(empty)"}"; reward: "${current.reward || "(empty)"}". Your suggestion MUST fit and cohere with these and reinforce the identity — do not contradict them.` +
            `\nThe current value of "${wantField}" is: "${currentByField[wantField] || "(empty)"}". Give a NEW, clearly different and better value for just this field — do not repeat the current one. Keep it SHORT and fully consistent with the identity "${identity || "(none)"}".` +
            `\n\nRespond with ONLY a JSON object (no markdown, no code fences): {"value": "<the improved value>", "note": "<one short reason in James Clear's voice>"}`)
      :
      (mode === "review"
        ? `${kindLine} Review and improve it against the ${kind === "bad" ? "inverted " : ""}Four Laws. Rewrite each field so it is more specific and effective; keep what already works. Habit: "${label}".` +
          `\nIdentity to reinforce: ${identity || "(none given)"}.` +
          `\nTime: ${time || "(none)"} · Place: ${location || "(none)"} · Frequency: ${frequency || "(none)"}.` +
          `\nCurrent fields — trigger: "${current.cue}"; attractive: "${current.bundle}"; easy: "${current.environment}"; starter: "${current.twoMinute}"; satisfying: "${current.reward}".`
        : `${kindLine} Design it from scratch. Habit: "${label}".` +
          `\nIdentity to reinforce: ${identity || "(none given)"}.` +
          `\nTime: ${time || "(none)"} · Place: ${location || "(none)"} · Frequency: ${frequency || "(none)"}.` +
          `\nFill in every field with a concrete suggestion tailored to this habit and identity.`) +
      `\n\n${kind === "bad" ? JSON_BAD : JSON_GOOD}`;

    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY.value() });

    let response;
    try {
      response = await ai.models.generateContent({
        // flash-lite has a much larger free-tier daily quota than the flagship
        // flash model (which caps at ~20/day) — plenty for short habit suggestions.
        model: "gemini-flash-lite-latest",
        contents: userPrompt,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          responseMimeType: "application/json",
          temperature: 0.7,
          // gemini-flash-latest is a "thinking" model — thinking is billed
          // against the output budget, so give plenty of room or the JSON
          // gets truncated mid-object.
          maxOutputTokens: 8192,
        },
      });
    } catch (err) {
      console.error("Gemini API error:", err);
      if (err && (err.status === 429 || err.code === 429)) {
        throw new HttpsError("resource-exhausted", "James is resting — the free daily limit was reached. Please try again later.");
      }
      throw new HttpsError("internal", "The coach is unavailable right now. Please try again.");
    }

    const text = (response.text || "").trim();

    let suggestion;
    try {
      suggestion = JSON.parse(text);
    } catch {
      // Defensive: pull the JSON object out even if wrapped in fences / prose.
      const m = text.match(/\{[\s\S]*\}/);
      if (m) {
        try { suggestion = JSON.parse(m[0]); } catch { /* fall through */ }
      }
    }
    if (!suggestion || typeof suggestion !== "object") {
      console.error("Failed to parse model output:", text.slice(0, 500));
      throw new HttpsError("internal", "Got an unexpected response. Please try again.");
    }

    return wantField ? { mode: "field", field: wantField, suggestion } : { mode, kind, suggestion };
  }
);
