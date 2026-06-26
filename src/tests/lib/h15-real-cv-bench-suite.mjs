/**
 * H15 — Real CV quality benchmark suite runner.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runHirelyImportFromText } from '../../core/pipeline/hirely-import.js';
import { resolveFixtureText } from '../../../tests/lib/stress-catalog.mjs';
import { simulateOcrScan } from '../../../tests/lib/h8-ocr-simulate.mjs';
import {
  H15_REAL_CV_BENCH,
  H15_BENCH_COUNT,
  H15_BENCH_ENGINE,
} from '../../../tests/lib/h15-real-cv-bench-catalog.mjs';
import {
  computeH15BenchMetrics,
  aggregateH15Bench,
  H15_BENCH_GOALS,
} from '../../../tests/lib/h15-real-cv-bench-metrics.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../../..');
const OUT_DIR = path.join(ROOT, 'tests/output/h15-real-cv-bench');
const REPORT_JSON = path.join(OUT_DIR, 'report.json');

/**
 * @param {{ fixtures?: typeof H15_REAL_CV_BENCH }} [opts]
 */
export async function runH15RealCvBenchSuite(opts = {}) {
  const fixtures = opts.fixtures || H15_REAL_CV_BENCH;
  fs.mkdirSync(OUT_DIR, { recursive: true });

  /** @type {ReturnType<typeof computeH15BenchMetrics>[]} */
  const rows = [];

  for (let i = 0; i < fixtures.length; i++) {
    const entry = fixtures[i];
    const resolveEntry = {
      ...entry,
      manifestId: entry.manifestId || entry.fixtureKey || entry.id,
    };
    const { rawText: canonical, fileName } = resolveFixtureText(ROOT, resolveEntry);
    const rawText = entry.simulateOcr ? simulateOcrScan(canonical, entry.ocrSeed ?? i) : canonical;

    const importResult = await runHirelyImportFromText(rawText, {
      source: entry.id,
      extractionMethod: entry.extractionMethod || 'paste',
      file: { name: fileName, type: 'text/plain', size: rawText.length },
      trusted: true,
    });

    rows.push(computeH15BenchMetrics(entry, rawText, importResult));
  }

  const summary = aggregateH15Bench(rows);
  const report = {
    engine: H15_BENCH_ENGINE,
    generatedAt: new Date().toISOString(),
    count: fixtures.length,
    goals: H15_BENCH_GOALS,
    summary,
    results: rows,
  };

  fs.writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2));
  return report;
}

export { H15_BENCH_COUNT, H15_BENCH_GOALS, REPORT_JSON };
