import { useState } from "react";

// ─── BUDGET PLANNER ──────────────────────────────────────────────────────────
// Single-screen envelope budgeting in ₹, its own tab (no habit chrome, no
// sub-tabs). Each envelope has an icon; tapping it logs a spend. A transaction
// is classified only by its envelope's bucket — Need / Want / Save / Income.
// When a spend exceeds an envelope, prompt to transfer from another envelope.

const T = {
  bg:"#F0F9FF", surface:"#FFFFFF", surf2:"#E0F2FE", border:"#D6E9F2",
  text:"#26333B", text2:"#4A6572", muted:"#5F6E7A",
  primary:"#0284C7", need:"#0284C7", want:"#B45309", save:"#7C3AED", income:"#15803D",
  needS:"#0284C714", wantS:"#B4530914", saveS:"#7C3AED14", incomeS:"#15803D14",
  good:"#15803D", goodS:"#15803D14", warn:"#B45309", warnS:"#B4530914", bad:"#DC2626", badS:"#DC262614",
  shadow:"0 1px 2px rgba(16,40,60,.05), 0 6px 18px rgba(16,40,60,.06)",
};
const BK = {
  need:  { l:"Need",   c:T.need,   s:T.needS,   i:"🧾" },
  want:  { l:"Want",   c:T.want,   s:T.wantS,   i:"🛍️" },
  save:  { l:"Save",   c:T.save,   s:T.saveS,   i:"🐷" },
  income:{ l:"Income", c:T.income, s:T.incomeS, i:"💵" },
};
const INR = n => (n<0?"-":"")+"₹"+Math.abs(Math.round(n)).toLocaleString("en-IN");
const pct = (a,b) => b>0 ? a/b*100 : 0;
const MON  = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONF = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const today = () => { const d=new Date(); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); };
const fmtD = iso => { const [y,m,d]=(iso||"").split("-"); return d?`${+d} ${MON[+m-1]}`:iso; };
const mShift = (id,delta) => { const [y,m]=id.split("-").map(Number); const d=new Date(y,m-1+delta,1); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0"); };
const mLabel = id => { const [y,m]=id.split("-").map(Number); return MONF[m-1]+" "+y; };
const EMO = ["🧾","🏦","🥛","💡","🚰","🔥","🧹","🛒","🥬","📶","⛽","🛡️","💊","🍽️","🛍️","🔧","💇","🎬","🎓","📈","🏘️","💰","☕","🎁","✈️","📚","🏥","👕","🐾","🏠","🚗","📱"];
// icon fallback for envelopes saved before icons existed (same seed ids)
const DEF_ICON = { ssy:"🎓",sip:"📈",re:"🏘️",emi:"🏦",milk:"🥛",elec:"💡",water:"🚰",gas:"🔥",help:"🧹",dmart:"🛒",veg:"🥬",sub:"📶",petrol:"⛽",ins:"🛡️",med:"💊",eat:"🍽️",shop:"🛍️",maint:"🔧",groom:"💇",ent:"🎬" };
const iconOf = c => c.icon || DEF_ICON[c.id] || "₹";

let _tid = 1;
const tx = (date,desc,amount,cat,bucket) => ({ id:"t"+(_tid++), date, desc, amount, categoryId:cat, bucket });

export function seedBudget() {
  const mid = today().slice(0,7);
  return { active:mid, months:{ [mid]:{
    id:mid, label:mLabel(mid), status:"committed", salaryIncome:215000, otherIncome:2000,
    categories:[
      { id:"ssy",name:"SSY",bucket:"save",budget:22000,icon:"🎓" },{ id:"sip",name:"SIP",bucket:"save",budget:20000,icon:"📈" },{ id:"re",name:"Real Estate",bucket:"save",budget:20000,icon:"🏘️" },
      { id:"emi",name:"EMI",bucket:"need",budget:91393,icon:"🏦" },{ id:"milk",name:"Milk",bucket:"need",budget:2700,icon:"🥛" },{ id:"elec",name:"Electricity",bucket:"need",budget:2500,icon:"💡" },
      { id:"water",name:"Water",bucket:"need",budget:800,icon:"🚰" },{ id:"gas",name:"Gas",bucket:"need",budget:4000,icon:"🔥" },{ id:"help",name:"Helper",bucket:"need",budget:1000,icon:"🧹" },
      { id:"dmart",name:"DMart",bucket:"need",budget:8500,icon:"🛒" },{ id:"veg",name:"Vegetables",bucket:"need",budget:3000,icon:"🥬" },{ id:"sub",name:"Subscription",bucket:"need",budget:1000,icon:"📶" },
      { id:"petrol",name:"Petrol",bucket:"need",budget:6000,icon:"⛽" },{ id:"ins",name:"Insurance & School",bucket:"need",budget:20000,icon:"🛡️" },{ id:"med",name:"Medical",bucket:"need",budget:4000,icon:"💊" },
      { id:"eat",name:"Eatout",bucket:"want",budget:5000,icon:"🍽️" },{ id:"shop",name:"Shopping",bucket:"want",budget:8000,icon:"🛍️" },{ id:"maint",name:"Maintenance",bucket:"want",budget:1500,icon:"🔧" },
      { id:"groom",name:"Grooming",bucket:"want",budget:1500,icon:"💇" },{ id:"ent",name:"Entertainment",bucket:"want",budget:1500,icon:"🎬" },
    ],
    savingsActual:{ sip:20000, ssy:22000, re:10000 },
    txns:[ tx(mid+"-01","EMI auto-debit",91393,"emi","need"),tx(mid+"-05","Insurance & school",20000,"ins","need"),tx(mid+"-01","Milk",2700,"milk","need"),
      tx(mid+"-08","Electricity",2500,"elec","need"),tx(mid+"-03","Gas",4000,"gas","need"),tx(mid+"-12","DMart",3200,"dmart","need"),tx(mid+"-20","DMart",3000,"dmart","need"),
      tx(mid+"-10","Petrol",2500,"petrol","need"),tx(mid+"-09","Dinner out",1700,"eat","want"),tx(mid+"-15","Lunch",1300,"eat","want"),tx(mid+"-19","Snacks",1000,"eat","want"),
      tx(mid+"-11","Clothes",6000,"shop","want"),tx(mid+"-16","Salon",1400,"groom","want") ],
  } } };
}

function calc(m) {
  const sp={}, bk={need:0,want:0,save:0}; let inx=0;
  (m.txns||[]).forEach(t=>{ if(t.bucket==="income"){ inx+=(+t.amount||0); return; } if(t.categoryId) sp[t.categoryId]=(sp[t.categoryId]||0)+(+t.amount||0); bk[t.bucket]=(bk[t.bucket]||0)+(+t.amount||0); });
  const income=(+m.salaryIncome||0)+(+m.otherIncome||0)+inx;
  const cats=m.categories||[]; let sb=0,eb=0;
  const bbud={need:0,want:0,save:0};
  cats.forEach(c=>{ if(c.bucket==="save"){ sb+=(+c.budget||0); bbud.save+=(+c.budget||0); } else { eb+=(+c.budget||0); bbud[c.bucket]+=(+c.budget||0); } });
  const sa=cats.filter(c=>c.bucket==="save").reduce((a,c)=>a+(+(m.savingsActual?.[c.id]||0)),0);
  const es=bk.need+bk.want, allocated=sb+eb;
  return { m, sp, bk, bbud, income, sb, sa, es, allocated, balance:income-es-sa, unalloc:income-allocated };
}
const stOf = (s,b) => { const u=pct(s,b); return u>100?"bad":u>=80?"warn":"good"; };

// ── shared bits ──
const card = extra => ({ background:T.surface, border:`1px solid ${T.border}`, borderRadius:14, padding:14, boxShadow:T.shadow, ...(extra||{}) });
const fld = { width:"100%", background:T.surf2, border:`1px solid ${T.border}`, borderRadius:11, padding:12, color:T.text, fontFamily:"inherit", fontSize:15, outline:"none", boxSizing:"border-box" };
const lab = { display:"block", fontSize:11.5, fontWeight:600, color:T.text2, marginBottom:5 };
const chip = k => { const c=k==="bad"?T.bad:k==="warn"?T.warn:k==="done"?T.save:T.good, s=k==="bad"?T.badS:k==="warn"?T.warnS:k==="done"?T.saveS:T.goodS;
  return { fontSize:10, fontWeight:800, padding:"2px 8px", borderRadius:20, background:s, color:c, whiteSpace:"nowrap" }; };
const primaryBtn = { width:"100%", background:T.primary, color:"#fff", border:"none", borderRadius:13, padding:15, fontFamily:"inherit", fontWeight:800, fontSize:15, cursor:"pointer" };
const ghostBtn = { background:T.surface, color:T.text2, border:`1px solid ${T.border}`, borderRadius:13, padding:15, fontFamily:"inherit", fontWeight:800, fontSize:15, cursor:"pointer" };
function Bar({ v, color }) { return <div style={{ height:7, borderRadius:5, background:T.surf2, overflow:"hidden", marginTop:8 }}><div style={{ height:"100%", width:Math.min(100,v)+"%", background:color, borderRadius:5 }} /></div>; }
function Sheet({ title, onClose, children }) {
  return <div onClick={e=>{ if(e.target===e.currentTarget) onClose(); }} style={{ position:"fixed", inset:0, background:"rgba(10,20,28,.5)", zIndex:120, display:"flex", alignItems:"flex-end", justifyContent:"center" }}>
    <div style={{ background:T.surface, width:"100%", maxWidth:480, borderRadius:"20px 20px 0 0", padding:"18px 16px calc(22px + env(safe-area-inset-bottom,0px))", maxHeight:"92vh", overflow:"auto" }}>
      <div style={{ fontWeight:800, fontSize:17, marginBottom:14, color:T.text }}>{title}</div>{children}</div></div>;
}

// ── spend sheet (envelope already chosen; transfer step inside) ──
function SpendSheet({ m, api, env, initial, curMonth, onClose, onChange }) {
  const isInc = env.bucket==="income";
  const [amt,setAmt]=useState(initial?String(initial.amount):"");
  const [desc,setDesc]=useState(initial?.desc||"");
  const [date,setDate]=useState(initial?.date || (m.id===curMonth ? today() : m.id+"-15"));
  const [err,setErr]=useState(""); const [xfer,setXfer]=useState(null); const [src,setSrc]=useState("");
  const spentOf = id => (m.txns||[]).filter(t=>t.categoryId===id && (!initial||t.id!==initial.id)).reduce((a,t)=>a+(+t.amount||0),0);
  const record = () => {
    const v={ date, desc:desc.trim(), amount:+amt, bucket:env.bucket, categoryId:isInc?"":env.id };
    if(initial) api.editTxn(initial.id,v); else api.addTxn({ id:"t"+Date.now(), ...v });
    onClose(true);
  };
  const submit = () => {
    const a=+amt;
    if(!(a>0)) return setErr("Enter an amount.");
    if(!date || date.slice(0,7)!==m.id) return setErr("Date must be within "+m.label+".");
    if(!isInc){ const rem=(+env.budget||0)-spentOf(env.id); if(a>rem){ setXfer({ shortfall:Math.round(a-rem), rem }); setSrc(""); return; } }
    record();
  };
  if (xfer) {
    const donors=(m.categories||[]).filter(c=>c.id!==env.id && c.bucket!=="save").map(c=>({ ...c, avail:(+c.budget||0)-spentOf(c.id) })).filter(c=>c.avail>0).sort((a,b)=>b.avail-a.avail);
    const chosen=donors.find(c=>c.id===src), can=chosen&&chosen.avail>=xfer.shortfall;
    return <Sheet title={"Not enough in "+env.name} onClose={()=>setXfer(null)}>
      <div style={{ background:T.warnS, color:T.warn, borderRadius:11, padding:12, fontSize:13, fontWeight:600, lineHeight:1.5, marginBottom:14 }}>
        <b>{iconOf(env)} {env.name}</b> has only {INR(xfer.rem)} left, but this spend is {INR(+amt)}.<br/>Move {INR(xfer.shortfall)} from another envelope?</div>
      <div style={{ marginBottom:12 }}><label style={lab}>Transfer from</label>
        {donors.length ? <select style={fld} value={src} onChange={e=>setSrc(e.target.value)}><option value="">Choose an envelope…</option>
          {donors.map(c=><option key={c.id} value={c.id}>{iconOf(c)} {c.name} — {INR(c.avail)} available</option>)}</select>
          : <div style={{ fontSize:12.5, color:T.muted }}>No other envelope has spare money.</div>}
        {chosen && !can && <div style={{ fontSize:12, color:T.bad, marginTop:6 }}>{chosen.name} only has {INR(chosen.avail)}.</div>}</div>
      <button disabled={!can} onClick={()=>{ api.transfer(src, env.id, xfer.shortfall); record(); }} style={{ ...primaryBtn, background:can?T.primary:T.surf2, color:can?"#fff":T.muted, marginBottom:8 }}>Transfer {INR(xfer.shortfall)} & spend</button>
      <button onClick={record} style={{ ...ghostBtn, width:"100%", color:T.bad, borderColor:T.bad+"55", marginBottom:8 }}>Overspend anyway</button>
      <button onClick={()=>setXfer(null)} style={{ ...ghostBtn, width:"100%" }}>Back</button>
    </Sheet>;
  }
  return <Sheet title={(initial?"Edit ":"Add ")+(isInc?"income":"spend")} onClose={()=>onClose()}>
    <div style={{ display:"flex", alignItems:"center", gap:11, background:T.surf2, borderRadius:13, padding:"11px 12px", marginBottom:14 }}>
      <div style={{ width:40, height:40, borderRadius:11, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, background:BK[env.bucket].s }}>{iconOf(env)}</div>
      <div><div style={{ fontWeight:700, fontSize:15, color:T.text }}>{env.name}</div><div style={{ fontSize:11.5, color:T.muted }}>{isInc?"Income":BK[env.bucket].l+" · envelope"}</div></div></div>
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:4, margin:"4px 0 16px" }}>
      <span style={{ fontSize:34, fontWeight:800, color:T.muted }}>₹</span>
      <input autoFocus type="number" inputMode="numeric" value={amt} onChange={e=>setAmt(e.target.value)} placeholder="0"
        style={{ fontSize:40, fontWeight:800, border:"none", background:"none", outline:"none", color:T.text, width:"100%", maxWidth:220, textAlign:"center", fontFamily:"inherit" }} /></div>
    <div style={{ marginBottom:12 }}><label style={lab}>Description</label><input style={fld} value={desc} onChange={e=>setDesc(e.target.value)} placeholder={isInc?"e.g. Freelance payment":"e.g. Weekend dinner"} /></div>
    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14, fontSize:13, color:T.text2 }}><span>Date</span>
      <input type="date" value={date} min={m.id+"-01"} max={m.id+"-31"} onChange={e=>setDate(e.target.value)} style={{ background:T.surf2, border:`1px solid ${T.border}`, borderRadius:9, padding:"7px 9px", color:T.text, fontFamily:"inherit", fontSize:13 }} /></div>
    {err && <div style={{ fontSize:12, color:T.bad, marginBottom:8 }}>{err}</div>}
    <div style={{ display:"flex", gap:10 }}>
      {initial ? <button onClick={()=>{ api.deleteTxn(initial.id); onClose(true); }} style={{ ...ghostBtn, color:T.bad, borderColor:T.bad+"55", flex:"0 0 auto" }}>Delete</button>
        : <button onClick={onChange} style={{ ...ghostBtn, flex:"0 0 auto" }}>Change</button>}
      <button onClick={submit} style={{ ...primaryBtn }}>{initial?"Save":"Add"}</button></div>
  </Sheet>;
}

