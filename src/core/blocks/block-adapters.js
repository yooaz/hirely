/**
 * Adapters between extraction/layout models and structure-first block stages.
 */

import { normalizeSpatialText } from '../layout/spatial-block.js';
import { computeBlockSignals } from '../parsing/block-builder-v1.js';
import { cvSectionToSectionId } from '../parsing/section-detect-v2.js';
import { BLOCK_SOURCE, normalizeBBox } from './block-contract.js';
import { normalizeResumeBlock } from '../parsing/resume-text-normalization.js';

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_RE = /(?:\+?\d[\d\s().-]{7,}\d)/;
const URL_RE = /https?:\/\/|linkedin\.com/i;
const DATE_RE = /\b(19|20)\d{2}\b/;
const BULLET_RE = /^[-•*]\s+/;

/**
 * @param {import('../extraction/extracted-line.js').ExtractedLine[]} lines
 * @returns {import('./block-contract.js').RawPage[]}
 */
export function rawPagesFromExtractionLines(lines) {
  const byPage = new Map();
  for (const ln of lines || []) {
    const p = ln.page || 1;
    if (!byPage.has(p)) {
      byPage.set(p, {
        page_number: p,
        width: 595,
        height: 842,
        rotation: 0,
        has_native_text: ln.source === 'native',
        has_images: false,
      });
    }
  }
  return [...byPage.values()].sort((a, b) => a.page_number - b.page_number);
}

/**
 * @param {import('../extraction/extracted-line.js').ExtractedLine[]} lines
 * @param {object} [opts]
 * @returns {import('./block-contract.js').RawBlock[]}
 */
export function rawBlocksFromExtractionLines(lines, opts = {}) {
  const source = opts.source || BLOCK_SOURCE.NATIVE_TEXT;
  return (lines || [])
    .map((ln, i) => {
      const text = String(ln.cleanedText ?? ln.text ?? '').trim();
      if (!text) return null;
      const w = Number(ln.width) > 0 ? Number(ln.width) : Math.max(24, text.length * 6);
      const h = Number(ln.height) > 0 ? Number(ln.height) : 14;
      return {
        block_id: `raw-p${ln.page || 1}-l${ln.readingOrder ?? ln.lineIndex ?? ln.line ?? i}`,
        page_number: ln.page || 1,
        bbox: normalizeBBox({ x: ln.x || 0, y: ln.y || 0, w, h }),
        source: ln.source === 'ocr' ? BLOCK_SOURCE.OCR : source,
        text,
        normalized_text: normalizeSpatialText(text),
        column_id: ln.columnId || ln.region || undefined,
        zone_id: ln.zone || undefined,
        reading_order: ln.readingOrder ?? ln.lineIndex ?? i,
        line_index: ln.line ?? i,
        style: {
          font_size: ln.fontSize,
          font_weight: ln.fontWeight,
          is_bold: ln.isBold,
          is_uppercase: text === text.toUpperCase() && /[A-Z]/.test(text),
        },
      };
    })
    .filter(Boolean);
}

/**
 * @param {import('../layout/spatial-block.js').SpatialBlock[]} spatialBlocks
 * @returns {import('./block-contract.js').RawBlock[]}
 */
export function rawBlocksFromSpatialBlocks(spatialBlocks) {
  return (spatialBlocks || []).map((b, i) => ({
    block_id: b.block_id || `raw-sb-${i}`,
    page_number: b.page_number || 1,
    bbox: normalizeBBox({
      x: b.bbox?.x,
      y: b.bbox?.y,
      w: b.bbox?.width,
      h: b.bbox?.height,
      x2: b.bbox?.x2,
      y2: b.bbox?.y2,
    }),
    source: b.source || BLOCK_SOURCE.LAYOUT_MEMORY,
    text: b.text || '',
    normalized_text: b.normalized_text || normalizeSpatialText(b.text),
    column_id: b.column_id,
    zone_id: b.zone_id,
    reading_order: b.reading_order ?? i,
    line_index: i,
    style: b.style || undefined,
  }));
}

/**
 * @param {import('./block-contract.js').RawBlock} raw
 * @returns {import('./block-contract.js').BlockSignals}
 */
export function computeSignalsForBlock(raw) {
  const text = raw.normalized_text || raw.text || '';
  const signals = computeBlockSignals(text, [text]);
  return {
    looks_like_heading: text.length < 48 && text === text.toUpperCase() && /[A-Z]/.test(text),
    looks_like_date: signals.hasDate || DATE_RE.test(text),
    looks_like_email: signals.hasEmail || EMAIL_RE.test(text),
    looks_like_phone: signals.hasPhone || PHONE_RE.test(text),
    looks_like_url: signals.hasUrl || URL_RE.test(text),
    looks_like_bullet: BULLET_RE.test(text),
    looks_like_company: signals.hasCompanyLikeText,
    looks_like_job_title: signals.hasRole,
  };
}

