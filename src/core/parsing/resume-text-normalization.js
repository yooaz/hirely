/**
 * Resume text normalization layer — conservative OCR/PDF repair before section parsing.
 *
 * Principles:
 * - Never hallucinate content; only reshape noisy tokens when confidence ≥ MIN_CORRECTION_CONFIDENCE.
 * - Every correction carries rule id + confidence (see cv-text-normalization.js).
 * - Spatial structure preserved on blocks (bbox, zone, page).
 *
 * Confidence tiers:
 *   0.99  unicode / whitespace (deterministic)
 *   0.90  punctuation, merged years in chronological order
 *   0.80  spaced years, dictionary phrase repairs
 *   0.70  OCR year fragments (20m, 201038), camel-case splits
 */

import { hirelyDebugLog } from '../runtime/hirely-debug.js';
import { normalizeCompareString } from './dedupe-engine.js';
import {
  repairHyphenatedLineBreaks,
  dedupeConsecutiveLines,
  dedupeGlobalLines,
  splitMergedSectionHeaders,
} from './ocr-hardening.js';
import {
  CV_TEXT_NORMALIZATION_VERSION,
  MIN_CORRECTION_CONFIDENCE,
  CORRECTION_RULE,
  normalizeCvLine,
  normalizeCvDocument,
} from './cv-text-normalization.js';

export const RESUME_TEXT_NORMALIZATION_VERSION = '1';

export { CORRECTION_RULE, MIN_CORRECTION_CONFIDENCE, CV_TEXT_NORMALIZATION_VERSION };

function lineText(item) {
  return String(item?.cleanedText ?? item?.text ?? item ?? '').trim();
}

function blockRawText(block) {
  return String(block?.text ?? block?.normalized_text ?? '').trim();
}

/**
 * @param {object} block
 * @param {object} [opts]
 */
export function normalizeResumeBlock(block, opts = {}) {
  const raw = blockRawText(block);
  if (!raw) {
    return {
      ...block,
      raw_text: '',
      normalized_text: '',
      normalization_corrections: [],
      normalization_confidence: 1,
    };
  }

  const { text, corrections, confidence } = normalizeCvLine(raw, {
    dates: opts.dates !== false,
    words: opts.words !== false,
    unicode: opts.unicode !== false,
    punctuation: opts.punctuation !== false,
  });

  return {
    ...block,
    raw_text: block.raw_text ?? block.text ?? raw,
    text: block.text ?? raw,
    normalized_text: text,
    normalization_corrections: corrections,
    normalization_confidence: confidence,
  };
}

/**
 * @param {object[]} blocks
 * @param {object} [opts]
 */
export function normalizeResumeBlocks(blocks, opts = {}) {
  return (blocks || []).map((b) => normalizeResumeBlock(b, opts));
}

/**
 * Deduplicate blocks within page+zone groups (low-risk accidental OCR duplicates).
 * @param {object[]} blocks — must have normalized_text or text
 * @param {object} [opts]
 * @returns {{ blocks: object[], dropped: object[], stats: Record<string, number> }}
 */
export function dedupeResumeBlocks(blocks, opts = {}) {
  const minConfidence = opts.minDedupeConfidence ?? 0.85;
  const scopeByZone = opts.scopeByZone !== false;
  const stats = { input: 0, output: 0, dropped: 0, exact: 0, normalized_key: 0 };

  const list = [...(blocks || [])].sort(
    (a, b) =>
      (a.page_number || a.page || 1) - (b.page_number || b.page || 1) ||
      (a.reading_order ?? 0) - (b.reading_order ?? 0)
  );
  stats.input = list.length;

  /** @type {object[]} */
  const out = [];
  /** @type {object[]} */
  const dropped = [];
  const seen = new Map();

  for (const block of list) {
    const text = String(block.normalized_text ?? block.text ?? '').trim();
    if (!text) continue;

    const page = block.page_number || block.page || 1;
    const zone = scopeByZone ? block.zone_id || block.column_id || 'full' : 'global';
    const scopeKey = `${page}:${zone}`;
    if (!seen.has(scopeKey)) seen.set(scopeKey, new Set());

    const compareKey = normalizeCompareString(text);
    const scopeSeen = seen.get(scopeKey);

    if (compareKey.length >= 4 && scopeSeen.has(compareKey)) {
      dropped.push({
        block_id: block.block_id,
        text,
        reason: 'duplicate_normalized_key',
        confidence: 0.95,
        scope: scopeKey,
      });
      stats.dropped += 1;
      stats.normalized_key += 1;
      continue;
    }

    const exactKey = text.toLowerCase();
    if (scopeSeen.has(`exact:${exactKey}`)) {
      dropped.push({
        block_id: block.block_id,
        text,
        reason: 'duplicate_exact',
        confidence: minConfidence >= 0.9 ? 0.99 : 0.95,
        scope: scopeKey,
      });
      stats.dropped += 1;
      stats.exact += 1;
      continue;
    }

    scopeSeen.add(compareKey);
    scopeSeen.add(`exact:${exactKey}`);
    out.push(block);
  }

  stats.output = out.length;
  return { blocks: out, dropped, stats };
}

