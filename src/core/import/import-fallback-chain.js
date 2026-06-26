/**
 * P0 — Bulletproof import fallback chain.
 *
 * PDF native text → OCR → raw extraction.
 * Never block when any text exists; always produce resumeData / cvData.
 */
import { IMPORT_STATE } from './import-state.js';
import { createResumeFromText } from './text-first-engine.js';
import { runRecruiterExtractionPipeline } from '../extraction/recruiter-extraction-pipeline.js';
import { resumeDataToCvData } from '../resume-data.js';
import {
  fallbackRawTextResumeData,
  fallbackRawTextCvData,
  canContinueWithRawText,
} from './simple-import-mode.js';
import { hirelyProductLog } from '../runtime/hirely-debug.js';
import { attachRecruiterAuditToImportResult } from '../validation/recruiter-audit-engine.js';
import {
  applyExtractionHonestMode,
  isWeakOcrQuality,
} from './extraction-honest-mode.js';

export const IMPORT_FALLBACK_CHAIN_VERSION = 'IMPORT_FALLBACK_CHAIN_P0';

/** Extraction tiers attempted in order for PDF/image. */
export const FALLBACK_CHAIN_STEPS = Object.freeze(['native_pdf', 'ocr', 'raw_extraction']);

/**
 * @param {string} extractionMethod
 * @param {{ rawFallback?: boolean }} [opts]
 */
export function resolveFallbackStep(extractionMethod, opts = {}) {
  if (opts.rawFallback) return 'raw_extraction';
  const m = String(extractionMethod || '').toLowerCase();
  if (m === 'native_pdf' || m === 'pdf-text' || m === 'txt' || m === 'docx') return 'native_pdf';
  if (/ocr|pdf-ocr|mixed|image|image-ocr/.test(m)) return 'ocr';
  return m || 'raw_extraction';
}

/**
 * Build import result with guaranteed resumeData + templateData from any non-empty text.
 * @param {object} base
 * @param {object} [opts]
 * @returns {object|null} null only when raw text is empty
 */
export function buildGuaranteedImportResult(base = {}, opts = {}) {
  const raw = String(base.rawText || base.cleanedText || '').trim();
  const clean = String(base.cleanedText || raw).trim();
  if (!raw.length) return null;

  const fileType = base.fileType || opts.fileType || 'file';
  const extractionMethod = base.extractionMethod || opts.extractionMethod || 'raw_extraction';
  const fallbackStep = resolveFallbackStep(extractionMethod, {
    rawFallback: opts.forceRawFallback === true || !base.resumeData,
  });

  hirelyProductLog('IMPORT_FALLBACK_CHAIN', {
    step: fallbackStep,
    chars: raw.length,
    method: extractionMethod,
  });

  let resumeData = base.resumeData || null;
  let templateData = base.templateData || null;

  if (!resumeData) {
    try {
      const recruiter = runRecruiterExtractionPipeline(clean || raw, {
        extractionMethod: extractionMethod,
        ocrDetected: /ocr|pdf-ocr|mixed|image/i.test(String(extractionMethod || '')),
      });
      resumeData = recruiter.resumeData;
      templateData = recruiter.templateData;
      if (!base.cvDataV2) base.cvDataV2 = recruiter.cvDataV2;
    } catch {
      /* fall through */
    }
  }
  if (!resumeData) {
    try {
      resumeData = createResumeFromText(clean || raw, { ocrConfidence: base.ocrConfidence });
      templateData = resumeDataToCvData(resumeData, { skipNormalize: true });
    } catch {
      resumeData = fallbackRawTextResumeData(raw, clean);
      templateData = fallbackRawTextCvData(raw, clean);
    }
  }
  if (resumeData && isWeakOcrQuality(base.ocrConfidence) && !resumeData.meta?.extractionHonestMode) {
    resumeData = applyExtractionHonestMode(resumeData, { ocrConfidence: base.ocrConfidence });
    try {
      templateData = resumeDataToCvData(resumeData, { skipNormalize: true });
    } catch {
      /* keep prior templateData */
    }
  }
  if (!templateData && resumeData) {
    try {
      templateData = resumeDataToCvData(resumeData, { skipNormalize: true });
    } catch {
      templateData = fallbackRawTextCvData(raw, clean);
    }
  }

  const importState = canContinueWithRawText(raw)
    ? IMPORT_STATE.IMPORT_READY
    : IMPORT_STATE.IMPORT_PARTIAL;

  return attachRecruiterAuditToImportResult({
    fileType,
    rawText: raw,
    cleanedText: clean,
    extractionMethod,
    importState,
    importStatus:
      importState === IMPORT_STATE.IMPORT_READY ? 'IMPORT_SUCCESS' : 'PARTIAL_TEXT_RECOVERED',
    structuredResume: base.structuredResume || null,
    templateData,
    resumeData,
    cvDataV2: base.cvDataV2 || null,
    blocks: base.blocks || [],
    errors: base.errors || [],
    warnings: [...(base.warnings || []), `FALLBACK_${String(fallbackStep).toUpperCase()}`],
    extractionDebug: base.extractionDebug || null,
    ocrConfidence: base.ocrConfidence ?? null,
    ocrLowConfidenceWarning: base.ocrLowConfidenceWarning || null,
    fallbackStep,
    guaranteed: true,
    success: true,
    file: base.file || opts.file || null,
  });
}

/**
 * User-visible failure copy — never silent.
 * @param {string} code
 */
export function importFailureUserMessage(code) {
  const c = String(code || '').trim();
  if (c === 'CORE_BOOT_FAILED') return 'Le moteur d\'import n\'a pas démarré. Rechargez la page.';
  if (c === 'FILE_IMPORT_TIMEOUT' || c === 'IMPORT_STUCK_TIMEOUT') {
    return 'La lecture a pris trop de temps — un aperçu partiel sera affiché si du texte a été récupéré.';
  }
  if (c === 'NO_TEXT_EXTRACTED') return 'Aucun texte détecté dans ce fichier.';
  if (c === 'OCR_LOW_CONFIDENCE') return 'Lecture partielle — vérifiez les lignes extraites.';
  return 'Import partiel — vérifiez le contenu dans Relecture.';
}
