#!/usr/bin/env node
/**
 * Extraction recovery UX — guidance mapping, merged report, blocked preview contract.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assessPreviewRenderGate,
  sanitizeCvDataForCorrection,
} from '../core/validation/preview-render-gate.js';
import {
  mapIssueToUserFacing,
  mapGateIssuesToUserFacing,
  ISSUE_CODE_GUIDANCE,
  buildRecoveryGuidanceSummary,
} from '../core/validation/extraction-recovery-guidance.js';
import {
  buildExtractionRecoveryContext,
  buildExtractionRecoveryDebugObject,
} from '../core/validation/extraction-recovery-context.js';
import { buildMergedExtractionRecoveryReport } from '../core/validation/extraction-recovery.js';
import { fallbackRawTextCvData } from '../core/import/simple-import-mode.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../..');
const indexHtml = readFileSync(join(ROOT, 'index.html'), 'utf8');
const panelJs = readFileSync(join(ROOT, 'src/ui/product/extraction-recovery-panel.js'), 'utf8');

let failed = 0;
function ok(c, m) {
  if (!c) {
    console.error('FAIL', m);
    failed++;
  } else console.log('OK', m);
}

const merged =
  'Yohann Azancot yoaz@hotmail.fr +33649434839 Experience Freelance Illustrator Education LISAA Languages French English Skills Photoshop';
const blobCv = fallbackRawTextCvData(merged, merged);
const gate = assessPreviewRenderGate(blobCv, { rawTextLength: merged.length });

ok(gate.blockPremiumRender, 'gate blocks blob cv');
ok(gate.issues.some((i) => i.code === 'unsafe_name'), 'unsafe_name in gate');
ok(
  gate.issues.some((i) => i.code === 'thin_structure_rich_raw' || i.code === 'raw_blob_experience'),
  'structure weakness flagged'
);

const unsafeMapped = mapIssueToUserFacing({ code: 'unsafe_name', field: 'name' });
ok(unsafeMapped.message.includes('name'), 'unsafe_name has user message');
ok(unsafeMapped.title === ISSUE_CODE_GUIDANCE.unsafe_name.title, 'unsafe_name title mapped');
ok(!unsafeMapped.message.includes('unsafe_name'), 'user message hides raw code');

const thinMapped = mapIssueToUserFacing({ code: 'thin_structure_rich_raw', field: 'experience' });
ok(thinMapped.actions.includes('confirm_experience'), 'thin structure suggests experience fix');

const userIssues = mapGateIssuesToUserFacing(gate.issues, { nameCandidates: ['Yohann Azancot'] });
ok(userIssues.length >= 2, 'maps all gate issues');

const guidance = buildRecoveryGuidanceSummary({
  previewGate: gate,
  diagnostics: { nameCandidates: ['Yohann Azancot'], portfolioPages: [2], ocrCompleted: true },
});
ok(guidance.primaryActions.length >= 2, 'primary recovery actions generated');
ok(guidance.suggestions.some((s) => s.type === 'name_candidate'), 'name suggestion generated');

const mergedReport = buildMergedExtractionRecoveryReport({
  cvData: blobCv,
  finalResumeData: {
    identity: { name: blobCv.name, email: 'yoaz@hotmail.fr' },
    experiences: blobCv.experience,
    meta: {
      extractionMethod: 'hybrid',
      identityRecoveryHints: { nameCandidates: ['Yohann Azancot', 'Amsterdam Kraken'] },
      pageDocumentClassification: { portfolio_pages: [2], resume_core_pages: [1] },
    },
  },
  previewGate: gate,
  rawTextLength: merged.length,
  runtime: {
    method: 'hybrid',
    pageRuntimeTrace: [
      { page: 1, method: 'ocr', ocrDurationMs: 43000, lineCount: 120 },
      { page: 2, method: 'native', lineCount: 40, nativeTrusted: false },
    ],
  },
});
ok(mergedReport.showRecovery, 'merged report shows recovery');
ok(mergedReport.blockRender, 'merged report blocks render');
ok(mergedReport.detectedIssues.some((i) => i.userFacing && i.title), 'detected issues are user facing');
ok(mergedReport.diagnostics?.ocrCompleted, 'diagnostics ocr completed flag');
ok(mergedReport.debug?.blockReasons?.includes('unsafe_name'), 'debug block reasons');
ok(mergedReport.primaryActions?.length >= 1, 'merged report primary actions');

const partialGate = assessPreviewRenderGate(blobCv, {
  rawTextLength: merged.length,
  userConfirmedPartial: true,
});
ok(
  !partialGate.issues.some((i) => i.code === 'thin_structure_rich_raw'),
  'partial continue drops thin_structure issue'
);
ok(partialGate.issues.some((i) => i.code === 'unsafe_name'), 'partial continue keeps unsafe_name');

const thinOnlyGate = assessPreviewRenderGate(
  {
    name: 'Yohann Azancot',
    title: 'Designer',
    experience: [{ role: 'Freelance', company: 'Self', dates: '2020', bullets: [] }],
    education: [],
    skills: ['Illustration'],
  },
  { rawTextLength: 1200, userConfirmedPartial: true }
);
ok(thinOnlyGate.allowPremiumPreview, 'fixed name + partial continue allows preview when only thin structure');

const sanitized = sanitizeCvDataForCorrection(blobCv);
ok(!sanitized.name, 'sanitized still withholds bad name');

const ctx = buildExtractionRecoveryContext({
  resumeData: {
    meta: {
      extractionMethod: 'hybrid',
      identityRecoveryHints: { nameCandidates: ['Yohann Azancot'] },
      pageDocumentClassification: { portfolio_pages: [2], resume_core_pages: [1] },
    },
  },
  runtime: {
    pageRuntimeTrace: [{ page: 1, method: 'ocr', ocrDurationMs: 1000, lineCount: 10 }],
  },
});
ok(ctx.pages.length === 1, 'context builds page rows');
ok(ctx.nameCandidates.includes('Yohann Azancot'), 'context name candidates');

const debugObj = buildExtractionRecoveryDebugObject({ previewGate: gate, guidance });
ok(debugObj.version === 'EXTRACTION_RECOVERY_DEBUG_V1', 'debug object version');

ok(indexHtml.includes('renderPreviewCorrectionState'), 'index blocked preview renderer');
ok(indexHtml.includes('syncRecoveryModeChrome'), 'index recovery chrome sync');
ok(indexHtml.includes('workspaceGrid--recovery-mode'), 'index recovery mode class');
ok(indexHtml.includes('buildMergedExtractionRecoveryReport'), 'index merged recovery import');
ok(indexHtml.includes('__HIRELY_UI_FLOW__'), 'index publishes ui flow debug');

ok(panelJs.includes('extractionRecoveryPanel--blocked'), 'panel blocked styling');
ok(panelJs.includes('Header candidates'), 'panel shows candidates');
ok(panelJs.includes('Pages detected'), 'panel shows pages');
ok(panelJs.includes('continue_partial'), 'panel partial continue button');
ok(panelJs.includes('cvRecoveryIssueList') === false, 'panel is separate from preview state');

if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log('\nAll extraction recovery UX checks passed.');
