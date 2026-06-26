/**
 * resumeData — single source of truth for Hirely (import → editor → template → export).
 * Uncertain identity uses display placeholders; preserved text lives in unsorted.
 */

import {
  simpleCvDataFromStructured,
  legacyExperienceLineToEntry,
} from './parsing/simple-cv-mapper.js';
import { logRenderPipelineCounts } from './runtime/render-pipeline-trace.js';
import { slimStructuredResume } from './pipeline/pipeline-contract.js';
import { validatePhone } from './parsing/rich-parser.js';
import { normalizeContactPhone, buildPhoneReviewItem } from './parsing/phone-normalize.js';
import { resolveIdentityContact } from './validation/identity-contact.js';
import {
  assessIdentityNameStrict,
  assessIdentityPhoneStrict,
} from './validation/identity-contact-strictness.js';
import { isValidIdentityName, isValidIdentityTitle } from './parsing/identity-extraction.js';
import { stripUncertainToEmpty, isUncertainIdentityName, isUncertainIdentityTitle } from './display/undetected-label.js';
import { RESUME_DATA_JSON_MAX } from './runtime/static-mode.js';
import { detectCreativeParsingMode } from './parsing/creative-parsing-mode.js';
import { reconcileCreativeSections } from './creative-resume-mode.js';
import { repairResumeDataFromRaw } from './parsing/import-repair.js';
import { parseInternshipLine } from './parsing/classification-fixes.js';
import { applySkillRecovery } from './parsing/skill-recovery.js';
import { recoverSectionsFromUnsorted } from './parsing/unsorted-section-recovery.js';
import { autoAcceptSafeSuggestions } from './parsing/suggestion-auto-accept.js';
import { capUnsortedWithArchive } from './parsing/no-data-loss.js';
import { polishResumeOutput } from './parsing/resume-output-quality.js';
import { logResumeDataCounts } from './runtime/runtime-version.js';
import { dedupeSuggestionsAgainstResumeData, lineIsConsumedByResumeData } from './parsing/line-source-dedup.js';
import {
  resumeDataFromParseResponse,
  resolveBridgeLockedFromImport,
  shouldSkipFlatRepairForResumeData,
} from './parsing/cv-block-parser-bridge.js';

export { shouldSkipFlatRepairForResumeData };
import {
  applyExtractionHonestMode,
  isWeakOcrQuality,
} from './import/extraction-honest-mode.js';
import { applyConfidenceGate } from './validation/confidence-gate.js';
import {
  sanitizeBridgeStructuredSections,
  sanitizeResumeForDisplay,
} from './validation/sanitize-resume-display.js';
import { applyDataSanitizationLayer } from './validation/data-sanitization-layer.js';
import { stripSectionLabelLeakageFromCvData } from './validation/section-label-leakage-guard.js';
import { stripPlaceholderContentFromCvData } from './validation/final-cv-placeholder-guard.js';
import {
  lockResumeDataShape,
  assertResumeDataFlowLock,
  assertTemplateCvFlowLock,
  stripTemplateCvData,
  logPipelineStage,
  resumeDataMeetsImportMinimum,
} from './pipeline/hirely-flow-lock.js';

export { resumeDataMeetsImportMinimum };
import { applyResumeDataContractWarnings } from './validation/resume-data-contract.js';
import { normalizeCvData as normalizeCvDataRich } from './parsing/rich-parser.js';
import { applyPersonCompanyDisambiguation } from './parsing/person-company-disambiguation.js';

/** P1 — strict resumeData sections allowed on final display (before suggestions/meta). */
export const STRICT_FINAL_RESUME_SECTION_KEYS = Object.freeze([
  'identity',
  'summary',
  'experiences',
  'education',
  'skills',
  'tools',
  'languages',
  'clients',
  'projects',
]);

/** P1 — flat cvData keys allowed for templates / export. */
export const STRICT_TEMPLATE_CV_KEYS = Object.freeze([
  'name',
  'title',
  'email',
  'phone',
  'linkedin',
  'portfolio',
  'location',
  'summary',
  'experience',
  'education',
  'skills',
  'tools',
  'languages',
  'clients',
  'projects',
  'portfolioLinks',
  '_creativeMode',
  '_fromFinalResumeData',
  '_fromResumeData',
]);

/** Parser / review internals — must never reach templates. */
export const PARSER_LEAK_KEYS = Object.freeze([
  'unknownExperience',
  'toClassify',
  '_enterprise',
  '_parserReview',
  '_extractionReview',
  '_sourceLines',
  'sectionConfidence',
  'extra',
  'interests',
  'exhibitions',
  'awards',
  'publications',
  'other',
]);

function listOfStrings(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map((x) => String(x || '').trim()).filter(Boolean);
}

/**
 * Fold parser-only buckets into product sections; drop debug payloads.
 * @param {object} data
 */
export function foldParserLeakFields(data) {
  if (!data || typeof data !== 'object') return data;
  const out = { ...data };
  const unsorted = listOfStrings(out.unsorted);

  for (const line of listOfStrings(out.unknownExperience)) {
    unsorted.push(line);
  }
  for (const item of Array.isArray(out.toClassify) ? out.toClassify : []) {
    const text =
      item && typeof item === 'object'
        ? String(item.text || '').trim()
        : String(item || '').trim();
    if (text) unsorted.push(text);
  }

  out.unsorted = [...new Set(unsorted)];
  for (const key of PARSER_LEAK_KEYS) {
    delete out[key];
  }
  return out;
}

/**
 * Whitelist-only cvData for templates (no parser/review internals).
 * @param {object|null} cvData
 */
