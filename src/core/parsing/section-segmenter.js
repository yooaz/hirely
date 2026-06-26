/**
 * Layout-aware CV section segmentation — assigns spatial blocks to canonical sections.
 *
 * Hybrid signals: heading dictionary, typography, block position, zone/column context.
 * Propagation: content inherits active section per zone until next heading.
 */

import { hirelyDebugLog } from '../runtime/hirely-debug.js';
import { classifyDocumentPageLayouts, lineReadingZone } from '../layout/page-layout.js';
import { buildLayoutMemory } from '../layout/layout-memory.js';
import { spatialBlocksFromLayoutMemory, SPATIAL_ZONE_ID } from '../layout/spatial-block.js';
import {
  runResumeLayoutAnalysis,
  assignZonesToSpatialBlocks,
} from '../layout/resume-layout-engine.js';
import {
  CV_SECTION,
  matchSectionHeading,
  scoreTypographyHeading,
  fuzzyKeyToCvSection,
} from './section-heading-dictionary.js';
import { scoreSectionHeader } from './section-fuzzy.js';

export const SECTION_SEGMENTER_VERSION = '1';
export const SECTION_SEGMENTER_ENGINE = 'LAYOUT_AWARE_SECTION_SEGMENTER_V1';

export { CV_SECTION };

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_RE = /(?:\+?\d[\d\s().-]{7,}\d)/;
const URL_RE = /https?:\/\/|www\./i;

/**
 * @typedef {object} SegmentedBlock
 * @property {string} block_id
 * @property {number} page_number
 * @property {number} reading_order
 * @property {string} zone_id
 * @property {string} column_id
 * @property {string} text
 * @property {string} section
 * @property {number} confidence
 * @property {string} reason
 * @property {boolean} is_heading
 * @property {string|null} heading_matched
 */

/**
 * @param {import('../layout/spatial-block.js').SpatialBlock[]} blocks
 */
function medianLineHeight(blocks) {
  const heights = (blocks || [])
    .map((b) => Number(b.bbox?.height))
    .filter((h) => Number.isFinite(h) && h > 0)
    .sort((a, b) => a - b);
  if (!heights.length) return 14;
  return heights[Math.floor(heights.length / 2)];
}

/**
 * @param {string} zoneId
 */
function zoneStreamKey(zoneId) {
  if (zoneId === SPATIAL_ZONE_ID.SIDEBAR) return 'sidebar';
  if (zoneId === SPATIAL_ZONE_ID.MAIN) return 'main';
  if (zoneId === SPATIAL_ZONE_ID.LEFT_COLUMN) return 'left_column';
  if (zoneId === SPATIAL_ZONE_ID.RIGHT_COLUMN) return 'right_column';
  if (zoneId === SPATIAL_ZONE_ID.HEADER) return 'header';
  if (zoneId === SPATIAL_ZONE_ID.FOOTER) return 'footer';
  return 'full';
}

/**
 * @param {string} zone — lineReadingZone role or spatial zone id
 */
function readingZoneToSpatialId(zone) {
  if (zone === 'sidebar' || zone === SPATIAL_ZONE_ID.SIDEBAR) return SPATIAL_ZONE_ID.SIDEBAR;
  if (zone === 'main' || zone === SPATIAL_ZONE_ID.MAIN) return SPATIAL_ZONE_ID.MAIN;
  if (zone === 'left_column' || zone === SPATIAL_ZONE_ID.LEFT_COLUMN) return SPATIAL_ZONE_ID.LEFT_COLUMN;
  if (zone === 'right_column' || zone === SPATIAL_ZONE_ID.RIGHT_COLUMN) return SPATIAL_ZONE_ID.RIGHT_COLUMN;
  if (zone === SPATIAL_ZONE_ID.HEADER) return SPATIAL_ZONE_ID.HEADER;
  if (zone === SPATIAL_ZONE_ID.FOOTER) return SPATIAL_ZONE_ID.FOOTER;
  return zone || SPATIAL_ZONE_ID.FULL;
}

/**
 * Vertical whitespace gap before block (PDF y-up coords).
 * @param {import('../layout/spatial-block.js').SpatialBlock} block
 * @param {import('../layout/spatial-block.js').SpatialBlock|null} prev
 */
function verticalGapBefore(block, prev) {
  if (!prev?.bbox || !block?.bbox) return 0;
  const prevY = Number(prev.bbox.y);
  const curY = Number(block.bbox.y);
  const prevH = Number(prev.bbox.height) || 14;
  if (!Number.isFinite(prevY) || !Number.isFinite(curY)) return 0;
  return Math.abs(prevY - curY) - prevH;
}

/**
 * @param {import('../layout/spatial-block.js').SpatialBlock} block
 * @param {object} pageLayout
 */
