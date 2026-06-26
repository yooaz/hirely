#!/usr/bin/env node
/**
 * P0 — Format support audit: import, detection, render, export per format.
 */
import fs from 'fs';
import http from 'http';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { canonicalImportFromFile } from '../core/import/canonical-import.js';
import { runHirelyImportFromFile } from '../core/pipeline/hirely-import.js';
import {
  IMPORT_STATE,
  importStatusAllowsParser,
  importStatusRequiresPasteFallback,
} from '../core/import/import-status.js';
import {
  ensureFormatSupportFixtures,
  buildTextPdf,
  fileFromPath,
} from '../../tests/lib/format-support-fixtures.mjs';
import { loadHirelyTemplates } from './lib/pdf-hardening-suite.mjs';
import { exportCvPdfPlaywright } from './lib/pdf-export-playwright.mjs';
import { resumeDataToCvData } from '../core/resume-data.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT_DIR = path.join(ROOT, 'tests/output/format-support-audit');
const OUT_JSON = path.join(OUT_DIR, 'report.json');

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

function textQualityScore(rawText, confidence) {
  const raw = String(rawText || '');
  if (!raw.length) return 0;
  const alpha = (raw.match(/[a-zA-ZÀ-ÿ]/g) || []).length;
  const ratio = alpha / raw.length;
  const lenScore = Math.min(100, Math.round((raw.length / 800) * 100));
  const conf = typeof confidence === 'number' ? confidence : Math.round(ratio * 100);
  return Math.round(conf * 0.55 + lenScore * 0.45);
}

function extractDetections(result) {
  const rd = result?.resumeData || {};
  const tpl = result?.templateData || {};
  const identity = rd.identity || {};
  const name = String(identity.name || tpl.name || rd.name || '').trim();
  const email = String(identity.email || tpl.email || rd.email || '').trim();
  const phone = String(identity.phone || tpl.phone || rd.phone || '').trim();
  const exp = rd.experience || rd.experiences || tpl.experience || tpl.experiences || [];
  const edu = rd.education || tpl.education || [];
  const skills = rd.skills || tpl.skills || [];
  const clients = rd.clients || tpl.clients || [];
  return {
    nameDetected: name.length > 2 && !/uncertain|inconnu/i.test(name),
    emailDetected: /@/.test(email),
    phoneDetected: /\d{8,}/.test(phone.replace(/\D/g, '')),
    experienceCount: Array.isArray(exp) ? exp.length : 0,
    educationCount: Array.isArray(edu) ? edu.length : 0,
    skillsCount: Array.isArray(skills) ? skills.length : 0,
    clientsCount: Array.isArray(clients) ? clients.length : 0,
    experienceDetected: Array.isArray(exp) && exp.length > 0,
    educationDetected: Array.isArray(edu) && edu.length > 0,
    skillsDetected: Array.isArray(skills) && skills.length > 0,
    clientsDetected: Array.isArray(clients) && clients.length > 0,
  };
}

function pasteMessageClear(errors = [], warnings = []) {
  const blob = [...errors, ...warnings].join(' ');
  return /collez|paste|illisible|scann|protég|navigateur|DOCX|TXT/i.test(blob);
}

function assessRow(row) {
  const imported =
    row.canImport &&
    row.rawTextLength >= 20 &&
    (importStatusAllowsParser(row.importStatus) ||
      row.importState === IMPORT_STATE.IMPORT_READY ||
      row.importState === IMPORT_STATE.IMPORT_PARTIAL) &&
    row.cvRendered;

  const pasteOk =
    row.canImport &&
    !row.crashed &&
    (importStatusRequiresPasteFallback(row.importStatus) ||
      row.importState === IMPORT_STATE.IMPORT_NEEDS_PASTE ||
      row.importState === IMPORT_STATE.IMPORT_FAILED) &&
    (row.pasteFallbackUi || row.pasteMessageClear || row.rawTextLength === 0);

  row.importedCorrectly = imported;
  row.pasteFallbackOk = pasteOk;
  row.pass = imported || pasteOk;
  row.outcome = imported ? 'import' : pasteOk ? 'paste_fallback' : 'fail';
  return row;
}

