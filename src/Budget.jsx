import { useState, useEffect } from "react";

// ─── BUDGET PLANNER ──────────────────────────────────────────────────────────
// Single-screen envelope budgeting in ₹, its own tab (no habit chrome, no
// sub-tabs). Each envelope has an icon; tapping it logs a spend. A transaction
// is classified only by its envelope's bucket — Need / Want / Save / Income.
// When a spend exceeds an envelope, prompt to transfer from another envelope.

const LIGHT = {
  bg:"#F0F9FF", surface:"#FFFFFF", surf2:"#E9F1F7", border:"#DCE6EC",
  text:"#26333B", text2:"#4A6572", muted:"#5F6E7A",
  primary:"#0284C7", need:"#0284C7", want:"#B45309", save:"#7C3AED", income:"#15803D",
  needS:"#0284C714", wantS:"#B4530914", saveS:"#7C3AED14", incomeS:"#15803D14",
  good:"#15803D", goodS:"#15803D14", warn:"#B45309", warnS:"#B4530914", bad:"#DC2626", badS:"#DC262614",
  gold:"#F59E0B", goldS:"#F59E0B1a",
  shadow:"0 1px 2px rgba(16,40,60,.05), 0 8px 22px rgba(16,40,60,.05)",
};
const DARK = {
  bg:"#0E1519", surface:"#16212A", surf2:"#1E2C35", border:"#2B3A44",
  text:"#E8EEF2", text2:"#AEBBC4", muted:"#8798A4",
  primary:"#2B8FD6", need:"#38BDF8", want:"#FBBF24", save:"#A78BFA", income:"#4ADE80",
  needS:"#38BDF822", wantS:"#FBBF2422", saveS:"#A78BFA22", incomeS:"#4ADE8022",
  good:"#4ADE80", goodS:"#4ADE8022", warn:"#FBBF24", warnS:"#FBBF2422", bad:"#F87171", badS:"#F8717122",
  gold:"#FBBF24", goldS:"#FBBF2422",
  shadow:"0 1px 2px rgba(0,0,0,.35), 0 10px 26px rgba(0,0,0,.5)",
};
const prefersDark = (() => {
  try { const s = localStorage.getItem("atoms.theme"); if (s === "dark") return true; if (s === "light") return false; } catch {}
  return typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
})();
const T = prefersDark ? DARK : LIGHT;
const BK = {
  need:  { l:"Need",   c:T.need,   s:T.needS,   i:"🧾" },
  want:  { l:"Want",   c:T.want,   s:T.wantS,   i:"🛍️" },
  save:  { l:"Save",   c:T.save,   s:T.saveS,   i:"🐷" },
  income:{ l:"Income", c:T.income, s:T.incomeS, i:"💵" },
};
const INR = n => (n<0?"-":"")+"₹"+Math.abs(Math.round(n)).toLocaleString("en-IN");
// Compact ₹ for tight spots: 12000→₹12k, 9260→₹9.3k, 217000→₹2.2L, 820→₹820
const INRk = n => { const s=n<0?"-":"", a=Math.abs(n);
  if(a>=1e5){ const v=a/1e5; return s+"₹"+(v>=10?Math.round(v):v.toFixed(1).replace(/\.0$/,""))+"L"; }
  if(a>=1000){ const v=a/1000; return s+"₹"+(v>=100?Math.round(v):v.toFixed(1).replace(/\.0$/,""))+"k"; }
  return s+"₹"+Math.round(a); };
const pct = (a,b) => b>0 ? a/b*100 : 0;
const MON  = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONF = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const today = () => { const d=new Date(); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); };
const fmtD = iso => { const [y,m,d]=(iso||"").split("-"); return d?`${+d} ${MON[+m-1]}`:iso; };
const fmtDFull = iso => { const [y,m,d]=(iso||"").split("-"); return d?`${+d} ${MON[+m-1]} ${y}`:iso; };
const mShift = (id,delta) => { const [y,m]=id.split("-").map(Number); const d=new Date(y,m-1+delta,1); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0"); };
const mLabel = id => { const [y,m]=id.split("-").map(Number); return MONF[m-1]+" "+y; };
const EMO = ["🧾","🏦","🥛","💡","🚰","🔥","🧹","🛒","🥬","📶","⛽","🛡️","💊","🍽️","🛍️","🔧","💇","🎬","🎓","📈","🏘️","💰","☕","🎁","✈️","📚","🏥","👕","🐾","🏠","🚗","📱"];
// icon fallback for envelopes saved before icons existed (same seed ids)
const DEF_ICON = { ssy:"🎓",sip:"📈",re:"🏘️",emi:"🏦",milk:"🥛",elec:"💡",water:"🚰",gas:"🔥",help:"🧹",dmart:"🛒",veg:"🥬",sub:"📶",petrol:"⛽",ins:"🛡️",med:"💊",eat:"🍽️",shop:"🛍️",maint:"🔧",groom:"💇",ent:"🎬" };
const iconOf = c => c.icon || DEF_ICON[c.id] || "₹";
// Strip the native number-input spinner (up/down arrows) on the amount field.
if (typeof document !== "undefined" && !document.getElementById("bud-css")) {
  const st = document.createElement("style"); st.id = "bud-css";
  st.textContent = ".bud-amt::-webkit-inner-spin-button,.bud-amt::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}.bud-amt{-moz-appearance:textfield}";
  document.head.appendChild(st);
}

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
    savingsActual:{},
    txns:[],   // no sample transactions — the user logs their own
  } } };
}

function calc(m) {
  const sp={}, bk={need:0,want:0,save:0}; let inx=0;
  (m.txns||[]).forEach(t=>{ if(t.bucket==="income"){ inx+=(+t.amount||0); return; } if(t.categoryId) sp[t.categoryId]=(sp[t.categoryId]||0)+(+t.amount||0); bk[t.bucket]=(bk[t.bucket]||0)+(+t.amount||0); });
  const income=(+m.salaryIncome||0)+(+m.otherIncome||0)+inx;
  const cats=m.categories||[]; let sb=0,eb=0;
  const bbud={need:0,want:0,save:0};
  cats.forEach(c=>{ if(c.bucket==="save"){ sb+=(+c.budget||0); bbud.save+=(+c.budget||0); } else { eb+=(+c.budget||0); bbud[c.bucket]+=(+c.budget||0); } });
  const sa=bk.save;   // savings actual = sum of Save transactions (contributions)
  const es=bk.need+bk.want, allocated=sb+eb;
  return { m, sp, bk, bbud, income, sb, sa, es, allocated, balance:income-es-sa, unalloc:income-allocated };
}
const stOf = (s,b) => { const u=pct(s,b); return u>100?"bad":u>=80?"warn":"good"; };

// ═══ CSV IMPORT / EXPORT ═══════════════════════════════════════════════════════
// Template columns: Month,Type,Date,Envelope,Bucket,Amount,Note
//   Type income → sets Salary/Other for the month  (Envelope = Salary | Other)
//   Type budget → sets an envelope's monthly allocation (Bucket = Need|Want|Save)
//   Type spend  → a transaction (Date YYYY-MM-DD, Envelope, Bucket, Amount, Note)
const normBucket = s => { s=(s||"").trim().toLowerCase(); return s.startsWith("need")?"need":s.startsWith("want")?"want":s.startsWith("sav")?"save":s.startsWith("inc")?"income":"need"; };
const mIdOf = s => { s=(s||"").trim(); let m=s.match(/^(\d{4})[-/](\d{1,2})$/); if(m) return m[1]+"-"+String(+m[2]).padStart(2,"0");
  m=s.match(/^([A-Za-z]{3,})\.?\s+(\d{4})$/); if(m){ const i=MON.findIndex(x=>x.toLowerCase()===m[1].slice(0,3).toLowerCase()); if(i>=0) return m[2]+"-"+String(i+1).padStart(2,"0"); } return ""; };
const parseCSV = text => { const rows=[]; let row=[], f="", q=false;
  for(let i=0;i<text.length;i++){ const c=text[i];
    if(q){ if(c==='"'){ if(text[i+1]==='"'){ f+='"'; i++; } else q=false; } else f+=c; }
    else if(c==='"') q=true;
    else if(c===','){ row.push(f); f=""; }
    else if(c==='\n'||c==='\r'){ if(c==='\r'&&text[i+1]==='\n') i++; row.push(f); if(row.some(x=>x.trim()!=="")) rows.push(row); row=[]; f=""; }
    else f+=c; }
  if(f!==""||row.length){ row.push(f); if(row.some(x=>x.trim()!=="")) rows.push(row); } return rows; };
const parseBudgetCSV = text => { const rows=parseCSV(text); if(!rows.length) return [];
  const head=rows[0].map(h=>h.trim().toLowerCase()); const hasHead=head.includes("month");
  const base={month:0,type:1,date:2,envelope:3,bucket:4,amount:5,note:6};
  const idx=n=>hasHead?head.indexOf(n):base[n];
  const out=[];
  for(let k=hasHead?1:0;k<rows.length;k++){ const r=rows[k];
    // Unquoted thousands separators (e.g. 2,17,774) split the Amount cell into
    // extra columns; everything after Amount shifts right by that surplus.
    const extra=Math.max(0, r.length-(hasHead?head.length:7));
    const ai=idx("amount");
    const cell=n=>{ let i=idx(n); if(i<0) return ""; if(extra>0 && ai>=0 && i>ai) i+=extra; return i>=0&&i<r.length?String(r[i]).trim():""; };
    const amtRaw=(ai>=0 && extra>0) ? r.slice(ai, ai+extra+1).map(x=>String(x).trim()).join("") : cell("amount");
    const month=mIdOf(cell("month")); if(!month) continue;
    out.push({ month, type:cell("type").toLowerCase(), date:cell("date"), envelope:cell("envelope"), bucket:cell("bucket"), amount:+String(amtRaw).replace(/[^0-9.\-]/g,"")||0, note:cell("note") }); }
  return out; };
