#!/usr/bin/env node
/**
 * P0 — REAL FORMAT QA
 * Real corpus files per format; terminal outcomes only — never crash or stuck.
 */
import fs from 'fs';
import http from 'http';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { canonicalImportFromFile } from '../core/import/canonical-import.js';
import {
  IMPORT_STATE,
  importStateNeedsPaste,
  mapLegacyStatusToImportState,
} from '../core/import/import-status.js';
import { H7_TERMINAL_STATES } from '../../tests/lib/h7-import-catalog.mjs';
import {
  buildRealFormatCases,
  caseFile,
  ensureRealFormatQaFixtures,
} from '../../tests/lib/real-format-qa-fixtures.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT_DIR = path.join(ROOT, 'tests/output/real-format-qa');
const OUT_JSON = path.join(OUT_DIR, 'report.json');

const QA_VERSION = 'REAL_FORMAT_QA_V1';
const IMPORT_TIMEOUT_MS = 90000;
const BROWSER_STUCK_MS = 28000;

const ALLOWED_OUTCOMES = new Set([
  'IMPORT_READY',
  'IMPORT_PARTIAL',
  'IMPORT_NEEDS_PASTE',
  'IMPORT_UNSUPPORTED',
]);

const FORBIDDEN_OUTCOMES = new Set(['IMPORT_CRASH', 'IMPORT_STUCK']);

const require = createRequire(import.meta.url);

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

async function bootstrapNodeExtractors() {
  if (!globalThis.mammoth) {
    const m = await import('mammoth');
    globalThis.mammoth = m.default || m;
  }
  if (!globalThis.pdfjsLib) {
    const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');
    pdfjs.GlobalWorkerOptions.workerSrc = require.resolve(
      'pdfjs-dist/legacy/build/pdf.worker.js'
    );
    globalThis.pdfjsLib = pdfjs;
  }
}

function importRace(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(label || 'IMPORT_TIMEOUT_STUCK')), ms)
    ),
  ]);
}

function isUnsupportedBlob(errors = [], warnings = [], fileName = '') {
  const blob = [...errors, ...warnings].join(' ');
  const ext = path.extname(fileName || '').toLowerCase();
  return (
    /\.bin$|\.exe$|\.zip$/i.test(fileName || '') ||
    /unsupported|not supported|format inconnu|invalid file|unknown format/i.test(blob) ||
    (ext === '.doc' && /invalid|corrupt|not a valid|unsupported/i.test(blob))
  );
}

/**
 * @param {object} row
 */
export function classifyRealFormatOutcome(row) {
  if (row.crashed || row.threw) return 'IMPORT_CRASH';
  if (row.stuck || row.timedOut) return 'IMPORT_STUCK';
  if (row.unsupported) return 'IMPORT_UNSUPPORTED';

  const legacy = row.importStatus || '';
  const state =
    row.importState ||
    (legacy ? mapLegacyStatusToImportState(legacy) : '') ||
    '';

  if (state === IMPORT_STATE.IMPORT_READY) return 'IMPORT_READY';
  if (state === IMPORT_STATE.IMPORT_PARTIAL) return 'IMPORT_PARTIAL';
  if (
    importStateNeedsPaste(state) ||
    state === IMPORT_STATE.IMPORT_NEEDS_PASTE ||
    ['PDF_OCR_TIMEOUT', 'PDF_TEXT_EMPTY', 'PASTE_FALLBACK_REQUIRED'].includes(legacy)
  ) {
    return 'IMPORT_NEEDS_PASTE';
  }
  if (state === IMPORT_STATE.IMPORT_FAILED) {
    if (isUnsupportedBlob(row.errors, row.warnings, row.fileName)) {
      return 'IMPORT_UNSUPPORTED';
    }
    return 'IMPORT_NEEDS_PASTE';
  }

  if (state && !H7_TERMINAL_STATES.has(state) && !Object.values(IMPORT_STATE).includes(state)) {
    return 'IMPORT_STUCK';
  }
  if (!state && !legacy) return 'IMPORT_STUCK';
  return 'IMPORT_NEEDS_PASTE';
}

/**
 * @param {object} caseDef
 */