export function stripStrictTemplateCvData(cvData) {
  if (!cvData || typeof cvData !== 'object') return cvData;
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const key of STRICT_TEMPLATE_CV_KEYS) {
    if (key in cvData) out[key] = cvData[key];
  }
  return out;
}

/**
 * Product-safe normalize — strips parser internals after rich-parser normalize.
 * @param {object|null} cvData
 */
export function normalizeCvDataForTemplate(cvData) {
  const fromFinal = cvData?._fromFinalResumeData === true;
  const fromResume = cvData?._fromResumeData === true;
  if (fromResume || fromFinal) {
    const stripped = stripStrictTemplateCvData(stripTemplateCvData(cvData));
    const labelFree = stripSectionLabelLeakageFromCvData(stripped);
    const placeholderFree = stripPlaceholderContentFromCvData(labelFree);
    const out = { ...stripStrictTemplateCvData(placeholderFree) };
    if (fromResume) out._fromResumeData = true;
    if (fromFinal) out._fromFinalResumeData = true;
    return out;
  }
  const normalized = normalizeCvDataRich(cvData);
  const stripped = stripStrictTemplateCvData(normalized);
  const sanitized = applyDataSanitizationLayer(stripped, { templateMode: true });
  const out = stripStrictTemplateCvData(stripTemplateCvData(sanitized));
  const lock = assertTemplateCvFlowLock(out);
  if (!lock.ok && typeof console !== 'undefined') {
    console.warn('[HIRELY_DATA_CONTRACT] TEMPLATE_CV_FLOW_LOCK', lock.forbidden);
  }
  return out;
}

const GARBAGE_NAME =
  /print\s*logo|vector\s*art|illusthatch|nature\s*music|reading\s*nature|art\s*reading|adress|mustration|address\s+illustr/i;

export { RESUME_DATA_JSON_MAX };
export { sanitizeResumeForDisplay, sanitizedResumeSize } from './validation/sanitize-resume-display.js';

/** @returns {import('./resume-data.js').ResumeData} */
export function emptyResumeData(meta = {}) {
  return {
    identity: {
      name: '',
      title: '',
      email: '',
      phone: '',
      location: '',
      website: '',
      linkedin: '',
    },
    summary: '',
    experiences: [],
    education: [],
    clients: [],
    projects: [],
    exhibitions: [],
    awards: [],
    publications: [],
    press: [],
    portfolioLinks: [],
    skills: [],
    tools: [],
    languages: [],
    unsorted: [],
    meta: {
      fileName: '',
      fileType: '',
      extractionMethod: '',
      confidence: null,
      warnings: [],
      errors: [],
      ...meta,
    },
  };
}

/**
 * Sanitize identity — never invent; strip garbage OCR.
 * @param {object} identity
 */
export function sanitizeIdentity(identity = {}, opts = {}) {
  const id = { ...identity };
  const experiences = opts.experiences || [];
  let name = String(id.name || '').trim();
  if (GARBAGE_NAME.test(name)) name = '';
  const nameStrict = assessIdentityNameStrict(name, experiences);
  name = nameStrict.accept ? nameStrict.display : '';

  let title = String(id.title || '').trim();
  const garbageTitle =
    GARBAGE_NAME.test(title) ||
    /\bedition\s*,\s*logos\b/i.test(title) ||
    /\b(print|logo|vector|reading|nature|music)\b.*\b(print|logo|vector|reading|nature|music)\b/i.test(
      title
    ) ||
    (/\.\.\./.test(title) && !/\b(designer|director|illustrator|manager)\b/i.test(title));
  if (!title || !isValidIdentityTitle(title) || garbageTitle) {
    title = '';
  }
  const contact = resolveIdentityContact(id);
  const phoneStrict = assessIdentityPhoneStrict(contact.phone || id.phone);
  const guarded = applyPersonCompanyDisambiguation(
    {
      identity: {
        name: stripUncertainToEmpty(name, 'name'),
        title: stripUncertainToEmpty(title, 'title'),
        email: contact.email,
        location: String(id.location || '').trim(),
        phone: phoneStrict.accept ? phoneStrict.display : '',
        website: String(id.website || id.portfolio || '').trim(),
        linkedin: String(id.linkedin || '').trim(),
      },
    },
    { experiences }
  );
  return { ...(guarded.resumeData.identity || {}) };
}

/**
 * @param {object|null} structured
 * @returns {import('./resume-data.js').ResumeData}
 */
export function resumeDataFromStructured(structured) {
  const slim = slimStructuredResume(structured) || emptyResumeData();
  const unsorted = [
    ...(Array.isArray(slim.unsorted) ? slim.unsorted : []),
  ]
    .map((x) => (typeof x === 'string' ? x : String(x?.text || '')).trim())
    .filter((l) => l.length > 1);

  const base = {
    identity: sanitizeIdentity(slim.identity),
    summary: String(slim.summary || '').trim(),
    experiences: Array.isArray(slim.experiences) ? slim.experiences.map(cloneExp) : [],
    education: Array.isArray(slim.education) ? [...slim.education] : [],
    clients: listOfStrings(slim.clients),
    projects: listOfStrings(slim.projects),
    exhibitions: listOfStrings(slim.exhibitions),
    awards: listOfStrings(slim.awards),
    publications: listOfStrings(slim.publications),
    press: listOfStrings(slim.press),
    portfolioLinks: listOfStrings(slim.portfolioLinks),
    skills: listOfStrings(slim.skills),
    tools: listOfStrings(slim.tools),
    languages: listOfStrings(slim.languages),
    unsorted,
    meta: attachCreativeMeta(emptyResumeData().meta, structured || slim, unsorted),
  };
  return reconcileCreativeSections(base);
}

