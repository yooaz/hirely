/**
 * Layout detection — single column, two column, sidebar, creative portfolio.
 * Uses per-page geometry (page-layout.js) when coordinates are available.
 */

import { findCreativeEntitiesInText } from '../../data/dictionaries/creative/index.js';
import { fuzzySectionKey } from '../parsing/section-fuzzy.js';
import { isSectionHeaderLine } from '../parsing/rich-parser.js';
import {
  PAGE_LAYOUT_TYPES,
  classifyDocumentPageLayouts,
  toLegacyLayoutType,
  normalizePageLayoutType,
} from './page-layout.js';

export { PAGE_LAYOUT_TYPES, normalizePageLayoutType, toLegacyLayoutType };

export const LAYOUT_TYPES = {
  SINGLE_COLUMN: 'single_column',
  TWO_COLUMN: 'two_column',
  TWO_COLUMNS: 'two_columns',
  DOUBLE_COLUMN: 'two_column',
  LEFT_SIDEBAR: 'left_sidebar',
  SIDEBAR_LEFT: 'sidebar_left',
  RIGHT_SIDEBAR: 'right_sidebar',
  SIDEBAR_RIGHT: 'sidebar_right',
  COMPLEX: 'complex',
  CREATIVE_PORTFOLIO: 'creative_portfolio',
  ATS_RESUME: 'ats_resume',
  UNKNOWN: 'unknown',
};

const MULTI_COLUMN_LAYOUTS = new Set([
  LAYOUT_TYPES.TWO_COLUMN,
  LAYOUT_TYPES.TWO_COLUMNS,
  LAYOUT_TYPES.LEFT_SIDEBAR,
  LAYOUT_TYPES.SIDEBAR_LEFT,
  LAYOUT_TYPES.RIGHT_SIDEBAR,
  LAYOUT_TYPES.SIDEBAR_RIGHT,
]);

/**
 * @param {string} layoutType
 */
export function isMultiColumnLayoutType(layoutType) {
  const n = normalizePageLayoutType(layoutType);
  return (
    n === PAGE_LAYOUT_TYPES.TWO_COLUMNS ||
    n === PAGE_LAYOUT_TYPES.SIDEBAR_LEFT ||
    n === PAGE_LAYOUT_TYPES.SIDEBAR_RIGHT ||
    MULTI_COLUMN_LAYOUTS.has(layoutType)
  );
}

const PORTFOLIO_RE =
  /\b(portfolio|behance|dribbble|case study|personal work|selected work|projets?|projects?)\b/i;
const ATS_SECTION_RE =
  /\b(experience|education|skills|work history|employment|formation|compétences)\b/i;

function analyzeColumnGeometry(lines) {
  const positioned = (lines || []).filter((l) => {
    const t = String(l.cleanedText ?? l.text ?? '');
    return Number.isFinite(l.x) && Number.isFinite(l.y) && t.length > 2;
  });

  if (positioned.length < 6) {
    return {
      layoutType: LAYOUT_TYPES.SINGLE_COLUMN,
      confidence: 52,
      signals: ['sparse-coordinates'],
      columnSplit: null,
    };
  }

  const page1 = positioned.filter((l) => (l.page || 1) === 1);
  const xs = page1.map((l) => l.x);
  const maxX = Math.max(...xs, 1);
  const minX = Math.min(...xs, 0);
  const span = maxX - minX || 1;
  const norm = xs.map((x) => (x - minX) / span);

  const left = norm.filter((x) => x < 0.38).length;
  const right = norm.filter((x) => x > 0.62).length;
  const center = norm.length - left - right;
  const total = norm.length || 1;
  const columnSplit = minX + span * 0.5;

  const leftCenters = page1.filter((l) => (l.x || 0) <= minX + span * 0.42);
  const leftSpan =
    leftCenters.length > 1
      ? Math.max(...leftCenters.map((l) => l.x)) - Math.min(...leftCenters.map((l) => l.x))
      : 0;
  const sidebarSplit = minX + span * 0.38;

  if (
    (left / total > 0.45 && right / total > 0.2 && leftSpan < span * 0.42) ||
    (left / total > 0.55 && right / total < 0.22)
  ) {
    return {
      layoutType: LAYOUT_TYPES.LEFT_SIDEBAR,
      confidence: 82,
      signals: ['x-cluster-left', 'narrow-sidebar'],
      columnSplit: sidebarSplit,
    };
  }
  if (right / total > 0.55 && left / total < 0.22) {
    return {
      layoutType: LAYOUT_TYPES.RIGHT_SIDEBAR,
      confidence: 80,
      signals: ['x-cluster-right'],
      columnSplit,
    };
  }

  const bins = 12;
  const hist = new Array(bins).fill(0);
  for (const x of norm) {
    hist[Math.min(bins - 1, Math.floor(x * bins))]++;
  }
  const peak = Math.max(...hist, 1);
  let gapScore = 0;
  for (let i = 3; i < bins - 3; i++) {
    if (hist[i] < peak * 0.15 && hist[i - 1] < peak * 0.2 && hist[i + 1] < peak * 0.2) {
      gapScore = Math.max(gapScore, 1 - hist[i] / peak);
    }
  }
  if (left / total > 0.25 && right / total > 0.25 && gapScore > 0.45) {
    return {
      layoutType: LAYOUT_TYPES.TWO_COLUMN,
      confidence: 84,
      signals: ['x-gap-center'],
      columnSplit,
    };
  }
  if (center / total < 0.18 && left / total > 0.28 && right / total > 0.28) {
    return {
      layoutType: LAYOUT_TYPES.TWO_COLUMN,
      confidence: 76,
      signals: ['bimodal-x'],
      columnSplit,
    };
  }

  return {
    layoutType: LAYOUT_TYPES.SINGLE_COLUMN,
    confidence: 74,
    signals: ['single-flow'],
    columnSplit: null,
  };
}

