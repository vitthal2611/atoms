import { useState, useEffect, useCallback, useRef } from "react";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut as fbSignOut } from "firebase/auth";

// ─── FIREBASE (shared BudgetBuddy project) ────────────────────────────────────
const _fbConfig = {
  apiKey:            "AIzaSyDY-LZIb3RZlYAH1eBcTejzGdhZ-b5PEGg",
  authDomain:        "budgetbuddy-9d7da.firebaseapp.com",
  projectId:         "budgetbuddy-9d7da",
  storageBucket:     "budgetbuddy-9d7da.firebasestorage.app",
  messagingSenderId: "52697566663",
  appId:             "1:52697566663:web:c58b872b4ef3d3efac9de2",
};
const _fbApp  = getApps().length ? getApps()[0] : initializeApp(_fbConfig);
const _db     = getFirestore(_fbApp);
const _auth   = getAuth(_fbApp);

function identitiesRef(uid) { return doc(_db, "users", uid, "atomicHabits", "identities"); }
function checkInsRef(uid)   { return doc(_db, "users", uid, "atomicHabits", "checkIns"); }

// ─── DEFAULT SEED DATA ────────────────────────────────────────────────────────

const IDENTITY_COLORS = ["#00C48C","#4E7AFF","#FF6B35","#FFB300","#8B5CF6","#FF3D8B","#00BBDD","#FF7043"];
const IDENTITY_DIMS   = ["#00291E","#0A1A4A","#3D1800","#3D2900","#1A0047","#3D0024","#003040","#3D1800"];
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
  if (!t.includes("am") && !t.includes("pm")) return timeStr; // already 24h or freetext
  const match = t.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/);
  if (!match) return timeStr;
  let h = parseInt(match[1]);
  const m = match[2] || "00";
  const period = match[3];
  if (period === "pm" && h !== 12) h += 12;
  if (period === "am" && h === 12) h = 0;
  return `${String(h).padStart(2,"0")}:${m}`;
}

function getTodayKey() { return new Date().toISOString().slice(0,10); }
function uid() { return Math.random().toString(36).slice(2,10); }

// ─── FREQUENCY HELPERS ────────────────────────────────────────────────────────
// frequency shape: { cadence:"weekly"|"monthly", days:[0-6], dates:[1-31,32] }
// days: 0=Mon … 6=Sun  |  dates: 1-31 = day of month, 32 = last day of month
const DEFAULT_FREQUENCY = { cadence:"weekly", days:[0,1,2,3,4,5,6] };

function isScheduledOn(frequency, dateKey) {
  const freq = frequency || DEFAULT_FREQUENCY;
  const [y, mo, d] = dateKey.split("-").map(Number);
  const date = new Date(y, mo - 1, d);
  if (freq.cadence === "monthly") {
    const dates = freq.dates || [1];
    const lastDay = new Date(y, mo, 0).getDate(); // last day of this month
    return dates.some(dt => dt === 32 ? d === lastDay : dt === d);
  }
  // weekly: JS getDay() is 0=Sun…6=Sat; our days[] is 0=Mon…6=Sun
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
  if (days.length === 7) return { bg: T.green+"18", color: T.green };
  if (days.length === 5 && [0,1,2,3,4].every(d=>days.includes(d))) return { bg:"#E0F2FE", color:"#0369A1" };
  if (days.length === 2 && [5,6].every(d=>days.includes(d))) return { bg:"#FEF3C7", color:"#92400E" };
  return { bg:"#FEF3C7", color:"#92400E" };
}
function getWeekDates() {
  const today=new Date(), mon=new Date(today);
  mon.setDate(today.getDate()-((today.getDay()+6)%7));
  return Array.from({length:7},(_,i)=>{ const d=new Date(mon); d.setDate(mon.getDate()+i); return d.toISOString().slice(0,10); });
}
const DAY_LABELS=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

