/**
 * HIRELY QUALITY VALIDATOR — automated pre-export checks.
 * Blocks export when critical issues are detected.
 */

import { NAME_UNCERTAIN_LABEL, extractDateRangeFromText } from '../parsing/parser-recovery.js';
import { experienceRowHasForbiddenFutureDate } from './data-sanitization-layer.js';
import { DATE_NORMALIZER_MAX_YEAR } from '../parsing/date-normalizer.js';
import { PHOTO_SAFE_ZONE, sanitizePhotoCrop } from '../../ui/pro/photo-system-v2.mjs';
import { A4_WIDTH_PX } from '../export/pdf-export-config.js';
import { hasIdentityEmail, hasIdentityPhone } from './identity-contact.js';

export const QUALITY_VALIDATOR_V1 = 'QUALITY_VALIDATOR_V1';

export const QUALITY_CHECKS = Object.freeze({
  name_exists: { critical: true, label: 'Name present' },
  contact_exists: { critical: true, label: 'Contact present' },
  body_exists: { critical: true, label: 'Experience or education present' },
  experience_exists: { critical: false, label: 'Experience present' },
  education_exists: { critical: false, label: 'Education present' },
  skills_exists: { critical: false, label: 'Skills present' },
  dates_valid: { critical: false, label: 'Dates valid' },
  no_overlap: { critical: false, label: 'No date overlap' },
  no_missing_sections: { critical: true, label: 'Required sections complete' },
  photo_valid: { critical: true, label: 'Photo valid (when enabled)' },
  pdf_render_valid: { critical: true, label: 'PDF preview render valid' },
  header_visible: { critical: true, label: 'Header visible in preview' },
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GARBAGE_NAME_RE =
  /^(ben|music|reading|typography|branding|illustration|vector|print|logo)$/i;
const YEAR_RE = /\b(19|20)\d{2}\b/;
const PRESENT_RE = /present|présent|current|now|aujourd'hui/i;

const REQUIRED_SECTIONS = Object.freeze(['name', 'contact', 'experience_or_education']);

function pushCheck(checks, id, ok, message, detail = null) {
  const def = QUALITY_CHECKS[id] || { critical: false, label: id };
  checks.push({
    id,
    ok: !!ok,
    critical: !!def.critical,
    level: ok ? 'pass' : def.critical ? 'critical' : 'warning',
    label: def.label,
    message: message || (ok ? 'OK' : def.label),
    detail,
  });
}

function parseYear(value) {
  const n = parseInt(String(value || '').replace(/\D/g, '').slice(0, 4), 10);
  return Number.isNaN(n) ? null : n;
}

function hasName(cv) {
  const n = String(cv?.name || '').trim();
  if (!n || n === NAME_UNCERTAIN_LABEL || n === 'Nom à compléter' || n === 'Nom à confirmer') return false;
  if (GARBAGE_NAME_RE.test(n)) return false;
  return n.length >= 2 && n.length <= 80;
}

function hasContact(cv) {
  const identity = {
    email: cv?.email,
    phone: cv?.phone,
    location: cv?.location,
    linkedin: cv?.linkedin,
    website: cv?.website,
  };
  return hasIdentityEmail(identity) || hasIdentityPhone(identity);
}

function hasExperience(cv) {
  const exp = Array.isArray(cv?.experience) ? cv.experience.filter(Boolean) : [];
  const clients = Array.isArray(cv?.clients) ? cv.clients.filter(Boolean) : [];
  const projects = Array.isArray(cv?.projects) ? cv.projects.filter(Boolean) : [];
  return exp.length > 0 || clients.length > 0 || projects.length > 0;
}

function hasEducation(cv) {
  const edu = Array.isArray(cv?.education) ? cv.education.filter(Boolean) : [];
  return edu.length > 0;
}

function hasSkills(cv) {
  const n = (cv?.skills || []).filter(Boolean).length + (cv?.tools || []).filter(Boolean).length;
  return n > 0;
}

function lineHasDate(line) {
  const s = String(line || '').trim();
  if (!s) return false;
  if (YEAR_RE.test(s)) return true;
  return !!extractDateRangeFromText(s).startDate;
}

function parseExperienceRange(line) {
  const extracted = extractDateRangeFromText(String(line || ''));
  let start = parseYear(extracted.startDate);
  let end = parseYear(extracted.endDate);
  if (PRESENT_RE.test(extracted.endDate || '')) {
    end = new Date().getFullYear();
  }
  if (start && !end) end = start;
  if (!start && end) start = end;
  if (!start || !end) return null;
  return { start, end, line: String(line || '').trim() };
}

function auditDates(experience = []) {
  const invalid = [];
  const missing = [];
  for (const line of experience) {
    const s = String(line || '').trim();
    if (!s) continue;
    if (!lineHasDate(s)) missing.push(s);
    if (experienceRowHasForbiddenFutureDate(s, DATE_NORMALIZER_MAX_YEAR)) invalid.push(s);
    const range = parseExperienceRange(s);
    if (range && range.start > range.end) invalid.push(s);
  }
  return { missing, invalid };
}

function findDateOverlaps(experience = []) {
  const ranges = experience.map(parseExperienceRange).filter(Boolean);
  const overlaps = [];
  for (let i = 0; i < ranges.length; i++) {
    for (let j = i + 1; j < ranges.length; j++) {
      const a = ranges[i];
      const b = ranges[j];
      if (a.start <= b.end && b.start <= a.end) {
        overlaps.push({ a: a.line, b: b.line, startA: a.start, endA: a.end, startB: b.start, endB: b.end });
      }
    }
  }
  return overlaps;
}

function auditMissingSections(cv) {
  const missing = [];
  if (!hasName(cv)) missing.push('name');
  if (!hasContact(cv)) missing.push('contact');
  if (!hasExperience(cv) && !hasEducation(cv)) missing.push('experience_or_education');
  if (!hasSkills(cv)) missing.push('skills');
  return missing;
}

function isPhotoActive(photoState = {}) {
  const { photo, includePhoto, templateId, photoPerTemplate } = photoState;
  if (!photo) return false;
  if (photoPerTemplate && templateId && typeof photoPerTemplate === 'object') {
    if (photoPerTemplate[templateId] === false) return false;
    if (photoPerTemplate[templateId] === true) return true;
  }
  return includePhoto !== false;
}

function auditPdfRender(metrics) {
  if (!metrics || typeof metrics !== 'object') {
    return { ok: true, skipped: true, errors: [] };
  }
  const errors = [];
  const cls = String(metrics.className || '');
  if (!cls.includes('cv') || !cls.includes('cv--live')) errors.push('PREVIEW_NOT_LIVE');
  if (metrics.hasEmptyState) errors.push('EMPTY_PREVIEW');
  if ((metrics.textLength || 0) < 40) errors.push('PREVIEW_TOO_SHORT');
  if (metrics.headerClipped) errors.push('HEADER_CLIPPED');
  const width = Math.round(Number(metrics.widthPx) || 0);
  if (width > 0 && Math.abs(width - A4_WIDTH_PX) > 24) errors.push(`A4_WIDTH_MISMATCH:${width}`);
  if ((metrics.sectionCount || 0) < 1 && (metrics.textLength || 0) < 120) errors.push('NO_VISIBLE_SECTIONS');
  return { ok: errors.length === 0, skipped: false, errors };
}

function auditPhoto(photoState = {}) {
  if (!isPhotoActive(photoState)) {
    return { active: false, ok: true, reason: 'Photo not enabled' };
  }
  const photo = String(photoState.photo || '').trim();
  if (!photo) return { active: true, ok: false, reason: 'Photo enabled but missing image data' };
  if (!/^data:image\/(jpeg|jpg|png|webp);base64,/i.test(photo) && !/^https?:\/\//i.test(photo)) {
    return { active: true, ok: false, reason: 'Photo data URL format invalid' };
  }
  if (photo.startsWith('data:') && photo.length < 120) {
    return { active: true, ok: false, reason: 'Photo data too small' };
  }
  const crop = sanitizePhotoCrop(photoState.photoCrop || {});
  if (Number(crop.zoom) !== 1) {
    return { active: true, ok: false, reason: 'Photo zoom must be baked (no live scale)' };
  }
  const domPhoto = photoState.domPhotoHtml || '';
  if (domPhoto && /transform:\s*scale/i.test(domPhoto)) {
    return { active: true, ok: false, reason: 'Photo uses transform scale (overlap risk)' };
  }
  if (domPhoto && !/cvPhotoWrap--safe|data-photo-v2/i.test(domPhoto) && domPhoto.includes('cvPhoto')) {
    return { active: true, ok: false, reason: 'Photo missing V2 safe zone wrapper' };
  }
  return {
    active: true,
    ok: true,
    reason: 'Photo valid',
    maxSizePx: PHOTO_SAFE_ZONE.maxSizePx,
  };
}

/**
 * @param {{
 *   cvData?: object|null,
 *   finalResumeData?: object|null,
 *   cvMetrics?: object|null,
 *   domText?: string,
 *   photoState?: object|null,
 * }} input
 */
export function runQualityValidation(input = {}) {
  const cv =
    input.cvData && typeof input.cvData === 'object'
      ? input.cvData
      : finalResumeToCvShape(input.finalResumeData);

  const checks = [];
  const experience = (cv?.experience || []).filter(Boolean);

  pushCheck(checks, 'name_exists', hasName(cv), hasName(cv) ? 'Name present' : 'Name missing or uncertain');
  const contactOk = hasContact(cv);
  pushCheck(
    checks,
    'contact_exists',
    contactOk,
    contactOk ? 'Contact present' : 'Email or phone required before export'
  );
  const bodyOk = hasExperience(cv) || hasEducation(cv);
  pushCheck(
    checks,
    'body_exists',
    bodyOk,
    bodyOk ? 'Experience or education present' : 'At least one experience or education entry required'
  );
  pushCheck(
    checks,
    'experience_exists',
    hasExperience(cv),
    hasExperience(cv) ? 'Experience section present' : 'Experience section empty'
  );
  pushCheck(
    checks,
    'education_exists',
    hasEducation(cv),
    hasEducation(cv) ? 'Education section present' : 'Education section empty'
  );
  pushCheck(
    checks,
    'skills_exists',
    hasSkills(cv),
    hasSkills(cv) ? 'Skills section present' : 'Skills section empty'
  );

  const dateAudit = auditDates(experience);
  const datesOk = dateAudit.missing.length === 0 && dateAudit.invalid.length === 0;
  pushCheck(
    checks,
    'dates_valid',
    datesOk,
    datesOk
      ? 'Experience dates valid'
      : dateAudit.invalid.length
        ? 'Invalid or future dates detected'
        : 'Some experience entries missing dates',
    datesOk ? null : { missing: dateAudit.missing.slice(0, 6), invalid: dateAudit.invalid.slice(0, 6) }
  );

  const overlaps = findDateOverlaps(experience);
  pushCheck(
    checks,
    'no_overlap',
    overlaps.length === 0,
    overlaps.length === 0 ? 'No overlapping experience dates' : 'Overlapping experience date ranges',
    overlaps.length ? overlaps.slice(0, 4) : null
  );

  const missingSections = auditMissingSections(cv);
  const sectionsOk = !missingSections.some((s) => REQUIRED_SECTIONS.includes(s));
  pushCheck(
    checks,
    'no_missing_sections',
    sectionsOk,
    sectionsOk ? 'All required sections present' : `Missing: ${missingSections.join(', ')}`,
    sectionsOk ? null : missingSections
  );

  const photoAudit = auditPhoto(input.photoState || {});
  if (photoAudit.active) {
    pushCheck(checks, 'photo_valid', photoAudit.ok, photoAudit.reason);
  } else {
    pushCheck(checks, 'photo_valid', true, 'Photo not enabled — skipped');
  }

  let pdfOk = true;
  let pdfDetail = null;
  const render = auditPdfRender(input.cvMetrics);
  if (!render.skipped) {
    pdfOk = render.ok;
    pdfDetail = render.errors;
    pushCheck(
      checks,
      'pdf_render_valid',
      pdfOk,
      pdfOk ? 'PDF preview render valid' : 'PDF preview not export-ready',
      pdfOk ? null : pdfDetail
    );
  } else {
    pushCheck(checks, 'pdf_render_valid', true, 'PDF render check deferred (no DOM metrics)');
  }

  const dom = String(input.domText || '').trim();
  const name = String(cv?.name || '').trim();
  let headerOk = true;
  if (name && dom.length >= 20) {
    const token = name.split(/\s+/).find((t) => t.length >= 3) || name.slice(0, 8);
    headerOk = !token || dom.toLowerCase().includes(token.toLowerCase());
  }
  if (input.cvMetrics?.headerClipped) headerOk = false;
  pushCheck(
    checks,
    'header_visible',
    headerOk,
    headerOk ? 'Header visible in preview' : 'Header missing or clipped in preview'
  );

  const criticalIssues = checks.filter((c) => !c.ok && c.critical);
  const warnings = checks.filter((c) => !c.ok && !c.critical);
  const passed = checks.filter((c) => c.ok).length;
  const score = checks.length ? Math.round((passed / checks.length) * 100) : 0;
  const exportAllowed = criticalIssues.length === 0;

  return {
    version: QUALITY_VALIDATOR_V1,
    ready: true,
    exportAllowed,
    score,
    confidence: {
      score: exportAllowed ? Math.max(72, score) : Math.min(score, 55),
      label: exportAllowed ? (score >= 90 ? 'high' : 'medium') : 'blocked',
    },
    checks,
    criticalIssues: criticalIssues.map((c) => ({ id: c.id, message: c.message, detail: c.detail })),
    warnings: warnings.map((c) => ({ id: c.id, message: c.message, detail: c.detail })),
    missingSections,
    dateOverlaps: overlaps,
    photo: photoAudit,
    pdfRender: input.cvMetrics ? { ok: pdfOk, errors: pdfDetail || [] } : null,
  };
}

/**
 * @param {object|null} report
 */
export function isQualityExportAllowed(report) {
  return !!(report && report.exportAllowed);
}

/**
 * @param {object|null} finalResumeData
 */
export function finalResumeToCvShape(finalResumeData) {
  const d = finalResumeData || {};
  const id = d.identity || {};
  return {
    name: id.name,
    title: id.title,
    email: id.email,
    phone: id.phone,
    location: id.location,
    linkedin: id.linkedin,
    portfolio: id.portfolio,
    summary: d.summary,
    experience: d.experiences || [],
    education: d.education || [],
    skills: d.skills || [],
    tools: d.tools || [],
    languages: d.languages || [],
  };
}
