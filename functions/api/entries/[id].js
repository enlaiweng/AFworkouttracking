// DELETE /api/entries/:id?slug=...  -> a paddler removes one of their own entries

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

export async function onRequestDelete({ request, params, env }) {
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug") || "";
  const id = String(params.id || "");
  if (!/^[a-z0-9-]+$/.test(slug) || !id) return json({ error: "Bad request" }, 400);

  const result = await env.DB.prepare("DELETE FROM entries WHERE id = ?1 AND slug = ?2")
    .bind(id, slug)
    .run();
  if (!result.meta || result.meta.changes === 0) return json({ error: "Not found" }, 404);
  return json({ deleted: true });
}
