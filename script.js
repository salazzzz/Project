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
async function showApp(){ login.classList.remove("login--visible"); app.classList.add("app--visible"); await loadAll(); render(); subscribeRealtime(); }

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
  const pays=(c.payments&&c.payments.length)?c.payments.slice().sort((a,b)=>(b.date||"").localeCompare(a.date||"")).map(p=>`<div class="pay"><span>${fmtDate(p.date)}</span><b>${money(p.amount)}</b></div>`).join(""):`<div class="pay"><span style="color:var(--muted)">No payments logged.</span></div>`;
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
    <div class="detail__actions"><button class="btn btn--ghost btn--xs" id="detailEdit">Edit</button><button class="btn btn--danger btn--xs" id="detailDelete">Delete</button></div>`;

  detailBody.querySelector("#detailBack").addEventListener("click", closeDetail);
  detailBody.querySelector("#detailEdit").addEventListener("click", ()=>openModal(c));
  detailBody.querySelector("#detailDelete").addEventListener("click", async ()=>{
    if(confirm(`Delete ${c.name}? This can't be undone.`)){ await dbDelete(c.id); closeDetail(); await refresh(); }
  });
  detailBody.querySelector("#noteEdit").addEventListener("change", async e=>{ await dbPatch(c.id,{notes:e.target.value}); });
  detailBody.querySelector("#payAdd").addEventListener("click", async ()=>{
    const amt=parseFloat(detailBody.querySelector("#payAmt").value);
    const date=detailBody.querySelector("#payDate").value || new Date().toISOString().slice(0,10);
    if(!amt||amt<=0) return;
    const payments=(c.payments||[]).concat([{amount:amt,date}]);
    await dbPatch(c.id,{ payments, last_seen:date }); await refresh();
  });
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
function renderDashboard(){
  document.getElementById("statClients").textContent=clients.length;
  document.getElementById("statVehicles").textContent=clients.filter(c=>c.vehicle).length;
  document.getElementById("statRevenue").textContent=money(clients.reduce((s,c)=>s+total(c),0));
  const recent=document.getElementById("recent");
  recent.innerHTML=clients.length?clients.slice(0,5).map(c=>`<div class="recent__row"><b>${esc(c.name)}</b><span>${esc(c.vehicle||"—")}</span></div>`).join(""):`<div class="recent__row">No clients yet.</div>`;
}

function render(){ renderDashboard(); renderCards(); }