/**
 * @param {import('./block-contract.js').RawBlock[]} rawBlocks
 * @returns {import('./block-contract.js').NormalizedBlock[]}
 */
export function normalizeRawBlocks(rawBlocks, opts = {}) {
  return (rawBlocks || []).map((raw) => {
    const repaired = opts.skipTextNormalization
      ? raw
      : normalizeResumeBlock(raw, opts);
    const normalized_text =
      repaired.normalized_text || raw.normalized_text || normalizeSpatialText(raw.text);
    const tokens = normalized_text.split(/\s+/).filter(Boolean);
    return {
      block_id: raw.block_id,
      page_number: raw.page_number,
      bbox: raw.bbox,
      source: raw.source,
      text: raw.text,
      normalized_text,
      raw_text: repaired.raw_text ?? raw.text,
      normalization_corrections: repaired.normalization_corrections,
      normalization_confidence: repaired.normalization_confidence,
      column_id: raw.column_id,
      zone_id: raw.zone_id,
      reading_order: raw.reading_order,
      tokens,
      signals: computeSignalsForBlock({ ...raw, normalized_text }),
      style: raw.style,
    };
  });
}

/**
 * @param {import('./block-contract.js').NormalizedBlock[]} normalized
 * @param {object} [opts]
 * @returns {import('./block-contract.js').LogicalBlock[]}
 */
export function logicalBlocksFromNormalized(normalized, opts = {}) {
  const segments = opts.segments || [];
  if (segments.length) {
    return segments.map((seg, i) => {
      const memberIds = new Set(seg.block_ids || seg.source_block_ids || []);
      const lines = normalized.filter((n) => memberIds.has(n.block_id));
      const fallbackLines =
        lines.length > 0
          ? lines
          : normalized.filter((n) => seg.text && n.text && seg.text.includes(n.text));
      const text = seg.text || fallbackLines.map((l) => l.text).join('\n');
      return {
        block_id: seg.id || `logic-${i}`,
        type: seg.section || seg.type || 'unknown',
        lines: fallbackLines,
        text,
        page_number: seg.page_number || fallbackLines[0]?.page_number || 1,
        column_id: seg.column_id || fallbackLines[0]?.column_id,
        zone_id: seg.zone_id || fallbackLines[0]?.zone_id,
        reading_order: seg.reading_order ?? i,
        confidence: seg.confidence ?? 75,
      };
    });
  }

  return normalized.map((n, i) => ({
    block_id: n.block_id,
    type: inferLogicalType(n),
    lines: [n],
    text: n.text,
    page_number: n.page_number,
    column_id: n.column_id,
    zone_id: n.zone_id,
    reading_order: n.reading_order ?? i,
    confidence: 70,
  }));
}

/**
 * @param {import('./block-contract.js').NormalizedBlock} block
 */
function inferLogicalType(block) {
  const s = block.signals || {};
  if (s.looks_like_email || s.looks_like_phone) return 'contact';
  if (s.looks_like_date && s.looks_like_company) return 'experience_candidate';
  if (s.looks_like_date && !s.looks_like_company) return 'education_candidate';
  if (s.looks_like_job_title) return 'experience_candidate';
  if (s.looks_like_heading) return 'heading';
  return 'unknown';
}

/**
 * @param {import('./block-contract.js').LogicalBlock[]} logical
 * @param {object} [opts]
 * @returns {import('./block-contract.js').SectionBlock[]}
 */
export function sectionBlocksFromLogical(logical, opts = {}) {
  const bySection = new Map();

  for (const lb of logical || []) {
    const sectionId =
      opts.sectionMap?.[lb.type] ||
      cvSectionToSectionId(lb.type) ||
      lb.type ||
      'OTHER';
    if (!bySection.has(sectionId)) bySection.set(sectionId, []);
    bySection.get(sectionId).push(lb);
  }

  /** @type {import('./block-contract.js').SectionBlock[]} */
  const out = [];
  let order = 0;
  for (const [section_id, blocks] of bySection) {
    const source_block_ids = blocks.flatMap((b) =>
      (b.lines || []).map((l) => l.block_id).filter(Boolean)
    );
    out.push({
      section_id,
      block_id: `sec-${section_id}-${order}`,
      blocks,
      source_block_ids,
      page_number: blocks[0]?.page_number || 1,
      column_id: blocks[0]?.column_id,
      zone_id: blocks[0]?.zone_id,
      reading_order: order++,
      text: blocks.map((b) => b.text).join('\n'),
    });
  }
  return out;
}

/**
 * @param {import('../layout/spatial-block.js').SpatialBlock[]} spatialBlocks
 * @returns {import('./block-contract.js').NormalizedBlock[]}
 */
export function normalizedBlocksFromSpatial(spatialBlocks) {
  return normalizeRawBlocks(rawBlocksFromSpatialBlocks(spatialBlocks));
}
