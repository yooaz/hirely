/**
 * Canonical pipeline data contract — strict structuredResume for render/export.
 */

import { normalizeRawExtract } from '../parsing/clean.js';
import { normalizeCvDocument, CV_NORMALIZER_V1 } from '../parsing/cv-normalizer.js';
import { detectCareerYears } from '../parsing/experience-rebuilder.js';
import {
  blobHasCareerSignals,
  lineLooksLikeCareerHistory,
  unsortedHasCareerLines,
} from '../parsing/generic-career-signals.js';
import { isLikelyGarbageLine } from '../parsing/line-cleaner.js';
import { extractExperiencesFromSectionAnchors } from '../parsing/section-anchor-extract.js';
import { stripTemplateCvData, FORBIDDEN_TEMPLATE_CV_KEYS } from './hirely-flow-lock.js';

export const STRUCTURED_RESUME_JSON_MAX = 20000;

const UNSORTED_MAX_ITEMS = 40;
const UNSORTED_MAX_CHARS = 200;
const EXPERIENCE_MAX = 32;
const BULLET_MAX = 6;
const LIST_MAX = 48;

/**
 * Coerce unknown values to plain strings (never pass objects as text).
 * @param {unknown} value
 * @param {string} [label]
 */
export function coercePipelineString(value, label = 'text') {
  if (typeof value === 'string') return value;
  if (value == null) return '';
  if (typeof value === 'object') {
    const o = /** @type {Record<string, unknown>} */ (value);
    const nested =
      o.text ??
      o.cleanedText ??
      o.cleanText ??
      o.rawText ??
      o.rawExtraction ??
      o.extractedText ??
      '';
    if (typeof nested === 'string') return nested;
    console.error(`PIPELINE_${label}_NOT_STRING`, value);
    return '';
  }
  return String(value);
}

/**
 * @param {unknown} rawText
 * @param {unknown} cleanedText
 * @param {{ applyCvNormalizer?: boolean, extractionMethod?: string, ocr?: boolean }} [opts]
 */
export function normalizePipelineTexts(rawText, cleanedText, opts = {}) {
  let raw = coercePipelineString(rawText, 'RAW');
  let clean = coercePipelineString(cleanedText, 'CLEAN');
  raw = normalizeRawExtract(raw);
  clean = normalizeRawExtract(clean);

  let normalizerStats = null;
  if (opts.applyCvNormalizer !== false && (clean.trim() || raw.trim())) {
    const norm = normalizeCvDocument(clean.trim() ? clean : raw, {
      rawText: raw,
      extractionMethod: opts.extractionMethod,
      ocr: opts.ocr,
    });
    clean = norm.text;
    normalizerStats = norm.stats;
  }

  const rawHadBody = raw.trim().length > 0;
  const cleanWasEmpty = !clean.trim();
  if (rawHadBody && cleanWasEmpty) {
    console.error('CLEANED_TEXT_EMPTY_FALLBACK_USED', { rawLength: raw.length });
    clean = raw;
  }
  return {
    rawText: raw,
    cleanedText: clean,
    usedCleanFallback: rawHadBody && cleanWasEmpty,
    normalizerVersion: normalizerStats ? CV_NORMALIZER_V1 : null,
    normalizerStats,
  };
}

/**
 * @param {unknown} cleanedText
 * @param {unknown} rawText
 */
export function coerceParserInputText(cleanedText, rawText) {
  if (typeof cleanedText !== 'string') {
    console.error('PARSER_INPUT_NOT_STRING', cleanedText);
  }
  const { rawText: raw, cleanedText: clean } = normalizePipelineTexts(rawText, cleanedText);
  return clean.trim() ? clean : raw;
}

