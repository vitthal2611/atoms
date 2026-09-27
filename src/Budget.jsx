import { useState } from "react";

// ─── BUDGET PLANNER ──────────────────────────────────────────────────────────
// Envelope budgeting in ₹, folded into the app as its own tab. Every category
// and transaction carries a bucket — Need / Want / Save / Income — so the
// dashboard can show the 50/30/20 lens alongside per-envelope tracking.
// Supports multiple months (create + commit), category CRUD, and editing or
// deleting individual transactions.

const T = {
  bg:"#F0F9FF", surface:"#FFFFFF", surf2:"#E0F2FE", border:"#D6E9F2",
  text:"#26333B", text2:"#4A6572", muted:"#5F6E7A",
  primary:"#0284C7", primarySoft:"#0284C71a",
  need:"#0284C7", want:"#B45309", save:"#7C3AED", income:"#15803D",
  needSoft:"#0284C714", wantSoft:"#B4530914", saveSoft:"#7C3AED14", incomeSoft:"#15803D14",
  good:"#15803D", goodSoft:"#15803D14", warn:"#B45309", warnSoft:"#B4530914",
  bad:"#DC2626", badSoft:"#DC262614",
  shadow:"0 1px 2px rgba(16,40,60,.05), 0 6px 18px rgba(16,40,60,.06)",
};
const BUCKETS = {
  need:   { label:"Need",   color:T.need,   soft:T.needSoft,   target:50 },
  want:   { label:"Want",   color:T.want,   soft:T.wantSoft,   target:30 },
  save:   { label:"Save",   color:T.save,   soft:T.saveSoft,   target:20 },
  income: { label:"Income", color:T.income, soft:T.incomeSoft, target:0 },
};
const INR = n => (n<0?"-":"")+"₹"+Math.abs(Math.round(n)).toLocaleString("en-IN");
const pct = (a,b) => b>0 ? (a/b*100) : 0;
const MON  = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONF = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const fmtDate = iso => { const [y,m,d]=(iso||"").split("-"); return d?`${+d} ${MON[+m-1]}`:iso; };
const monthShift = (id,delta) => { const [y,m]=id.split("-").map(Number); const d=new Date(y,m-1+delta,1); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0"); };
const monthLabel = id => { const [y,m]=id.split("-").map(Number); return MONF[m-1]+" "+y; };

let _tid = 1;
const tx = (date,desc,amount,categoryId,bucket,mode) =>
  ({ id:"t"+(_tid++), date, desc, amount, categoryId, bucket, mode, notes:"" });

export function seedBudget() {
  const month = {
    id:"2026-09", label:"September 2026", status:"committed",
    salaryIncome:215000, otherIncome:2000,
    categories:[
      { id:"ssy",   name:"SSY",                bucket:"save", budget:22000 },
      { id:"sip",   name:"SIP",                bucket:"save", budget:20000 },
      { id:"re",    name:"Real Estate",        bucket:"save", budget:20000 },
      { id:"emi",   name:"EMI",                bucket:"need", budget:91393 },
      { id:"milk",  name:"Milk",               bucket:"need", budget:2700 },
      { id:"elec",  name:"Electricity",        bucket:"need", budget:2500 },
      { id:"water", name:"Water",              bucket:"need", budget:800 },
      { id:"gas",   name:"Gas",                bucket:"need", budget:4000 },
      { id:"help",  name:"Salary / Helper",    bucket:"need", budget:1000 },
      { id:"dmart", name:"DMart",              bucket:"need", budget:8500 },
      { id:"veg",   name:"Vegetables",         bucket:"need", budget:3000 },
      { id:"petrol",name:"Petrol",             bucket:"need", budget:6000 },
      { id:"ins",   name:"Insurance & School", bucket:"need", budget:20000 },
      { id:"med",   name:"Medical",            bucket:"need", budget:4000 },
      { id:"sub",   name:"Subscription",       bucket:"want", budget:1000 },
      { id:"eat",   name:"Eatout",             bucket:"want", budget:5000 },
      { id:"shop",  name:"Shopping",           bucket:"want", budget:8000 },
      { id:"maint", name:"Maintenance",        bucket:"want", budget:1500 },
      { id:"groom", name:"Grooming",           bucket:"want", budget:1700 },
      { id:"ent",   name:"Entertainment",      bucket:"want", budget:1700 },
    ],
    savingsActual:{ sip:20000, ssy:22000, re:10000 },
    txns:[
      tx("2026-09-01","EMI auto-debit",91393,"emi","need","Netbanking"),
      tx("2026-09-05","Insurance & school fees",20000,"ins","need","Netbanking"),
      tx("2026-09-01","Milk (monthly)",2700,"milk","need","UPI"),
      tx("2026-09-08","Electricity bill",2500,"elec","need","UPI"),
      tx("2026-09-06","Water bill",800,"water","need","UPI"),
      tx("2026-09-03","Gas cylinder",4000,"gas","need","UPI"),
      tx("2026-09-01","Helper salary",1000,"help","need","Cash"),
      tx("2026-09-12","DMart groceries",3200,"dmart","need","Card"),
      tx("2026-09-20","DMart groceries",3000,"dmart","need","Card"),
      tx("2026-09-27","DMart top-up",2300,"dmart","need","UPI"),
      tx("2026-09-14","Vegetables",1800,"veg","need","Cash"),
      tx("2026-09-10","Petrol",2500,"petrol","need","UPI"),
      tx("2026-09-24","Petrol",3000,"petrol","need","UPI"),
      tx("2026-09-07","Pharmacy",1500,"med","need","UPI"),
      tx("2026-09-02","OTT subscription",1000,"sub","want","Card"),
      tx("2026-09-09","Dinner out",1700,"eat","want","Card"),
      tx("2026-09-15","Lunch",700,"eat","want","UPI"),
      tx("2026-09-19","Coffee & snacks",800,"eat","want","UPI"),
      tx("2026-09-22","Weekend dinner",1000,"eat","want","Card"),
      tx("2026-09-11","Clothes",6000,"shop","want","Card"),
      tx("2026-09-16","Salon",1900,"groom","want","UPI"),
      tx("2026-09-21","Movie",900,"ent","want","Card"),
    ],
  };
  return { active:"2026-09", months:{ "2026-09":month } };
}

function calc(m) {
  const spentBy = {}; let incomeExtra = 0;
  (m.txns||[]).forEach(x => {
    if (x.bucket === "income") { incomeExtra += (+x.amount||0); return; }
    spentBy[x.categoryId] = (spentBy[x.categoryId]||0) + (+x.amount||0);
  });
  const income = (+m.salaryIncome||0) + (+m.otherIncome||0) + incomeExtra;
  const cats = m.categories||[];
  const byBucket = { need:{b:0,s:0}, want:{b:0,s:0}, save:{b:0,s:0} };
  cats.forEach(c => {
    const bk = byBucket[c.bucket]; if(!bk) return;
    bk.b += (+c.budget||0);
    bk.s += (c.bucket==="save") ? (+(m.savingsActual?.[c.id]||0)) : (spentBy[c.id]||0);
  });
  const savBudget = byBucket.save.b, savActual = byBucket.save.s;
  const expBudget = byBucket.need.b + byBucket.want.b;
  const expSpent  = byBucket.need.s + byBucket.want.s;
  const allocated = savBudget + expBudget;
  const remaining = income - expSpent - savActual;
  const unallocated = income - allocated;
  return { income, incomeExtra, spentBy, cats, byBucket, savBudget, savActual,
    expBudget, expSpent, allocated, remaining, unallocated };
}
const statusOf = (s,b) => { const u=pct(s,b); return u>100?"bad":u>=80?"warn":"good"; };

// ── shared styles ──
const card = extra => ({ background:T.surface, border:`1px solid ${T.border}`, borderRadius:14, padding:14, boxShadow:T.shadow, ...(extra||{}) });
const tagBtn = { fontSize:11, fontWeight:600, color:T.text2, background:T.surf2, border:`1px solid ${T.border}`, padding:"5px 10px", borderRadius:9, cursor:"pointer", fontFamily:"inherit" };
const fld = { width:"100%", background:T.surf2, border:`1px solid ${T.border}`, borderRadius:11, padding:"11px 12px", color:T.text, fontFamily:"inherit", fontSize:15, outline:"none", boxSizing:"border-box" };
const lab = { display:"block", fontSize:11.5, fontWeight:600, color:T.text2, marginBottom:5 };
const chipStyle = kind => {
  const c = kind==="bad"?T.bad:kind==="warn"?T.warn:kind==="done"?T.save:T.good;
  const s = kind==="bad"?T.badSoft:kind==="warn"?T.warnSoft:kind==="done"?T.saveSoft:T.goodSoft;
  return { fontSize:10.5, fontWeight:800, padding:"2px 8px", borderRadius:20, letterSpacing:".02em", background:s, color:c, whiteSpace:"nowrap" };
};
function Bar({ value, color }) {
  return <div style={{ height:8, borderRadius:6, background:T.surf2, overflow:"hidden", marginTop:8 }}>
    <div style={{ height:"100%", width:Math.min(100,value)+"%", background:color, borderRadius:6 }} />
  </div>;
}
function Donut({ parts, size=88 }) {
  const total = parts.reduce((s,p)=>s+Math.max(0,p.val),0)||1;
  const r=size/2, ir=r*0.6; let a=-Math.PI/2;
  const paths = parts.map((p,i)=>{
    if (p.val<=0) return null;
    const frac=p.val/total, a2=a+frac*Math.PI*2;
    const x1=r+r*Math.cos(a), y1=r+r*Math.sin(a), x2=r+r*Math.cos(a2), y2=r+r*Math.sin(a2);
    const xi1=r+ir*Math.cos(a), yi1=r+ir*Math.sin(a), xi2=r+ir*Math.cos(a2), yi2=r+ir*Math.sin(a2);
    const large = frac>0.5?1:0; a=a2;
    return <path key={i} d={`M${x1} ${y1} A${r} ${r} 0 ${large} 1 ${x2} ${y2} L${xi2} ${yi2} A${ir} ${ir} 0 ${large} 0 ${xi1} ${yi1} Z`} fill={p.color} />;
  });
  return <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink:0 }}>{paths}</svg>;
}
function Tile({ lab:l, val, sub, hero, subColor, onEdit }) {
  return <div style={hero
    ? { gridColumn:"1/-1", background:`linear-gradient(135deg, ${T.primary}, #075E8C)`, borderRadius:14, padding:"14px 15px", color:"#fff", boxShadow:T.shadow, position:"relative" }
    : { background:T.surface, border:`1px solid ${T.border}`, borderRadius:14, padding:"13px 14px", boxShadow:T.shadow }}>
    <div style={{ fontSize:11, fontWeight:600, textTransform:"uppercase", letterSpacing:".05em", color:hero?"#ffffffcc":T.muted }}>{l}</div>
    <div style={{ fontWeight:800, fontSize:hero?26:21, letterSpacing:"-.02em", marginTop:3, fontVariantNumeric:"tabular-nums", color:hero?"#fff":T.text }}>{val}</div>
    {sub && <div style={{ fontSize:11.5, marginTop:2, color:hero?"#ffffffdd":(subColor||T.text2) }}>{sub}</div>}
    {onEdit && <button onClick={onEdit} aria-label="Edit income" style={{ position:"absolute", top:12, right:12, background:"#ffffff2e", border:"none", color:"#fff", borderRadius:8, padding:"4px 9px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>Edit</button>}
  </div>;
}
function Envelope({ name, spent, budget, color }) {
  const rem=budget-spent, u=pct(spent,budget), st=statusOf(spent,budget);
  const col = st==="bad"?T.bad:st==="warn"?T.warn:(color||T.primary);
  const label = st==="bad"?"Overspent":st==="warn"?"Watch":"On track";
  return <div style={{ flex:1, minWidth:0 }}>
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", gap:8 }}>
      <span style={{ fontWeight:600, fontSize:14, color:T.text }}>{name}</span>
      <span style={{ fontWeight:700, fontSize:13.5, fontVariantNumeric:"tabular-nums", color:T.text }}>
        {INR(spent)} <span style={{ color:T.muted, fontWeight:500 }}>/ {INR(budget)}</span></span>
    </div>
    <Bar value={u} color={col} />
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:8, marginTop:7 }}>
      <span style={{ fontSize:11.5, color:T.text2, fontVariantNumeric:"tabular-nums" }}>
        {rem<0 ? <span style={{ color:T.bad, fontWeight:700 }}>{INR(rem)} over</span> : `${INR(rem)} left`} · {u.toFixed(0)}% used</span>
      <span style={chipStyle(st)}>{label}</span>
    </div>
  </div>;
}

// ═══ MODALS ══════════════════════════════════════════════════════════════════
function Sheet({ title, children, onClose }) {
  return <div onClick={e=>{ if(e.target===e.currentTarget) onClose(); }}
    style={{ position:"fixed", inset:0, background:"rgba(10,20,28,.5)", zIndex:120, display:"flex", alignItems:"flex-end", justifyContent:"center" }}>
    <div style={{ background:T.surface, width:"100%", maxWidth:460, borderRadius:"20px 20px 0 0", padding:"18px 16px calc(18px + env(safe-area-inset-bottom,0px))", maxHeight:"92vh", overflow:"auto" }}>
      <div style={{ fontWeight:700, fontSize:17, marginBottom:14, color:T.text }}>{title}</div>
      {children}
    </div>
  </div>;
}
const rowBtns = (cancel, save, saveLabel="Save", danger) => (
  <div style={{ display:"flex", gap:10, marginTop:6 }}>
    {danger && <button onClick={danger} style={{ background:T.badSoft, color:T.bad, border:`1px solid ${T.bad}44`, borderRadius:12, padding:"13px 14px", fontFamily:"inherit", fontWeight:700, fontSize:14, cursor:"pointer" }}>Delete</button>}
    <button onClick={cancel} style={{ flex: danger?"0 0 auto":"0 0 38%", background:"transparent", color:T.text2, border:`1px solid ${T.border}`, borderRadius:12, padding:13, fontFamily:"inherit", fontWeight:700, fontSize:15, cursor:"pointer" }}>Cancel</button>
    <button onClick={save} style={{ flex:1, background:T.primary, color:"#fff", border:"none", borderRadius:12, padding:13, fontFamily:"inherit", fontWeight:700, fontSize:15, cursor:"pointer" }}>{saveLabel}</button>
  </div>
);

function Confirm({ message, onYes, onClose }) {
  return <Sheet title="Please confirm" onClose={onClose}>
    <div style={{ fontSize:14, color:T.text2, lineHeight:1.5, marginBottom:16 }}>{message}</div>
    <div style={{ display:"flex", gap:10 }}>
      <button onClick={onClose} style={{ flex:1, background:"transparent", color:T.text2, border:`1px solid ${T.border}`, borderRadius:12, padding:13, fontFamily:"inherit", fontWeight:700, fontSize:15, cursor:"pointer" }}>Cancel</button>
      <button onClick={()=>{ onYes(); onClose(); }} style={{ flex:1, background:T.bad, color:"#fff", border:"none", borderRadius:12, padding:13, fontFamily:"inherit", fontWeight:700, fontSize:15, cursor:"pointer" }}>Delete</button>
    </div>
  </Sheet>;
}

function IncomeForm({ m, api, onClose }) {
  const [sal,setSal]=useState(String(m.salaryIncome||"")); const [oth,setOth]=useState(String(m.otherIncome||""));
  return <Sheet title="Monthly income" onClose={onClose}>
    <div style={{ marginBottom:12 }}><label style={lab}>Salary income (₹)</label><input style={fld} type="number" inputMode="numeric" value={sal} onChange={e=>setSal(e.target.value)} placeholder="0" autoFocus /></div>
    <div style={{ marginBottom:14 }}><label style={lab}>Other income (₹)</label><input style={fld} type="number" inputMode="numeric" value={oth} onChange={e=>setOth(e.target.value)} placeholder="0" /></div>
    {rowBtns(onClose, ()=>{ api.setIncome(Math.max(0,+sal||0), Math.max(0,+oth||0)); onClose(); })}
  </Sheet>;
}

function CategoryForm({ initial, defaultBucket, api, committed, onClose }) {
  const edit = !!initial;
  const [name,setName]=useState(initial?.name||"");
  const [bucket,setBucket]=useState(initial?.bucket||defaultBucket||"need");
  const [budget,setBudget]=useState(initial?initial.budget?String(initial.budget):"":"");
  const [err,setErr]=useState(""); const [confirmDel,setConfirmDel]=useState(false);
  const save=()=>{
    const nm=name.trim(); const b=+budget;
    if(!nm) return setErr("Give the category a name.");
    if(!(b>=0)) return setErr("Budget can't be negative.");
    if(edit) api.editCategory(initial.id,{ name:nm, bucket, budget:Math.round(b) });
    else api.addCategory({ name:nm, bucket, budget:Math.round(b) });
    onClose();
  };
  if (confirmDel) return <Confirm message={`Delete "${initial.name}"? Its transactions this month will be removed too.`} onYes={()=>api.deleteCategory(initial.id)} onClose={onClose} />;
  return <Sheet title={edit?"Edit category":"Add category"} onClose={onClose}>
    {committed && <div style={{ background:T.warnSoft, color:T.warn, borderRadius:10, padding:"9px 11px", fontSize:12, fontWeight:600, marginBottom:12 }}>This month is committed — changes to allocations take effect immediately.</div>}
    <div style={{ display:"flex", gap:7, marginBottom:12 }}>
      {["need","want","save"].map(k=><button key={k} onClick={()=>setBucket(k)}
        style={{ flex:1, padding:"8px 0", borderRadius:10, fontFamily:"inherit", fontSize:12.5, fontWeight:700, cursor:"pointer",
          border:`1px solid ${bucket===k?BUCKETS[k].color:T.border}`, background:bucket===k?BUCKETS[k].soft:"transparent", color:bucket===k?BUCKETS[k].color:T.text2 }}>{BUCKETS[k].label}</button>)}
    </div>
    <div style={{ marginBottom:12 }}><label style={lab}>Category name</label><input style={fld} value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Groceries" autoFocus /></div>
    <div style={{ marginBottom:12 }}><label style={lab}>Monthly budget (₹)</label><input style={fld} type="number" inputMode="numeric" min="0" value={budget} onChange={e=>setBudget(e.target.value)} placeholder="0" /></div>
    {err && <div style={{ fontSize:12, color:T.bad, marginBottom:8 }}>{err}</div>}
    {rowBtns(onClose, save, edit?"Save":"Add", edit?()=>setConfirmDel(true):null)}
  </Sheet>;
}

function TxnForm({ m, api, initial, onClose }) {
  const edit=!!initial; const exp=(m.categories||[]);
  const [amt,setAmt]=useState(initial?String(initial.amount):"");
  const [bucket,setBucket]=useState(initial?.bucket||"need");
  const [cat,setCat]=useState(initial?.categoryId || exp.find(c=>c.bucket==="need")?.id || exp[0]?.id || "");
  const [date,setDate]=useState(initial?.date || m.id+"-27");
  const [desc,setDesc]=useState(initial?.desc||""); const [mode,setMode]=useState(initial?.mode||"UPI");
  const [notes,setNotes]=useState(initial?.notes||""); const [err,setErr]=useState(""); const [confirmDel,setConfirmDel]=useState(false);
  const catsForBucket=exp.filter(c=>c.bucket===bucket);
  const onBucket=bk=>{ setBucket(bk); if(bk!=="income"){ const f=exp.find(c=>c.bucket===bk); if(f) setCat(f.id); } };
  const submit=()=>{
    const a=+amt;
    if(m.status!=="committed") return setErr("Commit this month before recording transactions.");
    if(!(a>0)) return setErr("Enter an amount greater than ₹0.");
    if(!date||date.slice(0,7)!==m.id) return setErr("Date must fall within "+m.label+".");
    if(bucket!=="income"&&!cat) return setErr("Pick a category.");
    const patch={ date, desc:desc.trim(), amount:a, bucket, categoryId:bucket==="income"?"":cat, mode, notes:notes.trim() };
    if(edit) api.editTxn(initial.id,patch);
    else api.addTxn({ id:"t"+Date.now(), ...patch });
    onClose("go");
  };
  if (confirmDel) return <Confirm message="Delete this transaction? Its amount will be removed from the envelope." onYes={()=>api.deleteTxn(initial.id)} onClose={()=>onClose("go")} />;
  return <Sheet title={edit?"Edit transaction":"Add transaction"} onClose={()=>onClose()}>
    <div style={{ display:"flex", gap:7, marginBottom:12 }}>
      {Object.keys(BUCKETS).map(k=><button key={k} onClick={()=>onBucket(k)}
        style={{ flex:1, padding:"8px 0", borderRadius:10, fontFamily:"inherit", fontSize:12.5, fontWeight:700, cursor:"pointer",
          border:`1px solid ${bucket===k?BUCKETS[k].color:T.border}`, background:bucket===k?BUCKETS[k].soft:"transparent", color:bucket===k?BUCKETS[k].color:T.text2 }}>{BUCKETS[k].label}</button>)}
    </div>
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
      <div><label style={lab}>Amount (₹)</label><input style={fld} type="number" inputMode="numeric" min="1" value={amt} onChange={e=>setAmt(e.target.value)} placeholder="0" autoFocus /></div>
      <div><label style={lab}>Date</label><input style={fld} type="date" value={date} min={m.id+"-01"} max={m.id+"-31"} onChange={e=>setDate(e.target.value)} /></div>
    </div>
    {bucket!=="income" && <div style={{ marginBottom:12 }}><label style={lab}>Category</label>
      <select style={fld} value={cat} onChange={e=>setCat(e.target.value)}>{catsForBucket.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>}
    <div style={{ marginBottom:12 }}><label style={lab}>Description</label>
      <input style={fld} value={desc} onChange={e=>setDesc(e.target.value)} placeholder={bucket==="income"?"e.g. Freelance payment":"e.g. DMart groceries"} /></div>
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
      <div><label style={lab}>Payment mode</label><select style={fld} value={mode} onChange={e=>setMode(e.target.value)}>
        <option>UPI</option><option>Card</option><option>Netbanking</option><option>Cash</option></select></div>
      <div><label style={lab}>Notes</label><input style={fld} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="—" /></div>
    </div>
    {err && <div style={{ fontSize:12, color:T.bad, marginBottom:8 }}>{err}</div>}
    {rowBtns(()=>onClose(), submit, edit?"Save":"Add", edit?()=>setConfirmDel(true):null)}
  </Sheet>;
}

// ═══ SUB-VIEWS ═══════════════════════════════════════════════════════════════
function Overview({ m, open }) {
  const d = calc(m); const over = d.unallocated < 0; const rows = [];
  rows.push(<div key="kpi" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
    <Tile hero lab="Total income" val={INR(d.income)} sub={`Salary ${INR(m.salaryIncome)} · Other ${INR((+m.otherIncome||0)+d.incomeExtra)}`} onEdit={()=>open({type:"income"})} />
    <Tile lab="Allocated" val={INR(d.allocated)} sub={over?`Over by ${INR(-d.unallocated)}`:`${INR(d.unallocated)} unallocated`} subColor={over?T.bad:T.text2} />
    <Tile lab="Spent" val={INR(d.expSpent)} sub={`of ${INR(d.expBudget)} expenses`} />
    <Tile lab="Saved" val={INR(d.savActual)} sub={`of ${INR(d.savBudget)} planned`} subColor={T.save} />
    <Tile lab="Remaining" val={INR(d.remaining)} sub="income − spent − saved" subColor={d.remaining<0?T.bad:T.good} />
  </div>);
  if (over) rows.push(<div key="warn" style={{ background:T.warnSoft, border:`1px solid ${T.warn}55`, color:T.warn, borderRadius:12, padding:"10px 12px", fontSize:12.5, fontWeight:600, display:"flex", gap:8 }}>
    <span>⚠</span><span>Allocated {INR(d.allocated)} against {INR(d.income)} income — over-committed by {INR(-d.unallocated)}. Trim a category or add income.</span></div>);
  rows.push(<div key="nws" style={card()}>
    <div style={{ fontWeight:600, fontSize:14, marginBottom:12, color:T.text }}>Need · Want · Save <span style={{ color:T.muted, fontWeight:500, fontSize:12 }}>(share of income)</span></div>
    {["need","want","save"].map(k=>{ const B=BUCKETS[k], bd=d.byBucket[k], share=pct(bd.s,d.income);
      return <div key={k} style={{ marginBottom:12 }}>
        <div style={{ display:"flex", justifyContent:"space-between", fontSize:12.5, marginBottom:2 }}>
          <span style={{ fontWeight:700, color:B.color }}>{B.label} <span style={{ color:T.muted, fontWeight:500 }}>· target {B.target}%</span></span>
          <span style={{ fontVariantNumeric:"tabular-nums", color:T.text2 }}>{INR(bd.s)} · <b style={{ color:T.text }}>{share.toFixed(0)}%</b></span>
        </div>
        <div style={{ position:"relative", height:10, borderRadius:6, background:T.surf2, overflow:"hidden" }}>
          <div style={{ position:"absolute", height:"100%", width:Math.min(100,share)+"%", background:B.color, borderRadius:6 }} />
          <div style={{ position:"absolute", top:-2, left:Math.min(100,B.target)+"%", width:2, height:14, background:T.text, opacity:.45 }} /></div>
      </div>; })}
    <div style={{ fontSize:11, color:T.muted, marginTop:2 }}>Marker shows the 50/30/20 guideline for each bucket.</div>
  </div>);
  const parts=[{name:"Need",val:d.byBucket.need.b,color:T.need},{name:"Want",val:d.byBucket.want.b,color:T.want},{name:"Save",val:d.byBucket.save.b,color:T.save}];
  if (d.unallocated>0) parts.push({name:"Unallocated",val:d.unallocated,color:T.surf2});
  rows.push(<div key="donut" style={card()}>
    <div style={{ fontWeight:600, fontSize:14, marginBottom:10, color:T.text }}>Where the income goes</div>
    <div style={{ display:"flex", alignItems:"center", gap:16 }}><Donut parts={parts} />
      <div style={{ display:"flex", flexDirection:"column", gap:8, flex:1 }}>
        {parts.map(p=><div key={p.name} style={{ display:"flex", alignItems:"center", gap:8, fontSize:12.5 }}>
          <span style={{ width:10, height:10, borderRadius:3, background:p.color, flexShrink:0 }} />
          <span style={{ flex:1, color:T.text2 }}>{p.name}</span>
          <span style={{ fontWeight:600, fontVariantNumeric:"tabular-nums", color:T.text }}>{INR(p.val)}</span></div>)}
      </div></div>
  </div>);
  const flex = d.income - d.byBucket.need.b - d.byBucket.save.b;
  const hr=(n,v,col)=><div style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:`1px solid ${T.border}`, fontSize:14 }}>
    <span style={{ color:T.text2 }}>{n}</span><span style={{ fontWeight:700, fontVariantNumeric:"tabular-nums", color:col }}>{INR(v)}</span></div>;
  rows.push(<div key="health" style={card()}>
    <div style={{ fontWeight:600, fontSize:14, marginBottom:6, color:T.text }}>Budget health</div>
    {hr("Income", d.income, T.text)}{hr("Fixed needs", -d.byBucket.need.b, T.need)}
    {hr("Savings commitment", -d.byBucket.save.b, T.save)}{hr("Wants budget", -d.byBucket.want.b, T.want)}
    <div style={{ display:"flex", justifyContent:"space-between", paddingTop:11, marginTop:2, fontSize:14, borderTop:`2px solid ${T.border}` }}>
      <span style={{ color:T.text }}>Flexible money left</span><span style={{ fontWeight:800, fontVariantNumeric:"tabular-nums", color:flex<0?T.bad:T.good }}>{INR(flex)}</span></div>
  </div>);
  return rows;
}

