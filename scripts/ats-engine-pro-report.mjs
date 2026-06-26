#!/usr/bin/env node
/**
 * Generate ATS_ENGINE_PRO.md
 */
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  ATS_ENGINE_PRO,
  ATS_PRO_DIMENSIONS,
  ATS_PLATFORM_BENCHMARKS,
  analyzeAtsPro,
} from '../src/core/validation/ats-engine-pro.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const gate = spawnSync('node', ['src/tests/qa-ats-engine-pro.mjs'], { cwd: root, encoding: 'utf8' });
const gateOk = gate.status === 0;

const fixtures = {
  strong: {
    name: 'Yohann Azancot',
    title: 'Graphic Designer / Illustrator',
    email: 'yoaz@hotmail.fr',
    phone: '+33 6 49 43 48 39',
    linkedin: 'https://linkedin.com/in/yoaz',
    location: 'Paris',
    summary:
      'Illustrator and graphic designer with 10+ years creating brand identities, packaging, and editorial work.',
    experience: [
      'Freelance Illustrator — Independent — 2011–2022: Designed packaging for international brands',
      'Designer — McCann Agency — 2011–2014: Led campaign visuals',
    ],
    education: ['Créapole — Visual Communication — 2008–2011'],
    skills: ['Illustration', 'Graphic Design', 'Packaging', 'Logo Design', 'Visual Identity'],
    tools: ['Adobe Illustrator', 'Photoshop', 'InDesign'],
    languages: ['French — native', 'English — fluent'],
  },
  average: {
    name: 'Alex Martin',
    title: 'Marketing Coordinator',
    email: 'alex@example.com',
    location: 'Lyon',
    summary: 'Marketing professional with campaign and social experience.',
    experience: ['Marketing Assistant — Local Agency — 2019–2021'],
    education: ['Bachelor Marketing — 2019'],
    skills: ['Social media', 'Email marketing', 'Copywriting'],
    tools: ['Canva'],
    languages: [],
  },
  weak: {
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

const jobDescription =
  'Senior graphic designer with Adobe Illustrator, branding, packaging, and visual identity experience.';

const rows = Object.entries(fixtures).map(([tier, cv]) => {
  const result = analyzeAtsPro(cv, tier === 'strong' ? { jobDescription } : {});
  return { tier, result };
});

const lines = [];
lines.push('# ATS Engine Pro');
lines.push('');
lines.push(`**Generated:** ${new Date().toISOString().slice(0, 10)}`);
lines.push(`**Engine:** \`${ATS_ENGINE_PRO}\``);
lines.push(`**QA gate:** ${gateOk ? 'PASS' : 'FAIL'}`);
lines.push('');
lines.push('## Mission');
lines.push('');
lines.push('Real ATS compatibility checker analyzing keywords, format, sections, readability, contact, experience structure, and skills relevance — benchmarked against Greenhouse, Lever, Workday, and SmartRecruiters.');
lines.push('');
lines.push('## Analysis dimensions');
lines.push('');
lines.push('| Dimension | Weight | Checks |');
lines.push('|-----------|--------|--------|');
for (const d of Object.values(ATS_PRO_DIMENSIONS)) {
  lines.push(`| ${d.label} | ${d.weight}% | Role-specific scoring |`);
}
lines.push('');
lines.push('## Outputs');
lines.push('');
lines.push('| Output | Field |');
lines.push('|--------|-------|');
lines.push('| ATS score | `score` / `atsScore` (0–100) |');
lines.push('| ATS risks | `risks[]` — level, label, dimension |');
lines.push('| ATS recommendations | `recommendations[]` — priority, action |');
lines.push('| ATS confidence | `confidence.score` + tier |');
lines.push('| Platform benchmarks | `benchmarks[]` — per-vendor score |');
lines.push('');
lines.push('## Platform benchmarks');
lines.push('');
for (const p of Object.values(ATS_PLATFORM_BENCHMARKS)) {
  const w = Object.entries(p.weights)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k, v]) => `${k} ${v}%`)
    .join(', ');
  lines.push(`### ${p.label}`);
  lines.push('');
  lines.push(`- **Focus:** ${p.notes}`);
  lines.push(`- **Top weights:** ${w}`);
  lines.push('');
}
lines.push('## Fixture scores');
lines.push('');
lines.push('| Tier | ATS score | Confidence | Risks | Recommendations |');
lines.push('|------|-----------|------------|-------|-----------------|');
for (const { tier, result } of rows) {
  lines.push(
    `| ${tier} | ${result.score} | ${result.confidence?.score ?? '—'} | ${result.risks?.length ?? 0} | ${result.recommendations?.length ?? 0} |`
  );
}
lines.push('');
lines.push('### Strong CV — dimension breakdown');
lines.push('');
const strong = rows.find((r) => r.tier === 'strong')?.result;
if (strong) {
  lines.push('| Dimension | Score |');
  lines.push('|-----------|-------|');
  for (const d of strong.dimensions) {
    lines.push(`| ${d.label} | ${d.pct}% |`);
  }
  lines.push('');
  lines.push('**Platform scores**');
  lines.push('');
  lines.push('| Platform | Score | Tier |');
  lines.push('|----------|-------|------|');
  for (const b of strong.benchmarks) {
    lines.push(`| ${b.label} | ${b.score} | ${b.tier} |`);
  }
}
lines.push('');
lines.push('### Sample risks (weak CV)');
lines.push('');
const weak = rows.find((r) => r.tier === 'weak')?.result;
if (weak?.risks?.length) {
  for (const r of weak.risks.slice(0, 5)) {
    lines.push(`- **${r.level}** — ${r.label}`);
  }
}
lines.push('');
lines.push('### Sample recommendations (weak CV)');
lines.push('');
if (weak?.recommendations?.length) {
  for (const r of weak.recommendations.slice(0, 4)) {
    lines.push(`- [${r.priority}] ${r.action}`);
  }
}
lines.push('');
lines.push('## Integration');
lines.push('');
lines.push('| Path | Role |');
lines.push('|------|------|');
lines.push('| `src/core/validation/ats-engine-pro.js` | Core engine |');
lines.push('| `src/core/validation/ats-analyzer.js` | Pipeline wrapper (`pro` field) |');
lines.push('| `src/core/validation/recruiter-command-center.js` | RCC audit `atsCompatibility` + `atsPro` |');
lines.push('| `src/ui/studio/recruiter-command-center.js` | UI: score, risks, benchmarks |');
lines.push('| `index.html` | Passes `jobDescInput` for keyword matching |');
lines.push('');
lines.push('## Commands');
lines.push('');
lines.push('```bash');
lines.push('npm run qa:ats-engine-pro');
lines.push('npm run ats-engine-pro-report');
lines.push('```');

writeFileSync(join(root, 'ATS_ENGINE_PRO.md'), `${lines.join('\n')}\n`);
console.log('Wrote ATS_ENGINE_PRO.md');
process.exit(gateOk ? 0 : 1);
