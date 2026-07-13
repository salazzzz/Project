// ===== Intro -> Login transition =====
const intro = document.getElementById("intro");
const login = document.getElementById("login");

const INTRO_DURATION = 3000; // matches the loader bar animation

function showLogin() {
  intro.classList.add("intro--hidden");
  intro.setAttribute("aria-hidden", "true");
  login.classList.add("login--visible");
  login.setAttribute("aria-hidden", "false");
  // move focus to the first field once the panel is in view
  setTimeout(() => document.getElementById("email").focus(), 400);
}

// Auto-advance after the intro plays; allow skipping with a click/keypress.
const introTimer = setTimeout(showLogin, INTRO_DURATION);
function skipIntro() {
  if (intro.classList.contains("intro--hidden")) return;
  clearTimeout(introTimer);
  showLogin();
}
intro.addEventListener("click", skipIntro);
window.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === "Escape" || e.key === " ") skipIntro();
}, { once: true });

// ===== Password visibility toggle =====
const pw = document.getElementById("password");
const togglePw = document.getElementById("togglePw");
togglePw.addEventListener("click", () => {
  const showing = pw.type === "text";
  pw.type = showing ? "password" : "text";
  togglePw.textContent = showing ? "Show" : "Hide";
  togglePw.setAttribute("aria-label", showing ? "Show password" : "Hide password");
});

// ===== Basic validation + submit =====
const form = document.getElementById("loginForm");
const submitBtn = document.getElementById("submitBtn");

function setError(name, message) {
  const input = document.getElementById(name);
  const slot = document.querySelector(`.field__error[data-for="${name}"]`);
  slot.textContent = message;
  input.classList.toggle("invalid", Boolean(message));
}

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const email = document.getElementById("email").value.trim();
  const password = pw.value;
  let ok = true;

  if (!emailRe.test(email)) { setError("email", "Enter a valid email address"); ok = false; }
  else setError("email", "");

  if (password.length < 6) { setError("password", "Password must be at least 6 characters"); ok = false; }
  else setError("password", "");

  if (!ok) return;

  // Simulate a sign-in request.
  submitBtn.classList.add("loading");
  submitBtn.textContent = "Signing in…";
  setTimeout(() => {
    submitBtn.classList.remove("loading");
    submitBtn.textContent = "Signed in ✓";
    // Next step in a real app: redirect to the dashboard here.
  }, 1200);
});

// Clear an error as soon as the user starts fixing the field.
["email", "password"].forEach((name) => {
  document.getElementById(name).addEventListener("input", () => setError(name, ""));
});
