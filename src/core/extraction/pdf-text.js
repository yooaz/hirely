/**
 * PDF text-layer layout (PDF.js items → reading order). No OCR.
 */

function rowToLineSegments(row) {
  const sorted = [...row].sort((a, b) => a.x - b.x);
  const COL_GAP = 28;
  const segments = [[]];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0) {
      const prev = sorted[i - 1];
      const gap = sorted[i].x - (prev.x + Math.max(prev.text.length * 5, 8));
      if (gap > COL_GAP) segments.push([]);
    }
    segments[segments.length - 1].push(sorted[i]);
  }
  return segments.map((seg) =>
    seg
      .sort((a, b) => a.x - b.x)
      .map((i) => i.text)
      .join(' ')
  );
}

export function groupPdfItemsIntoLines(items) {
  const sorted = [...items].sort((a, b) => {
    if (Math.abs(b.y - a.y) > 6) return b.y - a.y;
    return a.x - b.x;
  });

  const lines = [];
  let current = [];
  let currentY = null;

  for (const item of sorted) {
    if (currentY === null || Math.abs(item.y - currentY) <= 6) {
      current.push(item);
      currentY = currentY === null ? item.y : currentY;
    } else {
      lines.push(...rowToLineSegments(current));
      current = [item];
      currentY = item.y;
    }
  }

  if (current.length) lines.push(...rowToLineSegments(current));

  return lines
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 1);
}

export function buildPdfPageText(items) {
  const mapped = (items || []).map((it) => ({
    text: String(it.s || it.text || '').trim(),
    x: it.x,
    y: it.y,
  }));
  return groupPdfItemsIntoLines(mapped.filter((i) => i.text)).join('\n');
}