function detectContentArchetype(text, lines) {
  const hay = String(text || '');
  const creativeHits = findCreativeEntitiesInText(hay).length;
  const portfolioSignals = (hay.match(PORTFOLIO_RE) || []).length;
  const sectionHeaders = (lines || []).filter((l) =>
    isSectionHeaderLine(l.cleanedText ?? l.text)
  ).length;
  const atsHeaders = (lines || [])
    .map((l) => fuzzySectionKey(l.cleanedText ?? l.text))
    .filter((k) => k && ATS_SECTION_RE.test(k)).length;

  if (creativeHits >= 3 && (portfolioSignals >= 1 || creativeHits >= 5)) {
    return {
      layoutType: LAYOUT_TYPES.CREATIVE_PORTFOLIO,
      confidence: 82,
      signals: ['creative-entities', 'portfolio-keywords'],
    };
  }
  if (sectionHeaders >= 3 && atsHeaders >= 2 && creativeHits < 2) {
    return {
      layoutType: LAYOUT_TYPES.ATS_RESUME,
      confidence: 76,
      signals: ['section-headers', 'ats-structure'],
    };
  }
  return null;
}

/**
 * @param {object} document — { lines, rawText, cleanedText, ocrLayout, pageLayouts }
 */
export function detectLayout(document = {}) {
  const lines = document.lines || [];
  const text = String(document.cleanedText || document.rawText || '').trim();

  const pageLayoutStage =
    document.pageLayouts ||
    (lines.some((l) => Number.isFinite(l.x) && Number.isFinite(l.y))
      ? classifyDocumentPageLayouts(lines)
      : null);

  const primaryPage = pageLayoutStage?.pages?.find((p) => p.page === 1) || pageLayoutStage?.pages?.[0];
  const geo = primaryPage
    ? {
        layoutType: toLegacyLayoutType(primaryPage.layout_type),
        pageLayoutType: primaryPage.layout_type,
        confidence: primaryPage.confidence,
        signals: [...(primaryPage.signals || []), 'page-layout-primary'],
        columnSplit: primaryPage.split_x,
        sidebar: primaryPage.sidebar,
        readingZones: primaryPage.reading_zones,
      }
    : analyzeColumnGeometry(lines);

  const archetype = detectContentArchetype(text, lines);

  let layoutType = geo.layoutType;
  let confidence = geo.confidence;
  let signals = [...geo.signals];

  if (archetype?.layoutType === LAYOUT_TYPES.CREATIVE_PORTFOLIO) {
    const geoIsMulti =
      geo.layoutType === LAYOUT_TYPES.TWO_COLUMN ||
      geo.layoutType === LAYOUT_TYPES.LEFT_SIDEBAR ||
      geo.layoutType === LAYOUT_TYPES.RIGHT_SIDEBAR;
    if (geoIsMulti && geo.confidence >= 72) {
      signals = [...signals, 'geometry-overrides-creative', ...archetype.signals];
    } else {
      layoutType = LAYOUT_TYPES.CREATIVE_PORTFOLIO;
      confidence = Math.max(confidence, archetype.confidence);
      signals = [...signals, ...archetype.signals];
    }
  } else if (
    archetype?.layoutType === LAYOUT_TYPES.ATS_RESUME &&
    geo.layoutType === LAYOUT_TYPES.SINGLE_COLUMN
  ) {
    layoutType = LAYOUT_TYPES.ATS_RESUME;
    confidence = Math.max(confidence, archetype.confidence);
    signals = [...signals, ...archetype.signals];
  }

  if (document.ocrLayout?.multiColumn && layoutType === LAYOUT_TYPES.SINGLE_COLUMN) {
    layoutType = LAYOUT_TYPES.TWO_COLUMN;
    signals.push('ocr-multicolumn');
    confidence = Math.max(confidence, 70);
  }

  return {
    stage: 'layout_detection',
    layoutType,
    pageLayoutType: geo.pageLayoutType || normalizePageLayoutType(layoutType),
    label: layoutType.replace(/_/g, ' '),
    confidence,
    signals,
    geometry: geo,
    columnSplit: geo.columnSplit,
    sidebar: geo.sidebar || primaryPage?.sidebar || null,
    readingZones: geo.readingZones || primaryPage?.reading_zones || [],
    pageLayouts: pageLayoutStage,
    archetype: archetype?.layoutType || null,
    at: new Date().toISOString(),
  };
}

export function detectLayoutStage(document = {}) {
  return detectLayout(document);
}
