#!/usr/bin/env node
/**
 * PDF routing — native text layer vs OCR; reading order before parse.
 */
import {
  routePdfExtraction,
  planPdfExtraction,
  PDF_ROUTES,
} from '../core/extraction/pdf-router.js';
import { preparePdfLinesForParsing, LAYOUT_TYPES } from '../core/extraction/pdf-post-extract.js';
import { detectLayout } from '../core/layout/detect-layout.js';

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

const selectable = {
  hasSelectableText: true,
  extractionRoute: 'native',
  fileType: 'pdf_text',
  textLayerFound: true,
  nativeCharCount: 1200,
  quality: { usable: true, reason: 'selectable' },
};
const nativePlan = routePdfExtraction(selectable);
ok(nativePlan.route === PDF_ROUTES.NATIVE, 'selectable text → native_pdf');
ok(nativePlan.ocrAllowed === false, 'never OCR native PDF');
ok(nativePlan.useFullDocumentOcr === false, 'no full-document OCR on native');

const scanned = {
  hasSelectableText: false,
  extractionRoute: 'ocr',
  fileType: 'pdf_scanned',
  textLayerFound: false,
  nativeCharCount: 12,
  quality: { usable: false, reason: 'scanned' },
};
const ocrPlan = routePdfExtraction(scanned);
ok(ocrPlan.route === PDF_ROUTES.OCR, 'scanned → OCR');
ok(ocrPlan.useFullDocumentOcr === true, 'full OCR for scanned');

const mixed = {
  hasSelectableText: false,
  extractionRoute: 'hybrid',
  fileType: 'pdf_mixed',
  textLayerFound: true,
  nativeCharCount: 400,
  quality: { usable: false },
};
const hybridPlan = routePdfExtraction(mixed);
ok(hybridPlan.route === PDF_ROUTES.HYBRID, 'mixed → hybrid');
ok(hybridPlan.ocrMode === 'per_page', 'OCR per page only in hybrid');

const mockPages = [
  {
    page: 1,
    charCount: 500,
    usable: true,
    lines: [
      { text: 'LEFT', cleanedText: 'LEFT', x: 40, y: 700, page: 1 },
      { text: 'RIGHT', cleanedText: 'RIGHT', x: 420, y: 700, page: 1 },
    ],
  },
];
const planned = planPdfExtraction(mockPages, 'LEFT\nRIGHT');
ok(planned.plan.route === PDF_ROUTES.NATIVE || planned.plan.route === PDF_ROUTES.OCR, 'planPdfExtraction returns route');
ok(planned.pdfClassification.routingRoute, 'classification includes routingRoute');

function colLine(text, x, y) {
  return { text, cleanedText: text, rawExtraction: text, x, y, page: 1, confidence: 90, source: 'native' };
}

const twoColLines = [
  colLine('Yohann Azancot', 50, 800),
  colLine('Profile', 50, 720),
  colLine('Creative pro', 50, 680),
  colLine('Languages', 50, 600),
  colLine('French — native', 50, 560),
  colLine('Experience', 400, 800),
  colLine('Freelance Designer', 400, 760),
  colLine('Education', 400, 600),
  colLine('LISAA', 400, 560),
];
const layout = detectLayout({ lines: twoColLines });
ok(
  layout.layoutType === LAYOUT_TYPES.TWO_COLUMN ||
    layout.layoutType === LAYOUT_TYPES.LEFT_SIDEBAR,
  'detect two column or sidebar'
);

const prepared = preparePdfLinesForParsing(twoColLines);
ok(prepared.readingOrderBeforeParse !== false, 'reading order stage attached');
ok(prepared.lines.length >= 6, 'ordered lines preserved');
ok(prepared.usedGeometryReadingOrder === true, 'geometry reading order');
const order = prepared.lines.map((l) => l.cleanedText);
ok(order.indexOf('Languages') < order.indexOf('Experience'), 'left column before right');

const portfolio = detectLayout({
  lines: [],
  cleanedText: 'Portfolio\nBehance\nNike\nAdobe Illustrator\nSelected work',
});
ok(
  portfolio.layoutType === LAYOUT_TYPES.CREATIVE_PORTFOLIO ||
    portfolio.signals.some((s) => s.includes('creative') || s.includes('portfolio')),
  'portfolio layout signal'
);

process.exit(failed ? 1 : 0);
