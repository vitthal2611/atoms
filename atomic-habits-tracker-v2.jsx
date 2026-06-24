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
const DEFAULT_IDENTITIES = [
  {
    id: "fit", label: "I am a Fit Person", icon: "🏃", color: "#4CAF7D", colorDim: "#1a3028",
    habits: [
      { id: "exercise", label: "Exercise 30 min",      trigger: "After morning alarm",           time: "6:30 AM",   location: "Home / Gym" },
      { id: "steps",    label: "10,000 steps",          trigger: "After lunch break",             time: "1:00 PM",   location: "Office / Park" },
      { id: "water",    label: "Drink 2L water",        trigger: "Every time I sit at desk",      time: "All day",   location: "Everywhere" },
      { id: "sleep",    label: "Sleep by 10:30 PM",     trigger: "Phone on charger outside room", time: "10:00 PM",  location: "Bedroom" },
    ],
  },
  {
    id: "learner", label: "I am a Learner", icon: "📚", color: "#5B8DEF", colorDim: "#1a2038",
    habits: [
      { id: "read",    label: "Read 20 pages",        trigger: "After dinner is cleared",  time: "9:00 PM",  location: "Living room chair" },
      { id: "skill",   label: "1 hr skill building",  trigger: "After kids are settled",   time: "9:30 PM",  location: "Study desk" },
      { id: "reflect", label: "Daily reflection",     trigger: "Before closing laptop",    time: "6:00 PM",  location: "Work desk" },
      { id: "podcast", label: "Listen to podcast",    trigger: "During morning commute",   time: "8:00 AM",  location: "Car / Walk" },
    ],
  },
  {
    id: "parent", label: "I am a Good Parent", icon: "👨‍👧", color: "#E07B54", colorDim: "#2e1a10",
    habits: [
      { id: "playtime", label: "Playtime with Ovi",      trigger: "When I get home from work",  time: "6:30 PM", location: "Living room" },
      { id: "tilak",    label: "Bond time with Tilak",    trigger: "After Tilak's evening feed", time: "7:00 PM", location: "Nursery" },
      { id: "present",  label: "Phone-free family hour",  trigger: "Phone goes in drawer",       time: "7:00 PM", location: "Home" },
      { id: "story",    label: "Bedtime story",           trigger: "After Ovi brushes teeth",    time: "8:30 PM", location: "Ovi's room" },
    ],
  },
  {
    id: "husband", label: "I am a Good Husband", icon: "❤️", color: "#C17F24", colorDim: "#2e1e08",
    habits: [
      { id: "gratitude", label: "Express gratitude", trigger: "Morning tea together",         time: "7:00 AM", location: "Kitchen" },
      { id: "checkin",   label: "Evening check-in",  trigger: "After kids sleep",             time: "9:00 PM", location: "Home" },
      { id: "help",      label: "Help at home",       trigger: "When I see something to do",  time: "Evening", location: "Home" },
    ],
  },
  {
    id: "debt", label: "I am Debt-Free", icon: "💰", color: "#9B59B6", colorDim: "#1e0f2e",
    habits: [
      { id: "budget",    label: "Track expenses",   trigger: "After every purchase",           time: "Immediate", location: "BudgetBuddy app" },
      { id: "emi",       label: "EMI on time",      trigger: "Calendar reminder 3 days prior", time: "Due date",  location: "Bank app" },
      { id: "nosplurge", label: "No impulse spend", trigger: "24hr rule before buying",        time: "Always",    location: "Everywhere" },
      { id: "invest",    label: "SIP invested",     trigger: "Auto-debit on 5th of month",    time: "5th",       location: "Zerodha / MF" },
    ],
  },
];

const IDENTITY_COLORS = ["#4CAF7D","#5B8DEF","#E07B54","#C17F24","#9B59B6","#E74C8B","#26C6DA","#F39C12"];
const IDENTITY_DIMS   = ["#1a3028","#1a2038","#2e1a10","#2e1e08","#1e0f2e","#2e0f1e","#0f2630","#2e1e00"];
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
function getTodayKey() { return new Date().toISOString().slice(0,10); }
function uid() { return Math.random().toString(36).slice(2,10); }
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

