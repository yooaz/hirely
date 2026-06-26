/**
 * Multi-format extraction engine — native → OCR → merge → score → best selection.
 * Enriches every import with sourceType, text lengths, and confidenceScore.
 */

import {
  linesToPlainText,
  normalizeLineKey,
  summarizeLines,
  NATIVE_DEFAULT_CONFIDENCE,
} from './extracted-line.js';
import { dedupeExtractedLines } from './extraction-audit.js';
import { assessPdfTextLayer } from './pdf-text-quality.js';
import { scoreOcrQuality } from './ocr-quality-score.js';
import {
  selectBestTextSource,
  BEST_TEXT_SOURCE_VERSION,
  mergeLineArchivesConservative,
} from './best-text-source-selection.js';
import {
  isExactTranscriptionExtractionActive,
  concatLinesExactTruth,
  trivialTranscriptionNormalize,
} from './exact-transcription-truth.js';

export const MULTI_FORMAT_ENGINE_VERSION = 'MULTI_FORMAT_ENGINE_V1';

/** @typedef {'pdf_text'|'pdf_scanned'|'pdf_mixed'|'pdf_image'|'docx'|'doc'|'txt'|'rtf'|'image'} MultiFormatSourceType */

/**
 * @param {object} ctx
 * @param {string} [ctx.inputKind]
 * @param {string} [ctx.fileName]
 * @param {string} [ctx.method]
 * @param {string} [ctx.fileType]
 * @param {object} [ctx.pdfExtraction]
 * @param {object} [ctx.metadata]
 * @param {import('./extracted-line.js').ExtractedLine[]} [ctx.lines]
 * @returns {MultiFormatSourceType}
 */
export function resolveSourceType(ctx = {}) {
  const name = String(ctx.fileName || '').toLowerCase();
  const inputKind = String(ctx.inputKind || '').toLowerCase();
  const method = String(ctx.method || ctx.metadata?.extractionMethod || '').toLowerCase();
  const fileType = String(ctx.fileType || ctx.metadata?.fileType || ctx.pdfExtraction?.fileType || '').toLowerCase();
  const lines = ctx.lines || [];
  const nativeCount = lines.filter((l) => l.source !== 'ocr').length;
  const ocrCount = lines.filter((l) => l.source === 'ocr').length;

  if (inputKind === 'rtf' || fileType === 'rtf') return 'rtf';
  if (inputKind === 'txt' || fileType === 'txt') return 'txt';
  if (inputKind === 'image' || fileType === 'image') return 'image';
  if (inputKind === 'doc' || (name.endsWith('.doc') && !name.endsWith('.docx')) || fileType === 'doc') {
    return 'doc';
  }
  if (inputKind === 'docx' || fileType === 'docx') return 'docx';
  if (method === 'txt' && fileType !== 'rtf') return 'txt';
  if (method === 'docx') return 'docx';

  if (fileType === 'pdf_mixed' || method === 'mixed' || (nativeCount > 0 && ocrCount > 0)) {
    return 'pdf_mixed';
  }
  if (fileType === 'pdf_text' || method === 'native_pdf') return 'pdf_text';
  if (
    fileType === 'pdf_scanned' ||
    method === 'ocr' ||
    ctx.pdfExtraction?.route === 'ocr_full'
  ) {
    if (nativeCount === 0 && ocrCount > 0) return 'pdf_image';
    return 'pdf_scanned';
  }
  if (inputKind === 'pdf' || fileType.startsWith('pdf')) {
    if (nativeCount > 0 && ocrCount === 0) return 'pdf_text';
    if (ocrCount > 0 && nativeCount === 0) return 'pdf_image';
    if (nativeCount > 0 && ocrCount > 0) return 'pdf_mixed';
    return 'pdf_scanned';
  }

  return /** @type {MultiFormatSourceType} */ (fileType || inputKind || 'txt');
}

/**
 * @param {import('./extracted-line.js').ExtractedLine[]} lines
 */
export function splitLinesBySource(lines) {
  const list = lines || [];
  return {
    nativeLines: list.filter((l) => l.source !== 'ocr'),
    ocrLines: list.filter((l) => l.source === 'ocr'),
  };
}

/**
 * @param {import('./extracted-line.js').ExtractedLine[]} lines
 */
export function measureTextLength(lines) {
  return String(linesToPlainText(lines || [])).trim().length;
}

/**
 * Merge native + OCR line archives — dedupe by semantic similarity, prefer higher confidence.
 * @param {import('./extracted-line.js').ExtractedLine[]} nativeLines
 * @param {import('./extracted-line.js').ExtractedLine[]} ocrLines
 */
