#!/usr/bin/env node
/**
 * P0 — Full pipeline data-loss audit.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { auditPipelineDataLoss, PIPELINE_FIELDS, PIPELINE_STAGES } from '../core/audit/pipeline-data-loss.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT = path.join(ROOT, 'tests/output/pipeline-data-loss/report.json');

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
  const audit = await auditPipelineDataLoss(text, { templateId: 'portfolio-artist' });
  results[fx.id] = audit;

  console.log(`\n[${fx.id}] completeness=${audit.completenessPct}% losses=${audit.losses.length}`);
  for (const field of PIPELINE_FIELDS) {
    const row = audit.matrix[field];
    const hasData = PIPELINE_STAGES.some((s) => (row[s] || 0) > 0);
    if (!hasData) continue;
    console.log(
      `  ${field}: D=${row.DETECTED} N=${row.NORMALIZED} Rv=${row.REVIEWED} C=${row.COMMITTED} Rn=${row.RENDERED} X=${row.EXPORTED}`
    );
  }

  ok(audit.contractRenderable, `${fx.id} finalResumeData renderable`);
  ok(audit.htmlLength > 400, `${fx.id} template HTML (${audit.htmlLength})`);
  ok(audit.completenessPct >= 70, `${fx.id} rendered/detected >= 70% (${audit.completenessPct}%)`);

  const mvpEdu = fx.id === 'mvp-sample' ? audit.matrix.education?.COMMITTED : 1;
  if (fx.id === 'mvp-sample') ok(mvpEdu >= 1, 'mvp-sample education committed');
}

const report = {
  feature: 'PIPELINE_DATA_LOSS',
  generatedAt: new Date().toISOString(),
  fields: PIPELINE_FIELDS,
  stages: PIPELINE_STAGES,
  fixtures: results,
  pass: failed === 0,
};

fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
console.log(failed ? '\nFAIL pipeline-data-loss' : '\nPASS pipeline-data-loss');
process.exit(failed ? 1 : 0);
