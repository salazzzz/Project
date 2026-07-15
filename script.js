// ===== Euro Detailing CRM — cloud (Supabase) =====
const sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
const INTRO = 3200;

const intro = document.getElementById("intro");
const login = document.getElementById("login");
const app = document.getElementById("app");

/* ---------- Intro -> auth routing ---------- */
function afterIntro(){ intro.classList.add("intro--hidden"); routeAuth(); }
let introTimer = setTimeout(afterIntro, INTRO);
intro.addEventListener("click", ()=>{ if(intro.classList.contains("intro--hidden"))return; clearTimeout(introTimer); afterIntro(); });

async function routeAuth(){
  const { data:{ session } } = await sb.auth.getSession();
  if(session) showApp(); else showLogin();
}

/* ---------- Login ---------- */
const loginForm=document.getElementById("loginForm"), emailEl=document.getElementById("email"),
      pwEl=document.getElementById("password"), loginCard=document.getElementById("loginCard"),
      loginErr=document.getElementById("loginError"), loginBtn=document.getElementById("loginBtn");

function showLogin(){ app.classList.remove("app--visible"); login.classList.add("login--visible"); setTimeout(()=>emailEl.focus(),300); }
async function showApp(){ login.classList.remove("login--visible"); app.classList.add("app--visible"); await loadAll(); await loadExtras(); applyTheme(appSettings.theme); render(); renderBookings(); subscribeRealtime(); subscribeBookings(); syncCal(); }

loginForm.addEventListener("submit", async e=>{
  e.preventDefault();
  loginErr.textContent=""; loginBtn.disabled=true; loginBtn.textContent="Signing in…";
  const { error } = await sb.auth.signInWithPassword({ email: emailEl.value.trim(), password: pwEl.value });
  loginBtn.disabled=false; loginBtn.textContent="Sign in";
  if(error){
    loginErr.textContent = error.message || "Sign-in failed";
    loginCard.classList.remove("shake"); void loginCard.offsetWidth; loginCard.classList.add("shake");
  } else { pwEl.value=""; showApp(); }
});

document.getElementById("lockBtn").addEventListener("click", async ()=>{
  unsubscribeRealtime(); await sb.auth.signOut(); clients=[]; showLogin();
});

/* ---------- Navigation ---------- */
const navItems=document.querySelectorAll(".nav__item");
navItems.forEach(btn=>btn.addEventListener("click", ()=>{
  navItems.forEach(b=>b.classList.remove("is-active")); btn.classList.add("is-active");
  const v=btn.dataset.view;
  document.querySelectorAll(".view").forEach(s=>s.classList.remove("is-active"));
  document.getElementById("view-"+v).classList.add("is-active");
  if(v==="soon"){ document.getElementById("soonTitle").textContent=btn.dataset.label; document.getElementById("soonBody").textContent=`The ${btn.dataset.label} module is next — we'll build it piece by piece.`; }
  if(v==="clients") search.focus();
}));

/* ---------- Data (Supabase) ---------- */
let clients=[];
function mapRow(r){
  return { id:r.id, name:r.name, phone:r.phone||"", email:r.email||"", vehicle:r.vehicle||"",
    location:r.location||"", notes:r.notes||"", lastSeen:r.last_seen||"",
    created: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
    photos: Array.isArray(r.photos)?r.photos:[], payments: Array.isArray(r.payments)?r.payments:[] };
}
function toRow(o){
  return { name:o.name, phone:o.phone||null, email:o.email||null, vehicle:o.vehicle||null,
    location:o.location||null, last_seen:o.lastSeen||null, notes:o.notes||null,
    photos:o.photos||[], payments:o.payments||[] };
}
async function loadAll(){
  const { data, error } = await sb.from("clients").select("*").order("created_at",{ascending:false});
  if(error){ console.error("load", error); return; }
  clients = data.map(mapRow);
}
async function dbInsert(o){ const { error } = await sb.from("clients").insert(toRow(o)); if(error) alert("Save failed: "+error.message); }
async function dbUpdate(id,o){ const { error } = await sb.from("clients").update(toRow(o)).eq("id",id); if(error) alert("Update failed: "+error.message); }
async function dbPatch(id,patch){ const { error } = await sb.from("clients").update(patch).eq("id",id); if(error) alert("Update failed: "+error.message); }
async function dbDelete(id){ const { error } = await sb.from("clients").delete().eq("id",id); if(error) alert("Delete failed: "+error.message); }
async function refresh(){ await loadAll(); render(); if(currentId) renderDetail(); }

/* ---------- Realtime sync across devices ---------- */
let channel=null;
function subscribeRealtime(){
  if(channel) return;
  channel = sb.channel("clients-rt")
    .on("postgres_changes",{event:"*",schema:"public",table:"clients"}, ()=>{ refresh(); })
    .subscribe();
}
function unsubscribeRealtime(){ if(channel){ sb.removeChannel(channel); channel=null; } }