function Envelopes({ m, open }) {
  const d = calc(m); const [editMode,setEditMode]=useState(false);
  const committed = m.status==="committed";
  const group=(title,bucket)=>{
    const items=d.cats.filter(c=>c.bucket===bucket); if(!items.length&&!editMode) return null;
    const b=d.byBucket[bucket].b, s=d.byBucket[bucket].s;
    return <div style={card()} key={bucket}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:2 }}>
        <span style={{ fontWeight:700, fontSize:13, color:BUCKETS[bucket].color }}>{title}</span>
        <span style={{ fontSize:12, color:T.muted, fontVariantNumeric:"tabular-nums" }}>{INR(s)} / {INR(b)}</span></div>
      {items.map(c=><div key={c.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"12px 0", borderBottom:`1px solid ${T.border}` }}>
        {editMode && <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
          <button onClick={()=>api_move(c.id,-1)} style={arrowBtn}>▲</button>
          <button onClick={()=>api_move(c.id,1)} style={arrowBtn}>▼</button></div>}
        <Envelope name={c.name} spent={d.spentBy[c.id]||0} budget={+c.budget||0} color={BUCKETS[bucket].color} />
        {editMode && <button onClick={()=>open({type:"category", initial:c})} style={{ ...tagBtn, flexShrink:0 }}>Edit</button>}
      </div>)}
      {editMode && <button onClick={()=>open({type:"category", defaultBucket:bucket})} style={{ ...tagBtn, marginTop:10 }}>+ Add {title.slice(0,-1)}</button>}
    </div>;
  };
  const api_move=(id,dir)=>open({type:"__move", id, dir}); // handled by parent via open
  const recent=[...(m.txns||[])].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,10);
  const catName=id=>d.cats.find(c=>c.id===id)?.name||"Income";
  return [
    <div key="hdr" style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
      <span style={{ fontSize:12, color:T.muted, fontWeight:600 }}>{editMode?"Reorder, edit or add categories":"Tap a transaction to edit it"}</span>
      <button onClick={()=>setEditMode(v=>!v)} style={{ ...tagBtn, color:editMode?T.primary:T.text2, borderColor:editMode?T.primary:T.border }}>{editMode?"Done":"Edit categories"}</button>
    </div>,
    group("Needs","need"), group("Wants","want"),
    <div key="txns" style={card()}>
      <div style={{ fontWeight:600, fontSize:14, marginBottom:6, color:T.text }}>Recent transactions</div>
      {recent.length ? recent.map(x=><div key={x.id} onClick={()=>open({type:"txn", initial:x})} role="button" tabIndex={0}
        style={{ display:"flex", alignItems:"center", gap:11, padding:"11px 0", borderBottom:`1px solid ${T.border}`, cursor:"pointer" }}>
        <div style={{ width:38, height:38, borderRadius:11, background:x.bucket==="income"?T.incomeSoft:BUCKETS[x.bucket]?.soft||T.surf2, color:x.bucket==="income"?T.income:BUCKETS[x.bucket]?.color||T.text2, display:"flex", alignItems:"center", justifyContent:"center", fontSize:15, fontWeight:800, flexShrink:0 }}>{catName(x.categoryId)[0]}</div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontWeight:600, fontSize:13.5, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", color:T.text }}>{x.desc||catName(x.categoryId)}</div>
          <div style={{ fontSize:11.5, color:T.muted }}>{fmtDate(x.date)} · {catName(x.categoryId)} · {x.mode}</div></div>
        <div style={{ fontWeight:700, fontSize:14, fontVariantNumeric:"tabular-nums", color:x.bucket==="income"?T.income:T.text }}>{x.bucket==="income"?"+":""}{INR(x.amount)}</div>
      </div>) : <div style={{ color:T.muted, fontSize:13, textAlign:"center", padding:"18px 0" }}>No transactions yet. Tap + to add one.</div>}
    </div>,
  ];
}
const arrowBtn = { background:T.surf2, border:`1px solid ${T.border}`, color:T.text2, width:22, height:16, borderRadius:5, fontSize:8, lineHeight:1, cursor:"pointer", padding:0 };

