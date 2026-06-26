#!/usr/bin/env node
/**
 * PRODUCTION_AUDIT — coverage, experience, zero-loss, archived ratio gates.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runSectionEngineV2 } from '../core/parsing/section-engine-v2.js';
import {
  buildProductionAudit,
  evaluateProductionAuditPass,
  PRODUCTION_AUDIT_THRESHOLDS,
  formatProductionAuditDisplay,
} from '../core/validation/production-audit.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const ok = (cond, msg) => {
  if (!cond) throw new Error(msg);
  console.log('OK', msg);
};

const passFixture = join(root, 'tests/fixtures/text-pdf/fixture.txt');
const yoazFixture = join(root, 'tests/fixtures/yoaz-cv/fixture.txt');
const sample = existsSync(passFixture)
  ? readFileSync(passFixture, 'utf8')
  : `Jane Doe\nDesigner\nExperience\nLead Designer — Agency — 2018–2024\nEducation\nArt School\nSkills\nDesign, Illustration`;

const { structured } = runSectionEngineV2(sample, { rawText: sample });
const report = buildProductionAudit(sample, structured, { rawText: sample });

console.log('\nPRODUCTION_AUDIT');
console.table(formatProductionAuditDisplay(report));

ok(report.coveragePercent > PRODUCTION_AUDIT_THRESHOLDS.coverageMinPct, `coverage > 85% (${report.coveragePercent}%)`);
ok(report.experienceCount > 0, `experience > 0 (${report.experienceCount})`);
ok(
  report.structuredCharsPct > PRODUCTION_AUDIT_THRESHOLDS.structuredCharsMinPct,
  `structured chars > 85% (${report.structuredCharsPct}%)`
);
ok(report.pipelineLoss === 0, `pipeline loss = 0 (got ${report.pipelineLoss})`);
ok(
  report.archivedCharsPct < PRODUCTION_AUDIT_THRESHOLDS.archivedCharsMaxPct,
  `archived chars < 15% (${report.archivedCharsPct}%)`
);

const verdict = evaluateProductionAuditPass(report);
ok(verdict.pass, `audit PASS (failures: ${verdict.failures.join(', ') || 'none'})`);
ok(report.pass === true, 'report.pass is true');

const emptyExp = { ...structured, experiences: [] };
const failReport = buildProductionAudit(sample, emptyExp, { rawText: sample });
ok(!failReport.pass, 'fails when experience cleared');
ok(failReport.failures.includes('experience'), 'experience check fails');

if (existsSync(yoazFixture)) {
  const yoaz = readFileSync(yoazFixture, 'utf8');
  const yoazParsed = runSectionEngineV2(yoaz, { rawText: yoaz });
  const yoazReport = buildProductionAudit(yoaz, yoazParsed.structured, { rawText: yoaz });
  console.log('\nYoaz fixture audit (informational):', {
    pass: yoazReport.pass,
    coverage: yoazReport.coveragePercent,
    structured: yoazReport.structuredCharsPct,
    archived: yoazReport.archivedCharsPct,
    experience: yoazReport.experienceCount,
  });
}

console.log('\nPRODUCTION_AUDIT QA OK');
