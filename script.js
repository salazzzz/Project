// ===== Euro Detailing CRM =====
const PASSCODE = "3333";
const INTRO_DURATION = 3200;
const STORAGE_KEY = "eurodetailing.clients.v1";

const intro = document.getElementById("intro");
const login = document.getElementById("login");
const app = document.getElementById("app");

/* ---------- Intro -> Passcode ---------- */
function showLogin() {
  intro.classList.add("intro--hidden");
  login.classList.add("login--visible");
  login.setAttribute("aria-hidden", "false");
  setTimeout(() => document.getElementById("passcode").focus(), 400);
}
let introTimer = setTimeout(showLogin, INTRO_DURATION);
intro.addEventListener("click", () => {
  if (intro.classList.contains("intro--hidden")) return;
  clearTimeout(introTimer);
  showLogin();
});

/* ---------- Passcode -> App ---------- */
const passForm = document.getElementById("passForm");
const passInput = document.getElementById("passcode");
const passCard = document.querySelector(".login__card");
const passError = document.getElementById("passError");

function enterApp() {
  login.classList.remove("login--visible");
  login.setAttribute("aria-hidden", "true");
  app.classList.add("app--visible");
  app.setAttribute("aria-hidden", "false");
  render();
}
passForm.addEventListener("submit", (e) => {
  e.preventDefault();
  if (passInput.value === PASSCODE) {
    passError.textContent = "";
    enterApp();
  } else {
    passError.textContent = "Wrong passcode — try again";
    passCard.classList.remove("shake");
    void passCard.offsetWidth;
    passCard.classList.add("shake");
    passInput.value = "";
    passInput.focus();
  }
});
passInput.addEventListener("input", () => { passError.textContent = ""; });

document.getElementById("lockBtn").addEventListener("click", () => {
  app.classList.remove("app--visible");
  app.setAttribute("aria-hidden", "true");
  login.classList.add("login--visible");
  login.setAttribute("aria-hidden", "false");
  passInput.value = "";
  setTimeout(() => passInput.focus(), 300);
});

/* ---------- Navigation ---------- */
const navItems = document.querySelectorAll(".nav__item");
navItems.forEach((btn) => {
  btn.addEventListener("click", () => {
    navItems.forEach((b) => b.classList.remove("is-active"));
    btn.classList.add("is-active");
    const view = btn.dataset.view;
    document.querySelectorAll(".view").forEach((v) => v.classList.remove("is-active"));
    document.getElementById("view-" + view).classList.add("is-active");
    if (view === "soon") {
      document.getElementById("soonTitle").textContent = btn.dataset.label;
      document.getElementById("soonBody").textContent =
        `The ${btn.dataset.label} module is next on the list — we'll build it piece by piece.`;
    }
    if (view === "clients") document.getElementById("clientSearch").focus();
  });
});

/* ---------- Clients data ---------- */
function loadClients() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}
function saveClients(list) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch {}
}
let clients = loadClients();

/* ---------- Modal (add / edit) ---------- */
const modal = document.getElementById("clientModal");
const clientForm = document.getElementById("clientForm");
const modalTitle = document.getElementById("modalTitle");
const fName = document.getElementById("fName");
const fPhone = document.getElementById("fPhone");
const fVehicle = document.getElementById("fVehicle");
const fNotes = document.getElementById("fNotes");
let editingId = null;

function openModal(client) {
  editingId = client ? client.id : null;
  modalTitle.textContent = client ? "Edit client" : "Add client";
  fName.value = client ? client.name : "";
  fPhone.value = client ? client.phone : "";
  fVehicle.value = client ? client.vehicle : "";
  fNotes.value = client ? client.notes : "";
  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
  setTimeout(() => fName.focus(), 50);
}
function closeModal() {
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
  editingId = null;
}
document.getElementById("addClientBtn").addEventListener("click", () => openModal(null));
modal.querySelectorAll("[data-close]").forEach((el) => el.addEventListener("click", closeModal));
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && modal.classList.contains("is-open")) closeModal(); });

clientForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = fName.value.trim();
  if (!name) return;
  const data = { name, phone: fPhone.value.trim(), vehicle: fVehicle.value.trim(), notes: fNotes.value.trim() };
  if (editingId) {
    clients = clients.map((c) => (c.id === editingId ? { ...c, ...data } : c));
  } else {
    clients.unshift({ id: Date.now().toString(36), created: Date.now(), ...data });
  }
  saveClients(clients);
  closeModal();
  render();
});

/* ---------- Rendering ---------- */
const clientList = document.getElementById("clientList");
const clientEmpty = document.getElementById("clientEmpty");
const clientSearch = document.getElementById("clientSearch");

function esc(s) { return (s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

function renderClients() {
  const q = clientSearch.value.trim().toLowerCase();
  const filtered = clients.filter((c) =>
    [c.name, c.phone, c.vehicle].some((f) => (f || "").toLowerCase().includes(q))
  );
  clientEmpty.hidden = clients.length !== 0;
  if (clients.length === 0) { clientList.innerHTML = ""; return; }
  if (filtered.length === 0) {
    clientList.innerHTML = `<div class="empty">No clients match “${esc(q)}”.</div>`;
    return;
  }
  clientList.innerHTML = filtered.map((c) => `
    <article class="client">
      <div class="client__name">${esc(c.name)}</div>
      ${c.vehicle ? `<div class="client__meta"><b>Vehicle:</b> ${esc(c.vehicle)}</div>` : ""}
      ${c.phone ? `<div class="client__meta"><b>Phone:</b> ${esc(c.phone)}</div>` : ""}
      ${c.notes ? `<div class="client__notes">${esc(c.notes)}</div>` : ""}
      <div class="client__actions">
        <button class="client__btn" data-edit="${c.id}">Edit</button>
        <button class="client__btn client__btn--del" data-del="${c.id}">Delete</button>
      </div>
    </article>`).join("");
}

clientList.addEventListener("click", (e) => {
  const editId = e.target.dataset.edit;
  const delId = e.target.dataset.del;
  if (editId) openModal(clients.find((c) => c.id === editId));
  if (delId) {
    const c = clients.find((x) => x.id === delId);
    if (confirm(`Delete ${c ? c.name : "this client"}?`)) {
      clients = clients.filter((x) => x.id !== delId);
      saveClients(clients);
      render();
    }
  }
});
clientSearch.addEventListener("input", renderClients);

function renderDashboard() {
  document.getElementById("statClients").textContent = clients.length;
  document.getElementById("statVehicles").textContent = clients.filter((c) => c.vehicle).length;
  const weekAgo = Date.now() - 7 * 864e5;
  document.getElementById("statWeek").textContent = clients.filter((c) => (c.created || 0) > weekAgo).length;
  const recent = document.getElementById("recentClients");
  if (clients.length === 0) {
    recent.innerHTML = `<div class="recent__row">No clients yet.</div>`;
  } else {
    recent.innerHTML = clients.slice(0, 5).map((c) =>
      `<div class="recent__row"><b>${esc(c.name)}</b><span>${esc(c.vehicle || "—")}</span></div>`
    ).join("");
  }
}

function render() {
  renderDashboard();
  renderClients();
}
