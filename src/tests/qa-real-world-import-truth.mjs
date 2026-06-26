#!/usr/bin/env node
/**
 * P0 — REAL WORLD IMPORT TRUTH
 * Messy corpus benchmark — browser product path, strict PASS rules.
 */
import fs from 'fs';
import http from 'http';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { TESSERACT_REQUIRED_ASSETS } from '../vendor/tesseract-runtime.js';
import { ensureRealWorldImportTruthFixtures } from '../../tests/lib/real-world-import-truth-fixtures.mjs';
import {
  classifyTruthStatus,
  deriveTruthImportState,
  evaluateTruthPass,
  isFakeSuccess,
} from '../../tests/lib/real-world-import-truth-eval.mjs';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT_DIR = path.join(ROOT, 'tests/output/real-world-import-truth');
const OUT_JSON = path.join(OUT_DIR, 'report.json');

const QA_VERSION = 'REAL_WORLD_IMPORT_TRUTH_V1';
const IMPORT_TIMEOUT_MS = 120000;
const POLL_MS = 400;

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
  if (res.status !== 0) throw new Error('setup-vendor-tesseract failed');
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

/**
 * @param {import('playwright').Page} page
 * @param {object} caseDef
 */
async function runImportOnPage(page, caseDef) {
  const row = {
    id: caseDef.id,
    category: caseDef.category,
    label: caseDef.label,
    fileName: caseDef.fileName,
    filePath: caseDef.path,
    fileType: '',
    nativeTextLength: 0,
    ocrTextLength: 0,
    docxTextLength: 0,
    selectedTextLength: 0,
    selectedSource: '',
    identityFound: false,
    emailFound: false,
    phoneFound: false,
    experienceCount: 0,
    educationCount: 0,
    clientCount: 0,
    skillsCount: 0,
    toolsCount: 0,
    finalPreviewLength: 0,
    reviewQueueCount: 0,
    needsPaste: false,
    status: '',
    importState: '',
    importStatus: '',
    errors: [],
    warnings: [],
    crashed: false,
    threw: null,
    stuck: false,
    timedOut: false,
    fakeSuccess: false,
    silentFail: false,
    busy: false,
    fallback: false,
    needsPasteUi: false,
    live: false,
    hasResume: false,
    pass: false,
    passReasons: [],
    durationMs: 0,
  };

  const t0 = Date.now();
  const buf = fs.readFileSync(caseDef.path);

  try {
    await page.goto(`http://127.0.0.1:${page._hirelyPort}/`, {
      waitUntil: 'domcontentloaded',
      timeout: 120000,
    });
    await page.waitForFunction(() => typeof window.handleFileImport === 'function', {
      timeout: 120000,
    });

    const evalResult = await page.evaluate(
      async ({ bytes, fname, mimeType, timeoutMs, pollMs }) => {
        const u8 = new Uint8Array(bytes);
        const file = new File([u8], fname, { type: mimeType });
        const started = Date.now();

        try {
          await window.handleFileImport(file);
        } catch (err) {
          return { crashed: true, importError: String(err?.message || err) };
        }

        let snap = null;
        while (Date.now() - started < timeoutMs) {
          snap = {
            busy: document.getElementById('wsImport')?.classList.contains('wsImport--loading'),
            fallback: document.getElementById('importPasteFallback')?.classList.contains('show'),
            needsPaste: document.getElementById('wsImport')?.classList.contains('wsImport--needsPaste'),
            live: document.getElementById('cvDoc')?.classList.contains('cv--live'),
            lastStatus: window.state?.lastImportStatus || '',
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
                !['IMPORT_READING', 'IMPORT_EXTRACTING', 'IMPORT_PARSING', 'reading'].includes(
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
        const rd = window.state?.finalResumeData || window.state?.resumeData || {};
        const cv = window.state?.cvData || lr.cvData || lr.templateData || {};
        const identity = rd.identity || cv.identity || cv.contact || {};

        const ext = (fname.split('.').pop() || '').toLowerCase();
        const extType =
          ext === 'docx' ? 'docx'
          : ext === 'doc' ? 'doc'
          : ext === 'txt' ? 'txt'
          : ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext) ? 'image'
          : ext === 'pdf' ? 'pdf'
          : '';

        const fileType = mf.sourceType || ent?.metadata?.fileType || extType || '';
        const isDocx = fileType === 'docx' || fileType === 'doc' || ext === 'docx' || ext === 'doc';
        const nativeLen = Number(mf.nativeTextLength ?? 0) || 0;
        const ocrLen = Number(mf.ocrTextLength ?? 0) || 0;
        const selectedText = String(
          lr.rawText || lr.cleanedText || window.state?.rawText || ''
        ).trim();
        const docxTextLength = isDocx
          ? nativeLen || String(ent?.rawExtraction || selectedText).trim().length
          : 0;

        const exp = rd.experience || rd.experiences || cv.experience || cv.experiences || [];
        const edu = rd.education || cv.education || [];
        const clients = rd.clients || cv.clients || [];
        const skills = rd.skills || cv.skills || [];
        const tools = rd.tools || cv.tools || [];

        const name = String(identity.name || identity.fullName || cv.name || '').trim();
        const email = String(identity.email || cv.email || '').trim();
        const phone = String(identity.phone || identity.telephone || cv.phone || '').trim();

        const importState = snap?.lastStatus || lr.importState || '';
        const needsPaste =
          !!snap?.fallback ||
          !!snap?.needsPaste ||
          importState === 'IMPORT_NEEDS_PASTE' ||
          lr.importState === 'IMPORT_NEEDS_PASTE';

        return {
          ...snap,
          timedOut: Date.now() - started >= timeoutMs && !!snap?.busy,
          fileType,
          nativeTextLength: nativeLen,
          ocrTextLength: ocrLen,
          docxTextLength,
          selectedTextLength: selectedText.length,
          selectedSource: mf.selectedSource || ent?.metadata?.extractionSource || '',
          identityName: name,
          identityEmail: email,
          identityPhone: phone,
          experiences: Array.isArray(exp) ? exp : [],
          identityFound: Boolean(name && (email || phone)),
          emailFound: Boolean(email && email.includes('@')),
          phoneFound: Boolean(phone && phone.replace(/\D/g, '').length >= 8),
          experienceCount: Array.isArray(exp) ? exp.length : 0,
          educationCount: Array.isArray(edu) ? edu.length : 0,
          clientCount: Array.isArray(clients) ? clients.length : 0,
          skillsCount: Array.isArray(skills) ? skills.length : 0,
          toolsCount: Array.isArray(tools) ? tools.length : 0,
          finalPreviewLength: (document.getElementById('cvDoc')?.innerText || '').trim().length,
          reviewQueueCount: Array.isArray(window.state?.reviewQueue)
            ? window.state.reviewQueue.length
            : 0,
          needsPaste,
          importState,
          importStatus: lr.importStatus || '',
          errors: [...(lr.errors || [])].slice(0, 8),
          warnings: [...(lr.warnings || [])].slice(0, 8),
        };
      },
      {
        bytes: [...buf],
        fname: caseDef.fileName,
        mimeType: mime(caseDef.path),
        timeoutMs: IMPORT_TIMEOUT_MS,
        pollMs: POLL_MS,
      }
    );

    if (evalResult.crashed) {
      row.crashed = true;
      row.threw = evalResult.importError || 'import_crash';
      row.errors.push(row.threw);
    } else {
      Object.assign(row, {
        busy: !!evalResult.busy,
        fallback: !!evalResult.fallback,
        needsPasteUi: !!evalResult.needsPaste,
        live: !!evalResult.live,
        hasResume: !!evalResult.hasResume,
        fileType: evalResult.fileType || '',
        nativeTextLength: evalResult.nativeTextLength ?? 0,
        ocrTextLength: evalResult.ocrTextLength ?? 0,
        docxTextLength: evalResult.docxTextLength ?? 0,
        selectedTextLength: evalResult.selectedTextLength ?? 0,
        selectedSource: evalResult.selectedSource || '',
        identityName: evalResult.identityName || '',
        identityEmail: evalResult.identityEmail || '',
        identityPhone: evalResult.identityPhone || '',
        experiences: evalResult.experiences || [],
        identityFound: !!evalResult.identityFound,
        emailFound: !!evalResult.emailFound,
        phoneFound: !!evalResult.phoneFound,
        experienceCount: evalResult.experienceCount ?? 0,
        educationCount: evalResult.educationCount ?? 0,
        clientCount: evalResult.clientCount ?? 0,
        skillsCount: evalResult.skillsCount ?? 0,
        toolsCount: evalResult.toolsCount ?? 0,
        finalPreviewLength: evalResult.finalPreviewLength ?? 0,
        reviewQueueCount: evalResult.reviewQueueCount ?? 0,
        needsPaste: !!evalResult.needsPaste,
        importState: evalResult.importState || '',
        importStatus: evalResult.importStatus || '',
        errors: evalResult.errors || [],
        warnings: evalResult.warnings || [],
        stuck: !!evalResult.busy || !!evalResult.timedOut,
        timedOut: !!evalResult.timedOut,
        silentFail:
          (!!evalResult.busy || !!evalResult.timedOut) &&
          !evalResult.fallback &&
          !evalResult.needsPaste &&
          !evalResult.live,
      });
    }
  } catch (err) {
    row.crashed = true;
    row.threw = String(err?.message || err);
    row.errors.push(row.threw);
  }

  row.durationMs = Date.now() - t0;
  row.importState = deriveTruthImportState(row);
  row.status = classifyTruthStatus(row);
  row.fakeSuccess = isFakeSuccess(row);
  if (row.fakeSuccess) {
    row.status = 'IMPORT_STUCK';
    row.errors.push('fake_success');
  }
  if (row.silentFail && row.status !== 'IMPORT_CRASH') {
    row.status = 'IMPORT_STUCK';
    row.errors.push('silent_fail');
  }

  const verdict = evaluateTruthPass(row);
  row.pass = verdict.pass;
  row.passReasons = verdict.reasons;

  return row;
}

// --- Main ---
fs.mkdirSync(OUT_DIR, { recursive: true });
ensureVendorTesseract();

const server = startServer();
await new Promise((r) => server.listen(0, r));
const port = server.address().port;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page._hirelyPort = port;

const { cases, counts } = await ensureRealWorldImportTruthFixtures(ROOT, { page });

ok(cases.length >= 29, `fixture count ${cases.length} (min 29)`);
ok(counts.pdf_selectable >= 5, `pdf_selectable ${counts.pdf_selectable}`);
ok(counts.pdf_scanned >= 5, `pdf_scanned ${counts.pdf_scanned}`);
ok(counts.pdf_design_export >= 5, `pdf_design_export ${counts.pdf_design_export}`);
ok(counts.docx_columns >= 5, `docx_columns ${counts.docx_columns}`);
ok(counts.doc_legacy >= 3, `doc_legacy ${counts.doc_legacy}`);
ok(counts.image_cv >= 3, `image_cv ${counts.image_cv}`);
ok(counts.txt_paste >= 3, `txt_paste ${counts.txt_paste}`);

const results = [];
for (const caseDef of cases) {
  const row = await runImportOnPage(page, caseDef);
  results.push(row);
  ok(row.pass, `${caseDef.id} → ${row.status} sel=${row.selectedTextLength} exp=${row.experienceCount} (${row.durationMs}ms)`);
  if (!row.pass && row.passReasons.length) {
    console.error('  reasons:', row.passReasons.join(', '));
  }
}

await browser.close();
server.close();

const byStatus = {};
const byCategory = {};
for (const r of results) {
  byStatus[r.status] = (byStatus[r.status] || 0) + 1;
  byCategory[r.category] = byCategory[r.category] || { pass: 0, fail: 0, total: 0 };
  byCategory[r.category].total++;
  if (r.pass) byCategory[r.category].pass++;
  else byCategory[r.category].fail++;
}

const forbidden = {
  IMPORT_CRASH: results.filter((r) => r.status === 'IMPORT_CRASH').length,
  IMPORT_STUCK: results.filter((r) => r.status === 'IMPORT_STUCK').length,
  fakeSuccess: results.filter((r) => r.fakeSuccess).length,
  silentFail: results.filter((r) => r.silentFail).length,
  thinTextWrongStatus: results.filter((r) => r.passReasons.includes('thin_text_wrong_status')).length,
  readyNoStructure: results.filter((r) => r.passReasons.includes('ready_no_structure')).length,
};

ok(forbidden.IMPORT_CRASH === 0, `no crash (${forbidden.IMPORT_CRASH})`);
ok(forbidden.IMPORT_STUCK === 0, `no stuck (${forbidden.IMPORT_STUCK})`);
ok(forbidden.fakeSuccess === 0, `no fake success (${forbidden.fakeSuccess})`);

const report = {
  generatedAt: new Date().toISOString(),
  version: QA_VERSION,
  pass: failed === 0 && results.every((r) => r.pass),
  counts,
  byStatus,
  byCategory,
  forbidden,
  cases: results,
};

fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2));
console.log('\nWrote', OUT_JSON);
console.log(
  failed || !report.pass
    ? `\n${failed} gate failures — REAL WORLD IMPORT TRUTH FAIL`
    : '\nREAL WORLD IMPORT TRUTH PASS'
);
process.exit(failed || !report.pass ? 1 : 0);
