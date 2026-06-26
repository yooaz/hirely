/**
 * Parser layout input — text + line order + spatial positions (never text-only when lines exist).
 */

import {
  buildLayoutMemory,
  buildLayoutMemoryFromPlainText,
} from '../layout/layout-memory.js';
import {
  spatialBlocksFromLayoutMemory,
  spatialBlocksToPlainText,
} from '../layout/spatial-block.js';

/**
 * @typedef {object} ParserLayoutInput
 * @property {string} text — derived plain text (last-resort for legacy consumers)
 * @property {'spatial_blocks'|'extraction_lines'|'plain_text_fallback'} primaryInput
 * @property {import('../layout/spatial-block.js').SpatialBlock[]} spatialBlocks — primary structured input
 * @property {import('../layout/layout-memory.js').LayoutMemory|null} layoutMemory
 * @property {import('../extraction/extracted-line.js').ExtractedLine[]} extractionLines
 * @property {string} [rawText]
 */

function lineKey(ln) {
  return String(ln?.cleanedText ?? ln?.text ?? '').trim().toLowerCase();
}

function mergeExtractionLinesByPage(prebuiltLines = [], incomingLines = []) {
  const byPage = new Map();
  for (const ln of prebuiltLines) {
    const p = ln.page || ln.page_number || 1;
    if (!byPage.has(p)) byPage.set(p, []);
    byPage.get(p).push(ln);
  }
  for (const ln of incomingLines) {
    const p = ln.page || ln.page_number || 1;
    if (!byPage.has(p)) byPage.set(p, []);
    const key = lineKey(ln);
    if (!key) continue;
    const exists = byPage.get(p).some((e) => lineKey(e) === key);
    if (!exists) byPage.get(p).push(ln);
  }
  return [...byPage.keys()].sort((a, b) => a - b).flatMap((p) => byPage.get(p));
}

/**
 * @param {string} cleanedText
 * @param {object} [opts]
 * @returns {ParserLayoutInput}
 */
export function resolveParserLayoutInput(cleanedText, opts = {}) {
  const raw = String(opts.rawText || cleanedText || '').trim();
  const clean = String(cleanedText || '').trim();

  const incomingLines = opts.extractionLines || opts.lines || opts.layoutMemory?.lines;
  const prebuilt = opts.layoutMemory;

  if (prebuilt?.entries?.length || prebuilt?.spatialBlocks?.length) {
    const extractionLines = mergeExtractionLinesByPage(
      prebuilt.lines || [],
      opts.extractionLines || incomingLines || []
    );
    let spatialBlocks = spatialBlocksFromLayoutMemory(prebuilt, {
      pageLayouts: opts.pageLayouts,
    });
    const basePages = new Set((prebuilt.lines || []).map((l) => l.page || l.page_number || 1));
    const addedPages = [...new Set(extractionLines.map((l) => l.page || l.page_number || 1))].filter(
      (p) => !basePages.has(p)
    );
    for (const page of addedPages) {
      const pageLines = extractionLines.filter((l) => (l.page || l.page_number || 1) === page);
      const pageMem = buildLayoutMemory(pageLines, {
        ...opts,
        _singlePageBuild: true,
        source: opts.extractionMethod || 'pdf_native',
      });
      spatialBlocks = [...spatialBlocks, ...(pageMem.spatialBlocks || [])];
    }

    const text =
      spatialBlocksToPlainText(spatialBlocks) ||
      String(prebuilt.parserText || '').trim() ||
      clean ||
      raw;
    return {
      text,
      primaryInput: spatialBlocks.length ? 'spatial_blocks' : 'extraction_lines',
      spatialBlocks,
      layoutMemory: {
        ...prebuilt,
        lines: extractionLines,
        spatialBlocks,
        pageCount: Math.max(prebuilt.pageCount || 1, ...extractionLines.map((l) => l.page || 1)),
      },
      extractionLines,
      rawText: raw,
    };
  }

  if (incomingLines?.length) {
    const layoutMemory = buildLayoutMemory(incomingLines, {
      layout: opts.layout || opts.layoutStage,
      orderedLines: opts.orderedLines || opts.readingStage?.orderedLines,
      rawText: raw,
      cleanedText: clean,
      ocrLayout: opts.ocrLayout,
      pageLayouts: opts.pageLayouts,
    });
    const spatialBlocks = layoutMemory.spatialBlocks || [];
    const text = spatialBlocksToPlainText(spatialBlocks) || clean || raw;
    return {
      text,
      primaryInput: spatialBlocks.length ? 'spatial_blocks' : 'extraction_lines',
      spatialBlocks,
      layoutMemory,
      extractionLines: layoutMemory.lines,
      rawText: raw,
    };
  }

  const sourceText = clean || raw;
  if (sourceText.length >= 1) {
    const layoutMemory = buildLayoutMemoryFromPlainText(sourceText, {
      source: opts.extractionMethod || 'paste',
    });
    const spatialBlocks = layoutMemory.spatialBlocks || [];
    return {
      text: spatialBlocksToPlainText(spatialBlocks) || sourceText,
      primaryInput: spatialBlocks.length ? 'spatial_blocks' : 'plain_text_fallback',
      spatialBlocks,
      layoutMemory,
      extractionLines: layoutMemory.lines,
      rawText: raw,
    };
  }

  return {
    text: '',
    primaryInput: 'plain_text_fallback',
    spatialBlocks: [],
    layoutMemory: null,
    extractionLines: [],
    rawText: raw,
  };
}