function attachCreativeMeta(meta, slim, unsorted = []) {
  const m = { ...meta };
  const fromMeta = slim?.metadata?.creativeMode || slim?.metadata?.creativeParsingMode;
  const fromDesigner = slim?.metadata?.designerCvMode;
  if (fromMeta && typeof fromMeta === 'object' && fromMeta.active != null) {
    m.creativeMode = {
      active: fromMeta.active === true,
      targetRolesDetected: fromMeta.targetRolesDetected || [],
      signals: fromMeta.signals || [],
    };
  }
  if (fromDesigner && typeof fromDesigner === 'object' && fromDesigner.active != null) {
    m.designerMode = {
      active: fromDesigner.active === true,
      triggerRoles: fromDesigner.triggerRoles || fromDesigner.targetRolesDetected || [],
      signals: fromDesigner.signals || [],
      prioritySections: fromDesigner.prioritySections || [],
    };
    if (!m.creativeMode?.active && fromDesigner.active) {
      m.creativeMode = {
        active: true,
        targetRolesDetected: m.designerMode.triggerRoles,
        signals: [...(m.designerMode.signals || []), 'designer_mode_creative_fallback'],
      };
    }
  }
  if (m.creativeMode || m.designerMode) return m;
  const hay = [
    slim?.identity?.title,
    slim?.summary,
    ...(unsorted || []),
    ...(slim?.clients || []),
    ...(slim?.projects || []),
  ]
    .filter(Boolean)
    .join('\n');
  const detected = detectCreativeParsingMode(hay);
  m.creativeMode = {
    active: detected.active === true,
    targetRolesDetected: detected.targetRolesDetected || [],
    signals: detected.signals || [],
  };
  return m;
}

/**
 * Build resumeData from HirelyImportResult or legacy pipeline output.
 * @param {object} result
 */
export function resumeDataFromImport(result) {
  if (!result) return emptyResumeData();
  if (result.resumeData && typeof result.resumeData === 'object') {
    const raw = result.resumeData;
    if (raw.metadata || (raw.identity && !raw.meta)) {
      return normalizeResumeData(resumeDataFromStructured(raw));
    }
    return normalizeResumeData(raw);
  }
  if (result.structuredResume) {
    return resumeDataFromStructured(result.structuredResume);
  }
  if (result.templateData) {
    return resumeDataFromCvData(result.templateData);
  }
  return emptyResumeData();
}

/**
 * @param {object} cvData legacy flat shape
 */
export function resumeDataFromCvData(cvData) {
  const p = cvData || {};
  const tc = normalizeToClassifyStrings(p.toClassify, p.unsorted);
  return {
    identity: sanitizeIdentity({
      name: p.name,
      title: p.title,
      email: p.email,
      phone: p.phone,
      location: p.location,
      website: p.portfolio || p.website,
      linkedin: p.linkedin,
    }),
    summary: String(p.summary || '').trim(),
    experiences: legacyExperiences(p.experience),
    education: listOfStrings(p.education),
    clients: listOfStrings(p.clients),
    projects: listOfStrings(p.projects),
    exhibitions: listOfStrings(p.exhibitions),
    awards: listOfStrings(p.awards),
    publications: listOfStrings(p.publications),
    press: listOfStrings(p.press),
    portfolioLinks: listOfStrings(p.portfolioLinks),
    skills: listOfStrings(p.skills),
    tools: listOfStrings(p.tools),
    languages: listOfStrings(p.languages),
    unsorted: tc,
    meta: attachCreativeMeta(emptyResumeData().meta, null, tc),
  };
}

/** @param {import('./resume-data.js').ResumeData} data @param {{ skipSanitize?: boolean }} [opts] */
export function normalizeResumeData(data, opts = {}) {
  const base = emptyResumeData();
  const d = data || {};
  const meta = { ...base.meta, ...(d.meta || {}) };
  const rawPhoneInput = String((d.identity || {}).phone || '').trim();
  const bridgeLocked =
    opts.skipSanitize === true ||
    opts.skipPolish === true ||
    shouldSkipFlatRepairForResumeData(d) ||
    meta?.blockParserBridgeApplied === true;

  const out = {
    identity: bridgeLocked
      ? {
          ...base.identity,
          name: String((d.identity || {}).name || '').trim(),
          title: String((d.identity || {}).title || '').trim(),
          email: String((d.identity || {}).email || '').trim(),
          phone: String((d.identity || {}).phone || '').trim(),
          location: String((d.identity || {}).location || '').trim(),
          website: String((d.identity || {}).website || '').trim(),
          linkedin: String((d.identity || {}).linkedin || '').trim(),
        }
      : sanitizeIdentity({ ...base.identity, ...(d.identity || {}) }, { experiences: d.experiences }),
    summary: String(d.summary || '').trim(),
    experiences: Array.isArray(d.experiences) ? d.experiences.map(cloneExp) : [],
    education: listOfStrings(d.education),
    clients: listOfStrings(d.clients),
    projects: listOfStrings(d.projects),
    exhibitions: listOfStrings(d.exhibitions),
    awards: listOfStrings(d.awards),
    publications: listOfStrings(d.publications),
    press: listOfStrings(d.press),
    portfolioLinks: listOfStrings(d.portfolioLinks),
    skills: listOfStrings(d.skills),
    tools: listOfStrings(d.tools),
    languages: listOfStrings(d.languages),
    unsorted: [
      ...listOfStrings(d.interests),
      ...listOfStrings(d.unsorted?.length ? d.unsorted : d.suggestions),
      ...listOfStrings(d.unknownExperience),
      ...normalizeToClassifyStrings(d.toClassify, []),
    ],
    blocks: Array.isArray(d.blocks)
      ? d.blocks.map((b) => ({ ...b, bullets: Array.isArray(b.bullets) ? [...b.bullets] : b.bullets }))
      : undefined,
    meta,
  };
  if (rawPhoneInput) {
    const phoneNorm = normalizeContactPhone(rawPhoneInput);
    if (phoneNorm.reviewRequired) {
      const item = buildPhoneReviewItem(
        rawPhoneInput,
        phoneNorm.phone || out.identity.phone || '',
        phoneNorm.confidence
      );
      if (item) {
        out.meta.contactReviewItems = [...(out.meta.contactReviewItems || []), item];
      }
    }
  }
  const polished = bridgeLocked ? out : polishResumeOutput(out);
  const capped = capUnsortedWithArchive(polished.unsorted, polished.meta?.unsortedArchive);
  polished.unsorted = capped.unsorted;
  polished.meta.unsortedArchive = capped.unsortedArchive;
  const confident = bridgeLocked ? polished : applyConfidenceGate(polished);
  const displayReady = opts.skipSanitize
    ? bridgeLocked
      ? sanitizeBridgeStructuredSections(confident)
      : confident
    : sanitizeResumeForDisplay(confident, {
        rawText: meta.rawText || confident.meta?.rawText || '',
        cleanedText: meta.cleanedText || confident.meta?.cleanedText || '',
      });
  const shaped = lockResumeDataShape(displayReady);
  const lockCheck = assertResumeDataFlowLock(shaped);
  if (lockCheck.warnings?.length) {
    console.warn('RESUME_DATA_FLOW_LOCK', lockCheck.warnings);
  }
  if (lockCheck.fatal?.length) {
    console.warn('RESUME_DATA_FLOW_LOCK_FATAL', lockCheck.fatal);
  }
  logPipelineStage('SAFETY_GATE', { ok: lockCheck.ok, keys: Object.keys(shaped) });
  const stripped = shaped;
  const contracted = applyResumeDataContractWarnings(shaped, { silent: true });
  return contracted.resumeData;
}

