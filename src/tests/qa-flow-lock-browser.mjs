#!/usr/bin/env node
/**
 * P0 — Flow lock browser QA (Yoaz PDF).
 * node src/tests/qa-flow-lock-browser.mjs
 */
import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { isExtensionConsoleNoise } from '../../tests/lib/qa-console-filter.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');
const outDir = path.join(root, 'tests/output/flow-lock-browser-qa');
fs.mkdirSync(outDir, { recursive: true });

const EXPECTED_SEQUENCE = [
  'CORE_BOOT_OK',
  'IMPORT_STARTED',
  'EXTRACTION_DONE',
  'PARSER_DONE',
  'FINAL_RESUME_READY',
  'REVIEW_SCREEN_VISIBLE',
  'RENDER_DONE',
];

const PDF_CANDIDATES = [
  process.env.HIRELY_YOAZ_PDF,
  '/Users/yohannazancot/Documents/cv/cv2022 yohann azancot copie.pdf',
  '/Users/yohannazancot/Documents/cv2022 yohann azancot copie.pdf',
].filter(Boolean);

function resolvePdf() {
  for (const p of PDF_CANDIDATES) {
    if (p && fs.existsSync(p)) return p;
  }
  return null;
}

function mime(fp) {
  const ext = path.extname(fp).toLowerCase();
  return (
    {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.mjs': 'text/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
    }[ext] || 'application/octet-stream'
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

function extractTags(lines) {
  const tags = [];
  for (const text of lines) {
    for (const step of EXPECTED_SEQUENCE) {
      if (step === 'CORE_BOOT_OK' && text.includes('CORE_BOOT_OK')) tags.push(step);
      else if (new RegExp(`\\b${step}\\b`).test(text)) tags.push(step);
    }
    if (/\[Hirely import\]\s+(\S+)/.test(text)) {
      const m = text.match(/\[Hirely import\]\s+(\S+)/);
      if (m) tags.push(m[1].split(/\s/)[0]);
    }
  }
  return tags;
}

function sequenceOk(tags) {
  let last = -1;
  for (const step of EXPECTED_SEQUENCE) {
    const idx = tags.indexOf(step, last + 1);
    if (idx < 0) return { ok: false, missing: step };
    last = idx;
  }
  return { ok: true };
}

const pdfPath = resolvePdf();
if (!pdfPath) {
  console.error('Yoaz PDF not found — set HIRELY_YOAZ_PDF');
  process.exit(1);
}

let failed = 0;
const failures = [];
function ok(cond, msg) {
  if (!cond) {
    failed++;
    failures.push(msg);
    console.error('FAIL', msg);
  } else console.log('OK', msg);
}

const port = 3060 + Math.floor(Math.random() * 40);
const server = startServer(port);
await new Promise((r) => server.listen(port, r));

const consoleLines = [];
const pageErrors = [];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.setDefaultTimeout(360000);

page.on('console', (msg) => {
  const text = msg.text();
  consoleLines.push({ type: msg.type(), text });
  if (/CORE_BOOT|IMPORT_|EXTRACTION_|PARSER_|FINAL_RESUME|REVIEW_SCREEN|RENDER_|RESUME_DATA_FLOW|BROWSER_RESUMEDATA/i.test(text)) {
    console.log('[browser]', text);
  }
});
page.on('pageerror', (err) => {
  const text = String(err?.message || err);
  if (!isExtensionConsoleNoise(text)) pageErrors.push(text);
});

async function waitImportDone(maxMs = 360000) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    const s = await page.evaluate(() => ({
      live: document.getElementById('cvDoc')?.classList.contains('cv--live'),
      busy: document.getElementById('wsImport')?.classList.contains('wsImport--loading'),
      fallback: document.getElementById('importPasteFallback')?.classList.contains('show'),
      workspace: document.getElementById('app')?.classList.contains('app--workspace'),
      gate: !document.getElementById('extractionGate')?.classList.contains('hidden'),
    }));
    if (s.gate) {
      const cont = page.locator('#extractionGateContinue');
      if ((await cont.count()) > 0 && (await cont.isVisible())) {
        await cont.click();
        await page.waitForTimeout(400);
        continue;
      }
    }
    if ((s.live || s.workspace) && !s.busy && !s.fallback) return s;
    await page.waitForTimeout(500);
  }
  return { live: false, timeout: true };
}

let report = {};

