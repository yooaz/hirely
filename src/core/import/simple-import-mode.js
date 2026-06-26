/**
 * V1 import — text PDF, DOCX, TXT, paste only. No OCR / image auto-read.
 */
import { detectInputFileType } from '../extraction/file-type-detect.js';
import { extractDocxWithRecovery } from '../extraction/docx-extract.js';
import { extractNativePdfLines } from '../extraction/pdf-lines-native.js';
import { readFileBuffer, cloneArrayBuffer } from '../extraction/file-buffer.js';
import { normalizeRawExtract } from '../parsing/clean.js';
import { IMPORT_STATE } from './import-state.js';
import { buildLayoutMemory } from '../layout/layout-memory.js';
import { spatialBlocksFromLayoutMemory } from '../layout/spatial-block.js';
import {
  buildPdfExtractionDebug,
} from '../extraction/pdf-extraction-debug.js';
import {
  SIMPLE_IMPORT_MIN_CHARS,
  V1_UNSUPPORTED_IMAGE_MSG,
  isV1ImportMode,
} from './v1-import-constants.js';
import { isOcrAutoImportEnabled } from './ocr-auto-import.js';
import { createResumeFromText } from './text-first-engine.js';
import { rewriteImportFromFile } from './file-import-rewrite.js';

export const SIMPLE_IMPORT_MODE = true;
export { SIMPLE_IMPORT_MIN_CHARS, PDF_IMAGE_PASTE_MSG as V1_SCANNED_PDF_MSG } from './v1-import-constants.js';
export const V1_OCR_DISABLED = true;

export function isSimpleImportMode() {
  if (globalThis.HIRELY_SIMPLE_IMPORT_MODE === false) return false;
  if (globalThis.HIRELY_V1_IMPORT === false) return false;
  return SIMPLE_IMPORT_MODE || globalThis.HIRELY_SIMPLE_IMPORT_MODE === true || globalThis.HIRELY_V1_IMPORT === true;
}

import { normalizeFinalImportTerminal } from './final-import-lock.js';

/** Map partial/ambiguous terminals to READY or NEEDS_PASTE — no IMPORT_PARTIAL trap. */
export function v1NormalizeImportTerminal(status, rawText, ctx = {}) {
  if (!isV1ImportMode() && globalThis.HIRELY_OCR_AUTO !== true) return status;
  return normalizeFinalImportTerminal(status, rawText, ctx);
}

export function canContinueWithRawText(rawText) {
  return String(rawText || '').trim().length > SIMPLE_IMPORT_MIN_CHARS;
}

