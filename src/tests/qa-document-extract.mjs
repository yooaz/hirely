#!/usr/bin/env node
/**
 * Document extract router — format routing without browser OCR.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  extractTxtDocument,
  applyPdfOcrPolicy,
  OCR_MIN_CHARS_HARD,
  OCR_MIN_CHARS_SOFT,
} from '../core/extraction/document-extract.js';
import { extractPlainTextEnterprise } from '../core/extraction/enterprise-engine.js';
import { isOcrFusionEnabled } from '../core/extraction/ocr-multipass.js';
import { detectDocumentStage, DOCUMENT_TYPES } from '../core/extraction/stages/document-detection.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

const yoaz = fs.readFileSync(path.join(root, 'tests/fixtures/yoaz-cv/fixture.txt'), 'utf8');
const txtFile = new File([yoaz], 'cv.txt', { type: 'text/plain' });
const txtResult = await extractTxtDocument(txtFile);
ok(txtResult.method === 'txt', 'txt route');
ok(txtResult.text.includes('Yohann'), 'txt content');

ok(!isOcrFusionEnabled(), 'OCR fusion off by default (faster PDF import)');
ok(isOcrFusionEnabled({ fusion: true }), 'OCR fusion on when opts.fusion=true');

const stageNative = detectDocumentStage({ method: 'native_pdf', fileType: 'pdf_text' });
ok(stageNative.documentType === DOCUMENT_TYPES.PDF_TEXT, 'stage pdf_text');
ok(stageNative.ocrPolicy === 'none', 'pdf_text no OCR');

const stageScan = detectDocumentStage({ method: 'ocr', fileType: 'pdf_scanned' });
ok(stageScan.documentType === DOCUMENT_TYPES.PDF_SCAN, 'stage pdf_scan');
ok(stageScan.ocrPolicy === 'full', 'pdf_scan full OCR');

const shortOcr = extractPlainTextEnterprise('A\nB', 'paste');
shortOcr.method = 'ocr';
shortOcr.metadata = { ...shortOcr.metadata, fileType: 'pdf_scanned' };
shortOcr.pdfExtraction = { fileType: 'pdf_scanned' };
let threw = false;
try {
  applyPdfOcrPolicy(shortOcr);
} catch {
  threw = true;
}
ok(threw, 'pdf OCR below hard min throws');

const midOcr = extractPlainTextEnterprise(
  'Alex Martin\nGraphic Designer\nyo@test.fr\nExperience 2020\nSkills: Figma',
  'paste'
);
midOcr.method = 'ocr';
midOcr.metadata = { fileType: 'pdf_scanned' };
midOcr.pdfExtraction = { fileType: 'pdf_scanned' };
applyPdfOcrPolicy(midOcr);
ok(
  midOcr.rawExtraction.length >= OCR_MIN_CHARS_SOFT || midOcr.metadata.ocrPartial,
  'OCR policy accepts readable band'
);
ok(OCR_MIN_CHARS_HARD === 12, 'hard min 12');
ok(OCR_MIN_CHARS_SOFT === 40, 'soft min 40');

process.exit(failed ? 1 : 0);
