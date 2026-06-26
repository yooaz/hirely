#!/usr/bin/env node
/**
 * Generate FINAL_CV_READABILITY_REPORT.md
 */
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { buildFinalResumeData } from '../src/core/validation/final-resume-contract.js';
import { normalizeResumeData } from '../src/core/resume-data.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const gate = spawnSync('node', ['src/tests/qa-final-cv-readability.mjs'], {
  cwd: root,
  encoding: 'utf8',
});
const gateOk = gate.status === 0;

const built = buildFinalResumeData(
  normalizeResumeData({
    identity: {
      name: 'Yohann Zancot',
      title: 'Graphic Designer / Illustrator',
      email: 'y@test.com',
      phone: '+33 6 12 34 56 78',
      location: 'Paris',
    },
    summary: 'Illustrator and graphic designer.',
    experiences: [
      {
        role: 'Freelance Illustrator and Graphic',
        company: 'Independent',
        dates: '2011–2022',
        bullets: ['Posters, packaging, logos, editorial illustration'],
      },
      { role: 'Designer', company: 'McCann G. Agency', dates: '2011–2014', bullets: ['Campaigns'] },
    ],
    education: [
      'Creative School Management',
      'LISAA — Web & Motion Design — 2011–2012',
      'Créapole — Visual Communication — 2008–2011',
    ],
    skills: ['Illustration', 'Graphic Design', 'Packaging', 'Logo Design', 'Visual Identity', 'Editorial Design'],
    tools: ['Adobe Illustrator', 'Photoshop', 'InDesign'],
    languages: ['French — native', 'English — fluent'],
    clients: ['Nike'],
    projects: [],
    unsorted: [],
    meta: {},
  })
);

const fr = built.finalResumeData || {};
const expText = (fr.experiences || [])
  .map((e) =>
    [e.role, e.company, e.dates, ...(e.bullets || [])].filter(Boolean).join('\n')
  )
  .join('\n\n');

const lines = [];
lines.push('# Final CV Human Readability Report');
lines.push('');
lines.push(`**Generated:** ${new Date().toISOString()}`);
lines.push(`**Engine:** FINAL_CV_READABILITY_V1`);
lines.push(`**Result:** ${gateOk ? 'PASS' : 'FAIL'}`);
lines.push('');
lines.push('## Scope');
lines.push('');
lines.push('Last-pass human readability polish on **finalResumeData** only.');
lines.push('Does **not** touch OCR or parser modules.');
lines.push('');
lines.push('## Rules enforced');
lines.push('');
lines.push('- No raw OCR fragments');
lines.push('- No “Creative School Management” unless explicit degree marker');
lines.push('- No duplicate date ranges');
lines.push('- No section labels in header');
lines.push('- No hallucinated clients');
lines.push('');
lines.push('## Target visible output');
lines.push('');
lines.push('### Experience');
lines.push('');
lines.push('```');
lines.push('Freelance Illustrator / Graphic Designer');
lines.push('Independent / Freelance');
lines.push('2011–2022');
lines.push('Posters, packaging, logos, editorial illustration.');
lines.push('');
lines.push('Designer');
lines.push('McCann G. Agency');
lines.push('2011–2014');
lines.push('Creative work for campaigns and brand assets.');
lines.push('```');
lines.push('');
lines.push('### Education');
lines.push('');
lines.push('```');
lines.push('LISAA — Web & Motion Design — 2011–2012');
lines.push('Créapole — Visual Communication — 2008–2011');
lines.push('```');
lines.push('');
lines.push('### Skills / Tools / Languages');
lines.push('');
lines.push('```');
lines.push('Illustration | Graphic Design | Packaging | Logo Design | Visual Identity | Editorial Design');
lines.push('Adobe Illustrator | Photoshop | InDesign');
lines.push('French — native | English — fluent');
lines.push('```');
lines.push('');
lines.push('## Actual finalResumeData snapshot');
lines.push('');
lines.push('### Experience');
lines.push('');
lines.push('```');
lines.push(expText || '(empty)');
lines.push('```');
lines.push('');
lines.push('### Education');
lines.push('');
lines.push('```');
lines.push((fr.education || []).join('\n') || '(empty)');
lines.push('```');
lines.push('');
lines.push('### Skills');
lines.push('');
lines.push((fr.skills || []).join(' · ') || '(empty)');
lines.push('');
lines.push('### Tools');
lines.push('');
lines.push((fr.tools || []).join(' · ') || '(empty)');
lines.push('');
lines.push('### Languages');
lines.push('');
lines.push((fr.languages || []).join(' · ') || '(empty)');
lines.push('');
lines.push('### Clients');
lines.push('');
lines.push((fr.clients || []).join(' · ') || '(none)');
lines.push('');
lines.push('## Acceptance');
lines.push('');
lines.push('| Check | Result |');
lines.push('|-------|--------|');
lines.push(
  `| Creative School Management absent | ${(fr.education || []).some((l) => /creative school management/i.test(l)) ? 'FAIL' : 'PASS'} |`
);
lines.push(
  `| Freelance hero readable | ${(fr.experiences || []).some((e) => e.role === 'Freelance Illustrator / Graphic Designer') ? 'PASS' : 'FAIL'} |`
);
lines.push(
  `| McCann hero readable | ${(fr.experiences || []).some((e) => e.company === 'McCann G. Agency') ? 'PASS' : 'FAIL'} |`
);
lines.push(`| CV renders | ${built.contract?.renderable ? 'yes' : 'no'} |`);
lines.push('');
lines.push('## Pipeline hook');
lines.push('');
lines.push('- `src/core/validation/final-cv-readability.js` — `applyFinalCvReadabilityPass()`');
lines.push('- `src/core/validation/final-resume-contract.js` — after `dedupeFinalResumeData()`');
lines.push('');
lines.push('## QA');
lines.push('');
lines.push('```bash');
lines.push('npm run qa:final-cv-readability');
lines.push('npm run final-cv-readability-report');
lines.push('```');
lines.push('');
if (!gateOk) {
  lines.push('## Gate output');
  lines.push('');
  lines.push('```');
  lines.push((gate.stdout || gate.stderr || '').trim());
  lines.push('```');
}

writeFileSync(join(root, 'FINAL_CV_READABILITY_REPORT.md'), `${lines.join('\n')}\n`);
console.log(`Wrote ${join(root, 'FINAL_CV_READABILITY_REPORT.md')}`);
process.exit(gateOk ? 0 : 1);
