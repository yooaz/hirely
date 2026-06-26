/**
 * Extraction confidence gate — low OCR confidence → needsReview, not auto CV.
 */

import {
  EXTRACTION_LINE_REVIEW_THRESHOLD,
  buildLineConfidenceIndex,
  extractionConfidenceForLine,
} from '../extraction/extracted-line.js';
import { analyzeLineCorruption, corruptionReviewItem } from './corruption-detector.js';

const BUCKET_KEYS = [
  'top',
  'identity',
  'contact',
  'summary',
  'experience',
  'clients',
  'awards',
  'exhibitions',
  'publications',
  'portfolioLinks',
  'education',
  'skills',
  'tools',
  'languages',
  'projects',
  'interests',
  'location',
  'unsorted',
];

/**
 * @param {object} blocks
 * @param {import('../extraction/extracted-line.js').ExtractedLine[]} extractionLines
 * @returns {{ blocks: object, extractionReview: object[] }}
 */
export function applyExtractionConfidenceGate(blocks, extractionLines) {
  const index = extractionLines?.length ? buildLineConfidenceIndex(extractionLines) : null;
  const out = {};
  const extractionReview = [];

  const keys = [
    ...new Set([
      ...BUCKET_KEYS,
      ...Object.keys(blocks || {}).filter((k) => !k.startsWith('_')),
    ]),
  ];

  for (const key of keys) {
    out[key] = [];
  }

  for (const key of keys) {
    const bucket = blocks[key];
    if (!Array.isArray(bucket)) continue;
    for (const line of bucket) {
      const conf = index ? extractionConfidenceForLine(line, index) : 100;
      const corruption = analyzeLineCorruption(line);

      if (corruption.corrupted) {
        const item = corruptionReviewItem(line, { extractionConfidence: conf });
        if (item) extractionReview.push(item);
        continue;
      }

      if (conf < EXTRACTION_LINE_REVIEW_THRESHOLD) {
        extractionReview.push({
          field: 'raw',
          detected: line,
          sourceText: line,
          sourceLines: [line],
          suggestion: 'Verify OCR line',
          reason: `Extraction confidence ${conf}% (below ${EXTRACTION_LINE_REVIEW_THRESHOLD}%)`,
          action: 'edit',
          confidence: conf,
          extractionConfidence: conf,
        });
        continue;
      }
      out[key].push(line);
    }
  }

  return { blocks: out, extractionReview };
}
