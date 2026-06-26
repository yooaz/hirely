#!/usr/bin/env node
/**
 * Generate CV_PARSE_BENCHMARK_REPORT.md from benchmark JSON output.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const templatePath = join(root, 'tests/benchmarks/CV_PARSE_BENCHMARK_REPORT.template.md');
const jsonPath = join(root, 'tests/output/cv-parse-benchmark/report.json');
const outPath = join(root, 'CV_PARSE_BENCHMARK_REPORT.md');

function runBenchmark() {
  const res = spawnSync('node', ['src/tests/qa-cv-parse-benchmark.mjs'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  return { pass: res.status === 0, tail: `${res.stdout || ''}\n${res.stderr || ''}`.trim().slice(-3000) };
}

if (process.env.HIRELY_SKIP_QA !== '1') {
  const qa = runBenchmark();
  if (!qa.pass) {
    console.warn('Benchmark QA reported failures — report will still be generated.');
    if (qa.tail) console.warn(qa.tail);
  }
}

if (!existsSync(jsonPath)) {
  console.error(`Missing ${jsonPath} — run npm run qa:cv-parse-benchmark first`);
  process.exit(1);
}

const report = JSON.parse(readFileSync(jsonPath, 'utf8'));
const template = readFileSync(templatePath, 'utf8');

function pct(n) {
  return `${Math.round(Number(n) * 1000) / 10}%`;
}

function fmtMetric(c, id) {
  const v = c.metrics[id];
  const check = c.checks.find((x) => x.id === id);
  const ok = check?.pass;
  if (id.includes('rate')) return ok ? `${pct(v)} ✓` : `**${pct(v)} ✗**`;
  return ok ? `${pct(v)} ✓` : `**${pct(v)} ✗**`;
}

function fmtTime(ms) {
  return `${ms}ms`;
}

function fmtAvgTimeStatus(summary) {
  if (summary.avg_parsing_time_threshold_ms == null) return '';
  const ok = summary.avg_parsing_time_pass;
  return ok
    ? `(≤ ${summary.avg_parsing_time_threshold_ms}ms ✓)`
    : `(**> ${summary.avg_parsing_time_threshold_ms}ms ✗**)`;
}

const fixtureRows = report.cases
  .map((c) => {
    const status = c.pass ? 'PASS' : '**FAIL**';
    return `| ${c.label} | ${c.runner} | ${status} | ${fmtTime(c.duration_ms)} | ${fmtMetric(c, 'contact_accuracy')} | ${fmtMetric(c, 'section_detection_accuracy')} | ${fmtMetric(c, 'experience_segmentation_accuracy')} | ${fmtMetric(c, 'education_deduplication_success')} | ${fmtMetric(c, 'skills_purity')} | ${fmtMetric(c, 'unclassified_block_rate')} | ${fmtMetric(c, 'portfolio_leakage_rate')} |`;
  })
  .join('\n');

function margin(check) {
  if (check.comparator === '>=') return check.value - check.threshold;
  return check.threshold - check.value;
}

const risks = [];
for (const c of report.cases) {
  for (const check of c.checks) {
    const m = margin(check);
    if (!check.pass) {
      risks.push(
        `- **${c.id}** — \`${check.id}\` failed (${check.value} ${check.comparator} ${check.threshold})`
      );
    } else if (check.comparator === '>=' && m < 0.12) {
      risks.push(
        `- **${c.id}** — \`${check.id}\` near threshold (${check.value} vs min ${check.threshold})`
      );
    } else if (check.comparator === '<=' && m > 0 && m < 0.08) {
      risks.push(
        `- **${c.id}** — \`${check.id}\` near ceiling (${check.value} vs max ${check.threshold})`
      );
    }
  }
  if (c.details?.experience?.mode === 'golden' && c.details.experience.matched < c.details.experience.expected) {
    risks.push(
      `- **${c.id}** — experience golden match ${c.details.experience.matched}/${c.details.experience.expected} (spatial layout may merge roles)`
    );
  }
  if (c.parse_confidence_global != null && c.parse_confidence_global < 0.7) {
    risks.push(
      `- **${c.id}** — global parse confidence low (${c.parse_confidence_global})`
    );
  }
}

const regressionRisks =
  risks.length > 0 ? risks.join('\n') : '- No active regression risks — all metrics comfortably within thresholds.';

const bottleneckScores = [];
for (const c of report.cases) {
  for (const check of c.checks) {
    const headroom =
      check.comparator === '>=' ? check.value - check.threshold : check.threshold - check.value;
    bottleneckScores.push({
      fixture: c.id,
      metric: check.id,
      headroom,
      value: check.value,
      threshold: check.threshold,
      pass: check.pass,
    });
  }
}
bottleneckScores.sort((a, b) => a.headroom - b.headroom);

const bottlenecks = bottleneckScores
  .slice(0, 8)
  .map(
    (b, i) =>
      `${i + 1}. **${b.fixture}** / \`${b.metric}\` — headroom ${Math.round(b.headroom * 1000) / 1000} (value ${b.value}, threshold ${b.threshold})${b.pass ? '' : ' **FAILING**'}`
  )
  .join('\n');

const fixtureDetails = report.cases
  .map((c) => {
    const fails = c.failures.length
      ? c.failures.map((f) => `- ${f.metric}: ${f.value} not ${f.comparator} ${f.threshold}`).join('\n')
      : '- All metrics within thresholds';
    const portfolio =
      c.counts.portfolio_pages?.length > 0
        ? `\n- Portfolio pages excluded: ${c.counts.portfolio_pages.join(', ')} (${c.counts.portfolio_items} items)`
        : '';
    const quality =
      c.production_ready != null
        ? `\n- Production ready: ${c.production_ready ? 'yes' : 'no'} | Validation issues: ${c.validation_issue_count}`
        : '';
    return `### ${c.label} (\`${c.id}\`)

- Status: **${c.pass ? 'PASS' : 'FAIL'}**
- Parsing time: ${c.duration_ms}ms
- Counts: experience ${c.counts.experience}, education ${c.counts.education}, skills ${c.counts.skills}
- Parse confidence: ${c.parse_confidence_global ?? 'n/a'} | Review hints: ${c.review_hint_count}${quality}
${portfolio}
**Failures / gaps:**
${fails}
`;
  })
  .join('\n');

const md = template
  .replace(/\{\{VERSION\}\}/g, report.version)
  .replace(/\{\{GENERATED_AT\}\}/g, report.generated_at)
  .replace(/\{\{REGISTRY_PATH\}\}/g, report.registry_path.replace(root + '/', ''))
  .replace(/\{\{OVERALL_STATUS\}\}/g, report.pass ? '**PASS**' : '**FAIL**')
  .replace(/\{\{FIXTURE_ROWS\}\}/g, fixtureRows)
  .replace(/\{\{PASSED_COUNT\}\}/g, String(report.summary.passed))
  .replace(/\{\{TOTAL_COUNT\}\}/g, String(report.summary.total))
  .replace(/\{\{PASS_RATE_PCT\}\}/g, pct(report.summary.pass_rate))
  .replace(/\{\{AVG_PARSING_TIME_MS\}\}/g, String(report.summary.average_parsing_time_ms ?? 'n/a'))
  .replace(/\{\{AVG_PARSING_TIME_STATUS\}\}/g, fmtAvgTimeStatus(report.summary))
  .replace(/\{\{REGRESSION_RISKS\}\}/g, regressionRisks)
  .replace(/\{\{NEXT_BOTTLENECKS\}\}/g, bottlenecks)
  .replace(/\{\{FIXTURE_DETAILS\}\}/g, fixtureDetails);

writeFileSync(outPath, md);
console.log(`Wrote ${outPath}`);
