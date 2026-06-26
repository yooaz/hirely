#!/usr/bin/env node
/**
 * H17 — Production reality audit (real browser path only).
 */
import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import { writeFileSync } from 'fs';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const outDir = path.join(root, 'tests/output/h17-production-reality');
const tracePath = path.join(root, 'IMPORT_TRACE.json');
const reportPath = path.join(root, 'PRODUCTION_REALITY_AUDIT.md');

fs.mkdirSync(outDir, { recursive: true });

const PDF_CANDIDATES = [
  process.env.HIRELY_PRODUCTION_PDF,
  path.join(root, 'tests/output/p7-final-lock/fixture.pdf'),
  path.join(root, 'tests/output/h4-end-to-end/yoaz-upload.pdf'),
  process.env.HIRELY_YOAZ_PDF,
  '/Users/yohannazancot/Documents/cv/cv2022 yohann azancot copie.pdf',
  '/Users/yohannazancot/Documents/cv2022 yohann azancot copie.pdf',
  path.join(root, 'tests/output/final-browser-qa/yoaz-scanned-pdf.pdf'),
].filter((p) => p && fs.existsSync(p));

function mime(fp) {
  const ext = path.extname(fp).toLowerCase();
  return (
    { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json' }[
      ext
    ] || 'application/octet-stream'
  );
}

function startServer(port) {
  return http.createServer((req, res) => {
    const u = req.url.split('?')[0];
    let p = u === '/' ? '/index.html' : u;
    const fp = path.join(root, decodeURIComponent(p));
    if (!fp.startsWith(root) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, { 'Content-Type': mime(fp) });
    fs.createReadStream(fp).pipe(res);
  });
}

function mdEscape(s) {
  return String(s || '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

async function importPdf(page, pdfPath) {
  const pdfBuf = fs.readFileSync(pdfPath);
  const outcome = await page.evaluate(
    async ({ b64, name }) => {
      globalThis.HIRELY_PRODUCTION_TRACE = true;
      const bin = atob(b64);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      const file = new File([arr], name, { type: 'application/pdf' });
      return window.HirelyParse.handleFileImport(file, 'production-reality-audit');
    },
    { b64: pdfBuf.toString('base64'), name: path.basename(pdfPath) }
  );

  await page.waitForFunction(
    () => {
      const d = document.getElementById('cvDoc');
      const trace = window.HIRELY_IMPORT_TRACE;
      const live = !!(d && d.classList.contains('cv--live') && (d.innerText || '').length > 40);
      const paste = document.getElementById('importPasteFallback')?.classList.contains('show');
      return live || paste || trace;
    },
    { timeout: 150000 }
  );

  if (!(await page.evaluate(() => window.HIRELY_IMPORT_TRACE))) {
    await page.evaluate(async () => {
      if (window.HirelyProductionTrace?.capture) await window.HirelyProductionTrace.capture();
    });
  }

  return page.evaluate((importOutcome) => {
    const d = document.getElementById('cvDoc');
    const trace = window.HIRELY_IMPORT_TRACE || window.HirelyProductionTrace?.getLastTrace?.();
    const paste = document.getElementById('importPasteFallback')?.classList.contains('show');
    return {
      outcome: importOutcome,
      live: !!(d && d.classList.contains('cv--live')),
      previewLen: (d?.innerText || '').length,
      previewName: (d?.innerText || '').split('\n').find((l) => l.trim())?.trim() || '',
      pasteFallback: paste,
      rawLen: (window.HirelyParse?.lastResult?.rawText || trace?.RAW_TEXT_CAPTURE?.rawText || '').length,
      trace,
    };
  }, outcome);
}

const audit = { path: 'browser-production', attempts: [], trace: null, summary: null };

const port = 3055 + Math.floor(Math.random() * 40);
const server = startServer(port);
await new Promise((r) => server.listen(port, r));
const base = `http://127.0.0.1:${port}/?productionTrace=1`;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.setDefaultTimeout(180000);

try {
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => typeof window.HirelyParse?.handleFileImport === 'function', {
    timeout: 120000,
  });
  console.log('PASS Browser boot — handleFileImport ready');

  if (!PDF_CANDIDATES.length) {
    console.log('FAIL No PDF available for production audit');
  }

  let best = null;
  for (const pdfPath of PDF_CANDIDATES) {
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.HirelyParse?.handleFileImport === 'function');
    console.log(`\n— Trying ${pdfPath}`);
    const state = await importPdf(page, pdfPath);
    const attempt = {
      pdfPath,
      ...state,
      ok: state.live && !state.pasteFallback && state.rawLen > 0,
    };
    audit.attempts.push(attempt);
    console.log(
      `${attempt.ok ? 'PASS' : 'FAIL'} ${path.basename(pdfPath)} — outcome=${state.outcome} raw=${state.rawLen} preview=${state.previewLen}`
    );
    if (!best || (attempt.ok && !best.ok) || (attempt.previewLen > (best.previewLen || 0))) {
      best = attempt;
    }
    if (attempt.ok) break;
  }

  audit.trace = best?.trace || null;
  if (audit.trace) {
    writeFileSync(tracePath, JSON.stringify(audit.trace, null, 2));
    console.log(`\nWrote ${tracePath}`);
    await page.screenshot({ path: path.join(outDir, 'production-preview.png'), fullPage: false });
  }
} finally {
  await browser.close();
  server.close();
}

