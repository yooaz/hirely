#!/usr/bin/env node
/**
 * IMPORT_DECISION_FINAL report — unit matrix + browser import outcomes.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import {
  IMPORT_DECISION_REASON,
  IMPORT_DECISION_NATIVE_MIN,
  IMPORT_DECISION_REVIEW_MIN,
  resolveImportDecision,
} from '../src/core/import/import-decision-final.js';
import { ensureHirelyTestMatrixFixtures } from '../tests/lib/hirely-test-matrix-fixtures.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_MD = path.join(ROOT, 'IMPORT_DECISION_FINAL_REPORT.md');
const OUT_JSON = path.join(ROOT, 'tests/output/import-decision-final/report.json');

function mime(fp) {
  const ext = path.extname(fp).toLowerCase();
  return (
    {
      '.html': 'text/html; charset=utf-8',
      '.js': 'text/javascript; charset=utf-8',
      '.mjs': 'text/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.wasm': 'application/wasm',
      '.pdf': 'application/pdf',
      '.txt': 'text/plain; charset=utf-8',
    }[ext] || 'application/octet-stream'
  );
}

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const rel = req.url.split('?')[0] === '/' ? '/index.html' : req.url.split('?')[0];
      const fp = path.join(ROOT, decodeURIComponent(rel));
      if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
        res.writeHead(404);
        res.end();
        return;
      }
      res.writeHead(200, { 'Content-Type': mime(fp) });
      fs.createReadStream(fp).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function runUnitMatrix() {
  const cases = [
    {
      id: 'rule1_native_pdf',
      ctx: { fileType: 'pdf', nativeTextLength: 400, textLength: 400 },
      reason: IMPORT_DECISION_REASON.NATIVE_TEXT_OK,
      dest: 'review',
    },
    {
      id: 'rule2_3_ocr_ok',
      ctx: {
        fileType: 'pdf',
        nativeTextLength: 0,
        textLength: 350,
        ocrAttempted: true,
        ocrTextLength: 350,
        importMode: 'exact_transcription',
      },
      reason: IMPORT_DECISION_REASON.OCR_TEXT_OK,
      dest: 'exact_transcription',
    },
    {
      id: 'rule4_ocr_short',
      ctx: { fileType: 'pdf', nativeTextLength: 0, textLength: 50, ocrAttempted: true, ocrTextLength: 50 },
      reason: IMPORT_DECISION_REASON.OCR_TEXT_TOO_SHORT,
      dest: 'paste',
    },
    {
      id: 'pdf_image_only',
      ctx: {
        fileType: 'pdf',
        nativeTextLength: 0,
        textLength: 0,
        ocrAttempted: false,
        ocrDisabled: false,
        importMode: 'exact_transcription',
      },
      reason: IMPORT_DECISION_REASON.PDF_IMAGE_ONLY,
      dest: 'exact_transcription',
    },
    {
      id: 'rule5_docx_ok',
      ctx: { fileType: 'docx', textLength: 500 },
      reason: IMPORT_DECISION_REASON.NATIVE_TEXT_OK,
      dest: 'review',
    },
    {
      id: 'rule5_txt_ok',
      ctx: { fileType: 'txt', textLength: 200 },
      reason: IMPORT_DECISION_REASON.NATIVE_TEXT_OK,
      dest: 'review',
    },
    {
      id: 'rule5_paste_ok',
      ctx: { fileType: 'paste', textLength: 150 },
      reason: IMPORT_DECISION_REASON.NATIVE_TEXT_OK,
      dest: 'review',
    },
    {
      id: 'rule6_raw_short',
      ctx: { fileType: 'txt', textLength: 80 },
      reason: IMPORT_DECISION_REASON.RAW_TEXT_TOO_SHORT,
      dest: 'paste',
    },
    {
      id: 'rule6_unsupported',
      ctx: { fileType: 'image', unsupported: true },
      reason: IMPORT_DECISION_REASON.UNSUPPORTED_FILE,
      dest: 'paste',
    },
  ];

  return cases.map((c) => {
    const d = resolveImportDecision(c.ctx);
    return {
      ...c,
      pass: d.reason === c.reason && d.destination === c.dest,
      actual: d,
    };
  });
}

async function runDecisionOnFixture(page, relPath, fileName) {
  return page.evaluate(
    async ({ relPath, fileName }) => {
      if (fileName.endsWith('.pdf')) {
        await window.HirelyLazy?.ensurePdf?.();
        await window.HirelyLazy?.ensureTesseract?.();
      }
      const res = await fetch(relPath);
      const buf = await res.arrayBuffer();
      const type = fileName.endsWith('.pdf')
        ? 'application/pdf'
        : fileName.endsWith('.docx')
          ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          : 'text/plain';
      const file = new File([buf], fileName, { type });
      const core = await getHirelyCore();
      const out = await core.rewriteImportFromFile(file);
      return {
        reason: out.importDecisionReason || globalThis.HIRELY_LAST_IMPORT_DECISION || null,
        destination: out.importDecisionDestination || globalThis.HIRELY_LAST_IMPORT_DESTINATION || null,
        importState: out.importState,
        textLength: (out.rawText || '').length,
      };
    },
    { relPath, fileName }
  );
}

async function main() {
  await ensureHirelyTestMatrixFixtures(ROOT);
  const unit = runUnitMatrix();
  const unitPass = unit.every((c) => c.pass);

  const lab = path.join(ROOT, 'tests/fixtures/hirely-test-lab');
  const server = await startServer();
  const port = server.address().port;
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page._port = port;

  const browserCases = [];
  try {
    await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(
      () => {
        const b = window.__HIRELY_CORE_BOOT__;
        return b === 'ok' || b === 'degraded' || b?.status === 'ok' || b?.status === 'degraded';
      },
      null,
      { timeout: 60000 }
    );

    const fixtures = [
      { file: 'good.pdf', expect: IMPORT_DECISION_REASON.NATIVE_TEXT_OK },
      { file: 'scan.pdf', expect: IMPORT_DECISION_REASON.OCR_TEXT_OK },
      {
        file: 'bad.pdf',
        expect: [
          IMPORT_DECISION_REASON.OCR_TEXT_TOO_SHORT,
          IMPORT_DECISION_REASON.PDF_IMAGE_ONLY,
        ],
      },
      { file: 'txt.txt', expect: IMPORT_DECISION_REASON.NATIVE_TEXT_OK },
    ];
    for (const fx of fixtures) {
      const fp = path.join(lab, fx.file);
      if (!fs.existsSync(fp)) continue;
      const rel = `/tests/fixtures/hirely-test-lab/${fx.file}`;
      const snap = await runDecisionOnFixture(page, rel, fx.file);
      const expected = Array.isArray(fx.expect) ? fx.expect : [fx.expect];
      browserCases.push({
        file: fx.file,
        expect: expected.join(' | '),
        ...snap,
        pass: expected.includes(snap.reason),
      });
    }
  } finally {
    await browser.close();
    server.close();
  }

  const browserPass = browserCases.length > 0 && browserCases.every((c) => c.pass);
  const status = unitPass && browserPass ? 'PASS' : 'FAIL';

  const payload = {
    generatedAt: new Date().toISOString(),
    status,
    thresholds: { nativeMin: IMPORT_DECISION_NATIVE_MIN, reviewMin: IMPORT_DECISION_REVIEW_MIN },
    unit,
    browserCases,
  };

  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
  fs.writeFileSync(OUT_JSON, JSON.stringify(payload, null, 2));

  const lines = [
    '# Import Decision Final Report',
    '',
    `**Status:** ${status}`,
    `**Generated:** ${payload.generatedAt}`,
    '',
    '## Decision tree',
    '',
    `1. Native PDF text ≥ ${IMPORT_DECISION_NATIVE_MIN} chars → **Review** → \`NATIVE_TEXT_OK\``,
    `2. Native text < ${IMPORT_DECISION_NATIVE_MIN} and PDF → **OCR**`,
    `3. OCR text > ${IMPORT_DECISION_REVIEW_MIN} chars → **Review** → \`OCR_TEXT_OK\``,
    `4. OCR text ≤ ${IMPORT_DECISION_REVIEW_MIN} chars → **Paste** → \`OCR_TEXT_TOO_SHORT\``,
    `5. DOCX/TXT/paste text > ${IMPORT_DECISION_REVIEW_MIN} chars → **Review** → \`NATIVE_TEXT_OK\``,
    '6. Anything else → **Paste** → `RAW_TEXT_TOO_SHORT` or `UNSUPPORTED_FILE` or `PDF_IMAGE_ONLY`',
    '',
    '## Reason codes (exactly one per import)',
    '',
    ...Object.values(IMPORT_DECISION_REASON).map((r) => `- \`${r}\``),
    '',
    '## Unit matrix',
    '',
    '| Case | Expected | Actual | Pass |',
    '|------|----------|--------|------|',
    ...unit.map(
      (c) =>
        `| ${c.id} | ${c.reason} | ${c.actual.reason} | ${c.pass ? 'PASS' : 'FAIL'} |`
    ),
    '',
    '## Browser fixtures',
    '',
    '| File | Expected | Logged | Pass |',
    '|------|----------|--------|------|',
    ...browserCases.map(
      (c) => `| ${c.file} | ${c.expect} | ${c.reason || '—'} | ${c.pass ? 'PASS' : 'FAIL'} |`
    ),
    '',
    '## Module',
    '',
    '`src/core/import/import-decision-final.js`',
    '',
    '## Re-run',
    '',
    '```bash',
    'npm run import-decision-final-report',
    '```',
    '',
  ];

  fs.writeFileSync(OUT_MD, lines.join('\n'));
  console.log(`Wrote ${OUT_MD} — ${status}`);
  process.exit(status === 'PASS' ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
