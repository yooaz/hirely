/**
 * HIRELY Recruiter Scan Test — simulate 6–10s first-scan visibility.
 * Measures name, title, experience, skills, education, contact above the fold.
 */

import { A4_HEIGHT_PX, A4_WIDTH_PX } from '../export/pdf-export-config.js';

export const RECRUITER_SCAN_TEST_V1 = 'RECRUITER_SCAN_TEST_V1';

/** Recruiter first-scan window (6–10s ≈ top ~37% of A4 page 1). */
export const SCAN_ZONE_SECONDS_MIN = 6;
export const SCAN_ZONE_SECONDS_MAX = 10;
export const SCAN_ZONE_RATIO = 0.38;
export const SCAN_ZONE_PX = Math.round(A4_HEIGHT_PX * SCAN_ZONE_RATIO);

/** Field weights — recruiter priority on first pass. */
export const SCAN_FIELD_WEIGHTS = Object.freeze({
  name: 0.25,
  title: 0.2,
  experience: 0.25,
  contact: 0.15,
  skills: 0.1,
  education: 0.05,
});

export const SCAN_FIELDS = Object.freeze([
  'name',
  'title',
  'experience',
  'skills',
  'education',
  'contact',
]);

/**
 * @typedef {{
 *   field: string,
 *   visible: boolean,
 *   inScanZone: boolean,
 *   prominent: boolean,
 *   topPx: number|null,
 *   heightPx: number|null,
 *   score: number,
 *   note: string,
 * }} ScanFieldResult
 */

/**
 * @param {ScanFieldResult[]} fields
 */
export function computeScanScore(fields) {
  let total = 0;
  for (const f of fields) {
    const w = SCAN_FIELD_WEIGHTS[f.field] ?? 0;
    total += w * (f.score ?? 0);
  }
  return Math.round(total * 100) / 100;
}

/**
 * Score a single field from layout measurement.
 * @param {string} field
 * @param {{ topPx?: number|null, heightPx?: number|null, hasText?: boolean, textMatch?: boolean }} m
 */
export function scoreScanField(field, m = {}) {
  const top = m.topPx ?? null;
  const height = m.heightPx ?? 0;
  const hasText = !!m.hasText;
  const textMatch = m.textMatch !== false;

  if (!hasText || !textMatch) {
    return {
      field,
      visible: false,
      inScanZone: false,
      prominent: false,
      topPx: top,
      heightPx: height,
      score: 0,
      note: 'Not found or text missing',
    };
  }

  const bottom = top != null ? top + height : null;
  const inScanZone = top != null && top < SCAN_ZONE_PX && bottom > 0;
  const prominent = top != null && top < 200 && field === 'name' ? true : top != null && top < 240 && (field === 'name' || field === 'title');

  let score = 0;
  let note = '';

  if (inScanZone) {
    score = prominent && (field === 'name' || field === 'title') ? 1 : 0.92;
    note = prominent ? 'Prominent in scan zone' : 'Visible in scan zone';
  } else if (top != null && top < SCAN_ZONE_PX + 80) {
    score = 0.55;
    note = 'Partially visible — starts in zone, extends below';
  } else if (top != null && top < A4_HEIGHT_PX) {
    score = 0.25;
    note = 'Below scan zone — requires scroll';
  } else {
    score = 0;
    note = 'Not visible on page 1';
  }

  return {
    field,
    visible: hasText,
    inScanZone,
    prominent,
    topPx: top,
    heightPx: height,
    score,
    note,
  };
}

/**
 * Rank templates best → worst by scan score.
 * @param {Array<{ templateId: string, displayName?: string, scanScore: number, fields: ScanFieldResult[] }>} rows
 */
export function rankScanResults(rows) {
  return [...rows].sort((a, b) => {
    if (b.scanScore !== a.scanScore) return b.scanScore - a.scanScore;
    const aZone = a.fields.filter((f) => f.inScanZone).length;
    const bZone = b.fields.filter((f) => f.inScanZone).length;
    return bZone - aZone;
  });
}

/**
 * Playwright page.evaluate payload — measure field anchors in CV DOM.
 * Keep in sync with cv-templates.js class names.
 */
export const SCAN_DOM_MEASURE_SCRIPT = `
(() => {
  const SCAN_ZONE = ${SCAN_ZONE_PX};
  const cv = document.querySelector('.cv');
  if (!cv) return { ok: false, fields: {} };

  const cvTop = cv.getBoundingClientRect().top;

  function measure(selector, root) {
    const el = root.querySelector(selector);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const text = (el.innerText || '').replace(/\\s+/g, ' ').trim();
    if (!text || text.length < 2) return null;
    return {
      topPx: Math.round(r.top - cvTop),
      heightPx: Math.round(r.height),
      text: text.slice(0, 160),
    };
  }

  function measureFirst(selectors) {
    for (const sel of selectors) {
      const m = measure(sel, cv);
      if (m) return m;
    }
    return null;
  }

  const fields = {
    name: measureFirst(['.cvName', '[class*="cvName"]']),
    title: measureFirst(['.cvTitle', '[class*="cvTitle"]']),
    experience: measureFirst([
      '.cvSection--experience .cvExpEntry',
      '.cvSection--experience .cvArExpRow',
      '.cvSection--experience .cvV3SeCard',
      '.cvSection--experience',
      '.cvSection--mk-cases',
      '.cvSection--startup-impact',
      '.cvVtNode',
      '.cvTimeline .cvExpEntry',
    ]),
    skills: measureFirst([
      '.cvSection--skills',
      '.cvSkillLine',
      '.cvV3GgChip',
      '.cvV3SeRail .cvSection--skills',
    ]),
    education: measureFirst([
      '.cvSection--education',
      '.cvEduEntry',
      '.cvEduLine',
      '.cvV3AcRail .cvSection--education',
    ]),
    contact: measureFirst([
      '.cvArContactBand',
      '.cvV3MaBand',
      '.cvMkContact',
      '.cvV3CeContact',
      '.cvAmContact',
      '.cvV3ApContact',
      '.cvSbContact',
      '.cvContact',
      '.cvLuxuryContact',
      '[class*="Contact"]',
    ]),
  };

  const zoneHits = Object.fromEntries(
    Object.entries(fields).map(([k, v]) => [
      k,
      v ? v.topPx < SCAN_ZONE : false,
    ])
  );

  return { ok: true, fields, zoneHits, scanZonePx: SCAN_ZONE, cvHeightPx: Math.round(cv.scrollHeight) };
})();
`;
