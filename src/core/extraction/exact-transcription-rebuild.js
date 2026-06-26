/**
 * Word-first line reconstruction for Exact Transcription Mode.
 */

import {
  clusterOcrWordsIntoLineGroups,
  estimatePageContentWidth,
  columnGapThreshold,
} from './extraction-column-split.js';
import { coerceOcrExtractedLine } from './extracted-line.js';
import { isValidWordBbox, isZeroWordBbox, lineMayUseInferredOnlyWeakReason, lineHasRealWordBoxes } from './ocr-geometry.js';

/**
 * @param {object[]} words — { text, bbox, confidence }
 * @param {number} [pageWidth]
 */
export function clusterWordsWithLineWords(words, pageWidth) {
  const validWords = (words || []).filter((w) => w.text && isValidWordBbox(w.bbox));
  const tesseractShape = validWords.map((w) => ({
    text: w.text,
    bbox: {
      x0: w.bbox?.x ?? 0,
      y0: w.bbox?.y ?? 0,
      x1: (w.bbox?.x ?? 0) + (w.bbox?.width ?? 0),
      y1: (w.bbox?.y ?? 0) + (w.bbox?.height ?? 0),
    },
    confidence: w.confidence,
  }));

  const groups = clusterOcrWordsIntoLineGroups(tesseractShape, pageWidth);
  const gap = columnGapThreshold(
    tesseractShape.map((w) => ({
      x: w.bbox.x0,
      width: w.bbox.x1 - w.bbox.x0,
    })),
    pageWidth
  );

  return groups.map((g) => {
    const lineWords = validWords.filter((w) => {
      if (!w.bbox) return false;
      const cy = w.bbox.y + (w.bbox.height || 0) / 2;
      const lineTop = g.y;
      const lineH = g.height || 12;
      return cy >= lineTop - 2 && cy <= lineTop + lineH + 2;
    });
    const confs = lineWords.map((w) => Number(w.confidence ?? 0)).filter((n) => n > 0);
    const confidence = confs.length
      ? Math.round(confs.reduce((a, b) => a + b, 0) / confs.length)
      : 68;
    const columnId = g.x >= pageWidth * 0.52 ? 'RIGHT_COLUMN' : g.x < pageWidth * 0.38 ? 'LEFT_COLUMN' : 'FULL';
    return {
      ...g,
      confidence,
      words: lineWords,
      columnId,
      region: columnId === 'LEFT_COLUMN' ? 'left' : columnId === 'RIGHT_COLUMN' ? 'right' : 'full',
    };
  });
}

/**
 * Rebuild OCR lines from word boxes (column-aware) for exact transcription fidelity.
 * @param {import('./extracted-line.js').ExtractedLine[]} allLines
 * @param {Record<number, object[]>} ocrWordsByPage
 */
export function rebuildLinesFromOcrWords(allLines, ocrWordsByPage = {}) {
  const nativeByPage = new Map();
  for (const ln of allLines || []) {
    const p = ln.page || 1;
    const src = String(ln.source || '');
    if (src === 'ocr') continue;
    if (!nativeByPage.has(p)) nativeByPage.set(p, []);
    nativeByPage.get(p).push(ln);
  }

  const pages = new Set([
    ...Object.keys(ocrWordsByPage).map(Number),
    ...(allLines || []).map((l) => l.page || 1),
  ]);

  /** @type {import('./extracted-line.js').ExtractedLine[]} */
  const out = [];
  for (const pageNum of [...pages].sort((a, b) => a - b)) {
    const words = ocrWordsByPage[pageNum] || ocrWordsByPage[String(pageNum)] || [];
    const natives = nativeByPage.get(pageNum) || [];

    if (words.filter((w) => isValidWordBbox(w.bbox)).length >= 3) {
      const pageWidth = estimatePageContentWidth(
        words.map((w) => ({ x: w.bbox?.x ?? 0, width: w.bbox?.width ?? 0 }))
      );
      const groups = clusterWordsWithLineWords(words, pageWidth);
      groups.forEach((g, i) => {
        out.push(
          coerceOcrExtractedLine(
            {
              text: g.text,
              rawExtraction: g.text,
              cleanedText: g.text,
              x: g.x,
              y: g.y,
              width: g.width,
              height: g.height,
              words: g.words,
              columnId: g.columnId,
              region: g.region,
            },
            {
              text: g.text,
              rawExtraction: g.text,
              page: pageNum,
              line: i,
              confidence: g.confidence,
            }
          )
        );
      });
    } else {
      const ocrLines = (allLines || []).filter((l) => (l.page || 1) === pageNum && l.source === 'ocr');
      out.push(...(ocrLines.length ? ocrLines : []));
    }

    out.push(...natives);
  }

  return out.length ? out : allLines || [];
}

/**
 * @param {object} line
 */
export function weakLineReason(line) {
  const conf = Number(line.confidence ?? 100);
  if (conf < 45) return 'very_low_confidence';
  if (conf < 60) return 'low_confidence';
  if (!line.bbox || (!line.bbox.width && !line.bbox.w && !line.bbox.x)) return 'missing_coordinates';
  const words = line.words || [];
  if (words.length) {
    const zeroBoxes = words.filter((w) => w.bbox && isZeroWordBbox(w.bbox));
    if (zeroBoxes.length) return 'zero_word_bbox';
    if (lineMayUseInferredOnlyWeakReason(line)) {
      return 'inferred_word_boxes_only';
    }
  }
  const text = String(line.text || line.raw_text || '');
  if (text.length > 120 && /\s{2,}/.test(text)) return 'possible_merge';
  if (/https?:\/\//i.test(text) && text.split(/\s+/).length <= 3) return 'url_fragment';
  return null;
}