function resolveBlockZone(block, pageLayout) {
  if (block.zone_id && block.zone_id !== SPATIAL_ZONE_ID.FULL) {
    return readingZoneToSpatialId(block.zone_id);
  }
  if (pageLayout && Number.isFinite(block.bbox?.x)) {
    const role = lineReadingZone(pageLayout, {
      x: block.bbox.x,
      y: block.bbox.y,
      width: block.bbox.width,
      height: block.bbox.height,
      text: block.text,
      cleanedText: block.text,
    });
    return readingZoneToSpatialId(role);
  }
  return readingZoneToSpatialId(block.zone_id || SPATIAL_ZONE_ID.FULL);
}

/**
 * @param {string} text
 */
function detectContactSignal(text) {
  const t = String(text || '').trim();
  if (!t) return false;
  if (EMAIL_RE.test(t) || PHONE_RE.test(t) || URL_RE.test(t)) return true;
  if (/\b\d{1,4}\s+[A-Za-zÀ-ÿ].{4,}(?:street|st|avenue|ave|boulevard|bd|rue|paris|lyon)\b/i.test(t)) {
    return true;
  }
  if (/\b\d{5}\b/.test(t) && /\b(?:paris|lyon|france|cedex)\b/i.test(t)) return true;
  return false;
}

/**
 * @param {import('../layout/spatial-block.js').SpatialBlock} block
 * @param {object} ctx
 */
function detectHeading(block, ctx) {
  const text = String(block.text || '').trim();
  const zoneRole = ctx.zoneRole;
  const gapBoost =
    ctx.gapBefore >= ctx.medianLineHeight * 1.35 ? 0.08 : 0;

  const dict = matchSectionHeading(text);
  if (dict) {
    return {
      is_heading: true,
      section: dict.section,
      confidence: Math.min(0.99, dict.confidence + gapBoost),
      reason: gapBoost > 0 ? 'heading_dictionary_exact+spacing' : dict.rule,
      heading_matched: dict.matched,
    };
  }

  const fuzzy = scoreSectionHeader(text);
  if (fuzzy && fuzzy.confidence >= 85) {
    return {
      is_heading: true,
      section: fuzzyKeyToCvSection(fuzzy.key),
      confidence: fuzzy.confidence / 100,
      reason: `fuzzy_${fuzzy.matchType}`,
      heading_matched: fuzzy.key,
    };
  }

  const typo = scoreTypographyHeading(text, {
    bbox: block.bbox,
    medianLineHeight: ctx.medianLineHeight,
    zoneRole,
    gapBefore: ctx.gapBefore,
  });
  const typoDict = matchSectionHeading(text, { typographyOnly: true, typographyThreshold: 0.55 });
  if (typoDict && typo.score >= 0.45) {
    return {
      is_heading: true,
      section: typoDict.section,
      confidence: Math.min(0.72, typo.score * 0.85),
      reason: 'typography_heading',
      heading_matched: text,
    };
  }

  if (typo.score >= 0.72 && text.length <= 28 && !detectContactSignal(text)) {
    const retry = matchSectionHeading(text.toLowerCase());
    if (retry) {
      return {
        is_heading: true,
        section: retry.section,
        confidence: 0.7,
        reason: 'typography_plus_dictionary',
        heading_matched: retry.matched,
      };
    }
  }

  return null;
}

/**
 * Infer section for preamble lines (sidebar top contact strip).
 * @param {import('../layout/spatial-block.js').SpatialBlock} block
 * @param {object} ctx
 */