// ─── HABIT FORM ───────────────────────────────────────────────────────────────
function HabitForm({ initial={}, identities, onSave, onCancel, mode="add" }) {
  const [form, setForm] = useState({
    label: initial.label || "",
    trigger: initial.trigger || "",
    time: initial.time || "",
    location: initial.location || "",
    identityId: initial.identityId || identities[0]?.id || "",
  });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const valid = form.label.trim().length > 0 && form.identityId;

  return (
    <div style={{ padding: "0 20px 20px" }}>
      <label style={S.fieldLabel}>Habit Name *</label>
      <input style={S.input} value={form.label} onChange={e=>set("label",e.target.value)} placeholder="e.g. Meditate 10 min" autoFocus />

      {mode==="add" && (
        <>
          <label style={S.fieldLabel}>Identity *</label>
          <select style={S.input} value={form.identityId} onChange={e=>set("identityId",e.target.value)}>
            {identities.map(i=><option key={i.id} value={i.id}>{i.icon} {i.label}</option>)}
          </select>
        </>
      )}

      <label style={S.fieldLabel}>⚡ Trigger (what cues this habit?)</label>
      <input style={S.input} value={form.trigger} onChange={e=>set("trigger",e.target.value)} placeholder="e.g. After morning coffee" />

      <label style={S.fieldLabel}>🕐 Time</label>
      <input style={S.input} value={form.time} onChange={e=>set("time",e.target.value)} placeholder="e.g. 7:00 AM" />

      <label style={S.fieldLabel}>📍 Location</label>
      <input style={S.input} value={form.location} onChange={e=>set("location",e.target.value)} placeholder="e.g. Kitchen" />

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
  const [identities,  setIdentities]  = useState(DEFAULT_IDENTITIES);
  const [data,        setData]        = useState({});
  const [view,        setView]        = useState("today");
  const [justChecked, setJustChecked] = useState(null);
  const [celebrationHabit, setCelebrationHabit] = useState(null);
  const [syncing, setSyncing] = useState(false);

  // Modal states
  const [modal, setModal] = useState(null);
  // modal types: "addHabit" | "editHabit" | "addIdentity" | "editIdentity" | "confirmDeleteHabit" | "confirmDeleteIdentity"
  const [modalCtx, setModalCtx] = useState(null);

  const todayKey  = getTodayKey();
  const weekDates = getWeekDates();
  const todayData = data[todayKey] || {};

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

  // ── Streak ──
  const getStreakForHabit = useCallback((habitId) => {
    let streak=0; const d=new Date();
    while(true) {
      const key=d.toISOString().slice(0,10);
      if(data[key]&&data[key][habitId]){ streak++; d.setDate(d.getDate()-1); } else break;
    }
    return streak;
  }, [data]);

  // ── Toggle ──
  const toggle = useCallback((habitId) => {
    setData(prev=>{
      const day=prev[todayKey]||{};
      return {...prev,[todayKey]:{...day,[habitId]:!day[habitId]}};
    });
    setJustChecked(habitId);
    setTimeout(()=>setJustChecked(null),600);
    const streak = getStreakForHabit(habitId)+1;
    const milestone = MILESTONES.find(m=>m.days===streak);
    if(milestone && !todayData[habitId]) {
      setCelebrationHabit({habitId,milestone});
      setTimeout(()=>setCelebrationHabit(null),3500);
    }
  }, [todayKey, todayData, getStreakForHabit]);

  // ── CRUD: Habits ──
  const addHabit = ({ label, trigger, time, location, identityId }) => {
    setIdentities(prev => prev.map(ident =>
      ident.id !== identityId ? ident :
      { ...ident, habits: [...ident.habits, { id: uid(), label, trigger, time, location }] }
    ));
    setModal(null);
  };

  const updateHabit = ({ label, trigger, time, location }) => {
    const { identityId, habitId } = modalCtx;
    setIdentities(prev => prev.map(ident =>
      ident.id !== identityId ? ident :
      { ...ident, habits: ident.habits.map(h => h.id !== habitId ? h : { ...h, label, trigger, time, location }) }
    ));
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
    const done = ident.habits.filter(h=>todayData[h.id]).length;
    return {done, total:ident.habits.length};
  };
  const allHabits = identities.flatMap(i=>i.habits);
  const totalDone = allHabits.filter(h=>todayData[h.id]).length;
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
          <HabitForm initial={modalCtx.habit} identities={identities} onSave={updateHabit} onCancel={()=>setModal(null)} mode="edit" />
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
            <text x="34" y="39" textAnchor="middle" fill={T.text} fontSize="14" fontWeight="800" fontFamily="Space Grotesk,sans-serif">{pct}%</text>
          </svg>
          <div style={S.ringLabel}>{totalDone}/{totalTotal} done</div>
        </div>
        </div>
      </header>

      {/* ── Scrollable Content ── */}
      <div style={S.scrollArea}>
        {/* ── TODAY VIEW ── */}
        {view==="today" && (
          <TodayView
            identities={identities}
            todayData={todayData}
            toggle={toggle}
            justChecked={justChecked}
            getStreakForHabit={getStreakForHabit}
            openEditHabit={openEditHabit}
            setModal={setModal}
            setModalCtx={setModalCtx}
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
          <button key={t.id} onClick={()=>setView(t.id)} style={S.navBtn}>
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

  return (
    <div style={{
      borderRadius: 16, marginBottom: 8,
      background: checked
        ? `linear-gradient(135deg, ${identity.color}22, ${identity.color}0a)`
        : T.surface,
      border: `2px solid ${checked ? identity.color : T.border}`,
      transition: "all 0.2s ease",
      boxShadow: checked ? `0 4px 16px ${identity.color}28` : "0 1px 4px #00000008",
      overflow: "hidden",
      position: "relative",
    }}>

      {/* ── ENTIRE CARD is the tap target ── */}
      <button
        onClick={() => toggle(habit.id)}
        className={popping ? "pop" : ""}
        style={{
          display: "flex", alignItems: "center", gap: 14,
          width: "100%", padding: "16px 14px",
          background: "transparent", border: "none",
          cursor: "pointer", textAlign: "left",
          WebkitTapHighlightColor: "transparent",
          minHeight: 72,
        }}
      >
        {/* Big check circle — the only visual affordance needed */}
        <div style={{
          width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
          border: `2.5px solid ${checked ? identity.color : T.border2}`,
          background: checked ? identity.color : T.surf2,
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all 0.2s",
          boxShadow: checked ? `0 0 0 4px ${identity.color}25` : "none",
        }}>
          {checked
            ? <span style={{ fontSize: 20, color: "#fff", fontWeight: 900, lineHeight: 1 }} className="check-pop">✓</span>
            : <span style={{ fontSize: 18, color: T.border2, lineHeight: 1 }}>○</span>
          }
        </div>

        {/* Label + meta */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 16, fontWeight: 700,
            color: checked ? identity.color : T.text,
            lineHeight: 1.3,
            textDecoration: checked ? "none" : "none",
            transition: "color 0.2s",
          }}>
            {habit.label}
          </div>

          {/* Trigger + time as a single quiet line */}
          <div style={{
            fontSize: 12, color: T.muted, marginTop: 4,
            display: "flex", gap: 10, flexWrap: "wrap", lineHeight: 1.4,
          }}>
            {habit.trigger && <span>⚡ {habit.trigger}</span>}
            {habit.time    && <span>🕐 {habit.time}</span>}
            {habit.location&& <span>📍 {habit.location}</span>}
          </div>

          {/* Streak milestone progress — only when active */}
          {next && streak > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom: 3 }}>
                <span style={{ fontSize: 10, color: T.muted }}>→ {next.emoji} {next.label}</span>
                <span style={{ fontSize: 10, color: identity.color, fontWeight: 700 }}>{next.days - streak}d</span>
              </div>
              <div style={{ height: 3, background: T.border, borderRadius: 99, overflow: "hidden" }}>
                <div style={{ height:"100%", width:`${(streak/next.days)*100}%`, background: identity.color, borderRadius: 99, transition:"width 0.5s" }}/>
              </div>
            </div>
          )}
        </div>

        {/* Right side: streak + identity dot */}
        <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap: 6, flexShrink: 0 }}>
          {streak >= 2 && (
            <span style={{ fontSize: 12, fontWeight: 800, color: T.accent, background: T.accent+"15", padding:"3px 8px", borderRadius: 20, whiteSpace:"nowrap" }}>
              {milestone ? milestone.emoji : "🔥"} {streak}d
            </span>
          )}
          <span style={{
            width: 8, height: 8, borderRadius: "50%",
            background: identity.color, flexShrink: 0,
            opacity: 0.7,
          }}/>
        </div>
      </button>

      {/* Edit button — small, non-intrusive, bottom-right corner */}
      <button
        onClick={e => { e.stopPropagation(); openEditHabit(identity.id, habit); }}
        style={{
          position: "absolute", bottom: 8, right: 10,
          background: "transparent", border: "none",
          fontSize: 13, color: checked ? identity.color+"88" : T.border2,
          cursor: "pointer", padding: "4px 6px", lineHeight: 1,
          WebkitTapHighlightColor: "transparent",
        }}
      >✎</button>

    </div>
  );
}