const importBudgetRows = (budget, rows) => { const months={ ...(budget?.months||{}) };
  const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
  for(const r of rows){ const id=r.month;
    const base=months[id]||{ id, label:mLabel(id), status:"committed", salaryIncome:0, otherIncome:0, categories:[], savingsActual:{}, txns:[] };
    const mm={ ...base, categories:(base.categories||[]).map(c=>({ ...c })), txns:[...(base.txns||[])] };
    const bk=normBucket(r.bucket);
    const ensure=(name,bucket)=>{ let c=mm.categories.find(x=>(x.name||"").toLowerCase()===(name||"").toLowerCase()); if(!c){ c={ id:"c"+uid(), name:name||"Envelope", bucket:bucket||"need", budget:0 }; mm.categories.push(c); } return c; };
    const type=r.type||(r.date?"spend":(bk==="income"||/salary|other/i.test(r.envelope)?"income":"budget"));
    if(type==="income"){ const label=(r.envelope||"").trim();
      if(/salary/i.test(label)) mm.salaryIncome=r.amount;              // e.g. "Salary", "TIAA Salary" → fixed Salary
      else mm.txns.push({ id:"t"+uid(), date:r.date||id+"-01", desc:label||"Other income", amount:r.amount, categoryId:"", bucket:"income" }); }  // everything else → an income entry (Other income is not a fixed value)
    else if(type==="budget"){ const c=ensure(r.envelope, bk==="income"?"need":bk); c.budget=r.amount; if(bk!=="income") c.bucket=bk; }
    else { if(bk==="income"){ mm.txns.push({ id:"t"+uid(), date:r.date||id+"-01", desc:r.note||"Income", amount:r.amount, categoryId:"", bucket:"income" }); }
      else { const c=ensure(r.envelope, bk); mm.txns.push({ id:"t"+uid(), date:(r.date&&r.date.length>=7)?r.date:id+"-01", desc:r.note||"", amount:r.amount, categoryId:c.id, bucket:c.bucket }); } }
    months[id]=mm; }
  const active=(budget?.active&&months[budget.active])?budget.active:Object.keys(months).sort().pop();
  return { ...(budget||{}), active, months }; };
const budgetToCSV = budget => { const esc=s=>{ s=String(s==null?"":s); return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s; };
  const BL={need:"Need",want:"Want",save:"Save",income:"Income"};
  const lines=[["Month","Type","Date","Envelope","Bucket","Amount","Note"]];
  Object.keys(budget?.months||{}).sort().forEach(id=>{ const mm=budget.months[id];
    if(+mm.salaryIncome>0) lines.push([id,"income","","Salary","Income",Math.round(mm.salaryIncome),""]);
    if(+mm.otherIncome>0) lines.push([id,"income","","Other","Income",Math.round(mm.otherIncome),""]);
    (mm.categories||[]).forEach(c=>lines.push([id,"budget","",c.name,BL[c.bucket]||"Need",Math.round(+c.budget||0),""]));
    (mm.txns||[]).forEach(t=>{ if(t.bucket==="income"){ lines.push([id,"income",t.date||"",t.desc||"Income","Income",Math.round(+t.amount||0),""]); return; }
      const c=(mm.categories||[]).find(x=>x.id===t.categoryId); lines.push([id,"spend",t.date||"",c?c.name:"",BL[t.bucket]||"Need",Math.round(+t.amount||0),t.desc||""]); }); });
  return lines.map(r=>r.map(esc).join(",")).join("\r\n"); };

// ── shared bits ──
const card = extra => ({ background:T.surface, border:`1px solid ${T.border}`, borderRadius:14, padding:14, boxShadow:T.shadow, ...(extra||{}) });
const fld = { width:"100%", background:T.surf2, border:`1px solid ${T.border}`, borderRadius:11, padding:12, color:T.text, fontFamily:"inherit", fontSize:15, outline:"none", boxSizing:"border-box" };
const lab = { display:"block", fontSize:11.5, fontWeight:600, color:T.text2, marginBottom:5 };
const chip = k => { const c=k==="bad"?T.bad:k==="warn"?T.warn:k==="done"?T.save:T.good, s=k==="bad"?T.badS:k==="warn"?T.warnS:k==="done"?T.saveS:T.goodS;
  return { fontSize:10, fontWeight:800, padding:"2px 8px", borderRadius:20, background:s, color:c, whiteSpace:"nowrap" }; };
const primaryBtn = { width:"100%", background:T.primary, color:"#fff", border:"none", borderRadius:13, padding:15, fontFamily:"inherit", fontWeight:800, fontSize:15, cursor:"pointer" };
const ghostBtn = { background:T.surface, color:T.text2, border:`1px solid ${T.border}`, borderRadius:13, padding:15, fontFamily:"inherit", fontWeight:800, fontSize:15, cursor:"pointer" };
// Crisp inline-SVG icons for UI chrome (nav/buttons/headers). User-chosen glyphs
// (envelope & bucket emoji) stay as emoji — this is only for system chrome.
const BIC = {
  chart:  <><path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="6" rx="1"/><rect x="12" y="8" width="3" height="10" rx="1"/><rect x="17" y="5" width="3" height="13" rx="1"/></>,
  pencil: <path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/>,
  check:  <path d="M20 6L9 17l-5-5"/>,
  mail:   <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 7l8.5 6 8.5-6"/></>,
  spend:  <><circle cx="12" cy="12" r="9"/><path d="M12 8v6M9.2 11.2 12 14l2.8-2.8"/></>,
  wallet: <><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H17a2 2 0 0 1 2 2v1"/><path d="M3 7.5V17a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H5.5"/><circle cx="16.5" cy="13" r="1.25" fill="currentColor" stroke="none"/></>,
  download: <><path d="M12 3v12"/><path d="M7 11l5 4 5-4"/><path d="M5 21h14"/></>,
  printer:  <><path d="M6 9V3h12v6"/><rect x="5" y="9" width="14" height="8" rx="2"/><path d="M8 15h8v6H8z"/></>,
};
const Ic = ({ name, size=14, color="currentColor", style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink:0, ...style }}>{BIC[name]}</svg>
);
function Bar({ v, color }) { return <div style={{ height:7, borderRadius:5, background:T.surf2, overflow:"hidden", marginTop:8 }}><div style={{ height:"100%", width:Math.min(100,v)+"%", background:color, borderRadius:5 }} /></div>; }
function Sheet({ title, onClose, children }) {
  return <div onClick={e=>{ if(e.target===e.currentTarget) onClose(); }} style={{ position:"fixed", inset:0, background:"rgba(10,20,28,.5)", zIndex:120, display:"flex", alignItems:"flex-end", justifyContent:"center" }}>
    <div style={{ background:T.surface, width:"100%", maxWidth:480, boxSizing:"border-box", borderRadius:"20px 20px 0 0", padding:"16px 16px calc(22px + env(safe-area-inset-bottom,0px))", maxHeight:"92vh", overflowY:"auto", overflowX:"hidden" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:10, marginBottom:14 }}>
        <div style={{ fontWeight:800, fontSize:17, color:T.text }}>{title}</div>
        <button onClick={()=>onClose()} aria-label="Close" style={{ background:T.surf2, border:`1px solid ${T.border}`, color:T.text2, width:30, height:30, borderRadius:9, fontSize:15, lineHeight:1, cursor:"pointer", fontFamily:"inherit", flexShrink:0 }}>✕</button>
      </div>{children}</div></div>;
}

// ── spend sheet (envelope already chosen; transfer step inside) ──
function SpendSheet({ m, api, env, initial, curMonth, onClose, onChange }) {
  const isInc = env.bucket==="income";
  const [amt,setAmt]=useState(initial?String(initial.amount):"");
  const [desc,setDesc]=useState(initial?.desc||"");
  const t=today();
  // A spend can be logged for today or any of the previous 6 days — a rolling
  // 7-day window that can cross a month boundary (e.g. early in the month you can
  // still backdate into last month). An older date being edited stays valid.
  const six=(()=>{ const d=new Date(); d.setDate(d.getDate()-6); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); })();
  let dateMin=six, dateMax=t;
  if(initial?.date){ if(initial.date<dateMin) dateMin=initial.date; if(initial.date>dateMax) dateMax=initial.date; }
  const [date,setDate]=useState(initial?.date || t);
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
    if(!date) return setErr("Pick a date.");
    if(!initial && (date<six || date>t)) return setErr("Pick today or a date within the last 6 days.");
    if(!isInc && env.bucket!=="save"){ const rem=(+env.budget||0)-spentOf(env.id); if(a>rem){ setXfer({ shortfall:Math.round(a-rem), rem }); setSrc(""); return; } }
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
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:2, margin:"6px 0 18px", maxWidth:"100%" }}>
      <span style={{ fontSize:36, fontWeight:800, color:amt?T.text:T.muted, flexShrink:0 }}>₹</span>
      <input autoFocus type="number" inputMode="numeric" className="bud-amt" value={amt} onChange={e=>setAmt(e.target.value)} placeholder="0"
        style={{ fontSize:40, fontWeight:800, border:"none", background:"none", outline:"none", color:T.text, width:(Math.max(1,(amt||"").length)+0.6)+"ch", minWidth:"1.6ch", maxWidth:"72vw", textAlign:"left", fontFamily:"inherit", MozAppearance:"textfield", padding:0 }} /></div>
    <div style={{ marginBottom:12 }}><label style={lab}>Description</label><input style={fld} value={desc} onChange={e=>setDesc(e.target.value)} placeholder={isInc?"e.g. Freelance payment":"e.g. Weekend dinner"} /></div>
    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14, fontSize:13, color:T.text2 }}><span>Date</span>
      <input type="date" value={date} min={dateMin} max={dateMax} onChange={e=>setDate(e.target.value)} style={{ background:T.surf2, border:`1px solid ${T.border}`, borderRadius:9, padding:"7px 9px", color:T.text, fontFamily:"inherit", fontSize:13 }} /></div>
    {err && <div style={{ fontSize:12, color:T.bad, marginBottom:8 }}>{err}</div>}
    <div style={{ display:"flex", gap:10 }}>
      {initial ? <button onClick={()=>{ api.deleteTxn(initial.id); onClose(true); }} style={{ ...ghostBtn, color:T.bad, borderColor:T.bad+"55", flex:"0 0 auto" }}>Delete</button>
        : <button onClick={onChange} style={{ ...ghostBtn, flex:"0 0 auto" }}>Change</button>}
      <button onClick={submit} style={{ ...primaryBtn }}>{initial?"Save":"Add"}</button></div>
  </Sheet>;
}

