#!/usr/bin/env node
/**
 * Hirely PDF / CV stress test — 50 synthetic resumes across 5 categories.
 * Measures extraction %, classification %, confidence, text loss.
 * Writes tests/output/pdf-stress/report.json + PDF_STRESS_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runProductionExtractionPipeline } from '../src/core/pipeline/production-pipeline.js';
import { STRESS_FIXTURES, STRESS_CATEGORIES } from './stress/resume-catalog.mjs';
import { fullStressMetrics } from './lib/stress-metrics.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'tests/output/pdf-stress');
const reportJsonPath = path.join(outDir, 'report.json');
const reportMdPath = path.join(root, 'PDF_STRESS_REPORT.md');

function avg(nums) {
  const v = nums.filter((n) => Number.isFinite(n));
  if (!v.length) return 0;
  return Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10;
}

function summarizeCategory(results) {
  const rows = results.filter((r) => !r.error);
  return {
    count: results.length,
    passed: rows.length,
    errors: results.length - rows.length,
    extractionPct: avg(rows.map((r) => r.metrics.extractionPct)),
    classificationPct: avg(rows.map((r) => r.metrics.classificationPct)),
    confidence: avg(rows.map((r) => r.metrics.confidence)),
    textLossPct: avg(rows.map((r) => r.metrics.textLossPct)),
    extractionScore: avg(rows.map((r) => r.metrics.extractionScore).filter(Number.isFinite)),
    reviewPending: avg(rows.map((r) => r.metrics.reviewPending)),
  };
}

function grade(pct) {
  if (pct >= 90) return 'A';
  if (pct >= 80) return 'B';
  if (pct >= 70) return 'C';
  if (pct >= 60) return 'D';
  return 'F';
}

function buildMarkdown(report) {
  const lines = [];
  const ts = report.generatedAt;
  lines.push('# Hirely PDF Stress Report');
  lines.push('');
  lines.push(`Generated: ${ts}`);
  lines.push(`Pipeline: \`${report.pipelineVersion}\` · Fixtures: **${report.totalFixtures}** synthetic resumes`);
  lines.push('');
  lines.push('## Goal');
  lines.push('');
  lines.push('Measure **real parsing accuracy** across document styles before production PDF uploads.');
  lines.push('');
  lines.push('## Metrics');
  lines.push('');
  lines.push('| Metric | Meaning |');
  lines.push('|--------|---------|');
  lines.push('| **Extraction %** | Structured content retained vs raw input (`retentionPct`) |');
  lines.push('| **Classification %** | 60% anchor placement + 40% block typing (non-unknown, accepted) |');
  lines.push('| **Confidence** | Parser confidence report + block averages |');
  lines.push('| **Text loss %** | Characters not represented in structured CV output |');
  lines.push('');
  lines.push('## Overall summary');
  lines.push('');
  const o = report.overall;
  lines.push(`| Metric | Average | Grade |`);
  lines.push(`|--------|---------|-------|`);
  lines.push(`| Extraction % | ${o.extractionPct}% | ${grade(o.extractionPct)} |`);
  lines.push(`| Classification % | ${o.classificationPct}% | ${grade(o.classificationPct)} |`);
  lines.push(`| Confidence | ${o.confidence} | — |`);
  lines.push(`| Text loss % | ${o.textLossPct}% | ${o.textLossPct <= 15 ? 'OK' : 'WARN'} |`);
  lines.push(`| Extraction score (7-stage) | ${o.extractionScore || '—'} | — |`);
  lines.push('');
  lines.push('## By category');
  lines.push('');
  lines.push(
    '| Category | N | Extraction % | Classification % | Confidence | Text loss % | Errors |'
  );
  lines.push('|----------|---|--------------|------------------|------------|-------------|--------|');
  for (const cat of STRESS_CATEGORIES) {
    const s = report.byCategory[cat.id];
    lines.push(
      `| ${cat.label} | ${s.passed}/${s.count} | ${s.extractionPct}% | ${s.classificationPct}% | ${s.confidence} | ${s.textLossPct}% | ${s.errors} |`
    );
  }
  lines.push('');
  for (const cat of STRESS_CATEGORIES) {
    lines.push(`### ${cat.label}`);
    lines.push('');
    lines.push(cat.description);
    lines.push('');
    const rows = report.results.filter((r) => r.category === cat.id);
    lines.push('| ID | Extraction % | Class % | Confidence | Text loss % | Review |');
    lines.push('|----|--------------|---------|------------|-------------|--------|');
    for (const r of rows) {
      if (r.error) {
        lines.push(`| ${r.id} | — | — | — | — | ERROR |`);
        continue;
      }
      const m = r.metrics;
      lines.push(
        `| ${r.id} | ${m.extractionPct}% | ${m.classificationPct}% | ${m.confidence} | ${m.textLossPct}% | ${m.reviewPending} |`
      );
    }
    lines.push('');
    const weak = rows.filter((r) => !r.error && r.metrics.classificationPct < 75);
    if (weak.length) {
      lines.push('**Low classification samples:**');
      for (const w of weak.slice(0, 5)) {
        const misses = (w.metrics.anchorMisses || []).map((a) => `${a.text}→${a.bucket}`).join(', ');
        lines.push(`- \`${w.id}\` (${w.metrics.classificationPct}%)${misses ? ` — missed: ${misses}` : ''}`);
      }
      lines.push('');
    }
  }
  lines.push('## Interpretation');
  lines.push('');
  lines.push('- **ATS / Modern**: Expect extraction ≥85%, classification ≥80%.');
  lines.push('- **Canva**: Decorative headers stress section detection; classification may dip.');
  lines.push('- **Creative**: Clients and awards must not leak into experience.');
  lines.push('- **Scanned**: OCR noise increases text loss and lowers confidence.');
  lines.push('');
  lines.push('## Reproduce');
  lines.push('');
  lines.push('```bash');
  lines.push('npm run stress:pdf');
  lines.push('```');
  lines.push('');
  lines.push(`Raw JSON: \`tests/output/pdf-stress/report.json\``);
  lines.push('');
  return lines.join('\n');
}

async function runOne(fixture) {
  const method = fixture.category === 'scanned' ? 'pdf-ocr' : 'paste';
  try {
    const pipeline = await runProductionExtractionPipeline(fixture.text, {
      extractionMethod: method,
    });
    const metrics = fullStressMetrics(pipeline, fixture.text, fixture.anchors || []);
    return {
      id: fixture.id,
      category: fixture.category,
      label: fixture.label,
      method,
      simulatedOcr: fixture.simulatedOcr === true,
      metrics,
      layoutType: metrics.layoutType,
      error: null,
    };
  } catch (e) {
    return {
      id: fixture.id,
      category: fixture.category,
      label: fixture.label,
      error: e.message,
      metrics: null,
    };
  }
}

async function main() {
  console.log('Hirely PDF stress test — 50 fixtures\n');
  fs.mkdirSync(outDir, { recursive: true });

  const results = [];
  for (let i = 0; i < STRESS_FIXTURES.length; i++) {
    const f = STRESS_FIXTURES[i];
    process.stdout.write(`[${i + 1}/${STRESS_FIXTURES.length}] ${f.id} … `);
    const row = await runOne(f);
    results.push(row);
    console.log(row.error ? `ERROR ${row.error}` : `ext ${row.metrics.extractionPct}% class ${row.metrics.classificationPct}%`);
  }

  const byCategory = {};
  for (const cat of STRESS_CATEGORIES) {
    byCategory[cat.id] = summarizeCategory(results.filter((r) => r.category === cat.id));
  }

  const okRows = results.filter((r) => !r.error);
  const report = {
    generatedAt: new Date().toISOString(),
    pipelineVersion: 'p0-layout-production',
    totalFixtures: STRESS_FIXTURES.length,
    categories: STRESS_CATEGORIES,
    overall: summarizeCategory(okRows),
    byCategory,
    results,
  };

  fs.writeFileSync(reportJsonPath, JSON.stringify(report, null, 2));
  fs.writeFileSync(reportMdPath, buildMarkdown(report));

  console.log('\n--- Summary ---');
  console.log('Overall extraction %:', report.overall.extractionPct);
  console.log('Overall classification %:', report.overall.classificationPct);
  console.log('Overall confidence:', report.overall.confidence);
  console.log('Overall text loss %:', report.overall.textLossPct);
  console.log('\nWrote', reportMdPath);
  console.log('Wrote', reportJsonPath);

  const failThreshold = Number(process.env.STRESS_MIN_CLASSIFICATION || 0);
  if (failThreshold > 0 && report.overall.classificationPct < failThreshold) {
    console.error(`\nFAIL: classification ${report.overall.classificationPct}% < ${failThreshold}%`);
    process.exit(1);
  }
  if (report.overall.errors > 0) {
    console.warn(`\nWARN: ${report.overall.errors} fixture(s) threw errors`);
  }
}

main().catch((e) => {
  console.error('stress test failed:', e);
  process.exit(1);
});