/**
 * @param {string} text
 * @param {object} [opts]
 */
export function normalizeResumePlainText(text, opts = {}) {
  const hardened = repairHyphenatedLineBreaks(String(text || ''));
  const doc = normalizeCvDocument(hardened, {
    ...opts,
    debug: opts.debug,
    lineMerge: opts.lineMerge !== false,
    lineSplit: opts.lineSplit !== false,
  });

  let lines = doc.text.split('\n').map((l) => l.trim()).filter(Boolean);
  if (opts.dedupeLines !== false) {
    lines = dedupeConsecutiveLines(lines);
    if (opts.globalDedupe) lines = dedupeGlobalLines(lines);
  }

  return {
    text: lines.join('\n'),
    lines: doc.lines,
    corrections: doc.corrections,
    stats: { ...doc.stats, outputLines: lines.length },
  };
}

/**
 * @param {object[]} lines — extraction lines { text, page, x, y, ... }
 * @param {object} [opts]
 */
export function normalizeExtractionLines(lines, opts = {}) {
  /** @type {object[]} */
  const trace = [];
  const stats = { input: 0, corrected: 0, split: 0 };
  /** @type {import('./cv-text-normalization.js').CvTextCorrection[]} */
  const allCorrections = [];

  for (const ln of lines || []) {
    const raw = lineText(ln);
    if (!raw) continue;
    stats.input += 1;
    const parts = splitMergedSectionHeaders(raw);
    if (parts.length > 1) stats.split += parts.length - 1;
    for (const part of parts) {
      const { text, corrections, confidence } = normalizeCvLine(part, opts);
      if (corrections.length) stats.corrected += 1;
      allCorrections.push(...corrections);
      trace.push({
        ...ln,
        raw_text: raw,
        text,
        cleanedText: text,
        normalization_corrections: corrections,
        normalization_confidence: confidence,
      });
    }
  }

  return { lines: trace, stats, corrections: allCorrections };
}

/**
 * @param {object} input
 * @param {string} [input.text]
 * @param {object[]} [input.spatialBlocks]
 * @param {object[]} [input.extractionLines]
 * @param {object} [opts]
 */