/**
 * UI commit path — preserve bridge/spatial resumeData; never run flat OCR repair on SSOT output.
 * @param {import('./resume-data.js').ResumeData} rd
 * @param {{ rawText?: string, cleanedText?: string, rejectedLines?: string[], skipRawTextReview?: boolean }} [opts]
 */
export function prepareResumeDataForUiCommit(rd, opts = {}) {
  const skipFlat = shouldSkipFlatRepairForResumeData(rd);
  const preserved =
    skipFlat
      ? {
          skills: [...(rd?.skills || [])],
          tools: [...(rd?.tools || [])],
        }
      : null;
  let normalized = normalizeResumeData(rd, { skipSanitize: skipFlat, skipPolish: skipFlat });
  if (preserved) {
    if (!(normalized.skills || []).length && preserved.skills.length) {
      normalized.skills = preserved.skills;
    }
    if (!(normalized.tools || []).length && preserved.tools.length) {
      normalized.tools = preserved.tools;
    }
  }
  if (!skipFlat) {
    normalized = reconcileCreativeSections(normalized);
    normalized = reconcileTextRetention(normalized, {
      rawText: opts.rawText || normalized.meta?.rawText || '',
      cleanedText: opts.cleanedText || normalized.meta?.cleanedText || '',
      rejectedLines: opts.rejectedLines || [],
    });
  }
  normalized = repairResumeDataFromRaw(normalized, {
    rawText: opts.rawText || normalized.meta?.rawText || '',
    cleanedText: opts.cleanedText || normalized.meta?.cleanedText || '',
    skipFlatRepair: skipFlat,
  });
  return lockResumeDataShape(normalized);
}

/**
 * Build resumeData from import output + file context (canonical contract).
 */
