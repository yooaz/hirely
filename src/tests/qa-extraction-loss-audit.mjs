#!/usr/bin/env node
/**
 * P0 — Extraction loss audit QA gate.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  auditExtractionLoss,
  summarizeExtractionLossAudits,
} from '../core/audit/extraction-loss-audit.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT = path.join(ROOT, 'tests/output/extraction-loss-audit/report.json');

const FIXTURES = [
  { id: 'creative-cv', file: 'tests/fixtures/creative-cv/fixture.txt' },
  { id: 'designer-cv-rich', file: 'tests/fixtures/designer-cv-rich.txt' },
  { id: 'projects-creative-rich', file: 'tests/fixtures/projects-creative-rich.txt' },
  { id: 'yoaz-cv', file: 'tests/fixtures/yoaz-cv/fixture.txt' },
  { id: 'mvp-sample', file: 'tests/fixtures/mvp-sample.txt' },
];

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else {
    console.log('OK', msg);
  }
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });

const audits = [];
for (const fx of FIXTURES) {
  const text = fs.readFileSync(path.join(ROOT, fx.file), 'utf8');
  const audit = await auditExtractionLoss(text, {
    label: fx.id,
    extractionMethod: 'paste',
    templateId: 'creative-portfolio',
  });
  audits.push(audit);

  console.log(`\n[${fx.id}] ${audit.verdict} resumeData→final ${audit.acceptance.finalVsUpstreamRetentionPct}%`);
  for (const link of audit.retentionChain) {
    if (link.retentionPct < 100) {
      console.log(`  ${link.label}: ${link.retentionPct}%`);
    }
  }

  ok(audit.acceptance.finalVsUpstreamRetentionPct >= 90, `${fx.id} finalResumeData retention >= 90%`);
  ok(audit.stages.find((s) => s.id === 'SECTION_PARSER')?.metrics.experienceCount >= 0, `${fx.id} parser stage ran`);
}

const summary = summarizeExtractionLossAudits(audits);
const report = {
  feature: 'EXTRACTION_LOSS_AUDIT',
  generatedAt: new Date().toISOString(),
  summary,
  fixtures: audits,
  pass: failed === 0 && summary.pass,
};

fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
console.log(failed || !summary.pass ? '\nFAIL extraction-loss-audit' : '\nPASS extraction-loss-audit');
process.exit(failed || !summary.pass ? 1 : 0);
