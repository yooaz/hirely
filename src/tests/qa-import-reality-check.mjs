#!/usr/bin/env node
/**
 * P0 — IMPORT REALITY CHECK
 * Six format categories after local OCR fix; terminal outcomes + text metrics only.
 */
import fs from 'fs';
import http from 'http';
import path from 'path';
import { spawnSync } from 'child_process';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { classifyImportOutcome } from '../../tests/lib/import-outcome-classifier.mjs';
import {
  evaluateImportProductPass,
  evaluateImportAcceptableOutcome,
  evaluateTerminalSafety,
  NO_FAKE_PASS_VERSION,
} from '../../tests/lib/no-fake-pass-import-policy.mjs';
import {
  IMPORT_STATE,
  mapLegacyStatusToImportState,
} from '../core/import/import-status.js';
import {
  TESSERACT_REQUIRED_ASSETS,
} from '../vendor/tesseract-runtime.js';
import {
  ensureRealFormatQaFixtures,
  caseFile,
} from '../../tests/lib/real-format-qa-fixtures.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT_DIR = path.join(ROOT, 'tests/output/import-reality-check');
const OUT_JSON = path.join(OUT_DIR, 'report.json');

const QA_VERSION = 'IMPORT_REALITY_CHECK_V1';
const IMPORT_TIMEOUT_MS = 90000;
const POLL_MS = 350;

const ALLOWED_OUTCOMES = new Set([
  'IMPORT_READY',
  'IMPORT_PARTIAL',
  'IMPORT_NEEDS_PASTE',
  'IMPORT_UNSUPPORTED',
]);

const FORBIDDEN_OUTCOMES = new Set(['IMPORT_CRASH', 'IMPORT_STUCK']);

/** @type {import('../../tests/lib/real-format-qa-fixtures.mjs').RealFormatCase[]} */
const REALITY_CASES = [
  {
    id: 'pdf_selectable',
    category: 'pdf_selectable',
    label: 'Selectable PDF',
    fileKey: 'pdf_sel_yoaz',
    name: 'yoaz-selectable.pdf',
  },
  {
    id: 'pdf_scanned',
    category: 'pdf_scanned',
    label: 'Scanned PDF (blank page)',
    fileKey: 'pdf_scan_blank',
    name: 'blank-scan.pdf',
  },
  {
    id: 'pdf_protected',
    category: 'pdf_protected',
    label: 'Protected PDF',
    fileKey: 'pdf_scan_protected',
    name: 'protected-scan.pdf',
  },
  {
    id: 'docx',
    category: 'docx',
    label: 'DOCX',
    fileKey: 'docx_yoaz',
    name: 'yoaz.docx',
  },
  {
    id: 'txt',
    category: 'txt',
    label: 'TXT',
    fileKey: 'txt_yoaz',
    name: 'yoaz.txt',
  },
  {
    id: 'img_png',
    category: 'image',
    label: 'Image PNG',
    fileKey: 'img_png',
    name: 'cv-scan.png',
  },
  {
    id: 'img_jpg',
    category: 'image',
    label: 'Image JPG',
    fileKey: 'img_jpg',
    name: 'cv-scan.jpg',
  },
];

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

function ensureVendorTesseract() {
  const missing = TESSERACT_REQUIRED_ASSETS.some((p) =>
    !fs.existsSync(path.join(ROOT, p.replace(/^\//, '')))
  );
  if (!missing) return;
  const res = spawnSync('node', ['scripts/setup-vendor-tesseract.mjs'], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: 'inherit',
  });
  if (res.status !== 0) {
    throw new Error('setup-vendor-tesseract failed');
  }
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
      '.txt': 'text/plain',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.wasm': 'application/wasm',
      '.gz': 'application/gzip',
    }[ext] || 'application/octet-stream'
  );
}

