/**
 * OCR Import QA — seven-case fixture pack.
 */
import fs from 'fs';
import path from 'path';
import { PDFDocument } from 'pdf-lib';
import { ensureHirelyTestMatrixFixtures, HIRELY_TEST_MATRIX_DIR } from './hirely-test-matrix-fixtures.mjs';

const TINY_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

/** @typedef {'direct'|'ocr'|'paste'|'paste_input'} OcrQaCaseKind */

/**
 * @typedef {object} OcrQaCase
 * @property {string} id
 * @property {string} file
 * @property {OcrQaCaseKind} kind
 * @property {string} label
 * @property {string} expectNote
 */

/** @type {OcrQaCase[]} */
export const OCR_IMPORT_QA_CASES = [
  {
    id: 'text_pdf',
    file: 'good.pdf',
    kind: 'direct',
    label: 'Text PDF',
    expectNote: 'Native text → direct Review',
  },
  {
    id: 'illustrator_flat',
    file: 'illustrator-flat.pdf',
    kind: 'ocr',
    label: 'Illustrator flattened PDF',
    expectNote: 'Raster PDF → OCR → Review if readable',
  },
  {
    id: 'scanned_pdf',
    file: 'scan.pdf',
    kind: 'ocr',
    label: 'Scanned PDF',
    expectNote: 'Image PDF → OCR → Review if readable',
  },
  {
    id: 'image_only_pdf',
    file: 'image-only.pdf',
    kind: 'paste',
    label: 'Image-only PDF (unreadable)',
    expectNote: 'OCR insufficient → calm paste panel → paste recovery',
  },
  {
    id: 'docx',
    file: 'docx.docx',
    kind: 'direct',
    label: 'DOCX',
    expectNote: 'Word extract → direct Review',
  },
  {
    id: 'txt',
    file: 'txt.txt',
    kind: 'direct',
    label: 'TXT',
    expectNote: 'Plain text → direct Review',
  },
  {
    id: 'paste',
    file: 'paste.txt',
    kind: 'paste_input',
    label: 'Paste text',
    expectNote: 'Paste path → direct Review',
  },
];

async function buildBlankImagePdf(outPath, pngBytes) {
  const pdf = await PDFDocument.create();
  const png = await pdf.embedPng(pngBytes);
  const w = 612;
  const h = 792;
  const page = pdf.addPage([w, h]);
  page.drawImage(png, { x: 0, y: 0, width: w, height: h });
  fs.writeFileSync(outPath, await pdf.save());
}

/**
 * @param {string} root
 */
export async function ensureOcrImportQaFixtures(root) {
  const base = await ensureHirelyTestMatrixFixtures(root);
  const dir = path.join(root, HIRELY_TEST_MATRIX_DIR);

  const scanPath = base.paths.scan || path.join(dir, 'scan.pdf');

  const illustratorFlat = path.join(dir, 'illustrator-flat.pdf');
  if (!fs.existsSync(illustratorFlat) && fs.existsSync(scanPath)) {
    fs.copyFileSync(scanPath, illustratorFlat);
  }

  const canvaExport = path.join(dir, 'canva-export.pdf');
  if (!fs.existsSync(canvaExport) && fs.existsSync(scanPath)) {
    fs.copyFileSync(scanPath, canvaExport);
  }

  const imageOnly = path.join(dir, 'image-only.pdf');
  if (!fs.existsSync(imageOnly) || fs.statSync(imageOnly).size < 500) {
    await buildBlankImagePdf(imageOnly, Buffer.from(TINY_PNG_B64, 'base64'));
  }

  /** @type {Record<string, string>} */
  const paths = { ...base.paths };
  for (const c of OCR_IMPORT_QA_CASES) {
    paths[c.id] = path.join(dir, c.file);
  }
  paths.illustrator_flat = illustratorFlat;
  paths.image_only_pdf = imageOnly;

  return { dir, paths, pastePath: base.pastePath || path.join(dir, 'paste.txt') };
}
