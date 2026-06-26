#!/usr/bin/env node
/**
 * CV rewrite quality — every experience has title, company, date, professional description.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runHirelyImportFromText } from '../core/pipeline/hirely-import.js';
import {
  rewriteExperienceDescription,
  experienceRewriteQuality,
} from '../core/parsing/cv-experience-rewrite.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');

const ACCEPTANCE_FIXTURES = [
  'developer-cv',
  'creative-cv',
  'marketing-cv',
  'consultant-cv',
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

function testFragmentRewrite() {
  const { originalDescription, rewrittenDescription } = rewriteExperienceDescription(
    'Graphic designer. Posters. Packaging.',
    { role: 'Freelance Graphic Designer & Illustrator', company: 'Independent / Freelance' }
  );
  ok(originalDescription.toLowerCase().includes('posters'), 'fragment example preserves original facts');
  ok(rewrittenDescription.toLowerCase().includes('posters'), 'fragment rewrite keeps posters');
  ok(rewrittenDescription.toLowerCase().includes('packaging'), 'fragment rewrite keeps packaging');
  ok(/\bcreated\b/i.test(rewrittenDescription), 'fragment rewrite uses professional verb');
  ok(!/invented|international brands/i.test(rewrittenDescription), 'fragment rewrite does not invent brands');
}

async function evaluateFixture(id) {
  const raw = fs.readFileSync(path.join(ROOT, 'tests/fixtures', id, 'fixture.txt'), 'utf8');
  const imp = await runHirelyImportFromText(raw, { source: id, extractionMethod: 'paste' });
  const experiences = imp.resumeData?.experiences || [];
  const checks = experiences.map((exp) => experienceRewriteQuality(exp));
  return { id, experiences, checks };
}

async function main() {
  testFragmentRewrite();

  for (const id of ACCEPTANCE_FIXTURES) {
    const { experiences, checks } = await evaluateFixture(id);
    ok(experiences.length > 0, `${id} has experiences to rewrite`);
    const passCount = checks.filter((c) => c.pass).length;
    ok(
      passCount === experiences.length,
      `${id} rewrite quality ${passCount}/${experiences.length} experiences complete`
    );
    for (const check of checks.filter((c) => !c.pass)) {
      console.error(
        `  missing:`,
        [
          !check.hasTitle && 'title',
          !check.hasCompany && 'company',
          !check.hasDate && 'date',
          !check.hasProfessionalDescription && 'professional description',
        ]
          .filter(Boolean)
          .join(', ')
      );
    }
  }

  if (failed) {
    process.exitCode = 1;
    console.error(`\n${failed} rewrite quality check(s) failed`);
  } else {
    console.log('\nAll CV rewrite quality checks passed');
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
