/**
 * HirelyImportResult — single canonical object from file/paste through render.
 *
 * handleFileImport → runHirelyImportFromFile
 * paste            → runHirelyImportFromText
 */

import { extractFromFileDetailed } from '../extraction/extract-file.js';
import { runProductionExtractionPipeline } from './production-pipeline.js';
import { structuredToCvData } from '../parsing/structured-resume.js';
import { NAME_UNCERTAIN_LABEL, TITLE_UNCERTAIN_LABEL } from '../parsing/parser-recovery.js';
import { validatePhone } from '../parsing/rich-parser.js';
import { isValidIdentityName, isValidIdentityTitle } from '../parsing/identity-extraction.js';
import { cleanExtraction } from '../parsing/rich-parser.js';
import { normalizeEmail, normalizePhone } from '../parsing/line-cleaner.js';
import {
  normalizePipelineTexts,
  coerceParserInputText,
  slimStructuredResume,
  guardStructuredResumeSize,
  buildDebugReport,
  assertExperienceRecovery,
  recoverExperienceLinesToUnsorted,
  stripCvDataForTemplate,
  assertStrictStructuredResumeKeys,
  STRUCTURED_RESUME_JSON_MAX,
} from './pipeline-contract.js';
import { hirelyDebugWarn } from '../runtime/hirely-debug.js';
import {
  emptyResumeData,
  resumeDataFromStructured,
  resumeDataFromImport,
  resumeDataToCvData,
  normalizeResumeData,
  buildResumeData,
} from '../resume-data.js';
import {
  IMPORT_STATUS,
  resolveImportStatus,
  importStatusAllowsParser,
} from '../import/import-status.js';
import { hasRenderableImportText } from '../import/import-render-guard.js';
import { assessOcrBeforeParser } from '../import/ocr-parser-gate.js';
import { OCR_QUALITY_FAIL_MSG } from '../extraction/ocr-quality-score.js';
import { isHirelyFlowLocked, logPipelineStage } from './hirely-flow-lock.js';
import { normalizeImportResultShape } from '../runtime/pipeline-stage-result.js';
import { applyCvRebuildEngine } from './cv-rebuild-engine.js';
import { repairResumeDataFromRaw } from '../parsing/import-repair.js';
import { reconcileCreativeSections } from '../creative-resume-mode.js';
import { enterpriseHasSpatialParseInput } from '../parsing/cv-block-parser-bridge.js';

/**
 * @typedef {object} HirelyImportResult
 * @property {{ name: string, type: string, size: number }|null} file
 * @property {string} rawText
 * @property {string} cleanedText
 * @property {object[]} blocks
 * @property {object|null} structuredResume
 * @property {object|null} templateData
 * @property {object|null} resumeData
 * @property {string[]} errors
 * @property {string[]} warnings
 * @property {string} [importStatus]
 */

/** @param {File|null} [file] @returns {HirelyImportResult} */
export function emptyHirelyImportResult(file = null) {
  return {
    file: file
      ? { name: String(file.name || ''), type: String(file.type || ''), size: Number(file.size) || 0 }
      : null,
    rawText: '',
    cleanedText: '',
    blocks: [],
    structuredResume: null,
    templateData: null,
    resumeData: null,
    errors: [],
    warnings: [],
    importStatus: IMPORT_STATUS.PASTE_FALLBACK_REQUIRED,
  };
}

/** @param {object[]} blocks */
export function slimImportBlocks(blocks = []) {
  return (blocks || []).map((b) => ({
    id: b.id,
    type: b.type || b.bucket || 'unknown',
    text: String(b.text || '').slice(0, 800),
    confidence: b.confidence ?? 0,
    accepted: b.accepted !== false,
  }));
}

/**
 * Product fallback — never blank, never fake identity.
 * @param {string} cleanedText
 * @param {string} [rawText]
 */