function Savings({ m, api, open }) {
  const d = calc(m); const items=d.cats.filter(c=>c.bucket==="save");
  return <div style={card()}>
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:2 }}>
      <span style={{ fontWeight:700, fontSize:13, color:T.save }}>Savings & investments</span>
      <span style={{ fontSize:12, color:T.muted, fontVariantNumeric:"tabular-nums" }}>{INR(d.savActual)} / {INR(d.savBudget)}</span></div>
    {items.map(c=>{ const b=+c.budget||0, act=+(m.savingsActual?.[c.id]||0), u=pct(act,b), done=act>=b&&b>0;
      const st=done?"done":u>=80?"good":"warn", lab2=done?"Completed":u>0?"In progress":"Not funded";
      return <div key={c.id} style={{ padding:"12px 0", borderBottom:`1px solid ${T.border}` }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", gap:8 }}>
          <span style={{ fontWeight:600, fontSize:14, color:T.text }}>{c.name}</span>
          <span style={{ fontWeight:700, fontSize:13.5, fontVariantNumeric:"tabular-nums", color:T.text }}>{INR(act)} <span style={{ color:T.muted, fontWeight:500 }}>/ {INR(b)}</span></span></div>
        <Bar value={u} color={T.save} />
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:7 }}>
          <span style={{ fontSize:11.5, color:T.text2, fontVariantNumeric:"tabular-nums" }}>{u.toFixed(0)}% funded</span><span style={chipStyle(st)}>{lab2}</span></div>
        <div style={{ display:"flex", gap:8, marginTop:8 }}>
          <button onClick={()=>api.setSavingsActual(c.id,b)} style={tagBtn}>{done?"Funded ✓":"Mark funded"}</button>
          <button onClick={()=>api.setSavingsActual(c.id,0)} style={tagBtn}>Reset</button>
          <button onClick={()=>open({type:"category", initial:c})} style={tagBtn}>Edit</button>
        </div>
      </div>; })}
    <button onClick={()=>open({type:"category", defaultBucket:"save"})} style={{ ...tagBtn, marginTop:10 }}>+ Add savings goal</button>
    <div style={{ fontSize:12, color:T.muted, textAlign:"center", marginTop:10 }}>Savings rate: <b style={{ color:T.save }}>{pct(d.savActual,d.income).toFixed(1)}%</b> of income</div>
  </div>;
}

