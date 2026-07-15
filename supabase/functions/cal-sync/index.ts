// Euro Detailing — Cal.com → app sync. Zero imports (uses fetch + Supabase REST)
// so it boots reliably. Triggered by Cal.com webhook (POST) and a cron poll (GET);
// both re-pull recent bookings and upsert them (idempotent on cal_uid).
const SUPA = Deno.env.get("SUPABASE_URL")!;
const SRK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CAL_KEY = Deno.env.get("CAL_API_KEY")!;
const OWNER = Deno.env.get("OWNER_ID")!;
const H: Record<string, string> = { apikey: SRK, Authorization: `Bearer ${SRK}`, "Content-Type": "application/json" };

const digits = (s: string) => (s || "").replace(/[^0-9]/g, "");
function mapService(text: string) {
  const t = (text || "").toLowerCase();
  const service = /exterior/.test(t) ? "exterior" : /bundle|combo/.test(t) ? "bundle" : /interior/.test(t) ? "interior" : null;
  const tier = /premium/.test(t) ? "premium" : /maintenance/.test(t) ? "maintenance" : /member|visit/.test(t) ? "membership" : "basic";
  const size = /suv/.test(t) ? "suv" : /\bxl\b|x-?large/.test(t) ? "xl" : "sedan";
  return { service, tier, size };
}

async function rest(path: string, opts: RequestInit = {}) {
  const r = await fetch(`${SUPA}/rest/v1/${path}`, { ...opts, headers: { ...H, ...(opts.headers || {}) } });
  const txt = await r.text();
  if (!r.ok) throw new Error(`${r.status} ${txt}`);
  return txt ? JSON.parse(txt) : null;
}

async function findOrCreateClient(name: string, phone: string, email: string, vehicle: string) {
  const ph = digits(phone);
  if (ph.length >= 7) {
    const rows = await rest(`clients?owner=eq.${OWNER}&select=id,phone`);
    const hit = (rows || []).find((c: any) => digits(c.phone || "").slice(-10) === ph.slice(-10));
    if (hit) return hit.id;
  }
  if (email) {
    const rows = await rest(`clients?owner=eq.${OWNER}&email=ilike.${encodeURIComponent(email)}&select=id`);
    if (rows && rows[0]) return rows[0].id;
  }
  if (name) {
    const rows = await rest(`clients?owner=eq.${OWNER}&name=ilike.${encodeURIComponent(name)}&select=id`);
    if (rows && rows[0]) return rows[0].id;
  }
  const ins = await rest(`clients`, {
    method: "POST", headers: { Prefer: "return=representation" },
    body: JSON.stringify({ owner: OWNER, name: name || "New client", phone: phone || null, email: email || null, vehicle: vehicle || null }),
  });
  return ins[0].id;
}

async function priceLookup(s: string | null, t: string, z: string) {
  if (!s || !t || !z) return { price: null, est: null };
  const rows = await rest(`services?owner=eq.${OWNER}&service=eq.${s}&tier=eq.${t}&size=eq.${z}&select=price,est_minutes`);
  if (rows && rows[0]) return { price: rows[0].price, est: rows[0].est_minutes };
  return { price: null, est: null };
}

async function upsertBooking(b: any) {
  const bf = b.bookingFieldsResponses || b.responses || {};
  const nm = bf.name;
  const name = nm && typeof nm === "object" ? [nm.firstName, nm.lastName].filter(Boolean).join(" ") : (b.attendees?.[0]?.name || nm || "");
  const phone = bf.Phone_number || bf.attendeePhoneNumber || b.attendees?.[0]?.phoneNumber || "";
  const email = bf.email || b.attendees?.[0]?.email || "";
  const vehicle = bf.title || "";
  const map = mapService(b.title || "");
  const { price, est } = await priceLookup(map.service, map.tier, map.size);
  // Reuse the client of an already-synced booking so re-runs never duplicate clients.
  const existing = await rest(`bookings?cal_uid=eq.${encodeURIComponent(b.uid)}&select=client_id`);
  const client_id = (existing && existing[0]?.client_id) || await findOrCreateClient(name, phone, email, vehicle);
  const row = {
    owner: OWNER, client_id, source: "cal.com", cal_uid: b.uid,
    attendee_name: name, attendee_phone: phone, attendee_email: email,
    title: b.title, service: map.service, tier: map.tier, size: map.size,
    est_minutes: est, price, scheduled_at: b.start, ends_at: b.end,
    status: b.status, cal_status: b.status, notes: bf.notes || null,
  };
  await rest(`bookings?on_conflict=cal_uid`, {
    method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(row),
  });
}

async function fullSync() {
  // Bookings the owner deleted in-app — never re-create these.
  const supp = await rest(`suppressed?owner=eq.${OWNER}&select=cal_uid`);
  const suppressed = new Set((supp || []).map((s: any) => s.cal_uid));
  const res = await fetch("https://api.cal.com/v2/bookings?take=100&sortStart=desc", {
    headers: { Authorization: `Bearer ${CAL_KEY}`, "cal-api-version": "2024-08-13" },
  });
  const j = await res.json();
  const list = j.data || [];
  const cutoff = Deno.env.get("CAL_SYNC_FROM") || ""; // only import bookings starting on/after this date
  let ok = 0, skipped = 0;
  for (const b of list) {
    if (suppressed.has(b.uid)) { skipped++; continue; }
    if (cutoff && b.start && b.start < cutoff) { skipped++; continue; } // ignore old/pre-existing bookings
    try { await upsertBooking(b); ok++; } catch (e) { console.error("booking", b.uid, String(e)); }
  }
  return { total: list.length, ok, skipped };
}

Deno.serve(async () => {
  try {
    const r = await fullSync();
    return new Response(JSON.stringify({ ok: true, ...r }), { headers: { "content-type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500, headers: { "content-type": "application/json" } });
  }
});