export function mergeNativeAndOcrLines(nativeLines, ocrLines) {
  if (isExactTranscriptionExtractionActive()) {
    return concatLinesExactTruth(nativeLines, ocrLines);
  }
  const native = nativeLines || [];
  const ocr = ocrLines || [];
  if (!native.length) return [...ocr];
  if (!ocr.length) return [...native];

  const byKey = new Map();
  for (const ln of [...native, ...ocr]) {
    const text = String(ln.cleanedText ?? ln.text ?? '').trim();
    const key = normalizeLineKey(text);
    if (!key || key.length < 2) continue;
    const prev = byKey.get(key);
    const conf = ln.confidence ?? (ln.source === 'ocr' ? 68 : NATIVE_DEFAULT_CONFIDENCE);
    if (!prev || conf > (prev.confidence ?? 0)) {
      byKey.set(key, { ...ln, confidence: conf });
    }
  }

  const combined = [...native, ...ocr];
  const deduped = dedupeExtractedLines(combined);
  if (deduped.after >= native.length) return deduped.lines;

  const seen = new Set();
  const ordered = [];
  for (const ln of combined) {
    const key = normalizeLineKey(ln.cleanedText ?? ln.text);
    if (!key || seen.has(key)) continue;
    const winner = byKey.get(key);
    if (winner) {
      seen.add(key);
      ordered.push(winner);
    }
  }
  return ordered.length ? ordered : deduped.lines;
}

/**
 * @param {object} opts
 */
export function scoreExtractionConfidence(opts = {}) {
  const {
    sourceType,
    text = '',
    lines = [],
    nativeTextLength = 0,
    ocrTextLength = 0,
    mergedTextLength = 0,
    method = '',
    metadata = {},
  } = opts;

  const summary = summarizeLines(lines);
  const list = lines || [];
  const avgLineConf = list.length
    ? list.reduce((a, l) => a + (l.confidence ?? 70), 0) / list.length
    : 0;

  let score = avgLineConf || 55;
  const richest = Math.max(nativeTextLength, ocrTextLength, mergedTextLength, String(text).trim().length);

  if (richest >= 400) score += 8;
  else if (richest >= 120) score += 4;
  else if (richest < 40) score -= 12;

  if (summary.lowConfidenceCount > 0 && list.length) {
    score -= Math.min(18, (summary.lowConfidenceCount / list.length) * 30);
  }

  const st = String(sourceType || '');
  if (st === 'pdf_text' || st === 'docx' || st === 'txt' || st === 'rtf' || st === 'doc') {
    const layer = assessPdfTextLayer(text || linesToPlainText(lines));
    if (layer.usable || layer.strongTextLayer) score = Math.max(score, layer.confidence);
    else score = Math.min(score, layer.confidence + 10);
  }

  if (st === 'pdf_scanned' || st === 'pdf_image' || st === 'pdf_mixed' || method === 'ocr' || method === 'mixed') {
    const ocrQ = scoreOcrQuality({
      text: text || linesToPlainText(lines),
      lines,
    });
    score = score * 0.45 + (ocrQ.qualityScore || 0) * 0.55;
  }

  if (metadata.nativePartialFallback || metadata.ocrPartial) score -= 6;
  if (metadata.recoveredAfterTimeout) score -= 8;

  return Math.round(Math.min(100, Math.max(0, score)));
}

/**
 * Pick best text source (native / OCR / DOCX / paste / conservative merge).
 * @param {object} opts
 */
export function selectBestExtractionVersion(opts = {}) {
  const {
    nativeText = '',
    ocrText = '',
    docxText = '',
    pastedText = '',
    nativeLines = [],
    ocrLines = [],
  } = opts;

  const pick = selectBestTextSource({
    nativeText,
    ocrText,
    docxText,
    pastedText,
    nativeLines,
    ocrLines,
  });

  let lines = pick.lines;
  if (!lines?.length) {
    if (pick.selectedSource === 'ocr') lines = ocrLines;
    else if (pick.selectedSource === 'merged') {
      lines = mergeLineArchivesConservative(nativeLines, ocrLines);
    } else if (pick.selectedSource === 'docx' || pick.selectedSource === 'pasted') {
      lines = nativeLines.length ? nativeLines : ocrLines;
    } else {
      lines = nativeLines.length ? nativeLines : ocrLines;
    }
  }

  const nativeScore = pick.scores?.native?.compositeScore ?? 0;
  const ocrScore = pick.scores?.ocr?.compositeScore ?? 0;
  const mergedScore = pick.mergedScore ?? pick.scores?.merged?.compositeScore ?? 0;

  return {
    selectedSource: pick.selectedSource,
    text: pick.text,
    lines,
    confidenceScore: pick.compositeScore,
    nativeScore,
    ocrScore,
    mergedScore,
    textSourceAudit: pick.audit,
    textSourceScores: pick.scores,
  };
}

/**
 * Resolve enterprise method from selected source.
 * @param {'native'|'ocr'|'merged'} selected
 * @param {boolean} hasNative
 * @param {boolean} hasOcr
 */
