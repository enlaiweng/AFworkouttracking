// GET /api/entries?slug=...&month=YYYY-MM  -> one paddler's entries for a month
// POST /api/entries { slug, name, date, type, min } -> validates, computes points server-side, inserts

const RATES = { cardio: 20, strength: 20, stretching: 10 };
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug") || "";
  const month = url.searchParams.get("month") || "";
  if (!/^[a-z0-9-]+$/.test(slug) || !/^\d{4}-\d{2}$/.test(month)) {
    return json({ error: "Bad request" }, 400);
  }
  const { results } = await env.DB.prepare(
    "SELECT id, date, type, min, pts FROM entries WHERE slug = ?1 AND date LIKE ?2 ORDER BY date, created_at"
  )
    .bind(slug, `${month}-%`)
    .all();
  return json({ entries: results });
}

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Bad JSON" }, 400);
  }
  const { slug, name, date, type, min } = body || {};

  // Validate against the members table (roster is the allowlist)
  const member = await env.DB.prepare("SELECT slug, name FROM members WHERE slug = ?1 AND name = ?2")
    .bind(String(slug || ""), String(name || ""))
    .first();
  if (!member) return json({ error: "Unknown paddler" }, 403);

  if (!RATES[type]) return json({ error: "Unknown activity" }, 400);

  const m = Number(min);
  if (!Number.isFinite(m) || m <= 0 || m > 1440) return json({ error: "Minutes out of range" }, 400);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ""))) return json({ error: "Bad date" }, 400);
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  if (date > tomorrow) return json({ error: "Future date" }, 400); // one-day margin for timezones

  // Server computes points; the client preview is a convenience, not the truth
  const pts = Math.floor((m / RATES[type]) * 2) / 2;
  const id = crypto.randomUUID();
  await env.DB.prepare(
    "INSERT INTO entries (id, slug, date, type, min, pts, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)"
  )
    .bind(id, member.slug, date, type, m, pts, Date.now())
    .run();

  return json({ entry: { id, date, type, min: m, pts } }, 201);
}
