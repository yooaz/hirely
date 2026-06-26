#!/usr/bin/env node
/**
 * Recruiter Command Center QA
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runHirelyImportFromText } from '../core/pipeline/hirely-import.js';
import { computeProductScore } from '../core/validation/product-score.js';
import { buildRecruiterCommandCenterAudit, RECRUITER_COMMAND_CENTER_V2 } from '../core/validation/recruiter-command-center.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');

const FIXTURES = ['developer-cv', 'marketing-cv', 'consultant-cv', 'creative-cv'];

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else {
    console.log('OK', msg);
  }
}

async function evaluate(id) {
  const raw = fs.readFileSync(path.join(ROOT, 'tests/fixtures', id, 'fixture.txt'), 'utf8');
  const imp = await runHirelyImportFromText(raw, { source: id, extractionMethod: 'paste' });
  const cvData = imp.cvData || imp.resumeData;
  const score = computeProductScore(cvData, {
    finalResumeData: imp.finalResumeData || imp.resumeData,
    resumeData: imp.resumeData,
  });
  const audit = buildRecruiterCommandCenterAudit({
    scoreReport: score,
    cvData,
    finalResumeData: imp.finalResumeData || imp.resumeData,
    resumeData: imp.resumeData,
  });
  return { id, audit, score };
}

async function main() {
  ok(RECRUITER_COMMAND_CENTER_V2 === 'RECRUITER_COMMAND_CENTER_V2', 'engine id');
  const index = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  ok(index.includes('recruiterCommandCenter'), 'HTML host');
  ok(index.includes('recruiter-command-center.css'), 'CSS linked');
  ok(index.includes('recruiter-command-center.js'), 'JS loaded');
  ok(index.includes('renderRecruiterCommandCenter'), 'render hook');

  for (const id of FIXTURES) {
    const { audit } = await evaluate(id);
    ok(audit.ready, `${id} audit ready`);
    ok(audit.executiveSummary?.headline, `${id} executive summary`);
    ok(Array.isArray(audit.strengths), `${id} strengths`);
    ok(Array.isArray(audit.weaknesses), `${id} weaknesses`);
    ok(audit.atsCompatibility?.score >= 0, `${id} ATS section`);
    ok(audit.atsPro?.ready, `${id} ATS Engine Pro`);
    ok(audit.atsPro?.benchmarks?.length === 4, `${id} platform benchmarks`);
    ok(audit.keywordCoverage?.pct >= 0, `${id} keyword coverage`);
    ok(audit.marketPositioning?.headline, `${id} market positioning`);
    ok(audit.salaryEstimation?.label, `${id} salary estimation`);
    ok(audit.recruiterConfidence?.score >= 0, `${id} recruiter confidence`);
  }

  if (failed) {
    process.exitCode = 1;
    console.error(`\n${failed} recruiter command center check(s) failed`);
  } else {
    console.log('\nAll recruiter command center checks passed');
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
