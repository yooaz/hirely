/**
 * Unified corpus resume benchmark — parse metrics + generalization proof + anti-overfit audit.
 */
import fs from 'fs';
import path from 'path';
import { runCvParseBenchmark } from './cv-parse-benchmark-runner.mjs';
import { runAntiOverfitAudit } from './corpus-anti-overfit-audit.mjs';
import { loadGeneralizationCorpus } from './generalization-proof-corpus.mjs';
import { runHirelyImportFromText } from '../../src/core/pipeline/hirely-import.js';
import { sanitizeResumeForDisplay } from '../../src/core/validation/sanitize-resume-display.js';
import { resumeDataToCvData } from '../../src/core/resume-data.js';
import { loadHirelyTemplates } from '../../src/tests/lib/pdf-hardening-suite.mjs';
import {
  evaluateGeneralizationCv,
  aggregateGeneralizationProof,
} from './generalization-proof-eval.mjs';

export const CORPUS_RESUME_BENCHMARK_V1 = 'CORPUS_RESUME_BENCHMARK_V1';

const METRIC_IDS = [
  'contact_accuracy',
  'header_detection_rate',
  'section_detection_accuracy',
  'experience_segmentation_accuracy',
  'education_deduplication_success',
  'skills_purity',
  'unclassified_block_rate',
  'portfolio_leakage_rate',
];

function averageMetric(cases, metricId) {
  if (!cases.length) return 0;
  const sum = cases.reduce((acc, c) => acc + (c.metrics?.[metricId] ?? 0), 0);
  return Math.round((sum / cases.length) * 10000) / 10000;
}

/**
 * @param {string} rootDir
 */
export async function runGeneralizationCorpusInline(rootDir) {
  const corpus = loadGeneralizationCorpus(rootDir);
  const templates = loadHirelyTemplates();
  const rows = [];

  for (const fixture of corpus) {
    const row = {
      id: fixture.id,
      label: fixture.label,
      pass: false,
      failures: [],
      metrics: {},
      error: null,
    };
    try {
      const importResult = await runHirelyImportFromText(fixture.text, {
        source: `corpus_benchmark:${fixture.id}`,
        extractionMethod: 'paste',
        file: {
          name: fixture.fileName,
          type: 'text/plain',
          size: fixture.text.length,
        },
      });
      const resumeData = sanitizeResumeForDisplay(importResult?.resumeData || {});
      const cv = resumeDataToCvData(resumeData);
      const renderHtml = String(templates.render(cv, fixture.templateId) || '');
      const evalResult = evaluateGeneralizationCv({
        importResult,
        resumeData,
        renderHtml,
        expected: fixture.expected,
      });
      row.pass = evalResult.pass;
      row.failures = evalResult.failures;
      row.metrics = evalResult.metrics;
      row.importResult = {
        importStatus: importResult.importStatus,
        errors: importResult.errors || [],
      };
    } catch (err) {
      row.error = String(err?.message || err);
      row.failures.push(`exception:${row.error}`);
    }
    rows.push(row);
  }

  const summary = aggregateGeneralizationProof(rows);
  return { corpus_count: corpus.length, summary, cases: rows };
}

/**
 * @param {object} [opts]
 * @param {string} [opts.rootDir]
 * @param {string} [opts.baselineReportPath]
 */
export async function runCorpusResumeBenchmark(opts = {}) {
  const rootDir = opts.rootDir || process.cwd();
  const inventoryPath = path.join(rootDir, 'tests/benchmarks/corpus-resume-inventory.json');
  const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));

  const parseBenchmark = runCvParseBenchmark({ rootDir });
  const generalization = await runGeneralizationCorpusInline(rootDir);
  const antiOverfit = runAntiOverfitAudit(rootDir);

  const corpusMetrics = {
    contact_accuracy: averageMetric(parseBenchmark.cases, 'contact_accuracy'),
    header_detection_rate: averageMetric(parseBenchmark.cases, 'header_detection_rate'),
    section_detection_accuracy: averageMetric(parseBenchmark.cases, 'section_detection_accuracy'),
    experience_segmentation_accuracy: averageMetric(
      parseBenchmark.cases,
      'experience_segmentation_accuracy'
    ),
    education_deduplication_success: averageMetric(
      parseBenchmark.cases,
      'education_deduplication_success'
    ),
    skills_purity: averageMetric(parseBenchmark.cases, 'skills_purity'),
    unclassified_block_rate: averageMetric(parseBenchmark.cases, 'unclassified_block_rate'),
    portfolio_leakage_rate: averageMetric(parseBenchmark.cases, 'portfolio_leakage_rate'),
  };

  let before = null;
  const baselinePath =
    opts.baselineReportPath ||
    path.join(rootDir, 'tests/benchmarks/corpus-baseline-v2-pre-expansion.json');
  if (fs.existsSync(baselinePath)) {
    try {
      const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
      before = {
        source: baselinePath,
        fixture_count: baseline.summary?.total ?? baseline.cases?.length ?? 0,
        pass_rate: baseline.summary?.pass_rate ?? null,
        corpus_metrics: baseline.corpus_metrics || {},
      };
      if (!Object.keys(before.corpus_metrics).length && baseline.cases?.length) {
        for (const id of METRIC_IDS) {
          before.corpus_metrics[id] = averageMetric(baseline.cases || [], id);
        }
      }
    } catch {
      before = null;
    }
  }

  const passRateMin = 0.85;
  const parsePassRate =
    parseBenchmark.summary.total > 0
      ? parseBenchmark.summary.passed / parseBenchmark.summary.total
      : 0;

  const pass =
    parsePassRate >= passRateMin && antiOverfit.pass && generalization.summary.passRate >= 0.7;

  return {
    version: CORPUS_RESUME_BENCHMARK_V1,
    generated_at: new Date().toISOString(),
    inventory_path: inventoryPath,
    inventory_version: inventory.version,
    pass,
    summary: {
      parse_benchmark: {
        total: parseBenchmark.summary.total,
        passed: parseBenchmark.summary.passed,
        failed: parseBenchmark.summary.failed,
        pass_rate: Math.round(parsePassRate * 10000) / 10000,
        pass_rate_min: passRateMin,
      },
      generalization: generalization.summary,
      anti_overfit: { pass: antiOverfit.pass },
      corpus_metrics: corpusMetrics,
    },
    before_after: before
      ? {
          before,
          after: {
            fixture_count: parseBenchmark.summary.total,
            pass_rate: parsePassRate,
            corpus_metrics: corpusMetrics,
          },
          delta: Object.fromEntries(
            METRIC_IDS.map((id) => [
              id,
              Math.round((corpusMetrics[id] - (before.corpus_metrics[id] ?? 0)) * 10000) / 10000,
            ])
          ),
        }
      : null,
    parse_benchmark: parseBenchmark,
    generalization,
    anti_overfit: antiOverfit,
  };
}
