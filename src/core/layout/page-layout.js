/**
 * Per-page CV layout classification — coordinates, density, alignment.
 *
 * Canonical layout_type values:
 *   single_column | two_columns | sidebar_left | sidebar_right | complex
 */

import { findColumnSplitX } from './detect-columns.js';

export const PAGE_LAYOUT_TYPES = {
  SINGLE_COLUMN: 'single_column',
  TWO_COLUMNS: 'two_columns',
  SIDEBAR_LEFT: 'sidebar_left',
  SIDEBAR_RIGHT: 'sidebar_right',
  COMPLEX: 'complex',
  PORTFOLIO_PAGE: 'portfolio_page',
};

/** @deprecated legacy names — map to PAGE_LAYOUT_TYPES */
export const LEGACY_LAYOUT_MAP = {
  single_column: PAGE_LAYOUT_TYPES.SINGLE_COLUMN,
  two_column: PAGE_LAYOUT_TYPES.TWO_COLUMNS,
  double_column: PAGE_LAYOUT_TYPES.TWO_COLUMNS,
  left_sidebar: PAGE_LAYOUT_TYPES.SIDEBAR_LEFT,
  right_sidebar: PAGE_LAYOUT_TYPES.SIDEBAR_RIGHT,
  creative_portfolio: PAGE_LAYOUT_TYPES.COMPLEX,
  ats_resume: PAGE_LAYOUT_TYPES.SINGLE_COLUMN,
  unknown: PAGE_LAYOUT_TYPES.COMPLEX,
};

export const CANONICAL_TO_LEGACY = {
  [PAGE_LAYOUT_TYPES.SINGLE_COLUMN]: 'single_column',
  [PAGE_LAYOUT_TYPES.TWO_COLUMNS]: 'two_column',
  [PAGE_LAYOUT_TYPES.SIDEBAR_LEFT]: 'left_sidebar',
  [PAGE_LAYOUT_TYPES.SIDEBAR_RIGHT]: 'right_sidebar',
  [PAGE_LAYOUT_TYPES.COMPLEX]: 'unknown',
};

/**
 * @param {string} layoutType
 */
export function normalizePageLayoutType(layoutType) {
  const key = String(layoutType || '').toLowerCase();
  return LEGACY_LAYOUT_MAP[key] || key || PAGE_LAYOUT_TYPES.COMPLEX;
}

/**
 * @param {string} pageLayoutType
 */
export function toLegacyLayoutType(pageLayoutType) {
  return CANONICAL_TO_LEGACY[normalizePageLayoutType(pageLayoutType)] || 'unknown';
}

function lineText(ln) {
  return String(ln?.cleanedText ?? ln?.text ?? '').trim();
}

function positionedLines(lines, page) {
  return (lines || []).filter((l) => {
    if ((l.page || 1) !== page) return false;
    const t = lineText(l);
    return Number.isFinite(l.x) && Number.isFinite(l.y) && t.length > 1;
  });
}

function lineBox(ln) {
  const x = Number(ln.x) || 0;
  const y = Number(ln.y) || 0;
  const w =
    Number(ln.width) > 0
      ? Number(ln.width)
      : Math.max(20, Math.min(480, lineText(ln).length * 6.5));
  const h = Number(ln.height) > 0 ? Number(ln.height) : 14;
  return { x, y, w, h, x2: x + w, y2: y - h, cx: x + w / 2, cy: y - h / 2 };
}

function variance(nums) {
  if (!nums.length) return 0;
  const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
  return nums.reduce((a, n) => a + (n - mean) ** 2, 0) / nums.length;
}

function boundsFromLines(pageLines) {
  if (!pageLines.length) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0 };
  }
  const boxes = pageLines.map(lineBox);
  const minX = Math.min(...boxes.map((b) => b.x));
  const maxX = Math.max(...boxes.map((b) => b.x2));
  const maxY = Math.max(...boxes.map((b) => b.y));
  const minY = Math.min(...boxes.map((b) => b.y2));
  return {
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX || 1,
    height: maxY - minY || 1,
  };
}

function columnBounds(lines) {
  if (!lines.length) return null;
  const boxes = lines.map(lineBox);
  return {
    x: Math.min(...boxes.map((b) => b.x)),
    y: Math.max(...boxes.map((b) => b.y)),
    x2: Math.max(...boxes.map((b) => b.x2)),
    y2: Math.min(...boxes.map((b) => b.y2)),
    width: Math.max(...boxes.map((b) => b.x2)) - Math.min(...boxes.map((b) => b.x)),
    height: Math.max(...boxes.map((b) => b.y)) - Math.min(...boxes.map((b) => b.y2)),
  };
}

