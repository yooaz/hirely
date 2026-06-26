/**
 * Golden Yoaz CV classification gate — permanent regression on canonical term → bucket mappings.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyLineWithConfidence } from '../../src/core/parsing/section-sanity.js';
import { CLASSIFICATION_CONFIDENCE_MIN } from '../../src/core/parsing/classification-engine-v2.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const DEFAULT_MANIFEST = join(root, 'tests/golden/yoaz-cv-classification.json');

/**
 * @param {object} item — classification entry from manifest
 * @param {(line: string) => { bucket: string, confidence: number }} classifyFn
 * @param {number} confidenceMin
 */
export function validateGoldenClassificationItem(item, classifyFn, confidenceMin) {
  const failures = [];
  const results = [];

  for (const line of item.canonicalLines || []) {
    const hit = classifyFn(line);
    results.push({ line, bucket: hit.bucket, confidence: hit.confidence });

    if (hit.bucket !== item.bucket) {
      failures.push(
        `${item.term}: "${line}" → ${hit.bucket} (expected ${item.bucket}, ${hit.confidence}%)`
      );
    } else if (hit.confidence < confidenceMin) {
      failures.push(
        `${item.term}: "${line}" confidence ${hit.confidence}% < ${confidenceMin}%`
      );
    }

    for (const forbidden of item.forbiddenBuckets || []) {
      if (hit.bucket === forbidden) {
        failures.push(`${item.term}: "${line}" wrongly classified as ${forbidden}`);
      }
    }
  }

  return { id: item.id, term: item.term, expectedBucket: item.bucket, failures, results };
}

/**
 * Scan fixture lines that contain the term and assert no wrong-bucket classification at ≥ threshold.
 * @param {string} rawFixture
 * @param {object} item
 * @param {(line: string) => { bucket: string, confidence: number }} classifyFn
 * @param {number} confidenceMin
 */
export function validateFixtureTermLines(rawFixture, item, classifyFn, confidenceMin) {
  const failures = [];
  const term = String(item.term || '');
  const lines = String(rawFixture || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 1 && l.toLowerCase().includes(term.toLowerCase()));

  for (const line of lines) {
    if (line.startsWith('-') || line.startsWith('·')) continue;
    if (line.length > 80) continue;
    if (/\b(19|20)\d{2}\b/.test(line)) continue;
    if ((item.canonicalLines || []).includes(line)) continue;

    const hit = classifyFn(line);
    if (hit.confidence < confidenceMin) continue;

    if ((item.forbiddenBuckets || []).includes(hit.bucket)) {
      failures.push(
        `fixture scan ${item.term}: "${line.slice(0, 72)}" → ${hit.bucket} (forbidden, ${hit.confidence}%)`
      );
    }
  }

  return failures;
}

/**
 * @param {object} [opts]
 * @param {string} [opts.manifestPath]
 * @param {string} [opts.rootDir]
 * @param {(line: string) => { bucket: string, confidence: number }} [opts.classifyFn]
 */
export function runGoldenYoazCvGate(opts = {}) {
  const rootDir = opts.rootDir || root;
  const manifestPath = opts.manifestPath || DEFAULT_MANIFEST;
  const classifyFn = opts.classifyFn || classifyLineWithConfidence;
  const confidenceMin = opts.confidenceMin ?? CLASSIFICATION_CONFIDENCE_MIN;

  if (!existsSync(manifestPath)) {
    return {
      pass: false,
      id: 'YOAZ_CV_DESIGNER',
      failures: [`manifest missing: ${manifestPath}`],
      items: [],
    };
  }

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const fixturePath = join(rootDir, manifest.fixture);
  if (!existsSync(fixturePath)) {
    return {
      pass: false,
      id: manifest.id,
      failures: [`fixture missing: ${manifest.fixture}`],
      items: [],
    };
  }

  const rawFixture = readFileSync(fixturePath, 'utf8');
  const threshold = manifest.confidenceMin ?? confidenceMin;
  const failures = [];
  const items = [];

  for (const item of manifest.classifications || []) {
    const validated = validateGoldenClassificationItem(item, classifyFn, threshold);
    items.push(validated);
    failures.push(...validated.failures);
    failures.push(...validateFixtureTermLines(rawFixture, item, classifyFn, threshold));
  }

  return {
    pass: failures.length === 0,
    id: manifest.id,
    label: manifest.label,
    fixture: manifest.fixture,
    confidenceMin: threshold,
    failures,
    items,
    manifestVersion: manifest.version,
  };
}
