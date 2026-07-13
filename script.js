// ===== Euro Detailing — intro -> passcode -> home =====
const PASSCODE = "3333";
const INTRO_DURATION = 3200;

const intro = document.getElementById("intro");
const login = document.getElementById("login");
const home = document.getElementById("home");

// --- Intro -> Login ---
function showLogin() {
  intro.classList.add("intro--hidden");
  login.classList.add("login--visible");
  login.setAttribute("aria-hidden", "false");
  setTimeout(() => document.getElementById("passcode").focus(), 400);
}
const introTimer = setTimeout(showLogin, INTRO_DURATION);
function skipIntro() {
  if (intro.classList.contains("intro--hidden")) return;
  clearTimeout(introTimer);
  showLogin();
}
intro.addEventListener("click", skipIntro);

// --- Passcode check ---
const form = document.getElementById("passForm");
const input = document.getElementById("passcode");
const card = document.querySelector(".login__card");
const errEl = document.getElementById("passError");

function unlock() {
  login.classList.remove("login--visible");
  login.setAttribute("aria-hidden", "true");
  home.classList.add("home--visible");
  home.setAttribute("aria-hidden", "false");
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  if (input.value === PASSCODE) {
    errEl.textContent = "";
    unlock();
  } else {
    errEl.textContent = "Wrong passcode — try again";
    card.classList.remove("shake");
    void card.offsetWidth; // restart animation
    card.classList.add("shake");
    input.value = "";
    input.focus();
  }
});
input.addEventListener("input", () => { errEl.textContent = ""; });

// --- Lock button returns to passcode ---
document.getElementById("lockBtn").addEventListener("click", () => {
  home.classList.remove("home--visible");
  home.setAttribute("aria-hidden", "true");
  login.classList.add("login--visible");
  login.setAttribute("aria-hidden", "false");
  input.value = "";
  setTimeout(() => input.focus(), 300);
});