export function buildResumeData({
  importResult,
  structured,
  rawText = '',
  cleanedText = '',
  sourceText = '',
  file = null,
  fileType = '',
  extractionMethod = '',
  warnings = [],
  errors = [],
  rejectedLines = [],
  ocrConfidence = null,
  blockParserBridgeApplied = false,
} = {}) {
  const bridgeResolved = resolveBridgeLockedFromImport(importResult, null);
  const bridgeLocked =
    blockParserBridgeApplied ||
    bridgeResolved.applied ||
    importResult?.resumeData?.meta?.blockParserBridgeApplied === true ||
    shouldSkipFlatRepairForResumeData(importResult?.resumeData);

  let rd = emptyResumeData({
    fileName: file?.name || '',
    fileType: fileType || '',
    extractionMethod: extractionMethod || '',
    confidence: importResult?.confidence ?? null,
    warnings: [...warnings],
    errors: [...errors],
  });

  const parseResponse =
    bridgeResolved.parseResponse ||
    importResult?.parseResponse ||
    structured?.metadata?.parseResponse ||
    importResult?.structuredResume?.metadata?.parseResponse ||
    null;

  if (
    bridgeLocked &&
    importResult?.resumeData?.meta?.blockParserBridgeApplied &&
    !parseResponse
  ) {
    rd = normalizeResumeData(importResult.resumeData, {
      skipSanitize: true,
      skipPolish: true,
    });
    rd.meta = {
      ...rd.meta,
      fileName: file?.name || rd.meta.fileName || '',
      fileType: fileType || rd.meta.fileType || '',
      extractionMethod: extractionMethod || rd.meta.extractionMethod || '',
      sourceText: sourceText || rd.meta.sourceText || rawText || '',
      rawText: rawText || rd.meta.rawText || '',
      cleanedText: cleanedText || rd.meta.cleanedText || '',
      warnings: [...new Set([...(rd.meta.warnings || []), ...warnings])],
      errors: [...new Set([...(rd.meta.errors || []), ...errors])],
      blockParserBridgeApplied: true,
    };
    if (Number.isFinite(Number(ocrConfidence))) {
      rd.meta.ocrConfidence = Number(ocrConfidence);
    }
    const check = assertResumeDataContract(rd);
    if (!check.ok) {
      console.error('DATA_CONTRACT_BROKEN', check.message);
      rd.meta.errors.push('DATA_CONTRACT_BROKEN');
      return emptyResumeData({
        fileName: rd.meta.fileName,
        fileType: rd.meta.fileType,
        extractionMethod: rd.meta.extractionMethod,
        warnings: rd.meta.warnings,
        errors: rd.meta.errors,
      });
    }
    logResumeDataCounts(rd, 'buildResumeData:bridgeLocked');
    return applyResumeDataContractWarnings(rd, { silent: true }).resumeData;
  }

  if (bridgeLocked && parseResponse) {
    rd = resumeDataFromParseResponse(parseResponse, {
      meta: { warnings: [...warnings], errors: [...errors] },
      rawText: rawText || sourceText || importResult?.rawText || '',
      cleanedText: cleanedText || importResult?.cleanedText || '',
      fileName: file?.name || importResult?.file?.name || '',
      extractionLines:
        importResult?.enterpriseExtraction?.lines ||
        importResult?.enterprise?.lines ||
        importResult?.stages?.document?.enterprise?.lines ||
        [],
    });
    rd.meta.blockParserBridgeApplied = true;
    if (structured) {
      if ((rd.experiences || []).length < (structured.experiences || []).length) {
        rd.experiences = structured.experiences || [];
      }
      if ((rd.education || []).length < (structured.education || []).length) {
        rd.education = [...new Set(structured.education || [])];
      }
      if ((rd.skills || []).length + (rd.tools || []).length <
          (structured.skills || []).length + (structured.tools || []).length) {
        rd.skills = [...new Set(structured.skills || [])];
        rd.tools = [...new Set(structured.tools || [])];
      }
    }
    const title = String(rd.identity?.title || '').trim();
    const summary = String(rd.summary || '').trim();
    if (
      summary &&
      title &&
      summary.toLowerCase().includes(title.toLowerCase().slice(0, 12)) &&
      summary.length < 140
    ) {
      rd.summary = '';
    }
    for (const line of String(rawText || cleanedText || '').split(/\r?\n/)) {
      if ((rd.experiences || []).length >= 3) break;
      const intern = parseInternshipLine(String(line || '').trim());
      if (!intern) continue;
      const key = `${intern.role}|${intern.company}|${intern.startDate}`.toLowerCase();
      if (
        (rd.experiences || []).some(
          (e) => `${e.role}|${e.company}|${e.startDate}`.toLowerCase() === key
        )
      ) {
        continue;
      }
      rd.experiences = [...(rd.experiences || []), { ...intern, clients: [], location: '' }];
    }
    if ((rd.skills || []).length + (rd.tools || []).length < 6) {
      applySkillRecovery(rd, { min: 6, max: 24 });
    }
  } else if (importResult) {
    rd = resumeDataFromImport(importResult);
  } else if (structured) {
    rd = resumeDataFromStructured(structured);
  }

  rd.meta = {
    ...rd.meta,
    fileName: file?.name || rd.meta.fileName || '',
    fileType: fileType || rd.meta.fileType || '',
    extractionMethod: extractionMethod || rd.meta.extractionMethod || '',
    sourceText: sourceText || rd.meta.sourceText || rawText || rd.meta.rawText || '',
    rawText: rawText || rd.meta.rawText || '',
    cleanedText: cleanedText || rd.meta.cleanedText || '',
    warnings: [...new Set([...(rd.meta.warnings || []), ...warnings])],
    errors: [...new Set([...(rd.meta.errors || []), ...errors])],
  };

  rd = repairResumeDataFromRaw(rd, {
    rawText,
    cleanedText,
    sourceText,
    skipFlatRepair: bridgeLocked,
  });
  if (!bridgeLocked) {
    rd = autoAcceptSafeSuggestions(rd, { rawText, cleanedText, sourceText });
    rd = reconcileTextRetention(rd, {
      rawText,
      cleanedText,
      rejectedLines,
    });
  }
  const honestOcr =
    !bridgeLocked &&
    (isWeakOcrQuality(ocrConfidence) ||
      isWeakOcrQuality(rd.meta?.ocrConfidence) ||
      rd.meta?.extractionHonestMode === true);
  if (!honestOcr && !bridgeLocked) {
    rd = recoverSectionsFromUnsorted(rd);
    rd = autoAcceptSafeSuggestions(rd, { rawText, cleanedText, sourceText });
  }
  if (!bridgeLocked) {
    rd = reconcileCreativeSections(rd);
  }
  if (rawText || cleanedText) {
    rd.meta = {
      ...(rd.meta || {}),
      rawText: rawText || rd.meta?.rawText || '',
      cleanedText: cleanedText || rd.meta?.cleanedText || '',
    };
  }
  if (Number.isFinite(Number(ocrConfidence))) {
    rd.meta = { ...(rd.meta || {}), ocrConfidence: Number(ocrConfidence) };
  }
  if (honestOcr && !bridgeLocked) {
    rd = applyExtractionHonestMode(rd, {
      ocrConfidence: Number.isFinite(Number(ocrConfidence)) ? Number(ocrConfidence) : rd.meta?.ocrConfidence,
    });
  }
  rd = normalizeResumeData(rd, {
    skipSanitize: bridgeLocked,
    skipPolish: bridgeLocked,
  });

  const check = assertResumeDataContract(rd);
  if (!check.ok) {
    console.error('DATA_CONTRACT_BROKEN', check.message);
    rd.meta.errors.push('DATA_CONTRACT_BROKEN');
    return emptyResumeData({
      fileName: rd.meta.fileName,
      fileType: rd.meta.fileType,
      extractionMethod: rd.meta.extractionMethod,
      warnings: rd.meta.warnings,
      errors: [...rd.meta.errors, 'DATA_CONTRACT_BROKEN'],
    });
  }
  if (!bridgeLocked) {
    const deduped = dedupeSuggestionsAgainstResumeData(rd, {
      rawText,
      cleanedText,
      reviewQueue: importResult?.reviewQueue,
    });
    rd = deduped.resumeData;
    if (importResult && Array.isArray(importResult.reviewQueue)) {
      importResult.reviewQueue = deduped.reviewQueue;
    }
  }

  const contracted = applyResumeDataContractWarnings(rd, { silent: true });
  rd = contracted.resumeData;
  logResumeDataCounts(rd, importResult ? 'buildResumeData:importResult' : 'buildResumeData:structured');
  return rd;
}

