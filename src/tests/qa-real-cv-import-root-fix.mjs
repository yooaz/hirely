#!/usr/bin/env node
/**
 * P0 — Real CV import root fix acceptance checks.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { planPdfExtraction } from '../core/extraction/pdf-router.js';
import {
  REAL_CV_IMPORT_ROOT_V1,
  REAL_CV_IMPORT_MIN_CHARS,
  REAL_CV_IMPORT_RENDER_MIN_CHARS,
  hasMeaningfulImportText,
  hasRenderableImportText,
  buildThinTextPasteResult,
  buildEmptyExtractPasteResult,
  ensureImportContentAccounting,
  REAL_CV_IMPORT_FAILURE_REASONS,
} from '../core/import/real-cv-import-root.js';
import { buildOcrParserBlockedResult } from '../core/import/ocr-parser-gate.js';
import { IMPORT_STATE } from '../core/import/import-state.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT_DIR = path.join(ROOT, 'tests/output/real-cv-import-root-fix');
const REPORT_JSON = path.join(OUT_DIR, 'report.json');

let failed = 0;
const checks = [];

function record(id, pass, detail = '') {
  checks.push({ id, pass, detail });
  if (!pass) {
    failed++;
    console.error(`FAIL ${id}${detail ? ` — ${detail}` : ''}`);
  } else {
    console.log(`PASS ${id}`);
  }
}

record('policy_version', REAL_CV_IMPORT_ROOT_V1 === 'REAL_CV_IMPORT_ROOT_V1');
record('min_chars_300', REAL_CV_IMPORT_MIN_CHARS === 300);
record('render_min_20', REAL_CV_IMPORT_RENDER_MIN_CHARS === 20);

record('meaningful_300', hasMeaningfulImportText('x'.repeat(300)));
record('not_meaningful_299', !hasMeaningfulImportText('x'.repeat(299)));
record('renderable_20', hasRenderableImportText('x'.repeat(20)));
record('not_renderable_19', !hasRenderableImportText('x'.repeat(19)));

const thin = buildThinTextPasteResult({
  rawText: 'Short CV snippet with name only.',
  cleanedText: 'Short CV snippet with name only.',
  extractionMethod: 'pdf',
  warnings: [],
  errors: [],
});
record('thin_no_resume_data', thin.resumeData === null);
record('thin_preserves_raw', thin.rawText.length > 0);
record('thin_needs_paste', thin.importState === IMPORT_STATE.IMPORT_NEEDS_PASTE);
record('thin_rejected_garbage', Array.isArray(thin.rejectedGarbage) && thin.rejectedGarbage.length > 0);
record('thin_failure_reason', thin.importFailureReason === REAL_CV_IMPORT_FAILURE_REASONS.thin_text);
record('thin_import_fallback', Boolean(thin.importFallback?.reason));

const empty = buildEmptyExtractPasteResult(
  { rawText: '', cleanedText: '', warnings: [], errors: [] },
  'pdf',
  REAL_CV_IMPORT_FAILURE_REASONS.ocr_timeout
);
record('empty_no_resume_data', empty.resumeData === null);
record('empty_ocr_timeout_reason', empty.importFailureReason === REAL_CV_IMPORT_FAILURE_REASONS.ocr_timeout);

const ocrBlocked = buildOcrParserBlockedResult(
  { pass: false, message: 'OCR quality too low' },
  { rawText: 'garbled scan line one\ngarbled scan line two', cleanedText: 'garbled scan line one' }
);
record('ocr_block_preserves_text', ocrBlocked.rawText.length > 0);
record('ocr_block_rejected_garbage', ocrBlocked.rejectedGarbage.length >= 2);
record('ocr_block_no_resume', ocrBlocked.resumeData === null);

const accounted = ensureImportContentAccounting({
  rawText: ['Alex Martin', 'Senior Designer', 'alex@example.com', 'Hidden orphan line here'].join('\n'),
  resumeData: {
    identity: { name: 'Alex Martin', email: 'alex@example.com' },
    experiences: [],
    education: [],
    skills: [],
    tools: [],
  },
  reviewQueue: [],
  rejectedGarbage: [],
});
record(
  'content_accounting_meta',
  accounted.resumeData.meta?.contentAccounting?.rawLines >= 3
);
record(
  'orphan_line_accounted',
  accounted.rejectedGarbage.some((l) => /orphan/i.test(l)) ||
    accounted.reviewQueue.some((r) => /orphan/i.test(String(r.sourceText || '')))
);

const strongText = [
  'Alex Martin',
  'Senior Designer',
  'alex@example.com',
  'Paris, France',
  'Experience',
  'Lead Designer — Studio Azur — 2019 – Present',
  'Directed brand systems across luxury and lifestyle clients.',
  'Education',
  'MA Design — ENSAD — 2014',
  'Skills',
  'Figma, Illustrator, InDesign, Photoshop, After Effects',
  'Languages',
  'French — Native · English — Fluent',
  'x'.repeat(120),
].join('\n');
const strongNativePages = [
  {
    page: 1,
    charCount: strongText.length,
    usable: true,
    lines: [{ text: strongText }],
  },
];
const strongPlan = planPdfExtraction(strongNativePages, strongText);
record('strong_native_no_ocr', strongPlan.plan.ocrAllowed === false, strongPlan.plan.reason);

const weakText = 'Alex Martin\nalex@example.com';
const weakNativePages = [
  {
    page: 1,
    charCount: weakText.length,
    usable: true,
    lines: [{ text: weakText }],
  },
];
const weakPlan = planPdfExtraction(weakNativePages, weakText);
record('weak_native_ocr_allowed', weakPlan.plan.ocrAllowed === true, weakPlan.plan.reason);
record('weak_native_supplement_mode', weakPlan.plan.ocrMode === 'supplement');

const canonSrc = fs.readFileSync(path.join(ROOT, 'src/core/import/canonical-import.js'), 'utf8');
const entSrc = fs.readFileSync(path.join(ROOT, 'src/core/extraction/enterprise-engine.js'), 'utf8');
const routerSrc = fs.readFileSync(path.join(ROOT, 'src/core/extraction/pdf-router.js'), 'utf8');

record('canonical_thin_gate', /buildThinTextPasteResult/.test(canonSrc));
record('canonical_empty_gate', /buildEmptyExtractPasteResult/.test(canonSrc));
record('canonical_content_accounting', /ensureImportContentAccounting/.test(canonSrc));
record('canonical_meaningful_gate', /hasMeaningfulImportText/.test(canonSrc));
record('enterprise_weak_supplement', /supplementWeakNativeWithOcr/.test(entSrc));
record('router_weak_native', /selectable_text_weak_native/.test(routerSrc));

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(
  REPORT_JSON,
  JSON.stringify(
    {
      version: REAL_CV_IMPORT_ROOT_V1,
      generatedAt: new Date().toISOString(),
      pass: failed === 0,
      failed,
      checks,
      thresholds: {
        meaningfulMin: REAL_CV_IMPORT_MIN_CHARS,
        renderMin: REAL_CV_IMPORT_RENDER_MIN_CHARS,
      },
    },
    null,
    2
  )
);

console.log(failed ? `\n${failed} failed` : '\nReal CV import root fix checks passed');
process.exit(failed ? 1 : 0);