function histogramGaps(centers, bins = 16) {
  if (!centers.length) return { peaks: 0, maxGap: 0, splitX: null };
  const min = Math.min(...centers);
  const max = Math.max(...centers);
  const span = max - min || 1;
  const hist = new Array(bins).fill(0);
  for (const c of centers) {
    const idx = Math.min(bins - 1, Math.floor(((c - min) / span) * bins));
    hist[idx]++;
  }
  const peak = Math.max(...hist, 1);
  let peaks = 0;
  for (let i = 0; i < bins; i++) {
    if (hist[i] >= peak * 0.35) peaks++;
  }
  let maxGap = 0;
  let splitX = min + span * 0.5;
  for (let i = 0; i < bins - 1; i++) {
    const mid = min + ((i + 0.5) / bins) * span;
    const valley = Math.min(hist[i], hist[i + 1]) / peak;
    if (valley < 0.12 && hist[i] + hist[i + 1] < peak * 0.35) {
      const size = span / bins;
      if (size > maxGap) {
        maxGap = size;
        splitX = mid;
      }
    }
  }
  return { peaks, maxGap, splitX, peak, min, max, span };
}

function gapRatio(pageBounds, splitX) {
  if (!Number.isFinite(splitX) || !pageBounds?.width) return 0;
  const rel = (splitX - pageBounds.minX) / pageBounds.width;
  return Math.abs(rel - 0.5);
}

function buildReadingZones(ctx) {
  const zones = [];
  const { leftLines, rightLines, leftBounds, rightBounds, multi, isSidebarLeft } = ctx;

  if (!multi) {
    const lines = [...leftLines].sort((a, b) => b.y - a.y || a.x - b.x);
    zones.push({
      id: 'main',
      column: 'full',
      role: 'main',
      bounds: ctx.pageBounds,
      reading_order: 'top_down',
      line_count: lines.length,
      preview: lines.slice(0, 6).map(lineText),
    });
    return zones;
  }

  const leftSorted = [...leftLines].sort((a, b) => b.y - a.y || a.x - b.x);
  const rightSorted = [...rightLines].sort((a, b) => b.y - a.y || a.x - b.x);

  zones.push({
    id: isSidebarLeft ? 'sidebar' : 'left_column',
    column: 'left',
    role: isSidebarLeft ? 'sidebar' : 'column',
    bounds: leftBounds,
    reading_order: 'top_down',
    line_count: leftSorted.length,
    preview: leftSorted.slice(0, 8).map(lineText),
  });

  zones.push({
    id: isSidebarLeft ? 'main' : 'right_column',
    column: 'right',
    role: 'main',
    bounds: rightBounds,
    reading_order: 'top_down',
    line_count: rightSorted.length,
    preview: rightSorted.slice(0, 8).map(lineText),
  });

  return zones;
}