/**
 * @param {object} data
 */
export function assertResumeDataContract(data) {
  const rd = normalizeResumeData(data);
  let json = '';
  try {
    json = JSON.stringify(rd);
  } catch (e) {
    return { ok: false, message: 'DATA_NOT_SERIALIZABLE', size: 0 };
  }
  if (json.length > RESUME_DATA_JSON_MAX) {
    return { ok: false, message: `DATA_CONTRACT_BROKEN size=${json.length}`, size: json.length };
  }
  const n = rd.identity?.name || '';
  if (GARBAGE_NAME.test(n)) {
    return { ok: false, message: 'FAKE_IDENTITY_NAME', size: json.length };
  }
  if (/^\[object |window\.|hirely|undefined/i.test(json)) {
    return { ok: false, message: 'DOM_OR_STATE_LEAK', size: json.length };
  }
  return { ok: true, size: json.length };
}

/**
 * Flat cvData for templates / export (derived view only).
 * @param {import('./resume-data.js').ResumeData} data
 * @param {{ skipNormalize?: boolean }} [opts]
 */
export function resumeDataToCvData(data, opts = {}) {
  try {
    return resumeDataToCvDataInner(data, opts);
  } catch (e) {
    const msg = String(e?.message || e || '');
    if (!/stack|recursion|Maximum call stack/i.test(msg)) throw e;
    return resumeDataToCvDataFallback(data);
  }
}

function resumeDataToCvDataFallback(data) {
  const rd = data && typeof data === 'object' ? data : {};
  const id = rd.identity && typeof rd.identity === 'object' ? rd.identity : {};
  const exps = Array.isArray(rd.experiences) ? rd.experiences.slice(0, 24) : [];
  return {
    name: String(id.name || '').trim(),
    title: String(id.title || '').trim(),
    email: String(id.email || '').trim(),
    phone: String(id.phone || '').trim(),
    location: String(id.location || '').trim(),
    portfolio: String(id.website || '').trim(),
    linkedin: String(id.linkedin || '').trim(),
    summary: String(rd.summary || '').trim(),
    experience: exps,
    education: Array.isArray(rd.education) ? rd.education.slice(0, 12) : [],
    skills: Array.isArray(rd.skills) ? rd.skills.slice(0, 48) : [],
    tools: Array.isArray(rd.tools) ? rd.tools.slice(0, 48) : [],
    languages: Array.isArray(rd.languages) ? rd.languages.slice(0, 12) : [],
    _fromResumeData: true,
    _stackGuardFallback: true,
  };
}

function resumeDataToCvDataInner(data, opts = {}) {
  const rd = opts.skipNormalize
    ? (() => {
        const shaped = {
          identity: { ...(data?.identity || {}) },
          summary: String(data?.summary || '').trim(),
          experiences: Array.isArray(data?.experiences) ? data.experiences : [],
          education: Array.isArray(data?.education) ? data.education : [],
          skills: Array.isArray(data?.skills) ? data.skills : [],
          tools: Array.isArray(data?.tools) ? data.tools : [],
          languages: Array.isArray(data?.languages) ? data.languages : [],
          clients: Array.isArray(data?.clients) ? data.clients : [],
          projects: Array.isArray(data?.projects) ? data.projects : [],
          exhibitions: Array.isArray(data?.exhibitions) ? data.exhibitions : [],
          awards: Array.isArray(data?.awards) ? data.awards : [],
          publications: Array.isArray(data?.publications) ? data.publications : [],
          press: Array.isArray(data?.press) ? data.press : [],
          portfolioLinks: Array.isArray(data?.portfolioLinks) ? data.portfolioLinks : [],
          unsorted: Array.isArray(data?.unsorted) ? data.unsorted : [],
          meta: data?.meta && typeof data.meta === 'object' ? { ...data.meta } : {},
        };
        try {
          return lockResumeDataShape(shaped);
        } catch {
          return shaped;
        }
      })()
    : normalizeResumeData(data);
  logRenderPipelineCounts('RESUMEDATA_COUNTS', rd);
  const structured = {
    identity: { ...rd.identity },
    summary: rd.summary,
    experiences: rd.experiences,
    education: rd.education,
    clients: rd.clients,
    projects: rd.projects,
    exhibitions: rd.exhibitions,
    awards: rd.awards,
    publications: rd.publications,
    press: rd.press,
    portfolioLinks: rd.portfolioLinks,
    skills: rd.skills,
    tools: rd.tools,
    languages: rd.languages,
  };
  const cv = simpleCvDataFromStructured(structured);
  if (!(cv.experience || []).length && (rd.experiences || []).length) {
    cv.experience = rd.experiences
      .filter((e) => e && (e.role || e.company || (e.bullets || []).length))
      .map((e) => {
        if (Array.isArray(e.specialties) && e.specialties.length) {
          return cloneExp(e);
        }
        const dates = e.dates || [e.startDate, e.endDate].filter(Boolean).join('–');
        const head = [e.role, e.company, dates].filter(Boolean).join(' — ');
        const desc = String(e.rewrittenDescription || '').trim();
        const bullets = desc ? [desc] : (e.bullets || []).filter(Boolean);
        return bullets.length ? `${head}: ${bullets.join(' · ')}` : head;
      })
      .filter(Boolean);
  }
  cv.name = rd.identity.name;
  cv.title = rd.identity.title;
  cv.email = rd.identity.email;
  cv.phone = rd.identity.phone;
  cv.location = rd.identity.location;
  cv.portfolio = rd.identity.website;
  cv.linkedin = rd.identity.linkedin;
  cv._creativeMode = rd.meta?.creativeMode || null;
  const out = normalizeCvDataForTemplate(cv);
  out._fromResumeData = true;
  logRenderPipelineCounts('CVDATA_COUNTS', out);
  return out;
}

export function resumeDataIsRenderable(data, opts = {}) {
  const rd = opts.skipNormalize
    ? data || emptyResumeData()
    : normalizeResumeData(data, { skipSanitize: true });
  const name = rd.identity.name;
  if (name && !isUncertainIdentityName(name)) return true;
  if (rd.identity.title && !isUncertainIdentityTitle(rd.identity.title)) return true;
  if (rd.summary) return true;
  if (rd.experiences.length || rd.education.length) return true;
  if (rd.skills.length || rd.tools.length || rd.clients.length) return true;
  if ((rd.exhibitions || []).length || (rd.awards || []).length || (rd.publications || []).length) return true;
  if (rd.unsorted.length || (rd.suggestions || []).length) return true;
  return false;
}

/**
 * Move lines from unsorted into a section.
 * @param {import('./resume-data.js').ResumeData} data
 * @param {string[]} lineTexts
 * @param {string} target experience|education|client|project|skill|tool|language|summary|ignore
 */
/**
 * Rule 1 — unclassified lines stay in unsorted; rejected / orphan lines are never dropped.
 * @param {import('./resume-data.js').ResumeData} data
 * @param {{ rawText?: string, cleanedText?: string, rejectedLines?: string[] }} [opts]
 */
export function reconcileTextRetention(data, opts = {}) {
  const preservedRawText = String(opts.rawText || data?.meta?.rawText || '').trim();
  const preservedCleanedText = String(
    opts.cleanedText || data?.meta?.cleanedText || preservedRawText
  ).trim();
  let rd = normalizeResumeData(data);
  const source = String(preservedCleanedText || preservedRawText || '').trim();
  const seen = new Set(rd.unsorted.map((l) => String(l).trim().toLowerCase()).filter(Boolean));
  const pushUnsorted = (line) => {
    const t = String(line || '').trim();
    const k = t.toLowerCase();
    if (t.length < 2 || seen.has(k)) return;
    seen.add(k);
    rd.unsorted.push(t);
  };

  for (const line of opts.rejectedLines || []) pushUnsorted(line);

  if (source) {
    const resumeLines = collectStructuredLines(rd);
    const resumeNorm = new Set(resumeLines.map((l) => l.toLowerCase()));
    const cleanLines = source
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 2);
    for (const line of cleanLines) {
      const k = line.toLowerCase();
      if (resumeNorm.has(k) || seen.has(k)) continue;
      let accounted = false;
      for (const r of resumeLines) {
        const rk = r.toLowerCase();
        if (rk.length > 12 && (k.includes(rk) || rk.includes(k))) {
          accounted = true;
          break;
        }
      }
      if (!accounted && lineIsConsumedByResumeData(line, rd)) accounted = true;
      if (!accounted) pushUnsorted(line);
    }
  }

  const postDedup = dedupeSuggestionsAgainstResumeData(rd, {
    rawText: opts.rawText,
    cleanedText: opts.cleanedText,
  });
  rd = postDedup.resumeData;

  const capped = capUnsortedWithArchive(rd.unsorted, rd.meta?.unsortedArchive);
  rd.unsorted = capped.unsorted;
  rd.meta.unsortedArchive = capped.unsortedArchive;
  if (preservedRawText || preservedCleanedText) {
    rd.meta = {
      ...(rd.meta || {}),
      ...(preservedRawText ? { rawText: preservedRawText } : {}),
      ...(preservedCleanedText ? { cleanedText: preservedCleanedText } : {}),
    };
  }
  return rd;
}