function PickerSheet({ m, onPick, onNew, onClose }) {
  const grp = b => (m.categories||[]).filter(c=>c.bucket===b);
  const tile = c => <button key={c.id} onClick={()=>onPick(c)} style={pkBtn}><span style={{ fontSize:22 }}>{iconOf(c)}</span><span style={pkName}>{c.name}</span></button>;
  const sec = (l,color,items,extra) => items.length||extra ? <div key={l}><div style={{ fontSize:11, fontWeight:800, color, textTransform:"uppercase", letterSpacing:".04em", margin:"14px 2px 8px" }}>{l}</div>
    <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:11 }}>{items.map(tile)}{extra}</div></div> : null;
  return <Sheet title="Spend from…" onClose={onClose}>
    {sec("🧾 Needs", T.need, grp("need"))}
    {sec("🛍️ Wants", T.want, grp("want"))}
    {sec("🐷 Savings", T.save, grp("save"))}
    {sec("💵 Income", T.good, [], <button onClick={()=>onPick({ id:"", name:"Income", bucket:"income" })} style={pkBtn}><span style={{ fontSize:22 }}>💵</span><span style={pkName}>Add income</span></button>)}
    <button onClick={onNew} style={{ ...ghostBtn, width:"100%", marginTop:16 }}>＋ New custom category</button>
  </Sheet>;
}
const pkBtn = { background:T.surf2, border:`1px solid ${T.border}`, borderRadius:14, padding:"12px 4px", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:5, fontFamily:"inherit" };
const pkName = { fontSize:10.5, fontWeight:600, color:T.text2, textAlign:"center", lineHeight:1.2 };

// Reusable "Import from CSV" button + result note. onImport(text) returns row count.
function ImportCSVBtn({ onImport, hint }) {
  const [imp,setImp]=useState("");
  return <>
    <label style={{ ...ghostBtn, width:"100%", display:"flex", alignItems:"center", justifyContent:"center", gap:7, fontSize:14, cursor:"pointer" }}>
      <Ic name="download" size={16} color={T.text2} style={{ transform:"rotate(180deg)" }} /> Import from CSV
      <input type="file" accept=".csv,text/csv,text/plain" style={{ display:"none" }} onChange={e=>{ const f=e.target.files&&e.target.files[0]; if(f){ const rd=new FileReader(); rd.onload=()=>{ const n=onImport(String(rd.result||"")); setImp(n>0?`Imported ${n} row${n===1?"":"s"}.`:"No valid rows found — check the columns."); }; rd.readAsText(f); } e.target.value=""; }} />
    </label>
    {imp && <div style={{ fontSize:12, color:T.good, textAlign:"center", marginTop:8, fontWeight:600 }}>{imp}</div>}
    {hint && <div style={{ fontSize:11.5, color:T.muted, textAlign:"center", marginTop:8, lineHeight:1.5 }}>{hint}</div>}
  </>;
}