function PickerSheet({ m, onPick, onClose }) {
  const grp = b => (m.categories||[]).filter(c=>c.bucket===b);
  const tile = c => <button key={c.id} onClick={()=>onPick(c)} style={pkBtn}><span style={{ fontSize:22 }}>{iconOf(c)}</span><span style={pkName}>{c.name}</span></button>;
  const sec = (l,color,items,extra) => items.length||extra ? <div key={l}><div style={{ fontSize:11, fontWeight:800, color, textTransform:"uppercase", letterSpacing:".04em", margin:"14px 2px 8px" }}>{l}</div>
    <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:11 }}>{items.map(tile)}{extra}</div></div> : null;
  return <Sheet title="Spend from…" onClose={onClose}>
    {sec("🧾 Needs", T.need, grp("need"))}
    {sec("🛍️ Wants", T.want, grp("want"))}
    {sec("🐷 Savings", T.save, grp("save"))}
    {sec("💵 Income", T.good, [], <button onClick={()=>onPick({ id:"", name:"Income", bucket:"income" })} style={pkBtn}><span style={{ fontSize:22 }}>💵</span><span style={pkName}>Add income</span></button>)}
  </Sheet>;
}
const pkBtn = { background:T.surf2, border:`1px solid ${T.border}`, borderRadius:14, padding:"12px 4px", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:5, fontFamily:"inherit" };
const pkName = { fontSize:10.5, fontWeight:600, color:T.text2, textAlign:"center", lineHeight:1.2 };

