#!/usr/bin/env node
/**
 * Document reconstruction — PDF layout before parsing; never raw PDF text order.
 */
import {
  reconstructDocument,
  reconstructionToParseReady,
  RECONSTRUCTION_STAGES,
} from '../core/layout/document-reconstruction.js';
import {
  isDateLine,
  isListLine,
  isHeadingLine,
  annotateVisualStructure,
} from '../core/layout/visual-features.js';
import { hasPositionedPdfLines } from '../core/layout/pdf-block-engine.js';
import { preparePdfLinesForParsing } from '../core/extraction/pdf-post-extract.js';

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

function line(text, x, y, page = 1) {
  return {
    text,
    cleanedText: text,
    rawExtraction: text,
    x,
    y,
    width: 120,
    height: 12,
    page,
    confidence: 90,
    source: 'native',
  };
}

ok(RECONSTRUCTION_STAGES.includes('columns'), 'pipeline includes columns');
ok(RECONSTRUCTION_STAGES.includes('headings'), 'pipeline includes headings');
ok(RECONSTRUCTION_STAGES.includes('lists'), 'pipeline includes lists');

ok(isDateLine('2019 – Present'), 'date line detected');
ok(isListLine('• Figma, Illustrator'), 'list line detected');
ok(isHeadingLine('EXPERIENCE'), 'heading line detected');

const twoColLines = [
  line('EXPERIENCE', 40, 720),
  line('Nike — Lead Designer', 40, 680),
  line('2019 – Present', 40, 660),
  line('• Led brand campaigns', 48, 640),
  line('EDUCATION', 420, 720),
  line('LISAA — Bachelor', 420, 680),
];

ok(hasPositionedPdfLines(twoColLines), 'positioned lines');

const recon = reconstructDocument(twoColLines, {
  rawText: twoColLines.map((l) => l.text).join('\n'),
  cleanedText: twoColLines.map((l) => l.text).join('\n'),
  source: 'pdf',
  forbidPlainTextFallback: true,
});

ok(recon.ok === true, 'reconstruction ok');
ok(recon.neverParseRawPdfText === true, 'never parse raw PDF text');
ok(recon.parseFromVisualStructureOnly === true, 'parse from visual structure only');
ok(recon.documentBlocks?.length >= 2, 'document blocks from layout');
ok(recon.visualStructure != null, 'visual structure summary');
ok(Array.isArray(recon.pipeline), 'reconstruction pipeline stages');

const annotated = annotateVisualStructure(
  recon.geometricBlocks?.blocks || [],
  recon.layout,
  recon.columns
);
ok(annotated.some((b) => (b.visualRoles || []).length > 0), 'blocks carry visual roles');

const noLayout = reconstructDocument([], { source: 'pdf', forbidPlainTextFallback: true });
ok(noLayout.ok === false, 'PDF without coordinates fails closed');
ok(noLayout.error === 'DOCUMENT_RECONSTRUCTION_REQUIRES_LAYOUT', 'layout required error');
ok(noLayout.documentBlocks?.length === 0, 'no blocks without layout');

const ready = reconstructionToParseReady(recon);
ok(ready.documentReconstruction === true, 'parse-ready reconstruction flag');
ok(ready.lines?.length >= twoColLines.length, 'ordered lines for parser');

const prepared = preparePdfLinesForParsing(twoColLines, {
  rawText: twoColLines.map((l) => l.text).join('\n'),
  cleanedText: twoColLines.map((l) => l.text).join('\n'),
});
ok(prepared.documentReconstruction === true, 'preparePdf uses reconstruction');
ok(prepared.neverParseRawPdfText === true, 'preparePdf never raw text');
ok(prepared.documentBlocks?.length >= 2, 'preparePdf document blocks');

if (failed) {
  console.error(`\n${failed} failure(s)`);
  process.exit(1);
}
console.log('\nqa-document-reconstruction: PASS');