function buildPageLayoutResult(ctx) {
  const {
    page,
    layout_type,
    confidence,
    signals,
    pageBounds,
    splitX,
    leftLines,
    rightLines,
    leftWidthRatio = 0,
    rightWidthRatio = 0,
    leftXVar = 0,
    rightXVar = 0,
  } = ctx;

  const isSidebarLeft = layout_type === PAGE_LAYOUT_TYPES.SIDEBAR_LEFT;
  const isSidebarRight = layout_type === PAGE_LAYOUT_TYPES.SIDEBAR_RIGHT;
  const isComplex = layout_type === PAGE_LAYOUT_TYPES.COMPLEX;
  const multi =
    isComplex ||
    [
      PAGE_LAYOUT_TYPES.TWO_COLUMNS,
      PAGE_LAYOUT_TYPES.SIDEBAR_LEFT,
      PAGE_LAYOUT_TYPES.SIDEBAR_RIGHT,
    ].includes(layout_type);

  const leftBounds = columnBounds(leftLines);
  const rightBounds = columnBounds(rightLines);

  const columns = [];
  if (multi && leftLines.length) {
    columns.push({
      id: 'left',
      role: isSidebarLeft ? 'sidebar' : 'column',
      bounds: leftBounds,
      line_count: leftLines.length,
      density: leftLines.length / (leftLines.length + rightLines.length || 1),
      width_ratio: leftWidthRatio,
      x_variance: leftXVar,
    });
  }
  if (multi && rightLines.length) {
    columns.push({
      id: 'right',
      role: isSidebarRight ? 'sidebar' : 'main',
      bounds: rightBounds,
      line_count: rightLines.length,
      density: rightLines.length / (leftLines.length + rightLines.length || 1),
      width_ratio: rightWidthRatio,
      x_variance: rightXVar,
    });
  }
  if (!multi) {
    columns.push({
      id: 'full',
      role: 'main',
      bounds: pageBounds,
      line_count: leftLines.length,
      density: 1,
      width_ratio: 1,
      x_variance: leftXVar,
    });
  } else if (isSidebarLeft && columns[1]) {
    columns[1].role = 'main';
  } else if (isSidebarRight && columns[0]) {
    columns[0].role = 'main';
  }

  const sidebar =
    isSidebarLeft && leftBounds
      ? { side: 'left', bounds: leftBounds }
      : isSidebarRight && rightBounds
        ? { side: 'right', bounds: rightBounds }
        : null;

  const reading_zones = buildReadingZones({
    layout_type,
    leftLines,
    rightLines,
    leftBounds,
    rightBounds,
    pageBounds,
    multi,
    isSidebarLeft,
    isSidebarRight,
  });

  return {
    page,
    layout_type,
    confidence,
    signals,
    page_bounds: pageBounds,
    split_x: Number.isFinite(splitX) ? splitX : null,
    columns,
    sidebar,
    reading_zones,
    density: {
      left: leftLines.length / (leftLines.length + rightLines.length || 1),
      right: rightLines.length / (leftLines.length + rightLines.length || 1),
      gutter: multi ? gapRatio(pageBounds, splitX) : 0,
    },
    alignment: {
      left_x_variance: leftXVar,
      right_x_variance: rightXVar,
    },
    line_count: leftLines.length + rightLines.length,
  };
}

/**
 * Classify one page from positioned lines.
 * @param {object[]} lines
 * @param {number} [page]
 */