function IncomeSheet({ m, api, onClose }) {
  const [s,setS]=useState(String(m.salaryIncome||"")); const [o,setO]=useState(String(m.otherIncome||""));
  return <Sheet title="Monthly income" onClose={onClose}>
    <div style={{ marginBottom:12 }}><label style={lab}>Salary (₹)</label><input autoFocus style={fld} type="number" value={s} onChange={e=>setS(e.target.value)} /></div>
    <div style={{ marginBottom:14 }}><label style={lab}>Other income (₹)</label><input style={fld} type="number" value={o} onChange={e=>setO(e.target.value)} /></div>
    <div style={{ display:"flex", gap:10 }}><button onClick={onClose} style={{ ...ghostBtn, flex:"0 0 38%" }}>Cancel</button>
      <button onClick={()=>{ api.setIncome(Math.max(0,+s||0), Math.max(0,+o||0)); onClose(); }} style={primaryBtn}>Save</button></div>
  </Sheet>;
}

function CatSheet({ api, initial, onClose }) {
  const isNew=!initial;
  const [name,setName]=useState(initial?.name||""); const [bucket,setBucket]=useState(initial?.bucket||"need");
  const [budget,setBudget]=useState(initial?String(initial.budget):""); const [icon,setIcon]=useState(initial?iconOf(initial):"🧾");
  const [err,setErr]=useState("");
  const save=()=>{ const nm=name.trim(); if(!nm) return setErr("Give it a name."); const b=Math.max(0,+budget||0);
    if(isNew) api.addCategory({ name:nm, bucket, budget:b, icon }); else api.editCategory(initial.id,{ name:nm, bucket, budget:b, icon }); onClose(); };
  const opt = (k,active,onClick,label,ic) => <button key={k} onClick={onClick} style={{ ...pkBtn, padding:"10px 4px", borderColor:active?BK[bucket].c:T.border, background:active?BK[bucket].s:T.surf2 }}>
    <span style={{ fontSize:20 }}>{ic}</span>{label&&<span style={pkName}>{label}</span>}</button>;
  return <Sheet title={isNew?"New envelope":"Edit envelope"} onClose={onClose}>
    <div style={{ marginBottom:12 }}><label style={lab}>Category · Need / Want / Save</label>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>{["need","want","save"].map(k=>opt(k, bucket===k, ()=>setBucket(k), BK[k].l, BK[k].i))}</div></div>
    <div style={{ marginBottom:12 }}><label style={lab}>Name</label><input autoFocus style={fld} value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Groceries" /></div>
    <div style={{ marginBottom:12 }}><label style={lab}>Monthly budget (₹)</label><input style={fld} type="number" value={budget} onChange={e=>setBudget(e.target.value)} placeholder="0" /></div>
    <div style={{ marginBottom:12 }}><label style={lab}>Icon</label>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(8,1fr)", gap:6 }}>{EMO.map(e=><button key={e} onClick={()=>setIcon(e)} style={{ ...pkBtn, padding:"8px 0", borderColor:icon===e?BK[bucket].c:T.border, background:icon===e?BK[bucket].s:T.surf2 }}><span style={{ fontSize:20 }}>{e}</span></button>)}</div></div>
    {err && <div style={{ fontSize:12, color:T.bad, marginBottom:8 }}>{err}</div>}
    <div style={{ display:"flex", gap:10 }}>
      {!isNew && <button onClick={()=>{ api.deleteCategory(initial.id); onClose(); }} style={{ ...ghostBtn, color:T.bad, borderColor:T.bad+"55", flex:"0 0 auto" }}>Delete</button>}
      <button onClick={onClose} style={{ ...ghostBtn, flex:"0 0 auto" }}>Cancel</button><button onClick={save} style={primaryBtn}>Save</button></div>
  </Sheet>;
}

