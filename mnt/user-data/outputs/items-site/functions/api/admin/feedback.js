// /api/admin/feedback — admin-only. Protect this path (and /admin.html) with
// Cloudflare Access; Access injects the Cf-Access-Jwt-Assertion header and the
// authenticated identity headers on every allowed request.

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });

// Returns the Access-verified email, or null when the request did not come
// through Cloudflare Access.
function accessIdentity(request, env) {
  const jwt = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!jwt) {
    // Allow local `wrangler pages dev` to work without Access in front.
    if (env.ALLOW_INSECURE_ADMIN === 'true') return 'local-dev';
    return null;
  }
  try {
    const payload = JSON.parse(
      atob(jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))
    );
    return payload.email || payload.sub || 'authenticated';
  } catch {
    return 'authenticated';
  }
}

export async function onRequest(context) {
  const { request, env } = context;

  const user = accessIdentity(request, env);
  if (!user) return json({ ok: false, error: 'unauthorized' }, 401);
  if (!env.DB) return json({ ok: false, error: 'database_not_bound' }, 500);

  const url = new URL(request.url);

  try {
    if (request.method === 'GET') {
      const { results } = await env.DB.prepare(
        `SELECT id, created_at, name, email, type, message, country, status
         FROM feedback ORDER BY id DESC LIMIT 1000`
      ).all();
      return json({ ok: true, user, items: results || [] });
    }

    if (request.method === 'PATCH') {
      const body = await request.json();
      const id = parseInt(body.id, 10);
      const status = body.status === 'read' ? 'read' : 'new';
      if (!id) return json({ ok: false, error: 'id_required' }, 400);
      await env.DB.prepare('UPDATE feedback SET status = ? WHERE id = ?')
        .bind(status, id).run();
      return json({ ok: true });
    }

    if (request.method === 'DELETE') {
      const id = parseInt(url.searchParams.get('id'), 10);
      if (!id) return json({ ok: false, error: 'id_required' }, 400);
      await env.DB.prepare('DELETE FROM feedback WHERE id = ?').bind(id).run();
      return json({ ok: true });
    }

    return json({ ok: false, error: 'method_not_allowed' }, 405);
  } catch (err) {
    return json({ ok: false, error: 'db_error', detail: String(err.message || err) }, 500);
  }
}
