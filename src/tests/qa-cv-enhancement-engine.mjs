#!/usr/bin/env node
/**
 * CV Enhancement Engine QA — detects issues, produces before/after without invention.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runHirelyImportFromText } from '../core/pipeline/hirely-import.js';
import {
  CV_ENHANCEMENT_ENGINE,
  ISSUE_TYPES,
  detectCvEnhancementIssues,
  enhanceSummaryText,
  rewriteExperienceDescription,
  runCvEnhancementEngine,
} from '../core/parsing/cv-enhancement-engine.js';
import { detectRewriteViolations } from '../core/parsing/safe-rewrite-validation.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');

const FIXTURES = ['developer-cv', 'creative-cv', 'marketing-cv', 'consultant-cv'];

let failed = 0;

function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else {
    console.log('OK', msg);
  }
}

function testFragmentRewriteNoInvention() {
  const { originalDescription, rewrittenDescription } = rewriteExperienceDescription(
    'Graphic designer. Posters. Packaging.',
    { role: 'Freelance Graphic Designer & Illustrator', company: 'Independent / Freelance' }
  );
  ok(originalDescription.toLowerCase().includes('posters'), 'fragment preserves posters');
  ok(rewrittenDescription.toLowerCase().includes('packaging'), 'fragment keeps packaging');
  ok(/\b(created|designed|delivered)\b/i.test(rewrittenDescription), 'fragment adds action verb');
  const violations = detectRewriteViolations(originalDescription, rewrittenDescription, {});
  ok(violations.length === 0, 'fragment rewrite passes safe gate');
}

function testSummaryEnhancement() {
  const result = enhanceSummaryText('Graphic design. Illustration. Branding.');
  ok(result.before.includes('Graphic'), 'summary before captured');
  ok(result.after.length >= result.before.length, 'summary after not shorter');
  const violations = detectRewriteViolations(result.before, result.after, {});
  ok(violations.length === 0, 'summary enhancement passes safe gate');
}

function testIssueDetection() {
  const issues = detectCvEnhancementIssues({
    summary: 'Graphic design.  Posters.',
    skills: ['Photoshop', 'photoshop', 'Figma'],
    experiences: [
      {
        role: 'Designer',
        company: 'Studio',
        dates: '2020–2022',
        bullets: ['Created posters', 'Created posters'],
        description: 'Posters.',
      },
    ],
  });
  const types = new Set(issues.map((i) => i.type));
  ok(types.has(ISSUE_TYPES.REPETITION), 'detects skill/bullet repetition');
  ok(types.has(ISSUE_TYPES.WEAK_DESCRIPTION) || types.has(ISSUE_TYPES.MISSING_ACHIEVEMENT), 'detects weak experience');
}

async function evaluateFixture(id) {
  const raw = fs.readFileSync(path.join(ROOT, 'tests/fixtures', id, 'fixture.txt'), 'utf8');
  const imp = await runHirelyImportFromText(raw, { source: id, extractionMethod: 'paste' });
  const rd = imp.resumeData || {};
  const meta = rd.meta?.cvEnhancement;
  return { id, rd, meta };
}

async function main() {
  ok(CV_ENHANCEMENT_ENGINE === 'CV_ENHANCEMENT_ENGINE_V2', 'engine id set');
  testFragmentRewriteNoInvention();
  testSummaryEnhancement();
  testIssueDetection();

  for (const id of FIXTURES) {
    const { meta } = await evaluateFixture(id);
    ok(!!meta, `${id} has cvEnhancement meta`);
    ok(meta?.engine === CV_ENHANCEMENT_ENGINE, `${id} engine tag`);
    ok(meta?.before && meta?.after, `${id} before/after snapshots`);
    ok(Array.isArray(meta?.changes), `${id} changes array`);
    ok(typeof meta?.issuesDetected === 'number', `${id} issues detected count`);

    for (const change of meta?.changes || []) {
      const violations = detectRewriteViolations(change.before, change.after, {});
      ok(violations.length === 0, `${id} change safe: ${change.field?.slice(0, 40)}`);
    }
  }

  const standalone = {
    summary: 'Marketing manager. Campaigns.',
    skills: ['SEO', 'seo'],
    experiences: [
      {
        role: 'Marketing Manager',
        company: 'Acme',
        dates: '2019–2021',
        bullets: [],
        description: 'Campaigns. Social media.',
      },
    ],
  };
  const beforeIssues = detectCvEnhancementIssues(standalone).length;
  runCvEnhancementEngine(standalone);
  const afterMeta = standalone.meta?.cvEnhancement;
  ok(beforeIssues > 0, 'standalone has issues before');
  ok(afterMeta?.issuesRemaining < beforeIssues || afterMeta?.changes?.length > 0, 'standalone improves');
  ok(afterMeta?.before?.summary, 'standalone before snapshot');
  ok(afterMeta?.after?.experiences?.length === 1, 'standalone after snapshot');

  if (failed) {
    process.exitCode = 1;
    console.error(`\n${failed} CV enhancement check(s) failed`);
  } else {
    console.log('\nAll CV enhancement engine checks passed');
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
