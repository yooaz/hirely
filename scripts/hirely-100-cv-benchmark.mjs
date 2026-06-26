#!/usr/bin/env node
/**
 * Hirely 100 CV benchmark report.
 * Output: HIRELY_100_CV_BENCHMARK.md
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runHirelyImportFromText } from '../src/core/pipeline/hirely-import.js';
import {
  BENCHMARK_100_FIXTURES,
  BENCHMARK_100_CATEGORIES,
} from '../tests/benchmark/benchmark-100-catalog.mjs';
import {
  computeBenchmark100Metrics,
  aggregateBenchmark100,
  BENCHMARK_100_GOALS,
} from '../tests/lib/benchmark-100-metrics.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'HIRELY_100_CV_BENCHMARK.md');
const JSON_OUT = path.join(ROOT, 'tests/output/benchmark-100/report.json');

function fmtPct(n) {
  return `${n}%`;
}

function archetypeAggregate(rows, archetype) {
  return aggregateBenchmark100(rows.filter((r) => r.archetype === archetype));
}

async function main() {
  const rows = [];
  for (let i = 0; i < BENCHMARK_100_FIXTURES.length; i++) {
    const fixture = BENCHMARK_100_FIXTURES[i];
    process.stderr.write(`[benchmark] ${i + 1}/100 ${fixture.id}…\n`);
    const importResult = await runHirelyImportFromText(fixture.text, {
      source: fixture.id,
      extractionMethod: 'paste',
    });
    rows.push(computeBenchmark100Metrics(fixture, importResult));
  }

  const agg = aggregateBenchmark100(rows);
  const worst = [...rows].sort((a, b) => a.overallScore - b.overallScore)[0];
  const best = [...rows].sort((a, b) => b.overallScore - a.overallScore)[0];

  fs.mkdirSync(path.dirname(JSON_OUT), { recursive: true });
  fs.writeFileSync(
    JSON_OUT,
    JSON.stringify({ generatedAt: new Date().toISOString(), aggregate: agg, rows }, null, 2)
  );

  const lines = [];
  lines.push('# HIRELY 100 CV BENCHMARK');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Fixtures: **${rows.length}** (20 creative · 20 developer · 20 marketing · 20 recruiter · 20 consultant)`);
  lines.push('Method: synthetic seeded CVs · paste import · no candidate-specific rules');
  lines.push('');
  lines.push('## Pass criteria');
  lines.push('');
  lines.push(`- Experience recall **> ${BENCHMARK_100_GOALS.experienceRecall}%**`);
  lines.push(`- Education recall **> ${BENCHMARK_100_GOALS.educationRecall}%**`);
  lines.push(`- Identity recall **> ${BENCHMARK_100_GOALS.identityRecall}%** (name + email + phone)`);
  lines.push('');
  lines.push(agg.pass ? '### Goal status: **MET**' : '### Goal status: **NOT MET**');
  lines.push('');
  lines.push('## Aggregate scores');
  lines.push('');
  lines.push('| Metric | Average | Worst | Best | Goal | Status |');
  lines.push('|--------|--------:|------:|-----:|-----:|:------:|');

  const metricRows = [
    ['Identity recall', agg.avgIdentity, agg.minIdentity, agg.maxIdentity, BENCHMARK_100_GOALS.identityRecall, agg.identityRecall > BENCHMARK_100_GOALS.identityRecall],
    ['Experience recall', agg.avgExperience, agg.minExperience, agg.maxExperience, BENCHMARK_100_GOALS.experienceRecall, agg.experienceRecall > BENCHMARK_100_GOALS.experienceRecall],
    ['Education recall', agg.avgEducation, agg.minEducation, agg.maxEducation, BENCHMARK_100_GOALS.educationRecall, agg.educationRecall > BENCHMARK_100_GOALS.educationRecall],
    ['Skills recall', agg.avgSkills, agg.minSkills, agg.maxSkills, '—', true],
    ['Overall score', agg.avgOverall, agg.minOverall, agg.maxOverall, '—', agg.pass],
  ];

  for (const [label, avg, min, max, goal, ok] of metricRows) {
    const goalCell = goal === '—' ? '—' : fmtPct(goal);
    lines.push(`| ${label} | ${fmtPct(avg)} | ${fmtPct(min)} | ${fmtPct(max)} | ${goalCell} | ${ok ? '✓' : '✗'} |`);
  }

  lines.push('');
  lines.push('### Aggregate recall (TP-weighted)');
  lines.push('');
  lines.push(`- **Identity:** ${fmtPct(agg.identityRecall)}`);
  lines.push(`- **Experience:** ${fmtPct(agg.experienceRecall)}`);
  lines.push(`- **Education:** ${fmtPct(agg.educationRecall)}`);
  lines.push(`- **Skills:** ${fmtPct(agg.skillsRecall)}`);
  lines.push('');
  lines.push('## Extremes');
  lines.push('');
  lines.push(`- **Best overall:** \`${best.id}\` (${best.overallScore}%) — ${best.label}`);
  lines.push(`- **Worst overall:** \`${worst.id}\` (${worst.overallScore}%) — ${worst.label}`);
  lines.push('');
  lines.push('## Per-archetype breakdown');
  lines.push('');
  lines.push('| Archetype | Identity | Experience | Education | Skills | Avg overall |');
  lines.push('|-----------|--------:|-----------:|----------:|-------:|------------:|');

  for (const cat of BENCHMARK_100_CATEGORIES) {
    const a = archetypeAggregate(rows, cat.id);
    lines.push(
      `| ${cat.label} | ${fmtPct(a.identityRecall)} | ${fmtPct(a.experienceRecall)} | ${fmtPct(a.educationRecall)} | ${fmtPct(a.skillsRecall)} | ${fmtPct(a.avgOverall)} |`
    );
  }

  lines.push('');
  lines.push('## Failure causes (top 15)');
  lines.push('');
  if (!agg.failureCauses.length) {
    lines.push('_No failures recorded._');
  } else {
    lines.push('| Cause | Count |');
    lines.push('|-------|------:|');
    for (const f of agg.failureCauses.slice(0, 15)) {
      lines.push(`| ${f.cause} | ${f.count} |`);
    }
  }

  lines.push('');
  lines.push('## Worst 10 fixtures');
  lines.push('');
  lines.push('| Fixture | Archetype | Overall | Identity | Experience | Education | Skills |');
  lines.push('|---------|-----------|--------:|---------:|-----------:|----------:|-------:|');
  for (const row of [...rows].sort((a, b) => a.overallScore - b.overallScore).slice(0, 10)) {
    lines.push(
      `| ${row.id} | ${row.archetype} | ${row.overallScore}% | ${row.identity.recall}% | ${row.experienceRecall}% | ${row.educationRecall}% | ${row.skillsRecall}% |`
    );
  }

  lines.push('');
  lines.push('## Identity extraction detail');
  lines.push('');
  lines.push('| Signal | Pass rate |');
  lines.push('|--------|----------:|');
  const namePass = rows.filter((r) => r.identity.strict.name).length;
  const emailPass = rows.filter((r) => r.identity.strict.email).length;
  const phonePass = rows.filter((r) => r.identity.strict.phone).length;
  lines.push(`| Name | ${namePass}/100 (${namePass}%) |`);
  lines.push(`| Email | ${emailPass}/100 (${emailPass}%) |`);
  lines.push(`| Phone | ${phonePass}/100 (${phonePass}%) |`);

  lines.push('');
  lines.push('## Run');
  lines.push('');
  lines.push('```bash');
  lines.push('npm run stress:benchmark-100');
  lines.push('npm run stress:benchmark-100-report');
  lines.push('```');
  lines.push('');
  lines.push(`Raw JSON: \`tests/output/benchmark-100/report.json\``);
  lines.push('');

  fs.writeFileSync(OUT, lines.join('\n'));
  console.log(`Wrote ${OUT}`);
  console.log(`Goal: ${agg.pass ? 'MET' : 'NOT MET'} — identity ${agg.identityRecall}% · experience ${agg.experienceRecall}% · education ${agg.educationRecall}%`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
