/**
 * Column-aware row splitting for native PDF items and OCR word boxes.
 * Prevents sidebar + main column text merging on the same Y band.
 */

import { isExactTranscriptionExtractionActive } from './exact-transcription-truth.js';

const DEFAULT_MIN_GAP_PX = 36;
const DEFAULT_GAP_RATIO = 0.07;

/**
 * @param {Array<{ height?: number }>} items
 */
function medianWordHeight(items) {
  const hs = (items || [])
    .map((i) => Number(i.height) || 0)
    .filter((h) => h > 0)
    .sort((a, b) => a - b);
  if (!hs.length) return 12;
  return hs[Math.floor(hs.length / 2)];
}

/**
 * @param {Array<{ y: number, height?: number }>} items
 */
function wordCenterY(item) {
  const h = Number(item.height) > 0 ? Number(item.height) : 12;
  const top = Number(item.y) || 0;
  return top + h / 2;
}

/**
 * @param {Array<{ x: number, width?: number }>} items
 */
export function estimatePageContentWidth(items) {
  const xs = (items || [])
    .map((i) => Number(i.x))
    .filter((x) => Number.isFinite(x));
  if (!xs.length) return 612;
  const rights = (items || []).map((i) => {
    const x = Number(i.x) || 0;
    const w = Number(i.width) > 0 ? Number(i.width) : 40;
    return x + w;
  });
  return Math.max(200, Math.max(...rights) - Math.min(...xs));
}

/**
 * @param {Array<{ x: number, width?: number }>} items
 * @param {number} [pageWidth]
 */
export function columnGapThreshold(items, pageWidth) {
  const width =
    Number.isFinite(pageWidth) && pageWidth > 0
      ? pageWidth
      : estimatePageContentWidth(items);
  return Math.max(DEFAULT_MIN_GAP_PX, Math.round(width * DEFAULT_GAP_RATIO));
}

/**
 * Split a same-Y row into column-separated segments.
 * @param {Array<{ text: string, x: number, y: number, width?: number, height?: number }>} rowItems
 * @param {number} [pageWidth]
 */
export function splitRowItemsByColumnGap(rowItems, pageWidth) {
  if (!rowItems?.length) return [];
  const sorted = [...rowItems].sort((a, b) => a.x - b.x);
  if (sorted.length === 1) return [sorted];

  const gapMin = columnGapThreshold(sorted, pageWidth);
  const segments = [];
  let current = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prev = current[current.length - 1];
    const cur = sorted[i];
    const prevRight = Number(prev.x) + (Number(prev.width) > 0 ? Number(prev.width) : 8);
    const gap = Number(cur.x) - prevRight;
    if (gap >= gapMin) {
      segments.push(current);
      current = [cur];
    } else {
      current.push(cur);
    }
  }
  if (current.length) segments.push(current);
  return segments;
}

/**
 * @param {Array<{ text: string, x: number, y: number, width?: number, height?: number }>} items
 * @param {number} [pageWidth]
 */
export function groupItemsIntoLineGroups(items, pageWidth) {
  const list = items || [];
  const medianH = medianWordHeight(list);
  const yTol = Math.max(4, Math.min(14, Math.round(medianH * 0.4)));

  const sorted = [...list].sort((a, b) => {
    const cyA = wordCenterY(a);
    const cyB = wordCenterY(b);
    if (Math.abs(cyB - cyA) > yTol) return cyB - cyA;
    return a.x - b.x;
  });

  const yBands = [];
  let currentBand = [];
  let bandCenterY = null;

  for (const item of sorted) {
    const cy = wordCenterY(item);
    if (bandCenterY === null || Math.abs(cy - bandCenterY) <= yTol) {
      currentBand.push(item);
      const centers = currentBand.map(wordCenterY);
      bandCenterY = centers.reduce((s, v) => s + v, 0) / centers.length;
    } else {
      if (currentBand.length) yBands.push(currentBand);
      currentBand = [item];
      bandCenterY = cy;
    }
  }
  if (currentBand.length) yBands.push(currentBand);

  const groups = [];
  for (const band of yBands) {
    const segments = splitRowItemsByColumnGap(band, pageWidth);
    for (const segment of segments) {
      const sortedRow = [...segment].sort((a, b) => a.x - b.x);
      const text = sortedRow
        .map((i) => i.text)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (!text.length) continue;
      if (!isExactTranscriptionExtractionActive() && text.length <= 1) continue;
      const x = Math.min(...sortedRow.map((i) => i.x));
      const centers = sortedRow.map(wordCenterY);
      const y = Math.round(centers.reduce((s, v) => s + v, 0) / centers.length);
      const x2 = Math.max(...sortedRow.map((i) => i.x + (i.width || 0)));
      const height = Math.max(...sortedRow.map((i) => i.height || 12), 12);
      const confs = sortedRow.map((i) => Number(i.confidence ?? 0)).filter((n) => n > 0);
      const confidence = confs.length
        ? Math.round(confs.reduce((a, b) => a + b, 0) / confs.length)
        : 0;
      groups.push({ text, x, y, width: Math.max(x2 - x, 8), height, confidence });
    }
  }
  return groups;
}

/**
 * Cluster Tesseract words into positioned lines (column-safe).
 * @param {Array<{ text: string, bbox: { x0: number, y0: number, x1: number, y1: number }, confidence?: number }>} words
 * @param {number} [pageWidth]
 */
export function clusterOcrWordsIntoLineGroups(words, pageWidth) {
  const items = (words || [])
    .map((w) => {
      const text = String(w.text || '').trim();
      if (!text) return null;
      const bb = w.bbox || w;
      const x0 = Math.round(bb.x0 ?? bb.x ?? 0);
      const y0 = Math.round(bb.y0 ?? bb.y ?? 0);
      const x1 = Math.round(bb.x1 ?? x0 + (bb.width ?? 0));
      const y1 = Math.round(bb.y1 ?? y0 + (bb.height ?? 0));
      const width = Math.max(4, x1 - x0);
      const height = Math.max(8, y1 - y0);
      return { text, x: x0, y: y0, width, height, confidence: w.confidence };
    })
    .filter(Boolean);
  return groupItemsIntoLineGroups(items, pageWidth);
}
