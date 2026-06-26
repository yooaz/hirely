#!/usr/bin/env node
/**
 * P0 — Detection panel contact must match finalResumeData.identity (preview parity).
 */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import {
  resolveIdentityContact,
  hasIdentityPhone,
  hasIdentityEmail,
} from '../src/core/validation/identity-contact.js';
import { buildReviewChecklistFromFinalResume } from '../src/core/validation/review-consistency.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const REPORT = path.join(ROOT, 'CONTACT_CONSISTENCY_REPORT.md');
const FIXTURE = path.join(ROOT, 'tests/fixtures/yoaz-cv/fixture.txt');

function mime(fp) {
  const ext = path.extname(fp).toLowerCase();
  return (
    {
      '.html': 'text/html; charset=utf-8',
      '.js': 'text/javascript; charset=utf-8',
      '.mjs': 'text/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.json': 'application/json',
      '.wasm': 'application/wasm',
      '.svg': 'image/svg+xml',
      '.woff2': 'font/woff2',
      '.txt': 'text/plain',
    }[ext] || 'application/octet-stream'
  );
}

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url || '/', 'http://127.0.0.1');
      let fp = path.join(ROOT, decodeURIComponent(url.pathname));
      if (fp.endsWith('/')) fp = path.join(fp, 'index.html');
      if (!fp.startsWith(ROOT)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }
      fs.readFile(fp, (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end('Not found');
          return;
        }
        res.writeHead(200, { 'Content-Type': mime(fp) });
        res.end(data);
      });
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

