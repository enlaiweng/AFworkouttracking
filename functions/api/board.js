// GET /api/board?month=YYYY-MM -> one query aggregates the whole team

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
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
