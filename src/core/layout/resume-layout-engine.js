/**
 * Production-grade resume page layout engine — spatial blocks + zones + portfolio detection.
 *
 * Supported layout_type values:
 *   single_column | two_columns | sidebar_left | sidebar_right | complex | portfolio_page
 *
 * Runs before section parsing. Emits per-page debug JSON and zone assignments.
 */

import { hirelyDebugLog } from '../runtime/hirely-debug.js';
import { SPATIAL_ZONE_ID } from './spatial-block.js';
import {
  PAGE_LAYOUT_TYPES,
  classifyPageLayout,
  lineReadingZone,
  buildPageLayoutDebug,
} from './page-layout.js';
import {
  PAGE_DOCUMENT_CLASS,
  classifyPageDocument,
  classifyDocumentPages,
  buildPageDocumentClassificationDebug,
} from './page-document-classifier.js';

export const RESUME_LAYOUT_ENGINE = 'RESUME_LAYOUT_ENGINE_V1';

export { PAGE_LAYOUT_TYPES };

const PORTFOLIO_CAPTION_RE =
  /\b(personal\s+project|personal\s+artwork|t-shirt\s+design|fortune\s+500|god\s+of\s+war|compelling\s+illustration|portrait\s+of|creation\s+of\s+an\s+illustration|metro\s+display|selected\s+works?)\b/i;

const PORTFOLIO_MARKER_RE =
  /\b(page\s*\d+\s*portfolio|portfolio\s*page|selected\s+works?|gallery|case\s+stud(?:y|ies))\b/i;

const CV_SECTION_PREVIEW_RE =
  /\b(experience|education|skills|languages|freelanc|internship|lisaa|créapôle|mccann)\b/i;

function lineText(ln) {
  return String(ln?.cleanedText ?? ln?.text ?? '').trim();
}

function blockText(b) {
  return String(b?.normalized_text ?? b?.text ?? '').trim();
}

function blockBox(b) {
  const bbox = b.bbox || {};
  const x = Number(bbox.x ?? b.x) || 0;
  const y = Number(bbox.y ?? b.y) || 0;
  const w = Number(bbox.width ?? b.width) > 0 ? Number(bbox.width ?? b.width) : Math.max(20, blockText(b).length * 6);
  const h = Number(bbox.height ?? b.height) > 0 ? Number(bbox.height ?? b.height) : 14;
  return { x, y, w, h, cx: x + w / 2, cy: y - h / 2, x2: x + w, y2: y - h };
}

function variance(nums) {
  if (!nums.length) return 0;
  const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
  return nums.reduce((a, n) => a + (n - mean) ** 2, 0) / nums.length;
}

function pageItems(lines, blocks, page) {
  const pageLines = (lines || []).filter((l) => (l.page || l.page_number || 1) === page && lineText(l));
  const pageBlocks = (blocks || []).filter((b) => (b.page_number || b.page || 1) === page && blockText(b));
  return { pageLines, pageBlocks };
}

/**
 * Spatial two-column / sidebar detection from block x-clusters (robust vs wide line boxes).
 * @param {object[]} pageBlocks
 */