async function main() {
  const failures = [];
  const unit = [];

  const pollutedLine = 'yoaz@hotmail.fr · +33 6 49 43 48 39 · Portfolio · LinkedIn';
  const pollutedContact = resolveIdentityContact({
    email: pollutedLine,
    phone: '',
  });
  unit.push({
    name: 'polluted contact line → email + phone',
    pass: pollutedContact.hasEmail && pollutedContact.hasPhone,
    detail: JSON.stringify(pollutedContact),
  });

  const instagramPhone = resolveIdentityContact({
    phone: '+33649434839 instagram.com/yoaz',
  });
  unit.push({
    name: 'strip instagram from phone',
    pass: instagramPhone.hasPhone && instagramPhone.phone === '+33649434839',
    detail: instagramPhone.phone,
  });

  const checklist = buildReviewChecklistFromFinalResume({
    identity: { name: 'Yohann Azancot', email: pollutedLine },
    experiences: [{ role: 'Designer', company: 'Studio' }],
    education: [],
    skills: ['Illustration'],
    tools: [],
  });
  const phoneRow = checklist.find((r) => r.id === 'phone');
  const emailRow = checklist.find((r) => r.id === 'email');
  unit.push({
    name: 'checklist phone from identity',
    pass: !!phoneRow?.ok,
    detail: `phone=${phoneRow?.ok} email=${emailRow?.ok}`,
  });

  for (const u of unit) {
    if (!u.pass) failures.push(`unit: ${u.name} — ${u.detail}`);
  }

  const server = await startServer();
  const port = server.address().port;
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  let browserMetrics = null;

  try {
    await page.goto(`http://127.0.0.1:${port}/index.html?pro=true`, {
      waitUntil: 'domcontentloaded',
      timeout: 120000,
    });
    await page.waitForFunction(
      () => typeof window.HirelyParse?.importText === 'function',
      null,
      { timeout: 180000 }
    );

    const sample = fs.readFileSync(FIXTURE, 'utf8');
    await page.evaluate(async (text) => {
      await window.HirelyParse.importText(text, {
        source: 'contact-consistency-qa',
        trusted: true,
        forceContinue: true,
      });
    }, sample);

    await page.waitForFunction(
      () => document.getElementById('cvDoc')?.classList.contains('cv--live'),
      null,
      { timeout: 120000 }
    );

    await page.evaluate(() => {
      if (typeof setDocStep === 'function') setDocStep('edit');
      if (typeof renderExtractionQualityStep === 'function') renderExtractionQualityStep();
      if (typeof renderMetrics === 'function') renderMetrics();
    });
    await page.waitForTimeout(600);

    browserMetrics = await page.evaluate(() => {
      const frd = typeof getFinalResumeData === 'function' ? getFinalResumeData() : null;
      const panelText = document.getElementById('extractionQualityList')?.innerText || '';
      const checklistText = document.getElementById('studioAtsChecklist')?.innerText || '';
      const weaknessesText = document.getElementById('cvReviewWeaknesses')?.innerText || '';
      const contactEl = document.querySelector('#cvDoc .cvContact');
      const previewContact = contactEl?.textContent?.trim() || '';
      const previewHasPhone = /\d{8,}/.test(previewContact.replace(/\D/g, ''));
      return {
        identity: frd?.identity || {},
        panelText,
        checklistText,
        weaknessesText,
        previewContact,
        previewHasPhone,
      };
    });

    const identity = browserMetrics.identity || {};
    const resolved = {
      email: identity.email,
      phone: identity.phone,
      hasEmail: hasIdentityEmail(identity),
      hasPhone: hasIdentityPhone(identity),
    };

    if (!resolved.hasPhone && browserMetrics.previewHasPhone) {
      failures.push('preview shows phone but identity.phone not resolved');
    }
    if (/Téléphone non détecté/i.test(browserMetrics.panelText) && browserMetrics.previewHasPhone) {
      failures.push('extraction panel says phone missing while preview has phone');
    }
    if (/Téléphone non détecté/i.test(browserMetrics.checklistText) && resolved.hasPhone) {
      failures.push('ATS checklist says phone missing while identity has phone');
    }
    if (/phone number missing|Téléphone/i.test(browserMetrics.weaknessesText) && resolved.hasPhone) {
      failures.push('review weaknesses mention phone while identity has phone');
    }
    if (browserMetrics.previewContact.match(/instagram|linkedin\.com/i)) {
      failures.push('preview contact line still contains social/url pollution');
    }
    if (!resolved.hasEmail) failures.push('fixture email not detected in identity');
    if (!resolved.hasPhone) failures.push('fixture phone not detected in identity');

    browserMetrics.resolved = resolved;
  } finally {
    await browser.close();
    server.close();
  }

  const status = failures.length === 0 ? 'PASS' : 'FAIL';
  const lines = [
    '# Contact Consistency Report',
    '',
    `**Status:** ${status}`,
    `**Date:** ${new Date().toISOString().slice(0, 10)}`,
    '',
    '## Goal',
    '',
    'Detection panel reads `finalResumeData.identity` only. Email/phone normalized; no false "Téléphone non détecté" when preview shows contact.',
    '',
    '## Rules',
    '',
    '| Rule | Implementation |',
    '|------|----------------|',
    '| Email from identity | `resolveIdentityContact` → `hasIdentityEmail` |',
    '| Phone from identity | `normalizeContactPhone` + `stripContactLineNoise` |',
    '| No preview contradiction | `buildReviewChecklistFromFinalResume` + trusted review use identity |',
    '| Clean contact line | `sanitizeIdentity` + pollution strip (Instagram/URLs) |',
    '',
    '## Unit checks',
    '',
    '| Check | Result |',
    '|-------|--------|',
    ...unit.map((u) => `| ${u.name} | ${u.pass ? 'PASS' : 'FAIL'} ${u.detail ? `(${u.detail})` : ''} |`),
    '',
    '## Browser check (Yoaz fixture)',
    '',
    browserMetrics
      ? [
          '| Metric | Value |',
          '|--------|-------|',
          `| Identity email | ${browserMetrics.resolved?.hasEmail ? 'yes' : 'no'} |`,
          `| Identity phone | ${browserMetrics.resolved?.hasPhone ? 'yes' : 'no'} (${browserMetrics.resolved?.phone || '—'}) |`,
          `| Preview contact | ${browserMetrics.previewContact.slice(0, 80)} |`,
          `| Panel phone miss text | ${/Téléphone non détecté/i.test(browserMetrics.panelText) ? 'yes' : 'no'} |`,
          '',
        ].join('\n')
      : '',
    failures.length
      ? ['## Failures', '', ...failures.map((f) => `- ${f}`), ''].join('\n')
      : '## Acceptance\n\nPanel contact detection matches normalized `finalResumeData.identity` and CV preview.\n',
    '## Run',
    '',
    '```bash',
    'npm run contact-consistency-report',
    '```',
    '',
  ];

  fs.writeFileSync(REPORT, lines.join('\n'));
  console.log(`Contact consistency: ${status}`);
  console.log(`Report: ${REPORT}`);
  if (failures.length) {
    failures.forEach((f) => console.error('FAIL:', f));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
