#!/usr/bin/env node
/**
 * Experience recall report — acceptance CVs + fragmented OCR sample.
 * Output: EXPERIENCE_RECALL_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runHirelyImportFromText } from '../src/core/pipeline/hirely-import.js';
import { sanitizeResumeForDisplay } from '../src/core/validation/sanitize-resume-display.js';
import {
  EXPERIENCE_RECONSTRUCTION,
  EXPERIENCE_RECONSTRUCTION_RECALL_GOAL,
  COMPANY_INFERENCE_CONFIDENCE_MIN,
} from '../src/core/parsing/experience-reconstruction.js';
import { groundTruthForFixture } from '../tests/lib/section-ground-truth.mjs';
import {
  computeSectionMetrics,
  extractDetectedSections,
} from '../tests/lib/section-accuracy.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'EXPERIENCE_RECALL_REPORT.md');
const OCR_FRAGMENTED = path.join(ROOT, 'tests/fixtures/yoaz-pdf-live/ocr-fragmented.txt');

const ACCEPTANCE_FIXTURES = [
  { id: 'developer-cv', label: 'Developer CV' },
  { id: 'creative-cv', label: 'Creative CV' },
  { id: 'marketing-cv', label: 'Marketing CV' },
  { id: 'consultant-cv', label: 'Consultant CV' },
];

const FRAGMENTED_OCR_GROUND_TRUTH = [
  'Freelance Illustrator — Independent / Freelance — 2011 — 2022',
  'Lead Illustrator — McCann Paris — 2011 — 2014',
  'Art Director Illustration — Publicis Conseil — 2014 — 2016',
  'Senior Illustrator — Havas Paris — 2016 — 2018',
  'Freelance Senior Art Director — Independent — 2018 — 2020',
  'Illustrator / Designer — BETC — 2020 — 2021',
  'Visual Designer — DDB Paris — 2021 — 2022',
  'Lead Visual Designer — AKQA Paris — 2022 — 2023',
  'Creative Director — Studio Yoaz — 2023 — Present',
];

async function evaluateFixture(entry, extractionMethod = 'paste') {
  const fixturePath = path.join(ROOT, 'tests/fixtures', entry.id, 'fixture.txt');
  const raw = fs.existsSync(fixturePath)
    ? fs.readFileSync(fixturePath, 'utf8')
    : fs.readFileSync(entry.rawPath, 'utf8');

  const imp = await runHirelyImportFromText(raw, {
    source: entry.id,
    extractionMethod,
  });
  const sanitized = sanitizeResumeForDisplay(imp.resumeData);
  const detected = extractDetectedSections(sanitized);
  const gt = groundTruthForFixture(entry.id, raw);
  const metrics = computeSectionMetrics(gt.experience, detected.experience, 'experience');

  return {
    ...entry,
    metrics,
    detected: detected.experience,
    expected: gt.experience,
    experiences: sanitized.experiences || [],
  };
}

function fmtPct(n) {
  return `${n}%`;
}

async function main() {
  const rows = [];
  let totalExpected = 0;
  let totalTp = 0;

  for (const entry of ACCEPTANCE_FIXTURES) {
    const row = await evaluateFixture(entry);
    rows.push(row);
    totalExpected += row.metrics.expected;
    totalTp += row.metrics.tp;
    process.stderr.write(`[experience-recall] ${entry.id} recall ${row.metrics.recall}%…\n`);
  }

  let ocrRow = null;
  if (fs.existsSync(OCR_FRAGMENTED)) {
    const raw = fs.readFileSync(OCR_FRAGMENTED, 'utf8');
    const imp = await runHirelyImportFromText(raw, {
      source: 'yoaz-pdf-live-fragmented',
      extractionMethod: 'ocr',
    });
    const sanitized = sanitizeResumeForDisplay(imp.resumeData);
    const detected = extractDetectedSections(sanitized);
    const ocrMetrics = computeSectionMetrics(
      FRAGMENTED_OCR_GROUND_TRUTH,
      detected.experience,
      'experience'
    );
    ocrRow = {
      id: 'yoaz-pdf-live-fragmented',
      label: 'Fragmented OCR sample',
      experienceCount: sanitized.experiences?.length ?? 0,
      detected: detected.experience,
      metrics: ocrMetrics,
      experiences: sanitized.experiences || [],
    };
    rows.push(ocrRow);
    totalExpected += ocrMetrics.expected;
    totalTp += ocrMetrics.tp;
    process.stderr.write(`[experience-recall] fragmented-ocr recall ${ocrMetrics.recall}%…\n`);
  }

  const aggregateRecall = totalExpected ? Math.round((totalTp / totalExpected) * 1000) / 10 : 100;
  const goalMet =
    rows.every((r) => r.metrics.recall >= EXPERIENCE_RECONSTRUCTION_RECALL_GOAL * 100) &&
    aggregateRecall >= EXPERIENCE_RECONSTRUCTION_RECALL_GOAL * 100;

  const lines = [];
  lines.push('# EXPERIENCE RECALL REPORT');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Engine: \`${EXPERIENCE_RECONSTRUCTION}\``);
  lines.push('Pipeline: production import + experience reconstruction + `sanitizeResumeForDisplay`');
  lines.push('');
  lines.push('## Goal');
  lines.push('');
  lines.push(
    `**Experience recall ≥ ${EXPERIENCE_RECONSTRUCTION_RECALL_GOAL * 100}%** on Developer, Creative, Marketing, and Consultant CVs.`
  );
  lines.push('');
  lines.push(
    goalMet
      ? `### Goal status: **MET** (all acceptance fixtures ≥ ${EXPERIENCE_RECONSTRUCTION_RECALL_GOAL * 100}% recall)`
      : `### Goal status: **NOT MET**`
  );
  lines.push('');
  lines.push('## Rules enforced');
  lines.push('');
  lines.push('- Rebuild `role`, `company`, `dates`, `description`, `confidence` from date-anchored line groups');
  lines.push('- Reject education, skills, clients, and languages as experience sources');
  lines.push('- Merge nearby lines when date fragments repeat on adjacent groups');
  lines.push(`- Infer missing company only when confidence > ${COMPANY_INFERENCE_CONFIDENCE_MIN}%`);
  lines.push('');
  lines.push('## Acceptance fixtures');
  lines.push('');
  lines.push('| Fixture | Expected | Detected | TP | FN | FP | Recall | Precision |');
  lines.push('|---------|----------:|---------:|---:|---:|---:|-------:|----------:|');

  for (const row of rows) {
    const m = row.metrics;
    lines.push(
      `| ${row.label} | ${m.expected} | ${m.detected} | ${m.tp} | ${m.fn} | ${m.fp} | **${fmtPct(m.recall)}** | ${fmtPct(m.precision)} |`
    );
  }

  lines.push('');
  lines.push(`**Aggregate recall:** ${fmtPct(aggregateRecall)} (${totalTp}/${totalExpected} experiences matched)`);
  lines.push('');
  lines.push('## Per-fixture detail');
  lines.push('');

  for (const row of rows) {
    lines.push(`### ${row.label} (\`${row.id}\`)`);
    lines.push('');
    lines.push(`- Recall: **${fmtPct(row.metrics.recall)}**, precision ${fmtPct(row.metrics.precision)}`);
    if (row.metrics.falseNegatives.length) {
      lines.push('- False negatives:');
      for (const fn of row.metrics.falseNegatives) {
        lines.push(`  - \`${fn}\``);
      }
    }
    if (row.metrics.falsePositives.length) {
      lines.push('- False positives:');
      for (const fp of row.metrics.falsePositives) {
        lines.push(`  - \`${fp}\``);
      }
    }
    if (row.experiences.length) {
      lines.push('- Reconstructed experiences:');
      for (const exp of row.experiences.slice(0, 6)) {
        const desc = (exp.bullets || []).join(' ').slice(0, 80);
        lines.push(
          `  - **${exp.role || '—'}** @ ${exp.company || '—'} (${exp.dates || '—'}) — confidence ${exp.confidence ?? '—'}${desc ? ` — ${desc}` : ''}`
        );
      }
    }
    lines.push('');
  }

  if (ocrRow) {
    lines.push('## Fragmented OCR sample');
    lines.push('');
    lines.push(`- Fixture: \`tests/fixtures/yoaz-pdf-live/ocr-fragmented.txt\``);
    lines.push(`- Expected roles: **${ocrRow.metrics.expected}**`);
    lines.push(`- Experiences recovered: **${ocrRow.experienceCount}**`);
    lines.push(
      `- Recall: **${fmtPct(ocrRow.metrics.recall)}** (TP ${ocrRow.metrics.tp} / FN ${ocrRow.metrics.fn})`
    );
    if (ocrRow.metrics.falseNegatives.length) {
      lines.push('- False negatives:');
      for (const fn of ocrRow.metrics.falseNegatives) {
        lines.push(`  - \`${fn}\``);
      }
    }
    if (ocrRow.experiences.length) {
      lines.push('- Reconstructed experiences:');
      for (const exp of ocrRow.experiences.slice(0, 12)) {
        lines.push(
          `  - **${exp.role || '—'}** @ ${exp.company || '—'} (${exp.dates || '—'})`
        );
      }
    }
    lines.push('');
  }

  lines.push('## Run');
  lines.push('');
  lines.push('```bash');
  lines.push('npm run qa:experience-reconstruction');
  lines.push('npm run experience:recall-report');
  lines.push('```');
  lines.push('');

  fs.writeFileSync(OUT, lines.join('\n'));
  console.log(`Wrote ${OUT}`);
  console.log(`Aggregate recall: ${aggregateRecall}% — goal ${goalMet ? 'MET' : 'NOT MET'}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
