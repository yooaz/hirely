#!/usr/bin/env node
/**
 * Generate ATS_V2_REPORT.md
 */
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  computeRecruiterScoreV2,
  SCORE_V2_CATEGORIES,
  RECRUITER_SCORE_V2,
} from '../src/core/validation/recruiter-score-v2.js';
import { buildRecruiterPanelMetrics } from '../src/core/validation/ats-engine.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const gate = spawnSync('node', ['src/tests/qa-ats-v2-realism.mjs'], { cwd: root, encoding: 'utf8' });
const gateOk = gate.status === 0;

const legacyGate = spawnSync('node', ['src/tests/qa-recruiter-score-v2.mjs'], {
  cwd: root,
  encoding: 'utf8',
});
const legacyOk = legacyGate.status === 0;

const fixtures = {
  real: {
    name: 'Yohann Azancot',
    title: 'Graphic Designer / Illustrator',
    email: 'yoaz@hotmail.fr',
    phone: '+33 6 49 43 48 39',
    linkedin: 'https://linkedin.com/in/yoaz',
    location: 'Paris',
    summary:
      'Illustrator and graphic designer with 10+ years creating brand identities, packaging, and editorial work.',
    experience: [
      'Freelance Illustrator / Graphic Designer — Independent / Freelance — 2011–2022',
      'Designer — McCann G. Agency — 2011–2014',
    ],
    education: ['Créapole — Visual Communication — 2008–2011', 'LISAA — Web & Motion Design — 2011–2012'],
    skills: ['Illustration', 'Graphic Design', 'Packaging', 'Logo Design', 'Visual Identity', 'Editorial Design'],
    tools: ['Adobe Illustrator', 'Photoshop', 'InDesign'],
    languages: ['French — native', 'English — fluent'],
  },
  average: {
    name: 'Alex Martin',
    title: 'Marketing Coordinator',
    email: 'alex@example.com',
    location: 'Lyon',
    summary: 'Marketing professional with campaign and social experience.',
    experience: ['Marketing Assistant — Local Agency — 2019–2021', 'Supported email campaigns'],
    education: ['Bachelor Marketing — 2019'],
    skills: ['Social media', 'Email marketing', 'Copywriting'],
    tools: ['Canva'],
    languages: [],
  },
  poor: {
    name: '',
    title: '',
    email: '',
    experience: [],
    education: [],
    skills: [],
    tools: [],
    languages: [],
  },
};

const rows = Object.entries(fixtures).map(([tier, cv]) => {
  const result = computeRecruiterScoreV2(cv);
  const panel = buildRecruiterPanelMetrics(result);
  return { tier, total: result.total, panel, penalties: result.penalties || [], band: result.band?.label };
});

const acceptance = {
  real: rows.find((r) => r.tier === 'real').total >= 80 && rows.find((r) => r.tier === 'real').total <= 95,
  average:
    rows.find((r) => r.tier === 'average').total >= 60 && rows.find((r) => r.tier === 'average').total <= 80,
  poor: rows.find((r) => r.tier === 'poor').total < 60,
};

const allPass = gateOk && legacyOk && Object.values(acceptance).every(Boolean);

const lines = [];
lines.push('# ATS Score V2 Report');
lines.push('');
lines.push(`**Generated:** ${new Date().toISOString()}`);
lines.push(`**Engine:** \`${RECRUITER_SCORE_V2}\``);
lines.push(`**Realism gate:** ${gateOk ? 'PASS' : 'FAIL'}`);
lines.push(`**Legacy V2 gate:** ${legacyOk ? 'PASS' : 'FAIL'}`);
lines.push(`**Verdict:** ${allPass ? 'PASS' : 'FAIL'}`);
lines.push('');
lines.push('## Model');
lines.push('');
lines.push('Rewards: email, phone, LinkedIn, experience, education, skills, tools, languages, summary.');
lines.push('Penalties: missing title, empty experience, missing dates, duplicate content, bad formatting.');
lines.push('');
lines.push('## Composite scores (0–100)');
lines.push('');
lines.push('| Tier | Overall | Content | Experience | Readability | ATS | Band |');
lines.push('|------|---------|---------|------------|-------------|-----|------|');
for (const r of rows) {
  lines.push(
    `| ${r.tier} | ${r.panel.overall} | ${r.panel.content} | ${r.panel.experience} | ${r.panel.readability} | ${r.panel.ats} | ${r.band} |`
  );
}
lines.push('');
lines.push('## Acceptance bands');
lines.push('');
lines.push('| Tier | Target | Result |');
lines.push('|------|--------|--------|');
lines.push(`| Real CV | 80–95 | ${acceptance.real ? 'PASS' : 'FAIL'} (${rows.find((r) => r.tier === 'real').total}) |`);
lines.push(
  `| Average CV | 60–80 | ${acceptance.average ? 'PASS' : 'FAIL'} (${rows.find((r) => r.tier === 'average').total}) |`
);
lines.push(`| Poor CV | <60 | ${acceptance.poor ? 'PASS' : 'FAIL'} (${rows.find((r) => r.tier === 'poor').total}) |`);
lines.push('');
lines.push('## Category weights');
lines.push('');
for (const cat of Object.values(SCORE_V2_CATEGORIES)) {
  lines.push(`- **${cat.label}** — max ${cat.max}`);
}
lines.push('');
lines.push('## Penalties (sample)');
lines.push('');
for (const r of rows) {
  if (!r.penalties.length) continue;
  lines.push(`**${r.tier}:** ${r.penalties.map((p) => `${p.label} (−${p.points})`).join(', ')}`);
}
lines.push('');
lines.push('## Files');
lines.push('');
lines.push('- `src/core/validation/recruiter-score-v2.js` — `computeRecruiterScoreV2()`');
lines.push('- `src/core/validation/ats-engine.js` — panel metrics facade');
lines.push('- `src/tests/qa-ats-v2-realism.mjs` — tier band gate');
lines.push('');
lines.push('## Commands');
lines.push('');
lines.push('```bash');
lines.push('npm run qa:ats-v2-realism');
lines.push('npm run ats-v2-report');
lines.push('```');

writeFileSync(join(root, 'ATS_V2_REPORT.md'), `${lines.join('\n')}\n`);
console.log(`Wrote ATS_V2_REPORT.md (${allPass ? 'PASS' : 'FAIL'})`);
process.exit(allPass ? 0 : 1);