function collectStructuredLines(rd) {
  const lines = [];
  const push = (t) => {
    const s = String(t || '').trim();
    if (s.length > 1) lines.push(s);
  };
  push(rd.identity?.name);
  push(rd.identity?.title);
  push(rd.summary);
  for (const x of rd.education || []) push(x);
  for (const x of rd.clients || []) push(x);
  for (const x of rd.projects || []) push(x);
  for (const x of rd.skills || []) push(x);
  for (const x of rd.tools || []) push(x);
  for (const x of rd.languages || []) push(x);
  for (const ex of rd.experiences || []) {
    push(ex.role);
    push(ex.company);
    push(ex.dates);
    for (const b of ex.bullets || []) push(b);
  }
  return lines;
}

export function moveUnsortedToSection(data, lineTexts, target) {
  const rd = normalizeResumeData(data);
  const keys = new Set(lineTexts.map((t) => String(t).trim().toLowerCase()).filter(Boolean));
  const kept = [];
  const moved = [];
  for (const line of rd.unsorted) {
    const k = String(line).trim().toLowerCase();
    if (keys.has(k)) moved.push(String(line).trim());
    else kept.push(line);
  }
  rd.unsorted = kept;
  if (!moved.length) return rd;
  if (target === 'ignore') return rd;
  if (target === 'summary') {
    rd.summary = [rd.summary, ...moved].filter(Boolean).join('\n').trim();
    return rd;
  }
  if (target === 'experience') {
    for (const text of moved) {
      rd.experiences.push({
        role: text.slice(0, 120),
        company: '',
        location: '',
        startDate: '',
        endDate: '',
        dates: '',
        bullets: [],
      });
    }
    return rd;
  }
  const field = {
    education: 'education',
    client: 'clients',
    clients: 'clients',
    project: 'projects',
    projects: 'projects',
    exhibition: 'exhibitions',
    exhibitions: 'exhibitions',
    award: 'awards',
    awards: 'awards',
    publication: 'publications',
    publications: 'publications',
    portfolio: 'portfolioLinks',
    portfolioLinks: 'portfolioLinks',
    skill: 'skills',
    tool: 'tools',
    language: 'languages',
  }[target];
  if (field) rd[field] = [...rd[field], ...moved];
  return rd;
}