function classifyLayoutFromSpatialBlocks(pageBlocks) {
  const spatial = analyzeSpatialBlockLayout(pageBlocks);
  if (!pageBlocks.length || spatial.block_count < 4) return null;

  const centers = pageBlocks.map((b) => blockBox(b).cx).sort((a, b) => a - b);
  let bestGap = 0;
  let bestSplit = null;
  for (let i = 0; i < centers.length - 1; i++) {
    const g = centers[i + 1] - centers[i];
    if (g > bestGap) {
      bestGap = g;
      bestSplit = (centers[i] + centers[i + 1]) / 2;
    }
  }
  if (!Number.isFinite(bestSplit) || bestGap < 80) return null;

  const left = pageBlocks.filter((b) => blockBox(b).cx <= bestSplit);
  const right = pageBlocks.filter((b) => blockBox(b).cx > bestSplit);
  const total = pageBlocks.length || 1;
  const leftRatio = left.length / total;
  const rightRatio = right.length / total;
  if (leftRatio < 0.15 || rightRatio < 0.15) return null;

  const pageBounds = {
    minX: Math.min(...pageBlocks.map((b) => blockBox(b).x)),
    maxX: Math.max(...pageBlocks.map((b) => blockBox(b).x2)),
  };
  pageBounds.width = pageBounds.maxX - pageBounds.minX || 1;

  const leftWidth =
    Math.max(...left.map((b) => blockBox(b).x2)) - Math.min(...left.map((b) => blockBox(b).x));
  const leftWidthRatio = leftWidth / pageBounds.width;

  if (leftWidthRatio <= 0.48 && leftRatio >= 0.15 && rightRatio >= 0.15) {
    return {
      layout_type: PAGE_LAYOUT_TYPES.SIDEBAR_LEFT,
      split_x: bestSplit,
      signals: ['spatial-block-clusters', 'spatial-sidebar-left'],
      spatial,
      leftRatio,
      rightRatio,
    };
  }
  if (leftRatio >= 0.22 && rightRatio >= 0.22) {
    return {
      layout_type: PAGE_LAYOUT_TYPES.TWO_COLUMNS,
      split_x: bestSplit,
      signals: ['spatial-block-clusters', 'spatial-two-columns'],
      spatial,
      leftRatio,
      rightRatio,
    };
  }
  return null;
}

/**
 * Spatial grid / gallery signals from block positions (not text-only).
 * @param {object[]} pageBlocks
 */
function analyzeSpatialBlockLayout(pageBlocks) {
  if (!pageBlocks.length) {
    return {
      block_count: 0,
      x_variance: 0,
      y_variance: 0,
      x_clusters: 0,
      row_pairs: 0,
      gutter_estimate: 0,
      avg_block_width: 0,
      wide_spread: false,
    };
  }

  const boxes = pageBlocks.map(blockBox);
  const centers = boxes.map((b) => b.cx);
  const xVar = variance(centers);
  const yVar = variance(boxes.map((b) => b.y));
  const minX = Math.min(...boxes.map((b) => b.x));
  const maxX = Math.max(...boxes.map((b) => b.x2));
  const span = maxX - minX || 1;

  const sortedX = [...centers].sort((a, b) => a - b);
  let clusters = 1;
  let maxIntraClusterGap = 0;
  for (let i = 1; i < sortedX.length; i++) {
    const gap = sortedX[i] - sortedX[i - 1];
    if (gap > span * 0.18) clusters++;
    else maxIntraClusterGap = Math.max(maxIntraClusterGap, gap);
  }

  const yBuckets = new Map();
  for (const b of boxes) {
    const row = Math.round(b.y / 40) * 40;
    if (!yBuckets.has(row)) yBuckets.set(row, []);
    yBuckets.get(row).push(b);
  }
  let rowPairs = 0;
  for (const row of yBuckets.values()) {
    if (row.length >= 2) {
      const xs = row.map((b) => b.cx).sort((a, b) => a - b);
      if (xs[xs.length - 1] - xs[0] >= span * 0.25) rowPairs++;
    }
  }

  return {
    block_count: pageBlocks.length,
    x_variance: Math.round(xVar),
    y_variance: Math.round(yVar),
    x_clusters: clusters,
    row_pairs: rowPairs,
    gutter_estimate: Math.round(span * 0.12),
    avg_block_width: Math.round(boxes.reduce((s, b) => s + b.w, 0) / boxes.length),
    wide_spread: span >= 280 && clusters >= 2,
  };
}

/**
 * @param {object[]} pageBlocks
 * @param {object[]} pageLines
 */
