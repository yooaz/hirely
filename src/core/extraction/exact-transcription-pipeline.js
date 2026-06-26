/**
 * Exact Transcription Mode — faithful page/line/word transcription without CV parsing.
 */

import { compareLinesReadingOrder } from '../layout/reading-order.js';
import { summarizeLines } from './extracted-line.js';
import { buildExtractionDebugBundle } from './extraction-debug-bundle.js';
import { rebuildLinesFromOcrWords, weakLineReason } from './exact-transcription-rebuild.js';
import {
  isValidWordBbox,
  isZeroWordBbox,
  sanitizeExactWordBbox,
  lineHasRealWordBoxes,
  wordHasRealOcrGeometry,
  coerceWordRealGeometry,
  traceZeroBboxPipelineBug,
  resetZeroBboxTrace,
  getZeroBboxTraceReport,
} from './ocr-geometry.js';
import {
  trivialTranscriptionNormalize,
  isExactEmptyNoiseLine,
  filterExactEmptyNoiseLines,
} from './exact-transcription-truth.js';

export const EXACT_TRANSCRIPTION_V1 = 'EXACT_TRANSCRIPTION_V1';

/**
 * @param {{ x?: number, y?: number, width?: number, height?: number, w?: number, h?: number }|null} bbox
 */
export function toContractBBox(bbox) {
  if (!bbox) return null;
  if (isZeroWordBbox(bbox)) {
    traceZeroBboxPipelineBug('toContractBBox', { reason: 'zero_bbox_rejected', incoming_bbox: bbox });
    return null;
  }
  const sanitized = sanitizeExactWordBbox(bbox);
  if (!sanitized) {
    traceZeroBboxPipelineBug('toContractBBox', { reason: 'invalid_bbox_rejected', incoming_bbox: bbox });
    return null;
  }
  return sanitized;
}

/**
 * Final exact-transcription word record — never emits [0,0 0x0].
 * @param {object} w
 * @param {string} [stage]
 */
export function finalizeExactTranscriptionWord(w, stage = 'finalizeExactTranscriptionWord') {
  const base = toContractWord(w);
  if (!base.text) return null;
  if (base.bbox && isZeroWordBbox(base.bbox)) {
    traceZeroBboxPipelineBug(stage, {
      text: base.text,
      reason: 'zero_bbox_stripped_at_output',
      incoming_bbox: base.bbox,
    });
    base.bbox = null;
    base.geometry_missing = true;
    base.geometry_missing_reason = 'zero_bbox_stripped';
  } else if (!base.bbox) {
    base.geometry_missing = true;
    base.geometry_missing_reason =
      base.inferred === true ? 'inferred_without_bbox' : 'engine_no_geometry';
  } else {
    base.geometry_missing = false;
    base.geometry_missing_reason = null;
  }
  return base;
}

/**
 * @param {object} w
 */
export function toContractWord(w) {
  const coerced = coerceWordRealGeometry(w);
  if (!coerced) {
    return {
      text: '',
      bbox: null,
      confidence: 0,
      inferred: true,
      source: 'inferred',
      page_number: null,
    };
  }
  const bbox = toContractBBox(coerced.bbox);
  const hasReal = wordHasRealOcrGeometry(coerced);
  return {
    text: coerced.text,
    bbox: hasReal ? bbox : bbox || null,
    confidence: coerced.confidence,
    inferred: hasReal ? false : coerced.inferred === true,
    source: hasReal ? coerced.source || 'ocr' : coerced.source || 'inferred',
    page_number: coerced.page_number ?? null,
  };
}

/**
 * @param {string} fileName
 */
export function buildDocumentId(fileName) {
  const base = String(fileName || 'document')
    .replace(/[^\w.-]+/g, '_')
    .slice(0, 80);
  const ts = Date.now().toString(36);
  return `doc_${base}_${ts}`;
}

/** @typedef {'native_text'|'ocr'|'hybrid'} TranscriptionLineSource */

/**
 * Minimal normalization — trivial unicode/line endings only (exact mode contract).
 * @param {string} text
 */
export function minimalTranscriptionNormalize(text) {
  return trivialTranscriptionNormalize(text).trimEnd();
}

/**
 * @param {string} [source]
 * @returns {TranscriptionLineSource}
 */
export function mapLineSourceToTranscription(source) {
  if (source === 'ocr') return 'ocr';
  if (source === 'native' || source === 'pdf_native' || source === 'native_pdf') return 'native_text';
  return 'hybrid';
}

