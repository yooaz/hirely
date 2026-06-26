#!/usr/bin/env node
/**
 * HIRELY H5 — Recruiter Score V2 report.
 * Output: SCORING_V2_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  SCORE_V2_CATEGORIES,
  RECRUITER_SCORE_V2,
  computeRecruiterScoreV2,
} from '../src/core/validation/recruiter-score-v2.js';
import { computeProductScore } from '../src/core/validation/product-score.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'SCORING_V2_REPORT.md');

const SAMPLES = {
  strong: {
    name: 'Yohann Azancot',
    title: 'Graphic Designer & Illustrator',
    email: 'yoaz@hotmail.fr',
    phone: '+33 6 49 43 48 39',
    linkedin: 'https://linkedin.com/in/yoaz',
    location: 'Paris, France',
    portfolio: 'https://yoaz.studio',
    summary: 'Creative professional specializing in illustration and brand design.',
    experience: [
      'Freelance Illustrator — Independent · 2011–2022: Posters, packaging, logos.',
      'Designer — McCann G. Agency · 2011–2014: Campaign creative for global brands.',
    ],
    education: ['Créapole — Visual Communication · 2007–2009'],
    skills: ['Illustration', 'Graphic Design', 'Brand Identity', 'Art Direction', 'Packaging', 'Print'],
    tools: ['Photoshop', 'Illustrator', 'InDesign', 'Figma'],
    languages: ['French — native', 'English — fluent'],
  },
  partial: {
    name: 'Jean Test',
    title: 'Designer',
    email: 'jean@test.com',
    experience: ['Designer at Studio'],
    skills: ['Design'],
    tools: [],
    languages: [],
    education: [],
  },
  empty: {
    name: '',
    email: '',
    experience: [],
    education: [],
    skills: [],
    tools: [],
    languages: [],
  },
};

function mdTable(headers, rows) {
  const sep = headers.map(() => '---');
  const body = rows.map((r) => headers.map((h) => String(r[h] ?? '').replace(/\|/g, '\\|')).join(' | '));
  return [`| ${headers.join(' | ')} |`, `| ${sep.join(' | ')} |`, ...body.map((r) => `| ${r} |`)].join('\n');
}

function sampleRow(label, cv) {
  const r = computeRecruiterScoreV2(cv);
  if (!r) return { label, score: 0, band: '—', strengths: 0, weaknesses: 0, recs: 0 };
  return {
    label,
    score: r.score,
    band: r.band?.label,
    strengths: r.strengths?.length ?? 0,
    weaknesses: r.weaknesses?.length ?? 0,
    recs: r.recommendations?.length ?? 0,
    result: r,
  };
}

async function main() {
  const rows = Object.entries(SAMPLES).map(([key, cv]) => sampleRow(key, cv));
  const strong = rows.find((r) => r.label === 'strong')?.result;

  const lines = [];
  lines.push('# SCORING V2 REPORT');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Engine: \`${RECRUITER_SCORE_V2}\``);
  lines.push('');
  lines.push('## Overview');
  lines.push('');
  lines.push(
    'Recruiter Score V2 replaces the legacy checklist model with **seven weighted sections** (total 100). Each run returns **score**, **strengths**, **weaknesses**, and **recommendations** — all deterministic from `cvData` signals.'
  );
  lines.push('');
  lines.push('## Category weights');
  lines.push('');
  lines.push(mdTable(
    ['Category', 'Max points', 'ID'],
    Object.values(SCORE_V2_CATEGORIES).map((c) => ({
      Category: c.label,
      'Max points': c.max,
      ID: `\`${c.id}\``,
    }))
  ));
  lines.push('');
  lines.push('## Return shape');
  lines.push('');
  lines.push('```json');
  lines.push(JSON.stringify(
    {
      score: 82,
      total: 82,
      band: { label: 'Excellent' },
      breakdown: [{ id: 'identity', points: 15, max: 15 }],
      strengths: ['Identity : 15/15 — solide pour un recruteur.'],
      weaknesses: ['Languages : 0/10 — section à renforcer.'],
      recommendations: [{ id: 'languages', issue: 'Langues absentes', fix: '...', priority: 'high' }],
    },
    null,
    2
  ));
  lines.push('```');
  lines.push('');
  lines.push('## Sample scores');
  lines.push('');
  lines.push(mdTable(
    ['Profile', 'Score', 'Band', 'Strengths', 'Weaknesses', 'Recommendations'],
    rows.map((r) => ({
      Profile: r.label,
      Score: r.score,
      Band: r.band,
      Strengths: r.strengths,
      Weaknesses: r.weaknesses,
      Recommendations: r.recs,
    }))
  ));
  lines.push('');

  if (strong) {
    lines.push('## Strong profile breakdown');
    lines.push('');
    lines.push(mdTable(
      ['Category', 'Points', 'Max', '%'],
      strong.breakdown.map((c) => ({
        Category: c.label,
        Points: c.points,
        Max: c.max,
        '%': c.max ? Math.round((c.points / c.max) * 100) : 0,
      }))
    ));
    lines.push('');
    lines.push('### Strengths');
    lines.push('');
    for (const s of strong.strengths || []) lines.push(`- ${s}`);
    lines.push('');
    lines.push('### Weaknesses');
    lines.push('');
    for (const w of strong.weaknesses || []) lines.push(`- ${w}`);
    lines.push('');
    lines.push('### Recommendations');
    lines.push('');
    for (const rec of strong.recommendations || []) {
      lines.push(`- **${rec.category}** (${rec.priority}): ${rec.issue} → ${rec.fix}`);
    }
    lines.push('');
  }

  lines.push('## Integration');
  lines.push('');
  lines.push('| Consumer | Entry point |');
  lines.push('|----------|-------------|');
  lines.push('| Product UI | `computeProductScore(cvData)` |');
  lines.push('| ATS analyzer | `computeAtsScore(cvData)` → V2 |');
  lines.push('| Recruiter audit | `runRecruiterAudit()` exposes strengths/weaknesses/recommendations |');
  lines.push('');
  lines.push('## Module map');
  lines.push('');
  lines.push('| File | Role |');
  lines.push('|------|------|');
  lines.push('| `src/core/validation/recruiter-score-v2.js` | V2 scoring engine |');
  lines.push('| `src/core/validation/ats-engine.js` | Facade / panel helpers |');
  lines.push('| `src/core/validation/product-score.js` | Product entry + profile resolution |');
  lines.push('| `src/core/validation/recruiter-checklist-source.js` | `resumeData` → checklist profile |');
  lines.push('| `src/tests/qa-recruiter-score-v2.mjs` | Acceptance QA |');
  lines.push('');
  lines.push('## Verification');
  lines.push('');
  lines.push('```bash');
  lines.push('npm run qa:recruiter-score-v2');
  lines.push('npm run scoring:v2-report');
  lines.push('npm run qa:ats-pipeline');
  lines.push('```');
  lines.push('');

  // Sanity: product-score path
  const viaProduct = computeProductScore(SAMPLES.strong);
  lines.push(`Product-score path (strong): **${viaProduct?.score ?? 0}**/100`);
  lines.push('');

  fs.writeFileSync(OUT, lines.join('\n'));
  console.log(`Wrote ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
