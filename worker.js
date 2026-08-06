// AF Conditioning Challenge: Cloudflare Worker
// Serves the built static site and the API. D1 binding: DB. Assets binding: ASSETS.

const RATES = { cardio: 20, strength: 20, stretching: 10 };
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

async function boardGet(url, env) {
  const month = url.searchParams.get("month") || "";
  if (!/^\d{4}-\d{2}$/.test(month)) return json({ error: "Bad request" }, 400);
  const { results } = await env.DB.prepare(
    `SELECT m.name AS name, m.team AS team,
            SUM(e.pts) AS pts, COUNT(DISTINCT e.date) AS days
       FROM entries e
       JOIN members m ON m.slug = e.slug
      WHERE e.date LIKE ?1
      GROUP BY e.slug
      ORDER BY pts DESC, m.name ASC`
  )
    .bind(`${month}-%`)
    .all();
  return json({ month, rows: results });
}

async function entriesGet(url, env) {
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

async function entriesPost(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Bad JSON" }, 400);
  }
  const { slug, name, date, type, min } = body || {};

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

  const pts = Math.floor((m / RATES[type]) * 2) / 2; // server computes points
  const id = crypto.randomUUID();
  await env.DB.prepare(
    "INSERT INTO entries (id, slug, date, type, min, pts, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)"
  )
    .bind(id, member.slug, date, type, m, pts, Date.now())
    .run();

  return json({ entry: { id, date, type, min: m, pts } }, 201);
}

async function entryDelete(id, url, env) {
  const slug = url.searchParams.get("slug") || "";
  if (!/^[a-z0-9-]+$/.test(slug) || !id) return json({ error: "Bad request" }, 400);
  const result = await env.DB.prepare("DELETE FROM entries WHERE id = ?1 AND slug = ?2")
    .bind(id, slug)
    .run();
  if (!result.meta || result.meta.changes === 0) return json({ error: "Not found" }, 404);
  return json({ deleted: true });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    try {
      if (path === "/api/board" && request.method === "GET") return await boardGet(url, env);
      if (path === "/api/entries" && request.method === "GET") return await entriesGet(url, env);
      if (path === "/api/entries" && request.method === "POST") return await entriesPost(request, env);
      const idMatch = path.match(/^\/api\/entries\/([^/]+)$/);
      if (idMatch && request.method === "DELETE") {
        return await entryDelete(decodeURIComponent(idMatch[1]), url, env);
      }
      if (path.startsWith("/api/")) return json({ error: "Not found" }, 404);
    } catch (err) {
      return json({ error: "Server error" }, 500);
    }
    return env.ASSETS.fetch(request); // everything else is the site
  },
};