// ─── MODAL ────────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }) {
  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} className="sheet-in" onClick={e=>e.stopPropagation()}>
        <div style={S.modalDrag}/>
        <div style={S.modalHeader}>
          <span style={S.modalTitle}>{title}</span>
          <button onClick={onClose} style={S.modalClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── FREQUENCY PICKER ─────────────────────────────────────────────────────────
function FrequencyPicker({ value, onChange }) {
  const freq = value || DEFAULT_FREQUENCY;
  const cadence = freq.cadence || "weekly";
  const selDays = freq.days || [0,1,2,3,4,5,6];
  const selDates = freq.dates || [];

  const DAY_PILLS = ["M","T","W","T","F","S","S"];

  const isAll      = selDays.length===7;
  const isWeekdays = selDays.length===5 && [0,1,2,3,4].every(d=>selDays.includes(d));
  const isWeekends = selDays.length===2 && [5,6].every(d=>selDays.includes(d));
  const isCustom   = !isAll && !isWeekdays && !isWeekends;

  const setCadence = (c) => {
    if (c === "weekly")  onChange({ cadence:"weekly",  days:[0,1,2,3,4,5,6] });
    if (c === "monthly") onChange({ cadence:"monthly", dates:[] });
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
    onChange({ cadence:"monthly", dates: next });
  };

  const segBtn = (label, active, onClick) => (
    <button onClick={onClick} style={{
      flex:1, padding:"7px 4px", fontSize:13, fontWeight:600, border:"none",
      borderRadius:8, cursor:"pointer", transition:"all 0.15s",
      background: active ? T.accent : "transparent",
      color: active ? "#fff" : T.muted,
    }}>{label}</button>
  );

  const shortcut = (label, active, onClick) => (
    <button onClick={onClick} style={{
      padding:"5px 12px", borderRadius:20, fontSize:12, fontWeight:600,
      cursor:"pointer", border:`1.5px solid ${active ? T.accent : T.border}`,
      background: active ? T.accent : T.surface,
      color: active ? "#fff" : T.text2, transition:"all 0.15s",
      WebkitTapHighlightColor:"transparent",
    }}>{label}</button>
  );

  return (
    <div>
      {/* Cadence toggle */}
      <div style={{ display:"flex", background:T.surf2, borderRadius:10, padding:3, gap:2, marginBottom:14 }}>
        {segBtn("Weekly",  cadence==="weekly",  ()=>setCadence("weekly"))}
        {segBtn("Monthly", cadence==="monthly", ()=>setCadence("monthly"))}
      </div>

      {cadence === "weekly" && (
        <>
          {/* Shortcut pills */}
          <div style={{ display:"flex", gap:6, marginBottom:10, flexWrap:"wrap" }}>
            {shortcut("Every day", isAll,      ()=>applyShortcut("all"))}
            {shortcut("Weekdays",  isWeekdays, ()=>applyShortcut("weekdays"))}
            {shortcut("Weekends",  isWeekends, ()=>applyShortcut("weekends"))}
            {isCustom && shortcut("Custom", true, ()=>{})}
          </div>
          {/* Day pills */}
          <div style={{ display:"flex", gap:6 }}>
            {DAY_PILLS.map((label, i) => {
              const on = selDays.includes(i);
              return (
                <button key={i} onClick={()=>toggleDay(i)} style={{
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
          <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:5 }}>
            {Array.from({length:31},(_,i)=>i+1).map(d => {
              const on = selDates.includes(d);
              return (
                <button key={d} onClick={()=>toggleDate(d)} style={{
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
                <button onClick={()=>toggleDate(32)} style={{
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
    time:       initial.time       || "",
    location:   initial.location   || "",
    identityId: initial.identityId || identities[0]?.id || "",
    frequency:  initial.frequency  || DEFAULT_FREQUENCY,
  });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const valid = form.label.trim().length > 0 && form.identityId;

  return (
    <div style={{ padding: "0 20px 20px" }}>
      <label style={S.fieldLabel}>Habit Name *</label>
      <input style={S.input} value={form.label} onChange={e=>set("label",e.target.value)} placeholder="e.g. Meditate 10 min" autoFocus />

      <label style={S.fieldLabel}>Identity *</label>
      <select style={S.input} value={form.identityId} onChange={e=>set("identityId",e.target.value)}>
        {identities.map(i=><option key={i.id} value={i.id}>{i.icon} {i.label}</option>)}
      </select>

      <label style={S.fieldLabel}>⚡ Trigger (what cues this habit?)</label>
      <input style={S.input} value={form.trigger} onChange={e=>set("trigger",e.target.value)} placeholder="e.g. After morning coffee" />

      <label style={S.fieldLabel}>🕐 Time</label>
      <input style={S.input} type="time" value={form.time} onChange={e=>set("time",e.target.value)} />

      <label style={S.fieldLabel}>📍 Location</label>
      <input style={S.input} value={form.location} onChange={e=>set("location",e.target.value)} placeholder="e.g. Kitchen" />

      <label style={S.fieldLabel}>🔁 Frequency</label>
      <FrequencyPicker value={form.frequency} onChange={v=>set("frequency",v)} />

      <div style={{ display:"flex", gap:8, marginTop:20 }}>
        <button style={S.btnSecondary} onClick={onCancel}>Cancel</button>
        <button style={{ ...S.btnPrimary, opacity: valid?1:0.4 }} onClick={()=>valid&&onSave(form)} disabled={!valid}>
          {mode==="add" ? "Add Habit" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}

// ─── IDENTITY FORM ────────────────────────────────────────────────────────────
function IdentityForm({ initial={}, onSave, onCancel, mode="add" }) {
  const [form, setForm] = useState({
    label: initial.label || "",
    icon: initial.icon || "🎯",
    colorIdx: initial.colorIdx ?? 0,
  });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const valid = form.label.trim().length > 0;

  return (
    <div style={{ padding:"0 20px 20px" }}>
      <label style={S.fieldLabel}>Identity Statement *</label>
      <input style={S.input} value={form.label} onChange={e=>set("label",e.target.value)} placeholder="e.g. I am a Creative Person" autoFocus />

      <label style={S.fieldLabel}>Icon</label>
      <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:16 }}>
        {ICONS.map(ic=>(
          <button key={ic} onClick={()=>set("icon",ic)}
            style={{ ...S.iconBtn, background: form.icon===ic ? T.surf2 : "transparent", borderColor: form.icon===ic ? T.gold : T.border }}>
            {ic}
          </button>
        ))}
      </div>

      <label style={S.fieldLabel}>Color</label>
      <div style={{ display:"flex", flexWrap:"wrap", gap:10, marginBottom:24 }}>
        {IDENTITY_COLORS.map((c,i)=>(
          <button key={c} onClick={()=>set("colorIdx",i)}
            style={{ width:36, height:36, borderRadius:"50%", background:c, border: form.colorIdx===i ? "3px solid " + T.text : "3px solid transparent", cursor:"pointer" }} />
        ))}
      </div>

      <div style={{ display:"flex", gap:10 }}>
        <button style={S.btnSecondary} onClick={onCancel}>Cancel</button>
        <button style={{ ...S.btnPrimary, opacity:valid?1:0.4 }} onClick={()=>valid&&onSave(form)} disabled={!valid}>
          {mode==="add" ? "Add Identity" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}

// ─── CONFIRM DIALOG ───────────────────────────────────────────────────────────
function Confirm({ message, onConfirm, onCancel }) {
  return (
    <Modal title="Confirm Delete" onClose={onCancel}>
      <div style={{ padding:"0 20px 20px" }}>
        <p style={{ color:T.text2, fontSize:15, lineHeight:1.7, marginTop:8 }}>{message}</p>
        <div style={{ display:"flex", gap:10, marginTop:20 }}>
          <button style={S.btnSecondary} onClick={onCancel}>Cancel</button>
          <button style={{ ...S.btnPrimary, background:"#C0392B" }} onClick={onConfirm}>Delete</button>
        </div>
      </div>
    </Modal>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [user,        setUser]        = useState(undefined); // undefined = loading
  const [identities,  setIdentities]  = useState([]);
  const [data,        setData]        = useState({});
  const [view,        setView]        = useState("today");
  const [selectedDate, setSelectedDate] = useState(getTodayKey());
  const [justChecked, setJustChecked] = useState(null);
  const [celebrationHabit, setCelebrationHabit] = useState(null);
  const [syncing, setSyncing] = useState(false);

  // Modal states
  const [modal, setModal] = useState(null);
  // modal types: "addHabit" | "editHabit" | "addIdentity" | "editIdentity" | "confirmDeleteHabit" | "confirmDeleteIdentity"
  const [modalCtx, setModalCtx] = useState(null);

  const todayKey    = getTodayKey();
  const weekDates   = getWeekDates();
  const todayData   = data[todayKey] || {};
  const selectedData = data[selectedDate] || {};

  // ── Debounced Firestore saves ──
  const idTimer   = useRef(null);
  const ciTimer   = useRef(null);
  const isFirstId = useRef(true);
  const isFirstCi = useRef(true);

  // ── Auth listener — load Firestore data on sign-in ──
  useEffect(() => {
    return onAuthStateChanged(_auth, async (u) => {
      // Reset "first render" guards so we don't immediately re-save loaded data
      isFirstId.current = true;
      isFirstCi.current = true;
      setUser(u);
      if (u) {
        const [idSnap, ciSnap] = await Promise.all([
          getDoc(identitiesRef(u.uid)),
          getDoc(checkInsRef(u.uid)),
        ]);
        if (idSnap.exists()) setIdentities(idSnap.data().data);
        if (ciSnap.exists()) setData(ciSnap.data().data);
      }
    });
  }, []);

  useEffect(() => {
    if (!user || isFirstId.current) { isFirstId.current = false; return; }
    clearTimeout(idTimer.current);
    idTimer.current = setTimeout(() => {
      setSyncing(true);
      setDoc(identitiesRef(user.uid), { data: identities })
        .finally(() => setSyncing(false));
    }, 800);
  }, [identities, user]);

  useEffect(() => {
    if (!user || isFirstCi.current) { isFirstCi.current = false; return; }
    clearTimeout(ciTimer.current);
    ciTimer.current = setTimeout(() => {
      setDoc(checkInsRef(user.uid), { data });
    }, 800);
  }, [data, user]);

  // ── Google sign-in ──
  const signIn = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    try { await signInWithPopup(_auth, provider); }
    catch (e) { console.error(e); }
  };

  // ── Streak — must be declared BEFORE any early returns (Rules of Hooks) ──
  // Walks backwards skipping days the habit wasn't scheduled; breaks on first
  // scheduled-but-unchecked day. Unscheduled days are transparent to the streak.
  const getStreakForHabit = useCallback((habitId, frequency) => {
    let streak = 0;
    const d = new Date();
    // start from today or yesterday (don't penalise if today not yet checked)
    for (let i = 0; i < 400; i++) {
      const key = d.toISOString().slice(0, 10);
      const scheduled = isScheduledOn(frequency, key);
      if (scheduled) {
        if (data[key] && data[key][habitId]) {
          streak++;
        } else {
          // missed a scheduled day — streak ends (unless it's today and not yet done)
          if (i > 0) break;
          // if today is scheduled but not yet checked, don't break — just don't count it
        }
      }
      d.setDate(d.getDate() - 1);
    }
    return streak;
  }, [data]);

  // ── Toggle — same: must be before early returns ──
  const toggle = useCallback((habitId, frequency) => {
    setData(prev=>{
      const day=prev[selectedDate]||{};
      return {...prev,[selectedDate]:{...day,[habitId]:!day[habitId]}};
    });
    setJustChecked(habitId);
    setTimeout(()=>setJustChecked(null),600);
    const streak = getStreakForHabit(habitId, frequency) + 1;
    const milestone = MILESTONES.find(m=>m.days===streak);
    if(milestone && !selectedData[habitId]) {
      setCelebrationHabit({habitId,milestone});
      setTimeout(()=>setCelebrationHabit(null),3500);
    }
  }, [selectedDate, selectedData, getStreakForHabit]);

  // ── Loading / Auth gates ──
  if (user === undefined) {
    return (
      <div style={{ ...S.root, alignItems:"center", justifyContent:"center" }}>
        <div style={{ fontSize:32, marginBottom:16 }}>⏳</div>
        <div style={{ color:T.muted, fontSize:14 }}>Loading…</div>
      </div>
    );
  }
  if (!user) {
    return (
      <div style={{ ...S.root, alignItems:"center", justifyContent:"center", gap:24, padding:32 }}>
        <div style={{ fontSize:52 }}>🧠</div>
        <div style={{ fontFamily:"'Space Grotesk','Inter',sans-serif", fontWeight:800, fontSize:24, color:T.text, textAlign:"center", letterSpacing:"-0.03em" }}>
          Atomic Habits
        </div>
        <div style={{ fontSize:14, color:T.muted, textAlign:"center", lineHeight:1.6 }}>
          Sign in with your BudgetBuddy account to sync your habits across devices.
        </div>
        <button onClick={signIn} style={{ ...S.btnPrimary, width:"100%", maxWidth:320, display:"flex", alignItems:"center", justifyContent:"center", gap:10, fontSize:15 }}>
          <span>🔑</span> Sign in with Google
        </button>
      </div>
    );
  }

  // ── CRUD: Habits ──
  const addHabit = ({ label, trigger, time, location, identityId, frequency }) => {
    setIdentities(prev => prev.map(ident =>
      ident.id !== identityId ? ident :
      { ...ident, habits: [...ident.habits, { id: uid(), label, trigger, time, location, frequency: frequency || DEFAULT_FREQUENCY }] }
    ));
    setModal(null);
  };

  const updateHabit = ({ label, trigger, time, location, identityId: newIdentityId, frequency }) => {
    const { identityId: oldIdentityId, habitId } = modalCtx;
    const freq = frequency || DEFAULT_FREQUENCY;
    if (newIdentityId === oldIdentityId) {
      setIdentities(prev => prev.map(ident =>
        ident.id !== oldIdentityId ? ident :
        { ...ident, habits: ident.habits.map(h => h.id !== habitId ? h : { ...h, label, trigger, time, location, frequency: freq }) }
      ));
    } else {
      setIdentities(prev => {
        const habitData = prev.find(i => i.id === oldIdentityId)?.habits.find(h => h.id === habitId);
        return prev.map(ident => {
          if (ident.id === oldIdentityId) return { ...ident, habits: ident.habits.filter(h => h.id !== habitId) };
          if (ident.id === newIdentityId) return { ...ident, habits: [...ident.habits, { ...habitData, label, trigger, time, location, frequency: freq }] };
          return ident;
        });
      });
    }
    setModal(null);
  };

  const deleteHabit = () => {
    const { identityId, habitId } = modalCtx;
    setIdentities(prev => prev.map(ident =>
      ident.id !== identityId ? ident :
      { ...ident, habits: ident.habits.filter(h => h.id !== habitId) }
    ));
    setModal(null);
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
    setIdentities(prev => prev.filter(i => i.id !== identityId));
    setModal(null);
  };

  // ── Scores ──
  const getIdentityScore = id => {
    const ident = identities.find(i=>i.id===id);
    if(!ident) return {done:0,total:0};
    const done = ident.habits.filter(h=>selectedData[h.id]).length;
    return {done, total:ident.habits.length};
  };
  const allHabits = identities.flatMap(i=>i.habits);
  const totalDone = allHabits.filter(h=>selectedData[h.id]).length;
  const totalTotal = allHabits.length;
  const pct = totalTotal>0 ? Math.round((totalDone/totalTotal)*100) : 0;

  const openEditHabit = (identityId, habit) => {
    setModalCtx({ identityId, habitId: habit.id, habit });
    setModal("editHabit");
  };
  const openDeleteHabit = (identityId, habit) => {
    setModalCtx({ identityId, habitId: habit.id, habit });
    setModal("confirmDeleteHabit");
  };
  const openEditIdentity = (ident) => {
    const colorIdx = IDENTITY_COLORS.indexOf(ident.color);
    setModalCtx({ identityId: ident.id, ident, colorIdx: colorIdx>=0?colorIdx:0 });
    setModal("editIdentity");
  };
  const openDeleteIdentity = (ident) => {
    setModalCtx({ identityId: ident.id, ident });
    setModal("confirmDeleteIdentity");
  };

  return (
    <div style={S.root}>
      <style>{css}</style>

      {/* ── Celebration Toast ── */}
      {celebrationHabit && (
        <div style={S.toast} className="toast-in">
          <span style={{fontSize:28}}>{celebrationHabit.milestone.emoji}</span>
          <div>
            <div style={{fontWeight:700,fontSize:14,color:T.text}}>{celebrationHabit.milestone.label}!</div>
            <div style={{fontSize:12,color:T.muted}}>{celebrationHabit.milestone.days}-day streak achieved 🎉</div>
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      {modal==="addHabit" && (
        <Modal title="Add New Habit" onClose={()=>setModal(null)}>
          <HabitForm identities={identities} onSave={addHabit} onCancel={()=>setModal(null)} mode="add" />
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
          <div style={S.eyebrow}>Atomic Habits {syncing && <span style={{opacity:0.6}}>· saving…</span>}</div>
          <h1 style={S.title}>{view==="today"?"Today":view==="week"?"This Week":view==="streaks"?"Streaks":"Manage"}</h1>
          <div style={S.dateLabel}>{new Date().toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"short"})}</div>
        </div>
        <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:6 }}>
        <button onClick={()=>fbSignOut(_auth)} style={{ background:"transparent", border:`1px solid ${T.border}`, borderRadius:20, fontSize:11, color:T.muted, padding:"3px 10px", cursor:"pointer", fontFamily:"inherit" }}>
          Sign out
        </button>
        <div style={S.ringWrap}>
          <svg width="68" height="68" viewBox="0 0 68 68">
            <circle cx="34" cy="34" r="28" fill="none" stroke={T.border} strokeWidth="5"/>
            <circle cx="34" cy="34" r="28" fill="none"
              stroke={pct===100?T.gold:T.green} strokeWidth="5"
              strokeDasharray={`${(pct/100)*176} 176`} strokeLinecap="round"
              transform="rotate(-90 34 34)" style={{transition:"stroke-dasharray 0.6s ease"}}/>
            <text x="34" y="39" textAnchor="middle" fill={T.text} fontSize="14" fontWeight="800" fontFamily="Space Grotesk,sans-serif" style={{fontVariantNumeric:"tabular-nums"}}>{pct}%</text>
          </svg>
          <div style={{...S.ringLabel, fontVariantNumeric:"tabular-nums"}}>{totalDone}/{totalTotal} done</div>
        </div>
        </div>
      </header>

      {/* ── Scrollable Content ── */}
      <div style={S.scrollArea}>
        {/* ── TODAY VIEW ── */}
        {view==="today" && (
          <TodayView
            identities={identities}
            todayData={selectedData}
            toggle={toggle}
            justChecked={justChecked}
            getStreakForHabit={getStreakForHabit}
            openEditHabit={openEditHabit}
            setModal={setModal}
            setModalCtx={setModalCtx}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            todayKey={todayKey}
          />
        )}

        {view==="week"    && <WeekView    data={data} weekDates={weekDates} todayKey={todayKey} identities={identities}/>}
        {view==="streaks" && <StreaksView  data={data} getStreak={getStreakForHabit} identities={identities}/>}
        {view==="manage"  && (
          <ManageView
            identities={identities}
            onAddHabit={()=>setModal("addHabit")}
            onEditHabit={openEditHabit}
            onDeleteHabit={openDeleteHabit}
            onAddIdentity={()=>setModal("addIdentity")}
            onEditIdentity={openEditIdentity}
            onDeleteIdentity={openDeleteIdentity}
          />
        )}
      </div>

      {/* ── Bottom Nav ── */}
      <nav style={S.bottomNav}>
        {[
          {id:"today",   icon:"☀️",  label:"Today"},
          {id:"week",    icon:"📅",  label:"Week"},
          {id:"streaks", icon:"🔥",  label:"Streaks"},
          {id:"manage",  icon:"⚙️",  label:"Manage"},
        ].map(t=>(
          <button key={t.id} onClick={()=>{ setView(t.id); if(t.id==="today") setSelectedDate(getTodayKey()); }} style={S.navBtn}>
            <span style={S.navIcon}>{t.icon}</span>
            <span style={{...S.navLabel, color:view===t.id?T.text:T.muted, fontWeight:view===t.id?700:500}}>{t.label}</span>
            {view===t.id && <div style={{width:4,height:4,borderRadius:"50%",background:T.gold,marginTop:1}}/>}
          </button>
        ))}
      </nav>
    </div>
  );
}

// ─── MANAGE VIEW ──────────────────────────────────────────────────────────────
function ManageView({ identities, onAddHabit, onEditHabit, onDeleteHabit, onAddIdentity, onEditIdentity, onDeleteIdentity }) {
  return (
    <div style={S.content}>
      <div style={{...S.card,padding:"14px 16px",background:`linear-gradient(135deg,${T.green}12,${T.gold}08)`}}>
        <div style={{...S.cardLabel,color:T.green,marginBottom:4}}>🗂 Manage Your System</div>
        <div style={{fontSize:13,color:T.text2,lineHeight:1.5}}>Add, edit, or delete your identities and habits.</div>
      </div>

      {identities.map(identity=>(
        <div key={identity.id} style={S.card}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
            <span style={{fontSize:24}}>{identity.icon}</span>
            <div style={{flex:1}}>
              <div style={{...S.cardLabel,color:identity.color}}>{identity.label}</div>
              <div style={{fontSize:11,color:T.muted,marginTop:2,fontWeight:500}}>{identity.habits.length} habit{identity.habits.length!==1?"s":""}</div>
            </div>
            <button onClick={()=>onEditIdentity(identity)} style={S.crudBtn}>✎</button>
            <button onClick={()=>onDeleteIdentity(identity)} style={{...S.crudBtn,color:T.red}}>🗑</button>
          </div>

          {identity.habits.length>0 && (
            <div style={{borderTop:`1px solid ${T.border}`,paddingTop:10,marginBottom:10}}>
              {identity.habits.map(habit=>(
                <div key={habit.id} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 0",borderBottom:`1px solid ${T.surf2}`}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,color:T.text,fontWeight:600}}>{habit.label}</div>
                    {habit.trigger&&<div style={{fontSize:11,color:T.muted,marginTop:2}}>⚡ {habit.trigger}</div>}
                  </div>
                  <button onClick={()=>onEditHabit(identity.id,habit)} style={S.crudBtn}>✎</button>
                  <button onClick={()=>onDeleteHabit(identity.id,habit)} style={{...S.crudBtn,color:T.red}}>🗑</button>
                </div>
              ))}
            </div>
          )}

          {identity.habits.length===0&&(
            <div style={{fontSize:12,color:T.muted,marginBottom:12,textAlign:"center",padding:"8px 0"}}>No habits yet — add one below</div>
          )}

          <button onClick={onAddHabit} style={{...S.addHabitBtn,borderColor:identity.color+"55"}}>
            <span style={{fontSize:16,color:identity.color,fontWeight:700}}>+</span>
            <span style={{fontSize:13,color:T.text2}}>Add habit</span>
          </button>
        </div>
      ))}

      <button onClick={onAddIdentity} style={S.addIdentityBtn}>+ Add New Identity</button>
    </div>
  );
}

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
  // handle "5th" etc
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

// ─── HABIT CARD — friction-free, full-card tap ────────────────────────────────
function HabitCard({ habit, identity, checked, streak, popping, toggle, openEditHabit }) {
  const milestone = getMilestone(streak);
  const next = getNextMilestone(streak);
  // indent body content to align with habit label (circle width + gap)
  const INDENT = 44 + 12;

  return (
    <div style={{
      borderRadius: 16, marginBottom: 8,
      background: checked ? T.surf2 : T.surface,
      border: `1.5px solid ${checked ? T.green : T.border}`,
      transition: "all 0.25s ease",
      boxShadow: checked ? `0 4px 16px ${T.green}22` : "0 1px 3px #0000000a",
      overflow: "hidden",
      position: "relative",
    }}>

      {/* ── Edit button ── */}
      <button
        onClick={e => { e.stopPropagation(); openEditHabit(identity.id, habit); }}
        style={{
          position: "absolute", top: 10, right: 10,
          background: "transparent", border: "none",
          fontSize: 14, color: T.border2,
          cursor: "pointer", padding: "4px 6px", lineHeight: 1,
          WebkitTapHighlightColor: "transparent",
          zIndex: 1,
        }}
      >✎</button>

      {/* ── Tap target ── */}
      <button
        onClick={() => toggle(habit.id, habit.frequency)}
        className={popping ? "pop" : ""}
        style={{
          display: "flex", flexDirection: "column",
          width: "100%", padding: "12px 14px 14px",
          background: "transparent", border: "none",
          cursor: "pointer", textAlign: "left",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        {/* ── 1. Trigger cue banner ── */}
        {habit.trigger && (
          <div style={{
            margin: "-12px -14px 14px -14px",
            borderLeft: `4px solid ${T.accent}`,
            background: checked ? T.accent + "18" : T.accent + "0c",
            padding: "9px 14px 9px 13px",
            transition: "background 0.25s",
          }}>
            <div style={{
              fontSize: 13, fontWeight: 600,
              color: checked ? T.green : T.text2,
              lineHeight: 1.35,
              transition: "color 0.2s",
            }}>
              {habit.trigger}
            </div>
          </div>
        )}

        {/* ── 2. Circle + label + time + milestone ── */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, width: "100%", paddingRight: 28 }}>

          {/* Check circle */}
          <div style={{
            width: 44, height: 44, borderRadius: "50%", flexShrink: 0, marginTop: 1,
            border: `2.5px solid ${checked ? T.green : T.border2}`,
            background: checked ? T.green : T.surface,
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.2s",
            boxShadow: checked ? `0 0 0 4px ${T.green}22` : "none",
          }}>
            {checked
              ? <span style={{ fontSize: 20, color: "#fff", fontWeight: 900, lineHeight: 1 }} className="check-pop">✓</span>
              : <span style={{ fontSize: 18, color: T.border2, lineHeight: 1 }}>○</span>
            }
          </div>

          {/* Label column */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 16, fontWeight: 700, lineHeight: 1.1,
              color: checked ? T.green : T.text,
              transition: "color 0.2s",
            }}>
              {habit.label}
            </div>

            {(habit.time || habit.location) && (
              <div style={{
                marginTop: 4, fontSize: 12, color: T.muted,
                display: "flex", gap: 12, flexWrap: "wrap", lineHeight: 1.4,
              }}>
                {habit.time     && <span>🕐 {to24h(habit.time)}</span>}
                {habit.location && <span>📍 {habit.location}</span>}
              </div>
            )}

            {/* Frequency chip — only show if not "every day" */}
            {(() => {
              const freq = habit.frequency;
              if (!freq) return null;
              const isEveryDay = freq.cadence === "weekly" && (freq.days||[]).length === 7;
              if (isEveryDay) return null;
              const { bg, color } = getFreqColor(freq);
              return (
                <span style={{
                  display:"inline-flex", alignItems:"center", gap:3,
                  fontSize:10, fontWeight:700, color, background:bg,
                  padding:"2px 7px", borderRadius:20, marginTop:5,
                }}>
                  🔁 {getFreqLabel(freq)}
                </span>
              );
            })()}

            {next && streak > 0 && (
              <div style={{ marginTop: 8, marginRight: 4 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: T.muted, fontWeight: 500 }}>→ {next.emoji} {next.label}</span>
                  <span style={{ fontSize: 10, color: T.green, fontWeight: 700 }}>{next.days - streak}d left</span>
                </div>
                <div style={{ height: 3, background: T.border, borderRadius: 99, overflow: "hidden" }}>
                  <div style={{ height:"100%", borderRadius: 99, transition:"width 0.5s", width:`${(streak/next.days)*100}%`, background: T.green }}/>
                </div>
              </div>
            )}
          </div>

          {/* Streak badge */}
          {streak >= 2 && (
            <span style={{
              fontSize: 12, fontWeight: 800, flexShrink: 0, marginTop: 2,
              color: T.gold, background: T.gold + "20",
              padding: "3px 9px", borderRadius: 20, whiteSpace: "nowrap",
            }}>
              {milestone ? milestone.emoji : "🔥"} {streak}d
            </span>
          )}
        </div>
      </button>
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
  if (dateKey === yest.toISOString().slice(0,10)) return "Yesterday";
  return date.toLocaleDateString("en-IN",{weekday:"short",day:"numeric",month:"short"});
}

function DayNavigator({ selectedDate, setSelectedDate, todayKey }) {
  const isToday = selectedDate === todayKey;
  const canNext = selectedDate < todayKey;

  const go = (delta) => {
    const [y,mo,d] = selectedDate.split("-").map(Number);
    const date = new Date(y, mo-1, d);
    date.setDate(date.getDate() + delta);
    const next = date.toISOString().slice(0,10);
    if (next <= todayKey) setSelectedDate(next);
  };

  return (
    <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:14 }}>
      <button onClick={()=>go(-1)} style={{
        width:36, height:36, borderRadius:"50%", border:`1.5px solid ${T.border}`,
        background:T.surface, color:T.text2, fontSize:18, lineHeight:1,
        cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
        flexShrink:0, WebkitTapHighlightColor:"transparent",
      }}>‹</button>

      <div style={{ flex:1, textAlign:"center" }}>
        <div style={{ fontSize:15, fontWeight:700, color:T.text, fontFamily:"'Space Grotesk',sans-serif" }}>
          {formatNavDate(selectedDate)}
        </div>
        {!isToday && (
          <button onClick={()=>setSelectedDate(todayKey)} style={{
            marginTop:3, fontSize:10, fontWeight:700, color:T.accent,
            background:T.accent+"18", border:`1px solid ${T.accent}44`,
            borderRadius:20, padding:"2px 10px", cursor:"pointer",
            letterSpacing:"0.04em", textTransform:"uppercase",
            WebkitTapHighlightColor:"transparent",
          }}>← Back to Today</button>
        )}
      </div>

      <button onClick={()=>go(1)} disabled={!canNext} style={{
        width:36, height:36, borderRadius:"50%", border:`1.5px solid ${canNext?T.border:T.surf2}`,
        background:T.surface, color:canNext?T.text2:T.border, fontSize:18, lineHeight:1,
        cursor:canNext?"pointer":"default", display:"flex", alignItems:"center", justifyContent:"center",
        flexShrink:0, WebkitTapHighlightColor:"transparent",
        opacity: canNext ? 1 : 0.35,
      }}>›</button>
    </div>
  );
}

// ─── TODAY VIEW ───────────────────────────────────────────────────────────────
function TodayView({ identities, todayData, toggle, justChecked, getStreakForHabit, openEditHabit, setModal, setModalCtx, selectedDate, setSelectedDate, todayKey }) {
  const [notTodayExpanded, setNotTodayExpanded] = useState(false);

  const allHabits = identities.flatMap(identity =>
    identity.habits.map(habit => ({ habit, identity, slotId: getSlotId(habit.time) }))
  );

  // Split into scheduled for this day vs not
  const scheduledHabits = allHabits.filter(({habit}) => isScheduledOn(habit.frequency, selectedDate));
  const notTodayHabits  = allHabits.filter(({habit}) => !isScheduledOn(habit.frequency, selectedDate));

  const totalDone  = scheduledHabits.filter(({habit}) => todayData[habit.id]).length;
  const totalTotal = scheduledHabits.length;
  const quote = getDailyQuote();

  return (
    <div style={S.content}>
      {/* Day Navigator */}
      <DayNavigator selectedDate={selectedDate} setSelectedDate={setSelectedDate} todayKey={todayKey} />

      {/* Daily quote banner */}
      <div style={{ background:`linear-gradient(135deg,${T.green}18,${T.gold}12)`, border:`1px solid ${T.green}33`, borderRadius:16, padding:"14px 16px" }}>
        <div style={{ fontSize:10,fontWeight:800,letterSpacing:"0.12em",color:T.green,marginBottom:6,textTransform:"uppercase" }}>✨ Today's Motivation</div>
        <div style={{ fontSize:14,color:T.text,fontStyle:"italic",lineHeight:1.65,fontWeight:500 }}>"{quote.text}"</div>
        {quote.author && <div style={{ fontSize:11,color:T.gold,fontWeight:700,marginTop:6 }}>— {quote.author}</div>}
      </div>

      {/* Identity legend bar */}
      <div style={{ ...S.card, padding:"12px 14px" }}>
        <div style={{ fontSize:10,color:T.muted,marginBottom:8,letterSpacing:"0.1em",fontWeight:700,textTransform:"uppercase" }}>Your Identities</div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
          {identities.map(i => {
            const done  = i.habits.filter(h=>todayData[h.id]).length;
            const total = i.habits.length;
            const allDone = total > 0 && done === total;
            return (
              <span key={i.id} style={{ fontSize:11, fontWeight:700, color: allDone?"#fff":i.color, background: allDone?i.color:i.color+"22", borderRadius:20, padding:"4px 10px", display:"flex", alignItems:"center", gap:4, border:`1px solid ${allDone?i.color:i.color+"44"}` }}>
                {i.icon} {i.label.replace("I am a ","").replace("I am ","")} {allDone?"✓":`${done}/${total}`}
              </span>
            );
          })}
        </div>
      </div>

      {/* Time slot sections — scheduled habits only, pending + leaving animation */}
      {TIME_SLOTS.map(slot => {
        const slotAll     = scheduledHabits.filter(h => h.slotId === slot.id);
        // show unchecked + the one just checked (it plays leave animation then vanishes)
        const slotVisible = slotAll.filter(({habit}) => !todayData[habit.id] || habit.id === justChecked);
        if (slotVisible.length === 0) return null;
        const pendingCnt  = slotAll.filter(({habit}) => !todayData[habit.id]).length;
        return (
          <div key={slot.id}>
            <div style={{ display:"flex", alignItems:"center", gap:8, margin:"4px 0 8px", paddingLeft:2 }}>
              <span style={{ fontSize:16 }}>{slot.emoji}</span>
              <span style={{ fontSize:13, fontWeight:700, color:T.text, fontFamily:"'Space Grotesk','Inter',sans-serif", letterSpacing:"-0.01em" }}>{slot.label}</span>
              <span style={{ fontSize:11, color:T.muted, marginLeft:"auto", fontWeight:600 }}>
                {pendingCnt} left
              </span>
            </div>

            {slotVisible.map(({ habit, identity }) => (
              <div key={habit.id} className={justChecked === habit.id ? "card-leaving" : ""}>
                <HabitCard
                  habit={habit}
                  identity={identity}
                  checked={!!todayData[habit.id]}
                  streak={getStreakForHabit(habit.id, habit.frequency)}
                  popping={false}
                  toggle={toggle}
                  openEditHabit={openEditHabit}
                />
              </div>
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
              <span style={{ fontSize:16 }}>✅</span>
              <span style={{ fontSize:13, fontWeight:700, color:T.green, fontFamily:"'Space Grotesk','Inter',sans-serif" }}>Completed</span>
              <span style={{ fontSize:11, color:T.green, marginLeft:"auto", fontWeight:700, background:T.green+"18", borderRadius:20, padding:"2px 9px" }}>{done.length}</span>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {done.map(({ habit, identity }) => {
                const streak = getStreakForHabit(habit.id, habit.frequency);
                const milestone = getMilestone(streak);
                return (
                  <button
                    key={habit.id}
                    onClick={() => toggle(habit.id, habit.frequency)}
                    style={{
                      display:"flex", alignItems:"center", gap:10,
                      background: T.green+"0e", border:`1.5px solid ${T.green}33`,
                      borderRadius:14, padding:"10px 14px",
                      cursor:"pointer", textAlign:"left", width:"100%",
                      WebkitTapHighlightColor:"transparent",
                      transition:"opacity 0.2s",
                    }}
                  >
                    <div style={{ width:32, height:32, borderRadius:"50%", flexShrink:0, background:T.green, display:"flex", alignItems:"center", justifyContent:"center", boxShadow:`0 0 0 3px ${T.green}22` }}>
                      <span style={{ fontSize:15, color:"#fff", fontWeight:900, lineHeight:1 }}>✓</span>
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:14, fontWeight:600, color:T.green, textDecoration:"line-through", textDecorationColor:T.green+"77", lineHeight:1.2 }}>{habit.label}</div>
                      <div style={{ fontSize:11, color:T.muted, marginTop:2 }}>{identity.icon} {identity.label.replace("I am a ","").replace("I am ","")}</div>
                    </div>
                    {streak >= 2 && (
                      <span style={{ fontSize:11, fontWeight:800, color:T.gold, background:T.gold+"20", padding:"2px 8px", borderRadius:20, flexShrink:0 }}>
                        {milestone ? milestone.emoji : "🔥"} {streak}d
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
            style={{
              display:"flex", alignItems:"center", gap:8, width:"100%",
              background:"transparent", border:"none", cursor:"pointer", padding:"4px 2px",
              WebkitTapHighlightColor:"transparent",
            }}
          >
            <span style={{ fontSize:14, opacity:0.5 }}>⏭</span>
            <span style={{ fontSize:12, fontWeight:700, color:T.muted }}>Not scheduled today</span>
            <span style={{ fontSize:11, color:T.muted, background:T.surf2, borderRadius:20, padding:"1px 8px", marginLeft:"auto" }}>{notTodayHabits.length}</span>
            <span style={{ fontSize:12, color:T.muted }}>{notTodayExpanded ? "▲" : "▼"}</span>
          </button>

          {notTodayExpanded && (
            <div style={{ marginTop:8, display:"flex", flexDirection:"column", gap:5 }}>
              {notTodayHabits.map(({ habit, identity }) => {
                const { bg, color } = getFreqColor(habit.frequency);
                return (
                  <div key={habit.id} style={{
                    display:"flex", alignItems:"center", gap:10,
                    background:T.surf2, border:`1px dashed ${T.border}`,
                    borderRadius:12, padding:"10px 14px", opacity:0.65,
                  }}>
                    <div style={{ width:30, height:30, borderRadius:"50%", border:`1.5px solid ${T.border}`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                      <span style={{ fontSize:12, color:T.muted }}>○</span>
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:T.muted }}>{habit.label}</div>
                      <div style={{ fontSize:11, color:T.muted, marginTop:2 }}>{identity.icon} {identity.label.replace("I am a ","").replace("I am ","")}</div>
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

      {/* Add habit / identity */}
      <button onClick={()=>setModal("addHabit")} style={S.addHabitBtn}>
        <span style={{ fontSize:18, color:T.green, fontWeight:700 }}>+</span>
        <span style={{ fontSize:13, color:T.text2, fontWeight:500 }}>Add a new habit</span>
      </button>
      <button onClick={()=>setModal("addIdentity")} style={S.addIdentityBtn}>+ Add New Identity</button>

      <div style={S.footer}>
        <span style={S.footerQuote}>"Habits are the compound interest of self-improvement."</span>
        <span style={S.footerAuthor}>— James Clear, Atomic Habits</span>
      </div>
    </div>
  );
}

// ─── WEEK VIEW ────────────────────────────────────────────────────────────────
function WeekView({ data, weekDates, todayKey, identities }) {
  return (
    <div style={S.content}>
      {identities.map(identity=>(
        <div key={identity.id} style={S.card}>
          <div style={{...S.cardLabel,color:identity.color,marginBottom:12}}>{identity.icon} {identity.label}</div>
          {identity.habits.length===0
            ? <div style={{fontSize:12,color:T.muted,textAlign:"center",padding:"8px 0"}}>No habits yet</div>
            : (
              <div style={S.weekGrid}>
                <div/>
                {weekDates.map((d,i)=>(
                  <div key={d} style={{...S.weekDayH,color:d===todayKey?identity.color:T.muted,fontWeight:d===todayKey?700:500}}>{DAY_LABELS[i]}</div>
                ))}
                {identity.habits.map(habit=>(
                  <>
                    <div key={habit.id+"_l"} style={S.weekHabitLabel}>{habit.label}</div>
                    {weekDates.map(d=>{
                      const done      = !!(data[d]&&data[d][habit.id]);
                      const scheduled = isScheduledOn(habit.frequency, d);
                      const future    = d > todayKey;
                      return (
                        <div key={d} style={{
                          ...S.weekDot,
                          background: done ? identity.color : scheduled ? T.surf2 : "transparent",
                          border: done ? `1px solid ${identity.color}` : scheduled ? `1px solid ${T.border}` : `1px dashed ${T.border}`,
                          opacity: future ? 0.35 : scheduled ? 1 : 0.4,
                        }}/>
                      );
                    })}
                  </>
                ))}
              </div>
            )
          }
        </div>
      ))}
      <div style={S.card}>
        <div style={{...S.cardLabel,color:T.gold,marginBottom:14}}>📊 Weekly Score</div>
        {identities.map(identity=>{
          const done=weekDates.reduce((a,d)=>a+identity.habits.filter(h=>data[d]&&data[d][h.id]).length,0);
          const possible=identity.habits.length*weekDates.filter(d=>d<=todayKey).length;
          const pct=possible>0?Math.round((done/possible)*100):0;
          return (
            <div key={identity.id} style={S.summaryRow}>
              <span style={{fontSize:12,color:T.text2,minWidth:110,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontWeight:500}}>
                {identity.icon} {identity.label.replace("I am a ","").replace("I am ","")}
              </span>
              <div style={S.summaryBar}><div style={{...S.summaryFill,width:`${pct}%`,background:identity.color}}/></div>
              <span style={{fontSize:12,color:identity.color,minWidth:36,textAlign:"right",fontWeight:700}}>{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── STREAKS VIEW ─────────────────────────────────────────────────────────────
function StreaksView({ data, getStreak, identities }) {
  const allHabits=identities.flatMap(i=>i.habits.map(h=>({...h,identity:i,streak:getStreak(h.id, h.frequency)})));
  const sorted=[...allHabits].sort((a,b)=>b.streak-a.streak);
  const topStreak=sorted[0]?.streak||0;
  return (
    <div style={S.content}>
      {topStreak>0&&(
        <div style={{...S.card,background:`linear-gradient(135deg,${T.gold}18,${T.accent}10)`,borderColor:T.gold+"55",textAlign:"center",padding:"28px 16px"}}>
          <div style={{fontSize:52}}>🔥</div>
          <div style={{fontSize:40,fontWeight:800,color:T.gold,fontFamily:"Space Grotesk,sans-serif",lineHeight:1}}>{topStreak}</div>
          <div style={{fontSize:13,color:T.text2,marginTop:6,fontWeight:500}}>Best active streak</div>
          <div style={{fontSize:14,color:T.text,marginTop:4,fontWeight:600}}>{sorted[0]?.label}</div>
        </div>
      )}
      {identities.map(identity=>(
        <div key={identity.id} style={S.card}>
          <div style={{...S.cardLabel,color:identity.color,marginBottom:12}}>{identity.icon} {identity.label}</div>
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
                      {milestone&&<span style={{marginLeft:8,fontSize:11,color:identity.color,fontWeight:600}}>{milestone.emoji} {milestone.label}</span>}
                    </div>
                    <span style={{fontSize:15,fontWeight:800,color:streak>0?identity.color:T.border2}}>
                      {streak>0?`🔥 ${streak}d`:"—"}
                    </span>
                  </div>
                  {habit.trigger&&<div style={{fontSize:11,color:T.muted,marginBottom:6}}>⚡ {habit.trigger} · 🕐 {habit.time||"—"} · 📍 {habit.location||"—"}</div>}
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <div style={{flex:1,height:5,background:T.surf2,borderRadius:99,overflow:"hidden",border:`1px solid ${T.border}`}}>
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
        <div style={{...S.cardLabel,color:T.gold,marginBottom:14}}>🏅 Milestone Map</div>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {MILESTONES.map(m=>(
            <div key={m.days} style={{display:"flex",alignItems:"center",gap:12}}>
              <span style={{fontSize:20,minWidth:28}}>{m.emoji}</span>
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
}

// ─── MOTIVATIONAL QUOTES (rotate daily) ──────────────────────────────────────
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

// ─── THEME PALETTE — Ocean Depth ─────────────────────────────────────────────
// BG:      #F0F9FF  — softest sky blue page wash
// Surface: #FFFFFF  — pure white cards float above the wash
// Surface2:#E0F2FE  — light ocean tint for secondary surfaces
// Border:  #BAE6FD  — airy sky-blue border
// Border2: #7DD3FC  — stronger ocean border for circles / inputs
// Text:    #0C4A6E  — deep navy — sharp, premium, readable
// Text2:   #0369A1  — medium ocean blue
// Muted:   #5B9EC9  — muted ocean for timestamps / labels
// Accent:  #0EA5E9  — sky blue — primary CTA, eyebrow, active states
// Green:   #0284C7  — deeper ocean for completion ring + progress bars
// Gold:    #F59E0B  — warm amber — streak badges, milestone labels

const T = {
  bg:      "#F0F9FF",
  surface: "#FFFFFF",
  surf2:   "#E0F2FE",
  border:  "#BAE6FD",
  border2: "#7DD3FC",
  text:    "#0C4A6E",
  text2:   "#0369A1",
  muted:   "#5B9EC9",
  accent:  "#0EA5E9",
  green:   "#0284C7",
  gold:    "#F59E0B",
  red:     "#EF4444",
};

// ─── STYLES — LIGHT MOBILE FIRST ─────────────────────────────────────────────
const FONT_DISPLAY = "'Space Grotesk','Plus Jakarta Sans',sans-serif";
const FONT_BODY    = "'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,sans-serif";

const S = {
  root:{
    minHeight:"100dvh", background:T.bg,
    fontFamily: FONT_BODY,
    color:T.text, width:"100%", maxWidth:430,
    margin:"0 auto", display:"flex", flexDirection:"column",
  },
  header:{
    position:"sticky", top:0, zIndex:50,
    background:T.bg+"f0", backdropFilter:"blur(16px)",
    WebkitBackdropFilter:"blur(16px)",
    borderBottom:`1px solid ${T.border}`,
    display:"flex", justifyContent:"space-between", alignItems:"center",
    padding:"16px 20px 14px",
    paddingTop:"calc(env(safe-area-inset-top,0px) + 16px)",
  },
  eyebrow:{fontSize:11,letterSpacing:"0.14em",color:T.accent,fontWeight:700,marginBottom:4,textTransform:"uppercase",fontFamily:FONT_BODY},
  title:{margin:0,fontSize:24,fontWeight:800,fontFamily:FONT_DISPLAY,letterSpacing:"-0.04em",color:T.text,lineHeight:1.05},
  dateLabel:{fontSize:13,color:T.muted,marginTop:4,fontWeight:500,letterSpacing:"0.01em"},
  ringWrap:{flexShrink:0,textAlign:"center"},
  ringLabel:{fontSize:11,color:T.muted,marginTop:2,fontWeight:600},

  scrollArea:{flex:1,overflowY:"auto",WebkitOverflowScrolling:"touch",paddingBottom:"calc(env(safe-area-inset-bottom,0px) + 80px)"},
  content:{padding:"12px 14px 0",display:"flex",flexDirection:"column",gap:10},

  bottomNav:{
    position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)",
    width:"100%", maxWidth:430,
    background:T.bg+"f8", backdropFilter:"blur(20px)", WebkitBackdropFilter:"blur(20px)",
    borderTop:`1px solid ${T.border}`,
    display:"flex", alignItems:"center",
    paddingBottom:"env(safe-area-inset-bottom,8px)",
    zIndex:50,
  },
  navBtn:{
    flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
    gap:3, padding:"10px 0 6px",
    background:"transparent", border:"none", cursor:"pointer",
    minHeight:56, WebkitTapHighlightColor:"transparent",
  },
  navIcon:{fontSize:20,lineHeight:1},
  navLabel:{fontSize:11,fontWeight:600,letterSpacing:"0.02em",fontFamily:FONT_BODY},

  toast:{
    position:"fixed", top:"calc(env(safe-area-inset-top,0px) + 12px)",
    left:"50%", transform:"translateX(-50%)",
    background:T.surface, border:`2px solid ${T.gold}`,
    borderRadius:18, padding:"14px 18px",
    display:"flex", alignItems:"center", gap:14,
    zIndex:999, boxShadow:"0 8px 32px #00000018",
    minWidth:240, maxWidth:"calc(100vw - 32px)",
  },

  overlay:{position:"fixed",inset:0,background:"#00000044",zIndex:100,display:"flex",alignItems:"flex-end",justifyContent:"center"},
  modal:{
    background:T.surface, borderRadius:"24px 24px 0 0",
    width:"100%", maxWidth:430,
    maxHeight:"92dvh", overflowY:"auto",
    paddingBottom:"env(safe-area-inset-bottom,16px)",
    boxShadow:"0 -8px 40px #00000018",
  },
  modalDrag:{width:40,height:4,background:T.border2,borderRadius:99,margin:"12px auto 0"},
  modalHeader:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 20px 14px",borderBottom:`1px solid ${T.border}`},
  modalTitle:{fontSize:18,fontWeight:700,color:T.text,fontFamily:FONT_DISPLAY,letterSpacing:"-0.02em"},
  modalClose:{
    background:T.surf2, border:"none", color:T.muted,
    fontSize:15, cursor:"pointer",
    width:34, height:34, borderRadius:"50%",
    display:"flex", alignItems:"center", justifyContent:"center",
    WebkitTapHighlightColor:"transparent",
  },

  fieldLabel:{display:"block",fontSize:11,letterSpacing:"0.08em",color:T.muted,fontWeight:700,marginBottom:8,marginTop:18,textTransform:"uppercase",fontFamily:FONT_BODY},
  input:{
    width:"100%", background:T.surf2,
    border:`1.5px solid ${T.border}`, borderRadius:12,
    padding:"14px 14px", color:T.text,
    fontSize:16, fontFamily:"inherit", outline:"none",
    boxSizing:"border-box", appearance:"none", WebkitAppearance:"none",
  },
  iconBtn:{width:46,height:46,border:`2px solid ${T.border}`,borderRadius:12,cursor:"pointer",fontSize:20,display:"flex",alignItems:"center",justifyContent:"center",WebkitTapHighlightColor:"transparent",background:T.surf2},
  btnPrimary:{
    flex:1, padding:"15px 0",
    background:T.green, border:"none", borderRadius:14,
    color:"#fff", fontSize:16, fontWeight:700,
    fontFamily:"inherit", cursor:"pointer",
    WebkitTapHighlightColor:"transparent", minHeight:52,
  },
  btnSecondary:{
    flex:1, padding:"15px 0",
    background:T.surf2, border:`1.5px solid ${T.border}`, borderRadius:14,
    color:T.text2, fontSize:16, fontWeight:600,
    fontFamily:"inherit", cursor:"pointer",
    WebkitTapHighlightColor:"transparent", minHeight:52,
  },

  card:{borderRadius:18,border:`1px solid ${T.border}`,padding:"14px",background:T.surface,transition:"background 0.3s,border-color 0.3s",boxShadow:"0 1px 4px #00000008"},
  cardHeader:{display:"flex",alignItems:"center",gap:10,marginBottom:10},
  cardIcon:{fontSize:22,flexShrink:0,lineHeight:1},
  cardLabel:{fontSize:15,fontWeight:700,fontFamily:FONT_DISPLAY,letterSpacing:"-0.02em",lineHeight:1.2,color:T.text},
  cardSub:{fontSize:11,color:T.muted,marginTop:2,fontWeight:500},
  badge:{marginLeft:"auto",fontSize:10,fontWeight:800,color:"#fff",padding:"4px 10px",borderRadius:20,letterSpacing:"0.04em",flexShrink:0,minHeight:22,display:"flex",alignItems:"center"},
  progressBar:{height:4,background:T.surf2,borderRadius:99,marginBottom:12,overflow:"hidden",border:`1px solid ${T.border}`},
  progressFill:{height:"100%",borderRadius:99,transition:"width 0.5s ease"},

  streakBadge:{fontSize:11,fontWeight:700,color:T.accent,flexShrink:0,background:T.accent+"18",padding:"3px 9px",borderRadius:20,lineHeight:1.5,border:`1px solid ${T.accent}33`},
  checkbox:{
    width:28,height:28,borderRadius:8,border:`2px solid ${T.border2}`,
    display:"flex",alignItems:"center",justifyContent:"center",
    flexShrink:0,transition:"all 0.2s",minWidth:28,
    background:T.surf2,
  },
  checkmark:{fontSize:14,color:"#fff",fontWeight:900},
  iconActionBtn:{
    width:44,height:44,background:"transparent",border:"none",cursor:"pointer",
    fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",
    flexShrink:0,transition:"color 0.2s",WebkitTapHighlightColor:"transparent",borderRadius:10,
  },
  crudBtn:{
    background:"transparent",border:"none",cursor:"pointer",
    fontSize:18,color:T.muted,padding:"0",borderRadius:8,
    width:44,height:44,
    display:"flex",alignItems:"center",justifyContent:"center",
    WebkitTapHighlightColor:"transparent",transition:"color 0.2s",
  },
  addHabitBtn:{
    display:"flex",alignItems:"center",gap:10,
    padding:"13px 14px",
    background:T.surf2,border:`1.5px dashed ${T.border2}`,
    borderRadius:14,cursor:"pointer",width:"100%",marginTop:6,
    minHeight:48,WebkitTapHighlightColor:"transparent",
  },
  addIdentityBtn:{
    padding:"15px",background:T.surf2,
    border:`2px dashed ${T.border2}`,borderRadius:18,
    color:T.muted,fontSize:15,fontWeight:600,
    cursor:"pointer",width:"100%",fontFamily:"inherit",
    minHeight:52,WebkitTapHighlightColor:"transparent",
    transition:"border-color 0.2s",
  },

  triggerPanel:{padding:"10px 12px",border:`1px solid ${T.border}`,borderTop:"none",borderRadius:"0 0 12px 12px",background:T.surf2},
  triggerRow:{display:"flex",alignItems:"flex-start",gap:8},
  triggerIcon:{fontSize:13,flexShrink:0,marginTop:1},
  triggerKey:{fontSize:9,letterSpacing:"0.1em",color:T.muted,fontWeight:700},
  triggerVal:{fontSize:12,color:T.text2,marginTop:2,lineHeight:1.4},
  nextMilestone:{marginTop:10,padding:"10px 12px",background:T.gold+"12",borderRadius:10,border:`1px solid ${T.gold}33`},
  milestoneBar:{height:4,background:T.border,borderRadius:99,marginTop:6,overflow:"hidden"},
  milestoneFill:{height:"100%",borderRadius:99,transition:"width 0.5s"},

  footer:{padding:"20px 4px 16px",display:"flex",flexDirection:"column",gap:6,borderTop:`1px solid ${T.border}`,marginTop:8},
  footerQuote:{fontSize:14,color:T.text2,fontStyle:"italic",lineHeight:1.75,fontWeight:500,fontFamily:FONT_BODY,letterSpacing:"0.01em"},
  footerAuthor:{fontSize:12,color:T.gold,fontWeight:700,letterSpacing:"0.06em",textTransform:"uppercase",fontFamily:FONT_BODY},

  weekGrid:{display:"grid",gridTemplateColumns:"1fr repeat(7, 26px)",gap:"6px 4px",alignItems:"center"},
  weekDayH:{fontSize:10,textAlign:"center",letterSpacing:"0.04em",fontWeight:600,color:T.muted},
  weekHabitLabel:{fontSize:12,color:T.muted,paddingRight:6,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"},
  weekDot:{width:22,height:22,borderRadius:6,margin:"0 auto",transition:"background 0.3s",border:`1px solid ${T.border}`},
  summaryRow:{display:"flex",alignItems:"center",gap:10,marginBottom:12},
  summaryBar:{flex:1,height:6,background:T.surf2,borderRadius:99,overflow:"hidden",border:`1px solid ${T.border}`},
  summaryFill:{height:"100%",borderRadius:99,transition:"width 0.5s"},
  streakItem:{padding:"12px 0",borderBottom:`1px solid ${T.border}`},

  habitList:{display:"flex",flexDirection:"column",gap:2},
  habitRow:{display:"flex",alignItems:"center",gap:10,padding:"12px 12px",border:"none",cursor:"pointer",textAlign:"left",transition:"background 0.2s",width:"100%",minHeight:56},
  habitLabel:{fontSize:15,flex:1,transition:"color 0.2s",color:T.text},
};

const css=`
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

  *, *::before, *::after { box-sizing: border-box; }
  html { -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }

  body {
    margin: 0;
    background: #F0F9FF;
    overscroll-behavior-y: none;
    -webkit-tap-highlight-color: transparent;
    font-synthesis: none;
    text-rendering: optimizeLegibility;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  /* Tabular nums on all numeric contexts */
  .num { font-variant-numeric: tabular-nums; font-feature-settings: 'tnum'; }

  input, select, textarea {
    font-size: 16px !important;
    font-family: 'Plus Jakarta Sans', sans-serif;
    -webkit-appearance: none;
  }
  input:focus, select:focus {
    border-color: #0EA5E9 !important;
    box-shadow: 0 0 0 3px #0EA5E922;
  }

  button { -webkit-tap-highlight-color: transparent; touch-action: manipulation; }

  @keyframes pop {
    0%   { transform: scale(1); }
    35%  { transform: scale(1.09); }
    100% { transform: scale(1); }
  }
  @keyframes slideUp {
    from { opacity:0; transform:translateX(-50%) translateY(12px); }
    to   { opacity:1; transform:translateX(-50%) translateY(0); }
  }
  @keyframes sheetIn {
    from { transform: translateY(100%); }
    to   { transform: translateY(0); }
  }
  @keyframes checkPop {
    0%   { transform: scale(0.7); opacity:0; }
    60%  { transform: scale(1.15); }
    100% { transform: scale(1); opacity:1; }
  }
  @keyframes cardLeave {
    0%   { opacity:1; transform:translateX(0);    max-height:240px; margin-bottom:8px; }
    55%  { opacity:0; transform:translateX(32px); max-height:240px; margin-bottom:8px; }
    100% { opacity:0; transform:translateX(32px); max-height:0;     margin-bottom:0; }
  }

  .pop { animation: pop 0.3s ease; }
  .toast-in { animation: slideUp 0.3s ease forwards; }
  .sheet-in { animation: sheetIn 0.3s cubic-bezier(0.32,0.72,0,1); }
  .check-pop { animation: checkPop 0.3s ease forwards; }
  .card-leaving { animation: cardLeave 0.55s ease forwards; pointer-events:none; overflow:hidden; }

  select option { background: #FFFFFF; color: #1A1208; }

  ::-webkit-scrollbar { display: none; }
  * { scrollbar-width: none; }

  @media (hover: hover) {
    button:hover { opacity: 0.82; }
  }
  @media (prefers-reduced-motion: reduce) {
    * { animation: none !important; transition: none !important; }
  }
`;