function ReportSheet({ m, onClose }) {
  const d=calc(m); const exp=(m.categories||[]).filter(c=>c.bucket!=="save");
  const rows=[...exp].sort((a,b)=>(d.sp[b.id]||0)-(d.sp[a.id]||0));
  const th={ textAlign:"right", padding:"7px 4px", fontSize:10.5, textTransform:"uppercase", color:T.muted, borderBottom:`1px solid ${T.border}` };
  const td={ textAlign:"right", padding:"7px 4px", fontSize:12.5, borderBottom:`1px solid ${T.border}`, fontVariantNumeric:"tabular-nums" };
  return <Sheet title={mLabel(m.id)+" report"} onClose={onClose}>
    <table style={{ width:"100%", borderCollapse:"collapse" }}><tbody>
      <tr><th style={{ ...th, textAlign:"left" }}>Envelope</th><th style={th}>Spent</th><th style={th}>Balance</th><th style={th}>% inc</th></tr>
      {rows.map(c=>{ const v=d.sp[c.id]||0, bal=(+c.budget||0)-v; return <tr key={c.id}>
        <td style={{ ...td, textAlign:"left" }}>{iconOf(c)} {c.name}</td><td style={{ ...td, fontWeight:600 }}>{INR(v)}</td>
        <td style={{ ...td, color:bal<0?T.bad:T.text2 }}>{INR(bal)}</td><td style={{ ...td, color:T.muted }}>{pct(v,d.income).toFixed(1)}</td></tr>; })}
      <tr style={{ fontWeight:800 }}><td style={{ ...td, textAlign:"left", borderBottom:"none" }}>Total spent</td><td style={{ ...td, borderBottom:"none" }}>{INR(d.es)}</td><td style={{ ...td, borderBottom:"none" }}></td><td style={{ ...td, borderBottom:"none", color:T.muted }}>{pct(d.es,d.income).toFixed(1)}</td></tr>
    </tbody></table>
    <div style={{ background:d.balance>=0?T.goodS:T.badS, color:d.balance>=0?T.good:T.bad, borderRadius:11, padding:12, fontWeight:800, textAlign:"center", fontSize:14, marginTop:12 }}>
      {d.balance>=0 ? `🎉 You saved ${INR(d.balance)} this month` : `Overspent by ${INR(-d.balance)} this month`}</div>
    <div style={{ fontSize:12, color:T.muted, textAlign:"center", marginTop:6 }}>Balance = income {INR(d.income)} − spent {INR(d.es)}. Nothing carries to next month.</div>
    <button onClick={onClose} style={{ ...primaryBtn, marginTop:14 }}>Close</button>
  </Sheet>;
}