/* ---------- Helpers ---------- */
const esc=s=>(s||"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const money=n=>"$"+(Number(n)||0).toLocaleString(undefined,{maximumFractionDigits:0});
function fmtDate(d){ if(!d)return"—"; const dt=new Date(d+(String(d).length<=10?"T00:00:00":"")); return isNaN(dt)?d:dt.toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"}); }
const total=c=>(c.payments||[]).reduce((s,p)=>s+(Number(p.amount)||0)+(Number(p.tip)||0),0);
function lastPay(c){ const ps=(c.payments||[]).slice().sort((a,b)=>(b.date||"").localeCompare(a.date||"")); return ps[0]||null; }
function lastSeenOf(c){ const lp=lastPay(c); return c.lastSeen || (lp&&lp.date) || null; }
const initials=n=>(n||"?").trim().split(/\s+/).map(w=>w[0]).slice(0,2).join("").toUpperCase();
function avatar(c,cls){ return c.photos&&c.photos[0] ? `<img class="${cls}" src="${c.photos[0]}" alt="">` : `<div class="${cls}">${esc(initials(c.name))}</div>`; }
function fileToDataURL(file,max=900){
  return new Promise(res=>{ const r=new FileReader(); r.onload=()=>{ const img=new Image(); img.onload=()=>{
    let{width:w,height:h}=img; if(w>h&&w>max){h=h*max/w;w=max}else if(h>max){w=w*max/h;h=max}
    const cv=document.createElement("canvas"); cv.width=w; cv.height=h; cv.getContext("2d").drawImage(img,0,0,w,h);
    res(cv.toDataURL("image/jpeg",0.78)); }; img.src=r.result; }; r.readAsDataURL(file); });
}

/* ---------- Clients list ---------- */
const search=document.getElementById("search"), clientCards=document.getElementById("clientCards"), clientEmpty=document.getElementById("clientEmpty");
function renderCards(){
  const q=search.value.trim().toLowerCase();
  const f=clients.filter(c=>[c.name,c.phone,c.email,c.vehicle,c.location].some(x=>(x||"").toLowerCase().includes(q)));
  clientEmpty.hidden=clients.length!==0;
  if(clients.length===0){ clientCards.innerHTML=""; return; }
  if(f.length===0){ clientCards.innerHTML=`<div class="empty">No matches.</div>`; return; }
  clientCards.innerHTML=f.map(c=>{
    const repeat=(c.payments||[]).length>=2?`<span class="tagrepeat">repeat</span>`:"";
    const meta=c.vehicle||c.phone||c.location||"";
    return `<article class="ccard" data-open="${c.id}">${avatar(c,"ccard__avatar")}
      <div class="ccard__main"><div class="ccard__name">${esc(c.name)} ${repeat}</div><div class="ccard__meta">${esc(meta)}</div></div>
      <div class="ccard__right"><div class="ccard__paid">${money(total(c))}</div><div class="ccard__seen">${lastSeenOf(c)?fmtDate(lastSeenOf(c)):"—"}</div></div>
    </article>`;
  }).join("");
}
clientCards.addEventListener("click", e=>{ const id=e.target.closest("[data-open]")?.dataset.open; if(id) openDetail(id); });
search.addEventListener("input", renderCards);

/* ---------- Client detail ---------- */
const clRoot=document.querySelector("#view-clients .cl"), detailBody=document.getElementById("detailBody"),
      detailPlaceholder=document.getElementById("detailPlaceholder"), contentEl=document.querySelector(".content");
let currentId=null;
function openDetail(id){ currentId=id; renderDetail(); clRoot.classList.add("showing-detail"); detailPlaceholder.style.display="none"; detailBody.hidden=false; contentEl.scrollTop=0; }
function closeDetail(){ clRoot.classList.remove("showing-detail"); currentId=null; detailBody.hidden=true; detailPlaceholder.style.display=""; }

function renderDetail(){
  const c=clients.find(x=>x.id===currentId); if(!c){ closeDetail(); return; }
  const lp=lastPay(c);
  const photos=(c.photos&&c.photos.length)?c.photos.map((p,i)=>`<img src="${p}" alt="photo ${i+1}">`).join(""):`<span class="nophoto">No photos yet.</span>`;
  const pays=(c.payments&&c.payments.length)?c.payments.slice().sort((a,b)=>(b.date||"").localeCompare(a.date||"")).map(p=>{const i=c.payments.indexOf(p);const amt=(Number(p.amount)||0)+(Number(p.tip)||0);return `<div class="pay" data-pi="${i}"><span>${fmtDate(p.date)}${p.method?` · ${esc(p.method)}`:""}${p.tip?` · +${money(p.tip)} tip`:""}</span><span class="pay__r"><b>${money(amt)}</b><button class="pay__b" data-payedit="${i}">✎</button><button class="pay__b pay__del" data-paydel="${i}">✕</button></span></div>`;}).join(""):`<div class="pay"><span style="color:var(--muted)">No payments logged.</span></div>`;
  const row=(l,v)=>v?`<div class="drow"><span class="drow__l">${l}</span><span class="drow__v">${esc(v)}</span></div>`:"";
  detailBody.innerHTML=`
    <div class="detail__top"><button class="detail__back" id="detailBack">← Back</button><div class="detail__title">${esc(c.name)}</div></div>
    <div class="detail__hero">${avatar(c,"detail__avatar")}
      <div>${(c.payments||[]).length>=2?`<span class="tagrepeat">repeat client</span>`:""}
      <div style="color:var(--muted);font-size:.82rem;margin-top:.2rem">${esc(c.vehicle||"")}</div></div></div>
    <div class="dstats">
      <div class="dstat"><span class="dstat__l">Last seen</span><span class="dstat__v">${lastSeenOf(c)?fmtDate(lastSeenOf(c)):"—"}</span></div>
      <div class="dstat"><span class="dstat__l">Last payment</span><span class="dstat__v">${lp?money(lp.amount):"—"}</span></div>
      <div class="dstat"><span class="dstat__l">Total paid</span><span class="dstat__v good">${money(total(c))}</span></div>
    </div>
    <div class="drows">${row("Phone",c.phone)}${row("Email",c.email)}${row("Vehicle",c.vehicle)}${row("Location",c.location)}
      ${(!c.phone&&!c.email&&!c.vehicle&&!c.location)?'<div class="drow"><span class="drow__l">No contact info yet</span></div>':""}</div>
    <div class="dsec"><div class="dsec__h"><h4>Photos</h4></div><div class="photos">${photos}</div></div>
    <div class="dsec"><div class="dsec__h"><h4>Payments</h4></div>${pays}
      <div class="payadd"><input type="number" id="payAmt" placeholder="Amount" min="0" /><input type="number" id="payTip" placeholder="Tip" min="0" /><select id="payMethod" class="paysel">${["Cash","Venmo","Zelle","Cash App","Check","Card"].map(x=>`<option>${x}</option>`).join("")}</select><input type="date" id="payDate" value="${new Date().toISOString().slice(0,10)}" /><button class="btn btn--primary btn--xs" id="payAdd">Add</button></div></div>
    <div class="dsec"><div class="dsec__h"><h4>Notes</h4></div><textarea class="noteedit" id="noteEdit" placeholder="Add notes about this client…">${esc(c.notes||"")}</textarea></div>
    ${typeof vehiclesHTML==="function"?vehiclesHTML(c):""}
    ${typeof clientHistoryHTML==="function"?clientHistoryHTML(c):""}
    <div class="detail__actions"><button class="btn btn--ghost btn--xs" id="detailEdit">Edit</button><button class="btn btn--danger btn--xs" id="detailDelete">Delete</button></div>`;

  detailBody.querySelector("#detailBack").addEventListener("click", closeDetail);
  detailBody.querySelector("#detailEdit").addEventListener("click", ()=>openModal(c));
  detailBody.querySelector("#detailDelete").addEventListener("click", async ()=>{
    if(confirm(`Delete ${c.name}? Their Cal.com bookings are removed too and won't re-sync.`)){
      // Suppress this client's Cal bookings so the auto-sync won't recreate them.
      const { data: bks } = await sb.from("bookings").select("cal_uid").eq("client_id", c.id);
      const uids = (bks||[]).filter(b=>b.cal_uid).map(b=>({ owner: ownerId, cal_uid: b.cal_uid }));
      if(uids.length) await sb.from("suppressed").upsert(uids, { onConflict: "owner,cal_uid" });
      await sb.from("bookings").delete().eq("client_id", c.id);
      await dbDelete(c.id);
      closeDetail(); await refresh(); if(typeof loadExtras==="function"){ await loadExtras(); renderBookings(); }
    }
  });
  detailBody.querySelector("#noteEdit").addEventListener("change", async e=>{ await dbPatch(c.id,{notes:e.target.value}); });
  detailBody.querySelectorAll(".ba__share").forEach(btn=>btn.addEventListener("click", async ()=>{
    const j=(jobs||[]).find(x=>x.id===btn.dataset.ba); if(!j) return;
    const orig=btn.textContent; btn.textContent="Building…"; btn.disabled=true;
    try{ const url=await makeBeforeAfter((j.before_photos||[])[0],(j.after_photos||[])[0],{sub:c.name}); await shareTemplate(url,c.name); }catch(e){}
    btn.textContent=orig; btn.disabled=false;
  }));
  detailBody.querySelectorAll(".ba__invoice").forEach(btn=>btn.addEventListener("click", async ()=>{
    const j=(jobs||[]).find(x=>x.id===btn.dataset.inv); if(!j) return;
    const bk=(bookings||[]).find(x=>x.id===j.booking_id);
    const orig=btn.textContent; btn.textContent="Building…"; btn.disabled=true;
    try{ await shareInvoice(j,c,bk); }catch(e){}
    btn.textContent=orig; btn.disabled=false;
  }));
  detailBody.querySelector("[data-addveh]")?.addEventListener("click", ()=>openVehicleSheet(c.id,null));
  detailBody.querySelectorAll("[data-veh]").forEach(el=>el.addEventListener("click", (e)=>{ if(e.target.closest("[data-delveh]"))return; const v=(vehicles||[]).find(x=>x.id===el.dataset.veh); if(v)openVehicleSheet(c.id,v); }));
  detailBody.querySelectorAll("[data-delveh]").forEach(b=>b.addEventListener("click", async (e)=>{ e.stopPropagation(); if(confirm("Delete this vehicle?")){ await sb.from("vehicles").delete().eq("id",b.dataset.delveh); await loadExtras(); renderDetail(); } }));
  detailBody.querySelector("#payAdd").addEventListener("click", async ()=>{
    const amt=parseFloat(detailBody.querySelector("#payAmt").value);
    const tip=parseFloat(detailBody.querySelector("#payTip").value)||0;
    const method=detailBody.querySelector("#payMethod").value;
    const date=detailBody.querySelector("#payDate").value || new Date().toISOString().slice(0,10);
    if(!amt||amt<=0) return;
    const payments=(c.payments||[]).concat([{amount:amt,tip,method,date}]);
    await dbPatch(c.id,{ payments, last_seen:date }); await refresh();
  });
  detailBody.querySelectorAll("[data-paydel]").forEach(b=>b.addEventListener("click", async ()=>{
    const i=+b.dataset.paydel;
    if(confirm("Delete this payment?")){ const payments=(c.payments||[]).slice(); payments.splice(i,1); await dbPatch(c.id,{payments}); await refresh(); }
  }));
  detailBody.querySelectorAll("[data-payedit]").forEach(b=>b.addEventListener("click", ()=>{
    const i=+b.dataset.payedit, p=c.payments[i], rowEl=b.closest(".pay");
    rowEl.innerHTML=`<input type="number" class="pe-amt" value="${p.amount}" min="0" /><input type="date" class="pe-date" value="${p.date||''}" /><button class="btn btn--primary btn--xs" data-pesave>Save</button>`;
    rowEl.querySelector("[data-pesave]").addEventListener("click", async ()=>{
      const amt=parseFloat(rowEl.querySelector(".pe-amt").value); const date=rowEl.querySelector(".pe-date").value;
      if(!amt||amt<=0) return;
      const payments=(c.payments||[]).slice(); payments[i]={...payments[i], amount:amt, date:date||payments[i].date};
      await dbPatch(c.id,{payments}); await refresh();
    });
  }));
}

/* ---------- Add / Edit modal ---------- */
const modal=document.getElementById("modal"), clientForm=document.getElementById("clientForm"), modalTitle=document.getElementById("modalTitle"),
      fName=document.getElementById("fName"), fPhone=document.getElementById("fPhone"), fEmail=document.getElementById("fEmail"),
      fVehicle=document.getElementById("fVehicle"), fLocation=document.getElementById("fLocation"), fLastSeen=document.getElementById("fLastSeen"),
      fNotes=document.getElementById("fNotes"), fPhotos=document.getElementById("fPhotos"), photoEdit=document.getElementById("photoEdit");
let editId=null, editPhotos=[];
function renderPhotoEdit(){ photoEdit.innerHTML=editPhotos.map((p,i)=>`<div class="photoedit__item"><img src="${p}" alt=""><button type="button" class="photoedit__del" data-ph="${i}">×</button></div>`).join(""); }
photoEdit.addEventListener("click", e=>{ const i=e.target.dataset.ph; if(i!=null){ editPhotos.splice(+i,1); renderPhotoEdit(); } });
fPhotos.addEventListener("change", async e=>{ for(const file of e.target.files){ editPhotos.push(await fileToDataURL(file)); } renderPhotoEdit(); fPhotos.value=""; });

function openModal(c){
  editId=c?c.id:null; editPhotos=c?(c.photos||[]).slice():[];
  modalTitle.textContent=c?"Edit client":"Add client";
  fName.value=c?c.name:""; fPhone.value=c?c.phone:""; fEmail.value=c?c.email||"":"";
  fVehicle.value=c?c.vehicle:""; fLocation.value=c?c.location||"":""; fLastSeen.value=c?c.lastSeen||"":"";
  fNotes.value=c?c.notes:""; renderPhotoEdit();
  modal.classList.add("is-open"); setTimeout(()=>fName.focus(),50);
}
function closeModal(){ modal.classList.remove("is-open"); editId=null; editPhotos=[]; }
document.getElementById("addBtn").addEventListener("click", ()=>openModal(null));
modal.querySelectorAll("[data-close]").forEach(el=>el.addEventListener("click", closeModal));
document.addEventListener("keydown", e=>{ if(e.key==="Escape"&&modal.classList.contains("is-open")) closeModal(); });

clientForm.addEventListener("submit", async e=>{
  e.preventDefault();
  const name=fName.value.trim(); if(!name) return;
  const existing = editId ? clients.find(c=>c.id===editId) : null;
  const o={ name, phone:fPhone.value.trim(), email:fEmail.value.trim(), vehicle:fVehicle.value.trim(),
    location:fLocation.value.trim(), lastSeen:fLastSeen.value, notes:fNotes.value.trim(),
    photos:editPhotos.slice(), payments: existing ? existing.payments : [] };
  const saveBtn=clientForm.querySelector('button[type=submit]'); saveBtn.disabled=true;
  if(editId) await dbUpdate(editId,o); else await dbInsert(o);
  saveBtn.disabled=false; closeModal(); await refresh();
});

/* ---------- Dashboard ---------- */
function bkMiniCard(b){
  return `<article class="bkcard"><div class="bkcard__top"><div><div class="bkcard__name">${esc(b.attendee_name||"—")}</div><div class="bkcard__svc">${esc(svcLabel(b))}</div></div>${b.price?`<div class="bkcard__price">${money(b.price)}</div>`:""}</div><div class="bkcard__when">📅 ${esc(bkWhen(b))}</div><div class="bkcard__btns"><button class="btn btn--ghost btn--xs" data-msg="${b.id}">💬 On my way</button><button class="btn btn--primary btn--xs" data-start="${b.id}">Start →</button></div></article>`;
}
function renderDashboard(){
  const el=document.getElementById("dashBody"); if(!el) return;
  const now=new Date(), hr=now.getHours();
  const greet=hr<12?"Good morning":hr<18?"Good afternoon":"Good evening";
  const today=now.toISOString().slice(0,10);
  const weekAgo=new Date(Date.now()-7*864e5).toISOString().slice(0,10);
  const monthStart=new Date(now.getFullYear(),now.getMonth(),1).toISOString().slice(0,10);
  const pays=clients.flatMap(c=>(c.payments||[]).map(p=>({amount:Number(p.amount)||0,date:p.date||""})));
  const sum=a=>a.reduce((s,p)=>s+p.amount,0);
  const weekRev=sum(pays.filter(p=>p.date>=weekAgo)), monthRev=sum(pays.filter(p=>p.date>=monthStart)), totalRev=sum(pays);
  const sameDay=d=>d&&new Date(d).toISOString().slice(0,10)===today;
  const todays=bookings.filter(b=>sameDay(b.scheduled_at)&&b.status!=="cancelled"&&b.status!=="rejected").sort((a,b)=>new Date(a.scheduled_at)-new Date(b.scheduled_at));
  const upcoming=bookings.filter(b=>b.scheduled_at&&new Date(b.scheduled_at)>=now&&b.status!=="cancelled"&&b.status!=="rejected"&&b.status!=="done").sort((a,b)=>new Date(a.scheduled_at)-new Date(b.scheduled_at));
  const next=upcoming[0];
  const recentJobs=(jobs||[]).slice(0,5);
  el.innerHTML=`
    <div class="dash__hi"><div><div class="dash__greet">${greet}, Eric 👋</div><div class="dash__date">${now.toLocaleDateString(undefined,{weekday:"long",month:"long",day:"numeric"})}</div></div><button class="btn btn--ghost btn--xs" id="dashSync">↻ Sync</button></div>
    <div class="dstats dash__stats">
      <div class="dstat"><span class="dstat__l">Today</span><span class="dstat__v">${todays.length}<span class="dstat__u">jobs</span></span></div>
      <div class="dstat"><span class="dstat__l">This week</span><span class="dstat__v good">${money(weekRev)}</span></div>
      <div class="dstat"><span class="dstat__l">This month</span><span class="dstat__v good">${money(monthRev)}</span></div>
    </div>
    ${next?`<div class="dash__next"><div class="dash__next-l">Up next</div><div class="dash__next-name">${esc(next.attendee_name||"—")}</div><div class="dash__next-svc">${esc(svcLabel(next))} · ${esc(bkWhen(next))}${next.price?` · ${money(next.price)}`:""}</div><div class="bkcard__btns"><button class="btn btn--ghost btn--xs" data-msg="${next.id}">💬 On my way</button><button class="btn btn--primary btn--xs" data-start="${next.id}">Start detail →</button></div></div>`:""}
    <div class="dash__sec-t">Today's schedule</div>
    ${todays.length?`<div class="bklist">${todays.map(bkMiniCard).join("")}</div>`:`<div class="empty">Nothing booked today.</div>`}
    <div class="dash__sec-t">Recent details</div>
    ${recentJobs.length?`<div class="panel">${recentJobs.map(j=>{const c=clients.find(x=>x.id===j.client_id);const mins=Math.round((j.duration_seconds||0)/60);const when=j.finished_at?new Date(j.finished_at).toLocaleDateString(undefined,{month:"short",day:"numeric"}):"";return `<div class="recent__row"><b>${esc(c?c.name:"Client")}</b><span>${when} · ${mins}m · ${money(j.charge_amount||0)}</span></div>`;}).join("")}</div>`:`<div class="empty">No completed details yet — start one from Bookings.</div>`}
    <div class="dash__sec-t">Overview</div>
    <div class="dstats"><div class="dstat"><span class="dstat__l">Clients</span><span class="dstat__v">${clients.length}</span></div><div class="dstat"><span class="dstat__l">Details done</span><span class="dstat__v">${(jobs||[]).length}</span></div><div class="dstat"><span class="dstat__l">All-time</span><span class="dstat__v good">${money(totalRev)}</span></div></div>`;
  el.querySelector("#dashSync")?.addEventListener("click",e=>syncCal(e.target));
  el.querySelectorAll("[data-msg]").forEach(b=>b.addEventListener("click",()=>{const x=bookings.find(k=>k.id===b.dataset.msg);if(x)messageCustomer(x,appSettings.messages?.on_my_way);}));
  el.querySelectorAll("[data-start]").forEach(b=>b.addEventListener("click",()=>{const x=bookings.find(k=>k.id===b.dataset.start);if(x)openStartDetail(x);}));
}

function render(){ renderDashboard(); renderCards(); }

/* =================== Bookings / Start Detail / Settings =================== */
let bookings = [], services = [], sops = [], appSettings = {}, jobs = [], expenses = [], vehicles = [], ownerId = null;

async function loadExtras() {
  const u = await sb.auth.getUser(); ownerId = u.data.user?.id || null;
  const [bk, sv, so, st, jb, ex, vh] = await Promise.all([
    sb.from("bookings").select("*").order("scheduled_at", { ascending: true }),
    sb.from("services").select("*"),
    sb.from("sops").select("*"),
    sb.from("settings").select("data").maybeSingle(),
    sb.from("jobs").select("*").order("finished_at", { ascending: false }),
    sb.from("expenses").select("*").order("spent_at", { ascending: false }),
    sb.from("vehicles").select("*").order("created_at", { ascending: false }),
  ]);
  bookings = bk.data || []; services = sv.data || []; sops = so.data || []; appSettings = (st.data && st.data.data) || {}; jobs = jb.data || []; expenses = ex.data || []; vehicles = vh.data || [];
}

async function syncCal(btn) {
  if (btn) { btn.disabled = true; btn.textContent = "Syncing…"; }
  try { await fetch(window.SUPABASE_URL + "/functions/v1/cal-sync", { headers: { Authorization: "Bearer " + window.SUPABASE_ANON_KEY } }); } catch (e) {}
  await loadExtras(); await loadAll(); render(); renderBookings();
  if (btn) { btn.disabled = false; btn.textContent = "↻ Sync"; }
}

const cap = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
function svcLabel(b) { const p = [b.service, b.tier, b.size].filter(Boolean).map(cap); return p.length ? p.join(" · ") : (b.title || "Detail"); }
function bkWhen(b) { return b.scheduled_at ? new Date(b.scheduled_at).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : ""; }
const phoneClean = (s) => (s || "").replace(/[^0-9+]/g, "");

let bkSeg = "upcoming";
const bkList = document.getElementById("bkList"), bkEmpty = document.getElementById("bkEmpty");
document.getElementById("bkSeg").addEventListener("click", (e) => {
  const s = e.target.dataset.seg; if (!s) return; bkSeg = s;
  document.querySelectorAll("#bkSeg .seg__b").forEach((b) => b.classList.toggle("is-active", b.dataset.seg === s));
  renderBookings();
});
document.getElementById("syncBtn").addEventListener("click", (e) => syncCal(e.target));

function renderBookings() {
  if (bkSeg === "week") { renderWeek(); return; }
  const now = Date.now();
  const isUp = (b) => b.scheduled_at && new Date(b.scheduled_at).getTime() >= now - 2 * 3600e3 && b.status !== "cancelled" && b.status !== "rejected";
  const up = bookings.filter(isUp).sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));
  const past = bookings.filter((b) => !isUp(b)).sort((a, b) => new Date(b.scheduled_at || 0) - new Date(a.scheduled_at || 0));
  const list = bkSeg === "upcoming" ? up : past;
  bkEmpty.hidden = list.length !== 0;
  bkList.innerHTML = list.map((b) => {
    const s = (b.status || "").toLowerCase();
    const cls = s === "accepted" ? "accepted" : s === "pending" ? "pending" : (s === "cancelled" || s === "rejected") ? "cancelled" : "done";
    return `<article class="bkcard">
      <div class="bkcard__tap" data-open="${b.id}">
        <div class="bkcard__top"><div><div class="bkcard__name">${esc(b.attendee_name || "—")}<span class="bkcard__badge badge-${cls}">${esc(s)}</span></div><div class="bkcard__svc">${esc(svcLabel(b))}</div></div>${b.price ? `<div class="bkcard__price">${money(b.price)}</div>` : ""}</div>
        <div class="bkcard__when">📅 ${esc(bkWhen(b))}${b.est_minutes ? ` · ⏱ ${b.est_minutes}m` : ""}</div>
        ${b.attendee_phone ? `<div class="bkcard__phone">📞 ${esc(b.attendee_phone)}</div>` : ""}
      </div>
      <div class="bkcard__btns"><button class="btn btn--ghost btn--xs" data-msg="${b.id}">💬 On my way</button><button class="btn btn--primary btn--xs" data-start="${b.id}">Start detail →</button></div>
    </article>`;
  }).join("");
}
bkList.addEventListener("click", (e) => {
  const m = e.target.dataset.msg, s = e.target.dataset.start;
  if (m) { const b = bookings.find((x) => x.id === m); if (b) messageCustomer(b, appSettings.messages?.on_my_way); return; }
  if (s) { const b = bookings.find((x) => x.id === s); if (b) openStartDetail(b); return; }
  const openId = e.target.closest("[data-open]")?.dataset.open;
  if (openId) { const b = bookings.find((x) => x.id === openId); if (b) openBookingSheet(b); }
});

