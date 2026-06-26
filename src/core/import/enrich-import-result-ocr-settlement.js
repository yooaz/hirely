/**
 * OCR settlement → enriched import result contract.
 * Single source of truth for ocrAttempted / ocrTextLength / ocrUsable before final route.
 */
import { awaitOcrSettlementForFile } from '../extraction/pdf-ocr-settlement.js';
import { peekLastEnterpriseExtraction } from '../extraction/extraction-session.js';
import { linesToPlainText } from '../extraction/extracted-line.js';
import {
  assessOcrImportUsabilityRaw,
  hydrateExtractedImportText,
} from './ocr-import-usability.js';
import { runHirelyImportFromText } from '../pipeline/hirely-import.js';
import { emptyResumeData, normalizeResumeData } from '../resume-data.js';
import { AUTOMATIC_IMPORT_TEXT_MIN } from './import-decision-final.js';

const DEFAULT_SETTLEMENT_WAIT_MS = 30000;

function splitMeaningfulLines(text = '') {
  return String(text || '')
    .split(/\r?\n+/)
    .map((line) => String(line || '').replace(/\s+/g, ' ').trim())
    .filter((line) => line.length >= 2);
}

function looksLikeName(line = '') {
  const t = String(line || '').trim();
  if (!t || t.length < 4 || t.length > 60) return false;
  if (/[@\d]|https?:\/\//i.test(t)) return false;
  if (/\b(cv|portfolio|contact|skills|education|experience|profil|profile|work)\b/i.test(t)) return false;
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 4) return false;
  const alphaWords = words.filter((w) => /[A-Za-zÀ-ÿ]/.test(w));
  if (alphaWords.length !== words.length) return false;
  return true;
}

