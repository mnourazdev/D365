// POST /api/feedback  — public endpoint used by the feedback form.
// Stores the submission in the D1 database bound as `DB`.

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.DB) {
    return json({ ok: false, error: 'database_not_bound' }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'invalid_json' }, 400);
  }

  const message = String(body.message || '').trim();
  if (!message) return json({ ok: false, error: 'message_required' }, 400);
  if (message.length > 4000) return json({ ok: false, error: 'message_too_long' }, 400);

  // Honeypot: bots fill every field they see.
  if (body.website) return json({ ok: true });

  const name = String(body.name || '').trim().slice(0, 120);
  const email = String(body.email || '').trim().slice(0, 200);
  const type = String(body.type || 'أخرى').trim().slice(0, 40);

  const ip = request.headers.get('CF-Connecting-IP') || '';
  const ua = (request.headers.get('User-Agent') || '').slice(0, 300);
  const country = request.headers.get('CF-IPCountry') || '';

  // Light rate limit: max 5 submissions per IP in the last 10 minutes.
  try {
    const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const recent = await env.DB.prepare(
      'SELECT COUNT(*) AS c FROM feedback WHERE ip = ? AND created_at > ?'
    ).bind(ip, since).first();
    if (recent && recent.c >= 5) {
      return json({ ok: false, error: 'rate_limited' }, 429);
    }
  } catch {
    // If the table is missing the insert below will surface the real error.
  }

  try {
    await env.DB.prepare(
      `INSERT INTO feedback (created_at, name, email, type, message, ip, country, user_agent, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'new')`
    ).bind(new Date().toISOString(), name, email, type, message, ip, country, ua).run();
  } catch (err) {
    return json({ ok: false, error: 'db_error', detail: String(err.message || err) }, 500);
  }

  return json({ ok: true });
}

export async function onRequest() {
  return json({ ok: false, error: 'method_not_allowed' }, 405);
}
