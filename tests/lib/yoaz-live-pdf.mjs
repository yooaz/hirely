/**
 * Resolve Yohann Azancot PDF + bootstrap pdf.js for Node extraction tests.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { bootstrapNodeExtractors } from './node-extractor-bootstrap.mjs';

/**
 * @param {string} root
 */
export function resolveYoazPdfPath(root) {
  const candidates = [
    process.env.HIRELY_YOAZ_PDF,
    join(root, 'tests/fixtures/yoaz-pdf-benchmark/document.pdf'),
    '/Users/yohannazancot/Desktop/Nouveau dossier contenant des éléments/desk/yohann azancot cv 2024.pdf',
    '/Users/yohannazancot/ART_ARCHIVE/PSD/cv2022 yohann azancot copie.pdf',
  ].filter(Boolean);
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return null;
}

export async function bootstrapPdfJs() {
  await bootstrapNodeExtractors();
}

/**
 * @param {string} pdfPath
 */
export function fileFromPdfPath(pdfPath) {
  const buf = readFileSync(pdfPath);
  return new File([buf], basename(pdfPath), { type: 'application/pdf' });
}
