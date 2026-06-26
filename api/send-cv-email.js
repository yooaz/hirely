/**
 * Vercel serverless — send exported CV PDF via Resend (transactional).
 * Env: RESEND_API_KEY (required), RESEND_FROM (optional, e.g. "Hirely <cv@yourdomain.com>")
 * POST JSON: { to, pdfBase64, filename?, candidateName?, exportId? }
 */

function json(res, body, status = 200) {
  res.status(status);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function isEmail(s) {
  return typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

function sanitizeFilename(name) {
  const base = String(name || 'hirely-cv.pdf')
    .replace(/[^\w.\-]/g, '_')
    .slice(0, 120);
  return base.toLowerCase().endsWith('.pdf') ? base : `${base}.pdf`;
}

function idempotencyKey(to, exportId, filename) {
  const raw = `cv-email/${to}/${exportId || filename}`.slice(0, 256);
  return raw;
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return req.body;
  }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw.trim()) return {};
  return JSON.parse(raw);
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    json(res, { error: 'Method not allowed' }, 405);
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    json(res, { error: 'Email delivery is not configured', code: 'RESEND_DISABLED' }, 503);
    return;
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    json(res, { error: 'Invalid JSON body' }, 400);
    return;
  }

  const to = typeof body.to === 'string' ? body.to.trim() : '';
  const pdfBase64 = typeof body.pdfBase64 === 'string' ? body.pdfBase64.trim() : '';
  const candidateName =
    typeof body.candidateName === 'string' ? body.candidateName.trim().slice(0, 120) : '';
  const filename = sanitizeFilename(body.filename);
  const exportId = typeof body.exportId === 'string' ? body.exportId.slice(0, 64) : '';

  if (!isEmail(to)) {
    json(res, { error: 'Valid recipient email required' }, 422);
    return;
  }

  if (!pdfBase64 || pdfBase64.length < 100) {
    json(res, { error: 'PDF attachment missing or too small' }, 422);
    return;
  }

  if (pdfBase64.length > 28_000_000) {
    json(res, { error: 'PDF too large for email (max ~20MB)' }, 422);
    return;
  }

  const from = process.env.RESEND_FROM || 'Hirely <onboarding@resend.dev>';
  const displayName = candidateName || 'your CV';
  const subject = `Your Hirely CV — ${displayName}`;
  const text = [
    'Your recruiter-ready CV from Hirely is attached.',
    '',
    `File: ${filename}`,
    '',
    'Sent from Hirely · Premium CV workspace',
  ].join('\n');

  const html = `<p>Your recruiter-ready CV from <strong>Hirely</strong> is attached.</p>
<p><strong>File:</strong> ${filename}</p>
<p style="color:#64748b;font-size:13px;">Hirely · Premium CV workspace</p>`;

  const payload = {
    from,
    to: [to],
    subject,
    html,
    text,
    attachments: [{ filename, content: pdfBase64 }],
    tags: [{ name: 'product', value: 'hirely' }, { name: 'event', value: 'cv_export_email' }],
  };

  let upstream;
  try {
    upstream = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey(to, exportId, filename),
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    json(res, { error: 'Resend request failed', detail: String(err?.message || err) }, 502);
    return;
  }

  const data = await upstream.json().catch(() => ({}));

  if (!upstream.ok) {
    json(
      res,
      {
        error: data?.message || 'Resend rejected the send',
        code: data?.name || 'RESEND_ERROR',
        status: upstream.status,
      },
      upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502
    );
    return;
  }

  json(res, { ok: true, id: data?.id || null, to });
};
