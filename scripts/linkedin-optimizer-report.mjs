#!/usr/bin/env node
/**
 * Generate LINKEDIN_OPTIMIZER_REPORT.md
 */
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  LINKEDIN_OPTIMIZER,
  buildLinkedInOptimization,
  formatLinkedInOptimizationText,
} from '../src/core/export/linkedin-optimizer.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const gate = spawnSync('node', ['src/tests/qa-linkedin-optimizer.mjs'], { cwd: root, encoding: 'utf8' });
const gateOk = gate.status === 0;

const yoaz = buildLinkedInOptimization({
  identity: {
    name: 'Yohann Azancot',
    title: 'Graphic Designer / Illustrator',
    email: 'yoaz@hotmail.fr',
    phone: '+33 6 49 43 48 39',
    linkedin: 'https://linkedin.com/in/yoaz',
    location: 'Paris',
  },
  summary:
    'Illustrator and graphic designer with 10+ years creating brand identities, packaging, and editorial work.',
  experiences: [
    {
      role: 'Freelance Illustrator / Graphic Designer',
      company: 'Independent / Freelance',
      dates: '2011–2022',
      bullets: ['Posters, packaging, and logos for international brands'],
    },
    { role: 'Designer', company: 'McCann G. Agency', dates: '2011–2014', bullets: ['Campaign visuals'] },
  ],
  education: ['Créapole — Visual Communication — 2008–2011', 'LISAA — Web & Motion Design — 2011–2012'],
  skills: ['Illustration', 'Graphic Design', 'Packaging', 'Logo Design', 'Visual Identity', 'Editorial Design'],
  tools: ['Adobe Illustrator', 'Photoshop', 'InDesign'],
  languages: ['French — native', 'English — fluent'],
  clients: ['Nike'],
  quality: {},
  metaSafe: {},
});

const thin = buildLinkedInOptimization({
  identity: { name: 'Alex Martin', title: 'Marketing Coordinator', email: 'alex@example.com' },
  summary: 'Marketing professional.',
  experiences: [{ role: 'Marketing Assistant', company: 'Agency', dates: '2019–2021', bullets: [] }],
  education: ['Bachelor Marketing — 2019'],
  skills: ['Social media'],
  tools: [],
  languages: [],
  quality: {},
  metaSafe: {},
});

const checks = {
  finalResumeDataOnly: yoaz?.source === 'finalResumeData',
  noFakeAi: !/lorem ipsum|as an ai|chatgpt/i.test(yoaz?.about || ''),
  headlineGenerated: !!yoaz?.headline,
  aboutGenerated: !!yoaz?.about,
  topSkillsGenerated: (yoaz?.topSkills || []).length >= 3,
  keywordsGenerated: (yoaz?.recruiterKeywords || []).length >= 3,
  strengthShown: Number.isFinite(yoaz?.strength?.score),
  missingKeywordsShown: Array.isArray(yoaz?.missingKeywords),
  suggestionsShown: (yoaz?.suggestions || []).length >= 1,
  thinLowerScore: (thin?.strength?.score || 0) < (yoaz?.strength?.score || 0),
};

const allPass = gateOk && Object.values(checks).every(Boolean);

const lines = [];
lines.push('# LinkedIn Optimizer Report');
lines.push('');
lines.push(`**Generated:** ${new Date().toISOString()}`);
lines.push(`**Engine:** \`${LINKEDIN_OPTIMIZER}\``);
lines.push(`**Gate:** ${gateOk ? 'PASS' : 'FAIL'}`);
lines.push(`**Verdict:** ${allPass ? 'PASS' : 'FAIL'}`);
lines.push('');
lines.push('## Scope');
lines.push('');
lines.push('- **Input:** `finalResumeData` only (locked UI profile)');
lines.push('- **Output:** Headline, About, top skills, recruiter keywords');
lines.push('- **Analysis:** Current strength, missing keywords, optimization suggestions');
lines.push('- **No AI:** deterministic composition from CV fields');
lines.push('');
lines.push('## Acceptance');
lines.push('');
lines.push('| Check | Result |');
lines.push('|-------|--------|');
for (const [k, v] of Object.entries(checks)) {
  lines.push(`| ${k} | ${v ? 'PASS' : 'FAIL'} |`);
}
lines.push('');
lines.push('## Sample — Yoaz (real CV)');
lines.push('');
lines.push(`**Strength:** ${yoaz.strength.score}/100 (${yoaz.strength.band})`);
lines.push('');
lines.push('### Headline');
lines.push('');
lines.push(yoaz.headline);
lines.push('');
lines.push('### About (excerpt)');
lines.push('');
lines.push(`${yoaz.about.slice(0, 320)}${yoaz.about.length > 320 ? '…' : ''}`);
lines.push('');
lines.push('### Top skills');
lines.push('');
for (const s of yoaz.topSkills) lines.push(`- ${s}`);
lines.push('');
lines.push('### Recruiter keywords');
lines.push('');
lines.push(yoaz.recruiterKeywords.join(', '));
lines.push('');
lines.push('### Missing keywords');
lines.push('');
if (yoaz.missingKeywords.length) {
  for (const k of yoaz.missingKeywords) lines.push(`- ${k}`);
} else {
  lines.push('- (none)');
}
lines.push('');
lines.push('### Suggestions');
lines.push('');
for (const s of yoaz.suggestions.slice(0, 5)) lines.push(`- ${s.text}`);
lines.push('');
lines.push('## Thin profile contrast');
lines.push('');
lines.push(`- **Strength:** ${thin.strength.score}/100 (${thin.strength.band})`);
lines.push(`- **Missing keywords:** ${thin.missingKeywords.length}`);
lines.push(`- **Suggestions:** ${thin.suggestions.length}`);
lines.push('');
lines.push('## Files');
lines.push('');
lines.push('- `src/core/export/linkedin-optimizer.js` — `buildLinkedInOptimization()`');
lines.push('- `src/tests/qa-linkedin-optimizer.mjs` — gate');
lines.push('');
lines.push('## Commands');
lines.push('');
lines.push('```bash');
lines.push('npm run qa:linkedin-optimizer');
lines.push('npm run linkedin-optimizer-report');
lines.push('```');
lines.push('');
lines.push('<details><summary>Formatted export sample</summary>');
lines.push('');
lines.push('```');
lines.push(formatLinkedInOptimizationText(yoaz));
lines.push('```');
lines.push('');
lines.push('</details>');

writeFileSync(join(root, 'LINKEDIN_OPTIMIZER_REPORT.md'), `${lines.join('\n')}\n`);
console.log(`Wrote LINKEDIN_OPTIMIZER_REPORT.md (${allPass ? 'PASS' : 'FAIL'})`);
process.exit(allPass ? 0 : 1);