function Summary({ m }) {
  const d = calc(m); const exp=d.cats.filter(c=>c.bucket!=="save");
  const top=exp.map(c=>({name:c.name,v:d.spentBy[c.id]||0})).filter(x=>x.v>0).sort((a,b)=>b.v-a.v).slice(0,4);
  const over=exp.filter(c=>(d.spentBy[c.id]||0)>(+c.budget||0));
  const under=exp.filter(c=>{ const b=+c.budget||0; return b>0 && pct(d.spentBy[c.id]||0,b)<50; });
  const row=(l,v,col)=><div style={{ display:"flex", justifyContent:"space-between", padding:"9px 0", borderBottom:`1px solid ${T.border}`, fontSize:14 }}>
    <span>{l}</span><span style={{ fontWeight:700, fontVariantNumeric:"tabular-nums", color:col||T.text }}>{v}</span></div>;
  return [
    <div key="s1" style={card()}>{row("Income", INR(d.income))}{row("Budgeted (allocated)", INR(d.allocated))}
      {row("Spent (expenses)", INR(d.expSpent))}{row("Saved", INR(d.savActual), T.save)}
      <div style={{ display:"flex", justifyContent:"space-between", paddingTop:11, marginTop:2, borderTop:`2px solid ${T.border}`, fontSize:14 }}>
        <span>Remaining in pocket</span><span style={{ fontWeight:800, fontVariantNumeric:"tabular-nums", color:d.remaining<0?T.bad:T.good }}>{INR(d.remaining)}</span></div>
      <div style={{ fontSize:11.5, color:T.muted, marginTop:6 }}>Savings rate <b>{pct(d.savActual,d.income).toFixed(1)}%</b> · Expense rate <b>{pct(d.expSpent,d.income).toFixed(1)}%</b></div></div>,
    <div key="s2" style={card()}><div style={{ fontWeight:600, fontSize:14, marginBottom:8, color:T.text }}>Top spending</div>
      {top.length?top.map((x,i)=><div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:i<top.length-1?`1px solid ${T.border}`:"none", fontSize:14 }}>
        <span>{i+1}. {x.name}</span><span style={{ fontWeight:700, fontVariantNumeric:"tabular-nums" }}>{INR(x.v)}</span></div>):<div style={{ color:T.muted, fontSize:13, textAlign:"center", padding:"16px 0" }}>No spending yet.</div>}</div>,
    <div key="s3" style={card()}><div style={{ fontWeight:600, fontSize:14, marginBottom:8, color:T.bad }}>Overspent envelopes</div>
      {over.length?over.map(c=><div key={c.id} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", fontSize:14 }}>
        <span>{c.name}</span><span style={{ fontWeight:700, color:T.bad, fontVariantNumeric:"tabular-nums" }}>{INR((d.spentBy[c.id]||0)-c.budget)} over</span></div>):<div style={{ color:T.muted, fontSize:13, textAlign:"center", padding:"16px 0" }}>None — nothing broke its envelope. 🎉</div>}</div>,
    <div key="s4" style={card()}><div style={{ fontWeight:600, fontSize:14, marginBottom:8, color:T.good }}>Under-utilised (&lt;50%)</div>
      {under.length?under.map(c=><div key={c.id} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", fontSize:14 }}>
        <span>{c.name}</span><span style={{ fontWeight:700, fontVariantNumeric:"tabular-nums" }}>{pct(d.spentBy[c.id]||0,c.budget).toFixed(0)}% used</span></div>):<div style={{ color:T.muted, fontSize:13, textAlign:"center", padding:"16px 0" }}>None.</div>}</div>,
  ];
}