async function runNodeImport(formatId, file) {
  const row = {
    id: formatId,
    canImport: false,
    crashed: false,
    rawTextLength: 0,
    textQuality: 0,
    importStatus: '',
    importState: '',
    pasteMessageClear: false,
    pasteFallbackUi: false,
    cvRendered: false,
    pdfExported: false,
    pdfExportBytes: 0,
    errors: [],
    warnings: [],
    detections: {},
    fixture: file?.name || '',
  };

  try {
    const detailed = await canonicalImportFromFile(file);
    const hirely = await runHirelyImportFromFile(file);
    row.canImport = true;
    row.importStatus = hirely.importStatus || detailed.importStatus || '';
    row.importState = detailed.importState || '';
    row.rawTextLength = Math.max(
      (detailed.rawText || '').length,
      (hirely.rawText || '').length
    );
    row.errors = [...(detailed.errors || []), ...(hirely.errors || [])];
    row.warnings = [...(detailed.warnings || []), ...(hirely.warnings || [])];
    row.pasteMessageClear = pasteMessageClear(row.errors, row.warnings);

    const conf =
      detailed.enterprise?.metadata?.confidence ??
      detailed.enterprise?.multiFormat?.confidenceScore;
    row.textQuality = textQualityScore(hirely.rawText || detailed.rawText, conf);

    row.detections = extractDetections(hirely);

    const tpl = hirely.templateData;
    const rd = hirely.resumeData;
    row.cvRendered =
      !!(tpl?.name || rd?.identity?.name) &&
      (row.detections.experienceDetected ||
        row.detections.educationDetected ||
        row.rawTextLength >= 80);

    if (!row.cvRendered && row.pasteFallbackOk) {
      row.cvRendered = false;
    }
  } catch (err) {
    row.crashed = true;
    row.errors.push(String(err?.message || err));
    row.importStatus = IMPORT_STATE.IMPORT_FAILED;
  }

  return assessRow(row);
}

async function tryPdfExport(cvData) {
  if (!cvData?.name) return { exported: false, bytes: 0 };
  const T = loadHirelyTemplates();
  const inner = T.render(cvData, 'ats');
  const outPath = path.join(OUT_DIR, 'export-smoke.pdf');
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const layout = await exportCvPdfPlaywright(page, inner, 'ats', outPath);
    const bytes = fs.existsSync(outPath) ? fs.statSync(outPath).size : 0;
    return { exported: bytes > 900, bytes, pages: layout?.estimatedPages || 0 };
  } finally {
    await browser.close();
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
      '.doc': 'application/msword',
      '.rtf': 'application/rtf',
      '.txt': 'text/plain',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
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

async function verifyPasteFallbackUi(filePath, label) {
  const server = startServer(0);
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction(() => typeof window.handleFileImport === 'function', {
      timeout: 180000,
    });

    const buf = fs.readFileSync(filePath);
    const name = path.basename(filePath);
    const ext = path.extname(name).toLowerCase();
    const type =
      {
        '.pdf': 'application/pdf',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
      }[ext] || 'application/octet-stream';

    await page.evaluate(
      async ({ bytes, fname, mimeType }) => {
        const u8 = new Uint8Array(bytes);
        const file = new File([u8], fname, { type: mimeType });
        await window.handleFileImport(file);
      },
      { bytes: [...buf], fname: name, mimeType: type }
    );

    const deadline = Date.now() + 120000;
    let snap = null;
    while (Date.now() < deadline) {
      snap = await page.evaluate(() => ({
        fallback: document.getElementById('importPasteFallback')?.classList.contains('show'),
        textarea: !!document.getElementById('importPasteFallbackText'),
        lead: document.getElementById('importPasteFallbackLead')?.textContent?.trim() || '',
        busy: document.getElementById('wsImport')?.classList.contains('wsImport--loading'),
        needsPaste: document.getElementById('wsImport')?.classList.contains('wsImport--needsPaste'),
        live: document.getElementById('cvDoc')?.classList.contains('cv--live'),
      }));
      if (snap.fallback || snap.needsPaste || snap.live) break;
      if (!snap.busy && Date.now() - deadline + 120000 > 8000) break;
      await page.waitForTimeout(400);
    }

    const clear =
      !!snap?.fallback &&
      !!snap?.textarea &&
      (snap.lead.length > 10 || snap.needsPaste) &&
      !snap.busy;
    return { label, pasteFallbackUi: clear, snap };
  } finally {
    await browser.close();
    server.close();
  }
}

// --- Main ---
fs.mkdirSync(OUT_DIR, { recursive: true });
await bootstrapNodeExtractors();

const fixtures = ensureFormatSupportFixtures(ROOT);
if (fixtures.yoaz && !fs.existsSync(fixtures.pdfSelectablePath)) {
  await buildTextPdf(fixtures.pdfSelectablePath, fixtures.yoaz);
}

