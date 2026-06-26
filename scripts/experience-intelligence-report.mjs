#!/usr/bin/env node
/**
 * Experience intelligence report — experienceNormalizer recall ≥ 90%.
 * Output: EXPERIENCE_INTELLIGENCE_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runHirelyImportFromText } from '../src/core/pipeline/hirely-import.js';
import { sanitizeResumeForDisplay } from '../src/core/validation/sanitize-resume-display.js';
import {
  EXPERIENCE_INTELLIGENCE,
  EXPERIENCE_INTELLIGENCE_RECALL_GOAL,
  experienceNormalizer,
} from '../src/core/parsing/experience-intelligence.js';
import { groundTruthForFixture } from '../tests/lib/section-ground-truth.mjs';
import {
  computeSectionMetrics,
  extractDetectedSections,
} from '../tests/lib/section-accuracy.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'EXPERIENCE_INTELLIGENCE_REPORT.md');
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

const UNIT_EXAMPLES = [
  {
    label: 'McCann fragmented OCR',
    blocks: [
      { id: 'b1', type: 'unknown', bucket: 'unknown', text: 'Designer' },
      { id: 'b2', type: 'unknown', bucket: 'unknown', text: 'McCann G Agency' },
      { id: 'b3', type: 'unknown', bucket: 'unknown', text: '2011-2014' },
    ],
  },
  {
    label: 'Freelance fragmented OCR',
    blocks: [
      { id: 'f1', type: 'experience', bucket: 'experience', text: 'Freelance Illustrator' },
      { id: 'f2', type: 'identity', bucket: 'identity', text: 'Graphic Designer' },
      { id: 'f3', type: 'unknown', bucket: 'unknown', text: 'Independent' },
      { id: 'f4', type: 'unknown', bucket: 'unknown', text: '2011-2022' },
    ],
  },
];

function fmtPct(n) {
  return `${n}%`;
}

async function evaluateFixture(entry, extractionMethod = 'paste') {
  const fixturePath = path.join(ROOT, 'tests/fixtures', entry.id, 'fixture.txt');
  const raw = fs.readFileSync(fixturePath, 'utf8');
  const imp = await runHirelyImportFromText(raw, { source: entry.id, extractionMethod });
  const sanitized = sanitizeResumeForDisplay(imp.resumeData);
  const detected = extractDetectedSections(sanitized);
  const gt = groundTruthForFixture(entry.id, raw);
  const metrics = computeSectionMetrics(gt.experience, detected.experience, 'experience');
  const intel = sanitized.metadata?.experienceIntelligence || {};

  return {
    ...entry,
    metrics,
    detected: detected.experience,
    expected: gt.experience,
    experiences: sanitized.experiences || [],
    intel,
  };
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
    process.stderr.write(`[experience-intelligence] ${entry.id} recall ${row.metrics.recall}%…\n`);
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
      intel: sanitized.metadata?.experienceIntelligence || {},
    };
    rows.push(ocrRow);
    totalExpected += ocrMetrics.expected;
    totalTp += ocrMetrics.tp;
    process.stderr.write(`[experience-intelligence] fragmented-ocr recall ${ocrMetrics.recall}%…\n`);
  }

  const aggregateRecall = totalExpected ? Math.round((totalTp / totalExpected) * 1000) / 10 : 100;
  const goalMet =
    rows.every((r) => r.metrics.recall >= EXPERIENCE_INTELLIGENCE_RECALL_GOAL * 100) &&
    aggregateRecall >= EXPERIENCE_INTELLIGENCE_RECALL_GOAL * 100;

  const unitRows = UNIT_EXAMPLES.map((ex) => {
    const result = experienceNormalizer({ blocks: ex.blocks });
    const exp = result.experiences[0] || {};
    return {
      label: ex.label,
      count: result.experiences.length,
      role: exp.role || '—',
      company: exp.company || '—',
      dates: exp.dates || '—',
      engagement: exp.engagementType || '—',
      stats: result.stats,
    };
  });

  const lines = [];
  lines.push('# EXPERIENCE INTELLIGENCE REPORT');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Engine: \`experienceNormalizer\` (\`${EXPERIENCE_INTELLIGENCE}\`)`);
  lines.push('Pipeline: production import + experience intelligence + `sanitizeResumeForDisplay`');
  lines.push('');
  lines.push('## Goal');
  lines.push('');
  lines.push(`**Experience recall > ${EXPERIENCE_INTELLIGENCE_RECALL_GOAL * 100}%** across acceptance CVs and fragmented OCR.`);
  lines.push('');
  lines.push(goalMet ? '### Goal status: **MET**' : '### Goal status: **NOT MET**');
  lines.push('');
  lines.push('## Capabilities');
  lines.push('');
  lines.push('- `detectExperienceRole` — role from fragmented lines');
  lines.push('- `detectExperienceCompany` — company / agency detection');
  lines.push('- `detectExperienceDates` — date range extraction');
  lines.push('- `detectFreelanceMission` — freelance / independent classification');
  lines.push('- `detectInternship` — internship / stage classification');
  lines.push('- `mergeFragmentedExperienceEntries` — merge OCR-split sparse rows');
  lines.push('- `mergeFragmentedExperienceBlocks` — block-level OCR merge (via normalizer)');
  lines.push('');
  lines.push('## Unit examples');
  lines.push('');
  lines.push('| Example | Merged | Role | Company | Dates | Engagement |');
  lines.push('|---------|-------:|------|---------|-------|------------|');
  for (const u of unitRows) {
    lines.push(
      `| ${u.label} | ${u.count} | ${u.role} | ${u.company} | ${u.dates} | ${u.engagement} |`
    );
  }
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
    if (row.intel?.freelanceCount != null) {
      lines.push(`- Intelligence stats: ${row.intel.outputCount} experiences, ${row.intel.freelanceCount} freelance, ${row.intel.internshipCount} internship`);
    }
    if (row.metrics.falseNegatives.length) {
      lines.push('- False negatives:');
      for (const fn of row.metrics.falseNegatives) {
        lines.push(`  - \`${fn}\``);
      }
    }
    if (row.experiences.length) {
      lines.push('- Normalized experiences:');
      for (const exp of row.experiences.slice(0, 10)) {
        const tag = exp.isFreelance ? ' [freelance]' : exp.isInternship ? ' [internship]' : '';
        lines.push(
          `  - **${exp.role || '—'}** @ ${exp.company || '—'} (${exp.dates || '—'})${tag}`
        );
      }
    }
    lines.push('');
  }

  lines.push('## Run');
  lines.push('');
  lines.push('```bash');
  lines.push('npm run qa:experience-intelligence');
  lines.push('npm run experience:intelligence-report');
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