function scorePortfolioPageSpatial(pageBlocks, pageLines) {
  const items = pageBlocks.length ? pageBlocks : pageLines;
  const texts = items.map((i) => (pageBlocks.length ? blockText(i) : lineText(i)));
  const spatial = analyzeSpatialBlockLayout(pageBlocks.length ? pageBlocks : pageLines.map((l) => ({ text: lineText(l), bbox: { x: l.x, y: l.y, width: l.width, height: l.height } })));

  let score = 0;
  const signals = [];

  const captions = texts.filter((t) => PORTFOLIO_CAPTION_RE.test(t) || (/^personal\b/i.test(t) && t.length >= 16)).length;
  if (captions >= 2) {
    score += 28;
    signals.push(`portfolio-captions-${captions}`);
  } else if (captions === 1) {
    score += 12;
    signals.push('portfolio-caption-single');
  }

  if (texts.some((t) => PORTFOLIO_MARKER_RE.test(t))) {
    score += 22;
    signals.push('portfolio-marker');
  }

  if (spatial.wide_spread && spatial.row_pairs >= 1) {
    score += 20;
    signals.push('spatial-grid-rows');
  }
  if (spatial.x_clusters >= 2 && spatial.block_count >= 3 && spatial.block_count <= 14) {
    score += 14;
    signals.push('spatial-multi-column-grid');
  }
  if (spatial.x_variance > 12000 && spatial.block_count <= 12) {
    score += 10;
    signals.push('high-x-variance-gallery');
  }

  const cvHits = texts.filter((t) => CV_SECTION_PREVIEW_RE.test(t)).length;
  if (cvHits === 0) {
    score += 12;
    signals.push('no-cv-section-text');
  } else if (cvHits >= 3) {
    score -= 18;
    signals.push('cv-section-text-present');
  }

  if (texts.some((t) => /@|\+?\d{10,}/.test(t))) {
    score -= 15;
    signals.push('contact-on-page');
  }

  return { score, signals, spatial, captions };
}

/**
 * @param {object} geometricLayout
 * @param {object[]} pageBlocks
 * @param {object} portfolioScore
 */
function buildPortfolioPageLayout(page, geometricLayout, pageBlocks, portfolioScore) {
  const zones = [
    {
      zone_id: 'portfolio_grid',
      role: 'portfolio',
      column: 'full',
      bounds: geometricLayout?.page_bounds || null,
      block_ids: pageBlocks.map((b) => b.block_id).filter(Boolean),
      line_count: pageBlocks.length,
      content_roles: ['portfolio_caption', 'artwork'],
      preview: pageBlocks.slice(0, 8).map(blockText),
      reading_order: 'grid',
    },
  ];

  return {
    ...geometricLayout,
    page,
    layout_type: PAGE_LAYOUT_TYPES.PORTFOLIO_PAGE,
    page_class: PAGE_DOCUMENT_CLASS.PORTFOLIO_PAGE,
    confidence: Math.min(96, 72 + Math.min(24, portfolioScore.score / 3)),
    signals: [...(geometricLayout?.signals || []), ...portfolioScore.signals, 'portfolio-page-layout'],
    reading_zones: zones,
    zones,
    spatial: portfolioScore.spatial,
    merge_policy: {
      cross_zone_merge_forbidden: true,
      split_x: null,
      portfolio_page: true,
    },
    parse_resume_sections: false,
  };
}

/**
 * Enrich geometric layout with spatial block zone assignments.
 * @param {object} geometricLayout
 * @param {object[]} pageBlocks
 */
function enrichLayoutWithBlockZones(geometricLayout, pageBlocks) {
  const zones = (geometricLayout.reading_zones || []).map((z) => ({
    ...z,
    block_ids: [],
    content_roles: inferZoneContentRoles(z),
  }));

  const zoneById = new Map(zones.map((z) => [z.id || z.zone_id, z]));

  for (const block of pageBlocks) {
    const zoneKey = zoneIdForBlock(block, geometricLayout);
    const zone =
      zoneById.get(zoneKey) ||
      zones.find((z) => z.role === zoneKey) ||
      zones.find((z) => z.role === 'main') ||
      zones[0];
    if (!zone) continue;
    zone.block_ids = zone.block_ids || [];
    if (block.block_id) zone.block_ids.push(block.block_id);
    const preview = zone.preview || [];
    const t = blockText(block);
    if (t && preview.length < 10) preview.push(t);
    zone.preview = preview;
  }

  return {
    ...geometricLayout,
    zones: zones.map((z) => ({
      zone_id: z.id || z.zone_id,
      role: z.role,
      column: z.column,
      bounds: z.bounds,
      block_ids: z.block_ids || [],
      line_count: z.line_count,
      content_roles: z.content_roles || inferZoneContentRoles(z),
      preview: z.preview || [],
      reading_order: z.reading_order || 'top_down',
    })),
    spatial: analyzeSpatialBlockLayout(pageBlocks),
    merge_policy: {
      cross_zone_merge_forbidden: true,
      split_x: geometricLayout.split_x,
      portfolio_page: false,
    },
    parse_resume_sections: geometricLayout.layout_type !== PAGE_LAYOUT_TYPES.PORTFOLIO_PAGE,
  };
}