export function buildProductFallback(cleanedText, rawText = '') {
  if (isHirelyFlowLocked()) {
    hirelyDebugWarn('PRODUCT_FALLBACK_SKIPPED_FLOW_LOCK');
    const texts = normalizePipelineTexts(rawText || cleanedText, cleanedText);
    return {
      structuredResume: null,
      templateData: stripCvDataForTemplate(emptyResumeData()),
      resumeData: emptyResumeData(),
      warnings: ['PRODUCT_FALLBACK_DISABLED_FLOW_LOCK'],
      errors: [],
      rawText: texts.rawText,
      cleanedText: texts.cleanedText,
    };
  }
  const texts = normalizePipelineTexts(rawText || cleanedText, cleanedText);
  const clean = texts.cleanedText;
  const lines = clean
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 2);
  const unsorted = lines.filter((l) => !/@/.test(l) && !/^\+?\d[\d\s().-]{6,}/.test(l));

  const structuredResume = slimStructuredResume({
    identity: {
      name: NAME_UNCERTAIN_LABEL,
      title: TITLE_UNCERTAIN_LABEL,
      email: normalizeEmail(clean),
      phone: normalizePhone(clean),
      location: '',
      website: '',
      linkedin: '',
    },
    summary: '',
    experiences: [],
    education: [],
    clients: [],
    projects: [],
    skills: [],
    tools: [],
    languages: [],
    unsorted,
  });

  const templateData = structuredToCvData(structuredResume);
  templateData.name = NAME_UNCERTAIN_LABEL;
  templateData.title = TITLE_UNCERTAIN_LABEL;
  templateData.unsorted = unsorted;
  templateData.toClassify = unsorted.slice(0, 48).map((text, i) => ({
    id: `tc-fb-${i}`,
    text,
    source: 'fallback',
  }));
  const resumeData = resumeDataFromStructured(structuredResume);

  return { structuredResume, templateData, resumeData };
}

/**
 * Apply identity + size guards on structured resume.
 * @param {object|null} structured
 * @param {string} cleanedText
 */
export function finalizeStructuredResumeForProduct(structured, cleanedText) {
  if (!structured) return null;
  let sr = { ...structured };

  const expCheck = assertExperienceRecovery(sr, cleanedText);
  if (!expCheck.ok) {
    recoverExperienceLinesToUnsorted(sr, cleanedText);
  }

  const id = { ...(sr.identity || {}) };
  const bridgeApplied =
    sr.metadata?.blockParserBridgeApplied === true ||
    sr.metadata?.blockParserBridge?.applied === true;

  const name = String(id.name || '').trim();
  if (
    !bridgeApplied &&
    (!name || /print logo|vector art|illusthatch/i.test(name) || !isValidIdentityName(name))
  ) {
    id.name = NAME_UNCERTAIN_LABEL;
  } else if (bridgeApplied && name && /print logo|vector art|illusthatch/i.test(name)) {
    id.name = NAME_UNCERTAIN_LABEL;
  }

  id.title = String(id.title || '').trim();
  if (
    !bridgeApplied &&
    (!id.title || /print logo|vector art|illusthatch/i.test(id.title) || !isValidIdentityTitle(id.title))
  ) {
    id.title = TITLE_UNCERTAIN_LABEL;
  } else if (bridgeApplied && id.title && /print logo|vector art|illusthatch/i.test(id.title)) {
    id.title = TITLE_UNCERTAIN_LABEL;
  }
  const phone = String(id.phone || '').trim();
  const phoneDigits = phone.replace(/\D/g, '');
  if (!phone || !validatePhone(phone) || phoneDigits.length > 15) {
    id.phone = '';
  } else {
    id.phone = phone;
  }
  sr.identity = id;

  const guarded = guardStructuredResumeSize(sr, cleanedText);
  const keyCheck = assertStrictStructuredResumeKeys(guarded.resume);
  if (!keyCheck.ok) {
    hirelyDebugWarn('STRUCTURED_RESUME_FORBIDDEN_KEYS', keyCheck.forbidden);
  }
  return {
    slim: guarded.resume,
    debugReport: buildDebugReport(sr, { cleanedText }),
    size: guarded.size,
    fallback: guarded.fallback,
  };
}

/**
 * Convert legacy pipeline output → HirelyImportResult.
 * @param {object} pipe
 * @param {File|null} [file]
 * @returns {HirelyImportResult}
 */