/**
 * @param {object} line
 * @returns {{ x: number, y: number, width: number, height: number }|null}
 */
function lineBBox(line) {
  const x = Number(line?.x);
  const y = Number(line?.y);
  const w = Number(line?.width);
  const h = Number(line?.height);
  if (!Number.isFinite(x) && !Number.isFinite(y)) return null;
  return {
    x: Number.isFinite(x) ? x : 0,
    y: Number.isFinite(y) ? y : 0,
    width: Number.isFinite(w) && w > 0 ? w : 0,
    height: Number.isFinite(h) && h > 0 ? h : 0,
  };
}

/**
 * Prefer engine word boxes; infer only when no real geometry exists for the line.
 * @param {object[]} lineWords
 * @param {object[]} pageOcrWords
 * @param {{ x: number, y: number, width: number, height: number }|null} bbox
 * @param {string} text
 * @param {number} confidence
 */
export function resolveLineWords(lineWords, pageOcrWords, bbox, text, confidence = 70) {
  let words = (lineWords || [])
    .map((w) => coerceWordRealGeometry({ ...w, confidence: w.confidence ?? confidence }))
    .filter(Boolean);

  const pageReal = (pageOcrWords || [])
    .map((w) => coerceWordRealGeometry(w))
    .filter((w) => w && wordHasRealOcrGeometry(w));

  if (!words.some((w) => wordHasRealOcrGeometry(w)) && pageReal.length && bbox) {
    words = pageReal.filter((w) => {
      const h = w.bbox.height || w.bbox.h || 12;
      const cy = (w.bbox.y ?? 0) + h / 2;
      return cy >= bbox.y - 4 && cy <= bbox.y + (bbox.height || 14) + 4;
    });
  } else if (pageReal.length && words.length) {
    const have = new Set(words.map((w) => w.text.toLowerCase()));
    for (const pw of pageReal) {
      if (wordHasRealOcrGeometry(pw) && !have.has(pw.text.toLowerCase())) {
        if (!bbox) {
          words.push(pw);
          continue;
        }
        const h = pw.bbox.height || pw.bbox.h || 12;
        const cy = (pw.bbox.y ?? 0) + h / 2;
        if (cy >= bbox.y - 6 && cy <= bbox.y + (bbox.height || 14) + 6) {
          words.push(pw);
          have.add(pw.text.toLowerCase());
        }
      }
    }
  }

  if (words.some((w) => wordHasRealOcrGeometry(w))) {
    return words.map((w) =>
      wordHasRealOcrGeometry(w) ? { ...w, inferred: false, source: w.source || 'ocr' } : w
    );
  }

  return inferWordsFromLine(text, bbox, confidence);
}

/**
 * Split line text into word boxes when OCR word boxes are unavailable.
 * @param {string} text
 * @param {{ x: number, y: number, width: number, height: number }|null} bbox
 * @param {number} confidence
 */
export function inferWordsFromLine(text, bbox, confidence = 70) {
  const raw = String(text || '').trim();
  if (!raw) return [];
  const parts = raw.split(/\s+/).filter(Boolean);
  if (!parts.length) return [];

  if (!bbox || (!bbox.width && !bbox.height)) {
    return parts.map((w) => ({
      text: w,
      bbox: null,
      confidence,
      inferred: true,
      source: 'inferred',
    }));
  }

  const totalChars = parts.reduce((n, w) => n + w.length, 0) || parts.length;
  const gap = Math.max(2, Math.round(bbox.width * 0.02));
  let cursor = bbox.x;
  const wordH = bbox.height > 0 ? bbox.height : 12;

  return parts.map((w) => {
    const share = Math.max(1, w.length) / totalChars;
    const width = bbox.width > 0 ? Math.max(8, Math.round(bbox.width * share) - gap) : 0;
    const word = {
      text: w,
      bbox: {
        x: cursor,
        y: bbox.y,
        width,
        height: wordH,
      },
      confidence,
      inferred: true,
      source: 'inferred',
    };
    cursor += width + gap;
    return word;
  });
}

/**
 * @param {import('./extracted-line.js').ExtractedLine} line
 * @param {number} pageNumber
 * @param {number} lineIndex
 * @param {object[]} [pageOcrWords]
 */