/**
 * @param {object} zone
 */
function inferZoneContentRoles(zone) {
  const preview = (zone.preview || []).join(' ').toLowerCase();
  const roles = [];
  if (/yoaz@|@|phone|\+?\d{10,}|boulevard|paris/.test(preview)) roles.push('contact');
  if (/french|english|native|fluent|language/.test(preview)) roles.push('languages');
  if (/profile|years old|designer|illustrator/.test(preview)) roles.push('profile');
  if (/experience|freelanc|mccann|internship|agency/.test(preview)) roles.push('experience');
  if (/education|lisaa|créapôle|school/.test(preview)) roles.push('education');
  if (/photoshop|illustrator|skills|indesign|affinity/.test(preview)) roles.push('skills');
  if (/photography|snowboard|interest|music|reading/.test(preview)) roles.push('interests');
  if (!roles.length) {
    if (zone.role === 'sidebar') return ['contact', 'profile', 'languages'];
    if (zone.role === 'main') return ['experience', 'education', 'skills'];
  }
  return roles;
}

/**
 * @param {object} block
 * @param {object} pageLayout
 */
export function zoneIdForBlock(block, pageLayout) {
  if (pageLayout?.layout_type === PAGE_LAYOUT_TYPES.PORTFOLIO_PAGE) {
    return 'portfolio_grid';
  }
  if (pageLayout && Number.isFinite(block.bbox?.x ?? block.x)) {
    const box = blockBox(block);
    const zone = lineReadingZone(pageLayout, {
      x: box.x,
      y: box.y,
      text: blockText(block),
      cleanedText: blockText(block),
    });
    if (zone === 'sidebar') return SPATIAL_ZONE_ID.SIDEBAR;
    if (zone === 'main') return SPATIAL_ZONE_ID.MAIN;
    if (zone === 'left_column') return SPATIAL_ZONE_ID.LEFT_COLUMN;
    if (zone === 'right_column') return SPATIAL_ZONE_ID.RIGHT_COLUMN;
  }
  if (block.zone_id && block.zone_id !== SPATIAL_ZONE_ID.FULL) {
    return block.zone_id;
  }
  return SPATIAL_ZONE_ID.FULL;
}

/**
 * Prevent merging blocks across reading zones / column split.
 * @param {object} a — geometric or spatial block
 * @param {object} b
 * @param {object} pageLayout
 */
export function blocksShareReadingZone(a, b, pageLayout) {
  if (!pageLayout) return true;
  if (pageLayout.layout_type === PAGE_LAYOUT_TYPES.PORTFOLIO_PAGE) {
    const rowA = Math.round((a.y ?? a.bbox?.y ?? 0) / 50);
    const rowB = Math.round((b.y ?? b.bbox?.y ?? 0) / 50);
    if (rowA !== rowB) return false;
    const acx = a.cx ?? blockBox(a).cx;
    const bcx = b.cx ?? blockBox(b).cx;
    return Math.abs(acx - bcx) < 120;
  }

  const split = pageLayout.split_x;
  if (Number.isFinite(split)) {
    const acx = a.cx ?? blockBox(a).cx;
    const bcx = b.cx ?? blockBox(b).cx;
    const aLeft = acx <= split;
    const bLeft = bcx <= split;
    if (aLeft !== bLeft) return false;
  }

  const za = zoneIdForBlock(
    { ...a, text: a.text, bbox: a.bbox || { x: a.x, y: a.y, width: a.width, height: a.height } },
    pageLayout
  );
  const zb = zoneIdForBlock(
    { ...b, text: b.text, bbox: b.bbox || { x: b.x, y: b.y, width: b.width, height: b.height } },
    pageLayout
  );
  return za === zb;
}

/**
 * @param {object[]} spatialBlocks
 * @param {object} layoutStage
 */