async function runNodeImportCase(caseDef) {
  const row = {
    id: caseDef.id,
    category: caseDef.category,
    label: caseDef.label,
    fileName: caseDef.name,
    channel: 'node',
    importState: '',
    importStatus: '',
    rawTextLength: 0,
    errors: [],
    warnings: [],
    crashed: false,
    threw: null,
    stuck: false,
    timedOut: false,
    unsupported: false,
    qaOutcome: '',
    pass: false,
    durationMs: 0,
  };

  const file = caseFile(caseDef);
  if (!file) {
    row.unsupported = true;
    row.qaOutcome = 'IMPORT_UNSUPPORTED';
    row.pass = ALLOWED_OUTCOMES.has(row.qaOutcome);
    row.errors.push('fixture_missing');
    return row;
  }

  const t0 = Date.now();
  try {
    const canon = await importRace(
      canonicalImportFromFile(file),
      IMPORT_TIMEOUT_MS,
      'IMPORT_TIMEOUT_STUCK'
    );

    row.importState = canon.importState || '';
    row.importStatus = canon.importStatus || '';
    row.rawTextLength = (canon.rawText || canon.cleanedText || '').length;
    row.errors = [...(canon.errors || [])].slice(0, 8);
    row.warnings = [...(canon.warnings || [])].slice(0, 8);
    row.unsupported = isUnsupportedBlob(row.errors, row.warnings, caseDef.name);
  } catch (err) {
    const msg = String(err?.message || err);
    if (/IMPORT_TIMEOUT_STUCK|timeout/i.test(msg)) {
      row.stuck = true;
      row.timedOut = true;
      row.errors.push(msg);
    } else {
      row.crashed = true;
      row.threw = msg;
      row.errors.push(msg);
    }
  }

  row.durationMs = Date.now() - t0;
  row.qaOutcome = classifyRealFormatOutcome(row);
  row.pass =
    ALLOWED_OUTCOMES.has(row.qaOutcome) && !FORBIDDEN_OUTCOMES.has(row.qaOutcome);
  return row;
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
      '.pdf': 'application/pdf',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.doc': 'application/msword',
      '.txt': 'text/plain',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
    }[ext] || 'application/octet-stream'
  );
}

function startServer(port) {
  return http.createServer((req, res) => {
    const u = req.url.split('?')[0];
    const rel = u === '/' ? '/index.html' : u;
    const fp = path.join(ROOT, decodeURIComponent(rel));
    if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, { 'Content-Type': mime(fp) });
    fs.createReadStream(fp).pipe(res);
  });
}

/**
 * @param {object} caseDef
 */
async function runBrowserStuckCheck(caseDef) {
  const row = {
    id: `${caseDef.id}_browser`,
    category: caseDef.category,
    label: `${caseDef.label} (browser)`,
    fileName: caseDef.name,
    channel: 'browser',
    stuck: false,
    crashed: false,
    threw: null,
    qaOutcome: '',
    pass: false,
    busy: true,
    fallback: false,
    live: false,
    durationMs: 0,
  };

  if (!caseDef.path || !fs.existsSync(caseDef.path)) {
    row.qaOutcome = 'IMPORT_UNSUPPORTED';
    row.pass = true;
    return row;
  }

  const server = startServer(0);
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  const browser = await chromium.launch({ headless: true });
  const t0 = Date.now();

  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction(() => typeof window.handleFileImport === 'function', {
      timeout: 120000,
    });

    const buf = fs.readFileSync(caseDef.path);
    await page.evaluate(
      async ({ bytes, fname, mimeType }) => {
        const u8 = new Uint8Array(bytes);
        const file = new File([u8], fname, { type: mimeType });
        await window.handleFileImport(file);
      },
      { bytes: [...buf], fname: caseDef.name, mimeType: mime(caseDef.path) }
    );

    const deadline = Date.now() + BROWSER_STUCK_MS;
    let snap = null;
    while (Date.now() < deadline) {
      snap = await page.evaluate(() => ({
        busy: document.getElementById('wsImport')?.classList.contains('wsImport--loading'),
        fallback: document.getElementById('importPasteFallback')?.classList.contains('show'),
        needsPaste: document.getElementById('wsImport')?.classList.contains('wsImport--needsPaste'),
        live: document.getElementById('cvDoc')?.classList.contains('cv--live'),
        lastStatus: window.state?.lastImportStatus || '',
        progressHidden: document.getElementById('progress')?.classList.contains('hidden'),
      }));
      if (!snap.busy && (snap.fallback || snap.needsPaste || snap.live)) break;
      await page.waitForTimeout(350);
    }

    row.busy = !!snap?.busy;
    row.fallback = !!snap?.fallback;
    row.live = !!snap?.live;
    row.importStatus = snap?.lastStatus || '';
    row.stuck = row.busy;
    row.qaOutcome = row.stuck ? 'IMPORT_STUCK' : 'IMPORT_NEEDS_PASTE';
    if (row.live) row.qaOutcome = 'IMPORT_READY';
    row.pass = !FORBIDDEN_OUTCOMES.has(row.qaOutcome);
  } catch (err) {
    row.crashed = true;
    row.threw = String(err?.message || err);
    row.qaOutcome = 'IMPORT_CRASH';
    row.pass = false;
  } finally {
    row.durationMs = Date.now() - t0;
    await browser.close();
    server.close();
  }

  return row;
}