export function lineToTranscriptionRecord(line, pageNumber, lineIndex, pageOcrWords = []) {
  const rawText = String(line.rawExtraction ?? line.text ?? '');
  if (isExactEmptyNoiseLine({ rawExtraction: rawText })) return null;
  const text = minimalTranscriptionNormalize(rawText);
  const bbox = lineBBox(line);
  const confidence = Math.round(line.confidence ?? 70);
  const words = resolveLineWords(line.words, pageOcrWords, bbox, text || rawText, confidence);

  const contractWords = words
    .map((w) => finalizeExactTranscriptionWord(w, 'lineToTranscriptionRecord'))
    .filter(Boolean);
  const realWordBoxes = lineHasRealWordBoxes({ words: contractWords });

  return {
    id: `p${pageNumber}-l${lineIndex}`,
    page_number: pageNumber,
    line_index: lineIndex,
    text,
    raw_text: rawText,
    words: contractWords,
    bbox: toContractBBox(bbox),
    confidence,
    source: mapLineSourceToTranscription(line.source),
    column_id: line.columnId || null,
    region: line.region || null,
    real_word_boxes: realWordBoxes,
    weak_reason: weakLineReason({
      text,
      raw_text: rawText,
      confidence,
      bbox,
      words: contractWords,
      real_word_boxes: realWordBoxes,
    }),
  };
}

/**
 * @param {import('./extracted-line.js').ExtractedLine[]} lines
 */
function resolvePageExtractionMethod(lines) {
  const list = lines || [];
  const native = list.filter((l) => l.source === 'native').length;
  const ocr = list.filter((l) => l.source === 'ocr').length;
  if (native && ocr) return 'hybrid';
  if (ocr) return 'ocr';
  if (native) return 'native_text';
  return 'hybrid';
}

/**
 * @param {import('./extracted-line.js').ExtractedLine[]} lines
 * @param {object[]} [pageOcrWords]
 */
function pageConfidenceSummary(lines, pageOcrWords = []) {
  const confs = (lines || []).map((l) => Number(l.confidence ?? 0)).filter((n) => Number.isFinite(n));
  const wordConfs = (pageOcrWords || [])
    .map((w) => Number(w.confidence ?? 0))
    .filter((n) => Number.isFinite(n) && n > 0);
  const avg_line_confidence = confs.length
    ? Math.round(confs.reduce((a, b) => a + b, 0) / confs.length)
    : 0;
  const avg_word_confidence = wordConfs.length
    ? Math.round(wordConfs.reduce((a, b) => a + b, 0) / wordConfs.length)
    : avg_line_confidence;
  const low_confidence_line_count = confs.filter((c) => c < 60).length;
  return {
    avg_line_confidence,
    avg_word_confidence,
    low_confidence_line_count,
    min: confs.length ? Math.min(...confs) : 0,
    max: confs.length ? Math.max(...confs) : 0,
    avg: avg_line_confidence,
    low_count: low_confidence_line_count,
    line_count: confs.length,
  };
}

/**
 * @param {object[]} pageOcrWords
 */
function pageRawWordsFromEngine(pageOcrWords) {
  return (pageOcrWords || [])
    .map((w) => finalizeExactTranscriptionWord(w, 'pageRawWordsFromEngine'))
    .filter((w) => w?.text);
}

/**
 * @param {object[]} lines
 */
function sanitizeTranscriptionLines(lines) {
  return (lines || []).map((line) => {
    const words = (line.words || [])
      .map((w) => finalizeExactTranscriptionWord(w, 'sanitizeTranscriptionLines'))
      .filter(Boolean);
    const lineBbox = toContractBBox(line.bbox);
    return {
      ...line,
      bbox: lineBbox,
      words,
      real_word_boxes: lineHasRealWordBoxes({ words }),
    };
  });
}

/**
 * @param {string} plain
 * @param {number} [page]
 */
function synthesizeLinesFromPlainText(plain, page = 1) {
  const chunks = String(plain || '').split(/\n\n+/);
  if (chunks.length > 1) {
    /** @type {import('./extracted-line.js').ExtractedLine[]} */
    const out = [];
    let pageNum = 1;
    for (const chunk of chunks) {
      const lines = chunk.split('\n').map((t) => t.trim()).filter(Boolean);
      lines.forEach((text, line) => {
        out.push({
          text,
          rawExtraction: text,
          cleanedText: text,
          confidence: 55,
          source: 'ocr',
          page: pageNum,
          line,
          x: 0,
          y: 0,
        });
      });
      pageNum += 1;
    }
    if (out.length) return out;
  }
  return String(plain || '')
    .split('\n')
    .map((t) => t.trim())
    .filter(Boolean)
    .map((text, line) => ({
      text,
      rawExtraction: text,
      cleanedText: text,
      confidence: 55,
      source: 'ocr',
      page,
      line,
      x: 0,
      y: 0,
    }));
}

