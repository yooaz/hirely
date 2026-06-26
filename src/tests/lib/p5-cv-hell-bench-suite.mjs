/**
 * P5 — CV Hell benchmark suite runner.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runHirelyImportFromText } from '../../core/pipeline/hirely-import.js';
import { resolveFixtureText } from '../../../tests/lib/stress-catalog.mjs';
import { simulateOcrScan } from '../../../tests/lib/h8-ocr-simulate.mjs';
import { applyHellLayout } from '../../../tests/lib/p5-cv-hell-layouts.mjs';
import {
  P5_CV_HELL_BENCH,
  P5_HELL_BENCH_COUNT,
  P5_HELL_BENCH_ENGINE,
} from '../../../tests/lib/p5-cv-hell-bench-catalog.mjs';
import {
  computeP5HellMetrics,
  aggregateP5HellBench,
  P5_HELL_GOALS,
} from '../../../tests/lib/p5-cv-hell-bench-metrics.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../../..');
const OUT_DIR = path.join(ROOT, 'tests/output/p5-cv-hell-bench');
const REPORT_JSON = path.join(OUT_DIR, 'report.json');

/**
 * @param {{ fixtures?: typeof P5_CV_HELL_BENCH, onProgress?: (i: number, total: number, id: string) => void }} [opts]
 */
export async function runP5CvHellBenchSuite(opts = {}) {
  const fixtures = opts.fixtures || P5_CV_HELL_BENCH;
  fs.mkdirSync(OUT_DIR, { recursive: true });

  /** @type {ReturnType<typeof computeP5HellMetrics>[]} */
  const rows = [];

  for (let i = 0; i < fixtures.length; i++) {
    const entry = fixtures[i];
    opts.onProgress?.(i + 1, fixtures.length, entry.id);

    const resolveEntry = {
      ...entry,
      manifestId: entry.manifestId || entry.fixtureKey || entry.id,
    };
    const { rawText: canonical, fileName } = resolveFixtureText(ROOT, resolveEntry);
    let importText = applyHellLayout(canonical, entry.layout);
    if (entry.simulateOcr) {
      importText = simulateOcrScan(importText, entry.ocrSeed ?? i);
    }

    const importResult = await runHirelyImportFromText(importText, {
      source: entry.id,
      extractionMethod: entry.extractionMethod || 'paste',
      file: { name: fileName, type: 'text/plain', size: importText.length },
      trusted: true,
    });

    rows.push(computeP5HellMetrics(entry, canonical, importResult));
  }

  const summary = aggregateP5HellBench(rows);
  const report = {
    engine: P5_HELL_BENCH_ENGINE,
    generatedAt: new Date().toISOString(),
    count: fixtures.length,
    goals: P5_HELL_GOALS,
    summary,
    results: rows,
  };

  fs.writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2));
  return report;
}

export { P5_HELL_BENCH_COUNT, P5_HELL_GOALS, REPORT_JSON };