function IncomeSheet({ m, api, onImport, onAdd, onEdit, onClose }) {
  const [editing,setEditing]=useState(null); const [tmp,setTmp]=useState(""); const [clr,setClr]=useState(false);
  const entries=[...(m.txns||[])].filter(t=>t.bucket==="income").sort((a,b)=>b.date.localeCompare(a.date));
  const total=(+m.salaryIncome||0)+(+m.otherIncome||0)+entries.reduce((a,t)=>a+(+t.amount||0),0);
  const start=k=>{ setEditing(k); setTmp(String(k==="salary"?(m.salaryIncome||0):(m.otherIncome||0))); };
  const save=()=>{ const v=Math.max(0,+tmp||0); if(editing==="salary") api.setIncome(v, +m.otherIncome||0); else api.setIncome(+m.salaryIncome||0, v); setEditing(null); };
  const seclab=t=><div style={{ fontSize:11, fontWeight:800, color:T.muted, textTransform:"uppercase", letterSpacing:".04em", margin:"2px 2px 0" }}>{t}</div>;
  const baseRow=(k,icon,label,val)=> editing===k
    ? <div style={{ display:"flex", gap:8, alignItems:"center", padding:"10px 0", borderBottom:`1px solid ${T.border}` }}>
        <input autoFocus type="number" value={tmp} onChange={e=>setTmp(e.target.value)} style={{ ...fld }} />
        <button onClick={save} style={{ ...primaryBtn, width:"auto", padding:"11px 15px" }}>Save</button></div>
    : <div onClick={()=>start(k)} style={{ display:"flex", alignItems:"center", gap:11, padding:"12px 0", borderBottom:`1px solid ${T.border}`, cursor:"pointer" }}>
        <div style={{ width:36, height:36, borderRadius:10, background:T.incomeS, display:"flex", alignItems:"center", justifyContent:"center", fontSize:17, flexShrink:0 }}>{icon}</div>
        <div style={{ flex:1, minWidth:0 }}><div style={{ fontWeight:600, fontSize:14 }}>{label}</div><div style={{ fontSize:11.5, color:T.muted }}>Tap to edit</div></div>
        <div style={{ fontWeight:700, fontSize:14, color:T.good, fontVariantNumeric:"tabular-nums" }}>{INR(val)}</div></div>;
  return <Sheet title={"Income · "+(m.label||mLabel(m.id))} onClose={onClose}>
    {seclab("Fixed income")}
    {baseRow("salary","💼","Salary",m.salaryIncome||0)}
    {(+m.otherIncome>0) && baseRow("other","🏷️","Other income (tap to clear)",m.otherIncome)}
    <div style={{ margin:"16px 0 0" }}>{seclab("Income entries this month")}</div>
    {entries.length ? entries.map(t=><div key={t.id} onClick={()=>onEdit(t)} style={{ display:"flex", alignItems:"center", gap:11, padding:"12px 0", borderBottom:`1px solid ${T.border}`, cursor:"pointer" }}>
        <div style={{ width:36, height:36, borderRadius:10, background:T.incomeS, display:"flex", alignItems:"center", justifyContent:"center", fontSize:17, flexShrink:0 }}>💵</div>
        <div style={{ flex:1, minWidth:0 }}><div style={{ fontWeight:600, fontSize:14, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{t.desc||"Income"}</div><div style={{ fontSize:11.5, color:T.muted }}>{fmtD(t.date)}</div></div>
        <div style={{ fontWeight:700, fontSize:14, color:T.good, fontVariantNumeric:"tabular-nums" }}>+{INR(t.amount)}</div></div>)
      : <div style={{ fontSize:13, color:T.muted, padding:"12px 2px" }}>No extra income entries yet.</div>}
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", paddingTop:12, marginTop:4, borderTop:`2px solid ${T.border}`, fontSize:15, fontWeight:800 }}>
      <span>Total income</span><span style={{ color:T.good, fontVariantNumeric:"tabular-nums" }}>{INR(total)}</span></div>
    <button onClick={onAdd} style={{ ...ghostBtn, width:"100%", background:T.incomeS, color:T.good, borderColor:T.good+"4d", marginTop:14 }}>＋ Add income entry</button>
    {entries.length>0 && (clr
      ? <div style={{ marginTop:12, background:T.badS, border:`1px solid ${T.bad}55`, borderRadius:11, padding:12, textAlign:"center" }}>
          <div style={{ fontSize:12.5, color:T.bad, fontWeight:600, marginBottom:10 }}>Delete all {entries.length} income {entries.length===1?"entry":"entries"} for {m.label||mLabel(m.id)}? Salary & Other are kept. This can't be undone.</div>
          <div style={{ display:"flex", gap:10 }}><button onClick={()=>setClr(false)} style={{ ...ghostBtn, flex:1, padding:11 }}>Cancel</button>
            <button onClick={()=>{ api.clearIncome(); setClr(false); }} style={{ flex:1, background:T.bad, color:"#fff", border:"none", borderRadius:13, padding:11, fontFamily:"inherit", fontWeight:800, fontSize:14, cursor:"pointer" }}>Delete all</button></div></div>
      : <button onClick={()=>setClr(true)} style={{ display:"block", margin:"12px auto 0", background:"none", border:"none", color:T.bad, fontSize:12.5, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>Clear all income entries</button>)}
    {onImport && <div style={{ marginTop:14 }}><ImportCSVBtn onImport={onImport} hint={<>Income row: <b>Month,income,,Salary,Income,&lt;amount&gt;</b> — one per month, for Salary and/or Other.</>} /></div>}
  </Sheet>;
}

function CatSheet({ api, initial, onClose }) {
  const isNew=!initial;
  const [name,setName]=useState(initial?.name||""); const [bucket,setBucket]=useState(initial?.bucket||"need");
  const [budget,setBudget]=useState(initial?String(initial.budget):""); const [icon,setIcon]=useState(initial?iconOf(initial):"🧾");
  const [err,setErr]=useState("");
  const save=()=>{ const nm=name.trim(); if(!nm) return setErr("Give it a name."); const b=Math.max(0,+budget||0);
    if(isNew){ const cat={ id:"c"+Date.now(), name:nm, bucket, budget:b, icon }; api.addCategory(cat); onClose(cat); }
    else { api.editCategory(initial.id,{ name:nm, bucket, budget:b, icon }); onClose(); } };
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
      <button onClick={()=>onClose()} style={{ ...ghostBtn, flex:"0 0 auto" }}>Cancel</button><button onClick={save} style={primaryBtn}>Save</button></div>
  </Sheet>;
}

function MonthPicker({ budget, onPick, onCreate, onCreatePrev, onCreateMonth, onDelete, onImport, onExport, onExportMonth, carryOver, onToggleCarry, onClose }) {
  const [del,setDel]=useState(null); const [msg,setMsg]=useState(""); const [pick,setPick]=useState("");
  const ids=Object.keys(budget.months).sort(); const nextId=mShift(ids[ids.length-1],1); const prevId=mShift(ids[0],-1);
  const incomeOf=mm=>(+mm.salaryIncome||0)+(+mm.otherIncome||0)+((mm.txns||[]).filter(t=>t.bucket==="income").reduce((a,t)=>a+(+t.amount||0),0));
  return <Sheet title="Your budgets" onClose={onClose}>
    <div style={{ fontSize:11, fontWeight:800, color:T.muted, textTransform:"uppercase", letterSpacing:".04em", margin:"2px 2px 6px" }}>{ids.length} month{ids.length===1?"":"s"} created</div>
    {ids.map(id=>{ const mm=budget.months[id], active=id===budget.active;
      if (del===id) return <div key={id} style={{ background:T.badS, border:`1px solid ${T.bad}55`, borderRadius:12, padding:12, marginBottom:2 }}>
        <div style={{ fontSize:12.5, color:T.bad, fontWeight:600, marginBottom:10 }}>Delete {mm.label||mLabel(id)}? Its budget and all its transactions are removed.</div>
        <div style={{ display:"flex", gap:10 }}><button onClick={()=>setDel(null)} style={{ ...ghostBtn, flex:1, padding:11 }}>Cancel</button>
          <button onClick={()=>{ onDelete(id); setDel(null); }} style={{ flex:1, background:T.bad, color:"#fff", border:"none", borderRadius:13, padding:11, fontFamily:"inherit", fontWeight:800, fontSize:14, cursor:"pointer" }}>Delete</button></div></div>;
      return <div key={id} style={{ display:"flex", alignItems:"center", gap:9, padding:"11px 12px", borderRadius:12, border:`1px solid ${active?T.primary:"transparent"}`, background:active?T.primary+"14":"transparent", marginBottom:2 }}>
        <div onClick={()=>onPick(id)} style={{ display:"flex", alignItems:"center", gap:11, flex:1, minWidth:0, cursor:"pointer" }}>
          <div style={{ width:38, height:38, borderRadius:11, background:T.surf2, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>🗓️</div>
          <div style={{ flex:1, minWidth:0 }}><div style={{ fontWeight:700, fontSize:15 }}>{mm.label||mLabel(id)}</div><div style={{ fontSize:11.5, color:T.muted, fontVariantNumeric:"tabular-nums" }}>{INR(incomeOf(mm))} budget</div></div></div>
        {active ? <span style={{ color:T.primary, fontWeight:800 }}>✓</span>
          : <span style={{ fontSize:10.5, fontWeight:800, padding:"2px 8px", borderRadius:20, background:mm.status==="committed"?T.goodS:T.warnS, color:mm.status==="committed"?T.good:T.warn }}>{mm.status==="committed"?"Committed":"Draft"}</span>}
        <button onClick={()=>onExportMonth(id)} aria-label={"Export "+(mm.label||mLabel(id))} title="Export this month" style={{ background:"none", border:"none", color:T.muted, cursor:"pointer", padding:"4px 3px", flexShrink:0, display:"flex", alignItems:"center" }}><Ic name="download" size={16} color={T.muted} /></button>
        {ids.length>1 && <button onClick={()=>setDel(id)} aria-label={"Delete "+(mm.label||mLabel(id))} style={{ background:"none", border:"none", color:T.muted, fontSize:15, cursor:"pointer", padding:"4px 2px", flexShrink:0 }}>🗑️</button>}
      </div>; })}
    <div style={{ display:"flex", gap:8, marginTop:12 }}>
      <button onClick={onCreatePrev} style={{ flex:1, background:T.surf2, border:`1px dashed ${T.primary}72`, color:T.primary, borderRadius:13, padding:"14px 8px", fontFamily:"inherit", fontWeight:800, fontSize:13.5, cursor:"pointer" }}>＋ {mLabel(prevId)}<div style={{ fontSize:10.5, fontWeight:600, color:T.muted, marginTop:2 }}>earlier month</div></button>
      <button onClick={onCreate} style={{ flex:1, background:T.surf2, border:`1px dashed ${T.primary}72`, color:T.primary, borderRadius:13, padding:"14px 8px", fontFamily:"inherit", fontWeight:800, fontSize:13.5, cursor:"pointer" }}>＋ {mLabel(nextId)}<div style={{ fontSize:10.5, fontWeight:600, color:T.muted, marginTop:2 }}>next month</div></button>
    </div>
    <div style={{ display:"flex", gap:8, marginTop:8, alignItems:"stretch" }}>
      <input type="month" value={pick} onChange={e=>setPick(e.target.value)} aria-label="Pick a month to create"
        style={{ flex:1, background:T.surf2, border:`1px solid ${T.border}`, borderRadius:11, padding:"10px 11px", color:T.text, fontFamily:"inherit", fontSize:13.5, minWidth:0 }} />
      <button disabled={!pick||!!budget.months[pick]} onClick={()=>{ onCreateMonth(pick); }}
        style={{ flexShrink:0, background:(!pick||budget.months[pick])?T.surf2:T.primary, color:(!pick||budget.months[pick])?T.muted:"#fff", border:"none", borderRadius:11, padding:"10px 16px", fontFamily:"inherit", fontWeight:800, fontSize:13.5, cursor:(!pick||budget.months[pick])?"default":"pointer" }}>Create</button>
    </div>
    {pick && budget.months[pick] && <div style={{ fontSize:11.5, color:T.muted, margin:"6px 2px 0" }}>{mLabel(pick)} already exists — pick a different month.</div>}
    <div style={{ height:1, background:T.border, margin:"16px 0 12px" }} />
    <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4 }}>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13.5, fontWeight:700, color:T.text }}>Carry over leftover</div>
        <div style={{ fontSize:11.5, color:T.muted, lineHeight:1.4, marginTop:1 }}>Each month opens with the previous month's balance, so Balance runs cumulatively.</div>
      </div>
      <button onClick={()=>onToggleCarry(!carryOver)} aria-pressed={carryOver} aria-label="Carry over leftover" style={{ flexShrink:0, width:46, height:26, borderRadius:20, border:"none", cursor:"pointer", background:carryOver?T.primary:T.border, position:"relative" }}>
        <span style={{ position:"absolute", top:3, left:carryOver?23:3, width:20, height:20, borderRadius:"50%", background:"#fff", transition:"left .15s" }} /></button>
    </div>
    <div style={{ height:1, background:T.border, margin:"12px 0 12px" }} />
    <div style={{ fontSize:11, fontWeight:800, color:T.muted, textTransform:"uppercase", letterSpacing:".04em", margin:"0 2px 8px" }}>Import / export</div>
    <div style={{ display:"flex", gap:8 }}>
      <label style={{ ...ghostBtn, flex:1, padding:12, fontSize:13.5, display:"flex", alignItems:"center", justifyContent:"center", gap:6, cursor:"pointer" }}>
        <Ic name="download" size={16} color={T.text2} style={{ transform:"rotate(180deg)" }} /> Import CSV
        <input type="file" accept=".csv,text/csv,text/plain" style={{ display:"none" }} onChange={e=>{ const f=e.target.files&&e.target.files[0]; if(f){ const rd=new FileReader(); rd.onload=()=>{ const n=onImport(String(rd.result||"")); setMsg(n>0?`Imported ${n} row${n===1?"":"s"}.`:"No valid rows found — check the columns."); }; rd.readAsText(f); } e.target.value=""; }} />
      </label>
      <button onClick={onExport} style={{ ...ghostBtn, flex:1, padding:12, fontSize:13.5, display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}><Ic name="download" size={16} color={T.text2} /> Export CSV</button>
    </div>
    {msg && <div style={{ fontSize:12, color:T.good, textAlign:"center", marginTop:9, fontWeight:600 }}>{msg}</div>}
    <div style={{ fontSize:11.5, color:T.muted, textAlign:"center", marginTop:9, lineHeight:1.5 }}>Columns: Month, Type (income/budget/spend), Date, Envelope, Bucket, Amount, Note. Export then edit to see the format.</div>
  </Sheet>;
}

function GoalSheet({ m, cat, onAdd, onEdit, onClose }) {
  const contribs=[...(m.txns||[])].filter(t=>t.categoryId===cat.id && t.bucket==="save").sort((a,b)=>b.date.localeCompare(a.date));
  const funded=contribs.reduce((a,t)=>a+(+t.amount||0),0); const budget=+cat.budget||0, rem=budget-funded, done=funded>=budget&&budget>0;
  return <Sheet title={cat.name} onClose={onClose}>
    <div style={{ display:"flex", alignItems:"center", gap:11, background:T.saveS, borderRadius:13, padding:12, marginBottom:6 }}>
      <div style={{ width:40, height:40, borderRadius:11, background:T.surface, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>{iconOf(cat)}</div>
      <div><div style={{ fontWeight:800, fontSize:16, fontVariantNumeric:"tabular-nums" }}>{INR(funded)} <span style={{ fontSize:13, color:T.muted, fontWeight:500 }}>/ {INR(budget)}</span></div>
        <div style={{ fontSize:12, color:T.muted }}>{done?"Fully funded 🎉":INR(Math.max(0,rem))+" left to fund"}</div></div></div>
    <div style={{ fontSize:11, fontWeight:800, color:T.muted, textTransform:"uppercase", letterSpacing:".04em", margin:"16px 2px 4px" }}>Contributions this month</div>
    {contribs.length ? contribs.map(t=><div key={t.id} onClick={()=>onEdit(t)} style={{ display:"flex", alignItems:"center", gap:11, padding:"11px 0", borderBottom:`1px solid ${T.border}`, cursor:"pointer" }}>
        <div style={{ width:34, height:34, borderRadius:10, background:T.saveS, display:"flex", alignItems:"center", justifyContent:"center", fontSize:15, flexShrink:0 }}>💜</div>
        <div style={{ flex:1, minWidth:0 }}><div style={{ fontWeight:600, fontSize:13.5, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{t.desc||"Contribution"}</div><div style={{ fontSize:11.5, color:T.muted }}>{fmtD(t.date)}</div></div>
        <div style={{ fontWeight:700, fontSize:14, color:T.save, fontVariantNumeric:"tabular-nums" }}>{INR(t.amount)}</div></div>)
      : <div style={{ fontSize:13, color:T.muted, padding:"12px 2px" }}>No contributions yet.</div>}
    <div style={{ display:"flex", justifyContent:"space-between", paddingTop:12, marginTop:4, borderTop:`2px solid ${T.border}`, fontSize:15, fontWeight:800 }}>
      <span>Total funded</span><span style={{ color:T.save, fontVariantNumeric:"tabular-nums" }}>{INR(funded)}</span></div>
    <button onClick={onAdd} style={{ ...ghostBtn, width:"100%", background:T.saveS, color:T.save, borderColor:T.save+"4d", marginTop:14 }}>＋ Add contribution</button>
  </Sheet>;
}

function TransactionsSheet({ m, onAdd, onEdit, onClear, onDelete, onImport, onClose }) {
  const [filter,setFilter]=useState("all"); const [envF,setEnvF]=useState("all"); const [clr,setClr]=useState(false);
  const cat=id=>(m.categories||[]).find(c=>c.id===id);
  const all=[...(m.txns||[])].sort((a,b)=>b.date.localeCompare(a.date));
  const items=all.filter(t=>(filter==="all"||t.bucket===filter)&&(envF==="all"||t.categoryId===envF));
  const spent=all.filter(t=>t.bucket!=="income").reduce((a,t)=>a+(+t.amount||0),0);
  const inc=all.filter(t=>t.bucket==="income").reduce((a,t)=>a+(+t.amount||0),0);
  const fchip=(f,l)=><button key={f} onClick={()=>setFilter(f)} style={{ flex:1, padding:"8px 0", borderRadius:9, fontFamily:"inherit", fontSize:12.5, fontWeight:700, cursor:"pointer", border:`1px solid ${filter===f?T.primary:T.border}`, background:filter===f?T.primary:"transparent", color:filter===f?"#fff":T.text2 }}>{l}</button>;
  let last=null;
  return <Sheet title={"All transactions · "+(m.label||mLabel(m.id))} onClose={onClose}>
    <button onClick={onAdd} style={{ ...primaryBtn, marginBottom:12 }}>＋ Add transaction</button>
    <div style={{ display:"flex", gap:6, marginBottom:8 }}>{fchip("all","All")}{fchip("need","Needs")}{fchip("want","Wants")}{fchip("save","Save")}{fchip("income","Income")}</div>
    <select value={envF} onChange={e=>setEnvF(e.target.value)} style={{ width:"100%", marginBottom:6, background:T.surf2, border:`1px solid ${T.border}`, borderRadius:9, padding:"8px 9px", color:T.text, fontFamily:"inherit", fontSize:12.5, fontWeight:600 }}>
      <option value="all">All envelopes</option>
      {(m.categories||[]).map(c=><option key={c.id} value={c.id}>{iconOf(c)} {c.name}</option>)}</select>
    {items.length ? items.map(t=>{ const c=cat(t.categoryId), bk=BK[t.bucket]||BK.need, showDay=t.date!==last; last=t.date;
      return <div key={t.id}>
        {showDay && <div style={{ fontSize:11, fontWeight:800, color:T.muted, textTransform:"uppercase", letterSpacing:".03em", margin:"12px 2px 6px" }}>{fmtDFull(t.date)}</div>}
        <div onClick={()=>onEdit(t)} style={{ display:"flex", alignItems:"center", gap:11, padding:"10px 0", borderBottom:`1px solid ${T.border}`, cursor:"pointer" }}>
          <div style={{ width:36, height:36, borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, background:bk.s, color:bk.c, flexShrink:0 }}>{t.bucket==="income"?"💵":(c?iconOf(c):"₹")}</div>
          <div style={{ flex:1, minWidth:0 }}><div style={{ fontWeight:600, fontSize:13.5, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{t.desc||(c?c.name:t.bucket==="income"?"Income":"General")}</div>
            <div style={{ fontSize:11.5, color:T.muted }}>{t.bucket==="income"?"Income":(c?c.name:"General")} · {BK[t.bucket].l}</div></div>
          <div style={{ fontWeight:700, fontSize:14, fontVariantNumeric:"tabular-nums", color:t.bucket==="income"?T.good:T.text }}>{t.bucket==="income"?"+":""}{INR(t.amount)}</div></div>
      </div>; })
      : <div style={{ fontSize:13, color:T.muted, textAlign:"center", padding:"20px 0" }}>No transactions.</div>}
    <div style={{ fontSize:12, color:T.muted, textAlign:"center", marginTop:12 }}>{all.length} transactions · spent {INR(spent)} · income +{INR(inc)}</div>
    {(() => { const filtered = filter!=="all" || envF!=="all";
      const label = envF!=="all" ? (cat(envF)?.name||"") : filter!=="all" ? (filter==="income"?"income":(BK[filter]?.l||filter)) : "";
      const del = () => { if(onDelete) onDelete(items.map(t=>t.id)); else if(!filtered) onClear(); setClr(false); };
      if(!items.length) return null;
      return clr
      ? <div style={{ marginTop:12, background:T.badS, border:`1px solid ${T.bad}55`, borderRadius:11, padding:12, textAlign:"center" }}>
          <div style={{ fontSize:12.5, color:T.bad, fontWeight:600, marginBottom:10 }}>Delete {items.length} {label} transaction{items.length===1?"":"s"} for {m.label||mLabel(m.id)}? This can't be undone.</div>
          <div style={{ display:"flex", gap:10 }}><button onClick={()=>setClr(false)} style={{ ...ghostBtn, flex:1, padding:11 }}>Cancel</button>
            <button onClick={del} style={{ flex:1, background:T.bad, color:"#fff", border:"none", borderRadius:13, padding:11, fontFamily:"inherit", fontWeight:800, fontSize:14, cursor:"pointer" }}>Delete {items.length}</button></div></div>
      : <button onClick={()=>setClr(true)} style={{ display:"block", margin:"12px auto 0", background:"none", border:"none", color:T.bad, fontSize:12.5, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>{filtered?`Delete these ${items.length} ${label} transactions`:"Clear all transactions"}</button>;
    })()}
    {onImport && <div style={{ marginTop:16, paddingTop:14, borderTop:`1px solid ${T.border}` }}><ImportCSVBtn onImport={onImport} hint={<>Spend row: <b>Month,spend,Date,Envelope,Bucket,Amount,Note</b>. Imports spends (and budgets/income) for every month in the file.</>} /></div>}
  </Sheet>;
}

function EnvTxnSheet({ m, cat, onAdd, onEdit, onClose }) {
  const items=[...(m.txns||[])].filter(t=>t.categoryId===cat.id).sort((a,b)=>b.date.localeCompare(a.date));
  const spent=items.reduce((a,t)=>a+(+t.amount||0),0);
  const alloc=+cat.budget||0, bal=alloc-spent, bk=BK[cat.bucket]||BK.need;
  const stat=(k,v,vc)=><div style={{ flex:1, background:T.surf2, borderRadius:12, padding:"9px 8px", textAlign:"center", minWidth:0 }}>
    <div style={{ fontSize:10, fontWeight:700, color:T.muted, textTransform:"uppercase", letterSpacing:".03em" }}>{k}</div>
    <div style={{ fontSize:15, fontWeight:800, marginTop:2, fontVariantNumeric:"tabular-nums", color:vc||T.text, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{v}</div></div>;
  let last=null;
  return <Sheet title={iconOf(cat)+"  "+cat.name} onClose={onClose}>
    <div style={{ fontSize:12, color:T.muted, margin:"-6px 0 12px" }}>{bk.l} · envelope</div>
    <div style={{ display:"flex", gap:8, marginBottom:14 }}>{stat("Allocated",INR(alloc))}{stat("Spent",INR(spent),bk.c)}{stat("Balance",INR(bal),bal<0?T.bad:T.good)}</div>
    <button onClick={onAdd} style={{ ...primaryBtn, marginBottom:4 }}>＋ Add spend to {cat.name}</button>
    {items.length ? items.map(t=>{ const showDay=t.date!==last; last=t.date;
      return <div key={t.id}>
        {showDay && <div style={{ fontSize:11, fontWeight:800, color:T.muted, textTransform:"uppercase", letterSpacing:".03em", margin:"12px 2px 6px" }}>{fmtDFull(t.date)}</div>}
        <div onClick={()=>onEdit(t)} style={{ display:"flex", alignItems:"center", gap:11, padding:"10px 0", borderBottom:`1px solid ${T.border}`, cursor:"pointer" }}>
          <div style={{ width:36, height:36, borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, background:bk.s, color:bk.c, flexShrink:0 }}>{iconOf(cat)}</div>
          <div style={{ flex:1, minWidth:0 }}><div style={{ fontWeight:600, fontSize:13.5, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{t.desc||cat.name}</div>
            <div style={{ fontSize:11.5, color:T.muted }}>{fmtD(t.date)} · {bk.l}</div></div>
          <div style={{ fontWeight:700, fontSize:14, fontVariantNumeric:"tabular-nums" }}>{INR(t.amount)}</div></div>
      </div>; })
      : <div style={{ fontSize:13, color:T.muted, textAlign:"center", padding:"22px 0" }}>No transactions in this envelope yet.</div>}
    <div style={{ fontSize:12, color:T.muted, textAlign:"center", marginTop:12 }}>{items.length} transaction{items.length===1?"":"s"} · {INR(spent)}</div>
  </Sheet>;
}

function ReportSheet({ m, onClose }) {
  const d=calc(m);
  const grp = b => (m.categories||[]).filter(c=>c.bucket===b).sort((x,y)=>(d.sp[y.id]||0)-(d.sp[x.id]||0));
  const sav=grp("save");
  const left=d.balance;   // income − spent − saved (what's still unspent)
  const R=n=>Math.round(n), IN=n=>R(n).toLocaleString("en-IN");
  const expo=[...grp("need"),...grp("want"),...sav].map(c=>({ n:c.name, b:BK[c.bucket]?.l||c.bucket, s:d.sp[c.id]||0, a:+c.budget||0 }));
  const fname=mLabel(m.id).replace(/\s+/g,"-").toLowerCase();
  const downloadCSV=()=>{ const esc=s=>`"${String(s).replace(/"/g,'""')}"`;
    const lines=[["Envelope","Bucket","Spent","Allocated","Balance","% of income"]];
    expo.forEach(r=>lines.push([r.n,r.b,R(r.s),R(r.a),R(r.a-r.s),pct(r.s,d.income).toFixed(1)]));
    lines.push([],["Income","",R(d.income)],["Total spent","",R(d.es)],["Total saved","",R(d.sa)],["Left unspent","",R(left)]);
    const csv=lines.map(r=>r.map(esc).join(",")).join("\r\n");
    const u=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
    const a=document.createElement("a"); a.href=u; a.download=`atoms-budget-${fname}.csv`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(u),1500); };
  const printReport=()=>{ const w=window.open("","_blank");
    if(!w){ alert("Allow pop-ups for this site to print the report."); return; }
    const rowsHTML=expo.map(r=>`<tr><td>${r.n}</td><td>${r.b}</td><td>₹${IN(r.s)}</td><td>₹${IN(r.a)}</td><td>₹${IN(r.a-r.s)}</td><td>${pct(r.s,d.income).toFixed(1)}%</td></tr>`).join("");
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${mLabel(m.id)} budget report</title>
      <style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1a2730;max-width:660px;margin:24px auto;padding:0 16px}
      h1{font-size:20px;margin:0 0 2px}.sub{color:#5F6E7A;font-size:13px;margin-bottom:18px}
      table{width:100%;border-collapse:collapse;font-size:13px}th,td{padding:8px 6px;text-align:right;border-bottom:1px solid #e5ecf1}
      th:first-child,td:first-child{text-align:left}th{color:#5F6E7A;font-size:11px;text-transform:uppercase}
      tr.tot td{font-weight:700;border-top:2px solid #cdd9e1}
      .banner{margin-top:16px;padding:12px;border-radius:10px;background:#15803d14;color:#15803D;font-weight:700;text-align:center}</style></head>
      <body><h1>${mLabel(m.id)} · budget report</h1><div class="sub">Income ₹${IN(d.income)} · generated ${new Date().toLocaleDateString()}</div>
      <table><thead><tr><th>Envelope</th><th>Bucket</th><th>Spent</th><th>Allocated</th><th>Balance</th><th>% inc</th></tr></thead><tbody>${rowsHTML}
      <tr class="tot"><td>Total spent</td><td></td><td>₹${IN(d.es)}</td><td></td><td></td><td>${pct(d.es,d.income).toFixed(1)}%</td></tr>
      <tr class="tot"><td>Total saved</td><td></td><td>₹${IN(d.sa)}</td><td></td><td></td><td>${pct(d.sa,d.income).toFixed(1)}%</td></tr></tbody></table>
      <div class="banner">Income ₹${IN(d.income)} · spent ₹${IN(d.es)} · saved ₹${IN(d.sa)} · ₹${IN(left)} left</div></body></html>`);
    w.document.close(); w.focus(); setTimeout(()=>{ try{ w.print(); }catch(e){} },350); };
  const th={ textAlign:"right", padding:"7px 3px", fontSize:10, textTransform:"uppercase", color:T.muted, borderBottom:`1px solid ${T.border}` };
  const td={ textAlign:"right", padding:"7px 3px", fontSize:12, borderBottom:`1px solid ${T.border}`, fontVariantNumeric:"tabular-nums" };
  const catRow = (c,isSave) => { const v=d.sp[c.id]||0, bal=(+c.budget||0)-v; return <tr key={c.id}>
    <td style={{ ...td, textAlign:"left" }}>{iconOf(c)} {c.name}</td><td style={{ ...td, color:T.muted }}>{INR(c.budget)}</td><td style={{ ...td, fontWeight:600, color:isSave?T.save:T.text }}>{INR(v)}</td>
    <td style={{ ...td, color:isSave?T.muted:(bal<0?T.bad:T.text2) }}>{isSave?(bal>0?INR(bal)+" to go":"✓ funded"):INR(bal)}</td><td style={{ ...td, color:T.muted }}>{pct(v,d.income).toFixed(1)}</td></tr>; };
  // One section per bucket — its envelopes plus a subtotal row (Need / Want / Save).
  const section = (bucket, title) => { const cs=grp(bucket); if(!cs.length) return [];
    const alloc=d.bbud[bucket]||0, spent=d.bk[bucket]||0, meta=BK[bucket], isSave=bucket==="save";
    return [
      <tr key={bucket+"-h"}><td colSpan={5} style={{ ...td, textAlign:"left", color:meta.c, fontWeight:800, borderBottom:"none", paddingTop:13 }}>{meta.i} {title}</td></tr>,
      ...cs.map(c=>catRow(c,isSave)),
      <tr key={bucket+"-t"} style={{ fontWeight:800 }}><td style={{ ...td, textAlign:"left" }}>{title} subtotal</td><td style={{ ...td, color:T.muted }}>{INR(alloc)}</td><td style={{ ...td, color:meta.c }}>{INR(spent)}</td><td style={td}></td><td style={{ ...td, color:T.muted }}>{pct(spent,d.income).toFixed(1)}</td></tr>,
    ];
  };
  return <Sheet title={mLabel(m.id)+" report"} onClose={onClose}>
    <table style={{ width:"100%", borderCollapse:"collapse" }}><tbody>
      <tr><th style={{ ...th, textAlign:"left" }}>Envelope</th><th style={th}>Alloc</th><th style={th}>Spent</th><th style={th}>Balance</th><th style={th}>% inc</th></tr>
      {section("need","Needs")}
      {section("want","Wants")}
      {section("save","Savings")}
    </tbody></table>
    <div style={{ background:left>=0?T.goodS:T.badS, color:left>=0?T.good:T.bad, borderRadius:11, padding:12, fontWeight:800, textAlign:"center", fontSize:14, marginTop:12, animation:"savingReveal 0.5s cubic-bezier(0.34,1.4,0.64,1) both" }}>
      {left<0 ? `Overspent by ${INR(-left)} this month` : d.sa>0 ? `🎉 You saved ${INR(d.sa)} this month` : `🎉 ${INR(left)} left unspent this month`}</div>
    <div style={{ display:"flex", gap:8, marginTop:10 }}>
      <div style={{ flex:1, background:T.surf2, borderRadius:12, padding:"10px 6px", textAlign:"center" }}>
        <div style={{ fontSize:10, color:T.muted, textTransform:"uppercase", letterSpacing:".03em" }}>Spent</div>
        <div style={{ fontSize:15, fontWeight:800, marginTop:2, fontVariantNumeric:"tabular-nums" }}>{INR(d.es)}</div></div>
      <div style={{ flex:1, background:T.surf2, borderRadius:12, padding:"10px 6px", textAlign:"center" }}>
        <div style={{ fontSize:10, color:T.muted, textTransform:"uppercase", letterSpacing:".03em" }}>Saved</div>
        <div style={{ fontSize:15, fontWeight:800, marginTop:2, fontVariantNumeric:"tabular-nums", color:T.save }}>{INR(d.sa)}</div></div>
      <div style={{ flex:1.25, background:left<0?T.badS:T.goodS, border:`1.5px solid ${left<0?T.bad:T.good}`, borderRadius:12, padding:"10px 6px", textAlign:"center" }}>
        <div style={{ fontSize:10, color:left<0?T.bad:T.good, textTransform:"uppercase", letterSpacing:".03em", fontWeight:800 }}>Left this month</div>
        <div style={{ fontSize:18, fontWeight:800, marginTop:2, fontVariantNumeric:"tabular-nums", color:left<0?T.bad:T.good }}>{INR(left)}</div></div>
    </div>
    <div style={{ fontSize:11.5, color:T.muted, textAlign:"center", marginTop:7 }}>Income {INR(d.income)}. Nothing carries to next month.</div>
    <div style={{ display:"flex", gap:8, marginTop:14 }}>
      <button onClick={downloadCSV} style={{ ...ghostBtn, flex:1, padding:12, fontSize:13.5, display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}><Ic name="download" size={16} color={T.text2} /> CSV</button>
      <button onClick={printReport} style={{ ...ghostBtn, flex:1, padding:12, fontSize:13.5, display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}><Ic name="printer" size={16} color={T.text2} /> Print / PDF</button>
    </div>
    <button onClick={onClose} style={{ ...primaryBtn, marginTop:10 }}>Close</button>
  </Sheet>;
}

// ═══ MAIN ════════════════════════════════════════════════════════════════════
export default function BudgetView({ budget, setBudget }) {
  const [modal, setModal] = useState(null);   // {type, ...}
  const [editMode, setEditMode] = useState(false);
  const [impNote, setImpNote] = useState("");
  const active = budget?.active; const m = budget?.months?.[active];
  const curMonth = today().slice(0,7);
  const updateMonth = fn => setBudget(b => ({ ...b, months:{ ...b.months, [b.active]:fn(b.months[b.active]) } }));
  const api = {
    setActive:id=>setBudget(b=>({ ...b, active:id })),
    deleteMonth:id=>setBudget(b=>{ const months={ ...b.months }; delete months[id]; const rem=Object.keys(months).sort(); if(!rem.length) return b; return { ...b, months, active:b.active===id?rem[rem.length-1]:b.active }; }),
    createNext:()=>setBudget(b=>{ const list=Object.keys(b.months).sort(); const last=list[list.length-1]; const id=mShift(last,1);
      if(b.months[id]) return { ...b, active:id };
      const src=b.months[last]; return { ...b, months:{ ...b.months, [id]:{ id, label:mLabel(id), status:"draft", salaryIncome:src.salaryIncome, otherIncome:src.otherIncome, categories:src.categories.map(c=>({ ...c })), savingsActual:{}, txns:[] } }, active:id }; }),
    createPrev:()=>setBudget(b=>{ const list=Object.keys(b.months).sort(); const first=list[0]; const id=mShift(first,-1);
      if(b.months[id]) return { ...b, active:id };
      const src=b.months[first]; return { ...b, months:{ ...b.months, [id]:{ id, label:mLabel(id), status:"draft", salaryIncome:src.salaryIncome, otherIncome:src.otherIncome, categories:src.categories.map(c=>({ ...c })), savingsActual:{}, txns:[] } }, active:id }; }),
    createMonth:id=>setBudget(b=>{ if(!id||b.months[id]) return id?{ ...b, active:id }:b; const list=Object.keys(b.months).sort();
      const src=b.months[[...list].reverse().find(x=>x<id)] || b.months[list.find(x=>x>id)] || b.months[list[0]];   // copy envelopes from nearest existing month
      return { ...b, months:{ ...b.months, [id]:{ id, label:mLabel(id), status:"draft", salaryIncome:src?+src.salaryIncome||0:0, otherIncome:0, categories:src?(src.categories||[]).map(c=>({ ...c })):[], savingsActual:{}, txns:[] } }, active:id }; }),
    commit:()=>updateMonth(mm=>({ ...mm, status:"committed" })),
    setIncome:(s,o)=>updateMonth(mm=>({ ...mm, salaryIncome:s, otherIncome:o })),
    addCategory:c=>updateMonth(mm=>({ ...mm, categories:[...mm.categories, { id:"c"+Date.now(), ...c }] })),
    editCategory:(id,p)=>updateMonth(mm=>({ ...mm, categories:mm.categories.map(c=>c.id===id?{ ...c, ...p }:c) })),
    deleteCategory:id=>updateMonth(mm=>({ ...mm, categories:mm.categories.filter(c=>c.id!==id), txns:mm.txns.filter(t=>t.categoryId!==id) })),
    transfer:(from,to,a)=>updateMonth(mm=>({ ...mm, categories:mm.categories.map(c=>c.id===from?{ ...c, budget:(+c.budget||0)-a }:c.id===to?{ ...c, budget:(+c.budget||0)+a }:c) })),
    addTxn:t=>updateMonth(mm=>({ ...mm, txns:[...mm.txns, t] })),
    editTxn:(id,p)=>updateMonth(mm=>({ ...mm, txns:mm.txns.map(t=>t.id===id?{ ...t, ...p }:t) })),
    deleteTxn:id=>updateMonth(mm=>({ ...mm, txns:mm.txns.filter(t=>t.id!==id) })),
    clearTxns:()=>updateMonth(mm=>({ ...mm, txns:[] })),
    deleteTxns:(ids)=>{ const s=new Set(ids); updateMonth(mm=>({ ...mm, txns:(mm.txns||[]).filter(t=>!s.has(t.id)) })); },
    clearIncome:()=>updateMonth(mm=>({ ...mm, otherIncome:0, txns:(mm.txns||[]).filter(t=>t.bucket!=="income") })),
    importRows:rows=>setBudget(b=>importBudgetRows(b, rows)),
    setCarry:v=>setBudget(b=>({ ...b, carryOver:!!v })),
  };
  const importCSV = text => { const rows=parseBudgetCSV(text); if(rows.length) api.importRows(rows); return rows.length; };
  const exportCSV = (id) => { const src = id ? { ...budget, months:{ [id]: budget.months[id] } } : budget;
    const u=URL.createObjectURL(new Blob([budgetToCSV(src)],{type:"text/csv;charset=utf-8"})); const a=document.createElement("a"); a.href=u; a.download=id?`atoms-budget-${id}.csv`:"atoms-budget-export.csv"; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(u),1500); };
  // One-time migration: older data funded savings via savingsActual (mark-funded).
  // Convert each into an opening Save contribution so savings are transaction-based.
  useEffect(() => {
    if (!budget?.months) return;
    const needs = Object.values(budget.months).some(mm => Object.values(mm.savingsActual||{}).some(v => +v>0));
    if (!needs) return;
    const months = { ...budget.months };
    for (const id of Object.keys(months)) {
      const mm = months[id], sa = mm.savingsActual||{};
      const has = new Set((mm.txns||[]).filter(t=>t.bucket==="save").map(t=>t.categoryId));
      const add = Object.keys(sa).filter(k=>+sa[k]>0 && !has.has(k))
        .map(k=>({ id:"t"+Date.now()+Math.random().toString(36).slice(2,6), date:id+"-01", desc:"Opening balance", amount:+sa[k], categoryId:k, bucket:"save" }));
      months[id] = { ...mm, txns:[...(mm.txns||[]), ...add], savingsActual:{} };
    }
    setBudget(b => ({ ...b, months }));
  }, [budget, setBudget]);

  if (!m) {
    const ids = Object.keys(budget?.months || {});
    return <div style={{ display:"flex", flexDirection:"column", alignItems:"center", textAlign:"center", padding:"48px 20px" }}>
      <div aria-hidden="true" style={{ width:84, height:84, borderRadius:24, background:T.primary+"14", display:"flex", alignItems:"center", justifyContent:"center", fontSize:40, marginBottom:16, boxShadow:T.shadow }}>📮</div>
      <div style={{ fontSize:19, fontWeight:800, color:T.text, marginBottom:7 }}>Plan your first month</div>
      <div style={{ fontSize:14, color:T.muted, lineHeight:1.6, maxWidth:280, marginBottom:22 }}>Give every rupee a job — split your income into Need, Want and Save envelopes.</div>
      <button onClick={()=>{ setBudget(ids.length ? b=>({ ...b, active: ids[ids.length-1] }) : seedBudget()); }} style={{ ...primaryBtn, maxWidth:280 }}>{ids.length ? "Open my budget" : "Create my budget"}</button>
    </div>;
  }
  const d = calc(m); const committed = m.status==="committed";
  // Optional carry-over: this month opens with the sum of every earlier month's
  // leftover (income − spent − saved), so Balance runs cumulatively.
  const carryOn = !!budget?.carryOver;
  const carryIn = carryOn ? Object.keys(budget.months||{}).sort().filter(id=>id<active).reduce((a,id)=>a+calc(budget.months[id]).balance,0) : 0;
  const runBal = d.balance + carryIn;
  // The 4 most-recently-used envelopes (by latest transaction) pin to the top;
  // the rest are ordered by attention — overspent / near-limit first.
  const lastUsed = {}; (m.txns||[]).forEach(t=>{ if(t.categoryId && (!lastUsed[t.categoryId] || t.date>lastUsed[t.categoryId])) lastUsed[t.categoryId]=t.date; });
  const allCats = m.categories||[];
  const recentCats = allCats.filter(c=>lastUsed[c.id]).sort((a,b)=>lastUsed[b.id].localeCompare(lastUsed[a.id])).slice(0,4);
  const recentIds = new Set(recentCats.map(c=>c.id));
  const restCats = allCats.filter(c=>!recentIds.has(c.id));
  const sub = { fontSize:11, fontWeight:800, color:T.muted, textTransform:"uppercase", letterSpacing:".04em", margin:"0 2px 8px" };
  // Non-recent envelopes grouped by bucket, sorted A→Z within each group.
  const bucketSec = bucket => { const cs=restCats.filter(c=>c.bucket===bucket).sort((a,b)=>(a.name||"").localeCompare(b.name||"")); if(!cs.length) return null;
    const meta=BK[bucket], title=bucket==="save"?"Save":meta.l+"s";
    return [
      <div key={bucket+"-l"} style={{ ...sub, color:meta.c, marginTop:16, display:"flex", alignItems:"center" }}><span>{meta.i} {title}</span>
        <span style={{ marginLeft:"auto", color:T.muted, fontWeight:600, fontSize:11, textTransform:"none", letterSpacing:0, fontVariantNumeric:"tabular-nums" }}>{INR(d.bk[bucket]||0)} / {INR(d.bbud[bucket]||0)}</span></div>,
      <div key={bucket+"-g"} style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>{cs.map(envCard)}</div>
    ];
  };
  const envCard = c => { const s=d.sp[c.id]||0, bal=(+c.budget||0)-s, u=pct(s,c.budget); const n=(m.txns||[]).filter(t=>t.categoryId===c.id).length;
    const st=c.bucket==="save"?(s>=c.budget&&c.budget>0?"done":u>=80?"good":"warn"):stOf(s,c.budget);
    const label=c.bucket==="save"?(s>=c.budget&&c.budget>0?"Funded":u>0?"Partial":"Empty"):(st==="bad"?"Overspent":st==="warn"?"Watch":"On track");
    const col=st==="bad"?T.bad:st==="warn"?T.warn:BK[c.bucket].c;
    const cell=(l,v,vc,al)=><div style={{ minWidth:0, textAlign:al }}>
      <div style={{ fontSize:10, color:T.muted, textTransform:"uppercase", letterSpacing:".03em" }}>{l}</div>
      <div style={{ fontSize:12.5, fontWeight:700, fontVariantNumeric:"tabular-nums", color:vc||T.text, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{v}</div></div>;
    return <div key={c.id} onClick={()=>editMode?setModal({type:"cat",initial:c}):setModal(c.bucket==="save"?{type:"goal",cat:c}:{type:"spend",env:c})}
      style={{ ...card({ padding:13 }), cursor:"pointer", minWidth:0 }}>
      <div style={{ display:"flex", alignItems:"center", gap:9, marginBottom:11 }}>
        <div style={{ width:32, height:32, borderRadius:9, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, background:BK[c.bucket].s, flexShrink:0 }}>{iconOf(c)}</div>
        <span style={{ flex:1, minWidth:0, fontWeight:700, fontSize:13.5, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{c.name}</span>
        <span style={{ ...chip(st), flexShrink:0 }}>{label}</span></div>
      <Bar v={u} color={col} />
      <div style={{ display:"flex", justifyContent:"space-between", gap:6, marginTop:11 }}>
        {cell("Alloc", INRk(c.budget), null, "left")}{cell("Spent", INRk(s), col, "center")}{cell("Balance", INRk(bal), bal<0?T.bad:T.good, "right")}
      </div>
      {c.bucket!=="save" && <button onClick={e=>{ e.stopPropagation(); setModal({ type:"envtxns", cat:c }); }}
        style={{ marginTop:10, paddingTop:9, width:"100%", background:"none", border:"none", borderTop:`1px solid ${T.border}`, textAlign:"left", color:T.primary, fontFamily:"inherit", fontSize:11.5, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", gap:5 }}>
        🧾 {n} txn{n===1?"":"s"}<span style={{ marginLeft:"auto", opacity:.55 }}>›</span></button>}
    </div>; };

  const pill = on => ({ display:"inline-flex", alignItems:"center", gap:5, fontFamily:"inherit", fontSize:12.5, fontWeight:700, padding:"6px 12px", borderRadius:20, cursor:"pointer", border:`1px solid ${on?T.primary:T.border}`, background:on?T.primary+"14":T.surf2, color:on?T.primary:T.text2 });
  return <div style={{ display:"flex", flexDirection:"column", padding:"12px 14px 0" }}>
    {/* own header — month selection lives inside the Monthly budget card */}
    <div style={{ background:`linear-gradient(135deg, ${T.primary}, #075E8C)`, color:"#fff", borderRadius:16, padding:16, boxShadow:T.shadow }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
        <button onClick={()=>setModal({type:"months"})} style={{ background:"#ffffff2e", border:"none", color:"#fff", fontFamily:"inherit", fontWeight:800, fontSize:15, padding:"6px 12px", borderRadius:10, cursor:"pointer", display:"flex", alignItems:"center", gap:6 }}>{m.label||mLabel(active)} <span style={{ fontSize:11, opacity:.85 }}>▾</span></button>
        <span style={{ fontSize:11, fontWeight:700, padding:"3px 10px", borderRadius:20, background:"#ffffff2e", color:"#fff" }}>{committed?"Committed":"Draft"}</span>
      </div>
      <div style={{ fontSize:11.5, fontWeight:600, textTransform:"uppercase", letterSpacing:".05em", opacity:.85 }}>Monthly budget</div>
      <div style={{ fontSize:30, fontWeight:800, letterSpacing:"-.02em", marginTop:2, fontVariantNumeric:"tabular-nums" }}>{INR(d.income)}</div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", gap:8, marginTop:4 }}>
        <div style={{ fontSize:12, opacity:.9 }}>Salary {INR(m.salaryIncome)}{(+m.otherIncome>0)?` · Other ${INR(m.otherIncome)}`:""}{(() => { const n=(m.txns||[]).filter(t=>t.bucket==="income").length; return n?` · ${n} entr${n===1?"y":"ies"}`:""; })()}</div>
        <button onClick={()=>setModal({type:"income"})} style={{ background:"#ffffff2e", border:"none", color:"#fff", borderRadius:8, padding:"5px 13px", fontSize:11.5, fontWeight:700, cursor:"pointer", fontFamily:"inherit", flexShrink:0 }}>Income ›</button>
      </div>
    </div>
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:9, marginTop:12 }}>
      {["need","want","save"].map(k=><div key={k} style={card({ padding:"12px 11px" })}>
        <div style={{ fontSize:20 }}>{BK[k].i}</div><div style={{ fontSize:12, fontWeight:700, marginTop:5, color:BK[k].c }}>{BK[k].l}</div>
        <div style={{ fontSize:16, fontWeight:800, marginTop:1, fontVariantNumeric:"tabular-nums" }}>{INR(k==="save"?d.sa:d.bk[k])}</div>
        <div style={{ fontSize:11, color:T.muted, marginTop:1 }}>{pct(k==="save"?d.sa:d.bk[k],d.income).toFixed(0)}% · of {INR(d.bbud[k])}</div></div>)}
    </div>
    <div style={{ display:"flex", gap:9, marginTop:9 }}>
      <div style={{ ...card({ padding:"10px 12px" }), flex:1, display:"flex", alignItems:"center", gap:9 }}><Ic name="spend" size={19} color={T.muted} /><div><div style={{ fontSize:11, color:T.muted, fontWeight:600 }}>Spent</div><div style={{ fontSize:15, fontWeight:800, fontVariantNumeric:"tabular-nums" }}>{INR(d.es)}</div></div></div>
      <div style={{ ...card({ padding:"10px 12px" }), flex:1, display:"flex", alignItems:"center", gap:9 }}><Ic name="wallet" size={19} color={T.muted} /><div><div style={{ fontSize:11, color:T.muted, fontWeight:600 }}>{carryOn?"Balance (running)":"Balance"}</div><div style={{ fontSize:15, fontWeight:800, fontVariantNumeric:"tabular-nums", color:runBal<0?T.bad:T.good }}>{INR(runBal)}</div></div></div>
    </div>
    {carryOn && carryIn!==0 && <div style={{ fontSize:11.5, color:T.muted, textAlign:"center", marginTop:7 }}>Opening balance carried from earlier months: <b style={{ color:carryIn<0?T.bad:T.good }}>{INR(carryIn)}</b> + this month {INR(d.balance)} = {INR(runBal)}</div>}
    <div style={{ ...card({ padding:"12px 13px", marginTop:9 }) }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:8 }}>
        <span style={{ fontSize:12.5, fontWeight:700 }}>Allocation</span>
        <span style={{ fontSize:12, color:T.text2, fontVariantNumeric:"tabular-nums" }}>{INR(d.allocated)} of {INR(d.income)} income</span></div>
      <div style={{ height:9, borderRadius:6, background:T.surf2, overflow:"hidden" }}>
        <div style={{ height:"100%", width:Math.min(100,pct(d.allocated,d.income))+"%", background:d.unalloc<0?T.bad:T.primary, borderRadius:6 }} /></div>
      <div style={{ fontSize:11.5, marginTop:7, fontWeight:700, color:d.unalloc<0?T.bad:d.unalloc>0?T.warn:T.good }}>
        {d.unalloc<0 ? `⚠ Over-allocated by ${INR(-d.unalloc)}` : d.unalloc>0 ? `${INR(d.unalloc)} left to allocate` : "✓ Every rupee allocated"}</div></div>

    {!committed && <div style={{ marginTop:12, background:T.warnS, border:`1px solid ${T.warn}55`, borderRadius:13, padding:13 }}>
      <div style={{ fontWeight:700, color:T.warn }}>You're still planning this month</div>
      <div style={{ margin:"5px 0 10px", fontSize:12.5, color:T.text2, lineHeight:1.5 }}>Income {INR(d.income)} · allocated {INR(d.allocated)}. You start fresh — nothing carries over. Commit when you're ready to track spending.</div>
      <button onClick={api.commit} style={{ background:T.primary, color:"#fff", border:"none", borderRadius:10, padding:"10px 15px", fontWeight:700, fontSize:13.5, cursor:"pointer", fontFamily:"inherit" }}>Commit {m.label||mLabel(active)}</button></div>}

    {/* envelopes */}
    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", margin:"20px 2px 8px" }}>
      <span style={{ display:"inline-flex", alignItems:"center", gap:6, fontSize:13, fontWeight:800 }}><Ic name="mail" size={16} color={T.text} /> Envelopes</span>
      <div style={{ display:"flex", gap:8 }}>
        <label style={{ ...pill(false), cursor:"pointer" }}><Ic name="download" size={14} color={T.text2} style={{ transform:"rotate(180deg)" }} /> Import
          <input type="file" accept=".csv,text/csv,text/plain" style={{ display:"none" }} onChange={e=>{ const f=e.target.files&&e.target.files[0]; if(f){ const rd=new FileReader(); rd.onload=()=>{ const n=importCSV(String(rd.result||"")); setImpNote(n>0?`Imported ${n} row${n===1?"":"s"}`:"No valid rows found — check the columns"); setTimeout(()=>setImpNote(""),4500); }; rd.readAsText(f); } e.target.value=""; }} /></label>
        <button onClick={()=>setModal({type:"report"})} style={pill(false)}><Ic name="chart" size={14} color={T.text2} /> Report</button>
        <button onClick={()=>setEditMode(v=>!v)} style={pill(editMode)}><Ic name={editMode?"check":"pencil"} size={14} color={editMode?T.primary:T.text2} /> {editMode?"Done":"Edit"}</button></div>
    </div>
    {impNote && <div style={{ fontSize:12, color:T.good, fontWeight:700, textAlign:"right", margin:"-2px 2px 8px" }}>{impNote}</div>}
    {editMode && <div style={{ fontSize:12, color:T.muted, margin:"0 2px 8px" }}>Tap an envelope to edit its budget & icon, or add a new one below.</div>}
    {recentCats.length>0 && restCats.length>0 && <div style={sub}>⭐ Recently used</div>}
    {recentCats.length>0 && <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>{recentCats.map(envCard)}</div>}
    {bucketSec("need")}
    {bucketSec("want")}
    {bucketSec("save")}
    {editMode && <button onClick={()=>setModal({type:"cat"})} style={{ ...ghostBtn, width:"100%", marginTop:11 }}>＋ New envelope</button>}
    {editMode && <div style={{ marginTop:9 }}><ImportCSVBtn onImport={importCSV} hint={<>Budget row: <b>Month,budget,,Envelope,Bucket,Amount</b> (sets the envelope's allocation).</>} /></div>}

    {/* recent spends */}
    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", margin:"20px 2px 8px" }}>
      <span style={{ fontSize:13, fontWeight:800 }}>🧾 Recent transactions</span>
      <button onClick={()=>setModal({type:"txns"})} style={lnk}>See all ({(m.txns||[]).length}) ›</button></div>
    {[...(m.txns||[])].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,6).map(t=>{ const c=(m.categories||[]).find(x=>x.id===t.categoryId); const bk=BK[t.bucket]||BK.need;
      return <div key={t.id} onClick={()=>setModal({type:"spend", env:c||{id:"",name:"Income",bucket:t.bucket}, initial:t})}
        style={{ ...card({ padding:"10px 12px", marginBottom:8 }), display:"flex", alignItems:"center", gap:11, cursor:"pointer" }}>
        <div style={{ width:36, height:36, borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", fontSize:17, background:bk.s, color:bk.c, flexShrink:0 }}>{t.bucket==="income"?"💵":(c?iconOf(c):"₹")}</div>
        <div style={{ flex:1, minWidth:0 }}><div style={{ fontWeight:600, fontSize:13.5, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{t.desc||(c?c.name:"General")}</div>
          <div style={{ fontSize:11.5, color:T.muted }}>{fmtD(t.date)} · {t.bucket==="income"?"Income":(c?c.name:"General")} · {BK[t.bucket].l}</div></div>
        <div style={{ fontWeight:700, fontSize:14, fontVariantNumeric:"tabular-nums", color:t.bucket==="income"?T.good:T.text }}>{t.bucket==="income"?"+":""}{INR(t.amount)}</div></div>; })}

    {/* modals — `back` is a full modal descriptor so sheets return where they came from */}
    {modal?.type==="spend"  && <SpendSheet m={m} api={api} env={modal.env} initial={modal.initial} curMonth={curMonth} onClose={()=>setModal(modal.back||null)} onChange={()=>setModal({type:"picker"})} />}
    {modal?.type==="picker" && <PickerSheet m={m} onPick={c=>setModal({type:"spend", env:c, back:modal.back})} onNew={()=>setModal({type:"cat", spendAfter:true})} onClose={()=>setModal(modal.back||null)} />}
    {modal?.type==="txns"   && <TransactionsSheet m={m}
       onAdd={()=>setModal({type:"picker", back:{type:"txns"}})}
       onEdit={t=>setModal({type:"spend", env:(m.categories||[]).find(c=>c.id===t.categoryId)||{id:"",name:"Income",bucket:t.bucket}, initial:t, back:{type:"txns"}})}
       onClear={api.clearTxns} onDelete={api.deleteTxns} onImport={importCSV} onClose={()=>setModal(null)} />}
    {modal?.type==="envtxns" && <EnvTxnSheet m={m} cat={modal.cat}
       onAdd={()=>setModal({type:"spend", env:modal.cat, back:{type:"envtxns", cat:modal.cat}})}
       onEdit={t=>setModal({type:"spend", env:modal.cat, initial:t, back:{type:"envtxns", cat:modal.cat}})}
       onClose={()=>setModal(null)} />}
    {modal?.type==="income" && <IncomeSheet m={m} api={api} onImport={importCSV}
       onAdd={()=>setModal({type:"spend", env:{id:"",name:"Income",bucket:"income"}, back:{type:"income"}})}
       onEdit={t=>setModal({type:"spend", env:{id:"",name:"Income",bucket:"income"}, initial:t, back:{type:"income"}})}
       onClose={()=>setModal(null)} />}
    {modal?.type==="goal"   && <GoalSheet m={m} cat={modal.cat}
       onAdd={()=>setModal({type:"spend", env:modal.cat, back:{type:"goal", cat:modal.cat}})}
       onEdit={t=>setModal({type:"spend", env:modal.cat, initial:t, back:{type:"goal", cat:modal.cat}})}
       onClose={()=>setModal(null)} />}
    {modal?.type==="months" && <MonthPicker budget={budget} onPick={id=>{ api.setActive(id); setModal(null); }} onCreate={()=>{ api.createNext(); setModal(null); }} onCreatePrev={()=>{ api.createPrev(); setModal(null); }} onCreateMonth={id=>{ api.createMonth(id); setModal(null); }} onDelete={api.deleteMonth} onImport={importCSV} onExport={exportCSV} onExportMonth={exportCSV} carryOver={!!budget?.carryOver} onToggleCarry={api.setCarry} onClose={()=>setModal(null)} />}
    {modal?.type==="cat"    && <CatSheet api={api} initial={modal.initial} onClose={(cat)=>setModal(cat&&modal.spendAfter?{type:"spend", env:cat}:null)} />}
    {modal?.type==="report" && <ReportSheet m={m} onClose={()=>setModal(null)} />}
  </div>;
}
const lnk = { fontSize:12, fontWeight:700, color:T.primary, background:"none", border:"none", cursor:"pointer", fontFamily:"inherit" };