const trace = audit.trace;
const traceability = trace?.traceability || { pass: false, violations: [], traced: [] };
const losses = trace?.informationLoss || [];
const identity = trace?.FINAL_RESUME_DATA?.identity || {};
const bestAttempt = audit.attempts.find((a) => a.ok) || audit.attempts[audit.attempts.length - 1];
const hasLivePreview = !!bestAttempt?.ok;
const hasTrace = !!trace;
const hasRawText = !!trace && trace.meta?.rawChars > 0;

const pass = hasLivePreview && hasRawText && traceability.pass;

audit.summary = {
  pass,
  hasLivePreview,
  hasTrace,
  bestPdf: bestAttempt?.pdfPath || null,
  rawChars: trace?.meta?.rawChars || 0,
  previewChars: trace?.FINAL_PREVIEW?.plainText?.length || 0,
  identity,
  traceabilityPass: traceability.pass,
  untraceableFields: traceability.violations?.length || 0,
  informationLossPoints: losses.length,
  reviewQueue: trace?.REVIEW_QUEUE?.length || 0,
  attempts: audit.attempts.length,
};

const attemptRows = audit.attempts
  .map(
    (a) =>
      `| ${path.basename(a.pdfPath)} | ${a.ok ? 'PASS' : 'FAIL'} | ${a.outcome} | ${a.rawLen} | ${a.previewLen} | ${mdEscape(a.previewName.slice(0, 40))} |`
  )
  .join('\n');

const lossRows = losses
  .map((l) => `| ${l.stage} | ${l.field} | ${mdEscape(l.detail)} |`)
  .join('\n');

const violationRows = (traceability.violations || [])
  .map((v) => `| ${v.path} | ${mdEscape(v.value)} | ${v.reason} | ${v.source} |`)
  .join('\n');

const tracedRows = (traceability.traced || [])
  .slice(0, 24)
  .map((t) => `| ${t.path} | ${mdEscape(t.value)} | ${t.source} |`)
  .join('\n');

const md = `# Production Reality Audit (H17)

**Verdict:** ${pass ? 'PASS — live browser import traced' : 'FAIL — production path diverges from QA'}

## Mission

Audit the **real browser path** only:

\`\`\`
User uploads PDF → OCR → extraction → classification → review → preview → export
\`\`\`

Not fixture runners, not mock pipelines, not benchmark harnesses.

## PDF attempts (real upload via handleFileImport)

| PDF | Result | Outcome | Raw chars | Preview chars | First preview line |
|-----|--------|---------|----------:|--------------:|--------------------|
${attemptRows || '| — | — | — | — | — | — |'}

**Best attempt:** ${bestAttempt?.pdfPath ? `\`${bestAttempt.pdfPath}\`` : '—'}

## Trace artifact

| File | Status |
|------|--------|
| \`IMPORT_TRACE.json\` | ${hasTrace ? (hasRawText ? 'written (with raw text)' : 'written (OCR failed — empty raw)') : 'missing'} |
| Screenshot | \`tests/output/h17-production-reality/production-preview.png\` |

### Trace sections

| Section | Purpose |
|---------|---------|
| RAW_TEXT_CAPTURE | OCR + extraction output |
| IDENTITY_CANDIDATES | Name/title candidates |
| EXPERIENCE_CANDIDATES | Experience detections |
| EDUCATION_CANDIDATES | Education detections |
| SKILL_CANDIDATES | Skills/tools detections |
| FINAL_RESUME_DATA | Committed structured CV |
| REVIEW_QUEUE | Manual review items |
| FINAL_PREVIEW | Rendered A4 preview fields |

## Preview identity (production)

| Field | Value |
|-------|-------|
| Name | ${mdEscape(identity.name)} |
| Title | ${mdEscape(identity.title)} |
| Email | ${mdEscape(identity.email)} |
| Phone | ${mdEscape(identity.phone)} |

## Information loss

| Stage | Field | Detail |
|-------|-------|--------|
${lossRows || '| — | — | — |'}

## Traceability acceptance

Every preview field must trace to **RAW_TEXT** or **USER_ACTION** — no invented values.

| Metric | Value |
|--------|-------|
| Traceability pass | ${traceability.pass ? 'yes' : 'no'} |
| Traced fields | ${traceability.tracedCount ?? traceability.traced?.length ?? 0} |
| Untraceable / generated | ${traceability.violationCount ?? traceability.violations?.length ?? 0} |

### Traced fields

| Path | Value | Source |
|------|-------|--------|
${tracedRows || '| — | — | — |'}

### Violations

| Path | Value | Reason | Source |
|------|-------|--------|--------|
${violationRows || '| — | — | — | — |'}

## Why QA passes but screenshots look wrong

| QA path | Production path | Gap |
|---------|-----------------|-----|
| Fixture text / paste | PDF upload + OCR | OCR timeout or empty raw in headless browser |
| Direct pipeline calls | handleFileImport UI | Different failure handling & paste fallback |
| Bench ground truth | User-visible preview | Name/title not validated against RAW_TEXT |

This audit captures **IMPORT_TRACE.json** so every preview field can be checked against **RAW_TEXT_CAPTURE** and **REVIEW_QUEUE**.

## Re-run

\`\`\`bash
npm run qa:h17-production-reality-audit
HIRELY_PRODUCTION_PDF=/path/to/cv.pdf npm run production-reality-audit
\`\`\`
`;

writeFileSync(reportPath, md);
writeFileSync(path.join(outDir, 'audit.json'), JSON.stringify(audit, null, 2));
console.log(`Wrote ${reportPath}`);
process.exit(pass ? 0 : 1);