// --- Main ---
fs.mkdirSync(OUT_DIR, { recursive: true });
await bootstrapNodeExtractors();

const { files } = await ensureRealFormatQaFixtures(ROOT);
const cases = buildRealFormatCases(files);

const counts = {
  pdf_selectable: 0,
  pdf_scanned: 0,
  docx: 0,
  doc_legacy: 0,
  txt: 0,
  image: 0,
};

const nodeResults = [];
for (const caseDef of cases) {
  if (!caseDef.path || !fs.existsSync(caseDef.path)) {
    ok(false, `fixture exists: ${caseDef.id}`);
    continue;
  }
  counts[caseDef.category] = (counts[caseDef.category] || 0) + 1;
  const row = await runNodeImportCase(caseDef);
  nodeResults.push(row);
  ok(row.pass, `${caseDef.id} → ${row.qaOutcome} (${row.rawTextLength} chars, ${row.durationMs}ms)`);
  ok(!FORBIDDEN_OUTCOMES.has(row.qaOutcome), `${caseDef.id} not forbidden`);
}

ok(counts.pdf_selectable >= 3, `pdf_selectable count ${counts.pdf_selectable}`);
ok(counts.pdf_scanned >= 3, `pdf_scanned count ${counts.pdf_scanned}`);
ok(counts.docx >= 3, `docx count ${counts.docx}`);
ok(counts.doc_legacy >= 1, `doc_legacy count ${counts.doc_legacy}`);
ok(counts.txt >= 2, `txt count ${counts.txt}`);
ok(counts.image >= 2, `image count ${counts.image}`);

const browserResults = [];
for (const caseDef of cases.filter((c) => c.browserStuckCheck)) {
  const row = await runBrowserStuckCheck(caseDef);
  browserResults.push(row);
  ok(row.pass, `browser ${caseDef.id} → ${row.qaOutcome} busy=${row.busy}`);
  ok(row.qaOutcome !== 'IMPORT_STUCK', `browser ${caseDef.id} not stuck`);
  ok(row.qaOutcome !== 'IMPORT_CRASH', `browser ${caseDef.id} not crash`);
}

const allResults = [...nodeResults, ...browserResults];
const crashes = allResults.filter((r) => r.qaOutcome === 'IMPORT_CRASH');
const stuck = allResults.filter((r) => r.qaOutcome === 'IMPORT_STUCK');
ok(crashes.length === 0, `no IMPORT_CRASH (${crashes.length})`);
ok(stuck.length === 0, `no IMPORT_STUCK (${stuck.length})`);

const byOutcome = {};
for (const r of nodeResults) {
  byOutcome[r.qaOutcome] = (byOutcome[r.qaOutcome] || 0) + 1;
}

const report = {
  generatedAt: new Date().toISOString(),
  version: QA_VERSION,
  pass: failed === 0,
  counts,
  byOutcome,
  forbidden: {
    IMPORT_CRASH: crashes.length,
    IMPORT_STUCK: stuck.length,
  },
  cases: nodeResults,
  browserChecks: browserResults,
};

fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2));
console.log('\nWrote', OUT_JSON);
console.log(failed ? `\n${failed} failed` : '\nAll REAL FORMAT QA checks passed');
process.exit(failed ? 1 : 0);