function normKey(s) {
  return String(s || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Practical unsorted cap — dedupe, garbage filter, length limits.
 * @param {unknown[]} unsorted
 */
export function capUnsortedPractical(unsorted = []) {
  const seen = new Set();
  const out = [];
  for (const raw of unsorted || []) {
    let t = String(typeof raw === 'object' && raw?.text != null ? raw.text : raw || '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!t || t.length < 3) continue;
    if (/^\{[\s\S]*"(graph|debug|audit|metadata|parserTrace)"/i.test(t)) continue;
    if (isLikelyGarbageLine(t)) continue;
    if (t.length > UNSORTED_MAX_CHARS) t = `${t.slice(0, UNSORTED_MAX_CHARS)}…`;
    const k = normKey(t);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
    if (out.length >= UNSORTED_MAX_ITEMS) break;
  }
  return out;
}

function slimStringList(arr, max = LIST_MAX) {
  return (arr || [])
    .map((x) => String(typeof x === 'object' && x?.text != null ? x.text : x || '').trim())
    .filter((t) => t.length > 0 && t.length <= UNSORTED_MAX_CHARS && !isLikelyGarbageLine(t))
    .filter((t, i, a) => a.findIndex((x) => normKey(x) === normKey(t)) === i)
    .slice(0, max);
}

/**
 * @param {object} exp
 */
function slimExperienceEntry(exp) {
  const e = exp || {};
  const bullets = (e.bullets || [])
    .map((b) => String(b || '').trim())
    .filter((b) => b.length > 4 && b.length <= UNSORTED_MAX_CHARS)
    .slice(0, BULLET_MAX);
  const role = String(e.role || '').trim().slice(0, 160);
  const company = String(e.company || '').trim().slice(0, 120);
  if (!role && !company && !bullets.length) return null;
  const dates = String(e.dates || '').trim().slice(0, 48);
  return {
    role,
    company,
    location: String(e.location || '').trim().slice(0, 80),
    startDate: String(e.startDate || '').trim().slice(0, 12),
    endDate: String(e.endDate || '').trim().slice(0, 24),
    dates,
    bullets,
    clients: slimStringList(e.clients, 12),
  };
}

/**
 * Strict product schema — no debug, graph, audit, or metadata.
 * @param {object|null} structured
 * @param {string} [cleanedText]
 */
export function strictStructuredResume(structured, cleanedText = '') {
  if (!structured || typeof structured !== 'object') {
    return emptyStrictStructuredResume();
  }

  let experiences = (structured.experiences || [])
    .map(slimExperienceEntry)
    .filter(Boolean)
    .slice(0, EXPERIENCE_MAX);

  const clean = String(cleanedText || structured.metadata?.cleanedText || '').trim();
  if (!experiences.length && clean) {
    const lines = clean.split('\n').map((l) => l.trim()).filter(Boolean);
    const anchored = extractExperiencesFromSectionAnchors(lines, clean);
    if (anchored.length) {
      experiences = anchored.map(slimExperienceEntry).filter(Boolean).slice(0, EXPERIENCE_MAX);
    }
  }

  const extraUnsorted = [
    ...(structured.unsorted || []),
    ...(structured.unsortedArchive || []),
    ...(structured.metadata?.unsortedArchive || []),
    ...(structured.metadata?.UNSORTED_ARCHIVE || []),
    ...(structured.publications || []),
    ...(structured.exhibitions || []),
    ...(structured.awards || []),
    ...(structured.interests || []),
    ...(structured.portfolioLinks || []),
  ];

  const id = structured.identity || {};
  return {
    identity: {
      name: String(id.name || structured.selectedName || '').trim().slice(0, 120),
      title: String(id.title || structured.selectedTitle || '').trim().slice(0, 200),
      email: String(id.email || '').trim().slice(0, 120),
      phone: String(id.phone || '').trim().slice(0, 40),
      location: String(id.location || '').trim().slice(0, 80),
      website: String(id.website || id.portfolio || '').trim().slice(0, 200),
      linkedin: String(id.linkedin || '').trim().slice(0, 200),
    },
    summary: String(structured.summary || '').trim().slice(0, 1200),
    experiences,
    education: slimStringList(structured.education, 24),
    clients: slimStringList(structured.clients, LIST_MAX),
    projects: slimStringList(structured.projects, LIST_MAX),
    skills: slimStringList(structured.skills, LIST_MAX),
    tools: slimStringList(structured.tools, LIST_MAX),
    languages: slimStringList(structured.languages, 24),
    unsorted: capUnsortedPractical([...extraUnsorted, ...(structured.unsorted || [])]),
  };
}

export function emptyStrictStructuredResume() {
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
    skills: [],
    tools: [],
    languages: [],
    unsorted: [],
  };
}

/**
 * @param {object|null} structured
 */
export function slimStructuredResume(structured) {
  return strictStructuredResume(structured);
}

/**
 * Debug payload — never merged into structuredResume.
 * @param {object|null} fat
 * @param {object} [ctx]
 */
function clipDebugText(value, max = 6000) {
  const t = coercePipelineString(value, 'DEBUG');
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

function clipDebugJson(value, max = 12000) {
  if (value == null) return null;
  try {
    const s = JSON.stringify(value);
    if (s.length <= max) return value;
    return { _truncated: true, preview: `${s.slice(0, max)}…`, chars: s.length };
  } catch {
    return null;
  }
}

export function buildDebugReport(fat, ctx = {}) {
  const s = fat && typeof fat === 'object' ? fat : {};
  const meta = s.metadata && typeof s.metadata === 'object' ? s.metadata : {};
  const warnings = [
    ...(ctx.warnings || []),
    ...(ctx.audit?.warnings || []),
  ].filter(Boolean);

  return {
    rawText: clipDebugText(ctx.rawText ?? s.rawExtraction ?? meta.rawExtraction ?? meta.rawText),
    cleanText: clipDebugText(ctx.cleanedText ?? meta.cleanedText),
    parserInput: clipDebugText(ctx.parserInput ?? ctx.cleanedText ?? meta.cleanedText),
    audit: clipDebugJson(ctx.audit || ctx.productionAudit || null),
    graph: clipDebugJson(meta.resumeGraph || s._resumeGraph || s.graph || null),
    coverage: clipDebugJson(meta.parserCoverage || meta.zeroTextLossAudit || null),
    warnings,
    parserTrace: clipDebugJson(meta.parserTrace || s.parserTrace || null),
    documentBlocks: clipDebugJson(s.documentBlocks || meta.documentBlocks || null),
    extractionLines: clipDebugJson(s.extractionLines || meta.extractionLines || null),
    zeroTextLossAudit: clipDebugJson(meta.zeroTextLossAudit || null),
    reviewQueue: clipDebugJson(s.reviewQueue || ctx.reviewQueue || null),
    structuredResumeChars: JSON.stringify(strictStructuredResume(s)).length,
    fatChars: JSON.stringify(s).length,
  };
}

/**
 * Size guard — strict schema, retry trim, then identity + unsorted fallback.
 * @param {object|null} fat
 * @param {string} [cleanedText]
 */
export function guardStructuredResumeSize(fat, cleanedText = '') {
  let resume = strictStructuredResume(fat, cleanedText);
  let size = JSON.stringify(resume).length;

  if (size <= STRUCTURED_RESUME_JSON_MAX) {
    return { resume, size, trimmed: false, fallback: false };
  }

  console.error('STRUCTURED_RESUME_TOO_LARGE', size);
  resume.experiences = (resume.experiences || []).slice(0, 16);
  resume.skills = (resume.skills || []).slice(0, 24);
  resume.tools = (resume.tools || []).slice(0, 16);
  resume.unsorted = capUnsortedPractical(resume.unsorted).slice(0, 24);
  size = JSON.stringify(resume).length;

  if (size <= STRUCTURED_RESUME_JSON_MAX) {
    return { resume, size, trimmed: true, fallback: false };
  }

  const lines = String(cleanedText || '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 3);
  const fallbackUnsorted = capUnsortedPractical([
    ...(resume.unsorted || []),
    ...lines.filter((l) => !/@/.test(l) && l.length < 120),
  ]);

  resume = {
    identity: resume.identity,
    summary: '',
    experiences: [],
    education: [],
    clients: [],
    projects: [],
    skills: [],
    tools: [],
    languages: [],
    unsorted: fallbackUnsorted,
  };
  size = JSON.stringify(resume).length;
  return { resume, size, trimmed: true, fallback: true };
}

/**
 * @param {object|null} structured
 * @param {{ throwOnFail?: boolean }} [opts]
 */
export function assertStructuredResumeJsonSize(structured, opts = {}) {
  const guarded = guardStructuredResumeSize(structured);
  const { resume, size } = guarded;
  if (size > STRUCTURED_RESUME_JSON_MAX) {
    const msg = `STRUCTURED_RESUME_TOO_LARGE: ${size} chars (max ${STRUCTURED_RESUME_JSON_MAX})`;
    console.error('STRUCTURED_RESUME_TOO_LARGE', msg);
    if (opts.throwOnFail) throw new Error(msg);
    return { ok: false, length: size, message: msg, slim: resume };
  }
  return { ok: true, length: size, slim: resume };
}

/**
 * Forbidden keys must not appear on product structuredResume.
 * @param {object|null} structured
 */
export function assertStrictStructuredResumeKeys(structured) {
  if (!structured || typeof structured !== 'object') return { ok: true, forbidden: [] };
  const allowed = new Set([
    'identity',
    'summary',
    'experiences',
    'education',
    'clients',
    'projects',
    'skills',
    'tools',
    'languages',
    'unsorted',
  ]);
  const forbidden = Object.keys(structured).filter((k) => !allowed.has(k));
  return { ok: forbidden.length === 0, forbidden };
}

/**
 * @param {object} cvData
 */
export function stripCvDataForTemplate(cvData) {
  if (!cvData || typeof cvData !== 'object') return cvData;
  const d = stripTemplateCvData({ ...cvData });
  delete d._enterprise;
  delete d._sourceLines;
  delete d._parserReview;
  delete d._extractionReview;
  delete d.forensic;
  delete d.enterpriseExtraction;
  for (const key of FORBIDDEN_TEMPLATE_CV_KEYS) {
    delete d[key];
  }
  if (d.structuredResume) {
    d.structuredResume = slimStructuredResume(d.structuredResume);
  }
  return d;
}

/**
 * @param {object|null} structuredResume
 */
export function debugStructuredResumeJson(structuredResume) {
  const check = assertStructuredResumeJsonSize(structuredResume);
  return JSON.stringify(check.slim ?? {}, null, 2);
}

/**
 * @param {object} result
 */
export function slimPipelineResult(result) {
  if (!result || typeof result !== 'object') return result;
  const fat = result.structuredResume;
  const cleaned = coercePipelineString(result.cleanedText, 'CLEAN');
  const guarded = guardStructuredResumeSize(fat, cleaned);
  const validated = stripCvDataForTemplate(result.validatedCVData || {});
  return {
    rawText: coercePipelineString(result.rawText, 'RAW'),
    cleanedText: cleaned,
    structuredResume: guarded.resume,
    debugReport:
      result.debugReport ||
      buildDebugReport(fat, {
        rawText: result.rawText,
        cleanedText: cleaned,
        audit: result.audit,
        productionAudit: result.productionAudit,
        reviewQueue: result.reviewQueue,
        warnings: result.audit?.warnings,
      }),
    validatedCVData: validated,
    rejectedLines: result.rejectedLines || [],
    confidenceReport: result.confidenceReport || null,
    reviewQueue: result.reviewQueue || [],
    score: result.score || null,
    audit: result.audit || null,
    importQuality: result.importQuality || null,
    extractionMethod: result.extractionMethod || null,
    extractionReport: result.extractionReport || null,
    productionAudit: result.productionAudit || result.audit?.productionAudit || null,
    forensicResumeImportId:
      result.forensicResumeImportId || result.audit?.forensicResume?.importId || null,
    documentType: result.documentType,
    layoutType: result.layoutType,
    retention: result.retention,
    canGenerate: result.canGenerate,
    parseConfidence: result.parseConfidence,
    structuredResumeSize: guarded.size,
    structuredResumeFallback: guarded.fallback === true,
  };
}

/**
 * @param {object} structured
 * @param {string} cleanedText
 * @param {{ strict?: boolean }} [opts]
 */
export function assertExperienceRecovery(structured, cleanedText, opts = {}) {
  const clean = String(cleanedText || '');
  const expCount = structured?.experiences?.length ?? 0;
  const unsorted = structured?.unsorted?.length ?? 0;
  const expInUnsorted = unsortedHasCareerLines(structured?.unsorted || []);
  const years = detectCareerYears(clean);
  const signals =
    years.hasYearSpan ||
    years.hasYearLadder ||
    blobHasCareerSignals(clean);
  if ((years.hasYearSpan || years.hasCareerYears) && expCount === 0 && !expInUnsorted) {
    const message = 'EXPERIENCE_REBUILDER_FAILED: career years detected but experienceCount is 0';
    if (opts.strict) throw new Error(message);
    return { ok: false, expCount, unsorted, signals, years, message };
  }
  if (clean.length > 120 && signals && expCount === 0 && unsorted === 0 && !expInUnsorted) {
    const message =
      'EXPERIENCE_RECOVERY_FAILED: career text present but no experiences or unsorted lines';
    if (opts.strict) throw new Error(message);
    return { ok: false, expCount, unsorted, signals, message };
  }
  return { ok: true, expCount, unsorted, signals };
}

/**
 * @param {object} structured
 * @param {string} cleanedText
 */
export function recoverExperienceLinesToUnsorted(structured, cleanedText) {
  const lines = String(cleanedText || '').split('\n').map((l) => l.trim()).filter(Boolean);
  const seen = new Set((structured.unsorted || []).map((x) => normKey(x)));
  for (const line of lines) {
    if (line.length < 8) continue;
    const career = lineLooksLikeCareerHistory(line);
    if (!career) continue;
    const key = normKey(line);
    if (seen.has(key)) continue;
    seen.add(key);
    structured.unsorted = structured.unsorted || [];
    structured.unsorted.push(line.slice(0, UNSORTED_MAX_CHARS));
  }
  structured.unsorted = capUnsortedPractical(structured.unsorted);
  return structured;
}
