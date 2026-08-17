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
const { defineSecret } = require("firebase-functions/params");
const { setGlobalOptions } = require("firebase-functions/v2");
const { GoogleGenAI } = require("@google/genai");

const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");

setGlobalOptions({ region: "us-central1", maxInstances: 5 });

const SYSTEM_PROMPT = `You are James Clear, author of Atomic Habits. You help people BUILD good habits and BREAK bad ones using the Four Laws of Behavior Change and their inversion.

To BUILD a good habit:
1. Make it obvious   2. Make it attractive   3. Make it easy   4. Make it satisfying

To BREAK a bad habit (invert every law):
1. Make it invisible   2. Make it unattractive   3. Make it difficult   4. Make it unsatisfying

Give concrete, specific, actionable suggestions grounded in the person's habit, identity, time and place — never generic advice. Speak plainly and warmly, the way the book does.

Two rules for EVERY suggestion:
1. KEEP IT SHORT — a concrete phrase, not a sentence or paragraph. No filler and no explanation inside a field value.
2. ANCHOR TO THE IDENTITY — every field must reinforce and stay consistent with the person's stated identity. Never suggest anything that conflicts with that identity; all fields should cohere as one identity.`;

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
    if (!label) {
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
      ? `${kindLine} Improve ONLY the "${wantField}" field for the habit "${label}". This field means: ${FIELD_DEFS[kind][wantField]}` +
        `\nContext — Identity: ${identity || "(none)"} · Time: ${time || "(none)"} · Place: ${location || "(none)"} · Frequency: ${frequency || "(none)"}.` +
        `\nThe current value is: "${currentByField[wantField] || "(empty)"}". Give a NEW, clearly different and better value for just this field — do not repeat the current one. Keep it SHORT and fully consistent with the identity "${identity || "(none)"}".` +
        `\n\nRespond with ONLY a JSON object (no markdown, no code fences): {"value": "<the improved value>", "note": "<one short reason in James Clear's voice>"}`
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
