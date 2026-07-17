import { useState, useEffect, useCallback, useRef, useMemo, useId, memo, Fragment } from "react";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut as fbSignOut } from "firebase/auth";

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
const _fbApp = getApps().length ? getApps()[0] : initializeApp(_fbConfig);
const _db    = getFirestore(_fbApp);
const _auth  = getAuth(_fbApp);

function identitiesRef(uid) { return doc(_db, "users", uid, "atomicHabits", "identities"); }
function checkInsRef(uid)    { return doc(_db, "users", uid, "atomicHabits", "checkIns"); }
function dailyTasksRef(uid)  { return doc(_db, "users", uid, "atomicHabits", "dailyTasks"); }

// Detect missing env vars early — surfaces a helpful screen instead of cryptic Firebase errors
const _envMissing = Object.entries(_fbConfig).filter(([, v]) => !v).map(([k]) => k);

// ─── THEME PALETTE — Ocean Depth ─────────────────────────────────────────────
// Defined early so ALL helpers and components can reference T safely.
const T = {
  bg:      "#F0F9FF",
  surface: "#FFFFFF",
  surf2:   "#E0F2FE",
  border:  "#BAE6FD",
  border2: "#7DD3FC",
  text:    "#0C4A6E",
  text2:   "#0369A1",
  muted:   "#3B7EA6",   // darkened from #5B9EC9 → WCAG AA contrast on #F0F9FF
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
      flex:1, padding:"7px 4px", fontSize:13, fontWeight:600, border:"none",
      borderRadius:8, cursor:"pointer", transition:"all 0.15s",
      background: active ? T.accent : "transparent",
      color: active ? "#fff" : T.muted,
    }} aria-pressed={active}>{label}</button>
  );

  const shortcut = (label, active, onClick) => (
    <button onClick={onClick} style={{
      padding:"5px 12px", borderRadius:20, fontSize:12, fontWeight:600,
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
                    fontSize:12, fontWeight:700, cursor:"pointer",
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
          <div style={{ fontSize:11, color:T.muted, marginBottom:8 }}>Select one or more dates</div>
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
                    fontSize:11, fontWeight:600, cursor:"pointer",
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
                    fontSize:10, fontWeight:600, cursor:"pointer",
                    WebkitTapHighlightColor:"transparent", transition:"all 0.15s",
                  }}>Last day</button>
              );
            })()}
          </div>
          <div style={{ fontSize:11, color:T.muted, marginTop:8, lineHeight:1.5 }}>
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
    satisfying: initial.satisfying || "",
    time:       initial.time       || "",
    location:   initial.location   || "",
    identityId: initial.identityId || identities[0]?.id || "",
    frequency:  initial.frequency  || DEFAULT_FREQUENCY,
  });
  const [submitted, setSubmitted] = useState(false);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const valid = form.label.trim().length > 0 && form.identityId;

  const fId = useId();
  const ids = {
    label:      fId + "-label",
    identityId: fId + "-identity",
    trigger:    fId + "-trigger",
    attractive: fId + "-attractive",
    easy:       fId + "-easy",
    satisfying: fId + "-satisfying",
    time:       fId + "-time",
    location:   fId + "-location",
  };

  return (
    <div style={{ padding: "0 20px 20px" }}>
      <label htmlFor={ids.label} style={S.fieldLabel}>Habit Name *</label>
      <input id={ids.label} style={S.input} value={form.label} onChange={e=>set("label",e.target.value)} placeholder="e.g. Meditate 10 min" autoFocus maxLength={80} />

      <label htmlFor={ids.identityId} style={S.fieldLabel}>Identity *</label>
      <select id={ids.identityId} style={S.input} value={form.identityId} onChange={e=>set("identityId",e.target.value)}>
        {identities.map(i=><option key={i.id} value={i.id}>{i.icon} {i.label}</option>)}
      </select>

      <label htmlFor={ids.trigger} style={S.fieldLabel}><span aria-hidden="true">⚡</span> Trigger (what cues this habit?)</label>
      <input id={ids.trigger} style={S.input} value={form.trigger} onChange={e=>set("trigger",e.target.value)} placeholder="e.g. After morning coffee" maxLength={120} />

      {/* ── Four Laws — optional, shown on the habit card as an expandable "Four Laws" section ── */}
      <div style={{ marginTop:18, marginBottom:2, fontSize:11, letterSpacing:"0.08em", color:T.primary, fontWeight:700, textTransform:"uppercase" }}>
        Four Laws of Behavior Change <span style={{ color:T.muted, fontWeight:500, textTransform:"none", letterSpacing:"normal" }}>(optional)</span>
      </div>

      <label htmlFor={ids.attractive} style={S.fieldLabel}>Make it attractive</label>
      <input id={ids.attractive} style={S.input} value={form.attractive} onChange={e=>set("attractive",e.target.value)} placeholder="e.g. Pair with my morning coffee" maxLength={140} />

      <label htmlFor={ids.easy} style={S.fieldLabel}>Make it easy</label>
      <input id={ids.easy} style={S.input} value={form.easy} onChange={e=>set("easy",e.target.value)} placeholder="e.g. Book stays on the counter" maxLength={140} />

      <label htmlFor={ids.satisfying} style={S.fieldLabel}>Make it satisfying</label>
      <input id={ids.satisfying} style={S.input} value={form.satisfying} onChange={e=>set("satisfying",e.target.value)} placeholder="e.g. Move a bead on the reading jar" maxLength={140} />

      <label htmlFor={ids.time} style={S.fieldLabel}><span aria-hidden="true">🕐</span> Time</label>
      <input id={ids.time} style={S.input} type="time" value={form.time} onChange={e=>set("time",e.target.value)} />

      <label htmlFor={ids.location} style={S.fieldLabel}><span aria-hidden="true">📍</span> Location</label>
      <input id={ids.location} style={S.input} value={form.location} onChange={e=>set("location",e.target.value)} placeholder="e.g. Kitchen" maxLength={50} />

      <label style={S.fieldLabel}><span aria-hidden="true">🔁</span> Frequency</label>
      <FrequencyPicker value={form.frequency} onChange={v=>set("frequency",v)} />

      <div style={{ display:"flex", gap:8, marginTop:20 }}>
        <button type="button" style={S.btnSecondary} onClick={onCancel}>Cancel</button>
        <button type="button" style={{ ...S.btnPrimary, opacity: valid?1:0.4 }}
          onClick={() => { setSubmitted(true); if (valid) onSave(form); }}
          aria-disabled={!valid}>
          {mode==="add" ? "Add Habit" : "Save Changes"}
        </button>
      </div>
      {submitted && !valid && (
        <div role="alert" style={{ fontSize:12, color:T.red, marginTop:8, textAlign:"center" }}>
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
        <div role="alert" style={{ fontSize:12, color:T.red, marginTop:8, textAlign:"center" }}>
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
        <p id={msgId} style={{ color:T.text2, fontSize:15, lineHeight:1.7, marginTop:8 }}>{message}</p>
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
  const [celebrationHabit, setCelebrationHabit] = useState(null);
  const [identityVote, setIdentityVote] = useState(null); // { label, color, icon } — shown after each non-milestone completion
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

  // Modal states
  const [modal,    setModal]    = useState(null);
  const [modalCtx, setModalCtx] = useState(null);

  const [todayKey, setTodayKey] = useState(getTodayKey);
  const todayData    = data[todayKey]    || {};
  const selectedData = data[selectedDate] || {};
  const allHabits    = useMemo(() => identities.flatMap(i => i.habits), [identities]);

  // ── Scores — must be before early returns (Rules of Hooks) ──
  const scheduledToday = useMemo(
    () => allHabits.filter(h => isScheduledOn(h.frequency, selectedDate)),
    [allHabits, selectedDate]
  );
  const { totalDone, totalTotal, pct } = useMemo(() => {
    const done  = scheduledToday.filter(h => selectedData[h.id]).length;
    const total = scheduledToday.length;
    return { totalDone: done, totalTotal: total, pct: total > 0 ? Math.round((done/total)*100) : 0 };
  }, [scheduledToday, selectedData]);

  // ── Debounced Firestore saves ──
  const idTimer   = useRef(null);
  const ciTimer   = useRef(null);
  const isFirstId = useRef(true);
  const isFirstCi = useRef(true);

  // ── Streak cache — avoids 400-iteration loop per habit on every render ──
  const streakCacheRef      = useRef({});
  // ── Timers stored in refs so they can be cleared on re-fire or unmount ──
  const celebrationTimerRef = useRef(null);
  const justCheckedTimerRef = useRef(null);
  const identityVoteTimerRef = useRef(null);
  const undoTimerRef        = useRef(null);
  const dtTimer             = useRef(null);
  const isFirstDt           = useRef(true);
  const hasLoadedRef        = useRef(false); // saves stay blocked until the initial fetch succeeds — otherwise a failed load + local edit could overwrite cloud data with empty state

  // ── Auth listener ──
  useEffect(() => {
    return onAuthStateChanged(_auth, async (u) => {
      isFirstId.current = true;
      isFirstCi.current = true;
      isFirstDt.current = true;
      hasLoadedRef.current = false;
      streakCacheRef.current = {};
      setUser(u);
      if (u) {
        setDataLoading(true);
        try {
          const [idSnap, ciSnap, dtSnap] = await Promise.all([
            getDoc(identitiesRef(u.uid)),
            getDoc(checkInsRef(u.uid)),
            getDoc(dailyTasksRef(u.uid)),
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
    clearTimeout(idTimer.current);
    idTimer.current = setTimeout(() => {
      setSyncing(true);
      setSaveError(false);
      setDoc(identitiesRef(user.uid), { data: identities })
        .catch(err => { console.error("Identity save failed:", err); setSaveError(true); })
        .finally(() => setSyncing(false));
    }, 800);
  }, [identities, user]);

  useEffect(() => {
    if (!user || isFirstCi.current) { isFirstCi.current = false; return; }
    if (!hasLoadedRef.current) return;
    clearTimeout(ciTimer.current);
    ciTimer.current = setTimeout(() => {
      setSyncing(true);
      setSaveError(false);
      setDoc(checkInsRef(user.uid), { data })
        .catch(err => { console.error("Check-in save failed:", err); setSaveError(true); })
        .finally(() => setSyncing(false));
    }, 800);
  }, [data, user]);

  useEffect(() => {
    if (!user || isFirstDt.current) { isFirstDt.current = false; return; }
    if (!hasLoadedRef.current) return;
    clearTimeout(dtTimer.current);
    dtTimer.current = setTimeout(() => {
      setSyncing(true);
      setSaveError(false);
      setDoc(dailyTasksRef(user.uid), { data: dailyTasks })
        .catch(err => { console.error("Daily tasks save failed:", err); setSaveError(true); })
        .finally(() => setSyncing(false));
    }, 800);
  }, [dailyTasks, user]);

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
        if (data[key] && data[key][habitId]) {
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

  // Invalidate streak cache whenever data changes
  useEffect(() => { streakCacheRef.current = {}; }, [data]);

  // ── Toggle — must be before early returns ──
  const toggle = useCallback((habitId, frequency, identity) => {
    let wasChecked;
    setData(prev=>{
      const day=prev[selectedDate]||{};
      wasChecked = !!day[habitId];
      return {...prev,[selectedDate]:{...day,[habitId]:!day[habitId]}};
    });
    clearTimeout(justCheckedTimerRef.current);
    setJustChecked(habitId);
    justCheckedTimerRef.current = setTimeout(()=>setJustChecked(null),600);
    const streak = getStreakForHabit(habitId, frequency) + 1;
    const milestone = MILESTONES.find(m=>m.days===streak);
    if(milestone && !wasChecked) {
      clearTimeout(celebrationTimerRef.current);
      setCelebrationHabit({habitId,milestone});
      celebrationTimerRef.current = setTimeout(()=>setCelebrationHabit(null),3500);
    }
    if (!wasChecked && identity) {
      // Every check-in is a vote for the identity — surface that every time,
      // even alongside a milestone toast (they're stacked, not exclusive).
      clearTimeout(identityVoteTimerRef.current);
      setIdentityVote({ label: identity.label, color: identity.color, icon: identity.icon });
      identityVoteTimerRef.current = setTimeout(()=>setIdentityVote(null), 1800);
    }
  }, [selectedDate, getStreakForHabit]);

  // Cleanup all timers on unmount
  useEffect(() => () => {
    clearTimeout(celebrationTimerRef.current);
    clearTimeout(justCheckedTimerRef.current);
    clearTimeout(identityVoteTimerRef.current);
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

  // ── Daily task CRUD (stable callbacks — only touch setDailyTasks) ──
  // Tasks carry a simple `priority`: "H" | "M" | "L" (see PRIORITIES below).
  const addTask = useCallback((dateKey, text, priority = "M") => {
    setDailyTasks(prev => {
      const existing = prev[dateKey] || [];
      return { ...prev, [dateKey]: [...existing, { id: uid(), text, done: false, priority }] };
    });
  }, []);

  const toggleTask = useCallback((dateKey, taskId) => {
    setDailyTasks(prev => ({
      ...prev,
      [dateKey]: (prev[dateKey] || []).map(t =>
        t.id === taskId ? { ...t, done: !t.done } : t
      ),
    }));
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
      return {
        ...prev,
        [dateKey]: list.map(t => t.id === taskId ? { ...t, carried: true } : t),
        [nextKey]: [...nextList, { ...src, id: uid(), done: false, carried: false, carriedFrom: taskId }],
      };
    });
  }, []);

  const editTask = useCallback((dateKey, taskId, text) => {
    setDailyTasks(prev => ({
      ...prev,
      [dateKey]: (prev[dateKey] || []).map(t => t.id === taskId ? { ...t, text } : t),
    }));
  }, []);

  const setTaskPriority = useCallback((dateKey, taskId, priority) => {
    setDailyTasks(prev => ({
      ...prev,
      [dateKey]: (prev[dateKey] || []).map(t => t.id === taskId ? { ...t, priority } : t),
    }));
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
      const newToday = [...todayTasks, ...toCarry.map(t => ({ ...t, id: uid(), done: false, carriedFrom: t.id }))];
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
    performRollover(); // safe on every mount — carriedFrom dedup prevents duplicates
    let t = setTimeout(function tick() {
      performRollover();
      t = setTimeout(tick, msToMidnight());
    }, msToMidnight());
    return () => clearTimeout(t);
  }, [user, dataLoading, performRollover]);

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
        <div style={{ fontSize:13, color:T.text2, marginBottom:16, textAlign:"center", lineHeight:1.7 }}>
          Missing Firebase environment variables. Copy <code>.env.example</code> → <code>.env</code> and fill in your values.
        </div>
        <div style={{ background:T.red+"12", border:`1px solid ${T.red}44`, borderRadius:12, padding:"12px 16px", width:"100%", maxWidth:340 }}>
          {_envMissing.map(k => <div key={k} style={{ fontSize:12, fontFamily:"monospace", color:T.red, padding:"2px 0" }}>✗ {k}</div>)}
        </div>
      </div>
    );
  }
  if (user === undefined) {
    return (
      <div style={{ ...S.root, alignItems:"center", justifyContent:"center" }}>
        <div style={S.spinner} aria-label="Loading" role="status"/>
        <div style={{ color:T.muted, fontSize:14, marginTop:16 }}>Loading…</div>
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
          <div style={{ fontSize:14, color:T.muted, textAlign:"center", lineHeight:1.6 }}>
            Sign in with your Google account to sync your habits across devices.
          </div>
          {signInError && (
            <div role="alert" style={{ fontSize:13, color:T.red, background:T.red+"12", border:`1px solid ${T.red}44`, borderRadius:10, padding:"10px 14px", textAlign:"center", width:"100%", maxWidth:320 }}>
              {signInError}
            </div>
          )}
          <button onClick={signIn} disabled={signingIn} aria-busy={signingIn}
            style={{ width:"100%", maxWidth:320, display:"flex", alignItems:"center", justifyContent:"center", gap:12, fontSize:15, fontWeight:700, padding:"15px 20px", background:"#fff", border:`1.5px solid ${T.border}`, borderRadius:14, color:T.text, cursor: signingIn ? "wait" : "pointer", fontFamily:"inherit", WebkitTapHighlightColor:"transparent", boxShadow:"0 1px 4px #00000010", opacity: signingIn ? 0.65 : 1, transition:"opacity 0.2s" }}>
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
        <div style={{ color:T.muted, fontSize:14, marginTop:16 }}>Loading your habits…</div>
      </div>
    );
  }

  // ── CRUD: Habits ──
  const addHabit = ({ label, trigger, attractive, easy, satisfying, time, location, identityId, frequency }) => {
    setIdentities(prev => prev.map(ident =>
      ident.id !== identityId ? ident :
      { ...ident, habits: [...ident.habits, { id: uid(), label, trigger, attractive, easy, satisfying, time, location, frequency: frequency || DEFAULT_FREQUENCY }] }
    ));
    setModal(null);
  };

  const updateHabit = ({ label, trigger, attractive, easy, satisfying, time, location, identityId: newIdentityId, frequency }) => {
    const { identityId: oldIdentityId, habitId } = modalCtx;
    const freq = frequency || DEFAULT_FREQUENCY;
    if (newIdentityId === oldIdentityId) {
      setIdentities(prev => prev.map(ident =>
        ident.id !== oldIdentityId ? ident :
        { ...ident, habits: ident.habits.map(h => h.id !== habitId ? h : { ...h, label, trigger, attractive, easy, satisfying, time, location, frequency: freq }) }
      ));
    } else {
      setIdentities(prev => {
        const habitData = prev.find(i => i.id === oldIdentityId)?.habits.find(h => h.id === habitId);
        return prev.map(ident => {
          if (ident.id === oldIdentityId) return { ...ident, habits: ident.habits.filter(h => h.id !== habitId) };
          if (ident.id === newIdentityId) return { ...ident, habits: [...ident.habits, { ...habitData, label, trigger, attractive, easy, satisfying, time, location, frequency: freq }] };
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
          background:T.red, color:"#fff", fontSize:13, fontWeight:600,
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
          background:"#374151", color:"#fff", fontSize:13, fontWeight:600,
          textAlign:"center", padding:"10px 20px",
          paddingTop:"calc(env(safe-area-inset-top,0px) + 10px)",
        }}>
          📶 You're offline — changes will sync when reconnected
        </div>
      )}

      {/* ── Celebration Toast — dead center of the screen; shifts up a touch if the vote toast is also showing ── */}
      {celebrationHabit && (
        <div style={{
          position: "fixed",
          top: identityVote ? "calc(50% - 48px)" : "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "calc(100% - 48px)",
          maxWidth: 360,
          background: T.surface,
          border: `2px solid ${T.gold}`,
          borderRadius: 18,
          padding: "16px 20px",
          display: "flex",
          alignItems: "center",
          gap: 14,
          zIndex: 999,
          boxShadow: "0 12px 40px #00000030",
        }} className="toast-in-center" role="alert" aria-live="assertive">
          <span style={{fontSize:28}} aria-hidden="true">{celebrationHabit.milestone.emoji}</span>
          <div>
            <div style={{fontWeight:700,fontSize:14,color:T.text}}>{celebrationHabit.milestone.label}!</div>
            <div style={{fontSize:12,color:T.muted}}>{celebrationHabit.milestone.days}-day streak achieved 🎉</div>
          </div>
        </div>
      )}

      {/* ── Identity Vote Toast — dead center of the screen; shifts down a touch if the milestone toast is also showing ── */}
      {identityVote && (
        <div style={{
          position: "fixed",
          top: celebrationHabit ? "calc(50% + 48px)" : "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "calc(100% - 48px)",
          maxWidth: 360,
          background: T.surface,
          border: `2px solid ${identityVote.color}`,
          borderRadius: 18,
          padding: "16px 20px",
          display: "flex",
          alignItems: "center",
          gap: 14,
          zIndex: 999,
          boxShadow: "0 12px 40px #00000030",
        }} className="toast-in-center" role="status" aria-live="polite">
          <span style={{fontSize:24}} aria-hidden="true">{identityVote.icon}</span>
          <div>
            <div style={{fontWeight:700,fontSize:14,color:T.text}}>Vote cast <span aria-hidden="true">🗳️</span></div>
            <div style={{fontSize:12,color:identityVote.color,fontWeight:600}}>for becoming {shortLabel(identityVote.label)}</div>
          </div>
        </div>
      )}

      {/* ── Modals ── */}
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
              : view==="week" ? "This Week"
              : view==="streaks" ? "Streaks"
              : "Manage"}
          </h1>
          <div style={S.dateLabel}>
            {view === "today"
              ? new Date(selectedDate + "T12:00:00").toLocaleDateString(navigator.language||undefined,{weekday:"long",day:"numeric",month:"short"})
              : new Date().toLocaleDateString(navigator.language||undefined,{weekday:"long",day:"numeric",month:"short"})}
          </div>
        </div>
        <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:6 }}>
          <button onClick={()=>fbSignOut(_auth)} title={user.email||undefined} style={{ background:"transparent", border:`1px solid ${T.border}`, borderRadius:20, fontSize:11, color:T.muted, padding:"3px 10px", cursor:"pointer", fontFamily:"inherit", maxWidth:120, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
            {user.displayName ? `${user.displayName.split(" ")[0]} · Sign out` : "Sign out"}
          </button>
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
                  <text x="34" y="39" textAnchor="middle" fill={T.text} fontSize="14" fontWeight="800" fontFamily={FONT_DISPLAY} style={{fontVariantNumeric:"tabular-nums"}} aria-hidden="true">
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
            identities={identities}
            allHabits={allHabits}
            todayData={selectedData}
            allData={data}
            toggle={toggle}
            justChecked={justChecked}
            getStreakForHabit={getStreakForHabit}
            openEditHabit={openEditHabit}
            setModal={setModal}
            openAddHabit={openAddHabit}
            openAddIdentity={openAddIdentity}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            todayKey={todayKey}
            dailyTasks={dailyTasks}
            addTask={addTask}
            toggleTask={toggleTask}
            deleteTask={deleteTask}
            editTask={editTask}
            setTaskPriority={setTaskPriority}
            deferTask={deferTask}
          />
        )}

        {view==="week"    && <WeekView data={data} todayKey={todayKey} identities={identities}/>}
        {view==="streaks" && <StreaksView data={data} getStreak={getStreakForHabit} identities={identities}/>}
        {view==="manage"  && (
          <ManageView
            identities={identities}
            onAddHabit={openAddHabit}
            onEditHabit={openEditHabit}
            onDeleteHabit={openDeleteHabit}
            onAddIdentity={openAddIdentity}
            onEditIdentity={openEditIdentity}
            onDeleteIdentity={openDeleteIdentity}
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
          maxWidth:"calc(100vw - 32px)", width:390, fontSize:13, fontWeight:600,
        }}>
          <span style={{flex:1,lineHeight:1.4}}>{undoDelete.label}</span>
          <button
            onClick={() => {
              undoDelete.restore();
              clearTimeout(undoTimerRef.current);
              setUndoDelete(null);
            }}
            style={{ background:"transparent", border:"1.5px solid rgba(255,255,255,0.45)", borderRadius:8, color:"#fff", fontSize:12, fontWeight:700, padding:"5px 12px", cursor:"pointer", flexShrink:0, WebkitTapHighlightColor:"transparent" }}>
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
          {id:"today",   icon:"☀️",  label:"Today"},
          {id:"week",    icon:"📅",  label:"Week"},
          {id:"streaks", icon:"🔥",  label:"Streaks"},
          {id:"manage",  icon:"⚙️",  label:"Manage"},
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
const ManageView = memo(function ManageView({ identities, onAddHabit, onEditHabit, onDeleteHabit, onAddIdentity, onEditIdentity, onDeleteIdentity }) {
  return (
    <div style={S.content}>
      <div style={{...S.card,padding:"14px 16px",background:`linear-gradient(135deg,rgba(2,132,199,0.07),rgba(245,158,11,0.04))`}}>
        <div style={{...S.cardLabel,color:T.primary,marginBottom:4}}>
          <span aria-hidden="true">🗂</span> Manage Your System
        </div>
        <div style={{fontSize:13,color:T.text2,lineHeight:1.5}}>Add, edit, or delete your identities and habits.</div>
      </div>

      {identities.length === 0 && (
        <div style={{textAlign:"center",padding:"40px 16px",color:T.muted}}>
          <div style={{fontSize:40,marginBottom:12}} aria-hidden="true">🌱</div>
          <div style={{fontSize:15,fontWeight:700,color:T.text,marginBottom:6}}>No identities yet</div>
          <div style={{fontSize:13,lineHeight:1.6}}>Create an identity to start tracking habits.</div>
        </div>
      )}

      {identities.map(identity=>(
        <div key={identity.id} style={S.card}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
            <span style={{fontSize:24}} aria-hidden="true">{identity.icon}</span>
            <div style={{flex:1}}>
              <div style={{...S.cardLabel,color:identity.color}}>{identity.label}</div>
              <div style={{fontSize:11,color:T.muted,marginTop:2,fontWeight:500}}>{identity.habits.length} habit{identity.habits.length!==1?"s":""}</div>
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
              {identity.habits.map(habit=>(
                <div key={habit.id} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 0",borderBottom:`1px solid ${T.surf2}`}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,color:T.text,fontWeight:600}}>{habit.label}</div>
                    {habit.trigger&&<div style={{fontSize:11,color:T.muted,marginTop:2}}><span aria-hidden="true">⚡</span> {habit.trigger}</div>}
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
            <div style={{fontSize:12,color:T.muted,marginBottom:12,textAlign:"center",padding:"8px 0"}}>No habits yet — add one below</div>
          )}

          <button onClick={()=>onAddHabit(identity.id)} style={{...S.addHabitBtn,borderColor:identity.color+"55"}}>
            <span style={{fontSize:16,color:identity.color,fontWeight:700}} aria-hidden="true">+</span>
            <span style={{fontSize:13,color:T.text2}}>Add habit to {shortLabel(identity.label)}</span>
          </button>
        </div>
      ))}

      <button onClick={onAddIdentity} style={S.addIdentityBtn}>+ Add New Identity</button>
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

// Collapse a time-sorted habit list into runs of consecutive same-identity
// habits — each run renders as one IdentityGroupCard with a shared band
function groupByIdentityRuns(items) {
  const groups = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last.identity.id === item.identity.id) last.items.push(item);
    else groups.push({ identity: item.identity, items: [item] });
  }
  return groups;
}

// ─── HABIT ROW ────────────────────────────────────────────────────────────────
// One habit inside an IdentityGroupCard: trigger cue → action row → meta.
function HabitRow({ habit, identity, checked, streak, toggle, openEditHabit, weekTrail, first }) {
  const next = getNextMilestone(streak);
  const [expanded, setExpanded] = useState(false);

  // Laws 2-4 — law 1 (cue) is already shown above as the trigger banner, so it's
  // not repeated here. Only laws the user actually filled in get a row.
  const fourLaws = [
    { key:"attractive", n:2, label:"Make it attractive", color:"#534AB7", bg:"#EEEDFE", value: habit.attractive },
    { key:"easy",       n:3, label:"Make it easy",        color:"#0F6E56", bg:"#E1F5EE", value: habit.easy },
    { key:"satisfying", n:4, label:"Make it satisfying",  color:"#854F0B", bg:"#FAEEDA", value: habit.satisfying },
  ].filter(l => l.value);
  const hasFourLaws = !!habit.trigger || fourLaws.length > 0;

  // Meta line under the label: time · location · frequency (if not every day) · next badge countdown
  const freq = habit.frequency;
  const isEveryDay = freq && freq.cadence === "weekly" && (freq.days || []).length === 7;
  const metaParts = [
    habit.time && to24h(habit.time),
    habit.location,
    freq && !isEveryDay && getFreqLabel(freq),
    next && streak > 0 && `${next.days - streak}d to ${next.label}`,
  ].filter(Boolean);

  return (
    <div style={{
      position: "relative",
      background: checked ? identity.color + "1f" : "transparent",
      borderTop: first ? "none" : `1px solid ${identity.color}22`,
      transition: "background 0.2s ease",
    }}>

      {/* ── Edit button ── */}
      <button
        onClick={e => { e.stopPropagation(); openEditHabit(identity.id, habit); }}
        aria-label={`Edit habit: ${habit.label}`}
        style={{
          position: "absolute", top: 2, right: 0, zIndex: 1,
          background: "transparent", border: "none",
          fontSize: 12, color: T.muted, cursor: "pointer",
          padding: "8px 10px", lineHeight: 1, WebkitTapHighlightColor: "transparent",
        }}
      >
        <span aria-hidden="true">✎</span>
      </button>

      {/* ── Tap target ── */}
      <button
        className="habit-toggle"
        onClick={() => toggle(habit.id, habit.frequency, identity)}
        aria-pressed={checked}
        aria-label={checked ? `Uncheck: ${habit.label}` : `Check: ${habit.label}`}
        style={{
          display: "flex", flexDirection: "column",
          width: "100%", padding: "9px 34px 10px 12px",
          background: "transparent", border: "none",
          cursor: "pointer", textAlign: "left",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        {/* Trigger — the cue that prompts the action */}
        {habit.trigger && (
          <div style={{
            display: "flex", alignItems: "center", gap: 5, marginBottom: 7,
            fontSize: 11.5, color: T.muted, minWidth: 0, maxWidth: "100%",
          }}>
            <span style={{ flexShrink: 0 }} aria-hidden="true">⚡</span>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{habit.trigger}</span>
          </div>
        )}

        {/* Circle + label + streak, single compact row */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, width: "100%" }}>
          <div aria-hidden="true" style={{
            width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
            border: `2px solid ${identity.color}`,
            background: checked ? identity.color : "transparent",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.2s",
          }}>
            {checked && <span style={{ fontSize: 11, color: "#fff", fontWeight: 900, lineHeight: 1 }} className="check-pop">✓</span>}
          </div>

          <div style={{
            flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, lineHeight: 1.25,
            color: T.text,
            transition: "color 0.2s",
          }}>
            {habit.label}
          </div>

          {streak >= 2 && (
            <span style={{
              fontSize: 10, fontWeight: 700, color: "#B45309", flexShrink: 0, whiteSpace: "nowrap",
              background: T.gold + "1f", padding: "2px 7px", borderRadius: 20,
            }} aria-label={`${streak} day streak`}>
              <span aria-hidden="true">🔥</span> {streak}d
            </span>
          )}
        </div>

        {/* Meta line — time, location, frequency, next-badge countdown, all inline */}
        {metaParts.length > 0 && (
          <div style={{ fontSize: 10.5, color: T.muted, marginTop: 4, marginLeft: 30, lineHeight: 1.4 }}>
            {metaParts.join(" · ")}
          </div>
        )}

        {/* Milestone micro-bar — progress toward the next streak badge */}
        {next && streak > 0 && (
          <div aria-hidden="true" style={{ height: 3, borderRadius: 99, background: T.surf2, marginTop: 6, marginLeft: 30, width: "calc(100% - 30px)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${Math.min(100, (streak / next.days) * 100)}%`, background: identity.color, borderRadius: 99, transition: "width 0.4s ease" }} />
          </div>
        )}
      </button>

      {/* ── Four Laws expander — sits outside the toggle button (can't nest buttons) ── */}
      {hasFourLaws && (
        <div style={{ padding: "0 12px 10px 30px" }}>
          <button
            onClick={() => setExpanded(e => !e)}
            aria-expanded={expanded}
            style={{
              display:"flex", alignItems:"center", gap:4, background:"transparent", border:"none",
              cursor:"pointer", padding:"6px 8px 6px 0", fontSize:11, fontWeight:700, color:T.primary,
              WebkitTapHighlightColor:"transparent",
            }}
          >
            Four Laws
            <span aria-hidden="true" style={{ fontSize:9, transition:"transform 0.2s", display:"inline-block", transform: expanded ? "rotate(180deg)" : "none" }}>▼</span>
          </button>

          {expanded && (
            <div style={{ marginTop:10, display:"flex", flexDirection:"column", gap:10 }}>
              <div style={{ textAlign:"center", background:T.primary+"0d", borderRadius:8, padding:"6px 10px", fontSize:11, fontWeight:700, color:T.primary }}>
                Every rep is a vote for: <span style={{ fontWeight:800 }}>{identity.label}</span>
              </div>

              {fourLaws.map(law => (
                <div key={law.key} style={{ display:"flex", gap:10 }}>
                  <div aria-hidden="true" style={{ width:24, height:24, borderRadius:8, background:law.bg, color:law.color, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, flexShrink:0 }}>
                    {law.n}
                  </div>
                  <div>
                    <div style={{ fontSize:10, fontWeight:700, color:law.color, textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:2 }}>{law.label}</div>
                    <div style={{ fontSize:12.5, color:T.text, lineHeight:1.4 }}>{law.value}</div>
                  </div>
                </div>
              ))}

              {weekTrail && (
                <div style={{ display:"flex", alignItems:"center", gap:4, paddingTop:8, borderTop:`1px solid ${T.surf2}` }}>
                  <span style={{ fontSize:10, color:T.muted, marginRight:4 }}>Last 7 days</span>
                  {weekTrail.map((done, i) => (
                    <span key={i} aria-hidden="true" style={{
                      width:14, height:14, borderRadius:4, flexShrink:0,
                      background: done ? identity.color : T.surf2,
                      border: done ? "none" : `1px dashed ${T.border}`,
                    }} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── IDENTITY GROUP CARD ──────────────────────────────────────────────────────
// One card per run of consecutive same-identity habits in a time slot: a single
// identity band on top (with the identity's done-today count), then one
// HabitRow per habit — hierarchy reads identity → trigger → action.
const IdentityGroupCard = memo(function IdentityGroupCard({ identity, items, todayData, justChecked, getStreakForHabit, toggle, openEditHabit, getWeekTrail, doneToday, totalToday }) {
  const dim = identity.colorDim || T.text;
  return (
    <div style={{
      borderRadius: 14, marginBottom: 8,
      background: T.surface,
      border: `1px solid ${identity.color}55`,
      overflow: "hidden",
    }}>
      {/* ── Identity band — who these habits are a vote for ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 7,
        background: identity.color + "26", padding: "5px 10px 5px 12px",
      }}>
        <span style={{ fontSize: 13, flexShrink: 0 }} aria-hidden="true">{identity.icon}</span>
        <span style={{
          flex: 1, minWidth: 0, fontSize: 10.5, fontWeight: 800,
          letterSpacing: "0.07em", textTransform: "uppercase", color: dim,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {shortLabel(identity.label)}
        </span>
        <span
          aria-label={`${doneToday} of ${totalToday} habits done today for ${shortLabel(identity.label)}`}
          style={{
            flexShrink: 0, fontSize: 10, fontWeight: 800, color: dim,
            background: "rgba(255,255,255,0.6)", borderRadius: 10, padding: "2px 8px",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {doneToday}/{totalToday}
        </span>
      </div>

      {items.map(({ habit }, i) => (
        <div key={habit.id} className={justChecked === habit.id ? "card-leaving" : ""}>
          <HabitRow
            habit={habit}
            identity={identity}
            checked={!!todayData[habit.id]}
            streak={getStreakForHabit(habit.id, habit.frequency)}
            toggle={toggle}
            openEditHabit={openEditHabit}
            weekTrail={getWeekTrail(habit.id)}
            first={i === 0}
          />
        </div>
      ))}
    </div>
  );
});

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
        <div style={{ fontSize:15, fontWeight:700, color:T.text, fontFamily:FONT_DISPLAY }}>
          {formatNavDate(selectedDate)}
        </div>
        {!isToday && (
          <button onClick={()=>setSelectedDate(todayKey)} aria-label="Go to today" style={{
            marginTop:3, fontSize:10, fontWeight:700, color:T.accent,
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
// Simple priority list: each task is High, Medium, or Low.
// Colors are drawn from the app's Ocean Depth palette (T), not arbitrary hues.
const PRIORITIES = [
  { key: "H", label: "High",   accent: T.red,     dark: "#791F1F", bg: "#FEE2E2" },
  { key: "M", label: "Medium", accent: T.gold,    dark: "#633806", bg: "#FEF3C7" },
  { key: "L", label: "Low",    accent: "#64748B", dark: "#334155", bg: "#E2E8F0" },
];
const PRIORITY_ORDER = { H: 0, M: 1, L: 2 };
const priorityOf = (key) => PRIORITIES.find(p => p.key === key) || PRIORITIES[1];
// Back-compat: tasks created during the Eisenhower-matrix era carry a
// `quadrant` field instead of `priority`. Map them over so old data still
// lands somewhere sensible; anything unrecognized falls back to Medium.
function taskPriority(t) {
  if (t.priority === "H" || t.priority === "M" || t.priority === "L") return t.priority;
  if (t.quadrant === "do") return "H";
  if (t.quadrant === "eliminate") return "L";
  return "M";
}

const TopTasksCard = memo(function TopTasksCard({ tasks, dateKey, isToday, onAdd, onToggle, onDelete, onEdit, onPriority, onDefer }) {
  const [inputVisible, setInputVisible] = useState(false);
  const [inputVal,     setInputVal]     = useState("");
  const [inputPriority, setInputPriority] = useState("M");
  const [editingId,    setEditingId]    = useState(null);
  const [editVal,      setEditVal]      = useState("");
  const [completedOpen, setCompletedOpen] = useState(false);
  const [sheetTask,    setSheetTask]    = useState(null); // task with its action sheet open
  const inputRef = useRef(null);
  const editRef  = useRef(null);

  useEffect(() => {
    if (inputVisible && inputRef.current) inputRef.current.focus();
  }, [inputVisible]);

  // Reset input state when navigating to a different date
  useEffect(() => {
    setInputVisible(false);
    setInputVal("");
    setInputPriority("M");
    setEditingId(null);
    setEditVal("");
    setCompletedOpen(false);
    setSheetTask(null);
  }, [dateKey]);

  useEffect(() => {
    if (editingId && editRef.current) editRef.current.focus();
  }, [editingId]);

  const handleAdd = () => {
    const t = inputVal.trim();
    if (!t) return;
    onAdd(dateKey, t, inputPriority);
    setInputVal(""); setInputPriority("M"); setInputVisible(false);
  };

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

  return (
    <div style={{ borderRadius:16, background:T.surface, border:`1.5px solid ${T.border}`, overflow:"hidden" }}>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", gap:8, padding:"12px 14px 10px", borderBottom:`1px solid ${T.surf2}` }}>
        <span style={{ fontSize:16 }} aria-hidden="true">🎯</span>
        <span style={{ flex:1, fontSize:13, fontWeight:700, color:T.text, fontFamily:FONT_DISPLAY, letterSpacing:".3px" }}>
          Tasks
        </span>
        <span aria-label={`${doneCnt} of ${total} tasks done`} style={{
          fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:20,
          background: allDone ? T.primary+"18" : T.gold+"20",
          color:      allDone ? T.primary       : "#92400E",
        }}>
          {doneCnt} / {total}
        </span>
      </div>

      {/* Open tasks — one simple list, High → Medium → Low; long lists scroll */}
      {(() => {
        const openTasks = activeTasks
          .filter(t => !t.done)
          .slice()
          .sort((a, b) => PRIORITY_ORDER[taskPriority(a)] - PRIORITY_ORDER[taskPriority(b)]);
        if (openTasks.length === 0) {
          return (
            <div style={{ fontSize:13, color:T.muted, fontStyle:"italic", textAlign:"center", padding:"14px 0" }}>
              No open tasks
            </div>
          );
        }
        return (
          <div style={{ padding:"2px 12px", maxHeight:320, overflowY:"auto", WebkitOverflowScrolling:"touch" }}>
            {openTasks.map((task, i) => {
              const p = priorityOf(taskPriority(task));
              const isEditing = editingId === task.id;
              return (
                <div key={task.id} style={{ display:"flex", alignItems:"center", gap:11, padding:"9px 2px", borderTop: i === 0 ? "none" : `1px solid ${T.surf2}` }}>
                  {/* Check circle */}
                  <button
                    onClick={() => onToggle(dateKey, task.id)}
                    aria-pressed={task.done}
                    aria-label={task.done ? `Uncheck: ${task.text}` : `Check: ${task.text}`}
                    style={{
                      width:22, height:22, borderRadius:"50%", flexShrink:0, boxSizing:"border-box",
                      border:`2px solid ${p.accent}`, background:"transparent",
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
                      style={{ flex:1, minWidth:0, border:`1px solid ${T.accent}`, borderRadius:8, padding:"6px 8px", fontSize:15, background:"#fff", color:T.text, outline:"none", fontFamily:"inherit" }}
                    />
                  ) : (
                    <span
                      onClick={() => isToday && setSheetTask(task)}
                      title={isToday ? "Tap for options" : undefined}
                      style={{
                        flex:1, minWidth:0, fontSize:15, lineHeight:1.4, color:T.text,
                        cursor: isToday ? "pointer" : "default",
                      }}
                    >
                      {task.text}
                    </span>
                  )}

                  {/* Priority chip */}
                  <span aria-label={`Priority: ${p.label}`} style={{
                    flexShrink:0, fontSize:9, fontWeight:800, color:p.dark, background:p.bg,
                    borderRadius:8, padding:"2px 7px", letterSpacing:"0.03em",
                  }}>
                    {p.label}
                  </span>
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* Completed strip — collapsed by default, tap a row to send it back to its quadrant */}
      {(() => {
        const completedTasks = activeTasks.filter(t => t.done);
        if (completedTasks.length === 0) return null;
        return (
          <div style={{ borderTop:`1px solid ${T.surf2}`, padding:"8px 10px" }}>
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
                <span style={{ fontSize:10, color:"#fff", fontWeight:900, lineHeight:1 }}>✓</span>
              </div>
              <span style={{ flex:1, textAlign:"left", fontSize:12, fontWeight:500, color:T.primary }}>
                {completedTasks.length} completed
              </span>
              <span aria-hidden="true" style={{ fontSize:10, color:T.primary, transition:"transform 0.2s", display:"inline-block", transform: completedOpen ? "rotate(180deg)" : "none" }}>▼</span>
            </button>

            {completedOpen && (
              <div style={{ display:"flex", flexDirection:"column", gap:6, padding:"8px 4px 2px" }}>
                {completedTasks.map(task => {
                  const q = priorityOf(taskPriority(task));
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
                      <span aria-hidden="true" style={{ width:10, height:10, borderRadius:"50%", background:q.accent, flexShrink:0 }} />
                      <span style={{ fontSize:12, color:T.muted, textDecoration:"line-through", textDecorationColor:T.muted, lineHeight:1.3 }}>
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

      {/* Add row / inline input */}
      {isToday && (
        inputVisible ? (
          <div style={{ display:"flex", flexDirection:"column", gap:6, padding:"8px 12px", background:T.bg, borderTop:`1px solid ${T.surf2}` }}>
            {/* Row 1: text + Add — never competes with the quadrant picker for width */}
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <input
                ref={inputRef}
                value={inputVal}
                onChange={e => setInputVal(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter")  handleAdd();
                  if (e.key === "Escape") { setInputVisible(false); setInputVal(""); setInputPriority("M"); }
                }}
                placeholder="What needs to get done?"
                maxLength={80}
                aria-label="New task text"
                style={{ flex:1, minWidth:0, border:`1px solid ${T.accent}`, borderRadius:8, padding:"7px 10px", fontSize:13, background:"#fff", color:T.text, outline:"none", fontFamily:"inherit" }}
              />
              <button
                onClick={handleAdd}
                style={{ background:T.primary, color:"#fff", border:"none", borderRadius:8, padding:"7px 14px", fontSize:12, fontWeight:700, cursor:"pointer", flexShrink:0, WebkitTapHighlightColor:"transparent" }}
              >
                Add
              </button>
            </div>
            {/* Row 2: priority picker — three equal segments */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:4 }}>
              {PRIORITIES.map(p => (
                <button key={p.key} onClick={() => setInputPriority(p.key)} aria-pressed={inputPriority === p.key}
                  aria-label={`${p.label} priority`}
                  style={{
                    fontSize:11, fontWeight:700, padding:"8px 4px", borderRadius:9,
                    border: inputPriority === p.key ? `2px solid ${p.dark}` : "2px solid transparent",
                    background: p.bg, color: p.dark, cursor:"pointer", fontFamily:"inherit",
                    WebkitTapHighlightColor:"transparent", transition:"border 0.1s",
                  }}
                >{p.label}</button>
              ))}
            </div>
          </div>
        ) : (
          <button
            onClick={() => setInputVisible(true)}
            aria-label="Add a task"
            style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:6, padding:"10px 14px", width:"100%", background:"transparent", border:"none", borderTop:`1px dashed ${T.border}`, cursor:"pointer", WebkitTapHighlightColor:"transparent" }}
          >
            <span aria-hidden="true" style={{ color:T.accent, fontSize:15, lineHeight:1 }}>+</span>
            <span style={{ fontSize:13, color:T.accent, fontWeight:500 }}>Add task</span>
          </button>
        )
      )}

      {/* All-done celebration */}
      {allDone && !inputVisible && (
        <div style={{ padding:"8px 14px 10px", fontSize:11, color:T.primary, textAlign:"center", fontWeight:600 }}>
          All done — great work! 🎉
        </div>
      )}

      {/* Task action sheet — tap a task to move it, edit it, or delete it */}
      {sheetTask && (
        <Modal title={sheetTask.text} onClose={() => setSheetTask(null)}>
          <div style={{ padding:"4px 20px 20px" }}>
            <div style={S.fieldLabel}>Priority</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:10 }}>
              {PRIORITIES.map(p => {
                const current = p.key === taskPriority(sheetTask);
                return (
                  <button
                    key={p.key}
                    onClick={() => { if (!current) onPriority(dateKey, sheetTask.id, p.key); setSheetTask(null); }}
                    aria-pressed={current}
                    style={{
                      padding:"12px 10px", background:p.bg, borderRadius:10,
                      border: current ? `2px solid ${p.dark}` : "2px solid transparent",
                      cursor:"pointer", fontSize:13, fontWeight:700, color:p.dark,
                      fontFamily:"inherit", WebkitTapHighlightColor:"transparent",
                    }}
                  >
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
                cursor:"pointer", marginBottom:16, fontSize:13, fontWeight:700, color:T.text2,
                fontFamily:"inherit", WebkitTapHighlightColor:"transparent",
              }}
            >
              <span aria-hidden="true">⏭</span> Move to tomorrow
            </button>
            <div style={{ display:"flex", gap:8, borderTop:`1px solid ${T.surf2}`, paddingTop:14 }}>
              <button
                onClick={() => { startEdit(sheetTask); setSheetTask(null); }}
                style={{ flex:1, background:T.primary+"12", border:"none", borderRadius:10, color:T.primary, fontSize:13, fontWeight:700, cursor:"pointer", padding:"12px 10px", fontFamily:"inherit", WebkitTapHighlightColor:"transparent" }}
              >
                Edit text
              </button>
              <button
                onClick={() => { onDelete(dateKey, sheetTask.id); setSheetTask(null); }}
                style={{ flex:1, background:T.red+"12", border:"none", borderRadius:10, color:T.red, fontSize:13, fontWeight:700, cursor:"pointer", padding:"12px 10px", fontFamily:"inherit", WebkitTapHighlightColor:"transparent" }}
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

// ─── TODAY VIEW ───────────────────────────────────────────────────────────────
const TodayView = memo(function TodayView({ identities, allHabits, todayData, allData, toggle, justChecked, getStreakForHabit, openEditHabit, setModal, openAddHabit, openAddIdentity, selectedDate, setSelectedDate, todayKey, dailyTasks, addTask, toggleTask, deleteTask, editTask, setTaskPriority, deferTask }) {
  const [notTodayExpanded, setNotTodayExpanded] = useState(false);
  const notTodayListId = useId();
  const [matrixExpanded, setMatrixExpanded] = useState(false);

  // Build enriched habit list with identity ref, time slot, and sort key
  const enrichedHabits  = useMemo(() =>
    identities.flatMap(identity =>
      identity.habits.map(habit => {
        // Parse HH:MM (from <input type="time">) → total minutes for precise sort
        const hm = habit.time ? habit.time.match(/^(\d{1,2}):(\d{2})$/) : null;
        const sortMinutes = hm
          ? parseInt(hm[1]) * 60 + parseInt(hm[2])
          : (parseHour(habit.time) !== null ? parseHour(habit.time) * 60 : Infinity);
        return { habit, identity, slotId: getSlotId(habit.time), sortMinutes };
      })
    ), [identities]);

  const [scheduledHabits, notTodayHabits] = useMemo(() => {
    const scheduled = enrichedHabits
      .filter(({habit}) => isScheduledOn(habit.frequency, selectedDate))
      .sort((a, b) => a.sortMinutes - b.sortMinutes); // earliest time first; no-time habits (Infinity) go last
    const notToday  = enrichedHabits.filter(({habit}) => !isScheduledOn(habit.frequency, selectedDate));
    return [scheduled, notToday];
  }, [enrichedHabits, selectedDate]);

  const quote = useMemo(() => getDailyQuote(), []);

  // Done/total per identity for the selected day — feeds the band's count pill
  const identityDayCounts = useMemo(() => {
    const m = {};
    for (const { habit, identity } of scheduledHabits) {
      const c = m[identity.id] || (m[identity.id] = { done: 0, total: 0 });
      c.total += 1;
      if (todayData[habit.id]) c.done += 1;
    }
    return m;
  }, [scheduledHabits, todayData]);

  // Slot the clock is currently in — used to mark "Now" on today's section headers
  const nowHour   = new Date().getHours();
  const nowSlotId = (TIME_SLOTS.find(s => s.range && nowHour >= s.range[0] && nowHour < s.range[1]) || { id: "anytime" }).id;

  const pendingTaskCount = useMemo(() =>
    (dailyTasks[selectedDate] || []).filter(t => !t.carried && !t.done).length,
    [dailyTasks, selectedDate]
  );

  // High-priority tasks always show in full in the collapsed "Today's Focus"
  // preview. When there are none, fall back to the top 2 pending tasks by priority.
  const previewTasks = useMemo(() => {
    const pending = (dailyTasks[selectedDate] || []).filter(t => !t.carried && !t.done);
    const high = pending.filter(t => taskPriority(t) === "H");
    if (high.length > 0) return high;
    return pending
      .slice()
      .sort((a, b) => PRIORITY_ORDER[taskPriority(a)] - PRIORITY_ORDER[taskPriority(b)])
      .slice(0, 2);
  }, [dailyTasks, selectedDate]);

  // 7-day check-in trail for a habit, ending today — feeds the Four Laws expander's
  // mini heatmap. Anchored on todayKey (not selectedDate) since it's "recent history",
  // not tied to whatever day is being viewed.
  const getWeekTrail = useCallback((habitId) => {
    const [y, mo, d] = todayKey.split("-").map(Number);
    const base = new Date(y, mo - 1, d);
    const out = [];
    for (let i = 6; i >= 0; i--) {
      const dt = new Date(base); dt.setDate(base.getDate() - i);
      const key = dateToKey(dt);
      out.push(!!(allData[key] && allData[key][habitId]));
    }
    return out;
  }, [allData, todayKey]);

  // ── Empty state — no identities yet ──
  if (identities.length === 0) {
    return (
      <div style={{...S.content, alignItems:"center", paddingTop:40, textAlign:"center"}}>
        <DayNavigator selectedDate={selectedDate} setSelectedDate={setSelectedDate} todayKey={todayKey}/>
        <div style={{fontSize:52,marginBottom:16}} aria-hidden="true">🌱</div>
        <div style={{fontSize:20,fontWeight:700,color:T.text,marginBottom:8}}>Start building your identity</div>
        <div style={{fontSize:14,color:T.muted,lineHeight:1.7,maxWidth:280,marginBottom:28}}>
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

      {/* Daily quote banner */}
      <div style={{ background:`linear-gradient(135deg,rgba(2,132,199,0.09),rgba(245,158,11,0.07))`, border:`1px solid rgba(2,132,199,0.2)`, borderRadius:16, padding:"14px 16px" }}>
        <div style={{ fontSize:10,fontWeight:800,letterSpacing:"0.12em",color:T.primary,marginBottom:6,textTransform:"uppercase" }}>
          <span aria-hidden="true">✨</span> Today's Motivation
        </div>
        <div style={{ fontSize:14,color:T.text,fontStyle:"italic",lineHeight:1.65,fontWeight:500 }}>"{quote.text}"</div>
        {quote.author && <div style={{ fontSize:11,color:T.gold,fontWeight:700,marginTop:6 }}>— {quote.author}</div>}
      </div>

      {/* Today's Focus — compact task preview, expands into the full task list */}
      <div style={{ ...S.card, padding:"12px 14px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom: matrixExpanded ? 10 : 8 }}>
          <span style={{ fontSize:10, color:T.muted, letterSpacing:"0.1em", fontWeight:700, textTransform:"uppercase" }}>
            <span aria-hidden="true">🎯</span> Today's Focus
          </span>
          {pendingTaskCount > 0 && (
            <span aria-label={`${pendingTaskCount} pending tasks`} style={{
              fontSize:9, fontWeight:700, color:"#412402", background:T.gold,
              borderRadius:8, padding:"1px 6px", lineHeight:1.4,
            }}>
              {pendingTaskCount}
            </span>
          )}
          {matrixExpanded && (
            <button onClick={() => setMatrixExpanded(false)} style={{
              marginLeft:"auto", background:"transparent", border:"none", cursor:"pointer",
              fontSize:11, fontWeight:700, color:T.primary, padding:0, WebkitTapHighlightColor:"transparent",
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
            onPriority={setTaskPriority}
            onDefer={deferTask}
          />
        ) : previewTasks.length === 0 ? (
          <div style={{ fontSize:12, color:T.muted, textAlign:"center", padding:"6px 0" }}>
            Nothing here —{" "}
            <button onClick={() => setMatrixExpanded(true)} style={{
              background:"none", border:"none", color:T.primary, fontWeight:700,
              cursor:"pointer", padding:0, fontSize:12, WebkitTapHighlightColor:"transparent",
            }}>
              add a task
            </button>
          </div>
        ) : (
          <>
            {previewTasks.map(t => {
              const q = priorityOf(taskPriority(t));
              return (
                <div key={t.id} style={{ display:"flex", alignItems:"center", gap:9, padding:"7px 0" }}>
                  <button
                    onClick={() => toggleTask(selectedDate, t.id)}
                    aria-label={`Complete: ${t.text}`}
                    style={{
                      width:20, height:20, borderRadius:6, flexShrink:0, boxSizing:"border-box",
                      border:`2px solid ${q.accent}`, background:"transparent",
                      cursor:"pointer", padding:0, WebkitTapHighlightColor:"transparent",
                    }}
                  />
                  <span style={{
                    fontSize:13, color:T.text, flex:1, minWidth:0,
                    overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                  }}>{t.text}</span>
                  <span style={{
                    fontSize:9, fontWeight:700, color:q.dark, background:q.bg,
                    padding:"2px 6px", borderRadius:8, flexShrink:0, whiteSpace:"nowrap",
                  }}>{q.label}</span>
                </div>
              );
            })}
            <button onClick={() => setMatrixExpanded(true)} style={{
              display:"block", width:"100%", textAlign:"center", background:"none", border:"none",
              cursor:"pointer", fontSize:12, fontWeight:700, color:T.primary, padding:"9px 0 3px", WebkitTapHighlightColor:"transparent",
            }}>
              {pendingTaskCount > previewTasks.length ? `+ ${pendingTaskCount - previewTasks.length} more · ` : ""}view all <span aria-hidden="true">▾</span>
            </button>
          </>
        )}
      </div>

      {/* Empty-identity nudge — show a contextual CTA for each identity with no habits */}
      {identities.filter(i => i.habits.length === 0).map(i => (
        <div key={i.id} style={{ borderRadius:16, border:`1.5px dashed ${i.color}66`, padding:"14px 16px", background:`${i.color}08`, display:"flex", alignItems:"center", gap:12 }}>
          <span style={{fontSize:22, flexShrink:0}} aria-hidden="true">{i.icon}</span>
          <div style={{flex:1, minWidth:0}}>
            <div style={{fontSize:14,fontWeight:700,color:i.color,lineHeight:1.2}}>{shortLabel(i.label)}</div>
            <div style={{fontSize:12,color:T.muted,marginTop:2}}>No habits yet — add one to start tracking</div>
          </div>
          <button onClick={()=>openAddHabit(i.id)} style={{...S.btnPrimary, padding:"8px 14px", fontSize:12, minHeight:36, flex:"none", width:"auto"}}>+ Add</button>
        </div>
      ))}

      {/* Time slot sections */}
      {TIME_SLOTS.map(slot => {
        const slotAll     = scheduledHabits.filter(h => h.slotId === slot.id);
        const slotVisible = slotAll.filter(({habit}) => !todayData[habit.id] || habit.id === justChecked);
        if (slotVisible.length === 0) return null;
        const pendingCnt  = slotAll.filter(({habit}) => !todayData[habit.id]).length;
        return (
          <div key={slot.id}>
            <div style={{ display:"flex", alignItems:"center", gap:8, margin:"4px 0 8px", paddingLeft:2 }}>
              <span style={{ fontSize:16 }} aria-hidden="true">{slot.emoji}</span>
              <span style={{ fontSize:13, fontWeight:700, color:T.text, fontFamily:FONT_DISPLAY, letterSpacing:"-0.01em" }}>{slot.label}</span>
              {selectedDate === todayKey && slot.id === nowSlotId && (
                <span style={{ fontSize:9, fontWeight:800, color:T.primary, background:T.primary+"14", border:`1px solid ${T.primary}44`, borderRadius:8, padding:"1px 7px", letterSpacing:"0.08em", textTransform:"uppercase" }}>
                  Now
                </span>
              )}
              {pendingCnt > 0 && (
                <span style={{ fontSize:11, color:T.muted, marginLeft:"auto", fontWeight:600 }} aria-label={`${pendingCnt} habits remaining`}>
                  {pendingCnt} left
                </span>
              )}
            </div>

            {groupByIdentityRuns(slotVisible).map(g => (
              <IdentityGroupCard
                key={g.items[0].habit.id}
                identity={g.identity}
                items={g.items}
                todayData={todayData}
                justChecked={justChecked}
                getStreakForHabit={getStreakForHabit}
                toggle={toggle}
                openEditHabit={openEditHabit}
                getWeekTrail={getWeekTrail}
                doneToday={(identityDayCounts[g.identity.id] || {}).done || 0}
                totalToday={(identityDayCounts[g.identity.id] || {}).total || 0}
              />
            ))}
          </div>
        );
      })}

      {/* Completed section */}
      {(() => {
        const done = scheduledHabits.filter(({habit}) => todayData[habit.id] && habit.id !== justChecked);
        if (done.length === 0) return null;
        return (
          <div style={{ marginTop:8 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, margin:"4px 0 10px", paddingLeft:2 }}>
              <span style={{ fontSize:16 }} aria-hidden="true">✅</span>
              <span style={{ fontSize:13, fontWeight:700, color:T.primary, fontFamily:FONT_DISPLAY }}>Completed</span>
              <span style={{ fontSize:11, color:T.primary, marginLeft:"auto", fontWeight:700, background:T.primary+"18", borderRadius:20, padding:"2px 9px" }} aria-label={`${done.length} completed`}>{done.length}</span>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {done.map(({ habit, identity }) => {
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
                      <span style={{ fontSize:15, color:"#fff", fontWeight:900, lineHeight:1 }}>✓</span>
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:14, fontWeight:600, color:T.primary, textDecoration:"line-through", textDecorationColor:T.primary+"77", lineHeight:1.2 }}>{habit.label}</div>
                      <div style={{ fontSize:11, color:T.muted, marginTop:2 }}><span aria-hidden="true">{identity.icon}</span> {shortLabel(identity.label)}</div>
                    </div>
                    {streak >= 2 && (
                      <span style={{ fontSize:11, fontWeight:800, color:T.gold, background:T.gold+"20", padding:"2px 8px", borderRadius:20, flexShrink:0 }} aria-label={`${streak} day streak`}>
                        <span aria-hidden="true">{milestone ? milestone.emoji : "🔥"}</span> {streak}d
                      </span>
                    )}
                    <span style={{ fontSize:11, color:T.muted, flexShrink:0, opacity:0.6 }}>undo</span>
                  </button>
                );
              })}
            </div>
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
            <span style={{ fontSize:14, opacity:0.5 }} aria-hidden="true">⏭</span>
            <span style={{ fontSize:12, fontWeight:700, color:T.muted }}>
              {selectedDate === todayKey ? "Not scheduled today" : `Not scheduled · ${formatNavDate(selectedDate)}`}
            </span>
            <span style={{ fontSize:11, color:T.muted, background:T.surf2, borderRadius:20, padding:"1px 8px", marginLeft:"auto" }}>{notTodayHabits.length}</span>
            <span style={{ fontSize:12, color:T.muted }} aria-hidden="true">{notTodayExpanded ? "▲" : "▼"}</span>
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
                      <span style={{ fontSize:12, color:T.muted }}>○</span>
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:T.muted }}>{habit.label}</div>
                      <div style={{ fontSize:11, color:T.muted, marginTop:2 }}><span aria-hidden="true">{identity.icon}</span> {shortLabel(identity.label)}</div>
                    </div>
                    <span style={{ fontSize:10, fontWeight:700, color, background:bg, padding:"3px 8px", borderRadius:20, flexShrink:0, whiteSpace:"nowrap" }}>
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
        <span style={{ fontSize:13, color:T.text2, fontWeight:500 }}>Add a new habit</span>
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
        <span style={{ fontSize:13, fontWeight:700, color:T.text, fontFamily:FONT_DISPLAY }}>{weekLabel}</span>
        <button onClick={() => setWeekOffset(o => Math.max(0, o - 1))} aria-label="Next week"
          disabled={weekOffset === 0}
          style={{ ...S.crudBtn, width:36, height:36, fontSize:20, opacity: weekOffset === 0 ? 0.3 : 1 }}>
          <span aria-hidden="true">›</span>
        </button>
      </div>

      {/* Dot legend */}
      <div style={{ display:"flex", gap:14, fontSize:10, color:T.muted, paddingLeft:4, flexWrap:"wrap" }} aria-hidden="true">
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
            ? <div style={{fontSize:12,color:T.muted,textAlign:"center",padding:"8px 0"}}>No habits yet</div>
            : (
              <div style={S.weekGrid}>
                <div/>
                {weekDates.map((d,i)=>(
                  <div key={d} style={{...S.weekDayH,color:d===todayKey?identity.color:T.muted,fontWeight:d===todayKey?700:500}}>{DAY_LABELS[i]}</div>
                ))}
                {identity.habits.map(habit=>(
                  <Fragment key={habit.id}>
                    <div style={S.weekHabitLabel}>{habit.label}</div>
                    {weekDates.map(d=>{
                      const done      = !!(data[d]&&data[d][habit.id]);
                      const scheduled = isScheduledOn(habit.frequency, d);
                      const future    = d > todayKey;
                      const dotLabel  = done ? "Done" : future ? "Future" : scheduled ? "Missed" : "Not scheduled";
                      return (
                        <div key={d} aria-label={dotLabel} style={{
                          ...S.weekDot,
                          background: done ? identity.color : scheduled ? T.surf2 : "transparent",
                          border: done ? `1px solid ${identity.color}` : scheduled ? `1px solid ${T.border}` : `1px dashed ${T.border}`,
                          opacity: future ? 0.35 : scheduled ? 1 : 0.4,
                          display:"flex", alignItems:"center", justifyContent:"center",
                        }}>
                          {done && <span style={{fontSize:10,color:"#fff",fontWeight:900,lineHeight:1}} aria-hidden="true">✓</span>}
                        </div>
                      );
                    })}
                  </Fragment>
                ))}
              </div>
            )
          }
        </div>
      ))}
      <div style={S.card}>
        <div style={{...S.cardLabel,color:T.gold,marginBottom:14}}><span aria-hidden="true">📊</span> Weekly Score</div>
        {identities.map(identity=>{
          const done = weekDates.reduce((a,d) =>
            a + identity.habits.filter(h => isScheduledOn(h.frequency, d) && data[d]?.[h.id]).length, 0);
          const possible = weekDates
            .filter(d => d <= todayKey)
            .reduce((a,d) => a + identity.habits.filter(h => isScheduledOn(h.frequency, d)).length, 0);
          const pct=possible>0?Math.round((done/possible)*100):0;
          return (
            <div key={identity.id} style={S.summaryRow}>
              <span style={{fontSize:12,color:T.text2,minWidth:110,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontWeight:500}}>
                <span aria-hidden="true">{identity.icon}</span> {shortLabel(identity.label)}
              </span>
              <div style={S.summaryBar}><div style={{...S.summaryFill,width:`${pct}%`,background:identity.color}}/></div>
              <span style={{fontSize:12,color:identity.color,minWidth:36,textAlign:"right",fontWeight:700}}>{pct}%</span>
            </div>
          );
        })}
      </div>
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
          <div style={{ fontSize:13, color:T.muted, lineHeight:1.7 }}>
            Check in today to start your first streak.
          </div>
        </div>
      )}
      {topStreak>0&&(
        <div style={{...S.card,background:`linear-gradient(135deg,${T.gold}18,${T.accent}10)`,borderColor:T.gold+"55",textAlign:"center",padding:"28px 16px"}}>
          <div style={{fontSize:52}} aria-hidden="true">🔥</div>
          <div style={{fontSize:40,fontWeight:800,color:T.gold,fontFamily:FONT_DISPLAY,lineHeight:1}}>{topStreak}</div>
          <div style={{fontSize:13,color:T.text2,marginTop:6,fontWeight:500}}>Best active streak</div>
          <div style={{fontSize:14,color:T.text,marginTop:4,fontWeight:600}}>{sorted[0]?.label}</div>
        </div>
      )}
      {identities.map(identity=>(
        <div key={identity.id} style={S.card}>
          <div style={{...S.cardLabel,color:identity.color,marginBottom:12}}>
            <span aria-hidden="true">{identity.icon}</span> {identity.label}
          </div>
          {identity.habits.length===0
            ? <div style={{fontSize:12,color:T.muted,textAlign:"center",padding:"8px 0"}}>No habits yet</div>
            : identity.habits.map(habit=>{
              const streak=getStreak(habit.id, habit.frequency);
              const milestone=getMilestone(streak);
              const next=getNextMilestone(streak);
              const pct=next?Math.round((streak/next.days)*100):100;
              return (
                <div key={habit.id} style={S.streakItem}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                    <div>
                      <span style={{fontSize:13,color:streak>0?T.text:T.muted,fontWeight:600}}>{habit.label}</span>
                      {milestone&&<span style={{marginLeft:8,fontSize:11,color:identity.color,fontWeight:600}}><span aria-hidden="true">{milestone.emoji}</span> {milestone.label}</span>}
                    </div>
                    <span style={{fontSize:15,fontWeight:800,color:streak>0?identity.color:T.border2}} aria-label={streak>0?`${streak} day streak`:"No active streak"}>
                      {streak>0?`🔥 ${streak}d`:"—"}
                    </span>
                  </div>
                  {habit.trigger&&<div style={{fontSize:11,color:T.muted,marginBottom:6}}>
                    <span aria-hidden="true">⚡</span> {habit.trigger}
                    {habit.time && <> · <span aria-hidden="true">🕐</span> {habit.time}</>}
                    {habit.location && <> · <span aria-hidden="true">📍</span> {habit.location}</>}
                  </div>}
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <div style={{flex:1,height:5,background:T.surf2,borderRadius:99,overflow:"hidden",border:`1px solid ${T.border}`}}
                         role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                      <div style={{height:"100%",width:`${pct}%`,background:identity.color,borderRadius:99,transition:"width 0.5s"}}/>
                    </div>
                    <span style={{fontSize:10,color:T.muted,flexShrink:0,fontWeight:600}}>{next?`→ ${next.emoji} ${next.days}d`:"💎 Max"}</span>
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
              <span style={{fontSize:13,color:T.text,flex:1,fontWeight:600}}>{m.label}</span>
              <span style={{fontSize:12,color:T.muted,fontWeight:500}}>{m.days} days</span>
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
const FONT_DISPLAY = "'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,sans-serif";
const FONT_BODY    = "'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,sans-serif";

const S = {
  root:{minHeight:"100dvh",background:T.bg,fontFamily:FONT_BODY,color:T.text,width:"100%",maxWidth:430,margin:"0 auto",display:"flex",flexDirection:"column"},
  header:{position:"sticky",top:0,zIndex:50,background:T.bg+"f0",backdropFilter:"blur(16px)",WebkitBackdropFilter:"blur(16px)",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 20px 14px",paddingTop:"calc(env(safe-area-inset-top,0px) + 16px)"},
  eyebrow:{fontSize:11,letterSpacing:"0.14em",color:T.accent,fontWeight:700,marginBottom:4,textTransform:"uppercase",fontFamily:FONT_BODY},
  title:{margin:0,fontSize:24,fontWeight:800,fontFamily:FONT_DISPLAY,letterSpacing:"-0.04em",color:T.text,lineHeight:1.05},
  dateLabel:{fontSize:13,color:T.muted,marginTop:4,fontWeight:500,letterSpacing:"0.01em"},
  ringWrap:{flexShrink:0,textAlign:"center"},
  ringLabel:{fontSize:11,color:T.muted,marginTop:2,fontWeight:600},
  scrollArea:{flex:1,overflowY:"auto",WebkitOverflowScrolling:"touch",paddingBottom:"calc(env(safe-area-inset-bottom,0px) + 80px)"},
  content:{padding:"12px 14px 0",display:"flex",flexDirection:"column",gap:10},
  bottomNav:{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:430,background:T.bg+"f8",backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",borderTop:`1px solid ${T.border}`,display:"flex",alignItems:"center",paddingBottom:"env(safe-area-inset-bottom,8px)",zIndex:50},
  navBtn:{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,padding:"10px 0 6px",background:"transparent",border:"none",cursor:"pointer",minHeight:56,WebkitTapHighlightColor:"transparent"},
  navIcon:{fontSize:20,lineHeight:1},
  navLabel:{fontSize:11,fontWeight:600,letterSpacing:"0.02em",fontFamily:FONT_BODY},
  toast:{position:"fixed",top:"calc(env(safe-area-inset-top,0px) + 12px)",left:"50%",transform:"translateX(-50%)",background:T.surface,border:`2px solid ${T.gold}`,borderRadius:18,padding:"14px 18px",display:"flex",alignItems:"center",gap:14,zIndex:999,boxShadow:"0 8px 32px #00000018",minWidth:240,maxWidth:"calc(100vw - 32px)"},
  overlay:{position:"fixed",inset:0,background:"#00000044",zIndex:100,display:"flex",alignItems:"flex-end",justifyContent:"center"},
  modal:{background:T.surface,borderRadius:"24px 24px 0 0",width:"100%",maxWidth:430,maxHeight:"92dvh",overflowY:"auto",paddingBottom:"env(safe-area-inset-bottom,16px)",boxShadow:"0 -8px 40px #00000018"},
  modalDrag:{width:40,height:4,background:T.border2,borderRadius:99,margin:"12px auto 0"},
  modalHeader:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 20px 14px",borderBottom:`1px solid ${T.border}`},
  modalTitle:{fontSize:18,fontWeight:700,color:T.text,fontFamily:FONT_DISPLAY,letterSpacing:"-0.02em"},
  modalClose:{background:T.surf2,border:"none",color:T.muted,fontSize:15,cursor:"pointer",width:34,height:34,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",WebkitTapHighlightColor:"transparent"},
  fieldLabel:{display:"block",fontSize:11,letterSpacing:"0.08em",color:T.muted,fontWeight:700,marginBottom:8,marginTop:18,textTransform:"uppercase",fontFamily:FONT_BODY},
  input:{width:"100%",background:T.surf2,border:`1.5px solid ${T.border}`,borderRadius:12,padding:"14px 14px",color:T.text,fontSize:16,fontFamily:"inherit",outline:"none",boxSizing:"border-box",appearance:"none",WebkitAppearance:"none"},
  iconBtn:{width:46,height:46,border:`2px solid ${T.border}`,borderRadius:12,cursor:"pointer",fontSize:20,display:"flex",alignItems:"center",justifyContent:"center",WebkitTapHighlightColor:"transparent",background:T.surf2},
  btnPrimary:{flex:1,background:T.primary,color:"#fff",border:"none",borderRadius:12,padding:"15px 20px",fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit",WebkitTapHighlightColor:"transparent",transition:"opacity 0.2s"},
  btnSecondary:{flex:1,background:T.surf2,color:T.text2,border:`1.5px solid ${T.border}`,borderRadius:12,padding:"15px 20px",fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit",WebkitTapHighlightColor:"transparent"},
  addHabitBtn:{display:"flex",alignItems:"center",gap:10,background:T.surface,border:`1.5px dashed ${T.border}`,borderRadius:14,padding:"14px 16px",cursor:"pointer",width:"100%",WebkitTapHighlightColor:"transparent",marginTop:4},
  addIdentityBtn:{display:"flex",alignItems:"center",justifyContent:"center",background:"transparent",border:`1.5px dashed ${T.border2}`,borderRadius:14,padding:"14px 16px",cursor:"pointer",width:"100%",WebkitTapHighlightColor:"transparent",color:T.primary,fontSize:14,fontWeight:700,fontFamily:"inherit"},
  card:{background:T.surface,borderRadius:16,border:`1px solid ${T.border}`,padding:"14px 16px"},
  cardLabel:{fontSize:13,fontWeight:700,color:T.text,fontFamily:FONT_DISPLAY,letterSpacing:"-0.01em",display:"flex",alignItems:"center",gap:6},
  weekGrid:{display:"grid",gridTemplateColumns:"120px repeat(7, 1fr)",gap:6,overflowX:"auto"},
  weekDayH:{fontSize:10,fontWeight:700,color:T.muted,textAlign:"center",padding:"2px 0",letterSpacing:"0.06em"},
  weekHabitLabel:{fontSize:11,color:T.text2,fontWeight:500,display:"flex",alignItems:"center",paddingRight:6,lineHeight:1.3},
  weekDot:{width:"100%",aspectRatio:"1",borderRadius:5,minWidth:22},
  crudBtn:{background:"transparent",border:"none",color:T.muted,cursor:"pointer",fontSize:16,padding:"6px 8px",lineHeight:1,borderRadius:8,WebkitTapHighlightColor:"transparent",display:"flex",alignItems:"center",justifyContent:"center"},
  footer:{textAlign:"center",padding:"20px 0 8px",display:"flex",flexDirection:"column",gap:4},
  footerQuote:{fontSize:12,color:T.muted,fontStyle:"italic",lineHeight:1.6},
  footerAuthor:{fontSize:11,color:T.border2,fontWeight:700},
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
