/**
 * Hirely Test Lab — six-file fixture pack (good/bad/scan/docx/txt/paste).
 */
import fs from 'fs';
import path from 'path';
import { PDFDocument } from 'pdf-lib';
import { buildMinimalDocx, buildTextPdf } from './format-support-fixtures.mjs';

export const HIRELY_TEST_MATRIX_DIR = 'tests/fixtures/hirely-test-lab';

const TINY_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

/** @typedef {'ready'|'needs_paste'} ImportExpect */

/**
 * @typedef {object} TestMatrixFixture
 * @property {string} id
 * @property {string} file
 * @property {'file'|'paste'} mode
 * @property {string} label
 * @property {ImportExpect} importExpect
 * @property {boolean} chainPasteForDownstream
 * @property {string} [notes]
 */

/** @type {TestMatrixFixture[]} */
export const HIRELY_TEST_MATRIX_FIXTURES = [
  {
    id: 'paste',
    file: 'paste.txt',
    mode: 'paste',
    label: 'Paste fallback text',
    importExpect: 'ready',
    chainPasteForDownstream: false,
  },
  {
    id: 'txt',
    file: 'txt.txt',
    mode: 'file',
    label: 'Plain text CV',
    importExpect: 'ready',
    chainPasteForDownstream: false,
  },
  {
    id: 'docx',
    file: 'docx.docx',
    mode: 'file',
    label: 'Word DOCX',
    importExpect: 'ready',
    chainPasteForDownstream: false,
  },
  {
    id: 'bad',
    file: 'bad.pdf',
    mode: 'file',
    label: 'Corrupt / unreadable PDF',
    importExpect: 'needs_paste',
    chainPasteForDownstream: true,
    notes: 'Import → paste; review/template/export use paste.txt recovery',
  },
  {
    id: 'scan',
    file: 'scan.pdf',
    mode: 'file',
    label: 'Scanned image PDF (no text layer)',
    importExpect: 'needs_paste',
    chainPasteForDownstream: true,
    notes: 'V1: scanned PDF → paste panel; review/template/export use paste.txt recovery',
  },
  {
    id: 'good',
    file: 'good.pdf',
    mode: 'file',
    label: 'Selectable text PDF',
    importExpect: 'ready',
    chainPasteForDownstream: false,
  },
];

async function buildImageOnlyPdf(outPath, pngBytes) {
  const pdf = await PDFDocument.create();
  const png = await pdf.embedPng(pngBytes);
  const w = 612;
  const h = 792;
  const page = pdf.addPage([w, h]);
  page.drawImage(png, { x: 0, y: 0, width: w, height: h });
  fs.writeFileSync(outPath, await pdf.save());
}

/** Image-only PDF with readable CV text for OCR regression (not a 1×1 placeholder). */
async function buildOcrReadableScanPdf(outPath, cvText) {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 612, height: 792 } });
  const safe = String(cvText || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  await page.setContent(
    `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:Arial,Helvetica,sans-serif;padding:36px 42px;font-size:13px;line-height:1.45;color:#111;white-space:pre-wrap;background:#fff">${safe}</body></html>`,
    { waitUntil: 'domcontentloaded' }
  );
  const png = await page.screenshot({ type: 'png', fullPage: true });
  await browser.close();
  await buildImageOnlyPdf(outPath, png);
}

/**
 * @param {string} root
 */
export async function ensureHirelyTestMatrixFixtures(root) {
  const dir = path.join(root, HIRELY_TEST_MATRIX_DIR);
  fs.mkdirSync(dir, { recursive: true });

  const txtPath = path.join(dir, 'txt.txt');
  const pastePath = path.join(dir, 'paste.txt');
  const goodText = fs.existsSync(txtPath) ? fs.readFileSync(txtPath, 'utf8') : '';

  const goodPdf = path.join(dir, 'good.pdf');
  if (goodText && !fs.existsSync(goodPdf)) {
    await buildTextPdf(goodPdf, goodText);
  }

  const docxPath = path.join(dir, 'docx.docx');
  if (goodText && !fs.existsSync(docxPath)) {
    buildMinimalDocx(docxPath, goodText);
  }

  const badPdf = path.join(dir, 'bad.pdf');
  if (!fs.existsSync(badPdf)) {
    fs.writeFileSync(badPdf, '%PDF-1.4\n% corrupt hirely test lab\n');
  }

  const scanPdf = path.join(dir, 'scan.pdf');
  const scanSource = goodText || 'Marie Dupont\nProduct Manager';
  const regenScan =
    process.env.HIRELY_REGEN_SCAN_PDF === '1' ||
    !fs.existsSync(scanPdf) ||
    fs.statSync(scanPdf).size < 8000;
  if (regenScan) {
    await buildOcrReadableScanPdf(scanPdf, scanSource);
  }

  /** @type {Record<string, string>} */
  const paths = {};
  for (const fx of HIRELY_TEST_MATRIX_FIXTURES) {
    const fp = path.join(dir, fx.file);
    paths[fx.id] = fp;
  }

  return { dir, paths, pastePath };
}
