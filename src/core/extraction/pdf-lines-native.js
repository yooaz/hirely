/**
 * Native PDF text extraction with per-line layout (pdf.js).
 */

import { pdfItemsFromTextContent, extractTopZoneLines } from './pdf-first-page.js';
import { assessPdfTextLayer } from './pdf-text-quality.js';
import { corruptionScoreText } from '../parsing/corruption-detector.js';
import { NATIVE_DEFAULT_CONFIDENCE } from './extracted-line.js';
import {
  estimatePageContentWidth,
  groupItemsIntoLineGroups,
} from './extraction-column-split.js';

const PAGE_MIN_CHARS = 32;

/**
 * Group items into lines with average x/y — column gaps split sidebar from main body.
 * @param {Array<{ text: string, x: number, y: number, width?: number, height?: number }>} items
 * @param {number} [pageWidth]
 */
export function groupPdfItemsIntoLineGroups(items, pageWidth) {
  const width =
    Number.isFinite(pageWidth) && pageWidth > 0
      ? pageWidth
      : estimatePageContentWidth(items);
  return groupItemsIntoLineGroups(items, width);
}

/**
 * @param {import('pdfjs-dist').PDFDocumentProxy} pdf
 * @returns {Promise<{ pages: Array<{ page: number, lines: import('./extracted-line.js').ExtractedLine[], charCount: number, usable: boolean }>, firstPageHeaderLines: string[] }>}
 */
export async function extractNativePdfLines(pdf) {
  const pages = [];
  let firstPageHeaderLines = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const items = pdfItemsFromTextContent(content.items);
    const viewport = page.getViewport({ scale: 1 });
    if (pageNumber === 1) {
      firstPageHeaderLines = extractTopZoneLines(items, viewport.height);
    }
    const groups = groupPdfItemsIntoLineGroups(items, viewport.width);
    const pageText = groups.map((g) => g.text).join('\n');
    const quality = assessPdfTextLayer(pageText);
    const corrupt = corruptionScoreText(pageText);
    const lines = groups.map((g, pdfIndex) => ({
      text: g.text,
      rawExtraction: g.text,
      confidence: Math.min(100, Math.max(75, Math.round(quality.confidence || NATIVE_DEFAULT_CONFIDENCE))),
      source: 'native',
      page: pageNumber,
      pdfIndex,
      line: pdfIndex,
      x: g.x,
      y: g.y,
      width: g.width,
      height: g.height,
    }));
    pages.push({
      page: pageNumber,
      lines,
      charCount: pageText.length,
      usable:
        pageText.length >= PAGE_MIN_CHARS &&
        quality.confidence >= 52 &&
        corrupt < 46,
      quality,
    });
  }

  return { pages, firstPageHeaderLines };
}
