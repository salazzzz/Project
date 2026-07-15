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
async function showApp(){ login.classList.remove("login--visible"); app.classList.add("app--visible"); await loadAll(); await loadExtras(); render(); renderBookings(); subscribeRealtime(); subscribeBookings(); syncCal(); }

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
const total=c=>(c.payments||[]).reduce((s,p)=>s+(Number(p.amount)||0),0);
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
  const pays=(c.payments&&c.payments.length)?c.payments.slice().sort((a,b)=>(b.date||"").localeCompare(a.date||"")).map(p=>{const i=c.payments.indexOf(p);return `<div class="pay" data-pi="${i}"><span>${fmtDate(p.date)}</span><span class="pay__r"><b>${money(p.amount)}</b><button class="pay__b" data-payedit="${i}">✎</button><button class="pay__b pay__del" data-paydel="${i}">✕</button></span></div>`;}).join(""):`<div class="pay"><span style="color:var(--muted)">No payments logged.</span></div>`;
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
      <div class="payadd"><input type="number" id="payAmt" placeholder="Amount" min="0" /><input type="date" id="payDate" value="${new Date().toISOString().slice(0,10)}" /><button class="btn btn--primary btn--xs" id="payAdd">Add</button></div></div>
    <div class="dsec"><div class="dsec__h"><h4>Notes</h4></div><textarea class="noteedit" id="noteEdit" placeholder="Add notes about this client…">${esc(c.notes||"")}</textarea></div>
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
  detailBody.querySelector("#payAdd").addEventListener("click", async ()=>{
    const amt=parseFloat(detailBody.querySelector("#payAmt").value);
    const date=detailBody.querySelector("#payDate").value || new Date().toISOString().slice(0,10);
    if(!amt||amt<=0) return;
    const payments=(c.payments||[]).concat([{amount:amt,date}]);
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
let bookings = [], services = [], sops = [], appSettings = {}, jobs = [], ownerId = null;

async function loadExtras() {
  const u = await sb.auth.getUser(); ownerId = u.data.user?.id || null;
  const [bk, sv, so, st, jb] = await Promise.all([
    sb.from("bookings").select("*").order("scheduled_at", { ascending: true }),
    sb.from("services").select("*"),
    sb.from("sops").select("*"),
    sb.from("settings").select("data").maybeSingle(),
    sb.from("jobs").select("*").order("finished_at", { ascending: false }),
  ]);
  bookings = bk.data || []; services = sv.data || []; sops = so.data || []; appSettings = (st.data && st.data.data) || {}; jobs = jb.data || [];
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
      <div class="bkcard__top"><div><div class="bkcard__name">${esc(b.attendee_name || "—")}<span class="bkcard__badge badge-${cls}">${esc(s)}</span></div><div class="bkcard__svc">${esc(svcLabel(b))}</div></div>${b.price ? `<div class="bkcard__price">${money(b.price)}</div>` : ""}</div>
      <div class="bkcard__when">📅 ${esc(bkWhen(b))}${b.est_minutes ? ` · ⏱ ${b.est_minutes}m` : ""}</div>
      ${b.attendee_phone ? `<div class="bkcard__phone">📞 ${esc(b.attendee_phone)}</div>` : ""}
      <div class="bkcard__btns"><button class="btn btn--ghost btn--xs" data-msg="${b.id}">💬 On my way</button><button class="btn btn--primary btn--xs" data-start="${b.id}">Start detail →</button></div>
    </article>`;
  }).join("");
}
bkList.addEventListener("click", (e) => {
  const m = e.target.dataset.msg, s = e.target.dataset.start;
  if (m) { const b = bookings.find((x) => x.id === m); if (b) messageCustomer(b, appSettings.messages?.on_my_way); }
  if (s) { const b = bookings.find((x) => x.id === s); if (b) openStartDetail(b); }
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
      <h4 style="margin-top:1.4rem">Charge customer</h4><div class="charge">${money(charge)}</div>
      <div class="sd__bar"><button class="btn btn--ghost" id="sdCloseDone">Close</button><button class="btn btn--primary" id="sdPaid">Mark paid</button></div></div>`;
    document.getElementById("sdCloseDone").onclick = async () => { await saveJob(false); closeStartDetail(); };
    document.getElementById("sdPaid").onclick = async () => { await saveJob(true); closeStartDetail(); };
  }
}
sdEl.addEventListener("change", async (e) => {
  const kind = e.target.dataset.shot; if (!kind || !sd) return;
  for (const f of e.target.files) { sd[kind].push(await fileToDataURL(f)); }
  renderSD();
});
async function saveJob(markPaid) {
  const b = sd.booking, mins = Math.round((sd.endTs - sd.startTs) / 60000);
  await sb.from("jobs").insert({ booking_id: b.id, client_id: b.client_id, started_at: new Date(sd.startTs).toISOString(), finished_at: new Date(sd.endTs).toISOString(), duration_seconds: Math.round((sd.endTs - sd.startTs) / 1000), est_minutes: b.est_minutes, before_photos: sd.before, after_photos: sd.after, damage_photos: sd.damage, checklist: { done: [...sd.checks] }, charge_amount: b.price || null, status: "done" });
  await sb.from("bookings").update({ status: "done" }).eq("id", b.id);
  if (markPaid && b.client_id && b.price) {
    const c = clients.find((x) => x.id === b.client_id);
    const payments = ((c && c.payments) || []).concat([{ amount: b.price, date: new Date().toISOString().slice(0, 10) }]);
    await sb.from("clients").update({ payments, last_seen: new Date().toISOString().slice(0, 10) }).eq("id", b.client_id);
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
    <details class="acc" open><summary>Messages</summary><div class="acc__body">
      <label class="fld"><span>“On my way” text</span><textarea id="msgOnWay">${esc(m.on_my_way || "")}</textarea></label>
      <label class="fld" style="margin-top:.6rem"><span>“Wrapping up” text</span><textarea id="msgWrap">${esc(m.wrapping_up || "")}</textarea></label>
      <p class="set-hint">Tip: type {name} to auto-insert the customer's first name.</p>
      <button class="btn btn--primary btn--xs" id="saveMsgs">Save messages</button><span class="saved" id="savedMsgs" hidden>Saved ✓</span></div></details>
    <div class="set-group"><div class="set-group__t">Prices &amp; times</div>${["interior", "exterior", "bundle"].map(priceCard).join("")}<button class="btn btn--primary btn--xs" id="savePrices">Save all prices</button><span class="saved" id="savedPrices" hidden>Saved ✓</span></div>
    <div class="set-group"><div class="set-group__t">SOP checklists</div>${["interior", "exterior", "bundle"].map(sopCard).join("")}<button class="btn btn--primary btn--xs" id="saveSops">Save all SOPs</button><span class="saved" id="savedSops" hidden>Saved ✓</span></div>
    <details class="acc"><summary>Account</summary><div class="acc__body"><button class="btn btn--ghost btn--xs" id="signOut">Sign out</button></div></details>`;
  document.getElementById("saveMsgs").onclick = async () => { appSettings.messages = { on_my_way: document.getElementById("msgOnWay").value, wrapping_up: document.getElementById("msgWrap").value }; await sb.from("settings").update({ data: appSettings }).eq("owner", ownerId); flash("savedMsgs"); };
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
  const pays = clients.flatMap((c) => (c.payments || []).map((p) => ({ amount: Number(p.amount) || 0, date: p.date || "" })));
  const sum = (a) => a.reduce((s, p) => s + p.amount, 0);
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
    </div>`;
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
    html += `<div class="dsec"><div class="dsec__h"><h4>Before / after</h4></div>${ba.map((j) => { const bf = (j.before_photos || [])[0], af = (j.after_photos || [])[0]; return `<div class="ba"><div class="ba__pair">${bf ? `<figure class="ba__f"><img src="${bf}" alt=""><figcaption>Before</figcaption></figure>` : ""}${af ? `<figure class="ba__f"><img src="${af}" alt=""><figcaption>After</figcaption></figure>` : ""}</div>${j.finished_at ? `<div class="ba__date">${new Date(j.finished_at).toLocaleDateString()} · ${Math.round((j.duration_seconds || 0) / 60)}m · ${money(j.charge_amount || 0)}</div>` : ""}</div>`; }).join("")}</div>`;
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