function messageCustomer(b, template) {
  const first = (b.attendee_name || "").split(" ")[0] || "";
  const msg = (template || "On my way!").replace(/\{name\}/g, first);
  try { navigator.clipboard && navigator.clipboard.writeText(msg); } catch (e) {}
  const isiOS = /iPhone|iPad|iPod|Mac/.test(navigator.userAgent);
  const ph = phoneClean(b.attendee_phone || "");
  window.location.href = `sms:${ph}${isiOS ? "&" : "?"}body=${encodeURIComponent(msg)}`;
}

/* ----- Start Detail ----- */
const sdEl = document.getElementById("sd"), sdInner = document.getElementById("sdInner");
let sd = null;
function sopFor(service) { const s = sops.find((x) => x.service === service) || sops.find((x) => x.service === "interior"); return s ? s.steps : []; }
function elapsedStr() { if (!sd) return "0:00"; const s = Math.floor((Date.now() - sd.startTs) / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; }
function activeStepIndex() { return sd && sd.stepStates ? sd.stepStates.findIndex((s) => s.status === "active") : -1; }
function fmtMS(sec) { sec = Math.max(0, Math.floor(sec)); return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`; }
const RING_C = 2 * Math.PI * 52; // circumference of the timer ring
function updateActiveStep() {
  const el = document.getElementById("activeStep"); if (!el || !sd) return;
  const i = activeStepIndex(); if (i < 0) return;
  const st = sd.stepStates[i], target = +el.dataset.target || 0, elapsed = (Date.now() - st.startTs) / 1000;
  const te = document.getElementById("stepTime"), fg = document.getElementById("ringFg");
  if (te) te.textContent = fmtMS(elapsed);
  const frac = target ? Math.min(elapsed / target, 1) : 0;
  if (fg) fg.style.strokeDashoffset = RING_C * (1 - frac);
  const over = target && elapsed > target, warn = target && elapsed / target >= 0.8 && !over;
  el.classList.toggle("over", !!over); el.classList.toggle("warn", !!warn);
  const tg = el.querySelector(".wheel__target");
  if (tg && over) { tg.textContent = `${Math.floor((elapsed - target) / 60)}:${String(Math.floor((elapsed - target) % 60)).padStart(2, "0")} over`; tg.classList.add("over"); }
  if (over && !st.overNotified) { st.overNotified = true; if (navigator.vibrate) navigator.vibrate([120, 60, 120]); }
}

function openStartDetail(b) {
  sd = { booking: b, sop: sopFor(b.service), startTs: Date.now(), before: [], damage: [], after: [], checks: new Set(), stepStates: null, step: "before", timer: null };
  sdEl.classList.add("is-open"); sdEl.setAttribute("aria-hidden", "false"); renderSD();
  sd.timer = setInterval(() => { const t = document.getElementById("sdTimer"); if (t) t.textContent = elapsedStr(); updateActiveStep(); }, 1000);
}
function closeStartDetail() { if (sd && sd.timer) clearInterval(sd.timer); sd = null; sdEl.classList.remove("is-open"); sdEl.setAttribute("aria-hidden", "true"); }
function photoGrid(arr, kind) { return `<div class="photogrid">${arr.map((p) => `<img src="${p}" alt="">`).join("")}<label class="photoadd2">+<input type="file" accept="image/*" capture="environment" multiple hidden data-shot="${kind}"></label></div>`; }

function renderSD() {
  const b = sd.booking;
  if (sd.step === "before") {
    sdInner.innerHTML = `
      <div class="sd__top"><button class="sd__close" id="sdClose">✕ Cancel</button><div class="sd__timer" id="sdTimer">${elapsedStr()}</div></div>
      <div class="sd__hero"><h3>${esc(svcLabel(b))}</h3><p>${esc(b.attendee_name || "")}${b.est_minutes ? ` · est. ${b.est_minutes} min` : ""}${b.price ? ` · ${money(b.price)}` : ""}</p></div>
      <h4>Before photos</h4>${photoGrid(sd.before, "before")}
      <h4>Any damage? (document it)</h4>${photoGrid(sd.damage, "damage")}
      <div class="sd__bar"><button class="btn btn--primary" id="sdContinue">Continue →</button></div>`;
    document.getElementById("sdClose").onclick = () => { if (confirm("Cancel this detail?")) closeStartDetail(); };
    document.getElementById("sdContinue").onclick = () => { sd.step = "sop"; renderSD(); };
  } else if (sd.step === "sop") {
    const steps = sd.sop.length ? sd.sop : [{ label: "Detail the vehicle", minutes: 60 }];
    if (!sd.stepStates) { sd.stepStates = steps.map(() => ({ status: "pending", startTs: null, actualSec: 0 })); sd.stepStates[0].status = "active"; sd.stepStates[0].startTs = Date.now(); }
    const activeIdx = sd.stepStates.findIndex((s) => s.status === "active");
    const activeStep = activeIdx >= 0 ? steps[activeIdx] : null;
    const activeTarget = activeStep ? (activeStep.minutes || 0) * 60 : 0;
    const wheelHTML = activeStep ? `
      <div class="wheel" id="activeStep" data-target="${activeTarget}">
        <svg viewBox="0 0 120 120" class="wheel__svg"><circle class="wheel__bg" cx="60" cy="60" r="52"></circle><circle class="wheel__fg" id="ringFg" cx="60" cy="60" r="52"></circle></svg>
        <div class="wheel__c"><div class="wheel__task">${esc(activeStep.label)}</div><div class="wheel__time" id="stepTime">0:00</div><div class="wheel__target">${activeStep.minutes ? `target ${activeStep.minutes}m` : "no target"}</div></div>
      </div>
      <div class="wheel__meta"><span>Step ${activeIdx + 1} of ${steps.length}</span><button class="sopc__done" id="stepDone">Done ✓</button></div>`
      : `<div class="wheel__alldone">✓ All steps done — hit Finish below.</div>`;
    const listHTML = steps.map((s, i) => {
      const st = sd.stepStates[i], target = (s.minutes || 0) * 60;
      const cls = st.status === "done" ? "done" : st.status === "active" ? "active" : "pending";
      const cb = st.status === "done" ? "✓" : st.status === "active" ? "▶" : (i + 1);
      const right = st.status === "done" ? `<span class="sopc__time ${target && st.actualSec > target ? "over" : "good"}">${fmtMS(st.actualSec)}</span>` : `<span class="sopc__time">${s.minutes ? s.minutes + "m" : ""}</span>`;
      return `<div class="sopc mini ${cls}"><div class="sopc__cb">${cb}</div><div class="sopc__l">${esc(s.label)}</div>${right}</div>`;
    }).join("");
    sdInner.innerHTML = `
      <div class="sd__top"><button class="sd__close" id="sdBack">← Photos</button><div class="sd__timer" id="sdTimer">${elapsedStr()}</div></div>
      <div class="reminder">📸 Grab photos & videos as you go — content for the 'gram!</div>
      ${wheelHTML}
      <div class="soplist">${listHTML}</div>
      <h4>After photos</h4>${photoGrid(sd.after, "after")}
      <div class="sd__bar"><button class="btn btn--ghost" id="sdMsg">💬 Wrapping up</button><button class="btn btn--primary" id="sdFinish">Finish ✓</button></div>`;
    document.getElementById("sdBack").onclick = () => { sd.step = "before"; renderSD(); };
    const doneBtn = document.getElementById("stepDone");
    if (doneBtn) doneBtn.onclick = () => {
      const i = activeStepIndex(); const st = sd.stepStates[i];
      st.actualSec = (Date.now() - st.startTs) / 1000; st.status = "done";
      if (sd.stepStates[i + 1]) { sd.stepStates[i + 1].status = "active"; sd.stepStates[i + 1].startTs = Date.now(); }
      renderSD();
    };
    document.getElementById("sdMsg").onclick = () => messageCustomer(b, appSettings.messages?.wrapping_up);
    document.getElementById("sdFinish").onclick = () => { sd.endTs = Date.now(); if (sd.timer) clearInterval(sd.timer); sd.step = "done"; renderSD(); };
    updateActiveStep();
  } else if (sd.step === "done") {
    const mins = Math.round((sd.endTs - sd.startTs) / 60000), est = b.est_minutes || 0, diff = mins - est, charge = b.price || 0;
    sdInner.innerHTML = `<div class="finishcard"><h4>Detail complete</h4>
      <div class="big">${Math.floor(mins / 60)}h ${mins % 60}m</div><p style="color:var(--muted)">total time</p>
      <div style="max-width:340px;margin:1.2rem auto 0;text-align:left">
        <div class="finishrow"><span>Estimated</span><b>${est ? est + " min" : "—"}</b></div>
        <div class="finishrow"><span>Actual</span><b>${mins} min</b></div>
        ${est ? `<div class="finishrow"><span>vs estimate</span><b class="${diff > 0 ? "over" : "under"}">${diff > 0 ? "+" : ""}${diff} min</b></div>` : ""}
      </div>
      <h4 style="margin-top:1.4rem">Collect payment</h4>
      <div class="paycollect">
        <label class="fld"><span>Amount</span><input type="number" id="fcAmt" value="${charge}" min="0"></label>
        <label class="fld"><span>Tip</span><input type="number" id="fcTip" placeholder="0" min="0"></label>
        <label class="fld"><span>Method</span><select id="fcMethod">${["Cash", "Venmo", "Zelle", "Cash App", "Check", "Card"].map((x) => `<option>${x}</option>`).join("")}</select></label>
      </div>
      <button class="btn btn--primary" id="sdPaid" style="margin-top:.8rem">Mark paid &amp; finish</button>
      ${(sd.before[0] && sd.after[0]) ? `<button class="btn btn--ghost" id="sdStory" style="margin-top:.6rem">📸 Make before/after story</button>` : ""}
      <button class="btn btn--ghost" id="sdInvoice" style="margin-top:.6rem">🧾 Make invoice</button>
      <button class="btn btn--ghost" id="sdReview" style="margin-top:.6rem">⭐ Request a review</button>
      <button class="btn btn--ghost" id="sdCloseDone" style="margin-top:.6rem">Finish without payment</button></div>`;
    document.getElementById("sdInvoice")?.addEventListener("click", async () => { const c = clients.find((x) => x.id === b.client_id); const synth = { charge_amount: charge, duration_seconds: Math.round((sd.endTs - sd.startTs) / 1000), before_photos: sd.before, after_photos: sd.after }; try { await shareInvoice(synth, c, b); } catch (e) {} });
    document.getElementById("sdStory")?.addEventListener("click", async (e) => { const btn = e.target; btn.textContent = "Building…"; try { const url = await makeBeforeAfter(sd.before[0], sd.after[0], { sub: b.attendee_name || "" }); await shareTemplate(url, b.attendee_name); } catch (er) {} btn.textContent = "📸 Make before/after story"; });
    document.getElementById("sdReview")?.addEventListener("click", () => requestReview(b));
    document.getElementById("sdCloseDone").onclick = async () => { await saveJob(null); closeStartDetail(); };
    document.getElementById("sdPaid").onclick = async () => { await saveJob({ amount: parseFloat(document.getElementById("fcAmt").value) || 0, tip: parseFloat(document.getElementById("fcTip").value) || 0, method: document.getElementById("fcMethod").value }); closeStartDetail(); };
  }
}
sdEl.addEventListener("change", async (e) => {
  const kind = e.target.dataset.shot; if (!kind || !sd) return;
  for (const f of e.target.files) { sd[kind].push(await fileToDataURL(f)); }
  renderSD();
});
async function saveJob(payment) {
  const b = sd.booking;
  const charge = payment ? (Number(payment.amount) || 0) + (Number(payment.tip) || 0) : (b.price || null);
  await sb.from("jobs").insert({ booking_id: b.id, client_id: b.client_id, started_at: new Date(sd.startTs).toISOString(), finished_at: new Date(sd.endTs).toISOString(), duration_seconds: Math.round((sd.endTs - sd.startTs) / 1000), est_minutes: b.est_minutes, before_photos: sd.before, after_photos: sd.after, damage_photos: sd.damage, checklist: { done: [...sd.checks] }, charge_amount: charge, status: "done" });
  await sb.from("bookings").update({ status: "done" }).eq("id", b.id);
  if (payment && b.client_id && (payment.amount || payment.tip)) {
    const c = clients.find((x) => x.id === b.client_id);
    const today = new Date().toISOString().slice(0, 10);
    const payments = ((c && c.payments) || []).concat([{ amount: Number(payment.amount) || 0, tip: Number(payment.tip) || 0, method: payment.method || "Cash", date: today }]);
    await sb.from("clients").update({ payments, last_seen: today }).eq("id", b.client_id);
  }
  await loadExtras(); await loadAll(); render(); renderBookings();
}

/* ----- Settings ----- */
const settingsBody = document.getElementById("settingsBody");
function syncSopDOM() {
  ["interior", "exterior", "bundle"].forEach((svc) => {
    const cont = settingsBody.querySelector(`[data-sop="${svc}"]`); if (!cont) return;
    const steps = []; cont.querySelectorAll(".sopedit-step").forEach((row) => steps.push({ label: row.querySelector("input[type=text]").value, minutes: Number(row.querySelector("input[type=number]").value) || 0 }));
    let so = sops.find((x) => x.service === svc); if (so) so.steps = steps; else sops.push({ service: svc, tier: "all", steps });
  });
}
function openAcc(svc) { const el = [...settingsBody.querySelectorAll("details.acc")].find((d) => d.querySelector(`[data-sop="${svc}"]`)); if (el) el.open = true; }
function renderSettings() {
  const m = appSettings.messages || {};
  const sizes = ["sedan", "suv", "xl"], tiers = ["basic", "premium", "maintenance"];
  const priceCard = (svc) => {
    const body = tiers.map((tier) => `<tr><th>${cap(tier)}</th>${sizes.map((size) => { const s = services.find((x) => x.service === svc && x.tier === tier && x.size === size); return s ? `<td><input type="number" class="pcell" data-price="${s.id}" value="${s.price}"><input type="number" class="pmin" data-est="${s.id}" value="${s.est_minutes}"></td>` : "<td></td>"; }).join("")}</tr>`).join("");
    return `<details class="acc"><summary>${cap(svc)}</summary><div class="acc__body"><div class="pmatrix-wrap"><table class="pmatrix"><thead><tr><th></th><th>Sedan</th><th>SUV</th><th>XL</th></tr></thead><tbody>${body}</tbody></table></div><p class="set-hint">Big = price $ · small = est. minutes</p></div></details>`;
  };
  const sopCard = (svc) => {
    const so = sops.find((x) => x.service === svc); const steps = so ? so.steps : [];
    const rows = steps.map((st, i) => `<div class="sopedit-step"><span class="sop-num">${i + 1}</span><input type="text" value="${esc(st.label)}"><input type="number" value="${st.minutes || 0}"><button class="sop-mv" data-up="${svc}:${i}">↑</button><button class="sop-mv" data-down="${svc}:${i}">↓</button><button data-del="${svc}:${i}">✕</button></div>`).join("");
    return `<details class="acc"><summary>${cap(svc)} <span class="acc__count">${steps.length} steps</span></summary><div class="acc__body" data-sop="${svc}">${rows}<button class="btn btn--ghost btn--xs" data-addstep="${svc}">+ Add step</button></div></details>`;
  };
  settingsBody.innerHTML = `
    <details class="acc" open><summary>Appearance</summary><div class="acc__body">
      <p class="set-hint" style="margin-top:0">Accent color — recolors buttons, the timer, and highlights.</p>
      <div class="swatches">${THEME_PRESETS.map((t) => `<button class="swatch${appSettings.theme && appSettings.theme.a === t.a ? " is-sel" : ""}" data-theme="${t.a}|${t.b}" style="background:linear-gradient(135deg,${t.a},${t.b})" title="${t.name}"></button>`).join("")}</div>
      <label class="fld" style="margin-top:.8rem"><span>Custom color</span><input type="color" id="customColor" class="colorpick" value="${(appSettings.theme && appSettings.theme.a) || "#2b8bff"}"></label>
    </div></details>
    <details class="acc"><summary>Messages</summary><div class="acc__body">
      <label class="fld"><span>“On my way” text</span><textarea id="msgOnWay">${esc(m.on_my_way || "")}</textarea></label>
      <label class="fld" style="margin-top:.6rem"><span>“Wrapping up” text</span><textarea id="msgWrap">${esc(m.wrapping_up || "")}</textarea></label>
      <p class="set-hint">Tip: type {name} to auto-insert the customer's first name.</p>
      <button class="btn btn--primary btn--xs" id="saveMsgs">Save messages</button><span class="saved" id="savedMsgs" hidden>Saved ✓</span></div></details>
    <details class="acc"><summary>Review request</summary><div class="acc__body">
      <label class="fld"><span>Review message</span><textarea id="revMsg">${esc((appSettings.review && appSettings.review.message) || "Thanks for choosing Euro Detailing! 🚗✨ We'd really appreciate a quick review: {link}")}</textarea></label>
      <label class="fld" style="margin-top:.6rem"><span>Review link (Google, etc.)</span><input id="revLink" value="${esc((appSettings.review && appSettings.review.link) || "")}" placeholder="https://g.page/your-business"></label>
      <p class="set-hint">{link} inserts your link · {name} the customer's first name.</p>
      <button class="btn btn--primary btn--xs" id="saveRev">Save</button><span class="saved" id="savedRev" hidden>Saved ✓</span></div></details>
    <div class="set-group"><div class="set-group__t">Prices &amp; times</div>${["interior", "exterior", "bundle"].map(priceCard).join("")}<button class="btn btn--primary btn--xs" id="savePrices">Save all prices</button><span class="saved" id="savedPrices" hidden>Saved ✓</span></div>
    <div class="set-group"><div class="set-group__t">SOP checklists</div>${["interior", "exterior", "bundle"].map(sopCard).join("")}<button class="btn btn--primary btn--xs" id="saveSops">Save all SOPs</button><span class="saved" id="savedSops" hidden>Saved ✓</span></div>
    <details class="acc"><summary>Account</summary><div class="acc__body"><button class="btn btn--ghost btn--xs" id="signOut">Sign out</button></div></details>`;
  settingsBody.querySelectorAll("[data-theme]").forEach((b) => b.onclick = async () => { const [a, bb] = b.dataset.theme.split("|"); await saveTheme({ a, b: bb }); renderSettings(); });
  const _cc = document.getElementById("customColor");
  if (_cc) { _cc.addEventListener("input", (e) => applyTheme({ a: e.target.value, b: darken(e.target.value) })); _cc.addEventListener("change", (e) => saveTheme({ a: e.target.value, b: darken(e.target.value) })); }
  document.getElementById("saveMsgs").onclick = async () => { appSettings.messages = { on_my_way: document.getElementById("msgOnWay").value, wrapping_up: document.getElementById("msgWrap").value }; await sb.from("settings").update({ data: appSettings }).eq("owner", ownerId); flash("savedMsgs"); };
  document.getElementById("saveRev").onclick = async () => { appSettings.review = { message: document.getElementById("revMsg").value, link: document.getElementById("revLink").value }; await sb.from("settings").update({ data: appSettings }).eq("owner", ownerId); flash("savedRev"); };
  document.getElementById("savePrices").onclick = async () => { await Promise.all(services.map((s) => { const pe = settingsBody.querySelector(`[data-price="${s.id}"]`), ee = settingsBody.querySelector(`[data-est="${s.id}"]`); return pe ? sb.from("services").update({ price: Number(pe.value), est_minutes: Number(ee.value) }).eq("id", s.id) : null; }).filter(Boolean)); await loadExtras(); flash("savedPrices"); };
  document.getElementById("saveSops").onclick = async () => { syncSopDOM(); for (const so of sops) { if (so.id) await sb.from("sops").update({ steps: so.steps }).eq("id", so.id); else await sb.from("sops").insert({ service: so.service, tier: "all", steps: so.steps }); } await loadExtras(); renderSettings(); flash("savedSops"); };
  settingsBody.querySelectorAll("[data-addstep]").forEach((btn) => btn.onclick = () => { syncSopDOM(); const svc = btn.dataset.addstep; let so = sops.find((x) => x.service === svc); if (so) so.steps.push({ label: "New step", minutes: 5 }); else sops.push({ service: svc, tier: "all", steps: [{ label: "New step", minutes: 5 }] }); renderSettings(); openAcc(svc); });
  settingsBody.querySelectorAll("[data-del]").forEach((btn) => btn.onclick = () => { syncSopDOM(); const [svc, i] = btn.dataset.del.split(":"); const so = sops.find((x) => x.service === svc); if (so) { so.steps.splice(+i, 1); renderSettings(); openAcc(svc); } });
  settingsBody.querySelectorAll("[data-up]").forEach((btn) => btn.onclick = () => { syncSopDOM(); const [svc, i] = btn.dataset.up.split(":"); const so = sops.find((x) => x.service === svc); const j = +i; if (so && j > 0) { [so.steps[j - 1], so.steps[j]] = [so.steps[j], so.steps[j - 1]]; renderSettings(); openAcc(svc); } });
  settingsBody.querySelectorAll("[data-down]").forEach((btn) => btn.onclick = () => { syncSopDOM(); const [svc, i] = btn.dataset.down.split(":"); const so = sops.find((x) => x.service === svc); const j = +i; if (so && j < so.steps.length - 1) { [so.steps[j + 1], so.steps[j]] = [so.steps[j], so.steps[j + 1]]; renderSettings(); openAcc(svc); } });
  document.getElementById("signOut").onclick = async () => { await sb.auth.signOut(); location.reload(); };
}
function flash(id) { const el = document.getElementById(id); if (el) { el.hidden = false; setTimeout(() => (el.hidden = true), 1500); } }

/* realtime for bookings + nav render hooks */
let bkChannel = null;
function subscribeBookings() { if (bkChannel) return; bkChannel = sb.channel("bk-rt").on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, async () => { await loadExtras(); renderBookings(); render(); }).subscribe(); }
document.querySelectorAll(".nav__item").forEach((btn) => btn.addEventListener("click", () => { const v = btn.dataset.view; if (v === "bookings") renderBookings(); if (v === "settings") renderSettings(); }));

/* =================== Analytics, history, manual bookings =================== */
function barChart(items) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return `<div class="bars">${items.map((it) => `<div class="bar"><div class="bar__v">${it.value ? "$" + Math.round(it.value) : ""}</div><div class="bar__col"><div class="bar__fill" style="height:${it.value ? Math.max(4, it.value / max * 100) : 0}%"></div></div><div class="bar__x">${esc(it.label)}</div></div>`).join("")}</div>`;
}
function renderAnalytics() {
  const el = document.getElementById("analyticsBody"); if (!el) return;
  const now = new Date();
  const pays = clients.flatMap((c) => (c.payments || []).map((p) => ({ amount: (Number(p.amount) || 0) + (Number(p.tip) || 0), date: p.date || "" })));
  const sum = (a) => a.reduce((s, p) => s + p.amount, 0);
  const exp = expenses || [];
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const expTotal = exp.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const revAll = sum(pays), profit = revAll - expTotal;
  const weeks = [];
  for (let w = 7; w >= 0; w--) {
    const start = new Date(now); start.setDate(now.getDate() - now.getDay() - w * 7); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setDate(start.getDate() + 7);
    weeks.push({ label: w === 0 ? "Now" : `${start.getMonth() + 1}/${start.getDate()}`, value: sum(pays.filter((p) => { const d = new Date(p.date); return d >= start && d < end; })) });
  }
  const top = clients.map((c) => ({ name: c.name, total: total(c) })).filter((c) => c.total > 0).sort((a, b) => b.total - a.total).slice(0, 5);
  const js = jobs || [];
  const avgActual = js.length ? js.reduce((s, j) => s + (j.duration_seconds || 0), 0) / js.length / 60 : 0;
  const withEst = js.filter((j) => j.est_minutes);
  const avgEst = withEst.length ? withEst.reduce((s, j) => s + j.est_minutes, 0) / withEst.length : 0;
  const onTime = withEst.length ? Math.round(withEst.filter((j) => (j.duration_seconds / 60) <= j.est_minutes).length / withEst.length * 100) : 0;
  const repeat = clients.length ? Math.round(clients.filter((c) => (c.payments || []).length >= 2).length / clients.length * 100) : 0;
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], dayCounts = [0, 0, 0, 0, 0, 0, 0];
  bookings.forEach((b) => { if (b.scheduled_at) dayCounts[new Date(b.scheduled_at).getDay()]++; });
  const busiest = Math.max(...dayCounts) > 0 ? dayNames[dayCounts.indexOf(Math.max(...dayCounts))] : "—";
  const weekRev = sum(pays.filter((p) => new Date(p.date) >= new Date(Date.now() - 7 * 864e5)));
  el.innerHTML = `
    <header class="head"><h2>Stats</h2></header>
    <div class="dstats" style="margin-bottom:1.1rem"><div class="dstat"><span class="dstat__l">This week</span><span class="dstat__v good">${money(weekRev)}</span></div><div class="dstat"><span class="dstat__l">Details</span><span class="dstat__v">${js.length}</span></div><div class="dstat"><span class="dstat__l">All-time</span><span class="dstat__v good">${money(sum(pays))}</span></div></div>
    <div class="panel"><h3>Revenue — last 8 weeks</h3>${barChart(weeks)}</div>
    <div class="panel" style="margin-top:1rem"><h3>Top clients</h3>${top.length ? top.map((c, i) => `<div class="recent__row"><b>${i + 1}. ${esc(c.name)}</b><span class="good" style="font-weight:700">${money(c.total)}</span></div>`).join("") : `<div class="recent__row">No payments yet.</div>`}</div>
    <div class="anl-grid">
      <div class="anl-card"><div class="anl-card__v">${onTime}%</div><div class="anl-card__l">On-time rate</div></div>
      <div class="anl-card"><div class="anl-card__v">${repeat}%</div><div class="anl-card__l">Repeat clients</div></div>
      <div class="anl-card"><div class="anl-card__v">${Math.round(avgActual) || 0}m</div><div class="anl-card__l">Avg job${avgEst ? ` (est ${Math.round(avgEst)}m)` : ""}</div></div>
      <div class="anl-card"><div class="anl-card__v">${busiest}</div><div class="anl-card__l">Busiest day</div></div>
    </div>
    <div class="dash__sec-t">Profit</div>
    <div class="dstats"><div class="dstat"><span class="dstat__l">Revenue</span><span class="dstat__v good">${money(revAll)}</span></div><div class="dstat"><span class="dstat__l">Expenses</span><span class="dstat__v" style="color:var(--danger)">${money(expTotal)}</span></div><div class="dstat"><span class="dstat__l">Profit</span><span class="dstat__v ${profit >= 0 ? "good" : ""}" ${profit < 0 ? 'style="color:var(--danger)"' : ""}>${money(profit)}</span></div></div>
    <div class="panel" style="margin-top:1rem"><h3>Expenses</h3>
      <div class="expadd"><input type="number" id="expAmt" placeholder="Amount" min="0"><input type="text" id="expCat" placeholder="What for? (supplies, gas…)"><button class="btn btn--primary btn--xs" id="expAdd">Add</button></div>
      <div class="explist">${exp.length ? exp.slice(0, 12).map((e) => `<div class="recent__row"><b>${esc(e.category || "Expense")}</b><span><span style="color:var(--danger)">${money(e.amount)}</span> <button class="pay__b pay__del" data-exp="${e.id}">✕</button></span></div>`).join("") : `<div class="recent__row">No expenses logged.</div>`}</div>
    </div>`;
  el.querySelector("#expAdd")?.addEventListener("click", async () => { const a = parseFloat(el.querySelector("#expAmt").value); if (!a || a <= 0) return; await addExpense(a, el.querySelector("#expCat").value.trim()); });
  el.querySelectorAll("[data-exp]").forEach((b) => b.addEventListener("click", () => delExpense(b.dataset.exp)));
}

function clientHistoryHTML(c) {
  const cb = (bookings || []).filter((x) => x.client_id === c.id).sort((a, b) => new Date(b.scheduled_at || 0) - new Date(a.scheduled_at || 0));
  const cj = (jobs || []).filter((x) => x.client_id === c.id);
  let html = "";
  if (cb.length) {
    html += `<div class="dsec"><div class="dsec__h"><h4>Booking history</h4></div><div class="histlist">${cb.map((bk) => { const s = (bk.status || "").toLowerCase(); const cls = s === "done" ? "done" : (s === "cancelled" || s === "rejected") ? "cancelled" : s === "pending" ? "pending" : "accepted"; return `<div class="hist-row"><span class="hist-when">${esc(bkWhen(bk) || "—")}</span><span class="hist-svc">${esc(svcLabel(bk))}</span><span class="bkcard__badge badge-${cls}">${esc(s)}</span></div>`; }).join("")}</div></div>`;
  }
  const ba = cj.filter((j) => (j.before_photos && j.before_photos.length) || (j.after_photos && j.after_photos.length));
  if (ba.length) {
    html += `<div class="dsec"><div class="dsec__h"><h4>Before / after</h4></div>${ba.map((j) => { const bf = (j.before_photos || [])[0], af = (j.after_photos || [])[0]; return `<div class="ba"><div class="ba__pair">${bf ? `<figure class="ba__f"><img src="${bf}" alt=""><figcaption>Before</figcaption></figure>` : ""}${af ? `<figure class="ba__f"><img src="${af}" alt=""><figcaption>After</figcaption></figure>` : ""}</div>${j.finished_at ? `<div class="ba__date">${new Date(j.finished_at).toLocaleDateString()} · ${Math.round((j.duration_seconds || 0) / 60)}m · ${money(j.charge_amount || 0)}</div>` : ""}<button class="btn btn--ghost btn--xs ba__share" data-ba="${j.id}">📸 Story</button><button class="btn btn--ghost btn--xs ba__invoice" data-inv="${j.id}">🧾 Invoice</button></div>`; }).join("")}</div>`;
  }
  return html;
}

/* ----- Manual booking ----- */
const bkModal = document.getElementById("bkModal"), bkForm = document.getElementById("bkForm");
const bkName = document.getElementById("bkName"), bkPhone = document.getElementById("bkPhone"), bkService = document.getElementById("bkService"),
  bkTier = document.getElementById("bkTier"), bkSize = document.getElementById("bkSize"), bkVehicle = document.getElementById("bkVehicle"),
  bkDate = document.getElementById("bkDate"), bkTime = document.getElementById("bkTime"), bkPriceEl = document.getElementById("bkPrice");
function priceFor(service, tier, size) { return services.find((x) => x.service === service && x.tier === tier && x.size === size) || { price: null, est_minutes: null }; }
function updateBkPrice() { const s = priceFor(bkService.value, bkTier.value, bkSize.value); bkPriceEl.textContent = s.price ? `Price: ${money(s.price)} · est. ${s.est_minutes}m` : "Price: —"; }
[bkService, bkTier, bkSize].forEach((el) => el.addEventListener("change", updateBkPrice));
document.getElementById("addBkBtn").addEventListener("click", () => { bkForm.reset(); bkDate.value = new Date().toISOString().slice(0, 10); bkTime.value = "09:00"; updateBkPrice(); bkModal.classList.add("is-open"); setTimeout(() => bkName.focus(), 50); });
bkModal.querySelectorAll("[data-bkclose]").forEach((el) => el.onclick = () => bkModal.classList.remove("is-open"));
bkForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = bkName.value.trim(); if (!name) return;
  const svc = bkService.value, tier = bkTier.value, size = bkSize.value, pr = priceFor(svc, tier, size);
  const when = bkDate.value ? new Date(`${bkDate.value}T${bkTime.value || "09:00"}`).toISOString() : null;
  let client_id = null; const ph = (bkPhone.value || "").replace(/[^0-9]/g, "");
  if (ph.length >= 7) { const c = clients.find((x) => (x.phone || "").replace(/[^0-9]/g, "").slice(-10) === ph.slice(-10)); if (c) client_id = c.id; }
  if (!client_id) { const { data } = await sb.from("clients").insert({ name, phone: bkPhone.value || null, vehicle: bkVehicle.value || null }).select("id").single(); client_id = data ? data.id : null; }
  await sb.from("bookings").insert({ client_id, source: "manual", attendee_name: name, attendee_phone: bkPhone.value || null, service: svc, tier, size, price: pr.price, est_minutes: pr.est_minutes, scheduled_at: when, status: "upcoming", title: `${cap(svc)} ${tier}` });
  bkModal.classList.remove("is-open"); await loadExtras(); await loadAll(); render(); renderBookings();
});

/* analytics nav hook */
document.querySelectorAll(".nav__item").forEach((btn) => btn.addEventListener("click", () => { if (btn.dataset.view === "analytics") renderAnalytics(); }));

/* =================== Theme + before/after templates =================== */
const THEME_PRESETS = [
  { name: "Blue", a: "#2b8bff", b: "#1560d0" },
  { name: "Cyan", a: "#22d3ee", b: "#0891b2" },
  { name: "Violet", a: "#a855f7", b: "#7c3aed" },
  { name: "Green", a: "#22c55e", b: "#15803d" },
  { name: "Orange", a: "#ff9838", b: "#f97316" },
  { name: "Red", a: "#ff5c72", b: "#e11d48" },
  { name: "Pink", a: "#ec4899", b: "#be185d" },
  { name: "Gold", a: "#f5c542", b: "#d4a017" },
];
function darken(hex, amt = 0.25) {
  const n = parseInt(hex.replace("#", ""), 16); let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  r = Math.round(r * (1 - amt)); g = Math.round(g * (1 - amt)); b = Math.round(b * (1 - amt));
  return "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");
}
function applyTheme(t) {
  if (!t || !t.a) return;
  const r = document.documentElement.style;
  r.setProperty("--blue-1", t.a); r.setProperty("--blue-2", t.b || darken(t.a));
  const meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.setAttribute("content", "#08090c");
  try { localStorage.setItem("ed.theme", JSON.stringify(t)); } catch (e) {}
}
async function saveTheme(t) { applyTheme(t); appSettings.theme = t; if (ownerId) await sb.from("settings").update({ data: appSettings }).eq("owner", ownerId); }
try { const _t = JSON.parse(localStorage.getItem("ed.theme")); if (_t) applyTheme(_t); } catch (e) {}

function loadImg(src) { return new Promise((res, rej) => { const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => res(i); i.onerror = rej; i.src = src; }); }
async function makeBeforeAfter(beforeSrc, afterSrc, opts = {}) {
  const W = 1080, H = 1080, half = W / 2;
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const ctx = cv.getContext("2d");
  ctx.fillStyle = "#08090c"; ctx.fillRect(0, 0, W, H);
  const cover = (img, dx, dy, dw, dh) => { const ar = img.width / img.height, tar = dw / dh; let sw, sh, sx, sy; if (ar > tar) { sh = img.height; sw = sh * tar; sx = (img.width - sw) / 2; sy = 0; } else { sw = img.width; sh = sw / tar; sx = 0; sy = (img.height - sh) / 2; } ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh); };
  try { if (beforeSrc) cover(await loadImg(beforeSrc), 0, 0, half, H); } catch (e) {}
  try { if (afterSrc) cover(await loadImg(afterSrc), half, 0, half, H); } catch (e) {}
  ctx.fillStyle = "#fff"; ctx.fillRect(half - 2, 0, 4, H);
  ctx.textAlign = "center"; ctx.font = "bold 46px 'Segoe UI',system-ui,sans-serif";
  const tag = (txt, cx) => { const w = ctx.measureText(txt).width + 46; ctx.fillStyle = "rgba(0,0,0,.6)"; ctx.fillRect(cx - w / 2, H - 116, w, 70); ctx.fillStyle = "#fff"; ctx.fillText(txt, cx, H - 68); };
  tag("BEFORE", half / 2); tag("AFTER", half + half / 2);
  const accent = (getComputedStyle(document.documentElement).getPropertyValue("--blue-1") || "#2b8bff").trim();
  const grd = ctx.createLinearGradient(0, 0, 0, 140); grd.addColorStop(0, "rgba(8,9,12,.9)"); grd.addColorStop(1, "rgba(8,9,12,0)");
  ctx.fillStyle = grd; ctx.fillRect(0, 0, W, 140);
  try { const logo = await loadImg("assets/logo.png"); ctx.drawImage(logo, 28, 20, 88, 88); } catch (e) {}
  ctx.textAlign = "left"; ctx.fillStyle = "#fff"; ctx.font = "bold 42px 'Segoe UI',system-ui,sans-serif"; ctx.fillText("EURO DETAILING", 132, 76);
  if (opts.sub) { ctx.textAlign = "right"; ctx.fillStyle = accent; ctx.font = "600 28px 'Segoe UI',system-ui,sans-serif"; ctx.fillText(opts.sub, W - 28, 74); }
  return cv.toDataURL("image/jpeg", 0.92);
}
async function shareTemplate(dataURL, name) {
  try {
    const blob = await (await fetch(dataURL)).blob();
    const file = new File([blob], `euro-detailing-${(name || "before-after").replace(/\s+/g, "-")}.jpg`, { type: "image/jpeg" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: "Euro Detailing" }); return; }
  } catch (e) {}
  const a = document.createElement("a"); a.href = dataURL; a.download = "euro-detailing-before-after.jpg"; a.click();
}

/* =================== Booking sheet, expenses, reviews =================== */
function opts2(arr, cur) { return arr.map((o) => `<option value="${o}" ${o === cur ? "selected" : ""}>${cap(o)}</option>`).join(""); }
function openBookingSheet(b) {
  const wrap = document.createElement("div"); wrap.className = "modal is-open";
  const dt = b.scheduled_at ? new Date(b.scheduled_at) : null;
  const dval = dt ? dt.toISOString().slice(0, 10) : "";
  const tval = dt ? `${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}` : "";
  wrap.innerHTML = `<div class="modal__backdrop" data-x></div><form class="modal__card">
    <h3>Booking details</h3>
    <div class="grid2">
      <label class="fld"><span>Name</span><input id="bsName" value="${esc(b.attendee_name || "")}"></label>
      <label class="fld"><span>Phone</span><input id="bsPhone" value="${esc(b.attendee_phone || "")}"></label>
      <label class="fld"><span>Service</span><select id="bsService">${opts2(["interior", "exterior", "bundle"], b.service || "interior")}</select></label>
      <label class="fld"><span>Tier</span><select id="bsTier">${opts2(["basic", "premium", "maintenance"], b.tier || "basic")}</select></label>
      <label class="fld"><span>Size</span><select id="bsSize">${opts2(["sedan", "suv", "xl"], b.size || "sedan")}</select></label>
      <label class="fld"><span>Status</span><select id="bsStatus">${opts2(["upcoming", "accepted", "pending", "done", "cancelled"], b.status || "upcoming")}</select></label>
      <label class="fld"><span>Date</span><input id="bsDate" type="date" value="${dval}"></label>
      <label class="fld"><span>Time</span><input id="bsTime" type="time" value="${tval}"></label>
    </div>
    <div class="bk-price" id="bsPrice">—</div>
    <div class="sheet-actions"><button type="button" class="btn btn--primary btn--xs" id="bsStart">▶ Start detail</button><button type="button" class="btn btn--ghost btn--xs" id="bsMsg">💬 Message</button></div>
    <div class="modal__actions"><button type="button" class="btn btn--danger btn--xs" id="bsDelete">Delete</button><button type="button" class="btn btn--ghost btn--xs" data-x>Close</button><button type="submit" class="btn btn--primary btn--xs">Save</button></div>
  </form>`;
  document.body.appendChild(wrap);
  const close = () => wrap.remove();
  wrap.querySelectorAll("[data-x]").forEach((el) => el.onclick = close);
  const upd = () => { const s = priceFor(wrap.querySelector("#bsService").value, wrap.querySelector("#bsTier").value, wrap.querySelector("#bsSize").value); wrap.querySelector("#bsPrice").textContent = s.price ? `${money(s.price)} · est. ${s.est_minutes}m` : "—"; };
  ["#bsService", "#bsTier", "#bsSize"].forEach((sel) => wrap.querySelector(sel).addEventListener("change", upd)); upd();
  wrap.querySelector("#bsStart").onclick = () => { close(); openStartDetail(b); };
  wrap.querySelector("#bsMsg").onclick = () => messageCustomer(b, appSettings.messages?.on_my_way);
  wrap.querySelector("#bsDelete").onclick = async () => { if (confirm("Delete this booking? It won't re-sync from Cal.")) { if (b.cal_uid) await sb.from("suppressed").upsert([{ owner: ownerId, cal_uid: b.cal_uid }], { onConflict: "owner,cal_uid" }); await sb.from("bookings").delete().eq("id", b.id); close(); await loadExtras(); renderBookings(); render(); } };
  wrap.querySelector("form").onsubmit = async (e) => {
    e.preventDefault();
    const svc = wrap.querySelector("#bsService").value, tier = wrap.querySelector("#bsTier").value, size = wrap.querySelector("#bsSize").value, pr = priceFor(svc, tier, size);
    const d = wrap.querySelector("#bsDate").value, t = wrap.querySelector("#bsTime").value;
    const when = d ? new Date(`${d}T${t || "09:00"}`).toISOString() : b.scheduled_at;
    await sb.from("bookings").update({ attendee_name: wrap.querySelector("#bsName").value, attendee_phone: wrap.querySelector("#bsPhone").value, service: svc, tier, size, price: pr.price, est_minutes: pr.est_minutes, status: wrap.querySelector("#bsStatus").value, scheduled_at: when }).eq("id", b.id);
    close(); await loadExtras(); renderBookings(); render();
  };
}

async function addExpense(amount, category, date) { if (!amount) return; await sb.from("expenses").insert({ amount: Number(amount), category: category || null, spent_at: date || new Date().toISOString().slice(0, 10) }); await loadExtras(); renderAnalytics(); }
async function delExpense(id) { await sb.from("expenses").delete().eq("id", id); await loadExtras(); renderAnalytics(); }

function requestReview(b) {
  const r = appSettings.review || {};
  let msg = r.message || "Thanks for choosing Euro Detailing! 🚗✨ We'd really appreciate a quick review: {link}";
  msg = msg.replace(/\{link\}/g, r.link || "").replace(/\{name\}/g, (b.attendee_name || b.name || "").split(" ")[0]);
  try { navigator.clipboard && navigator.clipboard.writeText(msg); } catch (e) {}
  const iOS = /iPhone|iPad|iPod|Mac/.test(navigator.userAgent);
  const ph = (b.attendee_phone || b.phone || "").replace(/[^0-9+]/g, "");
  window.location.href = `sms:${ph}${iOS ? "&" : "?"}body=${encodeURIComponent(msg)}`;
}

/* =================== Vehicles, search, invoices, week view =================== */
function navTo(view) { const btn = [...document.querySelectorAll(".nav__item")].find((b) => b.dataset.view === view); if (btn) btn.click(); }

function vehiclesHTML(c) {
  const vs = (vehicles || []).filter((v) => v.client_id === c.id);
  return `<div class="dsec"><div class="dsec__h"><h4>Vehicles</h4><button class="btn btn--ghost btn--xs" data-addveh="${c.id}">+ Add car</button></div>
    ${vs.length ? vs.map((v) => `<div class="veh" data-veh="${v.id}"><div class="veh__main"><div class="veh__name">${esc([v.year, v.make, v.model].filter(Boolean).join(" ") || "Vehicle")}</div>${(v.color || v.plate) ? `<div class="veh__meta">${[v.color, v.plate].filter(Boolean).map(esc).join(" · ")}</div>` : ""}</div><button class="pay__b pay__del" data-delveh="${v.id}">✕</button></div>`).join("") : `<div class="veh-empty">No cars saved yet.</div>`}
  </div>`;
}
function openVehicleSheet(clientId, veh) {
  const wrap = document.createElement("div"); wrap.className = "modal is-open";
  wrap.innerHTML = `<div class="modal__backdrop" data-x></div><form class="modal__card"><h3>${veh ? "Edit" : "Add"} vehicle</h3>
    <div class="grid2">
      <label class="fld"><span>Year</span><input id="vY" inputmode="numeric" value="${esc(veh?.year || "")}"></label>
      <label class="fld"><span>Make</span><input id="vMk" value="${esc(veh?.make || "")}"></label>
      <label class="fld"><span>Model</span><input id="vMd" value="${esc(veh?.model || "")}"></label>
      <label class="fld"><span>Color</span><input id="vC" value="${esc(veh?.color || "")}"></label>
      <label class="fld"><span>Plate</span><input id="vP" value="${esc(veh?.plate || "")}"></label>
      <label class="fld"><span>VIN</span><input id="vV" value="${esc(veh?.vin || "")}"></label>
    </div>
    <label class="fld" style="margin-top:.5rem"><span>Notes</span><textarea id="vN">${esc(veh?.notes || "")}</textarea></label>
    <div class="modal__actions"><button type="button" class="btn btn--ghost btn--xs" data-x>Cancel</button><button type="submit" class="btn btn--primary btn--xs">Save</button></div></form>`;
  document.body.appendChild(wrap);
  const close = () => wrap.remove(); wrap.querySelectorAll("[data-x]").forEach((el) => el.onclick = close);
  wrap.querySelector("form").onsubmit = async (e) => {
    e.preventDefault();
    const g = (id) => wrap.querySelector("#" + id).value.trim() || null;
    const row = { client_id: clientId, year: g("vY"), make: g("vMk"), model: g("vMd"), color: g("vC"), plate: g("vP"), vin: g("vV"), notes: g("vN") };
    if (veh) await sb.from("vehicles").update(row).eq("id", veh.id); else await sb.from("vehicles").insert(row);
    close(); await loadExtras(); if (currentId) renderDetail();
  };
}

function openSearch() {
  const wrap = document.createElement("div"); wrap.className = "searchov";
  wrap.innerHTML = `<div class="searchov__bar"><input id="gsInput" placeholder="Search clients, bookings…"><button class="btn btn--ghost btn--xs" id="gsClose">Cancel</button></div><div class="searchov__res" id="gsRes"></div>`;
  document.body.appendChild(wrap);
  const inp = wrap.querySelector("#gsInput"), res = wrap.querySelector("#gsRes");
  const close = () => wrap.remove(); wrap.querySelector("#gsClose").onclick = close;
  inp.addEventListener("input", () => {
    const q = inp.value.trim().toLowerCase(); if (!q) { res.innerHTML = ""; return; }
    const cl = clients.filter((c) => [c.name, c.phone, c.email, c.vehicle].some((x) => (x || "").toLowerCase().includes(q))).slice(0, 8);
    const bk = bookings.filter((b) => [b.attendee_name, b.attendee_phone, b.service, b.tier].some((x) => (x || "").toLowerCase().includes(q))).slice(0, 8);
    res.innerHTML = (cl.length ? `<div class="gs-sec">Clients</div>` + cl.map((c) => `<div class="gs-row" data-c="${c.id}"><b>${esc(c.name)}</b><span>${esc(c.vehicle || c.phone || "")}</span></div>`).join("") : "") + (bk.length ? `<div class="gs-sec">Bookings</div>` + bk.map((b) => `<div class="gs-row" data-b="${b.id}"><b>${esc(b.attendee_name || "—")}</b><span>${esc(svcLabel(b))} · ${esc(bkWhen(b))}</span></div>`).join("") : "") || `<div class="gs-empty">No matches</div>`;
    res.querySelectorAll("[data-c]").forEach((r) => r.onclick = () => { close(); navTo("clients"); openDetail(r.dataset.c); });
    res.querySelectorAll("[data-b]").forEach((r) => r.onclick = () => { close(); const b = bookings.find((x) => x.id === r.dataset.b); if (b) openBookingSheet(b); });
  });
  setTimeout(() => inp.focus(), 60);
}

async function makeInvoice(job, client, booking) {
  const W = 1080, H = 1500, cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const ctx = cv.getContext("2d");
  ctx.fillStyle = "#0e1116"; ctx.fillRect(0, 0, W, H);
  const accent = (getComputedStyle(document.documentElement).getPropertyValue("--blue-1") || "#2b8bff").trim();
  const F = (s, w) => `${w || ""} ${s}px 'Segoe UI',system-ui,sans-serif`;
  try { const logo = await loadImg("assets/logo.png"); ctx.drawImage(logo, 60, 56, 108, 108); } catch (e) {}
  ctx.textAlign = "left"; ctx.fillStyle = "#fff"; ctx.font = F(50, "bold"); ctx.fillText("EURO DETAILING", 190, 116);
  ctx.font = F(26); ctx.fillStyle = "#9aa6b4"; ctx.fillText("Newton, MA · 781-290-3040", 190, 156);
  ctx.textAlign = "right"; ctx.fillStyle = accent; ctx.font = F(40, "bold"); ctx.fillText("INVOICE", W - 60, 108);
  ctx.fillStyle = "#9aa6b4"; ctx.font = F(24); ctx.fillText(new Date(job?.finished_at || booking?.scheduled_at || Date.now()).toLocaleDateString(), W - 60, 150);
  ctx.textAlign = "left"; ctx.fillStyle = "#9aa6b4"; ctx.font = F(22); ctx.fillText("BILL TO", 60, 280);
  ctx.fillStyle = "#fff"; ctx.font = F(34, "bold"); ctx.fillText(client?.name || booking?.attendee_name || "Customer", 60, 324);
  if (client?.phone || booking?.attendee_phone) { ctx.fillStyle = "#9aa6b4"; ctx.font = F(24); ctx.fillText(client?.phone || booking?.attendee_phone, 60, 360); }
  let y = 470; ctx.strokeStyle = "#2a2f4a"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(60, y - 44); ctx.lineTo(W - 60, y - 44); ctx.stroke();
  const svc = booking ? svcLabel(booking) : (job ? "Detail service" : "Detail");
  const amt = (job?.charge_amount) ?? (booking?.price) ?? 0;
  ctx.fillStyle = "#fff"; ctx.font = F(30, "bold"); ctx.fillText(svc, 60, y);
  ctx.textAlign = "right"; ctx.fillText(money(amt), W - 60, y); ctx.textAlign = "left";
  if (job?.duration_seconds) { ctx.fillStyle = "#9aa6b4"; ctx.font = F(22); ctx.fillText(`${Math.round(job.duration_seconds / 60)} min`, 60, y + 32); }
  y += 130; ctx.strokeStyle = accent; ctx.beginPath(); ctx.moveTo(60, y - 44); ctx.lineTo(W - 60, y - 44); ctx.stroke();
  ctx.fillStyle = "#fff"; ctx.font = F(38, "bold"); ctx.fillText("TOTAL", 60, y);
  ctx.textAlign = "right"; ctx.fillStyle = accent; ctx.font = F(50, "bold"); ctx.fillText(money(amt), W - 60, y); ctx.textAlign = "left";
  ctx.fillStyle = "#9aa6b4"; ctx.font = F(23); ctx.fillText("Thank you! Payments: Cash · Venmo · Zelle · Cash App · Check", 60, y + 64);
  const bf = job?.before_photos?.[0], af = job?.after_photos?.[0];
  if (bf || af) {
    const iy = y + 130, ih = 420, iw = (W - 140) / 2;
    const cover = (img, dx) => { const ar = img.width / img.height, tar = iw / ih; let sw, sh, sx, sy; if (ar > tar) { sh = img.height; sw = sh * tar; sx = (img.width - sw) / 2; sy = 0; } else { sw = img.width; sh = sw / tar; sx = 0; sy = (img.height - sh) / 2; } ctx.drawImage(img, sx, sy, sw, sh, dx, iy, iw, ih); };
    try { if (bf) cover(await loadImg(bf), 60); } catch (e) {}
    try { if (af) cover(await loadImg(af), 80 + iw); } catch (e) {}
  }
  return cv.toDataURL("image/jpeg", 0.92);
}
async function shareInvoice(job, client, booking) { const url = await makeInvoice(job, client, booking); await shareTemplate(url, (client?.name || "invoice") + "-invoice"); }

/* ----- Week calendar view ----- */
let weekOffset = 0;
function renderWeek() {
  bkEmpty.hidden = true;
  const now = new Date(), base = new Date(now);
  base.setDate(now.getDate() - now.getDay() + weekOffset * 7); base.setHours(0, 0, 0, 0);
  const days = []; for (let i = 0; i < 7; i++) { const d = new Date(base); d.setDate(base.getDate() + i); days.push(d); }
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const label = `${base.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${days[6].toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
  const todayStr = new Date().toDateString();
  bkList.innerHTML = `<div class="wknav"><button class="btn btn--ghost btn--xs" id="wkPrev">←</button><span>${weekOffset === 0 ? "This week" : label}</span><button class="btn btn--ghost btn--xs" id="wkNext">→</button></div>` +
    days.map((d, i) => {
      const ds = d.toDateString();
      const dayBk = bookings.filter((b) => b.scheduled_at && new Date(b.scheduled_at).toDateString() === ds && b.status !== "cancelled" && b.status !== "rejected").sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));
      return `<div class="wkday${ds === todayStr ? " is-today" : ""}"><div class="wkday__h">${dayNames[i]} ${d.getDate()}</div>${dayBk.length ? dayBk.map((b) => `<div class="wkbk" data-open="${b.id}"><span class="wkbk__t">${new Date(b.scheduled_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</span> <b>${esc(b.attendee_name || "—")}</b> · <span class="wkbk__s">${esc(svcLabel(b))}</span></div>`).join("") : `<div class="wkday__empty">—</div>`}</div>`;
    }).join("");
  document.getElementById("wkPrev").onclick = () => { weekOffset--; renderWeek(); };
  document.getElementById("wkNext").onclick = () => { weekOffset++; renderWeek(); };
}
document.getElementById("searchBtn")?.addEventListener("click", openSearch);