// ═══ MAIN ════════════════════════════════════════════════════════════════════
export default function BudgetView({ budget, setBudget }) {
  const [modal, setModal] = useState(null);   // {type, ...}
  const [editMode, setEditMode] = useState(false);
  const active = budget?.active; const m = budget?.months?.[active];
  const curMonth = today().slice(0,7);
  const updateMonth = fn => setBudget(b => ({ ...b, months:{ ...b.months, [b.active]:fn(b.months[b.active]) } }));
  const api = {
    goto:d=>setBudget(b=>{ const id=mShift(b.active,d); return b.months[id]?{ ...b, active:id }:b; }),
    createMonth:d=>setBudget(b=>{ const id=mShift(b.active,d); if(b.months[id]) return { ...b, active:id };
      const src=b.months[b.active]; return { ...b, months:{ ...b.months, [id]:{ id, label:mLabel(id), status:"draft", salaryIncome:src.salaryIncome, otherIncome:src.otherIncome, categories:src.categories.map(c=>({ ...c })), savingsActual:{}, txns:[] } }, active:id }; }),
    commit:()=>updateMonth(mm=>({ ...mm, status:"committed" })),
    setIncome:(s,o)=>updateMonth(mm=>({ ...mm, salaryIncome:s, otherIncome:o })),
    addCategory:c=>updateMonth(mm=>({ ...mm, categories:[...mm.categories, { id:"c"+Date.now(), ...c }] })),
    editCategory:(id,p)=>updateMonth(mm=>({ ...mm, categories:mm.categories.map(c=>c.id===id?{ ...c, ...p }:c) })),
    deleteCategory:id=>updateMonth(mm=>{ const { [id]:_, ...sa }=mm.savingsActual||{}; return { ...mm, categories:mm.categories.filter(c=>c.id!==id), txns:mm.txns.filter(t=>t.categoryId!==id), savingsActual:sa }; }),
    setSavingsActual:(id,v)=>updateMonth(mm=>({ ...mm, savingsActual:{ ...mm.savingsActual, [id]:v } })),
    transfer:(from,to,a)=>updateMonth(mm=>({ ...mm, categories:mm.categories.map(c=>c.id===from?{ ...c, budget:(+c.budget||0)-a }:c.id===to?{ ...c, budget:(+c.budget||0)+a }:c) })),
    addTxn:t=>updateMonth(mm=>({ ...mm, txns:[...mm.txns, t] })),
    editTxn:(id,p)=>updateMonth(mm=>({ ...mm, txns:mm.txns.map(t=>t.id===id?{ ...t, ...p }:t) })),
    deleteTxn:id=>updateMonth(mm=>({ ...mm, txns:mm.txns.filter(t=>t.id!==id) })),
  };
  if (!m) return <div style={{ color:T.muted, textAlign:"center", padding:"40px 0" }}>No budget yet.</div>;
  const d = calc(m); const committed = m.status==="committed";
  const prev=mShift(active,-1), next=mShift(active,1), hasPrev=!!budget.months[prev], hasNext=!!budget.months[next];
  const navBtn=(on,dir,dlt)=><button onClick={()=>on?api.goto(dlt):api.createMonth(dlt)} aria-label={dir}
    style={{ background:T.surf2, border:`1px solid ${T.border}`, color:on?T.text:T.muted, width:32, height:32, borderRadius:10, fontSize:17, cursor:"pointer", fontFamily:"inherit", opacity:on?1:.55 }}>{dir==="prev"?"‹":"›"}</button>;
  const savingsActual = id => +(m.savingsActual?.[id]||0);

  return <div style={{ display:"flex", flexDirection:"column" }}>
    {/* own header */}
    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", paddingBottom:6 }}>
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>{navBtn(hasPrev,"prev",-1)}<span style={{ fontWeight:800, fontSize:17, color:T.text }}>{m.label||mLabel(active)}</span>{navBtn(hasNext,"next",1)}</div>
      <span style={{ fontSize:11, fontWeight:700, padding:"3px 10px", borderRadius:20, background:committed?T.goodS:T.warnS, color:committed?T.good:T.warn }}>{committed?"Committed":"Draft"}</span>
    </div>
    <div style={{ background:`linear-gradient(135deg, ${T.primary}, #075E8C)`, color:"#fff", borderRadius:16, padding:16, boxShadow:T.shadow, position:"relative" }}>
      <button onClick={()=>setModal({type:"income"})} style={{ position:"absolute", top:14, right:14, background:"#ffffff2e", border:"none", color:"#fff", borderRadius:8, padding:"5px 11px", fontSize:11.5, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>Edit income</button>
      <div style={{ fontSize:11.5, fontWeight:600, textTransform:"uppercase", letterSpacing:".05em", opacity:.85 }}>Monthly budget</div>
      <div style={{ fontSize:30, fontWeight:800, letterSpacing:"-.02em", marginTop:2, fontVariantNumeric:"tabular-nums" }}>{INR(d.income)}</div>
      <div style={{ fontSize:12, opacity:.9, marginTop:2 }}>Salary {INR(m.salaryIncome)} · Other {INR(m.otherIncome)}</div>
    </div>
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:9, marginTop:12 }}>
      {["need","want","save"].map(k=><div key={k} style={card({ padding:"12px 11px" })}>
        <div style={{ fontSize:20 }}>{BK[k].i}</div><div style={{ fontSize:12, fontWeight:700, marginTop:5, color:BK[k].c }}>{BK[k].l}</div>
        <div style={{ fontSize:16, fontWeight:800, marginTop:1, fontVariantNumeric:"tabular-nums" }}>{INR(k==="save"?d.sa:d.bk[k])}</div>
        <div style={{ fontSize:11, color:T.muted, marginTop:1 }}>{pct(k==="save"?d.sa:d.bk[k],d.income).toFixed(0)}% · of {INR(d.bbud[k])}</div></div>)}
    </div>
    <div style={{ display:"flex", gap:9, marginTop:9 }}>
      <div style={{ ...card({ padding:"10px 12px" }), flex:1, display:"flex", alignItems:"center", gap:9 }}><span style={{ fontSize:17 }}>💸</span><div><div style={{ fontSize:11, color:T.muted, fontWeight:600 }}>Spent</div><div style={{ fontSize:15, fontWeight:800, fontVariantNumeric:"tabular-nums" }}>{INR(d.es)}</div></div></div>
      <div style={{ ...card({ padding:"10px 12px" }), flex:1, display:"flex", alignItems:"center", gap:9 }}><span style={{ fontSize:17 }}>🏦</span><div><div style={{ fontSize:11, color:T.muted, fontWeight:600 }}>Balance</div><div style={{ fontSize:15, fontWeight:800, fontVariantNumeric:"tabular-nums", color:d.balance<0?T.bad:T.good }}>{INR(d.balance)}</div></div></div>
    </div>
    {d.unalloc<0 && <div style={{ marginTop:12, background:T.warnS, border:`1px solid ${T.warn}55`, borderRadius:13, padding:"11px 13px", fontSize:12.5, fontWeight:600, color:T.warn }}>⚠ Over-allocated by {INR(-d.unalloc)} — you've allocated more than your income.</div>}

    {!committed && <div style={{ marginTop:12, background:T.warnS, border:`1px solid ${T.warn}55`, borderRadius:13, padding:13 }}>
      <div style={{ fontWeight:700, color:T.warn }}>This month is a draft</div>
      <div style={{ margin:"5px 0 10px", fontSize:12.5, color:T.text2, lineHeight:1.5 }}>Income {INR(d.income)} · allocated {INR(d.allocated)}. Nothing carries over from last month. Commit to start logging.</div>
      <button onClick={api.commit} style={{ background:T.primary, color:"#fff", border:"none", borderRadius:10, padding:"10px 15px", fontWeight:700, fontSize:13.5, cursor:"pointer", fontFamily:"inherit" }}>Commit {m.label||mLabel(active)}</button></div>}

    {/* envelopes */}
    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", margin:"20px 2px 8px" }}>
      <span style={{ fontSize:13, fontWeight:800 }}>📮 Envelopes</span>
      <div><button onClick={()=>setModal({type:"report"})} style={lnk}>Report</button> &nbsp; <button onClick={()=>setEditMode(v=>!v)} style={{ ...lnk, color:editMode?T.primary:T.primary }}>{editMode?"Done":"Edit"}</button></div>
    </div>
    {editMode && <div style={{ fontSize:12, color:T.muted, margin:"0 2px 8px" }}>Tap an envelope to edit its budget & icon, or add a new one below.</div>}
    {(m.categories||[]).map(c=>{ const s=c.bucket==="save"?savingsActual(c.id):(d.sp[c.id]||0); const bal=(+c.budget||0)-s, u=pct(s,c.budget);
      const st=c.bucket==="save"?(s>=c.budget&&c.budget>0?"done":u>=80?"good":"warn"):stOf(s,c.budget);
      const label=c.bucket==="save"?(s>=c.budget&&c.budget>0?"Funded":u>0?"Partial":"Empty"):(st==="bad"?"Overspent":st==="warn"?"Watch":"On track");
      const col=st==="bad"?T.bad:st==="warn"?T.warn:BK[c.bucket].c;
      return <div key={c.id} onClick={()=>editMode?setModal({type:"cat",initial:c}):setModal({type:"spend",env:c})}
        style={{ ...card({ padding:"11px 12px", marginBottom:9 }), display:"flex", gap:11, alignItems:"center", cursor:"pointer" }}>
        <div style={{ width:42, height:42, borderRadius:12, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, background:BK[c.bucket].s, flexShrink:0 }}>{iconOf(c)}</div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", gap:8 }}>
            <span style={{ fontWeight:600, fontSize:14, display:"flex", alignItems:"center", gap:6 }}><span style={{ width:7, height:7, borderRadius:"50%", background:BK[c.bucket].c }} />{c.name}</span>
            <span style={{ fontWeight:700, fontSize:13, fontVariantNumeric:"tabular-nums" }}>{INR(s)} <span style={{ color:T.muted, fontWeight:500 }}>/ {INR(c.budget)}</span></span></div>
          <Bar v={u} color={col} />
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:6 }}>
            <span style={{ fontSize:11.5, color:T.text2, fontVariantNumeric:"tabular-nums" }}>{bal<0?<span style={{ color:T.bad, fontWeight:700 }}>{INR(bal)} over</span>:INR(bal)+" left"} · {u.toFixed(0)}%</span>
            <span style={chip(st)}>{label}</span></div></div></div>; })}
    {editMode && <button onClick={()=>setModal({type:"cat"})} style={{ ...ghostBtn, width:"100%", marginTop:4 }}>＋ New envelope</button>}

    {/* recent spends */}
    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", margin:"20px 2px 8px" }}>
      <span style={{ fontSize:13, fontWeight:800 }}>🧾 Recent spends</span><span style={{ fontSize:12, color:T.muted }}>tap to edit</span></div>
    {[...(m.txns||[])].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,6).map(t=>{ const c=(m.categories||[]).find(x=>x.id===t.categoryId); const bk=BK[t.bucket]||BK.need;
      return <div key={t.id} onClick={()=>setModal({type:"spend", env:c||{id:"",name:"Income",bucket:t.bucket}, initial:t})}
        style={{ ...card({ padding:"10px 12px", marginBottom:8 }), display:"flex", alignItems:"center", gap:11, cursor:"pointer" }}>
        <div style={{ width:36, height:36, borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", fontSize:17, background:bk.s, color:bk.c, flexShrink:0 }}>{t.bucket==="income"?"💵":(c?iconOf(c):"₹")}</div>
        <div style={{ flex:1, minWidth:0 }}><div style={{ fontWeight:600, fontSize:13.5, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{t.desc||(c?c.name:"General")}</div>
          <div style={{ fontSize:11.5, color:T.muted }}>{fmtD(t.date)} · {t.bucket==="income"?"Income":(c?c.name:"General")} · {BK[t.bucket].l}</div></div>
        <div style={{ fontWeight:700, fontSize:14, fontVariantNumeric:"tabular-nums", color:t.bucket==="income"?T.good:T.text }}>{t.bucket==="income"?"+":""}{INR(t.amount)}</div></div>; })}

    {committed && <button onClick={()=>setModal({type:"picker"})} aria-label="Add spend"
      style={{ position:"fixed", left:"50%", transform:"translateX(-50%)", bottom:"calc(env(safe-area-inset-bottom,8px) + 74px)", zIndex:56, width:"calc(100% - 32px)", maxWidth:448,
        background:T.primary, color:"#fff", border:"none", borderRadius:15, padding:16, fontFamily:"inherit", fontSize:16, fontWeight:800, cursor:"pointer", boxShadow:"0 8px 22px rgba(2,132,199,.4)" }}>＋ Add spend</button>}

    {/* modals */}
    {modal?.type==="spend"  && <SpendSheet m={m} api={api} env={modal.env} initial={modal.initial} curMonth={curMonth} onClose={()=>setModal(null)} onChange={()=>setModal({type:"picker"})} />}
    {modal?.type==="picker" && <PickerSheet m={m} onPick={c=>setModal({type:"spend", env:c})} onClose={()=>setModal(null)} />}
    {modal?.type==="income" && <IncomeSheet m={m} api={api} onClose={()=>setModal(null)} />}
    {modal?.type==="cat"    && <CatSheet api={api} initial={modal.initial} onClose={()=>setModal(null)} />}
    {modal?.type==="report" && <ReportSheet m={m} onClose={()=>setModal(null)} />}
  </div>;
}
const lnk = { fontSize:12, fontWeight:700, color:T.primary, background:"none", border:"none", cursor:"pointer", fontFamily:"inherit" };