const FORMATS = [
  {
    id: 'pdf_selectable',
    label: 'PDF selectable',
    build: () => fileFromPath(fixtures.pdfSelectablePath),
    expect: 'import',
  },
  {
    id: 'pdf_scanned',
    label: 'PDF scanned',
    build: () => fileFromPath(fixtures.pdfScanned, 'scan.pdf'),
    expect: 'paste_fallback',
    browserPasteCheck: true,
  },
  {
    id: 'pdf_protected',
    label: 'PDF protected',
    build: () => fileFromPath(fixtures.pdfProtected, 'protected.pdf'),
    expect: 'paste_fallback',
    browserPasteCheck: true,
  },
  {
    id: 'docx',
    label: 'DOCX',
    build: () => fileFromPath(fixtures.docxPath),
    expect: 'import',
  },
  {
    id: 'doc',
    label: 'DOC',
    build: () => fileFromPath(fixtures.docPath),
    expect: 'import',
  },
  {
    id: 'rtf',
    label: 'RTF',
    build: () => fileFromPath(fixtures.rtfPath),
    expect: 'import',
  },
  {
    id: 'txt',
    label: 'TXT',
    build: () => fileFromPath(fixtures.txtPath),
    expect: 'import',
  },
  {
    id: 'image_png',
    label: 'Image PNG',
    build: () => fileFromPath(fixtures.pngPath),
    expect: 'paste_fallback',
    browserPasteCheck: true,
  },
  {
    id: 'image_jpg',
    label: 'Image JPG',
    build: () => fileFromPath(fixtures.jpgPath),
    expect: 'paste_fallback',
    browserPasteCheck: true,
  },
];

const results = [];

for (const fmt of FORMATS) {
  if (!fmt.build) continue;
  let file;
  try {
    file = fmt.build();
  } catch (err) {
    results.push(
      assessRow({
        id: fmt.id,
        label: fmt.label,
        canImport: false,
        crashed: true,
        errors: [String(err?.message || 'fixture missing')],
        rawTextLength: 0,
        textQuality: 0,
        cvRendered: false,
        pdfExported: false,
      })
    );
    ok(false, `${fmt.id} fixture`);
    continue;
  }

  const row = await runNodeImport(fmt.id, file);
  row.label = fmt.label;
  row.expected = fmt.expect;

  if (row.importedCorrectly) {
    const hirely = await runHirelyImportFromFile(file);
    const cvData = hirely.templateData || resumeDataToCvData(hirely.resumeData);
    const exp = await tryPdfExport(cvData);
    row.pdfExported = exp.exported;
    row.pdfExportBytes = exp.bytes;
    row.cvRendered = row.cvRendered || exp.exported;
  }

  if (fmt.browserPasteCheck) {
    const fp =
      fmt.id === 'pdf_scanned'
        ? fixtures.pdfScanned
        : fmt.id === 'pdf_protected'
          ? fixtures.pdfProtected
          : fmt.id === 'image_png'
            ? fixtures.pngPath
            : fmt.id === 'image_jpg'
              ? fixtures.jpgPath
              : null;
    if (fp && fs.existsSync(fp)) {
      const ui = await verifyPasteFallbackUi(fp, fmt.label);
      row.pasteFallbackUi = ui.pasteFallbackUi;
      row.browserSnap = ui.snap;
      if (row.pasteFallbackOk) row.pass = row.pass || ui.pasteFallbackUi;
      assessRow(row);
    }
  }

  ok(row.pass, `${fmt.id} ${row.outcome}`);
  if (fmt.expect === 'import' && !row.importedCorrectly) failed++;
  if (fmt.expect === 'paste_fallback' && !row.pasteFallbackOk && !row.pasteFallbackUi) failed++;

  results.push(row);
}

const allPass = results.every((r) => r.pass);
const report = {
  pass: allPass && failed === 0,
  generatedAt: new Date().toISOString(),
  formats: results,
  summary: {
    total: results.length,
    imported: results.filter((r) => r.importedCorrectly).length,
    pasteFallback: results.filter((r) => r.outcome === 'paste_fallback').length,
    failed: results.filter((r) => !r.pass).length,
  },
};

fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2));
console.log('\nReport:', OUT_JSON);
console.log(failed || !allPass ? '\nFAIL format-support-audit' : '\nPASS format-support-audit');
process.exit(failed || !allPass ? 1 : 0);