function startServer() {
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

/** Browser UI may finish before state.lastImportStatus is readable — derive terminal state. */
function deriveBrowserImportState(row) {
  const raw = String(row.importState || row.importStatus || '').trim();
  if (Object.values(IMPORT_STATE).includes(raw)) return raw;
  const mapped = mapLegacyStatusToImportState(raw);
  if (mapped !== IMPORT_STATE.IMPORT_FAILED) return mapped;
  if (row.fallback || row.needsPaste) return IMPORT_STATE.IMPORT_NEEDS_PASTE;
  if (row.live && (row.selectedTextLength ?? 0) >= 300) return IMPORT_STATE.IMPORT_READY;
  if (row.live && (row.selectedTextLength ?? 0) >= 20) return IMPORT_STATE.IMPORT_PARTIAL;
  return raw;
}

/**
 * @param {object} caseDef
 * @param {Record<string, string>} files
 */
async function runBrowserImportCase(caseDef, files) {
  const fp = files[caseDef.fileKey];
  const row = {
    id: caseDef.id,
    category: caseDef.category,
    label: caseDef.label,
    fileName: caseDef.name,
    filePath: fp || '',
    channel: 'browser',
    fileType: '',
    nativeTextLength: 0,
    ocrTextLength: 0,
    selectedTextLength: 0,
    importState: '',
    importStatus: '',
    errors: [],
    warnings: [],
    crashed: false,
    threw: null,
    stuck: false,
    timedOut: false,
    unsupported: false,
    fakeSuccess: false,
    silentFail: false,
    busy: false,
    fallback: false,
    needsPaste: false,
    live: false,
    hasResume: false,
    identityFound: false,
    emailFound: false,
    phoneFound: false,
    experienceCount: 0,
    educationCount: 0,
    skillsCount: 0,
    toolsCount: 0,
    finalPreviewLength: 0,
    qaOutcome: '',
    status: '',
    pass: false,
    terminalSafe: false,
    passReasons: [],
    durationMs: 0,
  };

  if (!fp || !fs.existsSync(fp)) {
    row.unsupported = true;
    row.qaOutcome = 'IMPORT_UNSUPPORTED';
    row.status = 'IMPORT_UNSUPPORTED';
    row.errors.push('fixture_missing');
    row.pass = false;
    row.passReasons = ['fixture_missing'];
    return row;
  }

  const server = startServer();
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  const browser = await chromium.launch({ headless: true });
  const t0 = Date.now();

  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(`http://127.0.0.1:${port}/`, {
      waitUntil: 'domcontentloaded',
      timeout: 120000,
    });
    await page.waitForFunction(() => typeof window.handleFileImport === 'function', {
      timeout: 120000,
    });

    const buf = fs.readFileSync(fp);
    const evalResult = await page.evaluate(
      async ({ bytes, fname, mimeType, timeoutMs, pollMs }) => {
        const u8 = new Uint8Array(bytes);
        const file = new File([u8], fname, { type: mimeType });
        const started = Date.now();

        try {
          await window.handleFileImport(file);
        } catch (err) {
          return {
            importError: String(err?.message || err),
            crashed: true,
          };
        }

        let snap = null;
        while (Date.now() - started < timeoutMs) {
          snap = {
            busy: document.getElementById('wsImport')?.classList.contains('wsImport--loading'),
            fallback: document.getElementById('importPasteFallback')?.classList.contains('show'),
            needsPaste: document.getElementById('wsImport')?.classList.contains('wsImport--needsPaste'),
            live: document.getElementById('cvDoc')?.classList.contains('cv--live'),
            lastStatus: window.state?.lastImportStatus || '',
            progressHidden: document.getElementById('progress')?.classList.contains('hidden'),
            hasResume: Boolean(
              window.state?.resumeData ||
                window.state?.finalResumeData ||
                window.HirelyParse?.lastResult?.resumeData
            ),
          };
          const terminal =
            !snap.busy &&
            (snap.fallback ||
              snap.needsPaste ||
              snap.live ||
              (snap.lastStatus &&
                !['IMPORT_READING', 'IMPORT_EXTRACTING', 'IMPORT_PARSING'].includes(
                  snap.lastStatus
                )));
          if (terminal) break;
          await new Promise((r) => setTimeout(r, pollMs));
        }

        const core =
          typeof window.getHirelyCore === 'function' ? await window.getHirelyCore() : null;
        const ent =
          (typeof core?.peekLastEnterpriseExtraction === 'function' &&
            core.peekLastEnterpriseExtraction()) ||
          null;
        const mf = ent?.metadata?.multiFormat || ent?.metadata || {};
        const lr = window.HirelyParse?.lastResult || {};
        const ext = (fname.split('.').pop() || '').toLowerCase();
        const extType =
          ext === 'docx' ? 'docx'
          : ext === 'txt' ? 'txt'
          : ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext) ? 'image'
          : ext === 'pdf' ? 'pdf'
          : '';
        const fileType =
          mf.sourceType ||
          ent?.metadata?.fileType ||
          extType ||
          lr.extractionMethod ||
          '';

        const rd = window.state?.finalResumeData || window.state?.resumeData || {};
        const cv = window.state?.cvData || lr.cvData || lr.templateData || {};
        const identity = rd.identity || cv.identity || cv.contact || {};
        const exp = rd.experience || rd.experiences || cv.experience || cv.experiences || [];
        const edu = rd.education || cv.education || [];
        const skills = rd.skills || cv.skills || [];
        const tools = rd.tools || cv.tools || [];
        const name = String(identity.name || identity.fullName || cv.name || '').trim();
        const email = String(identity.email || cv.email || '').trim();
        const phone = String(identity.phone || identity.telephone || cv.phone || '').trim();

        return {
          ...snap,
          timedOut: Date.now() - started >= timeoutMs && !!snap?.busy,
          fileType,
          nativeTextLength: Number(mf.nativeTextLength ?? 0) || 0,
          ocrTextLength: Number(mf.ocrTextLength ?? 0) || 0,
          selectedTextLength: String(lr.rawText || lr.cleanedText || window.state?.rawText || '')
            .trim().length,
          identityName: name,
          identityEmail: email,
          identityPhone: phone,
          experiences: Array.isArray(exp) ? exp : [],
          identityFound: Boolean(name && (email || phone)),
          emailFound: Boolean(email && email.includes('@')),
          phoneFound: Boolean(phone && phone.replace(/\D/g, '').length >= 8),
          experienceCount: Array.isArray(exp) ? exp.length : 0,
          educationCount: Array.isArray(edu) ? edu.length : 0,
          skillsCount: Array.isArray(skills) ? skills.length : 0,
          toolsCount: Array.isArray(tools) ? tools.length : 0,
          finalPreviewLength: (document.getElementById('cvDoc')?.innerText || '').trim().length,
          importState: snap?.lastStatus || lr.importState || '',
          importStatus: lr.importStatus || snap?.lastStatus || '',
          errors: [...(lr.errors || [])].slice(0, 8),
          warnings: [...(lr.warnings || [])].slice(0, 8),
        };
      },
      {
        bytes: [...buf],
        fname: caseDef.name,
        mimeType: mime(fp),
        timeoutMs: IMPORT_TIMEOUT_MS,
        pollMs: POLL_MS,
      }
    );

    if (evalResult.crashed) {
      row.crashed = true;
      row.threw = evalResult.importError || 'import_crash';
      row.errors.push(row.threw);
    } else {
      row.busy = !!evalResult.busy;
      row.fallback = !!evalResult.fallback;
      row.needsPaste = !!evalResult.needsPaste;
      row.live = !!evalResult.live;
      row.hasResume = !!evalResult.hasResume;
      row.fileType = evalResult.fileType || '';
      row.nativeTextLength = evalResult.nativeTextLength ?? 0;
      row.ocrTextLength = evalResult.ocrTextLength ?? 0;
      row.selectedTextLength = evalResult.selectedTextLength ?? 0;
      row.identityName = evalResult.identityName || '';
      row.identityEmail = evalResult.identityEmail || '';
      row.identityPhone = evalResult.identityPhone || '';
      row.experiences = evalResult.experiences || [];
      row.identityFound = !!evalResult.identityFound;
      row.emailFound = !!evalResult.emailFound;
      row.phoneFound = !!evalResult.phoneFound;
      row.experienceCount = evalResult.experienceCount ?? 0;
      row.educationCount = evalResult.educationCount ?? 0;
      row.skillsCount = evalResult.skillsCount ?? 0;
      row.toolsCount = evalResult.toolsCount ?? 0;
      row.finalPreviewLength = evalResult.finalPreviewLength ?? 0;
      row.importState = evalResult.importState || '';
      row.importStatus = evalResult.importStatus || '';
      row.errors = evalResult.errors || [];
      row.warnings = evalResult.warnings || [];
      row.stuck = row.busy || !!evalResult.timedOut;
      row.timedOut = !!evalResult.timedOut;
      row.silentFail = row.stuck && !row.fallback && !row.needsPaste && !row.live;
    }
  } catch (err) {
    row.crashed = true;
    row.threw = String(err?.message || err);
    row.errors.push(row.threw);
  } finally {
    row.durationMs = Date.now() - t0;
    await browser.close();
    server.close();
  }

  row.importState = deriveBrowserImportState(row);
  row.qaOutcome = classifyImportOutcome(row);
  row.status = row.qaOutcome;

  const terminal = evaluateTerminalSafety(row);
  row.terminalSafe = terminal.pass;
  if (!terminal.pass) {
    row.qaOutcome = row.silentFail ? 'IMPORT_STUCK' : row.qaOutcome;
    row.status = row.qaOutcome;
  }

  const product = evaluateImportProductPass(row);
  const acceptable = evaluateImportAcceptableOutcome(row);
  row.pass = product.pass;
  row.productPass = product.pass;
  row.acceptable = acceptable.acceptable;
  row.passReasons = product.reasons;
  row.fakeSuccess =
    product.reasons.includes('fake_success') ||
    product.reasons.includes('selected_text_under_300') ||
    product.reasons.includes('empty_cv') ||
    product.reasons.includes('placeholder_only_cv');

  return row;
}

