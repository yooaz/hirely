#!/usr/bin/env node
/**
 * Send (or preview) a Resend email summarizing tests/output/release-gate/report.json.
 *
 * Env:
 *   RESEND_API_KEY       — required to send
 *   RESEND_FROM          — e.g. "Hirely <onboarding@resend.dev>"
 *   HIRELY_RELEASE_NOTIFY_TO — comma-separated recipients
 *
 * Usage:
 *   node src/tests/notify-release-gate.mjs           # send if env set
 *   node src/tests/notify-release-gate.mjs --dry-run # print subject + text only
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  buildReleaseGateEmail,
  sendReleaseGateEmail,
} from '../core/notify/release-gate-email.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');
const REPORT_JSON = path.join(root, 'tests/output/release-gate/report.json');
const dryRun = process.argv.includes('--dry-run');

function parseRecipients(raw) {
  return String(raw || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

async function main() {
  if (!fs.existsSync(REPORT_JSON)) {
    console.error(`Missing report. Run: npm run release:gate\n  (${REPORT_JSON})`);
    process.exit(1);
  }

  const report = JSON.parse(fs.readFileSync(REPORT_JSON, 'utf8'));
  const email = buildReleaseGateEmail(report);

  if (dryRun) {
    console.log('--- dry run (no send) ---');
    console.log('Subject:', email.subject);
    console.log('Idempotency-Key:', email.idempotencyKey);
    console.log('\n' + email.text);
    process.exit(0);
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  const to = parseRecipients(process.env.HIRELY_RELEASE_NOTIFY_TO);

  if (!apiKey || !from || !to.length) {
    console.error(
      'Set RESEND_API_KEY, RESEND_FROM, and HIRELY_RELEASE_NOTIFY_TO to send.\n' +
        'Preview with: node src/tests/notify-release-gate.mjs --dry-run'
    );
    process.exit(1);
  }

  const result = await sendReleaseGateEmail({ apiKey, from, to, email });
  console.log('Release gate email sent:', result.id || result);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