/**
 * @param {object} input
 * @param {object} [input.enterprise]
 * @param {object} [input.extracted]
 * @param {File|object} [input.file]
 * @param {string} [input.fileName]
 * @param {string} [input.extractionMethod]
 * @param {string} [input.fileType]
 */
export function buildExactTranscription(input = {}) {
  resetZeroBboxTrace();
  const enterprise = input.enterprise || input.extracted?.enterprise || {};
  const ocrWordsByPage = enterprise.metadata?.ocrWordsByPage || enterprise.pdfExtraction?.ocrWordsByPage || {};
  let allLines =
    enterprise.linesAllPages ||
    enterprise.allLines ||
    enterprise.lines ||
    input.extracted?.lines ||
    [];
  if (!allLines.length) {
    const plain = String(
      input.extracted?.rawText ||
        input.extracted?.cleanedText ||
        input.extracted?.text ||
        enterprise.rawExtraction ||
        enterprise.text ||
        enterprise.cleanedText ||
        ''
    );
    allLines = synthesizeLinesFromPlainText(plain);
  }
  if (Object.keys(ocrWordsByPage || {}).length) {
    allLines = rebuildLinesFromOcrWords(allLines, ocrWordsByPage);
  }
  const pageClass = enterprise.metadata?.pageDocumentClassification || null;
  const pdfExtraction = enterprise.pdfExtraction || enterprise.metadata?.pdfExtraction || null;
  const pageRuntimeTrace = pdfExtraction?.pageRuntimeTrace || enterprise.metadata?.pageRuntimeTrace || [];
  const ocrPagePreviews =
    (typeof globalThis !== 'undefined' && globalThis.__HIRELY_OCR_PAGE_PREVIEWS__) ||
    enterprise.metadata?.ocrPagePreviews ||
    {};

  const fileName = input.fileName || input.file?.name || 'upload';
  const document_id = input.documentId || buildDocumentId(fileName);

  const byPage = new Map();
  for (const ln of allLines) {
    const p = ln.page || 1;
    if (!byPage.has(p)) byPage.set(p, []);
    byPage.get(p).push(ln);
  }

  const pageNumbers = [...byPage.keys()].sort((a, b) => a - b);
  if (!pageNumbers.length) pageNumbers.push(1);

  /** @type {object[]} */
  const pages = [];
  /** @type {object[]} */
  const flatLines = [];

  for (const pageNumber of pageNumbers) {
    const pageLines = [...(byPage.get(pageNumber) || [])].sort(compareLinesReadingOrder);
    const pageOcrWords = ocrWordsByPage[pageNumber] || ocrWordsByPage[String(pageNumber)] || [];
    const transcriptionLines = pageLines
      .map((ln, i) => lineToTranscriptionRecord(ln, pageNumber, i, pageOcrWords))
      .filter(Boolean);
    const sanitizedLines = sanitizeTranscriptionLines(transcriptionLines);
    sanitizedLines.forEach((rec) => flatLines.push(rec));

    const engineWords = pageRawWordsFromEngine(pageOcrWords);
    const raw_words = engineWords.length
      ? engineWords
      : sanitizedLines.flatMap((l) => l.words || []);
    const coordinates_present = sanitizedLines.some(
      (l) => l.bbox && ((l.bbox.w ?? l.bbox.width) > 0 || l.bbox.x > 0 || l.bbox.y > 0)
    ) || engineWords.some((w) => w.bbox && isValidWordBbox(w.bbox));

    pages.push({
      page_number: pageNumber,
      extraction_method: resolvePageExtractionMethod(pageLines),
      raw_words,
      raw_lines: sanitizedLines,
      reading_order: sanitizedLines.map((l) => l.id),
      coordinates_present,
      confidence_summary: pageConfidenceSummary(pageLines, pageOcrWords),
      runtime_trace: pageRuntimeTrace.find((t) => t.page === pageNumber) || null,
    });
  }

  const plainText = pages
    .map((p) => p.raw_lines.map((l) => l.text).filter(Boolean).join('\n'))
    .filter(Boolean)
    .join('\n\n');

  const summary = summarizeLines(allLines);
  const portfolioPages = pageClass?.portfolio_pages || [];
  const weakPages = pages
    .filter((p) => {
      const cs = p.confidence_summary;
      return cs.line_count === 0 || cs.avg_line_confidence < 55 || cs.low_confidence_line_count >= Math.max(2, Math.ceil(cs.line_count * 0.4));
    })
    .map((p) => p.page_number);

  const realWordBoxLines = flatLines.filter((l) => l.real_word_boxes).length;
  const inferredOnlyLines = flatLines.filter((l) => l.weak_reason === 'inferred_word_boxes_only').length;
  const zeroBboxTrace = getZeroBboxTraceReport();
  const zeroBboxWords = flatLines.reduce(
    (n, l) =>
      n +
      (l.words || []).filter((w) => w.geometry_missing_reason === 'zero_bbox_stripped').length,
    0
  );

  const missingNativePages = pages
    .filter((p) => {
      const trace = p.runtime_trace;
      if (trace?.corruptNativeRejected) return true;
      if (trace?.method === 'ocr' && trace?.nativeCharCount > 0 && trace?.lineCount === 0) return true;
      return p.extraction_method === 'ocr' && p.confidence_summary.line_count === 0;
    })
    .map((p) => p.page_number);

  const debugBundle = buildExtractionDebugBundle({
    allLines,
    parsingLines: allLines,
    method: input.extractionMethod || enterprise.method,
    pdfExtraction,
    pageDocumentClassification: pageClass,
    rawExtraction: plainText,
    cleanedText: plainText,
    parserTextSource: 'exact_transcription',
    structureFirstParser: false,
    previewGate: { suppressed: true, reason: 'exact_transcription_mode' },
  });

  return {
    version: EXACT_TRANSCRIPTION_V1,
    document_id,
    mode: 'exact_transcription',
    generated_at: new Date().toISOString(),
    file_name: fileName,
    file_type: input.fileType || enterprise.metadata?.fileType || null,
    extraction_method: input.extractionMethod || enterprise.method || null,
    parser_skipped: true,
    template_suppressed: true,
    plain_text: plainText,
    page_count: pages.length,
    line_count: flatLines.length,
    coordinates_present: pages.some((p) => p.coordinates_present),
    pages,
    lines: flatLines,
    metrics: {
      ...summary,
      portfolio_like_pages: portfolioPages,
      weak_pages: weakPages,
      missing_or_corrupt_native_pages: missingNativePages,
      geometry: {
        real_word_box_lines: realWordBoxLines,
        inferred_only_lines: inferredOnlyLines,
        zero_bbox_pipeline_bugs: zeroBboxTrace.length,
        zero_bbox_words_stripped: zeroBboxWords,
      },
    },
    diff_report: {
      page_by_page_artifact: pages.map((p) => ({
        page_number: p.page_number,
        line_count: p.raw_lines.length,
        extraction_method: p.extraction_method,
        confidence_summary: p.confidence_summary,
        is_portfolio_like: portfolioPages.includes(p.page_number),
        is_weak: weakPages.includes(p.page_number),
        native_missing_or_corrupt: missingNativePages.includes(p.page_number),
        line_dump: p.raw_lines.map((l) => ({
          id: l.id,
          text: l.text,
          confidence: l.confidence,
          source: l.source,
          bbox: l.bbox,
        })),
      })),
      ocr_confidence_summary: {
        avg: flatLines.length
          ? Math.round(flatLines.reduce((n, l) => n + (l.confidence || 0), 0) / flatLines.length)
          : 0,
        low_confidence_lines: flatLines.filter((l) => l.confidence < 60).length,
      },
      portfolio_like_pages: portfolioPages,
      weak_spots: weakPages.map((pn) => {
        const page = pages.find((p) => p.page_number === pn);
        return {
          page_number: pn,
          reason:
            page?.confidence_summary?.line_count === 0
              ? 'no_lines'
              : page?.confidence_summary?.avg < 55
                ? 'low_avg_confidence'
                : 'many_low_confidence_lines',
          confidence_summary: page?.confidence_summary || null,
        };
      }),
      native_text_gaps: missingNativePages,
    },
    extraction_debug: debugBundle,
    artifacts: {
      ocr_words_by_page: ocrWordsByPage,
      ocr_page_previews: ocrPagePreviews,
      page_runtime_trace: pageRuntimeTrace,
      weak_line_report: flatLines
        .filter((l) => l.weak_reason)
        .map((l) => ({
          id: l.id,
          page_number: l.page_number,
          line_index: l.line_index,
          reason: l.weak_reason,
          confidence: l.confidence,
          text: l.raw_text || l.text,
        })),
      zero_bbox_trace: zeroBboxTrace,
    },
  };
}