export function productionToHirelyImportResult(pipe, file = null, opts = {}) {
  const result = emptyHirelyImportResult(file);
  if (!pipe) {
    result.errors.push('PIPELINE_EMPTY');
    return result;
  }

  const texts = normalizePipelineTexts(pipe.rawText, pipe.cleanedText);
  result.rawText = texts.rawText;
  result.cleanedText = texts.cleanedText;
  result.blocks = slimImportBlocks(
    pipe.stages?.documentBlocks?.documentBlocks || pipe.blocks || []
  );

  if (pipe.audit?.warnings?.length) {
    result.warnings.push(...pipe.audit.warnings);
  }

  const finalized = finalizeStructuredResumeForProduct(pipe.structuredResume, result.cleanedText);
  result.structuredResume = finalized?.slim || null;
  result.debugReport =
    pipe.debugReport ||
    finalized?.debugReport ||
    buildDebugReport(pipe.structuredResume, {
      rawText: result.rawText,
      cleanedText: result.cleanedText,
      audit: pipe.audit,
      reviewQueue: pipe.reviewQueue,
    });
  if (finalized?.fallback) {
    result.warnings.push('structuredResume reduced to identity + unsorted (size guard)');
  }
  result.reviewQueue = pipe.reviewQueue || [];

  const bridgeApplied =
    pipe.audit?.blockParserBridgeApplied === true ||
    pipe.structuredResume?.metadata?.blockParserBridgeApplied === true ||
    pipe.structuredResume?.metadata?.blockParserApplied === true;

  const spatialInput = enterpriseHasSpatialParseInput(
    pipe.enterpriseExtraction || pipe.stages?.document?.enterprise
  );
  const skipFlatRepair = bridgeApplied || spatialInput;
  if (spatialInput && !bridgeApplied) {
    result.warnings.push('SPATIAL_PARSE_DEGRADED');
  }

  const parseResponse =
    pipe.audit?.parseResponse ||
    pipe.structuredResume?.metadata?.parseResponse ||
    null;

  result.parseResponse = parseResponse;

  result.resumeData = buildResumeData({
    importResult: result,
    structured: result.structuredResume,
    rawText: result.rawText,
    cleanedText: result.cleanedText,
    sourceText: opts.sourceText || '',
    file: result.file,
    fileType: result.file?.name?.split('.').pop() || '',
    extractionMethod: pipe.extractionMethod || '',
    warnings: result.warnings,
    errors: result.errors,
    rejectedLines: pipe.rejectedLines || [],
    blockParserBridgeApplied: bridgeApplied,
  });

  const rebuilt = skipFlatRepair
    ? {
        structuredResume: result.structuredResume,
        resumeData: result.resumeData,
        finalResumeData: result.resumeData,
        cvData: result.templateData,
        audit: {
          skipped: true,
          reason: bridgeApplied ? 'block_parser_bridge_applied' : 'spatial_parse_input_no_flat_repair',
        },
      }
    : applyCvRebuildEngine({
        rawText: result.rawText,
        cleanedText: result.cleanedText,
        structuredResume: result.structuredResume,
        resumeData: result.resumeData,
        lines: pipe.stages?.documentBlocks?.lines || pipe.lines,
        extractionMethod: pipe.extractionMethod || '',
        pipe,
      });
  if (rebuilt.structuredResume) result.structuredResume = rebuilt.structuredResume;
  if (rebuilt.resumeData) {
    result.resumeData = skipFlatRepair
      ? rebuilt.resumeData
      : repairResumeDataFromRaw(rebuilt.resumeData, {
          rawText: result.rawText,
          cleanedText: result.cleanedText,
        });
    if (!skipFlatRepair) {
      result.resumeData = reconcileCreativeSections(result.resumeData);
    }
    if (bridgeApplied) {
      result.resumeData.meta = {
        ...(result.resumeData.meta || {}),
        blockParserBridgeApplied: true,
        flatRepairSkipped: true,
        spatialParseInput: spatialInput || undefined,
      };
    } else if (spatialInput) {
      result.resumeData.meta = {
        ...(result.resumeData.meta || {}),
        spatialParseInput: true,
        flatRepairSkipped: true,
      };
    }
  }
  if (rebuilt.finalResumeData) result.finalResumeData = rebuilt.finalResumeData;
  result.templateData = stripCvDataForTemplate(rebuilt.cvData || resumeDataToCvData(result.resumeData));
  result.rebuildEngine = rebuilt.audit || null;
  result.importStatus = resolveImportStatus(result.rawText, {
    errors: result.errors,
    extractionMethod: pipe.extractionMethod,
  });

  return result;
}

/**
 * @param {string} rawText
 * @param {object} [opts]
 * @returns {Promise<HirelyImportResult>}
 */
