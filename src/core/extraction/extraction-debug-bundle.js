/**
 * Extraction debug bundle — transparent artifacts for PDF extraction QA.
 */

import { linesToPlainText, summarizeLines } from './extracted-line.js';
import { linesToRawText, linesToCleanedText } from './extraction-line-enrich.js';
import { hasPositionedPdfLines } from '../layout/pdf-block-engine.js';
import { buildPageDocumentClassificationDebug } from '../layout/page-document-classifier.js';

/**
 * @param {object} input
 * @param {import('./extracted-line.js').ExtractedLine[]} input.allLines
 * @param {import('./extracted-line.js').ExtractedLine[]} [input.parsingLines]
 * @param {object} [input.pageDocumentClassification]
 * @param {object} [input.layoutStage]
 * @param {object} [input.readingStage]
 * @param {object} [input.layoutMemory]
 * @param {object[]} [input.spatialBlocks]
 * @param {object} [input.pdfExtraction]
 * @param {string} [input.method]
 * @param {string} [input.rawExtraction]
 * @param {string} [input.cleanedText]
 */
export function buildExtractionDebugBundle(input = {}) {
  const allLines = input.allLines || [];
  const parsingLines = input.parsingLines || allLines;
  const summaryAll = summarizeLines(allLines);
  const summaryParse = summarizeLines(parsingLines);
  const pageClass = input.pageDocumentClassification || null;

  const linesByPage = {};
  for (const ln of allLines) {
    const p = ln.page || 1;
    if (!linesByPage[p]) linesByPage[p] = [];
    linesByPage[p].push({
      text: ln.cleanedText ?? ln.text,
      raw: ln.rawExtraction ?? ln.text,
      x: ln.x,
      y: ln.y,
      source: ln.source,
      confidence: ln.confidence,
      columnId: ln.columnId || null,
      region: ln.region || null,
    });
  }

  const parsingByPage = {};
  for (const ln of parsingLines) {
    const p = ln.page || 1;
    if (!parsingByPage[p]) parsingByPage[p] = [];
    parsingByPage[p].push(ln.cleanedText ?? ln.text);
  }

  const positionedAll = allLines.filter(
    (l) => Number.isFinite(l.x) && Number.isFinite(l.y) && (l.x > 0 || l.y > 0)
  ).length;
  const positionedParse = parsingLines.filter(
    (l) => Number.isFinite(l.x) && Number.isFinite(l.y) && (l.x > 0 || l.y > 0)
  ).length;

  return {
    stage: 'extraction_debug_bundle',
    at: new Date().toISOString(),
    method: input.method || null,
    pdfExtraction: input.pdfExtraction || null,
    metrics: {
      allLineCount: summaryAll.lineCount,
      parsingLineCount: summaryParse.lineCount,
      pageCountAll: summaryAll.pageCount,
      pageCountParsing: summaryParse.pageCount,
      coordinateRetentionRate:
        summaryAll.lineCount > 0 ? positionedAll / summaryAll.lineCount : 0,
      parsingCoordinateRetentionRate:
        summaryParse.lineCount > 0 ? positionedParse / summaryParse.lineCount : 0,
      pageBoundaryRetentionRate:
        summaryAll.pageCount > 1 && summaryParse.pageCount >= 1 ? 1 : summaryAll.pageCount >= 1 ? 1 : 0,
      hasPositionedPdfLines: hasPositionedPdfLines(parsingLines),
      flatTextFallbackUsed: !hasPositionedPdfLines(parsingLines),
      portfolioPagesExcluded: pageClass?.portfolio_pages?.length || 0,
      resumeCorePages: pageClass?.resume_core_pages || [],
    },
    pageDocumentClassification: pageClass
      ? buildPageDocumentClassificationDebug(pageClass)
      : null,
    linesByPage,
    parsingLinesByPage: parsingByPage,
    readingOrderDebug: {
      layoutType: input.layoutStage?.layoutType || input.layoutMemory?.layoutType || null,
      columnSplit: input.layoutMemory?.columnSplit ?? input.layoutStage?.columnSplit ?? null,
      orderedLineSample: (input.readingStage?.orderedLines || parsingLines)
        .slice(0, 40)
        .map((l) => ({
          page: l.page,
          x: l.x,
          y: l.y,
          text: String(l.cleanedText ?? l.text ?? '').slice(0, 120),
        })),
    },
    zoneCandidates: input.layoutStage?.signals || input.layoutMemory?.entries?.slice(0, 30) || [],
    blockReconstructionCandidates: (input.spatialBlocks || []).slice(0, 60).map((b) => ({
      page: b.page_number || b.page,
      x: b.x,
      y: b.y,
      text: String(b.text || b.content || '').slice(0, 160),
      columnId: b.column_id || b.columnId || null,
    })),
    mergedExtractionLines: parsingLines.map((l) => ({
      page: l.page,
      x: l.x,
      y: l.y,
      source: l.source,
      text: l.cleanedText ?? l.text,
    })),
    rawNativeText: linesToRawText(allLines.filter((l) => l.source === 'native')),
    ocrLines: allLines.filter((l) => l.source === 'ocr').map((l) => ({
      page: l.page,
      x: l.x,
      y: l.y,
      text: l.cleanedText ?? l.text,
    })),
    pageRuntimeTrace: input.pdfExtraction?.pageRuntimeTrace || null,
    extractionBudgetMs: input.pdfExtraction?.extractionBudgetMs || null,
    nativeTrustAudit: input.pdfExtraction?.nativeTrustAudit || null,
    runtime: {
      parserTextSource: input.parserTextSource || null,
      structureFirstParser: input.structureFirstParser ?? null,
      previewGate: input.previewGate || null,
    },
    finalPayload: {
      rawExtraction: input.rawExtraction || linesToRawText(parsingLines),
      cleanedText: input.cleanedText || linesToCleanedText(parsingLines),
      plainText: linesToPlainText(parsingLines),
      spatialBlockCount: input.spatialBlocks?.length || 0,
    },
  };
}
