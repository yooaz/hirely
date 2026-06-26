/**
 * CV parse benchmark runner — loads registry fixtures and runs detectSectionBlocks.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { buildLayoutMemory } from '../../src/core/layout/layout-memory.js';
import { spatialBlocksFromLayoutMemory } from '../../src/core/layout/spatial-block.js';
import { classifyDocumentPageLayouts } from '../../src/core/layout/page-layout.js';
import { classifyDocumentPages } from '../../src/core/layout/page-document-classifier.js';
import { detectSectionBlocks } from '../../src/core/parsing/section-detect-v2.js';
import { computeFixtureMetrics } from './cv-parse-benchmark-metrics.mjs';

export const CV_PARSE_BENCHMARK_VERSION = 'CV_PARSE_BENCHMARK_V2';

/**
 * @param {string} rootDir
 * @param {string} [registryPath]
 */
export function loadBenchmarkRegistry(rootDir, registryPath) {
  const path = registryPath || join(rootDir, 'tests/benchmarks/cv-parse-benchmark.registry.json');
  const raw = JSON.parse(readFileSync(path, 'utf8'));
  return { ...raw, _path: path };
}

function loadLinesJson(rootDir, relPath) {
  const raw = JSON.parse(readFileSync(join(rootDir, relPath), 'utf8'));
  return raw.lines.map((l, i) => ({
    ...l,
    cleanedText: l.text,
    rawExtraction: l.text,
    confidence: l.confidence ?? 90,
    source: l.source || 'native',
    line: i,
  }));
}

function loadTextFixture(rootDir, relPath) {
  return readFileSync(join(rootDir, relPath), 'utf8');
}

function loadGoldens(rootDir, goldenPaths = {}) {
  const goldens = {};
  for (const [key, rel] of Object.entries(goldenPaths)) {
    if (rel && existsSync(join(rootDir, rel))) {
      goldens[key] = JSON.parse(readFileSync(join(rootDir, rel), 'utf8'));
    }
  }
  return goldens;
}

/**
 * @param {string} rootDir
 * @param {object} fixture
 */
export function runSpatialPipelineFixture(rootDir, fixture) {
  const allLines = [];
  for (const rel of fixture.linesJson || []) {
    allLines.push(...loadLinesJson(rootDir, rel));
  }

  const text =
    fixture.textFixture && existsSync(join(rootDir, fixture.textFixture))
      ? loadTextFixture(rootDir, fixture.textFixture)
      : allLines.map((l) => l.text).join('\n');

  const memory = buildLayoutMemory(allLines, { source: 'pdf_native' });
  const spatialBlocks = spatialBlocksFromLayoutMemory(memory);
  const pageLayouts = classifyDocumentPageLayouts(allLines);
  const pageDocumentClassification = classifyDocumentPages(allLines, { pageLayouts });

  const detected = detectSectionBlocks(text, {
    layoutMemory: memory,
    spatialBlocks,
    extractionLines: allLines,
    pageDocumentClassification,
    pageLayouts,
  });

  detected._extractionLines = allLines;
  return detected;
}

/**
 * @param {string} rootDir
 * @param {object} fixture
 */
export function runTextPipelineFixture(rootDir, fixture) {
  const text = loadTextFixture(rootDir, fixture.textFixture);
  const lines = text
    .split(/\r?\n/)
    .map((raw) => raw.trim())
    .filter(Boolean)
    .map((t, i) => ({
      text: t,
      cleanedText: t,
      rawExtraction: t,
      page: 1,
      x: 72,
      y: 800 - i * 16,
      // Fixed column width — dynamic width from char count breaks spatial segmentation.
      width: 520,
      height: 14,
      confidence: 90,
      source: 'text_paste',
      line: i,
    }));

  const memory = buildLayoutMemory(lines, { source: 'text_paste' });
  const spatialBlocks = spatialBlocksFromLayoutMemory(memory);
  const pageLayouts = classifyDocumentPageLayouts(lines);
  const pageDocumentClassification = classifyDocumentPages(lines, { pageLayouts });

  const detected = detectSectionBlocks(text, {
    layoutMemory: memory,
    spatialBlocks,
    extractionLines: lines,
    pageDocumentClassification,
    pageLayouts,
    source: 'text_paste',
  });

  detected._extractionLines = lines;
  return detected;
}

/**
 * @param {string} rootDir
 * @param {object} fixture
 */
export function runFixture(rootDir, fixture) {
  const t0 = Date.now();
  let detected;
  if (fixture.runner === 'spatial_pipeline') {
    detected = runSpatialPipelineFixture(rootDir, fixture);
  } else {
    detected = runTextPipelineFixture(rootDir, fixture);
  }

  const goldens = loadGoldens(rootDir, fixture.goldens || {});
  const result = computeFixtureMetrics(detected, fixture, goldens);

  return {
    id: fixture.id,
    label: fixture.label,
    runner: fixture.runner,
    duration_ms: Date.now() - t0,
    pass: result.pass,
    metrics: result.metrics,
    thresholds: result.thresholds,
    checks: result.checks,
    counts: result.counts,
    details: result.details,
    failures: result.checks.filter((c) => !c.pass).map((c) => ({
      metric: c.id,
      value: c.value,
      threshold: c.threshold,
      comparator: c.comparator,
    })),
    parse_confidence_global: detected.parseConfidence?.global ?? null,
    review_hint_count: detected.reviewHints?.hints?.length ?? 0,
    production_ready: detected.parseResponse?.quality_gate?.production_ready ?? null,
    validation_issue_count: detected.parseValidation?.issues?.length ?? 0,
  };
}

/**
 * @param {object} [opts]
 * @param {string} [opts.rootDir]
 * @param {string[]} [opts.onlyIds]
 */
export function runCvParseBenchmark(opts = {}) {
  const rootDir = opts.rootDir || process.cwd();
  const registry = loadBenchmarkRegistry(rootDir, opts.registryPath);
  const fixtures = registry.fixtures.filter(
    (f) => !opts.onlyIds?.length || opts.onlyIds.includes(f.id)
  );

  const cases = fixtures.map((fixture) => runFixture(rootDir, fixture));
  const passed = cases.filter((c) => c.pass).length;
  const totalDurationMs = cases.reduce((sum, c) => sum + (c.duration_ms || 0), 0);
  const averageParsingTimeMs = cases.length
    ? Math.round(totalDurationMs / cases.length)
    : 0;

  const avgTimeThreshold = registry.summary_thresholds?.avg_parsing_time_ms_max;
  const avgTimePass =
    avgTimeThreshold == null ? true : averageParsingTimeMs <= avgTimeThreshold;

  return {
    version: registry.version || CV_PARSE_BENCHMARK_VERSION,
    generated_at: new Date().toISOString(),
    registry_path: registry._path,
    summary: {
      total: cases.length,
      passed,
      failed: cases.length - passed,
      pass_rate: cases.length ? Math.round((passed / cases.length) * 1000) / 1000 : 0,
      average_parsing_time_ms: averageParsingTimeMs,
      total_parsing_time_ms: totalDurationMs,
      avg_parsing_time_pass: avgTimePass,
      avg_parsing_time_threshold_ms: avgTimeThreshold ?? null,
    },
    cases,
    pass: cases.every((c) => c.pass) && avgTimePass,
  };
}