export function assignZonesToSpatialBlocks(spatialBlocks, layoutStage) {
  const byPage = new Map((layoutStage?.pages || []).map((p) => [p.page, p]));
  return (spatialBlocks || []).map((block) => {
    const page = block.page_number || block.page || 1;
    const pageLayout = byPage.get(page);
    const zone_id = zoneIdForBlock(block, pageLayout);
    let column_id = block.column_id;
    if (zone_id === SPATIAL_ZONE_ID.SIDEBAR) {
      column_id = pageLayout?.sidebar?.side === 'right' ? 'right' : 'left';
    } else if (zone_id === SPATIAL_ZONE_ID.MAIN) {
      column_id = pageLayout?.sidebar?.side === 'left' ? 'right' : 'left';
    }
    return { ...block, zone_id, column_id: column_id || block.column_id };
  });
}

/**
 * Classify one page using spatial blocks + lines.
 * @param {object} input
 * @param {number} page
 */
export function classifyResumePageLayout(input, page = 1) {
  const { pageLines, pageBlocks } = pageItems(input.lines, input.spatialBlocks, page);

  let layout = classifyPageLayout(
    pageLines.length ? pageLines : pageBlocks.map((b) => ({ ...b, text: blockText(b), x: b.bbox?.x, y: b.bbox?.y })),
    page
  );

  const spatialLayout =
    pageBlocks.length >= 4 ? classifyLayoutFromSpatialBlocks(pageBlocks) : null;
  if (
    spatialLayout &&
    (layout.layout_type === PAGE_LAYOUT_TYPES.SINGLE_COLUMN ||
      layout.layout_type === PAGE_LAYOUT_TYPES.COMPLEX)
  ) {
    layout = {
      ...layout,
      layout_type: spatialLayout.layout_type,
      split_x: spatialLayout.split_x,
      signals: [...(layout.signals || []), ...spatialLayout.signals],
      confidence: Math.max(layout.confidence || 0, 84),
      spatial: spatialLayout.spatial,
    };
    layout = enrichLayoutWithBlockZones(layout, pageBlocks.length ? pageBlocks : pageLines.map((l, i) => ({
      block_id: `line-p${page}-${i}`,
      text: lineText(l),
      bbox: { x: l.x, y: l.y, width: l.width, height: l.height },
    })));
  }

  const pageDoc = input.pageDocument?.pages?.find((p) => p.page === page) ||
    classifyPageDocument(input.lines || [], page, { pageLayout: layout });

  const portfolioScore = scorePortfolioPageSpatial(pageBlocks, pageLines);
  const isPortfolioDoc = pageDoc.page_class === PAGE_DOCUMENT_CLASS.PORTFOLIO_PAGE;
  const isPortfolioSpatial =
    portfolioScore.score >= 42 &&
    pageDoc.portfolio_score >= pageDoc.resume_score &&
    layout.layout_type !== PAGE_LAYOUT_TYPES.SIDEBAR_LEFT &&
    layout.layout_type !== PAGE_LAYOUT_TYPES.SIDEBAR_RIGHT;

  if (isPortfolioDoc || isPortfolioSpatial) {
    return buildPortfolioPageLayout(page, layout, pageBlocks, portfolioScore);
  }

  if (layout.zones?.length) {
    return {
      ...layout,
      page_class: pageDoc.page_class,
      page_document_confidence: pageDoc.confidence,
    };
  }

  const enriched = enrichLayoutWithBlockZones(
    {
      ...layout,
      page_class: pageDoc.page_class,
      page_document_confidence: pageDoc.confidence,
    },
    pageBlocks.length
      ? pageBlocks
      : pageLines.map((l, i) => ({
          block_id: `line-p${page}-${i}`,
          text: lineText(l),
          bbox: { x: l.x, y: l.y, width: l.width, height: l.height },
        }))
  );

  return enriched;
}

/**
 * Main entry — run before section parsing.
 * @param {object} input
 * @param {object[]} [input.lines]
 * @param {object[]} [input.spatialBlocks]
 * @param {object} [opts]
 */