// ─── TODAY VIEW ───────────────────────────────────────────────────────────────
function TodayView({ identities, todayData, toggle, justChecked, getStreakForHabit, openEditHabit, setModal, setModalCtx }) {
  const allHabits = identities.flatMap(identity =>
    identity.habits.map(habit => ({ habit, identity, slotId: getSlotId(habit.time) }))
  );
  const totalDone  = allHabits.filter(({habit}) => todayData[habit.id]).length;
  const totalTotal = allHabits.length;
  const quote = getDailyQuote();

  return (
    <div style={S.content}>
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

      {/* Time slot sections */}
      {TIME_SLOTS.map(slot => {
        const slotHabits = allHabits.filter(h => h.slotId === slot.id);
        if (slotHabits.length === 0) return null;
        const doneCnt = slotHabits.filter(({habit}) => todayData[habit.id]).length;
        return (
          <div key={slot.id}>
            {/* Slot header */}
            <div style={{ display:"flex", alignItems:"center", gap:8, margin:"4px 0 8px", paddingLeft:2 }}>
              <span style={{ fontSize:16 }}>{slot.emoji}</span>
              <span style={{ fontSize:13, fontWeight:700, color:T.text, fontFamily:"'Space Grotesk','Inter',sans-serif", letterSpacing:"-0.01em" }}>{slot.label}</span>
              <span style={{ fontSize:11, color:T.muted, marginLeft:"auto", fontWeight:600 }}>{doneCnt}/{slotHabits.length}</span>
              <div style={{ width:48, height:4, background:T.border, borderRadius:99, overflow:"hidden" }}>
                <div style={{ height:"100%", width:`${slotHabits.length>0?(doneCnt/slotHabits.length)*100:0}%`, background:T.green, borderRadius:99, transition:"width 0.4s" }}/>
              </div>
            </div>

            {/* Habits in this slot */}
            {slotHabits.map(({ habit, identity }) => (
              <HabitCard
                key={habit.id}
                habit={habit}
                identity={identity}
                checked={!!todayData[habit.id]}
                streak={getStreakForHabit(habit.id)}
                popping={justChecked === habit.id}
                toggle={toggle}
                openEditHabit={openEditHabit}
              />
            ))}
          </div>
        );
      })}

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
                      const done=!!(data[d]&&data[d][habit.id]);
                      return <div key={d} style={{...S.weekDot,background:done?identity.color:T.surf2,border:`1px solid ${done?identity.color:T.border}`,opacity:d>todayKey?0.35:1}}/>;
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
  const allHabits=identities.flatMap(i=>i.habits.map(h=>({...h,identity:i,streak:getStreak(h.id)})));
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
              const streak=getStreak(habit.id);
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

// ─── LIGHT THEME PALETTE ──────────────────────────────────────────────────────
// BG:      #FDF8F2  — warm cream
// Surface: #FFFFFF  — pure white cards
// Surface2:#F5F0E8  — subtle warm tint
// Border:  #E8E0D4  — soft warm border
// Text:    #1A1208  — deep warm black
// Muted:   #8B7355  — warm brown-grey
// Accent:  #E8521A  — energetic coral-orange
// Green:   #2E7D4F  — rich forest green
// Gold:    #B8860B  — deep amber

const T = {
  bg:      "#FDF8F2",
  surface: "#FFFFFF",
  surf2:   "#F5F0E8",
  border:  "#E8E0D4",
  border2: "#D4C9B8",
  text:    "#1A1208",
  text2:   "#5C4A32",
  muted:   "#9B8670",
  accent:  "#E8521A",
  green:   "#2E7D4F",
  gold:    "#B8860B",
  red:     "#C0392B",
};

// ─── STYLES — LIGHT MOBILE FIRST ─────────────────────────────────────────────
const S = {
  root:{
    minHeight:"100dvh", background:T.bg,
    fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
    color:T.text, width:"100%", maxWidth:430,
    margin:"0 auto", display:"flex", flexDirection:"column",
    WebkitFontSmoothing:"antialiased",
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
  eyebrow:{fontSize:10,letterSpacing:"0.18em",color:T.accent,fontWeight:800,marginBottom:3,textTransform:"uppercase"},
  title:{margin:0,fontSize:22,fontWeight:800,fontFamily:"'Space Grotesk','Inter',sans-serif",letterSpacing:"-0.03em",color:T.text,lineHeight:1.1},
  dateLabel:{fontSize:12,color:T.muted,marginTop:3,fontWeight:500},
  ringWrap:{flexShrink:0,textAlign:"center"},
  ringLabel:{fontSize:10,color:T.muted,marginTop:2,fontWeight:600},

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
  navLabel:{fontSize:10,fontWeight:700,letterSpacing:"0.03em"},

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
  modalTitle:{fontSize:17,fontWeight:700,color:T.text,fontFamily:"'Space Grotesk','Inter',sans-serif"},
  modalClose:{
    background:T.surf2, border:"none", color:T.muted,
    fontSize:15, cursor:"pointer",
    width:34, height:34, borderRadius:"50%",
    display:"flex", alignItems:"center", justifyContent:"center",
    WebkitTapHighlightColor:"transparent",
  },

  fieldLabel:{display:"block",fontSize:11,letterSpacing:"0.1em",color:T.muted,fontWeight:700,marginBottom:8,marginTop:18,textTransform:"uppercase"},
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
  cardLabel:{fontSize:15,fontWeight:700,fontFamily:"'Space Grotesk','Inter',sans-serif",letterSpacing:"-0.01em",lineHeight:1.2,color:T.text},
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
  footerQuote:{fontSize:13,color:T.text2,fontStyle:"italic",lineHeight:1.7,fontWeight:500},
  footerAuthor:{fontSize:11,color:T.gold,fontWeight:700,letterSpacing:"0.04em"},

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
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700;800&family=Inter:wght@400;500;600;700&display=swap');

  *, *::before, *::after { box-sizing: border-box; }
  html { -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }

  body {
    margin: 0;
    background: #FDF8F2;
    overscroll-behavior-y: none;
    -webkit-tap-highlight-color: transparent;
  }

  input, select, textarea {
    font-size: 16px !important;
    -webkit-appearance: none;
  }
  input:focus, select:focus {
    border-color: #2E7D4F !important;
    box-shadow: 0 0 0 3px #2E7D4F22;
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

  .pop { animation: pop 0.3s ease; }
  .toast-in { animation: slideUp 0.3s ease forwards; }
  .sheet-in { animation: sheetIn 0.3s cubic-bezier(0.32,0.72,0,1); }
  .check-pop { animation: checkPop 0.3s ease forwards; }

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