export function addExperience(rd) {
  const data = normalizeResumeData(rd);
  data.experiences.push({
    role: '',
    company: '',
    location: '',
    startDate: '',
    endDate: '',
    dates: '',
    bullets: [],
  });
  return data;
}

export function addEducation(rd) {
  const data = normalizeResumeData(rd);
  data.education.push('');
  return data;
}

export function addSkill(rd) {
  const data = normalizeResumeData(rd);
  data.skills.push('');
  return data;
}

export function addClient(rd) {
  const data = normalizeResumeData(rd);
  data.clients.push('');
  return data;
}

export function addTool(rd) {
  const data = normalizeResumeData(rd);
  data.tools.push('');
  return data;
}

export function addProject(rd) {
  const data = normalizeResumeData(rd);
  data.projects.push('');
  return data;
}

export function addPublication(rd) {
  const data = normalizeResumeData(rd);
  data.publications.push('');
  return data;
}

export function addExhibition(rd) {
  const data = normalizeResumeData(rd);
  data.exhibitions.push('');
  return data;
}

export function addAward(rd) {
  const data = normalizeResumeData(rd);
  data.awards.push('');
  return data;
}

export function addPortfolioLink(rd) {
  const data = normalizeResumeData(rd);
  data.portfolioLinks.push('');
  return data;
}

export function addLanguage(rd) {
  const data = normalizeResumeData(rd);
  data.languages.push('');
  return data;
}

/** @param {string[]} list @param {number} index @param {number} delta -1 up, +1 down */
export function reorderListItems(rd, field, index, delta) {
  const data = normalizeResumeData(rd);
  const arr = data[field];
  if (!Array.isArray(arr)) return data;
  const to = index + delta;
  if (to < 0 || to >= arr.length || index < 0 || index >= arr.length) return data;
  const next = [...arr];
  [next[index], next[to]] = [next[to], next[index]];
  data[field] = next;
  return data;
}

export function reorderExperiences(rd, index, delta) {
  const data = normalizeResumeData(rd);
  const to = index + delta;
  if (to < 0 || to >= data.experiences.length) return data;
  const ex = [...data.experiences];
  [ex[index], ex[to]] = [ex[to], ex[index]];
  data.experiences = ex;
  return data;
}

export function clearListSection(rd, field) {
  const data = normalizeResumeData(rd);
  if (field in data && Array.isArray(data[field])) data[field] = [];
  return data;
}

function normalizeToClassifyStrings(toClassify, unsorted) {
  const out = [];
  const seen = new Set();
  for (const x of [...(unsorted || []), ...(toClassify || [])]) {
    const t =
      typeof x === 'string' ? x : String(x?.text || x?.line || '').trim();
    const k = t.toLowerCase();
    if (!t || seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

function legacyExperiences(experience) {
  if (!Array.isArray(experience)) return [];
  return experience
    .map((e) => legacyExperienceLineToEntry(e))
    .filter(Boolean)
    .map((entry) => cloneExp(entry));
}

function cloneExp(e) {
  return {
    role: String(e.role || '').trim(),
    company: String(e.company || '').trim(),
    location: String(e.location || '').trim(),
    startDate: String(e.startDate || '').trim(),
    endDate: String(e.endDate || '').trim(),
    dates: String(e.dates || '').trim(),
    bullets: Array.isArray(e.bullets) ? e.bullets.map((b) => String(b || '').trim()).filter(Boolean) : [],
    clients: Array.isArray(e.clients) ? [...e.clients] : [],
    originalDescription: String(e.originalDescription || e.description || '').trim(),
    rewrittenDescription: String(e.rewrittenDescription || '').trim(),
    description: String(e.description || e.rewrittenDescription || '').trim(),
    rewriteSource: e.rewriteSource || undefined,
    rewriteConfidence: typeof e.rewriteConfidence === 'number' ? e.rewriteConfidence : undefined,
    rewriteRecords: Array.isArray(e.rewriteRecords) ? e.rewriteRecords.map((r) => ({ ...r })) : undefined,
    rewriteSuggestions: Array.isArray(e.rewriteSuggestions) ? [...e.rewriteSuggestions] : undefined,
    safeRewriteApplied: e.safeRewriteApplied === true,
    specialties: Array.isArray(e.specialties)
      ? e.specialties.map((s) => String(s || '').trim()).filter(Boolean)
      : [],
    semanticReconstruction: e.semanticReconstruction || undefined,
    sourceLines: Array.isArray(e.sourceLines) ? [...e.sourceLines] : undefined,
    sourceLineId: e.sourceLineId || undefined,
  };
}