export async function runHirelyImportFromText(rawText, opts = {}) {
  const raw = String(rawText || '').trim();
  const result = emptyHirelyImportResult(opts.file || null);

  if (!raw.length) {
    result.errors.push('RAW_TEXT_EMPTY');
    result.importStatus = IMPORT_STATUS.PASTE_FALLBACK_REQUIRED;
    result.warnings.push('Parser skipped — empty raw text');
    return result;
  }

  const ocrGate = assessOcrBeforeParser(raw, {
    method: opts.extractionMethod,
    extractionMethod: opts.extractionMethod,
    fileType: opts.fileType,
    enterprise: opts.enterpriseExtraction,
    lines: opts.enterpriseExtraction?.lines,
  });
  if (!ocrGate.pass && !ocrGate.skipped) {
    result.errors.push(OCR_QUALITY_FAIL_MSG);
    result.warnings.push('OCR_PARSER_GATE_BLOCKED');
    result.importStatus = IMPORT_STATUS.PDF_TEXT_EMPTY;
    result.rawText = '';
    result.cleanedText = '';
    return result;
  }

  try {
    logPipelineStage('EXTRACT_TEXT');
    const pipe = await runProductionExtractionPipeline(raw, {
      ...opts,
      canonicalImport: true,
      structureFirst: opts.structureFirst !== false,
    });
    logPipelineStage('BUILD_RESUME_DATA');
    const out = productionToHirelyImportResult(pipe, opts.file || null, { sourceText: raw });
    out.importStatus = resolveImportStatus(out.rawText, {
      errors: out.errors,
      extractionMethod: opts.extractionMethod,
    });
    logPipelineStage('SAFETY_GATE', { warnings: out.warnings?.length || 0 });
    return normalizeImportResultShape(out);
  } catch (err) {
    console.error('HIRELY_IMPORT_FAILED', err);
    result.errors.push(String(err?.message || 'IMPORT_FAILED'));
    const clean = coerceParserInputText(cleanExtraction(raw), raw);
    result.rawText = raw;
    result.cleanedText = clean;
    if (
      !isHirelyFlowLocked() &&
      globalThis.HIRELY_ALLOW_PRODUCT_FALLBACK === true &&
      hasRenderableImportText(raw, clean)
    ) {
      const fb = buildProductFallback(clean, raw);
      result.structuredResume = fb.structuredResume;
      result.templateData = fb.templateData;
      result.resumeData = fb.resumeData;
      result.warnings.push('Used product fallback after parser failure');
    } else {
      result.warnings.push('PIPELINE_FAILED_NO_FALLBACK');
    }
    return normalizeImportResultShape(result);
  }
}

/**
 * @param {File} file
 * @param {object} [opts]
 * @returns {Promise<HirelyImportResult>}
 */
export async function runHirelyImportFromFile(file, opts = {}) {
  const result = emptyHirelyImportResult(file);
  if (!file?.name) {
    result.errors.push('FILE_MISSING');
    return result;
  }

  try {
    const detailed = await extractFromFileDetailed(file);
    const raw = String(
      detailed.enterprise?.rawExtraction || detailed.text || ''
    ).trim();
    const importStatus =
      detailed.importStatus ||
      resolveImportStatus(raw, {
        errors: detailed.errors || [],
        method: detailed.method,
        extractionMethod: detailed.method || opts.extractionMethod,
      });

    result.importStatus = importStatus;

    if (!importStatusAllowsParser(importStatus) || !hasRenderableImportText(raw)) {
      result.errors.push('TEXT_EMPTY');
      result.warnings.push('OCR_UNAVAILABLE_OR_EMPTY — paste CV text manually');
      result.rawText = '';
      result.cleanedText = '';
      result.structuredResume = null;
      result.templateData = null;
      result.resumeData = null;
      return result;
    }
    const imported = await runHirelyImportFromText(raw, {
      ...opts,
      file,
      extractionMethod: detailed.method || opts.extractionMethod,
      pdfExtraction: detailed.pdfExtraction,
      enterpriseExtraction: detailed.enterprise,
    });
    imported.file = result.file;
    imported.importStatus = imported.importStatus || IMPORT_STATUS.IMPORT_SUCCESS;
    return normalizeImportResultShape(imported);
  } catch (err) {
    console.error('HIRELY_FILE_IMPORT_FAILED', err);
    result.errors.push(String(err?.message || 'FILE_IMPORT_FAILED'));
    result.importStatus =
      err?.importStatus ||
      resolveImportStatus('', { errors: result.errors, method: opts.extractionMethod });
    return normalizeImportResultShape(result);
  }
}

export { IMPORT_STATUS, resolveImportStatus, importStatusAllowsParser };

/** @deprecated Use runHirelyImportFromFile */
export async function importFile(file, opts = {}) {
  return runHirelyImportFromFile(file, opts);
}

/** @deprecated Use runHirelyImportFromText */
export async function importText(rawText, opts = {}) {
  return runHirelyImportFromText(rawText, opts);
}

export const importPaste = importText;
export { STRUCTURED_RESUME_JSON_MAX, NAME_UNCERTAIN_LABEL, TITLE_UNCERTAIN_LABEL };
