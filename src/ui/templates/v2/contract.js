/**
 * Template System V2 — rendering contract.
 * Parser logic lives in src/core only; templates never parse or import CVs.
 */

export const TEMPLATE_SYSTEM_V2 = 'TEMPLATE_SYSTEM_V2';
export const TEMPLATE_SYSTEM_P5_LOCK = 'TEMPLATE_SYSTEM_P5_LOCK';

/** Canonical UX P3 template IDs (five premium production templates). */
export const TEMPLATE_V2_IDS = Object.freeze([
  'ats',
  'creative',
  'executive-minimal',
  'modern-two-column',
  'editorial',
]);

/** Page policy shared by all V2 templates. */
export const TEMPLATE_V2_PAGE_POLICY = Object.freeze({
  format: 'A4',
  widthPx: 794,
  heightPx: 1123,
  widthMm: 210,
  heightMm: 297,
  priorityPages: 1,
  maxPages: 2,
  a4Safe: true,
  pdfSafe: true,
});

/**
 * Architecture rules — enforced by convention + QA.
 */
export const TEMPLATE_V2_RULES = Object.freeze({
  singleDataSource: 'finalResumeData',
  renderingOnly: true,
  noParserDuplication: true,
  noOcrInTemplates: true,
  noAtsScoringInTemplates: true,
  noRawTextInTemplates: true,
  previewEqualsExport: true,
});

/**
 * @typedef {object} TemplateV2Contract
 * @property {string} id
 * @property {string} displayName
 * @property {string} renderLayerId — existing layout id in cv-templates.js
 * @property {'single'|'split'|'magazine'|'luxury'|'agency'} layoutFamily
 * @property {'high'|'medium'} atsSafety
 * @property {number} creativeLevel 1–5
 * @property {string} [defaultSpacing] normal | compact
 * @property {string} cssClass — outer .template-* class on #cvDoc
 */

/**
 * @param {string} templateId
 * @returns {boolean}
 */
export function isTemplateV2Id(templateId) {
  return TEMPLATE_V2_IDS.includes(String(templateId || '').trim().toLowerCase());
}

/**
 * Validate that a render input did not carry forbidden parser/raw fields.
 * @param {object} view
 */
export function assertTemplateViewContract(view) {
  const forbidden = [
    'rawText',
    'cleanedText',
    'cleanText',
    'ocrText',
    'blocks',
    'structuredResume',
    'parserDebug',
    'extractionLines',
  ];
  const hits = forbidden.filter((k) => view != null && k in view);
  return {
    ok: hits.length === 0,
    forbidden: hits,
    engine: TEMPLATE_SYSTEM_V2,
  };
}
