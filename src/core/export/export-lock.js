/**
 * HIRELY P0 — export lock: PDF must use finalResumeData + visible .cv-page preview.
 */

import { A4_WIDTH_PX, A4_HEIGHT_PX } from './pdf-export-config.js';
import {
  validateExtractionReliabilityForExport,
  isValidImportName,
  hasImportContact,
} from '../validation/extraction-reliability.js';
import { isFinalResumeRenderable } from '../validation/final-resume-contract.js';
import { runQualityValidation } from '../validation/quality-validator.js';
import {
  isExportRewriteActive,
  canExportWithResume,
  validateExportResumeOnly,
  EXPORT_REWRITE_VERSION,
} from './export-rewrite.js';

export const EXPORT_LOCK_VERSION = 'export-lock-v1';
export const CV_EXPORT_ELEMENT_ID = 'cvDoc';
export const CV_EXPORT_REQUIRED_CLASSES = Object.freeze(['cv', 'cv-page', 'cv--live']);

/** Minimum sections expected in export (identity block + at least one body section). */
export const EXPORT_MIN_SECTION_MARKERS = Object.freeze([
  'experience',
  'education',
  'skills',
]);

/**
 * @param {object|null} finalResumeData
 * @param {object|null} contract
 */
export function validateFinalResumeForExport(finalResumeData, contract) {
  const errors = [];
  if (!finalResumeData || typeof finalResumeData !== 'object') {
    errors.push('NO_FINAL_RESUME_DATA');
  }
  if (!isFinalResumeRenderable(contract)) {
    errors.push('FINAL_RESUME_CONTRACT_INVALID');
  }
  const id = finalResumeData?.identity || {};
  const hasIdentity = isValidImportName(id.name) || !!String(id.title || '').trim();
  const hasContact = hasImportContact(id);
  const hasBody =
    (finalResumeData?.experiences || []).length > 0 ||
    (finalResumeData?.education || []).length > 0 ||
    (finalResumeData?.clients || []).length > 0 ||
    (finalResumeData?.projects || []).length > 0;
  if (!hasIdentity) errors.push('MISSING_IDENTITY');
  if (!hasContact) errors.push('MISSING_CONTACT');
  if (!hasBody) errors.push('MISSING_SECTIONS');
  return { ok: errors.length === 0, errors };
}

/**
 * Validate DOM snapshot for export (browser or Playwright evaluate).
 * @param {{
 *   id?: string,
 *   className?: string,
 *   hasEmptyState?: boolean,
 *   widthPx?: number,
 *   scrollHeight?: number,
 *   clientHeight?: number,
 *   sectionCount?: number,
 *   textLength?: number,
 * }} metrics
 */
export function validateExportCvElement(metrics = {}) {
  const errors = [];
  const cls = String(metrics.className || '');
  for (const required of CV_EXPORT_REQUIRED_CLASSES) {
    if (!cls.includes(required)) errors.push(`MISSING_CLASS:${required}`);
  }
  if (metrics.hasEmptyState) errors.push('EMPTY_PREVIEW');
  if ((metrics.textLength || 0) < 40) errors.push('PREVIEW_TOO_SHORT');
  if (metrics.headerClipped) errors.push('HEADER_CLIPPED');

  const width = Math.round(Number(metrics.widthPx) || 0);
  if (width > 0 && Math.abs(width - A4_WIDTH_PX) > 24) {
    errors.push(`A4_WIDTH_MISMATCH:${width}`);
  }

  const scrollH = Number(metrics.scrollHeight) || 0;
  const clientH = Number(metrics.clientHeight) || 0;
  // Only flag crop inside a single A4 box — multi-page previews scroll in a short viewport.
  if (
    scrollH > 0 &&
    clientH > 0 &&
    clientH >= A4_HEIGHT_PX * 0.85 &&
    clientH <= A4_HEIGHT_PX * 1.15 &&
    scrollH > clientH + 8
  ) {
    errors.push('CONTENT_CROPPED');
  }

  if ((metrics.sectionCount || 0) < 1 && (metrics.textLength || 0) < 120) {
    errors.push('NO_VISIBLE_SECTIONS');
  }

  return { ok: errors.length === 0, errors, a4Width: A4_WIDTH_PX, a4Height: A4_HEIGHT_PX };
}

