/**
 * REAL_FORMAT_QA — ensure real corpus files per format category.
 */
import fs from 'fs';
import path from 'path';
import {
  buildMinimalDocx,
  buildTextPdf,
  ensureFormatSupportFixtures,
  fileFromPath,
} from './format-support-fixtures.mjs';
import { ensureH7Fixtures } from './h7-import-runner.mjs';

const CORPUS = [
  { key: 'yoaz', rel: 'tests/fixtures/yoaz-cv/fixture.txt' },
  { key: 'designer', rel: 'tests/fixtures/creative-cv/fixture.txt' },
  { key: 'consultant', rel: 'tests/fixtures/consultant-cv/fixture.txt' },
  { key: 'developer', rel: 'tests/fixtures/developer-cv/fixture.txt' },
];

const BLANK_SCAN_PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj\nxref\n0 4\ntrailer<</Root 1 0 R>>\n%%EOF\n'
);

function readText(root, rel) {
  const fp = path.join(root, rel);
  return fs.existsSync(fp) ? fs.readFileSync(fp, 'utf8') : '';
}

/**
 * @param {string} root
 */
export async function ensureRealFormatQaFixtures(root) {
  const outDir = path.join(root, 'tests/output/real-format-qa');
  fs.mkdirSync(outDir, { recursive: true });

  const fmt = ensureFormatSupportFixtures(root);
  const h7 = ensureH7Fixtures(root);
  const texts = Object.fromEntries(
    CORPUS.map(({ key, rel }) => [key, readText(root, rel)])
  );

  /** @type {Record<string, string>} */
  const files = {};

  for (const key of ['yoaz', 'designer', 'consultant']) {
    const pdfPath = path.join(outDir, `pdf-selectable-${key}.pdf`);
    if (texts[key] && !fs.existsSync(pdfPath)) {
      await buildTextPdf(pdfPath, texts[key]);
    }
    files[`pdf_sel_${key}`] = pdfPath;
  }

  files.pdf_scan_blank = h7.scanned || path.join(outDir, 'scan-blank.pdf');
  if (!fs.existsSync(files.pdf_scan_blank)) {
    fs.writeFileSync(files.pdf_scan_blank, BLANK_SCAN_PDF);
  }
  files.pdf_scan_corrupt = h7.corrupt || path.join(outDir, 'scan-corrupt.pdf');
  if (!fs.existsSync(files.pdf_scan_corrupt)) {
    fs.writeFileSync(files.pdf_scan_corrupt, '%PDF-1.4\n% corrupt\n');
  }
  files.pdf_scan_protected = path.join(outDir, 'scan-protected.pdf');
  if (!fs.existsSync(files.pdf_scan_protected)) {
    fs.writeFileSync(files.pdf_scan_protected, '%PDF-1.4\n% encrypted simulation\n');
  }

  for (const key of ['yoaz', 'designer', 'consultant']) {
    const docxPath = path.join(outDir, `cv-${key}.docx`);
    if (texts[key] && !fs.existsSync(docxPath)) {
      buildMinimalDocx(docxPath, texts[key]);
    }
    files[`docx_${key}`] = docxPath;
  }

  files.doc_legacy = path.join(outDir, 'cv-yoaz-legacy.doc');
  if (!fs.existsSync(files.doc_legacy) && fs.existsSync(files.docx_yoaz)) {
    fs.copyFileSync(files.docx_yoaz, files.doc_legacy);
  }

  files.txt_yoaz = path.join(outDir, 'yoaz.txt');
  if (texts.yoaz && !fs.existsSync(files.txt_yoaz)) {
    fs.writeFileSync(files.txt_yoaz, texts.yoaz);
  }
  files.txt_developer = path.join(outDir, 'developer.txt');
  if (texts.developer && !fs.existsSync(files.txt_developer)) {
    fs.writeFileSync(files.txt_developer, texts.developer);
  }

  files.img_png = fmt.pngPath;
  files.img_jpg = fmt.jpgPath;

  return { outDir, files, texts, h7, fmt };
}

/** @returns {import('./real-format-qa-fixtures.mjs').RealFormatCase[]} */
export function buildRealFormatCases(files) {
  return [
    { id: 'pdf_sel_yoaz', category: 'pdf_selectable', label: 'PDF selectable — Yoaz', fileKey: 'pdf_sel_yoaz', name: 'yoaz-selectable.pdf' },
    { id: 'pdf_sel_designer', category: 'pdf_selectable', label: 'PDF selectable — Designer', fileKey: 'pdf_sel_designer', name: 'designer-selectable.pdf' },
    { id: 'pdf_sel_consultant', category: 'pdf_selectable', label: 'PDF selectable — Consultant', fileKey: 'pdf_sel_consultant', name: 'consultant-selectable.pdf' },
    { id: 'pdf_scan_blank', category: 'pdf_scanned', label: 'PDF scanned — blank page', fileKey: 'pdf_scan_blank', name: 'blank-scan.pdf', browserStuckCheck: true },
    { id: 'pdf_scan_corrupt', category: 'pdf_scanned', label: 'PDF scanned — corrupt', fileKey: 'pdf_scan_corrupt', name: 'corrupt-scan.pdf', browserStuckCheck: true },
    { id: 'pdf_scan_protected', category: 'pdf_scanned', label: 'PDF scanned — protected', fileKey: 'pdf_scan_protected', name: 'protected-scan.pdf', browserStuckCheck: true },
    { id: 'docx_yoaz', category: 'docx', label: 'DOCX — Yoaz', fileKey: 'docx_yoaz', name: 'yoaz.docx' },
    { id: 'docx_designer', category: 'docx', label: 'DOCX — Designer', fileKey: 'docx_designer', name: 'designer.docx' },
    { id: 'docx_consultant', category: 'docx', label: 'DOCX — Consultant', fileKey: 'docx_consultant', name: 'consultant.docx' },
    { id: 'doc_legacy', category: 'doc_legacy', label: 'DOC legacy — Yoaz', fileKey: 'doc_legacy', name: 'yoaz-legacy.doc' },
    { id: 'txt_yoaz', category: 'txt', label: 'TXT — Yoaz', fileKey: 'txt_yoaz', name: 'yoaz.txt' },
    { id: 'txt_developer', category: 'txt', label: 'TXT — Developer', fileKey: 'txt_developer', name: 'developer.txt' },
    { id: 'img_png', category: 'image', label: 'Image — PNG', fileKey: 'img_png', name: 'cv-scan.png', browserStuckCheck: true },
    { id: 'img_jpg', category: 'image', label: 'Image — JPEG', fileKey: 'img_jpg', name: 'cv-scan.jpg', browserStuckCheck: true },
  ].map((c) => ({ ...c, path: files[c.fileKey] }));
}

export function caseFile(caseDef) {
  if (!caseDef?.path || !fs.existsSync(caseDef.path)) return null;
  return fileFromPath(caseDef.path, caseDef.name);
}