try {
  await page.goto(`http://127.0.0.1:${port}/?pro=true`, {
    waitUntil: 'domcontentloaded',
    timeout: 120000,
  });
  await page.waitForFunction(
    () => typeof window.HirelyParse?.handleFileImport === 'function',
    { timeout: 180000 }
  );
  await page.waitForTimeout(500);

  const pdfBuf = fs.readFileSync(pdfPath);
  await page.evaluate(
    async ({ b64, name }) => {
      const bin = atob(b64);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      const file = new File([arr], name, { type: 'application/pdf' });
      window.__flowLockImportReturn = await window.HirelyParse.handleFileImport(
        file,
        'flow-lock-browser-qa'
      );
    },
    { b64: pdfBuf.toString('base64'), name: path.basename(pdfPath) }
  );

  const done = await waitImportDone();
  await page.waitForTimeout(2000);

  const snap = await page.evaluate(() => {
    const cvDoc = document.getElementById('cvDoc');
    const cvText = (cvDoc?.innerText || '').trim();
    const rd =
      window.HirelyParse?.lastResult?.resumeData || window.__hirelyState?.resumeData;
    return {
      cvLive: !!cvDoc?.classList.contains('cv--live'),
      cvTextLen: cvText.length,
      workspace: document.getElementById('app')?.classList.contains('app--workspace'),
      pasteFallback: document.getElementById('importPasteFallback')?.classList.contains('show'),
      importPanelImported: document.getElementById('wsImport')?.classList.contains('importPanel--imported'),
      lastImportStatus:
        window.__hirelyState?.lastImportStatus ||
        (window.HirelyParse?.lastImportStatus ?? ''),
      importReturn: window.__flowLockImportReturn || '',
      resumeCounts: {
        experiences: (rd?.experiences || []).length,
        education: (rd?.education || []).length,
        skills: (rd?.skills || []).length,
        clients: (rd?.clients || []).length,
      },
      hasEmail: !!(rd?.identity?.email || '').trim(),
      hasExp: (rd?.experiences || []).length > 0,
    };
  });

  const logs = consoleLines.map((l) => l.text);
  const tags = extractTags(logs);
  const seq = sequenceOk(tags);

  const flowLockFatal = logs.some(
    (t) =>
      /RESUME_DATA_FLOW_LOCK_FATAL/i.test(t) ||
      (t.includes('RESUME_DATA_FLOW_LOCK') && consoleLines.find((l) => l.text === t)?.type === 'error')
  );
  const coreBootFailed = logs.some((t) => /CORE_BOOT_FAILED/i.test(t));

  for (const step of EXPECTED_SEQUENCE) {
    ok(tags.includes(step), `console sequence includes ${step}`);
  }
  ok(seq.ok, seq.ok ? 'console sequence in order' : `console sequence missing after ${seq.missing}`);
  ok(!coreBootFailed, 'no CORE_BOOT_FAILED');
  ok(!flowLockFatal, 'no RESUME_DATA_FLOW_LOCK fatal');
  ok(!snap.pasteFallback, 'not stuck on import paste fallback');
  ok(snap.workspace || snap.importPanelImported, 'workspace visible (Review / Mon CV)');
  ok(snap.cvLive, 'CV preview live');
  ok(snap.cvTextLen > 120, `CV not empty after parser (len=${snap.cvTextLen})`);
  const terminalStatus = snap.lastImportStatus || snap.importReturn || '';
  ok(
    terminalStatus === 'IMPORT_READY' || terminalStatus === 'IMPORT_PARTIAL',
    `terminal import status OK (${terminalStatus})`
  );
  ok(pageErrors.length === 0, `no page errors (${pageErrors.length})`);

  report = {
    pdf: pdfPath,
    timestamp: new Date().toISOString(),
    expectedSequence: EXPECTED_SEQUENCE,
    observedTags: tags,
    sequenceInOrder: seq.ok,
    snap,
    forbidden: {
      coreBootFailed,
      flowLockFatal,
      stuckImport: snap.pasteFallback,
      emptyCv: snap.cvTextLen < 120,
    },
    failures,
    pass: failed === 0,
  };

  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
  await page.screenshot({ path: path.join(outDir, 'after-import.png'), fullPage: false });
} finally {
  await browser.close();
  server.close();
}

const md = `# FLOW_LOCK_BROWSER_QA

Generated: ${report.timestamp || new Date().toISOString()}

## Yoaz PDF

\`${pdfPath}\`

## Expected console sequence

\`\`\`
${EXPECTED_SEQUENCE.join('\n')}
\`\`\`

## Observed tags (in order)

\`\`\`
${(report.observedTags || []).join('\n')}
\`\`\`

## UI state

| Check | Result |
|-------|--------|
| Workspace visible | ${report.snap?.workspace ? 'yes' : 'no'} |
| CV preview live | ${report.snap?.cvLive ? 'yes' : 'no'} |
| CV text length | ${report.snap?.cvTextLen ?? 0} |
| Import status | ${report.snap?.lastImportStatus || '—'} |
| Paste fallback | ${report.snap?.pasteFallback ? 'shown' : 'hidden'} |

## Forbidden

| Check | Result |
|-------|--------|
| CORE_BOOT_FAILED | ${report.forbidden?.coreBootFailed ? 'YES (fail)' : 'no'} |
| RESUME_DATA_FLOW_LOCK fatal | ${report.forbidden?.flowLockFatal ? 'YES (fail)' : 'no'} |
| Stuck on import screen | ${report.forbidden?.stuckImport ? 'YES (fail)' : 'no'} |
| Empty CV after parser | ${report.forbidden?.emptyCv ? 'YES (fail)' : 'no'} |

## Failures

${failures.length ? failures.map((f) => `- ${f}`).join('\n') : '- none'}

## Verdict

**${report.pass ? 'PASS' : 'FAIL'}**

${report.pass ? '' : `**Remaining blocker:** ${failures[0] || 'see failures above'}`}
`;

fs.writeFileSync(path.join(root, 'FLOW_LOCK_BROWSER_QA.md'), md, 'utf8');
console.log('\nWrote FLOW_LOCK_BROWSER_QA.md');
console.log(`Verdict: ${report.pass ? 'PASS' : 'FAIL'}`);
if (!report.pass && failures[0]) console.log('Blocker:', failures[0]);

process.exit(failed ? 1 : 0);