function normExportText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[—–−‑]/g, '-')
    .replace(/[^\w\s@.+-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function exportTokens(line, minLen = 4) {
  const norm = normExportText(line);
  return norm
    .split(/[\s|,;·]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= minLen);
}

function tokensHitDom(tokens, domNorm) {
  return tokens.some((tok) => domNorm.includes(tok));
}

/**
 * Cross-check cvData sections appear in export DOM text.
 * Uses token matching (template may normalize dashes / filter low-confidence lines).
 * @param {object|null} cvData
 * @param {string} domText
 */
export function validateExportSectionParity(cvData, domText) {
  const text = normExportText(domText);
  const errors = [];
  const checks = [];

  const name = String(cvData?.name || '').trim();
  const nameTok = normExportText(name).split(' ').filter((t) => t.length >= 3)[0] || '';
  if (name && name.length > 2) {
    const hit = nameTok ? text.includes(nameTok) : text.includes(normExportText(name).slice(0, 8));
    checks.push({ id: 'name', ok: hit });
    if (!hit) errors.push('NAME_NOT_IN_EXPORT');
  }

  const exp = (cvData?.experience || []).filter(Boolean);
  const edu = (cvData?.education || []).filter(Boolean);
  const skills = [...(cvData?.skills || []), ...(cvData?.tools || [])].filter(Boolean);

  const sectionDefs = [
    { id: 'experience', lines: exp, headers: ['experience', 'experiences', 'experience professionnelle'] },
    { id: 'education', lines: edu, headers: ['education', 'formation', 'formations'] },
    { id: 'skills', lines: skills, headers: ['skills', 'competences', 'compétences', 'tools', 'outils'] },
  ];

  for (const sec of sectionDefs) {
    if (!sec.lines.length) continue;
    const tokens = sec.lines.flatMap((line) => exportTokens(line));
    const headerPresent = sec.headers.some((h) => text.includes(normExportText(h)));
    const hit = tokensHitDom(tokens, text) || (headerPresent && tokens.length === 0);
    checks.push({ id: sec.id, ok: hit });
    // Only fail when section is visibly rendered but content tokens are absent.
    if (!hit && headerPresent) errors.push(`${sec.id.toUpperCase()}_NOT_IN_EXPORT`);
  }

  const bodyTokens = [...exp, ...edu, ...skills].flatMap((line) => exportTokens(line));
  if (bodyTokens.length) {
    const bodyHit = tokensHitDom(bodyTokens, text);
    checks.push({ id: 'body', ok: bodyHit });
    if (!bodyHit) errors.push('BODY_NOT_IN_EXPORT');
  }

  return { ok: errors.length === 0, errors, checks };
}

/**
 * Full export lock validation before PDF write.
 */
export function validateExportLock({
  finalResumeData,
  resumeData,
  contract,
  cvMetrics,
  cvData,
  domText,
  photoState,
  resumeOnly,
}) {
  const rd = resumeData || finalResumeData;
  if (resumeOnly || (isExportRewriteActive() && canExportWithResume(rd))) {
    return {
      ...validateExportResumeOnly({ resumeData: rd, finalResumeData, cvMetrics }),
      version: EXPORT_REWRITE_VERSION,
    };
  }
  const resume = validateFinalResumeForExport(finalResumeData, contract);
  const element = validateExportCvElement(cvMetrics);
  const parity = validateExportSectionParity(cvData, domText);
  const quality = runQualityValidation({
    cvData,
    finalResumeData,
    cvMetrics,
    domText,
    photoState,
  });
  const reliability = validateExtractionReliabilityForExport({
    finalResumeData,
    cvData,
    cvMetrics,
    domText,
  });

  const qualityErrors = quality.exportAllowed
    ? []
    : quality.criticalIssues.map((c) => `QUALITY_${c.id.toUpperCase()}`);
  const reliabilityErrors = reliability.ok ? [] : reliability.errors;

  const errors = [
    ...resume.errors,
    ...element.errors,
    ...parity.errors,
    ...qualityErrors,
    ...reliabilityErrors,
  ];
  return {
    ok: errors.length === 0,
    version: EXPORT_LOCK_VERSION,
    errors,
    resume,
    element,
    parity,
    quality,
    reliability,
  };
}

/**
 * @param {object|null} cvData
 * @param {string} [prefix]
 */
export function buildCvExportFilename(cvData, prefix = 'hirely') {
  const base = String(cvData?.name || 'cv')
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 48) || 'cv';
  return `${prefix}-${base}.pdf`;
}