function inferPreambleSection(block, ctx) {
  const text = String(block.text || '').trim();
  const stream = ctx.streamKey;

  if (detectContactSignal(text)) {
    return {
      section: CV_SECTION.CONTACT,
      confidence: 0.88,
      reason: 'contact_signal',
    };
  }

  if (stream === 'sidebar' && ctx.blockIndexInStream < 2 && text.length < 48) {
    if (/designer|illustrator|developer|manager|engineer|director|consultant/i.test(text)) {
      return { section: CV_SECTION.OTHER, confidence: 0.55, reason: 'sidebar_title_line' };
    }
    if (/^[A-ZÀ-Ö][a-zà-ö]+(?:\s+[A-ZÀ-Ö][a-zà-ö'-]+){0,3}$/.test(text)) {
      return { section: CV_SECTION.OTHER, confidence: 0.5, reason: 'sidebar_name_line' };
    }
  }

  return null;
}

/**
 * @param {import('../layout/spatial-block.js').SpatialBlock[]} blocks
 * @param {object} [opts]
 * @returns {{
 *   segments: SegmentedBlock[],
 *   headings: SegmentedBlock[],
 *   sectionMap: object,
 *   stats: Record<string, number>,
 * }}
 */
export function segmentCvBlocks(blocks, opts = {}) {
  const input = [...(blocks || [])].sort(
    (a, b) =>
      (a.page_number - b.page_number) ||
      (a.reading_order ?? 0) - (b.reading_order ?? 0)
  );

  const pageLayoutResult =
    opts.pageLayouts ||
    (input.length ? classifyDocumentPageLayouts(input.map(spatialBlockToLine)) : null);
  const pageLayouts = Array.isArray(pageLayoutResult)
    ? pageLayoutResult
    : pageLayoutResult?.pages || [];

  const layoutByPage = new Map(pageLayouts.map((p) => [p.page, p]));
  const medianH = medianLineHeight(input);

  /** @type {Map<string, string>} */
  const activeByStream = new Map();
  /** @type {Map<string, number>} */
  const activeConfidenceByStream = new Map();
  /** @type {Map<string, number>} */
  const streamBlockIndex = new Map();
  /** @type {Map<string, import('../layout/spatial-block.js').SpatialBlock|null>} */
  const prevBlockByStream = new Map();

  /** @type {SegmentedBlock[]} */
  const segments = [];
  /** @type {SegmentedBlock[]} */
  const headings = [];

  const stats = {
    blockCount: input.length,
    headingCount: 0,
    propagated: 0,
    contactSignals: 0,
    isolatedOther: 0,
    bySection: {},
  };

  for (const block of input) {
    const page = block.page_number || 1;
    const pageLayout = layoutByPage.get(page) || null;
    const zoneId = resolveBlockZone(block, pageLayout);
    const streamKey = zoneStreamKey(zoneId);
    const streamIdx = streamBlockIndex.get(streamKey) ?? 0;
    streamBlockIndex.set(streamKey, streamIdx + 1);
    const prevInStream = prevBlockByStream.get(streamKey) || null;
    const gapBefore = verticalGapBefore(block, prevInStream);
    prevBlockByStream.set(streamKey, block);

    const ctx = {
      pageLayout,
      zoneRole: zoneId === SPATIAL_ZONE_ID.SIDEBAR ? 'sidebar' : zoneId === SPATIAL_ZONE_ID.MAIN ? 'main' : zoneId,
      medianLineHeight: medianH,
      streamKey,
      blockIndexInStream: streamIdx,
      gapBefore,
    };

    const heading = detectHeading(block, ctx);
    let section = CV_SECTION.OTHER;
    let confidence = 0.45;
    let reason = 'default_other';
    let is_heading = false;
    let heading_matched = null;

    if (heading) {
      is_heading = true;
      section = heading.section;
      confidence = heading.confidence;
      reason = heading.reason;
      heading_matched = heading.heading_matched;
      activeByStream.set(streamKey, section);
      activeConfidenceByStream.set(streamKey, confidence);
      stats.headingCount += 1;
    } else {
      const preamble = !activeByStream.has(streamKey)
        ? inferPreambleSection(block, ctx)
        : null;
      if (preamble) {
        section = preamble.section;
        confidence = preamble.confidence;
        reason = preamble.reason;
        if (section === CV_SECTION.CONTACT) stats.contactSignals += 1;
        if (streamIdx <= 2 && section === CV_SECTION.CONTACT) {
          activeByStream.set(streamKey, CV_SECTION.CONTACT);
          activeConfidenceByStream.set(streamKey, confidence);
        }
      } else if (activeByStream.has(streamKey)) {
        section = activeByStream.get(streamKey);
        const headingConf = activeConfidenceByStream.get(streamKey) ?? 0.82;
        confidence = Math.min(0.9, Math.max(0.72, headingConf * 0.92));
        reason = 'zone_propagation';
        stats.propagated += 1;
      } else {
        section = CV_SECTION.OTHER;
        confidence = 0.38;
        reason = 'isolated_unknown';
        stats.isolatedOther += 1;
      }
    }

    const seg = {
      block_id: block.block_id,
      page_number: page,
      reading_order: block.reading_order ?? 0,
      zone_id: zoneId,
      column_id: block.column_id,
      text: block.text,
      section,
      confidence,
      reason,
      is_heading,
      heading_matched,
    };
    segments.push(seg);
    if (is_heading) headings.push(seg);
    stats.bySection[section] = (stats.bySection[section] || 0) + 1;
  }

  const sectionMap = buildSectionMapDebug(segments, pageLayouts, {
    activeByStream: Object.fromEntries(activeByStream),
    engine: SECTION_SEGMENTER_ENGINE,
    version: SECTION_SEGMENTER_VERSION,
  });

  hirelyDebugLog('SECTION_SEGMENTER', {
    engine: SECTION_SEGMENTER_ENGINE,
    version: SECTION_SEGMENTER_VERSION,
    blockCount: stats.blockCount,
    headingCount: stats.headingCount,
    isolatedOther: stats.isolatedOther,
    bySection: stats.bySection,
    pages: Object.keys(sectionMap.pages || {}),
  });

  if (typeof globalThis !== 'undefined') {
    globalThis.__HIRELY_SECTION_SEGMENTATION = { segments, sectionMap, stats };
  }

  return { segments, headings, sectionMap, stats };
}

/**
 * @param {import('../layout/spatial-block.js').SpatialBlock} block
 */
function spatialBlockToLine(block) {
  return {
    text: block.text,
    cleanedText: block.text,
    page: block.page_number,
    x: block.bbox?.x,
    y: block.bbox?.y,
    width: block.bbox?.width,
    height: block.bbox?.height,
    line: block.reading_order,
  };
}

/**
 * @param {SegmentedBlock[]} segments
 * @param {object[]} pageLayouts
 * @param {object} [meta]
 */
export function buildSectionMapDebug(segments, pageLayouts = [], meta = {}) {
  /** @type {Record<number, object>} */
  const pages = {};
  /** @type {Array<{ stream: string, section: string, text: string, confidence: number }>} */
  const headingTimeline = [];

  for (const seg of segments || []) {
    const page = seg.page_number || 1;
    if (!pages[page]) {
      const layout = pageLayouts.find((p) => p.page === page) || null;
      pages[page] = {
        page,
        layout_type: layout?.layout_type || null,
        zones: {},
      };
    }
    const stream = zoneStreamKey(seg.zone_id);
    if (!pages[page].zones[stream]) {
      pages[page].zones[stream] = {
        sections: {},
        headings: [],
        block_count: 0,
        propagation_chain: [],
      };
    }
    const zone = pages[page].zones[stream];
    zone.block_count += 1;
    if (!zone.sections[seg.section]) zone.sections[seg.section] = [];
    zone.sections[seg.section].push({
      block_id: seg.block_id,
      text: seg.text.slice(0, 120),
      is_heading: seg.is_heading,
      confidence: seg.confidence,
      reason: seg.reason,
    });
    if (seg.is_heading) {
      zone.headings.push({
        section: seg.section,
        text: seg.text,
        confidence: seg.confidence,
        reason: seg.reason,
      });
      zone.propagation_chain.push(seg.section);
      headingTimeline.push({
        stream: `${page}:${stream}`,
        section: seg.section,
        text: seg.text,
        confidence: seg.confidence,
      });
    }
  }

  return {
    version: SECTION_SEGMENTER_VERSION,
    engine: SECTION_SEGMENTER_ENGINE,
    pages,
    heading_timeline: headingTimeline,
    active_streams: meta.activeByStream || null,
    generated_at: new Date().toISOString(),
  };
}

/**
 * Build spatial blocks from lines and segment.
 * @param {import('../extraction/extracted-line.js').ExtractedLine[]} lines
 * @param {object} [opts]
 */
export function segmentCvLines(lines, opts = {}) {
  const layoutMemory = buildLayoutMemory(lines, {
    layout: opts.layout,
    orderedLines: opts.orderedLines,
    pageLayouts: opts.pageLayouts,
  });

  let pageLayouts =
    opts.pageLayouts ||
    classifyDocumentPageLayouts(lines)?.pages ||
    [];

  const resumeLayoutStage =
    opts.resumeLayoutStage ||
    (lines.length
      ? runResumeLayoutAnalysis({ lines, spatialBlocks: opts.spatialBlocks }, opts)
      : null);

  if (resumeLayoutStage?.pages?.length) {
    pageLayouts = resumeLayoutStage.pages;
  }

  let spatialBlocks = opts.spatialBlocks?.length
    ? opts.spatialBlocks
    : spatialBlocksFromLayoutMemory(layoutMemory, { pageLayouts });

  if (resumeLayoutStage?.pages?.length && spatialBlocks.length) {
    spatialBlocks = assignZonesToSpatialBlocks(spatialBlocks, resumeLayoutStage);
  }

  return segmentCvBlocks(spatialBlocks, {
    ...opts,
    pageLayouts,
    layoutMemory,
    resumeLayoutStage,
  });
}

/**
 * @param {SegmentedBlock[]} segments
 * @param {string} section
 */
export function segmentsInSection(segments, section) {
  return (segments || []).filter((s) => s.section === section && !s.is_heading);
}

/**
 * @param {SegmentedBlock[]} segments
 * @param {number} page
 */
export function sectionTextsOnPage(segments, page, section) {
  return segmentsInSection(segments, section)
    .filter((s) => s.page_number === page)
    .map((s) => s.text);
}