// --- Main ---
fs.mkdirSync(OUT_DIR, { recursive: true });
ensureVendorTesseract();

const { files } = await ensureRealFormatQaFixtures(ROOT);
const cases = REALITY_CASES.map((c) => ({ ...c, path: files[c.fileKey] }));

const results = [];
for (const caseDef of cases) {
  ok(caseDef.path && fs.existsSync(caseDef.path), `fixture exists: ${caseDef.id}`);
  const row = await runBrowserImportCase(caseDef, files);
  results.push(row);
  ok(row.terminalSafe, `${caseDef.id} terminal safe → ${row.qaOutcome}`);
  ok(!FORBIDDEN_OUTCOMES.has(row.qaOutcome), `${caseDef.id} not forbidden (${row.qaOutcome})`);
  ok(row.acceptable, `${caseDef.id} acceptable outcome → ${row.qaOutcome}`);
  if (row.productPass) {
    ok(row.pass, `${caseDef.id} product PASS → sel=${row.selectedTextLength} exp=${row.experienceCount}`);
  } else if (row.qaOutcome === 'IMPORT_NEEDS_PASTE') {
    ok(!row.pass, `${caseDef.id} NEEDS_PASTE is not product success`);
  }
  if (!row.pass && row.passReasons?.length) {
    console.error('  policy:', row.passReasons.join(', '));
  }
}

