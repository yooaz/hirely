/**
 * Structure-first parser text — resume-core lines / spatial blocks before flat rawExtraction.
 */

import { linesToPlainText } from './extracted-line.js';
import { linesToCleanedText } from './extraction-line-enrich.js';
import { spatialBlocksToPlainText } from '../layout/spatial-block.js';
import { hasPositionedPdfLines } from '../layout/pdf-block-engine.js';
import { filterLinesForResumeParsing } from '../layout/page-document-classifier.js';

/**
 * @param {object} [enterprise]
 * @returns {{
 *   rawText: string,
 *   cleanedText: string,
 *   lines: import('./extracted-line.js').ExtractedLine[],
 *   spatialBlocks: object[],
 *   structureFirst: boolean,
 *   source: string,
 * }}
 */
export function resolveStructureFirstParserText(enterprise) {
  if (!enterprise || typeof enterprise !== 'object') {
    return {
      rawText: '',
      cleanedText: '',
      lines: [],
      spatialBlocks: [],
      structureFirst: false,
      source: 'none',
    };
  }

  const meta = enterprise.metadata || {};
  const layoutMemory = enterprise.layoutMemory || meta.layoutMemory || null;
  const pageClass = meta.pageDocumentClassification || null;
  const allLines = enterprise.linesAllPages || enterprise.lines || [];
  const parsingLines =
    pageClass && allLines.length
      ? filterLinesForResumeParsing(allLines, pageClass)
      : enterprise.lines || [];
  const lines = parsingLines.length ? parsingLines : allLines;

  const spatialBlocks =
    enterprise.spatialBlocks ||
    meta.spatialBlocks ||
    layoutMemory?.spatialBlocks ||
    [];

  const fromBlocks = spatialBlocks.length ? spatialBlocksToPlainText(spatialBlocks).trim() : '';
  const fromLayout = String(layoutMemory?.parserText || '').trim();
  const fromLines = lines.length ? linesToPlainText(lines).trim() : '';
  const fromDebug = String(meta.extractionDebug?.finalPayload?.cleanedText || '').trim();
  const flatFallback = String(enterprise.cleanedText || enterprise.rawExtraction || enterprise.text || '').trim();

  let rawText = '';
  let source = 'flat_fallback';

  if (fromBlocks.length >= 24) {
    rawText = fromBlocks;
    source = 'spatial_blocks';
  } else if (fromLayout.length >= 24) {
    rawText = fromLayout;
    source = 'layout_memory';
  } else if (fromLines.length >= 24) {
    rawText = fromLines;
    source = 'positioned_lines';
  } else if (fromDebug.length >= 24) {
    rawText = fromDebug;
    source = 'extraction_debug';
  } else {
    rawText = flatFallback;
    source = 'flat_fallback';
  }

  const cleanedText =
    (lines.length ? linesToCleanedText(lines).trim() : '') ||
    fromDebug ||
    String(enterprise.cleanedText || '').trim() ||
    rawText;

  const structureFirst =
    source !== 'flat_fallback' &&
    (hasPositionedPdfLines(lines) || spatialBlocks.length >= 3);

  return {
    rawText,
    cleanedText,
    lines,
    spatialBlocks,
    structureFirst,
    source,
  };
}