function methodFromSelection(selected, hasNative, hasOcr) {
  if (selected === 'pasted') return 'paste';
  if (selected === 'docx') return 'docx';
  if (selected === 'ocr') return 'ocr';
  if (selected === 'merged') {
    if (hasNative && hasOcr) return 'mixed';
    if (hasOcr) return 'ocr';
    return 'native_pdf';
  }
  if (hasNative) return 'native_pdf';
  if (hasOcr) return 'ocr';
  return 'paste';
}

/**
 * Enrich extraction result with multi-format metrics and apply best version.
 * @param {object} result
 * @param {string} [inputKind]
 * @param {string} [fileName]
 */
export function enrichMultiFormatExtraction(result, { inputKind, fileName } = {}) {
  const enterprise = result?.enterprise || {};
  const lines = result?.lines || enterprise.lines || [];
  const exactTruth = isExactTranscriptionExtractionActive();

  if (exactTruth) {
    const preserved = enterprise.linesAllPages || lines;
    enterprise.lines = preserved;
    enterprise.linesAllPages = preserved;
    enterprise.rawExtraction = trivialTranscriptionNormalize(
      enterprise.rawExtraction || result?.text || ''
    );
    enterprise.cleanedText = enterprise.rawExtraction;
    enterprise.text = enterprise.rawExtraction;
    enterprise.metadata = {
      ...(enterprise.metadata || {}),
      exactTruthPreserved: true,
      multiFormatSkipped: true,
    };
    return {
      ...result,
      text: enterprise.rawExtraction,
      method: enterprise.method,
      lines: preserved,
      enterprise,
      metadata: enterprise.metadata,
    };
  }

  const { nativeLines, ocrLines } = splitLinesBySource(lines);

  const nativeText = linesToPlainText(nativeLines);
  const ocrText = linesToPlainText(ocrLines);
  const mergedLines = mergeNativeAndOcrLines(nativeLines, ocrLines);
  const mergedText = linesToPlainText(mergedLines);

  const nativeTextLength = measureTextLength(nativeLines);
  const ocrTextLength = measureTextLength(ocrLines);
  const mergedTextLength = measureTextLength(mergedLines);

  const sourceType = resolveSourceType({
    inputKind: inputKind || result?.inputKind,
    fileName: fileName || result?.fileName,
    method: result?.method || enterprise.method,
    fileType: result?.fileType || enterprise.metadata?.fileType,
    pdfExtraction: result?.pdfExtraction || enterprise.pdfExtraction,
    metadata: enterprise.metadata,
    lines,
  });

  const isPdf = sourceType.startsWith('pdf');
  const isDocx = sourceType === 'docx' || sourceType === 'doc';

  const best = selectBestExtractionVersion({
    nativeText: isPdf ? nativeText : isDocx ? '' : nativeText,
    ocrText: isPdf ? ocrText : '',
    docxText: isDocx ? nativeText : '',
    pastedText: String(
      result?.pastedText || enterprise.metadata?.pastedText || ''
    ).trim(),
    nativeLines: isPdf || !isDocx ? nativeLines : lines,
    ocrLines,
  });

  const confidenceScore = scoreExtractionConfidence({
    sourceType,
    text: best.text,
    lines: best.lines,
    nativeTextLength,
    ocrTextLength,
    mergedTextLength,
    method: enterprise.method,
    metadata: enterprise.metadata,
  });

  const multiFormat = {
    engineVersion: MULTI_FORMAT_ENGINE_VERSION,
    textSourceEngine: BEST_TEXT_SOURCE_VERSION,
    sourceType,
    nativeTextLength,
    ocrTextLength,
    mergedTextLength,
    confidenceScore,
    selectedSource: best.selectedSource,
    nativeScore: best.nativeScore,
    ocrScore: best.ocrScore,
    mergedScore: best.mergedScore,
    textSourceAudit: best.textSourceAudit,
    textSourceScores: best.textSourceScores,
    pipeline: ['native', 'ocr', 'docx', 'paste', 'score', 'best_selection'],
  };

  const hasNative = nativeLines.length > 0;
  const hasOcr = ocrLines.length > 0;
  const selectedText = String(best.text || '').trim();
  const currentText = String(result?.text || enterprise.rawExtraction || '').trim();

  if (selectedText.length > 0 && selectedText.length >= currentText.length * 0.98) {
    enterprise.rawExtraction = best.text;
    enterprise.cleanedText = best.text;
    enterprise.text = best.text;
    enterprise.lines = best.lines?.length ? best.lines : lines;
    enterprise.method = methodFromSelection(best.selectedSource, hasNative, hasOcr);
  }

  enterprise.metadata = {
    ...(enterprise.metadata || {}),
    ...multiFormat,
    multiFormat,
    fileType: sourceType.startsWith('pdf_') ? sourceType : sourceType,
    extractionSource: best.selectedSource,
  };

  return {
    ...result,
    text: enterprise.rawExtraction,
    method: enterprise.method,
    fileType: result?.fileType || sourceType,
    lines: enterprise.lines,
    enterprise,
    metadata: enterprise.metadata,
    multiFormat,
  };
}