// ═══ MAIN ════════════════════════════════════════════════════════════════════
export default function BudgetView({ budget, setBudget }) {
  const [sub, setSub] = useState("overview");
  const [modal, setModal] = useState(null);
  const active = budget?.active; const m = budget?.months?.[active];
  const ids = Object.keys(budget?.months||{}).sort();

  // mutation API
  const updateMonth = fn => setBudget(b => ({ ...b, months:{ ...b.months, [b.active]:fn(b.months[b.active]) } }));
  const api = {
    setActive:id=>setBudget(b=>({ ...b, active:id })),
    goto:delta=>setBudget(b=>{ const id=monthShift(b.active,delta); if(!b.months[id]) return b; return { ...b, active:id }; }),
    createMonth:delta=>setBudget(b=>{ const id=monthShift(b.active,delta); if(b.months[id]) return { ...b, active:id };
      const src=b.months[b.active];
      const nm={ id, label:monthLabel(id), status:"draft", salaryIncome:src.salaryIncome, otherIncome:src.otherIncome,
        categories:src.categories.map(c=>({ ...c })), savingsActual:{}, txns:[] };
      return { ...b, months:{ ...b.months, [id]:nm }, active:id }; }),
    commit:()=>updateMonth(mm=>({ ...mm, status:"committed" })),
    setIncome:(s,o)=>updateMonth(mm=>({ ...mm, salaryIncome:s, otherIncome:o })),
    addCategory:c=>updateMonth(mm=>({ ...mm, categories:[...mm.categories, { id:"c"+Date.now(), ...c }] })),
    editCategory:(id,patch)=>updateMonth(mm=>({ ...mm, categories:mm.categories.map(c=>c.id===id?{ ...c, ...patch }:c) })),
    deleteCategory:id=>updateMonth(mm=>{ const { [id]:_, ...sa }=mm.savingsActual||{};
      return { ...mm, categories:mm.categories.filter(c=>c.id!==id), txns:mm.txns.filter(t=>t.categoryId!==id), savingsActual:sa }; }),
    moveCategory:(id,dir)=>updateMonth(mm=>{ const arr=[...mm.categories]; const i=arr.findIndex(c=>c.id===id); if(i<0) return mm;
      const bk=arr[i].bucket; let j=i+dir; while(j>=0&&j<arr.length&&arr[j].bucket!==bk) j+=dir;
      if(j<0||j>=arr.length) return mm; [arr[i],arr[j]]=[arr[j],arr[i]]; return { ...mm, categories:arr }; }),
    setSavingsActual:(id,val)=>updateMonth(mm=>({ ...mm, savingsActual:{ ...mm.savingsActual, [id]:val } })),
    addTxn:t=>updateMonth(mm=>({ ...mm, txns:[...mm.txns, t] })),
    editTxn:(id,patch)=>updateMonth(mm=>({ ...mm, txns:mm.txns.map(t=>t.id===id?{ ...t, ...patch }:t) })),
    deleteTxn:id=>updateMonth(mm=>({ ...mm, txns:mm.txns.filter(t=>t.id!==id) })),
  };

  const open = req => { if(req.type==="__move"){ api.moveCategory(req.id, req.dir); return; } setModal(req); };
  const closeModal = go => { setModal(null); if(go) setSub("envelopes"); };

  if (!m) return <div style={{ color:T.muted, textAlign:"center", padding:"40px 0" }}>No budget yet.</div>;

  const TABS=[["overview","Overview"],["envelopes","Envelopes"],["savings","Savings"],["summary","Summary"]];
  const body = sub==="overview" ? <Overview m={m} open={open}/>
    : sub==="envelopes" ? <Envelopes m={m} open={open}/>
    : sub==="savings" ? <Savings m={m} api={api} open={open}/>
    : <Summary m={m}/>;
  const prevId=monthShift(active,-1), nextId=monthShift(active,1);
  const hasPrev=!!budget.months[prevId], hasNext=!!budget.months[nextId];
  const navBtn=(on,label,click)=><button onClick={click} aria-label={label}
    style={{ background:T.surf2, border:`1px solid ${T.border}`, color:on?T.text:T.muted, width:30, height:30, borderRadius:9, fontSize:16, cursor:"pointer", fontFamily:"inherit", opacity:on?1:.5 }}>{label==="prev"?"‹":"›"}</button>;

  return <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:8 }}>
      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
        {navBtn(hasPrev,"prev",()=>hasPrev?api.goto(-1):api.createMonth(-1))}
        <div style={{ fontWeight:800, fontSize:17, color:T.text }}>{m.label}</div>
        {navBtn(hasNext,"next",()=>hasNext?api.goto(1):api.createMonth(1))}
      </div>
      <span style={{ fontSize:11, fontWeight:700, padding:"3px 9px", borderRadius:20, background:m.status==="committed"?T.goodSoft:T.warnSoft, color:m.status==="committed"?T.good:T.warn }}>
        {m.status==="committed"?"Committed":"Draft"}</span>
    </div>

    {m.status!=="committed" && (()=>{ const d=calc(m); const bal=d.income-d.allocated;
      return <div style={{ ...card(), borderColor:T.warn+"55", background:T.warnSoft }}>
        <div style={{ fontWeight:700, fontSize:14, color:T.warn, marginBottom:4 }}>This month is a draft</div>
        <div style={{ fontSize:12.5, color:T.text2, marginBottom:10, lineHeight:1.5 }}>
          Income {INR(d.income)} · allocated {INR(d.allocated)} · {bal===0?"perfectly balanced.":bal>0?`${INR(bal)} still to allocate.`:`over-allocated by ${INR(-bal)}.`} Adjust income & categories, then commit to start recording transactions.</div>
        <button onClick={api.commit} style={{ background:T.primary, color:"#fff", border:"none", borderRadius:11, padding:"11px 16px", fontFamily:"inherit", fontWeight:700, fontSize:14, cursor:"pointer" }}>Commit {m.label}</button>
      </div>; })()}

    <div style={{ display:"flex", gap:6, background:T.surf2, padding:4, borderRadius:12 }}>
      {TABS.map(([id,l])=><button key={id} onClick={()=>setSub(id)}
        style={{ flex:1, padding:"7px 0", borderRadius:9, border:"none", cursor:"pointer", fontFamily:"inherit", fontSize:12.5, fontWeight:700,
          background:sub===id?T.surface:"transparent", color:sub===id?T.primary:T.text2, boxShadow:sub===id?T.shadow:"none" }}>{l}</button>)}
    </div>
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>{body}</div>

    {m.status==="committed" && <button onClick={()=>setModal({type:"txn"})} aria-label="Add transaction"
      style={{ position:"fixed", right:16, bottom:"calc(env(safe-area-inset-bottom,8px) + 76px)", zIndex:56,
        width:54, height:54, borderRadius:"50%", border:"none", cursor:"pointer", background:T.primary, color:"#fff",
        fontSize:30, lineHeight:1, display:"flex", alignItems:"center", justifyContent:"center",
        boxShadow:`0 6px 18px ${T.primary}66, 0 2px 6px rgba(9,45,75,0.2)` }}>
      <span aria-hidden="true" style={{ marginTop:-2 }}>+</span></button>}

    {modal?.type==="txn"      && <TxnForm m={m} api={api} initial={modal.initial} onClose={closeModal} />}
    {modal?.type==="category" && <CategoryForm initial={modal.initial} defaultBucket={modal.defaultBucket} api={api} committed={m.status==="committed"} onClose={()=>setModal(null)} />}
    {modal?.type==="income"   && <IncomeForm m={m} api={api} onClose={()=>setModal(null)} />}
  </div>;
}