export function classifyPageLayout(lines, page = 1) {
  const pageLines = positionedLines(lines, page);
  const pageBounds = boundsFromLines(pageLines);
  const signals = [];

  if (pageLines.length < 6 || pageBounds.width < 48) {
    return buildPageLayoutResult({
      page,
      layout_type: PAGE_LAYOUT_TYPES.SINGLE_COLUMN,
      confidence: pageLines.length < 3 ? 40 : 58,
      signals: ['sparse-lines-or-narrow-span'],
      pageBounds,
      splitX: null,
      leftLines: pageLines,
      rightLines: [],
    });
  }

  const centers = pageLines.map((l) => lineBox(l).cx);
  const gapInfo = histogramGaps(centers);
  let splitX = gapInfo.splitX ?? findColumnSplitX(centers);

  let leftLines = pageLines.filter((l) => lineBox(l).cx <= splitX);
  let rightLines = pageLines.filter((l) => lineBox(l).cx > splitX);

  if ((!leftLines.length || !rightLines.length) && centers.length >= 4) {
    const sorted = [...centers].sort((a, b) => a - b);
    let bestGap = 0;
    let bestSplit = findColumnSplitX(centers);
    for (let i = 0; i < sorted.length - 1; i++) {
      const g = sorted[i + 1] - sorted[i];
      if (g > bestGap) {
        bestGap = g;
        bestSplit = (sorted[i] + sorted[i + 1]) / 2;
      }
    }
    if (bestGap > (pageBounds.width || 1) * 0.12) {
      splitX = bestSplit;
      leftLines = pageLines.filter((l) => lineBox(l).cx <= splitX);
      rightLines = pageLines.filter((l) => lineBox(l).cx > splitX);
      signals.push('split-rebalanced');
    }
  }

  let total = pageLines.length || 1;
  let leftRatio = leftLines.length / total;
  let rightRatio = rightLines.length / total;
  const xSpread = centers.length ? Math.max(...centers) - Math.min(...centers) : 0;

  if (
    (leftRatio < 0.18 || rightRatio < 0.18) &&
    centers.length >= 4 &&
    xSpread >= (pageBounds.width || 1) * 0.25
  ) {
    const sorted = [...centers].sort((a, b) => a - b);
    let bestGap = 0;
    let bestSplit = findColumnSplitX(centers);
    for (let i = 0; i < sorted.length - 1; i++) {
      const g = sorted[i + 1] - sorted[i];
      if (g > bestGap) {
        bestGap = g;
        bestSplit = (sorted[i] + sorted[i + 1]) / 2;
      }
    }
    if (bestGap > (pageBounds.width || 1) * 0.08) {
      splitX = bestSplit;
      leftLines = pageLines.filter((l) => lineBox(l).cx <= splitX);
      rightLines = pageLines.filter((l) => lineBox(l).cx > splitX);
      total = pageLines.length || 1;
      leftRatio = leftLines.length / total;
      rightRatio = rightLines.length / total;
      signals.push('split-rebalanced-imbalance');
    }
  }

  const leftBounds = columnBounds(leftLines);
  const rightBounds = columnBounds(rightLines);
  const leftWidthRatio = leftBounds ? leftBounds.width / pageBounds.width : 0;
  const rightWidthRatio = rightBounds ? rightBounds.width / pageBounds.width : 0;

  const leftXVar = variance(leftLines.map((l) => lineBox(l).x));
  const rightXVar = variance(rightLines.map((l) => lineBox(l).x));
  const leftAligned = leftXVar < pageBounds.width * 0.05;
  const rightAligned = rightXVar < pageBounds.width * 0.06;

  const gutterClear =
    gapInfo.maxGap >= pageBounds.width * 0.06 ||
    Math.abs(leftRatio - rightRatio) > 0.12 ||
    (leftLines.length >= 3 && rightLines.length >= 3) ||
    (leftLines.length >= 2 &&
      rightLines.length >= 2 &&
      xSpread >= pageBounds.width * 0.32);

  const bimodal = leftRatio >= 0.18 && rightRatio >= 0.18 && gutterClear;

  if (!bimodal) {
    if (gapInfo.peaks >= 4 && pageLines.length >= 12) {
      signals.push('irregular-x-density');
      return buildPageLayoutResult({
        page,
        layout_type: PAGE_LAYOUT_TYPES.COMPLEX,
        confidence: 62,
        signals,
        pageBounds,
        splitX,
        leftLines,
        rightLines,
        leftWidthRatio,
        rightWidthRatio,
        leftXVar,
        rightXVar,
      });
    }
    signals.push('single-cluster');
    return buildPageLayoutResult({
      page,
      layout_type: PAGE_LAYOUT_TYPES.SINGLE_COLUMN,
      confidence: 76,
      signals,
      pageBounds,
      splitX: null,
      leftLines: pageLines,
      rightLines: [],
      leftWidthRatio: 1,
      rightWidthRatio: 0,
      leftXVar,
      rightXVar,
    });
  }

  signals.push('column-gutter', `left-${Math.round(leftRatio * 100)}%`, `right-${Math.round(rightRatio * 100)}%`);

  const sidebarMaxWidth = 0.48;
  const sidebarMinDensity = 0.18;

  if (
    leftWidthRatio <= sidebarMaxWidth &&
    leftRatio >= sidebarMinDensity &&
    rightRatio >= sidebarMinDensity &&
    leftAligned
  ) {
    signals.push('narrow-left-column', 'left-x-aligned');
    return buildPageLayoutResult({
      page,
      layout_type: PAGE_LAYOUT_TYPES.SIDEBAR_LEFT,
      confidence: Math.min(96, 78 + Math.round((sidebarMaxWidth - leftWidthRatio) * 40)),
      signals,
      pageBounds,
      splitX,
      leftLines,
      rightLines,
      leftWidthRatio,
      rightWidthRatio,
      leftXVar,
      rightXVar,
    });
  }

  if (
    rightWidthRatio <= sidebarMaxWidth &&
    leftRatio >= sidebarMinDensity &&
    rightRatio >= sidebarMinDensity &&
    rightAligned
  ) {
    signals.push('narrow-right-column', 'right-x-aligned');
    return buildPageLayoutResult({
      page,
      layout_type: PAGE_LAYOUT_TYPES.SIDEBAR_RIGHT,
      confidence: Math.min(94, 76 + Math.round((sidebarMaxWidth - rightWidthRatio) * 38)),
      signals,
      pageBounds,
      splitX,
      leftLines,
      rightLines,
      leftWidthRatio,
      rightWidthRatio,
      leftXVar,
      rightXVar,
    });
  }

  signals.push('balanced-columns');
  return buildPageLayoutResult({
    page,
    layout_type: PAGE_LAYOUT_TYPES.TWO_COLUMNS,
    confidence: 84,
    signals,
    pageBounds,
    splitX,
    leftLines,
    rightLines,
    leftWidthRatio,
    rightWidthRatio,
    leftXVar,
    rightXVar,
  });
}

