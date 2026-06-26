#!/usr/bin/env node
/**
 * HIRELY P0 — CV empty preview root cause audit.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { auditCvPreviewDensity } from '../core/audit/cv-preview-density.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT = path.join(ROOT, 'tests/output/cv-empty-preview-root-cause/report.json');

const FIXTURES = [
  { id: 'mvp-sample', file: 'tests/fixtures/mvp-sample.txt' },
  { id: 'review-rich', file: 'tests/fixtures/review-consistency-rich.txt' },
];

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });

const results = {};
for (const fx of FIXTURES) {
  const text = fs.readFileSync(path.join(ROOT, fx.file), 'utf8');
  const audit = await auditCvPreviewDensity(text, { templateId: 'editorial' });
  results[fx.id] = audit;
  console.log(`\n[${fx.id}] density=${audit.previewDensity}% visibility=${audit.visibilityScore}%`);
  for (const key of Object.keys(audit.sectionRows)) {
    const r = audit.sectionRows[key];
    if (r.DETECTED_DATA_COUNT || r.FINAL_DATA_COUNT || r.RENDERED_DATA_COUNT) {
      console.log(
        `  ${key}: det=${r.DETECTED_DATA_COUNT} final=${r.FINAL_DATA_COUNT} rendered=${r.RENDERED_DATA_COUNT}`
      );
    }
  }
  ok(audit.previewDensity >= 80, `${fx.id} preview density >= 80% (${audit.previewDensity}%)`);
  ok(audit.htmlLength > 400, `${fx.id} rendered HTML (${audit.htmlLength} chars)`);
  ok(audit.contractRenderable, `${fx.id} finalResumeData renderable`);
}

const mvp = results['mvp-sample'];
ok((mvp?.sectionRows?.education?.FINAL_DATA_COUNT ?? 0) >= 1, 'mvp-sample keeps education in finalResumeData');
ok((mvp?.sectionRows?.education?.RENDERED_DATA_COUNT ?? 0) >= 1, 'mvp-sample renders education');

const report = {
  feature: 'CV_EMPTY_PREVIEW_ROOT_CAUSE',
  generatedAt: new Date().toISOString(),
  fixtures: results,
  pass: failed === 0,
};

fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
console.log(failed ? '\nFAIL cv-empty-preview-root-cause' : '\nPASS cv-empty-preview-root-cause');
process.exit(failed ? 1 : 0);
