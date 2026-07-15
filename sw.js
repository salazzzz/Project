// Euro Detailing — service worker (offline app shell)
const CACHE = "euro-detailing-v12";
const SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./script.js",
  "./config.js",
  "./vendor/supabase.js",
  "./manifest.json",
  "./assets/logo.png",
  "./assets/icon-192.png",
  "./assets/icon-512.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network-first for our own code/assets (always fresh when online); cache is
// only the offline fallback. Cross-origin (Supabase, etc.) bypasses the SW.
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  if (new URL(req.url).origin !== location.origin) return; // let Supabase & CDNs hit network directly
  e.respondWith(
    fetch(req).then((r) => {
      if (r.ok) { const clone = r.clone(); caches.open(CACHE).then((c) => c.put(req, clone)); }
      return r;
    }).catch(() => caches.match(req).then((m) => m || caches.match("./index.html")))
  );
});