/**
 * @param {object[]} lines
 */
export function classifyDocumentPageLayouts(lines) {
  const pages = new Set((lines || []).map((l) => l.page || 1));
  if (!pages.size) pages.add(1);
  const pageLayouts = [...pages].sort((a, b) => a - b).map((p) => classifyPageLayout(lines, p));
  const primary = pageLayouts.find((p) => p.page === 1) || pageLayouts[0] || null;

  return {
    stage: 'page_layout',
    pages: pageLayouts,
    primary_page: primary?.page ?? 1,
    layout_type: primary?.layout_type ?? PAGE_LAYOUT_TYPES.SINGLE_COLUMN,
    confidence: primary?.confidence ?? 0,
    at: new Date().toISOString(),
  };
}

/**
 * @param {object} pageLayoutStage
 */
export function buildPageLayoutDebug(pageLayoutStage) {
  return {
    at: pageLayoutStage.at || new Date().toISOString(),
    primary_page: pageLayoutStage.primary_page,
    layout_type: pageLayoutStage.layout_type,
    confidence: pageLayoutStage.confidence,
    pages: (pageLayoutStage.pages || []).map((p) => ({
      page: p.page,
      layout_type: p.layout_type,
      confidence: p.confidence,
      signals: p.signals,
      split_x: p.split_x,
      line_count: p.line_count,
      sidebar: p.sidebar,
      columns: p.columns,
      reading_zones: (p.reading_zones || []).map((z) => ({
        id: z.id,
        column: z.column,
        role: z.role,
        line_count: z.line_count,
        preview: z.preview,
        bounds: z.bounds,
      })),
      density: p.density,
      alignment: p.alignment,
    })),
  };
}

/**
 * @param {object} pageLayout
 * @param {object} line
 */
export function lineReadingZone(pageLayout, line) {
  if (!lineText(line) || !Number.isFinite(line.x)) return 'main';
  const cx = lineBox(line).cx;
  const split = pageLayout?.split_x;
  if (!Number.isFinite(split)) return 'main';
  const side = cx <= split ? 'left' : 'right';
  if (pageLayout.layout_type === PAGE_LAYOUT_TYPES.SIDEBAR_LEFT) {
    return side === 'left' ? 'sidebar' : 'main';
  }
  if (pageLayout.layout_type === PAGE_LAYOUT_TYPES.SIDEBAR_RIGHT) {
    return side === 'right' ? 'sidebar' : 'main';
  }
  return side === 'left' ? 'left_column' : 'right_column';
}

/**
 * @param {object} pageLayoutStage
 */
export function splitXByPage(pageLayoutStage) {
  const map = new Map();
  for (const p of pageLayoutStage?.pages || []) {
    if (Number.isFinite(p.split_x)) map.set(p.page, p.split_x);
  }
  return map;
}

/**
 * @param {object} pageLayout
 * @param {object[]} lines
 */
export function zoneOrderedLines(pageLayout, lines) {
  const page = pageLayout?.page || 1;
  const pageLines = (lines || []).filter((l) => (l.page || 1) === page && lineText(l));
  const tagged = pageLines.map((ln) => ({
    ...ln,
    _readingZone: lineReadingZone(pageLayout, ln),
  }));

  const zoneOrder =
    pageLayout?.layout_type === PAGE_LAYOUT_TYPES.SIDEBAR_RIGHT
      ? ['main', 'sidebar']
      : ['sidebar', 'left_column', 'main', 'right_column'];

  const buckets = new Map();
  for (const z of zoneOrder) buckets.set(z, []);
  for (const ln of tagged) {
    const z = ln._readingZone || 'main';
    if (!buckets.has(z)) buckets.set(z, []);
    buckets.get(z).push(ln);
  }

  const out = [];
  let order = 0;
  for (const z of zoneOrder) {
    const sorted = [...(buckets.get(z) || [])].sort((a, b) => b.y - a.y || a.x - b.x);
    for (const ln of sorted) {
      out.push({ ...ln, readingOrder: order++, _readingZone: z });
    }
  }
  return out;
}
