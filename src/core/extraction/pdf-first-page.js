/**
 * First-page header zone — top of page for name/title recovery (pdf-text).
 */

import { groupPdfItemsIntoLines } from './pdf-text.js';

const TOP_ZONE_RATIO = 0.42;

/**
 * Lines from the upper portion of page 1 (reading order).
 * @param {Array<{ text: string, x: number, y: number }>} items
 * @param {number} [pageHeight] optional viewport height
 */
export function extractTopZoneLines(items, pageHeight = 0) {
  const list = (items || []).filter((i) => i.text && String(i.text).trim().length > 1);
  if (!list.length) return [];

  const ys = list.map((i) => i.y);
  const maxY = Math.max(...ys);
  const minY = Math.min(...ys);
  const span = maxY - minY || pageHeight || 800;
  const threshold = maxY - span * TOP_ZONE_RATIO;

  const topItems = list.filter((i) => i.y >= threshold);
  const source = topItems.length >= 2 ? topItems : list.slice(0, Math.min(24, list.length));

  return groupPdfItemsIntoLines(source);
}

export function pdfItemsFromTextContent(contentItems) {
  return (contentItems || [])
    .map((item) => {
      const t = item.transform || [0, 0, 0, 0, 0, 0];
      const scaleX = Math.hypot(t[0] || 0, t[1] || 0) || 1;
      const scaleY = Math.hypot(t[2] || 0, t[3] || 0) || 1;
      const str = String(item.str || '').trim();
      const width =
        item.width != null && item.width > 0
          ? Math.round(item.width * scaleX)
          : Math.round(scaleX * Math.max(str.length, 1) * 0.55);
      const height =
        item.height != null && item.height > 0
          ? Math.round(item.height * scaleY)
          : Math.round(scaleY * 12);
      return {
        text: str,
        x: Math.round(t[4] || 0),
        y: Math.round(t[5] || 0),
        width,
        height,
      };
    })
    .filter((item) => item.text.length > 0);
}