function cleanRawText(rawText, cleanText) {
  return String(cleanText || rawText || '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function detectNameFromText(text) {
  const lines = String(text || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  for (const line of lines.slice(0, 10)) {
    if (line.length < 4 || line.length > 72) continue;
    if (/^(curriculum|vitae|resume|résumé|cv\b|email|tel|phone|profil|profile|coordonn)/i.test(line)) {
      continue;
    }
    if (/^[\d+().\s-]+$/.test(line)) continue;
    if (/[A-Za-zÀ-ÿ]{2,}/.test(line) && !/@/.test(line)) return line;
  }
  return 'Nom à vérifier';
}

/**
 * Flat cvData for templates when structured parsing is weak.
 * @param {string} rawText
 * @param {string} [cleanText]
 */
export function fallbackRawTextCvData(rawText, cleanText) {
  const clean = cleanRawText(rawText, cleanText);
  const lines = clean.split('\n').map((l) => l.trim()).filter(Boolean);
  const name = detectNameFromText(clean);
  const bodyLines = lines.filter((l) => l !== name);
  const email = (clean.match(/[\w.+-]+@[\w.-]+\.\w{2,}/) || [])[0] || '';
  const phone = (clean.match(/(?:\+?\d[\d\s().-]{7,}\d)/) || [])[0] || '';
  const bullets = bodyLines.length ? bodyLines.slice(0, 120) : [clean.slice(0, 4000)];
  return {
    name,
    title: 'Profil professionnel',
    email,
    phone,
    location: '',
    portfolio: '',
    linkedin: '',
    summary: '',
    experience: [
      {
        role: 'Contenu extrait',
        company: '',
        dates: '',
        bullets,
      },
    ],
    education: [],
    skills: [],
    tools: [],
    languages: [],
    clients: [],
    projects: [],
    unsorted: bullets,
    _simpleFallback: true,
    _rawBody: clean,
  };
}

/**
 * @param {string} rawText
 * @param {string} [cleanText]
 */
export function fallbackRawTextResumeData(rawText, cleanText) {
  return createResumeFromText(cleanRawText(rawText, cleanText));
}

/**
 * HTML preview when structured template render is skipped.
 * @param {string} rawText
 * @param {string} [cleanText]
 * @param {(s: string) => string} [esc]
 */
export function renderFallbackCv(rawText, cleanText, esc) {
  const cv = fallbackRawTextCvData(rawText, cleanText);
  const body = cv._rawBody || '';
  const escFn =
    typeof esc === 'function'
      ? esc
      : (s) =>
          String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
  const formatted = body
    .split('\n')
    .map((l) => {
      const t = l.trim();
      return t ? `<p class="cvFallbackLine">${escFn(t)}</p>` : '';
    })
    .join('');
  return `<header class="cvHeader cvHeader--fallback"><h1 class="cvName">${escFn(cv.name)}</h1><p class="cvTitle">${escFn(cv.title)}</p></header><section class="cvSection cvSection--fallback"><h2 class="cvSectionTitle">Contenu extrait</h2><div class="cvFallbackBody">${formatted}</div></section>`;
}

/**
 * Native PDF / DOCX / TXT only — OCR disabled.
 * @param {File} file
 */
export async function simpleExtractTextFromFile(file) {
  const input = detectInputFileType(file);
  const kind = input.kind;

  if (kind === 'image') {
    const extractionDebug = await buildPdfExtractionDebug(file, {
      rawText: '',
      ocrAttempted: false,
      ocrResultLength: 0,
    });
    extractionDebug.pasteReason = 'V1_IMAGE_UNSUPPORTED';
    extractionDebug.userMessage = V1_UNSUPPORTED_IMAGE_MSG;
    return {
      fileType: 'image',
      rawText: '',
      cleanedText: '',
      extractionMethod: 'v1-unsupported',
      warnings: ['V1_IMAGE_UNSUPPORTED'],
      errors: ['V1_IMAGE_UNSUPPORTED'],
      extractionDebug,
    };
  }

  if (kind === 'unknown' || kind === 'rtf') {
    const extractionDebug = await buildPdfExtractionDebug(file, {
      rawText: '',
      ocrAttempted: false,
      ocrResultLength: 0,
    });
    extractionDebug.pasteReason = 'V1_UNSUPPORTED_FORMAT';
    extractionDebug.userMessage = V1_UNSUPPORTED_IMAGE_MSG;
    return {
      fileType: kind,
      rawText: '',
      cleanedText: '',
      extractionMethod: 'v1-unsupported',
      warnings: ['V1_UNSUPPORTED_FORMAT'],
      errors: ['V1_UNSUPPORTED_FORMAT'],
      extractionDebug,
    };
  }

  if (kind === 'txt') {
    const text = normalizeRawExtract(await file.text());
    return {
      fileType: 'txt',
      rawText: text,
      cleanedText: text,
      extractionMethod: 'txt',
      warnings: ['SIMPLE_IMPORT_NO_OCR'],
      errors: [],
    };
  }

  if (kind === 'docx' || kind === 'doc') {
    const mammoth = globalThis.mammoth || globalThis.window?.mammoth || null;
    const buf = await readFileBuffer(file);
    const docx = await extractDocxWithRecovery(buf, mammoth);
    const text = String(docx?.text || '').trim();
    return {
      fileType: kind,
      rawText: text,
      cleanedText: text,
      extractionMethod: kind,
      warnings: ['SIMPLE_IMPORT_NO_OCR'],
      errors: [],
    };
  }

  if (kind === 'pdf') {
    if (isOcrAutoImportEnabled()) {
      const { extractPdfWithAutoOcrFallback } = await import('./pdf-ocr-auto-fallback.js');
      const ocrResult = await extractPdfWithAutoOcrFallback(file);
      const extractionDebug = await buildPdfExtractionDebug(file, {
        rawText: ocrResult.rawText,
        ocrAttempted: ocrResult.ocrAttempted === true,
        ocrResultLength: ocrResult.ocrResultLength || 0,
      });
      return {
        ...ocrResult,
        extractionDebug,
      };
    }
    const pdfjsLib = globalThis.pdfjsLib || globalThis.window?.pdfjsLib;
    if (!pdfjsLib) {
      const extractionDebug = await buildPdfExtractionDebug(file, {
        rawText: '',
        ocrAttempted: false,
        ocrResultLength: 0,
      });
      return {
        fileType: 'pdf',
        rawText: '',
        cleanedText: '',
        extractionMethod: 'native_pdf',
        warnings: ['SIMPLE_IMPORT_PDFJS_MISSING'],
        errors: ['PDF.js non chargé'],
        extractionDebug,
      };
    }
    const master = await readFileBuffer(file);
    const pdfJsBuf = cloneArrayBuffer(master);
    let pdf;
    try {
      pdf = await pdfjsLib.getDocument({ data: pdfJsBuf, isEvalSupported: false }).promise;
    } catch (err) {
      const extractionDebug = await buildPdfExtractionDebug(file, {
        rawText: '',
        ocrAttempted: false,
        ocrResultLength: 0,
      });
      return {
        fileType: 'pdf',
        rawText: '',
        cleanedText: '',
        extractionMethod: 'native_pdf',
        warnings: ['SIMPLE_IMPORT_PDF_OPEN_FAIL'],
        errors: [String(err?.message || 'PDF open failed')],
        extractionDebug,
      };
    }
    const native = await extractNativePdfLines(pdf);
    const lines = native.pages.flatMap((p) => p.lines || []);
    const text = lines
      .map((l) => String(l.cleanedText || l.text || '').trim())
      .filter(Boolean)
      .join('\n')
      .trim();
    const layoutMemory = buildLayoutMemory(lines, { source: 'pdf_native' });
    const spatialBlocks = spatialBlocksFromLayoutMemory(layoutMemory);
    const extractionDebug = await buildPdfExtractionDebug(file, {
      rawText: text,
      ocrAttempted: false,
      ocrResultLength: 0,
    });
    return {
      fileType: 'pdf',
      rawText: text,
      cleanedText: text,
      extractionMethod: 'native_pdf',
      warnings: ['SIMPLE_IMPORT_NATIVE_ONLY'],
      errors: [],
      extractionDebug,
      enterprise: {
        rawExtraction: text,
        cleanedText: text,
        lines,
        layoutMemory,
        spatialBlocks,
        method: 'native_pdf',
        metadata: {
          fileType: 'pdf_text',
          simpleImport: true,
          spatialBlocks,
          layoutMemory,
        },
      },
    };
  }

  return {
    fileType: kind,
    rawText: '',
    cleanedText: '',
    extractionMethod: kind,
    warnings: ['V1_OCR_DISABLED'],
    errors: [V1_UNSUPPORTED_IMAGE_MSG],
  };
}

/**
 * @param {File} file
 * @param {object} [opts]
 */
export async function simpleCanonicalImportFromFile(file, opts = {}) {
  return rewriteImportFromFile(file, opts);
}