const crashes = results.filter((r) => r.qaOutcome === 'IMPORT_CRASH');
const stuck = results.filter((r) => r.qaOutcome === 'IMPORT_STUCK');
const fake = results.filter((r) => r.fakeSuccess);
const silent = results.filter((r) => r.silentFail);

ok(crashes.length === 0, `no IMPORT_CRASH (${crashes.length})`);
ok(stuck.length === 0, `no IMPORT_STUCK (${stuck.length})`);
ok(silent.length === 0, `no silent fail (${silent.length})`);
ok(results.every((r) => r.terminalSafe), 'all cases terminal safe');
ok(results.filter((r) => r.pass).length > 0, 'at least one product PASS (see NO_FAKE_PASS_IMPORT_POLICY.md)');

const byOutcome = {};
for (const r of results) {
  byOutcome[r.qaOutcome] = (byOutcome[r.qaOutcome] || 0) + 1;
}

const report = {
  generatedAt: new Date().toISOString(),
  version: QA_VERSION,
  policy: NO_FAKE_PASS_VERSION,
  pass: failed === 0,
  productPassCount: results.filter((r) => r.pass).length,
  scope: 'import-only reality check (6 format categories, browser path, no-fake-pass policy)',
  byOutcome,
  forbidden: {
    IMPORT_CRASH: crashes.length,
    IMPORT_STUCK: stuck.length,
    fakeSuccess: fake.length,
    silentFail: silent.length,
  },
  cases: results,
};

fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2));
console.log('\nWrote', OUT_JSON);
console.log(failed ? `\n${failed} failed` : '\nAll IMPORT REALITY CHECK tests passed');
process.exit(failed ? 1 : 0);
