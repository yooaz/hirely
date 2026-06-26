#!/usr/bin/env node
/**
 * P0 — Real CV benchmark pack (18 messy files, browser product path).
 */
import fs from 'fs';
import http from 'http';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { TESSERACT_REQUIRED_ASSETS } from '../vendor/tesseract-runtime.js';
import { REAL_CV_BENCHMARK_PACK_V1 } from '../../tests/lib/real-cv-benchmark-pack-catalog.mjs';
import { ensureRealCvBenchmarkPackFixtures } from '../../tests/lib/real-cv-benchmark-pack-fixtures.mjs';
import { enrichBenchmarkMetrics } from '../../tests/lib/real-cv-benchmark-pack-metrics.mjs';
import { classifyTruthStatus } from '../../tests/lib/real-world-import-truth-eval.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT_DIR = path.join(ROOT, 'tests/output/real-cv-benchmark-pack');
const OUT_JSON = path.join(OUT_DIR, 'report.json');

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
async function runBenchmarkCase(page, caseDef) {
  const row = {
    id: caseDef.id,
    category: caseDef.category,
    label: caseDef.label,
    fileName: caseDef.fileName,
    filePath: caseDef.path,
    pack: caseDef.pack,
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

        const lr = window.state?.lastImportResult || window.HirelyParse?.lastResult || {};
        const ent = lr.enterprise || lr.pdfExtraction || {};
        const mf = ent?.metadata?.multiFormat || ent?.multiFormat || {};
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
        const selectedText = String(
          lr.rawText || lr.cleanedText || window.state?.rawText || ''
        ).trim();

        return {
          ...snap,
          timedOut: Date.now() - started >= timeoutMs && !!snap?.busy,
          crashed: false,
          fileType: mf.sourceType || ent?.metadata?.fileType || lr.extractionMethod || '',
          nativeTextLength: Number(mf.nativeTextLength ?? 0) || 0,
          ocrTextLength: Number(mf.ocrTextLength ?? 0) || 0,
          selectedTextLength: selectedText.length,
          selectedSource: mf.selectedSource || ent?.metadata?.extractionSource || lr.extractionMethod || '',
          identityName: name,
          identityEmail: email,
          identityPhone: phone,
          experiences: Array.isArray(exp) ? exp : [],
          name,
          email,
          phone,
          experienceCount: Array.isArray(exp) ? exp.length : 0,
          educationCount: Array.isArray(edu) ? edu.length : 0,
          skillsCount: Array.isArray(skills) ? skills.length : 0,
          toolsCount: Array.isArray(tools) ? tools.length : 0,
          previewLength: (document.getElementById('cvDoc')?.innerText || '').trim().length,
          reviewQueueCount: Array.isArray(window.state?.reviewQueue)
            ? window.state.reviewQueue.length
            : 0,
          contentAccountedPct: rd?.meta?.contentAccounting?.accountedPct ?? null,
          resumeData: rd,
          importState: snap?.lastStatus || lr.importState || '',
          importStatus: lr.importStatus || '',
          hasResume: Boolean(rd && Object.keys(rd).length > 1),
          live: !!snap?.live,
          fallback: !!snap?.fallback,
          needsPaste: !!snap?.needsPaste,
          busy: !!snap?.busy,
          errors: [...(lr.errors || [])].slice(0, 6),
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
      Object.assign(row, {
        crashed: true,
        threw: evalResult.importError,
        status: 'IMPORT_CRASH',
        fileType: path.extname(caseDef.fileName).slice(1),
        nativeTextLength: 0,
        ocrTextLength: 0,
        selectedTextLength: 0,
        selectedSource: '',
        name: '',
        email: '',
        phone: '',
        experienceCount: 0,
        educationCount: 0,
        skillsCount: 0,
        previewLength: 0,
        reviewQueueCount: 0,
      });
    } else {
      Object.assign(row, evalResult);
      row.stuck = row.busy || row.timedOut;
      row.status = classifyTruthStatus({
        ...row,
        importState: evalResult.importState,
        fallback: evalResult.fallback,
        needsPaste: evalResult.needsPaste,
      });
      if (row.stuck && row.status !== 'IMPORT_CRASH') row.status = 'IMPORT_STUCK';
    }
  } catch (err) {
    Object.assign(row, {
      crashed: true,
      threw: String(err?.message || err),
      status: 'IMPORT_CRASH',
      fileType: path.extname(caseDef.fileName).slice(1),
      nativeTextLength: 0,
      ocrTextLength: 0,
      selectedTextLength: 0,
      selectedSource: '',
      name: '',
      email: '',
      phone: '',
      experienceCount: 0,
      educationCount: 0,
      skillsCount: 0,
      previewLength: 0,
      reviewQueueCount: 0,
    });
  }

  row.durationMs = Date.now() - t0;
  return enrichBenchmarkMetrics(row);
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

const { cases, counts } = await ensureRealCvBenchmarkPackFixtures(ROOT, page);

ok(cases.length === 18, `benchmark pack has 18 files (got ${cases.length})`);
ok(counts.pdf >= 10, `PDF slots ${counts.pdf}`);
ok(counts.docx >= 5, `DOCX slots ${counts.docx}`);
ok(counts.image >= 3, `image slots ${counts.image}`);

const results = [];
for (const caseDef of cases) {
  const row = await runBenchmarkCase(page, caseDef);
  results.push(row);
  console.log(
    `  ${caseDef.id}: ${row.status} sel=${row.selectedTextLength} prev=${row.previewLength} fake=${row.fakeDataDetected} loss=${row.dataLossDetected}`
  );
}

await browser.close();
server.close();

const crashes = results.filter((r) => r.status === 'IMPORT_CRASH').length;
const stuck = results.filter((r) => r.status === 'IMPORT_STUCK').length;
ok(crashes === 0, `no crashes (${crashes})`);
ok(stuck === 0, `no stuck loaders (${stuck})`);

const report = {
  generatedAt: new Date().toISOString(),
  version: REAL_CV_BENCHMARK_PACK_V1,
  pass: failed === 0,
  counts,
  summary: {
    total: results.length,
    crashes,
    stuck,
    fakeData: results.filter((r) => r.fakeDataDetected).length,
    dataLoss: results.filter((r) => r.dataLossDetected).length,
    needsPaste: results.filter((r) => r.status === 'IMPORT_NEEDS_PASTE').length,
    ready: results.filter((r) => r.status === 'IMPORT_READY').length,
  },
  cases: results.map((r) => ({
    id: r.id,
    category: r.category,
    label: r.label,
    fileName: r.fileName,
    fileType: r.fileType || r.pack,
    nativeTextLength: r.nativeTextLength ?? 0,
    ocrTextLength: r.ocrTextLength ?? 0,
    selectedTextLength: r.selectedTextLength ?? 0,
    selectedSource: r.selectedSource || '',
    status: r.status || '',
    name: r.name || '',
    email: r.email || '',
    phone: r.phone || '',
    experienceCount: r.experienceCount ?? 0,
    educationCount: r.educationCount ?? 0,
    skillsCount: r.skillsCount ?? 0,
    previewLength: r.previewLength ?? 0,
    reviewQueueCount: r.reviewQueueCount ?? 0,
    fakeDataDetected: !!r.fakeDataDetected,
    fakeDataReasons: r.fakeDataReasons || [],
    dataLossDetected: !!r.dataLossDetected,
    dataLossReasons: r.dataLossReasons || [],
    durationMs: r.durationMs ?? 0,
  })),
};

fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2));
console.log('\nWrote', OUT_JSON);
console.log(failed ? `\n${failed} failed` : '\nReal CV benchmark pack QA passed');
process.exit(failed ? 1 : 0);
