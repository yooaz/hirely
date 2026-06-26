#!/usr/bin/env node
/**
 * Extraction reliability — native PDFs must never use OCR paths.
 */
import {
  classifyPdfForExtraction,
  detectInputFileType,
  extractionSourceLabel,
} from '../core/extraction/file-type-detect.js';
import {
  assessPdfTextLayer,
  detectPdfDocumentKind,
} from '../core/extraction/pdf-text-quality.js';

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

ok(detectInputFileType({ name: 'cv.pdf', type: 'application/pdf' }).kind === 'pdf', 'detect PDF');
ok(detectInputFileType({ name: 'scan.png', type: 'image/png' }).kind === 'image', 'detect image');
ok(detectInputFileType({ name: 'cv.docx' }).kind === 'docx', 'detect docx');
ok(detectInputFileType({ name: 'notes.txt' }).kind === 'txt', 'detect txt');
ok(extractionSourceLabel('native_pdf') === 'Native PDF', 'label native');
ok(extractionSourceLabel('ocr') === 'OCR', 'label ocr');
ok(extractionSourceLabel('mixed') === 'Mixed', 'label mixed');

const richNative = `Yohann Azancot
Freelance Illustrator
Paris, France
yohann@example.com

EXPERIENCE
Studio ABC — Lead Designer 2020–2024
Created brand systems and illustration for global campaigns.

EDUCATION
École des Arts — BFA Illustration

SKILLS
Illustration, Photoshop, Figma, Art Direction`;

const pagesRich = [
  { page: 1, charCount: richNative.length, lines: [{ text: 'line' }], usable: true },
];
const profileRich = classifyPdfForExtraction(pagesRich, richNative);
ok(profileRich.textLayerFound, 'rich PDF textLayerFound');
ok(profileRich.hasSelectableText, 'rich PDF hasSelectableText');
ok(profileRich.fileType === 'pdf_text', 'rich PDF classified pdf_text');

const emptyPages = [{ page: 1, charCount: 0, lines: [], usable: false }];
const profileScan = classifyPdfForExtraction(emptyPages, '');
ok(!profileScan.textLayerFound, 'empty scan no text layer');
ok(!profileScan.hasSelectableText, 'empty scan not selectable');
ok(profileScan.fileType === 'pdf_scanned', 'empty classified pdf_scanned');

const ghost = 'a b c';
const profileGhost = classifyPdfForExtraction(
  [{ page: 1, charCount: ghost.length, lines: [{ text: 'a' }], usable: false }],
  ghost
);
ok(!profileGhost.textLayerFound, 'short ghost below text-layer threshold');
ok(!profileGhost.hasSelectableText, 'ghost not selectable → scanned');
ok(profileGhost.fileType === 'pdf_scanned', 'ghost → pdf_scanned');

const junk80 = 'x'.repeat(90);
const profileJunk = classifyPdfForExtraction(
  [{ page: 1, charCount: junk80.length, lines: [{ text: 'x' }], usable: false }],
  junk80
);
ok(profileJunk.textLayerFound, 'long junk text layer present');
ok(!profileJunk.hasSelectableText, '90 junk chars must not skip OCR');
ok(profileJunk.fileType === 'pdf_scanned', 'junk 90 chars → pdf_scanned');

const q = assessPdfTextLayer(richNative);
ok(q.usable, 'fixture passes text layer quality');

const docNative = detectPdfDocumentKind(pagesRich, richNative);
ok(docNative.kind === 'native_pdf', 'rich doc classified native_pdf');
ok(docNative.route === 'native', 'rich doc routes native');

const mixedPages = [
  {
    page: 1,
    charCount: richNative.length,
    usable: true,
    lines: [{ text: 'Experience line' }],
  },
  { page: 2, charCount: 0, usable: false, lines: [] },
];
const docMixed = detectPdfDocumentKind(mixedPages, richNative);
ok(docMixed.kind === 'pdf_mixed', 'partial native pages → pdf_mixed');
ok(docMixed.route === 'hybrid', 'mixed doc routes hybrid');

const profileMixed = classifyPdfForExtraction(mixedPages, richNative);
ok(profileMixed.fileType === 'pdf_mixed', 'classify returns pdf_mixed');

process.exit(failed ? 1 : 0);
