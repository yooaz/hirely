#!/usr/bin/env node
/**
 * CV rewrite quality report — recruiter-grade experience descriptions.
 * Output: CV_REWRITE_QUALITY_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runHirelyImportFromText } from '../src/core/pipeline/hirely-import.js';
import {
  CV_EXPERIENCE_REWRITE,
  rewriteExperienceDescription,
  experienceRewriteQuality,
} from '../src/core/parsing/cv-experience-rewrite.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'CV_REWRITE_QUALITY_REPORT.md');

const ACCEPTANCE_FIXTURES = [
  { id: 'developer-cv', label: 'Developer CV' },
  { id: 'creative-cv', label: 'Creative CV' },
  { id: 'marketing-cv', label: 'Marketing CV' },
  { id: 'consultant-cv', label: 'Consultant CV' },
];

const FRAGMENT_EXAMPLE = {
  bad: 'Graphic designer. Posters. Packaging.',
  role: 'Freelance Graphic Designer & Illustrator',
  company: 'Independent / Freelance',
};

async function evaluateFixture(entry) {
  const raw = fs.readFileSync(path.join(ROOT, 'tests/fixtures', entry.id, 'fixture.txt'), 'utf8');
  const imp = await runHirelyImportFromText(raw, {
    source: entry.id,
    extractionMethod: 'paste',
  });
  const experiences = imp.resumeData?.experiences || [];
  const checks = experiences.map((exp) => experienceRewriteQuality(exp));
  const passCount = checks.filter((c) => c.pass).length;
  return {
    ...entry,
    experiences,
    checks,
    passCount,
    total: experiences.length,
    goalMet: experiences.length > 0 && passCount === experiences.length,
  };
}

async function main() {
  const rows = [];
  let totalExp = 0;
  let totalPass = 0;

  for (const entry of ACCEPTANCE_FIXTURES) {
    const row = await evaluateFixture(entry);
    rows.push(row);
    totalExp += row.total;
    totalPass += row.passCount;
    process.stderr.write(`[cv-rewrite] ${entry.id} ${row.passCount}/${row.total}…\n`);
  }

  const fragment = rewriteExperienceDescription(FRAGMENT_EXAMPLE.bad, {
    role: FRAGMENT_EXAMPLE.role,
    company: FRAGMENT_EXAMPLE.company,
  });

  const allGoalsMet = rows.every((r) => r.goalMet);
  const lines = [];

  lines.push('# CV REWRITE QUALITY REPORT');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Engine: \`${CV_EXPERIENCE_REWRITE}\``);
  lines.push('Pipeline: import → polish → experience rewrite → display sanitize');
  lines.push('');
  lines.push('## Goal');
  lines.push('');
  lines.push('Every experience must include **title**, **company**, **date**, and a **professional description**.');
  lines.push('Rewrite improves wording only — no invented roles, companies, dates, or deliverables.');
  lines.push('');
  lines.push(
    allGoalsMet
      ? '### Goal status: **MET** (all acceptance experiences fully rewritten)'
      : '### Goal status: **NOT MET**'
  );
  lines.push('');
  lines.push('## Rules');
  lines.push('');
  lines.push('- Preserve extracted facts in `originalDescription`');
  lines.push('- Emit recruiter-grade `rewrittenDescription`');
  lines.push('- Do not invent experience, companies, or dates');
  lines.push('- Improve consistency, readability, and action-oriented phrasing');
  lines.push('');
  lines.push('## Fragment rewrite example');
  lines.push('');
  lines.push('| | Text |');
  lines.push('|---|---|');
  lines.push(`| Bad | ${FRAGMENT_EXAMPLE.bad} |`);
  lines.push(`| originalDescription | ${fragment.originalDescription} |`);
  lines.push(`| rewrittenDescription | ${fragment.rewrittenDescription} |`);
  lines.push('');
  lines.push('## Acceptance fixtures');
  lines.push('');
  lines.push('| Fixture | Experiences | Pass | Goal |');
  lines.push('|---------|------------:|-----:|:----:|');

  for (const row of rows) {
    lines.push(
      `| ${row.label} | ${row.total} | ${row.passCount}/${row.total} | ${row.goalMet ? '✓' : '✗'} |`
    );
  }

  lines.push('');
  lines.push(`**Aggregate:** ${totalPass}/${totalExp} experiences pass rewrite quality checks`);
  lines.push('');
  lines.push('## Per-experience detail');
  lines.push('');

  for (const row of rows) {
    lines.push(`### ${row.label} (\`${row.id}\`)`);
    lines.push('');
    for (let i = 0; i < row.experiences.length; i++) {
      const exp = row.experiences[i];
      const check = row.checks[i];
      lines.push(`#### ${exp.role || '—'} @ ${exp.company || '—'} (${exp.dates || '—'})`);
      lines.push('');
      lines.push(`- Quality: ${check.pass ? '**PASS**' : 'FAIL'}`);
      lines.push(`- originalDescription: ${exp.originalDescription || '—'}`);
      lines.push(`- rewrittenDescription: ${exp.rewrittenDescription || '—'}`);
      lines.push('');
    }
  }

  lines.push('## Run');
  lines.push('');
  lines.push('```bash');
  lines.push('npm run qa:cv-rewrite');
  lines.push('npm run cv:rewrite-report');
  lines.push('```');
  lines.push('');

  fs.writeFileSync(OUT, lines.join('\n'));
  console.log(`Wrote ${OUT}`);
  console.log(`Aggregate: ${totalPass}/${totalExp} — goal ${allGoalsMet ? 'MET' : 'NOT MET'}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