export function runResumeTextNormalization(input = {}, opts = {}) {
  const debug = opts.debug === true || (typeof globalThis !== 'undefined' && globalThis.HIRELY_DEBUG);

  const stats = {
    blocksIn: 0,
    blocksOut: 0,
    blocksDeduped: 0,
    linesIn: 0,
    linesOut: 0,
    corrections: 0,
    dateRepairs: 0,
    wordRepairs: 0,
  };

  let text = input.text || '';
  let spatialBlocks = input.spatialBlocks || [];
  let extractionLines = input.extractionLines || [];

  if (text) {
    const plain = normalizeResumePlainText(text, opts);
    text = plain.text;
    stats.corrections += plain.corrections?.length || 0;
  }

  if (extractionLines.length) {
    const normLines = normalizeExtractionLines(extractionLines, opts);
    extractionLines = normLines.lines;
    stats.linesIn = normLines.stats.input;
    stats.linesOut = extractionLines.length;
    stats.corrections += normLines.corrections?.length || 0;
  }

  if (spatialBlocks.length) {
    stats.blocksIn = spatialBlocks.length;
    let normalized = normalizeResumeBlocks(spatialBlocks, opts);
    stats.corrections += normalized.reduce(
      (n, b) => n + (b.normalization_corrections?.length || 0),
      0
    );

    if (opts.dedupeBlocks !== false) {
      const deduped = dedupeResumeBlocks(normalized, opts);
      normalized = deduped.blocks;
      stats.blocksDeduped = deduped.stats.dropped;
    }

    spatialBlocks = normalized.map((b) => ({
      ...b,
      text: b.normalized_text || b.text,
      normalized_text: b.normalized_text || b.text,
    }));
    stats.blocksOut = spatialBlocks.length;

    if (!text) {
      text = spatialBlocks
        .slice()
        .sort((a, b) => (a.reading_order ?? 0) - (b.reading_order ?? 0))
        .map((b) => b.normalized_text || b.text)
        .filter(Boolean)
        .join('\n');
    }
  }

  for (const c of input.corrections || []) {
    if (c?.rule?.startsWith?.('date_')) stats.dateRepairs += 1;
    if (c?.rule?.startsWith?.('word_')) stats.wordRepairs += 1;
  }

  const debugPayload = buildNormalizationDebug({
    text,
    spatialBlocks,
    extractionLines,
    stats,
    opts,
  });

  if (debug) {
    hirelyDebugLog('RESUME_TEXT_NORMALIZATION', debugPayload);
  }

  if (typeof globalThis !== 'undefined') {
    globalThis.__HIRELY_RESUME_TEXT_NORMALIZATION = debugPayload;
  }

  return {
    version: RESUME_TEXT_NORMALIZATION_VERSION,
    engine: 'RESUME_TEXT_NORMALIZATION_V1',
    text,
    spatialBlocks,
    extractionLines,
    stats,
    debug: debugPayload,
  };
}

/**
 * @param {object} payload
 */
export function buildNormalizationDebug(payload) {
  const samples = [];

  for (const b of (payload.spatialBlocks || []).slice(0, 24)) {
    const before = b.raw_text ?? b.text;
    const after = b.normalized_text ?? b.text;
    if (before === after && !(b.normalization_corrections?.length)) continue;
    samples.push({
      kind: 'block',
      block_id: b.block_id,
      before: String(before || '').slice(0, 120),
      after: String(after || '').slice(0, 120),
      confidence: b.normalization_confidence,
      corrections: (b.normalization_corrections || []).map((c) => ({
        rule: c.rule,
        confidence: c.confidence,
        before: c.before,
        after: c.after,
      })),
    });
  }

  for (const ln of (payload.extractionLines || []).slice(0, 16)) {
    const before = ln.raw_text ?? ln.text;
    const after = ln.cleanedText ?? ln.text;
    if (before === after && !(ln.normalization_corrections?.length)) continue;
    samples.push({
      kind: 'line',
      before: String(before || '').slice(0, 120),
      after: String(after || '').slice(0, 120),
      corrections: ln.normalization_corrections || [],
    });
  }

  return {
    version: RESUME_TEXT_NORMALIZATION_VERSION,
    cv_text_version: CV_TEXT_NORMALIZATION_VERSION,
    min_correction_confidence: MIN_CORRECTION_CONFIDENCE,
    stats: payload.stats,
    samples,
  };
}

/** Documented examples for tests and QA reports. */
export const RESUME_NORMALIZATION_EXAMPLES = [
  { before: '20112023', after: '2011 - 2023', rule: CORRECTION_RULE.DATE_MERGED_YEARS, confidence: 0.93 },
  { before: '201038', after: '2010 - 2018', rule: CORRECTION_RULE.DATE_OCR_MALFORMED_FRAGMENT, confidence: 0.72 },
  { before: '20m - 2023', after: '2011 - 2023', rule: CORRECTION_RULE.DATE_OCR_YEAR_M, confidence: 0.78 },
  { before: 'indesing', after: 'indesign', rule: CORRECTION_RULE.WORD_DICTIONARY, confidence: 0.82 },
  { before: 'digtitalArt', after: 'digital art', rule: CORRECTION_RULE.WORD_DICTIONARY, confidence: 0.8 },
  { before: 'Graphic   Designer', after: 'Graphic Designer', rule: CORRECTION_RULE.WHITESPACE_COLLAPSE, confidence: 0.99 },
  { before: '2011–2023', after: '2011 - 2023', rule: CORRECTION_RULE.HYPHEN_NORMALIZE, confidence: 0.97 },
];
