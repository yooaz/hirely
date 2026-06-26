/**
 * Build and optionally send Hirely release-gate summary emails via Resend.
 * Requires RESEND_API_KEY, RESEND_FROM, and HIRELY_RELEASE_NOTIFY_TO.
 */

const REPORT_PATH = 'tests/output/release-gate/report.json';

function escHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (m) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[m]
  );
}

function sectionRows(report) {
  return (report.sections || []).map((s) => {
    const status = s.pass ? 'PASS' : 'FAIL';
    const notes =
      s.failures?.length > 0
        ? s.failures.join('; ')
        : s.reviews?.length
          ? s.reviews.slice(0, 2).join('; ')
          : 'OK';
    return { label: s.label || s.id, status, notes };
  });
}

/**
 * @param {object} report - release-gate report.json payload
 * @returns {{ subject: string, text: string, html: string, idempotencyKey: string }}
 */
export function buildReleaseGateEmail(report) {
  const pass = Boolean(report.pass);
  const verdict = pass ? 'PASS' : 'FAIL';
  const when = report.generatedAt || new Date().toISOString();
  const rows = sectionRows(report);
  const summary = report.summary || {};
  const idempotencyKey = `hirely-release-gate/${when.slice(0, 19)}`;

  const subject = `[Hirely] Release gate ${verdict} — ${summary.passed ?? rows.length}/${summary.total ?? rows.length} checks`;

  const textLines = [
    `Hirely release gate: ${verdict}`,
    `Generated: ${when}`,
    '',
    ...rows.map((r) => `${r.status.padEnd(4)} ${r.label} — ${r.notes}`),
    '',
    `Artifacts: ${REPORT_PATH}, RELEASE_REPORT.md`,
    'Run locally: npm run release:gate',
  ];

  const rowHtml = rows
    .map(
      (r) =>
        `<tr><td style="padding:6px 10px;border-bottom:1px solid #eee;">${escHtml(r.label)}</td>` +
        `<td style="padding:6px 10px;border-bottom:1px solid #eee;font-weight:600;color:${r.status === 'PASS' ? '#0a7a3e' : '#b42318'};">${r.status}</td>` +
        `<td style="padding:6px 10px;border-bottom:1px solid #eee;color:#444;">${escHtml(r.notes)}</td></tr>`
    )
    .join('');

  const html = `<!DOCTYPE html>
<html><body style="font-family:system-ui,-apple-system,sans-serif;line-height:1.45;color:#111;max-width:640px;margin:0 auto;padding:24px;">
  <h1 style="margin:0 0 8px;font-size:20px;">Hirely release gate</h1>
  <p style="margin:0 0 16px;color:#555;">${escHtml(when)}</p>
  <p style="margin:0 0 20px;padding:12px 16px;border-radius:8px;background:${pass ? '#ecfdf3' : '#fef3f2'};border:1px solid ${pass ? '#abefc6' : '#fecdca'};">
    <strong style="font-size:18px;color:${pass ? '#027a48' : '#b42318'};">${verdict}</strong>
    — ${summary.passed ?? rows.length} of ${summary.total ?? rows.length} sections passed
  </p>
  <table style="width:100%;border-collapse:collapse;font-size:14px;">
    <thead><tr style="background:#f9fafb;text-align:left;">
      <th style="padding:8px 10px;">Check</th><th style="padding:8px 10px;">Status</th><th style="padding:8px 10px;">Notes</th>
    </tr></thead>
    <tbody>${rowHtml}</tbody>
  </table>
  <p style="margin:24px 0 0;font-size:13px;color:#666;">Artifacts: <code>${REPORT_PATH}</code>, <code>RELEASE_REPORT.md</code></p>
</body></html>`;

  return { subject, text: textLines.join('\n'), html, idempotencyKey };
}

/**
 * @param {object} opts
 * @param {string} opts.apiKey
 * @param {string} opts.from
 * @param {string|string[]} opts.to
 * @param {ReturnType<typeof buildReleaseGateEmail>} opts.email
 */
export async function sendReleaseGateEmail({ apiKey, from, to, email }) {
  const recipients = Array.isArray(to) ? to : [to];
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': email.idempotencyKey,
    },
    body: JSON.stringify({
      from,
      to: recipients,
      subject: email.subject,
      html: email.html,
      text: email.text,
      tags: [{ name: 'app', value: 'hirely' }, { name: 'event', value: 'release-gate' }],
    }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.message || body?.error || res.statusText;
    throw new Error(`Resend API ${res.status}: ${msg}`);
  }
  return body;
}
