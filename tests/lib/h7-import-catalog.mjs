/**
 * H7 import stability — upload scenario catalog.
 */
import fs from 'fs';
import path from 'path';

export const H7_IMPORT_V1 = 'h7-import-stability-v1';

/** Terminal import states — app must land here, never white-screen. */
export const H7_TERMINAL_STATES = new Set([
  'IMPORT_READY',
  'IMPORT_PARTIAL',
  'IMPORT_NEEDS_PASTE',
  'IMPORT_FAILED',
  'IMPORT_SUCCESS',
  'PDF_OCR_TIMEOUT',
  'PDF_TEXT_EMPTY',
  'PASTE_FALLBACK_REQUIRED',
]);

export const H7_SCENARIOS = [
  { id: 'pdf_click', label: 'PDF upload (click)', channel: 'browser', method: 'click', kind: 'pdf' },
  { id: 'pdf_drop', label: 'PDF upload (drag & drop)', channel: 'browser', method: 'drop', kind: 'pdf' },
  { id: 'pdf_large', label: 'Large PDF', channel: 'node+browser', method: 'click', kind: 'pdf_large' },
  { id: 'pdf_scanned', label: 'Scanned / image PDF', channel: 'node', method: 'file', kind: 'pdf_scanned' },
  { id: 'docx_upload', label: 'DOCX upload', channel: 'browser', method: 'drop', kind: 'docx' },
  { id: 'mobile_upload', label: 'Mobile upload (file input)', channel: 'browser', method: 'mobile', kind: 'pdf' },
  { id: 'error_unsupported', label: 'Unsupported file type', channel: 'browser', method: 'drop', kind: 'unsupported' },
  { id: 'error_corrupt_pdf', label: 'Corrupt / empty PDF', channel: 'node', method: 'file', kind: 'corrupt_pdf' },
  { id: 'error_no_file', label: 'Missing file (null)', channel: 'browser', method: 'null', kind: 'none' },
  { id: 'error_empty_name', label: 'Empty filename', channel: 'node', method: 'file', kind: 'empty_name' },
];

export function resolveFirstExisting(root, candidates = []) {
  for (const p of candidates) {
    if (!p) continue;
    const abs = path.isAbsolute(p) ? p : path.join(root, p);
    if (fs.existsSync(abs)) return abs;
  }
  return null;
}

export function defaultFixturePaths(root) {
  return {
    pdf: resolveFirstExisting(root, [
      process.env.HIRELY_YOAZ_PDF,
      'tests/output/p7-final-lock/fixture.pdf',
      'tests/output/truth-test/truth-export.pdf',
      'tests/output/pdf-export-qa/one-page.pdf',
    ]),
    docx: resolveFirstExisting(root, [
      process.env.HIRELY_ACCEPT_DOCX,
      'tests/output/p7-final-lock/fixture.docx',
      'tests/fixtures/text-cv.docx',
    ]),
    txt: resolveFirstExisting(root, ['tests/fixtures/mvp-sample.txt']),
    unsupported: path.join(root, 'tests/output/import-qa-unsupported.bin'),
  };
}

export function makeNodeFile(buf, name, type) {
  if (typeof File !== 'undefined') {
    return new File([buf], name, { type });
  }
  return {
    name,
    type,
    size: buf.length,
    arrayBuffer: async () =>
      buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
  };
}