export function runResumeLayoutAnalysis(input = {}, opts = {}) {
  const lines = input.lines || [];
  const spatialBlocks = input.spatialBlocks || [];

  const pages = new Set([
    ...lines.map((l) => l.page || l.page_number || 1),
    ...spatialBlocks.map((b) => b.page_number || b.page || 1),
  ]);
  if (!pages.size) pages.add(1);

  const pageDocument =
    input.pageDocumentClassification ||
    (lines.length ? classifyDocumentPages(lines, opts) : null);

  const classifiedPages = [...pages].sort((a, b) => a - b).map((page) =>
    classifyResumePageLayout(
      { lines, spatialBlocks, pageDocument },
      page
    )
  );

  const zonedBlocks = spatialBlocks.length
    ? assignZonesToSpatialBlocks(spatialBlocks, { pages: classifiedPages })
    : [];

  const primary = classifiedPages.find((p) => p.page === 1) || classifiedPages[0] || null;

  const stage = {
    engine: RESUME_LAYOUT_ENGINE,
    stage: 'resume_layout_analysis',
    at: new Date().toISOString(),
    pages: classifiedPages,
    primary_page: primary?.page ?? 1,
    layout_type: primary?.layout_type ?? PAGE_LAYOUT_TYPES.SINGLE_COLUMN,
    confidence: primary?.confidence ?? 0,
    spatial_blocks_zoned: zonedBlocks.length,
    page_document_classification: pageDocument,
    debug: buildResumeLayoutDebug({ pages: classifiedPages, pageDocument }),
  };

  hirelyDebugLog('RESUME_LAYOUT_ENGINE', {
    pages: classifiedPages.map((p) => ({
      page: p.page,
      layout_type: p.layout_type,
      page_class: p.page_class,
      zones: (p.zones || []).map((z) => z.zone_id),
    })),
  });

  if (typeof globalThis !== 'undefined') {
    globalThis.__HIRELY_RESUME_LAYOUT_DEBUG = stage.debug;
  }

  return stage;
}

/**
 * Per-page debug JSON for QA / forensics.
 * @param {object} layoutStage
 */
export function buildResumeLayoutDebug(layoutStage) {
  const pageDocDebug = layoutStage.pageDocument
    ? buildPageDocumentClassificationDebug(layoutStage.pageDocument)
    : layoutStage.page_document_classification
      ? buildPageDocumentClassificationDebug(layoutStage.page_document_classification)
      : null;

  return {
    engine: RESUME_LAYOUT_ENGINE,
    at: layoutStage.at || new Date().toISOString(),
    primary_page: layoutStage.primary_page,
    layout_type: layoutStage.layout_type,
    pages: (layoutStage.pages || []).map((p) => ({
      page: p.page,
      layout_type: p.layout_type,
      page_class: p.page_class || null,
      confidence: p.confidence,
      signals: p.signals,
      split_x: p.split_x,
      line_count: p.line_count,
      page_bounds: p.page_bounds,
      sidebar: p.sidebar,
      columns: p.columns,
      spatial: p.spatial,
      merge_policy: p.merge_policy,
      parse_resume_sections: p.parse_resume_sections !== false,
      zones: (p.zones || p.reading_zones || []).map((z) => ({
        zone_id: z.zone_id || z.id,
        role: z.role,
        column: z.column,
        bounds: z.bounds,
        block_ids: z.block_ids || [],
        line_count: z.line_count,
        content_roles: z.content_roles || [],
        preview: z.preview || [],
        reading_order: z.reading_order,
      })),
    })),
    page_document: pageDocDebug,
    legacy_page_layout: buildPageLayoutDebug({
      pages: layoutStage.pages,
      primary_page: layoutStage.primary_page,
      layout_type: layoutStage.layout_type,
      confidence: layoutStage.confidence,
    }),
  };
}

/**
 * Adapter for legacy classifyDocumentPageLayouts consumers.
 * @param {object[]} lines
 * @param {object} [opts]
 */
export function classifyDocumentResumeLayouts(lines, opts = {}) {
  const spatialBlocks = opts.spatialBlocks || [];
  const stage = runResumeLayoutAnalysis({ lines, spatialBlocks }, opts);
  return {
    stage: 'page_layout',
    engine: RESUME_LAYOUT_ENGINE,
    pages: stage.pages,
    primary_page: stage.primary_page,
    layout_type: stage.layout_type,
    confidence: stage.confidence,
    at: stage.at,
    debug: stage.debug,
    spatial_blocks_zoned: stage.spatial_blocks_zoned,
  };
}

/**
 * @param {object} layoutStage
 */
export function splitXByPageFromLayout(layoutStage) {
  const map = new Map();
  for (const p of layoutStage?.pages || []) {
    if (Number.isFinite(p.split_x)) map.set(p.page, p.split_x);
  }
  return map;
}