function looksLikeTitle(line = '') {
  const t = String(line || '').trim();
  if (!t || t.length < 4 || t.length > 90) return false;
  if (/[@\d]|https?:\/\//i.test(t)) return false;
  return /(designer|illustrator|developer|manager|director|engineer|product|graphic|ux|ui|art|motion|lead|consultant)/i.test(t);
}

function looksLikeEducation(line = '') {
  return /\b(university|school|lisaa|créapole|creapole|master|bachelor|license|licence|education|dipl[oô]me|formation)\b/i.test(String(line || ''));
}

function looksLikeExperience(line = '') {
  const t = String(line || '');
  return /\b(19|20)\d{2}\b/.test(t) || /\b(freelance|internship|stage|agency|studio|company|experience|worked|designer|illustrator|manager|lead)\b/i.test(t);
}

function extractSkills(lines = []) {
  const seen = new Set();
  const out = [];
  for (const line of lines) {
    if (!/[,:]/.test(line) && line.split(/\s+/).length > 8) continue;
    for (const part of String(line).split(/[,:·|]/)) {
      const token = String(part || '').trim();
      if (!token || token.length < 2 || token.length > 32) continue;
      if (/[@\d]/.test(token)) continue;
      const key = token.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(token);
      if (out.length >= 12) return out;
    }
  }
  return out;
}

function synthesizeResumeDataFromOcrText(ocrText = '', base = {}) {
  const lines = splitMeaningfulLines(ocrText);
  if (!lines.length) return null;
  const rd = emptyResumeData({
    fileName: String(base.fileName || '').trim(),
    fileType: String(base.fileType || 'pdf').trim(),
    extractionMethod: String(base.extractionMethod || 'ocr').trim(),
    rawText: String(base.rawText || ocrText).trim(),
    cleanedText: String(base.cleanedText || ocrText).trim(),
    warnings: [...new Set([...(base.warnings || []), 'OCR_RESUME_DATA_FALLBACK'])],
    blockParserBridgeApplied: true,
  });
  const top = lines.slice(0, 12);
  const name = top.find(looksLikeName) || '';
  rd.identity.name = name;
  const nameIdx = name ? lines.indexOf(name) : -1;
  const titleCandidate = lines
    .slice(Math.max(0, nameIdx + 1), Math.max(0, nameIdx + 6))
    .find(looksLikeTitle) || top.find(looksLikeTitle) || '';
  rd.identity.title = titleCandidate;
  const emailLine = lines.find((line) => /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(line));
  if (emailLine) rd.identity.email = (emailLine.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i) || [''])[0];
  const phoneLine = lines.find((line) => /(?:\+?\d[\d\s().-]{7,}\d)/.test(line));
  if (phoneLine) rd.identity.phone = (phoneLine.match(/(?:\+?\d[\d\s().-]{7,}\d)/) || [''])[0];
  const linkLine = lines.find((line) => /linkedin|behance|dribbble|portfolio|tumblr|instagram|facebook|website/i.test(line));
  if (linkLine) rd.identity.website = linkLine;
  const bodyLines = lines.filter((line) => line !== name && line !== titleCandidate);
  const expLines = bodyLines.filter(looksLikeExperience).slice(0, 8);
  rd.experiences = expLines.map((line) => ({
    role: String(line).slice(0, 120),
    company: '',
    dates: (String(line).match(/\b(?:19|20)\d{2}(?:\s*[-–]\s*(?:present|current|(?:19|20)\d{2}))?/i) || [''])[0],
    bullets: [],
    description: String(line).slice(0, 220),
  }));
  const eduLines = bodyLines.filter(looksLikeEducation).slice(0, 6);
  rd.education = eduLines;
  const skillLines = bodyLines.filter((line) => /\b(photoshop|illustrator|indesign|figma|sketch|after ?effects|branding|design|ux|ui|packaging|web|logo|vector|drawing|react|javascript|typescript|node)\b/i.test(line)).slice(0, 6);
  const skills = extractSkills(skillLines);
  rd.skills = skills.slice(0, 8);
  rd.tools = skills.slice(8, 12);
  const summaryLines = bodyLines.filter((line) => !looksLikeExperience(line) && !looksLikeEducation(line) && !/@|https?:\/\//i.test(line)).slice(0, 3);
  rd.summary = summaryLines.join(' ').slice(0, 320);
  const unsorted = bodyLines
    .filter((line) => !expLines.includes(line) && !eduLines.includes(line))
    .slice(0, 24);
  rd.unsorted = unsorted;
  return normalizeResumeData(rd, { skipSanitize: true, skipPolish: true });
}


function mergeEnterprise(result = {}, settlement = null) {
  const sessionEnt = peekLastEnterpriseExtraction();
  const baseEnt =
    result.enterpriseExtraction ||
    result.enterprise ||
    settlement?.extracted?.enterprise ||
    sessionEnt ||
    null;

  let enterprise = baseEnt;
  if (settlement?.extracted?.enterprise) {
    const ent = settlement.extracted.enterprise;
    const existingLines = baseEnt?.lines || [];
    if (!existingLines.length || (ent.lines?.length || 0) > existingLines.length) {
      enterprise = ent;
    }
  } else if (Array.isArray(settlement?.lines) && settlement.lines.length) {
    enterprise = {
      ...(baseEnt || {}),
      lines: settlement.lines,
      method: 'ocr',
    };
  }

  return {
    enterprise,
    enterpriseExtraction: enterprise,
  };
}

/**
 * Await OCR settlement and merge truthful OCR fields onto the import result.
 * @param {File} file
 * @param {object} result
 * @param {{ waitMs?: number, maxWaitMs?: number, pageCount?: number, timedOut?: boolean, fileType?: string }} [opts]
 */
export async function enrichImportResultWithOcrSettlement(file, result = {}, opts = {}) {
  if (!result || typeof result !== 'object') return result;

  const fileType = String(result.fileType || opts.fileType || 'pdf').toLowerCase();
  let merged = {
    ...result,
    fileType,
    ...mergeEnterprise(result, null),
  };

  let settlement = null;
  if (fileType === 'pdf' && file) {
    const waitMs = Math.max(
      1000,
      Number(opts.waitMs ?? opts.maxWaitMs) || DEFAULT_SETTLEMENT_WAIT_MS
    );
    settlement = await awaitOcrSettlementForFile(file, {
      maxWaitMs: waitMs,
      pageCount: opts.pageCount,
      timedOut: opts.timedOut === true,
    });
    const entMerge = mergeEnterprise(merged, settlement);
    merged = {
      ...merged,
      ...entMerge,
      ocrSettlement: settlement?.state ?? settlement ?? null,
      ocrSettled: settlement?.state != null,
    };

    const settlementText = String(settlement?.text || '').trim();
    if (settlementText) {
      merged.ocrText = settlementText;
      const nativeLen = Math.max(0, Number(merged.nativeTextLength) || 0);
      if (nativeLen < AUTOMATIC_IMPORT_TEXT_MIN) {
        if (!String(merged.rawText || '').trim()) merged.rawText = settlementText;
        if (!String(merged.cleanedText || '').trim()) merged.cleanedText = settlementText;
      }
    }
  }

  merged = hydrateExtractedImportText({
    ...merged,
    enterprise: merged.enterprise || merged.enterpriseExtraction,
  });

  const signals = assessOcrImportUsabilityRaw(merged, { strictParser: false });
  const ocrLines = (signals.meaningfulLines || []).filter((ln) => ln.source === 'ocr');
  const ocrTextFromLines = linesToPlainText(ocrLines).trim();
  const ocrText = String(
    merged.ocrText || ocrTextFromLines || ''
  ).trim();
  const ocrTextFinal =
    ocrText ||
    (signals.ocrAttempted && signals.nativeTextLength === 0
      ? String(merged.rawText || merged.cleanedText || '').trim()
      : '');

  const ocrAttempted =
    settlement?.ocrAttempted === true ||
    merged.ocrAttempted === true ||
    signals.ocrAttempted === true;

  const ocrTextLength = Math.max(
    0,
    ocrTextFinal.length,
    Number(signals.ocrTextLength) || 0,
    Number(merged.ocrTextLength) || 0
  );

  const ocrUsable = settlement?.usable === true || signals.usable === true;

  merged = {
    ...merged,
    nativeTextLength: Math.max(0, Number(signals.nativeTextLength) || 0),
    ocrAttempted,
    ocrText: ocrTextFinal,
    ocrTextLength,
    ocrUsable,
  };

  const hasStructuredPayload =
    merged.resumeData != null ||
    merged.structuredInput != null ||
    merged.ocrStructuredInput != null ||
    merged.structuredResume != null;

  if (
    opts.synthesizeStructuredPayload === true &&
    fileType === 'pdf' &&
    ocrUsable &&
    !hasStructuredPayload &&
    ocrTextLength >= AUTOMATIC_IMPORT_TEXT_MIN
  ) {
    try {
      const imported = await runHirelyImportFromText(ocrTextFinal, {
        fileType,
        extractionMethod: merged.extractionMethod || 'ocr',
        enterpriseExtraction: merged.enterprise || merged.enterpriseExtraction || null,
        structureFirst: true,
        canonicalImport: true,
      });
      if (imported && (imported.resumeData || imported.structuredResume || imported.templateData)) {
        merged = {
          ...merged,
          rawText: String(merged.rawText || imported.rawText || ocrTextFinal).trim(),
          cleanedText: String(merged.cleanedText || imported.cleanedText || ocrTextFinal).trim(),
          structuredResume: imported.structuredResume ?? merged.structuredResume ?? null,
          templateData: imported.templateData ?? merged.templateData ?? null,
          resumeData: imported.resumeData ?? merged.resumeData ?? null,
          structuredInput:
            imported.structuredInput ?? imported.structuredResume ?? merged.structuredInput ?? null,
          ocrStructuredInput:
            imported.ocrStructuredInput ?? imported.structuredResume ?? merged.ocrStructuredInput ?? null,
          warnings: [...new Set([...(merged.warnings || []), ...(imported.warnings || []), 'OCR_STRUCTURED_PAYLOAD_SYNTHESIZED'])],
        };
      } else {
        const fallbackResume = synthesizeResumeDataFromOcrText(ocrTextFinal, merged);
        if (fallbackResume) {
          merged = {
            ...merged,
            rawText: String(merged.rawText || ocrTextFinal).trim(),
            cleanedText: String(merged.cleanedText || ocrTextFinal).trim(),
            resumeData: fallbackResume,
            structuredInput: fallbackResume,
            ocrStructuredInput: fallbackResume,
            warnings: [...new Set([...(merged.warnings || []), 'OCR_STRUCTURED_PAYLOAD_FALLBACK'])],
          };
        }
      }
    } catch (err) {
      const fallbackResume = synthesizeResumeDataFromOcrText(ocrTextFinal, merged);
      merged = {
        ...merged,
        resumeData: merged.resumeData || fallbackResume || null,
        structuredInput: merged.structuredInput || fallbackResume || null,
        ocrStructuredInput: merged.ocrStructuredInput || fallbackResume || null,
        warnings: [...new Set([...(merged.warnings || []), 'OCR_STRUCTURED_PAYLOAD_SYNTHESIS_FAILED', ...(fallbackResume ? ['OCR_STRUCTURED_PAYLOAD_FALLBACK'] : [])])],
      };
    }
  }

  if (fileType === 'pdf') {
    delete merged.importDecisionDestination;
    delete merged.importUiRoute;
    delete merged.importDecisionReason;
  }

  return merged;
}

/** @deprecated use enrichImportResultWithOcrSettlement */
export const finalizePdfImportWithOcr = enrichImportResultWithOcrSettlement;
