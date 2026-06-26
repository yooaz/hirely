/**
 * Review Studio V2 — recruiter readiness report and export gates.
 * Export requires: identity + contact + at least one content block
 * (experience OR skills OR summary). Education is optional.
 */

import { NAME_UNCERTAIN_LABEL, TITLE_UNCERTAIN_LABEL } from '../parsing/parser-recovery.js';

const GARBAGE_NAME_RE =
  /^(ben|music|reading|typography|branding|illustration|vector|print|logo)$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const YEAR_RE = /\b(19|20)\d{2}\b/;
const DATE_RANGE_RE =
  /\b(19|20)\d{2}\s*[-–—]\s*((19|20)\d{2}|present|présent|current|now|aujourd'hui)\b/i;

const SECTION_KEYS = [
  { id: 'identity', fields: ['name', 'title', 'email', 'phone'] },
  { id: 'summary', fields: ['summary'] },
  { id: 'experience', fields: ['experience'] },
  { id: 'education', fields: ['education'] },
  { id: 'skills', fields: ['skills', 'tools'] },
  { id: 'languages', fields: ['languages'] },
];

function hasName(p) {
  const n = String(p?.name || '').trim();
  if (!n || n === NAME_UNCERTAIN_LABEL || n === 'Nom à compléter') return false;
  if (GARBAGE_NAME_RE.test(n)) return false;
  return n.length >= 2 && n.length <= 80;
}

function hasTitle(p) {
  const t = String(p?.title || '').trim();
  if (!t || t === TITLE_UNCERTAIN_LABEL || t === 'Poste à compléter') return false;
  return t.length >= 3;
}

function hasEmail(p) {
  return EMAIL_RE.test(String(p?.email || '').trim());
}

function hasPhone(p) {
  const phone = String(p?.phone || '').trim();
  if (!phone) return false;
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 15;
}

function resumeSectionCount(p, key) {
  const n = p?._resumeCounts?.[key];
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function hasExperience(p) {
  if (resumeSectionCount(p, 'experiences') > 0) return true;
  return Array.isArray(p?.experience) && p.experience.filter(Boolean).length > 0;
}

function hasEducation(p) {
  if (resumeSectionCount(p, 'education') > 0) return true;
  return Array.isArray(p?.education) && p.education.filter(Boolean).length > 0;
}

function hasSkills(p) {
  const fromResume = resumeSectionCount(p, 'skills') + resumeSectionCount(p, 'tools');
  if (fromResume >= 1) return true;
  const n = (p?.skills || []).filter(Boolean).length + (p?.tools || []).filter(Boolean).length;
  return n >= 1;
}

function hasSummary(p) {
  return String(p?.summary || '').trim().length >= 12;
}

function hasContact(p) {
  return hasEmail(p) || hasPhone(p);
}

function hasContent(p) {
  return hasExperience(p) || hasSkills(p) || hasSummary(p);
}

function normalizeExpKey(line) {
  return String(line || '')
    .toLowerCase()
    .replace(/\b(19|20)\d{2}\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .slice(0, 80);
}

function findDuplicateExperiences(experience) {
  const exp = Array.isArray(experience) ? experience.filter(Boolean) : [];
  const seen = new Map();
  const dupes = [];
  for (const line of exp) {
    const key = normalizeExpKey(line);
    if (!key || key.length < 8) continue;
    if (seen.has(key)) {
      if (!dupes.includes(line)) dupes.push(line);
    } else {
      seen.set(key, line);
    }
  }
  return dupes;
}

function findMissingDates(experience) {
  const exp = Array.isArray(experience) ? experience.filter(Boolean) : [];
  return exp.filter((line) => {
    const s = String(line || '').trim();
    if (!s) return false;
    return !YEAR_RE.test(s) && !DATE_RANGE_RE.test(s);
  });
}

function findMissingSections(p) {
  const missing = [];
  if (!hasName(p) || !hasTitle(p)) missing.push('identity');
  if (!hasContact(p)) missing.push('contact');
  if (!hasContent(p)) missing.push('content');
  if (!String(p?.summary || '').trim()) missing.push('summary');
  if (!hasExperience(p)) missing.push('experience');
  /** Informational only — never contradict finalResumeData when education exists. */
  if (!hasEducation(p)) missing.push('education');
  if (!hasSkills(p)) missing.push('skills');
  const langN = resumeSectionCount(p, 'languages') || (p?.languages || []).filter(Boolean).length;
  if (!langN) missing.push('languages');
  return missing;
}

/**
 * @param {object|null} cvData normalized cvData
 * @param {{ toClassifyCount?: number, atsScore?: number|null, atsBand?: object|null }} [opts]
 */
export function buildReviewReadinessReport(cvData, opts = {}) {
  try {
  return buildReviewReadinessReportInner(cvData, opts);
  } catch {
    return { completionPct: 0, gates: {}, missing: ['stack_guard'], exportReady: false };
  }
}

function buildReviewReadinessReportInner(cvData, opts = {}) {
  const p = cvData && typeof cvData === 'object' ? cvData : null;
  const toClassifyCount = opts.toClassifyCount ?? 0;

  const gates = {
    identity: !!(p && hasName(p) && (hasTitle(p) || hasContact(p))),
    contact: !!(p && hasContact(p)),
    content: !!(p && hasContent(p) && !(toClassifyCount > 0 && !hasExperience(p) && !hasSkills(p) && !hasSummary(p))),
    /** Informational — never blocks export when source CV has no education. */
    education: !!(p && hasEducation(p)),
    experience: !!(p && hasExperience(p)),
    skills: !!(p && hasSkills(p)),
  };

  if (p && toClassifyCount > 0 && !hasExperience(p) && !hasSkills(p) && !hasSummary(p)) {
    gates.content = false;
  }

  const gateList = ['identity', 'contact', 'content'];
  const passed = gateList.filter((k) => gates[k]).length;
  const completionPct = Math.round((passed / gateList.length) * 100);
  const exportReady = gateList.every((k) => gates[k]);

  const experience = p?.experience || [];
  const skills = [...(p?.skills || []), ...(p?.tools || [])].filter(Boolean);
  const languages = (p?.languages || []).filter(Boolean);

  return {
    gates,
    gateList,
    completionPct,
    exportReady,
    atsScore: opts.atsScore ?? null,
    atsBand: opts.atsBand ?? null,
    missingSections: p ? findMissingSections(p) : ['identity', 'contact', 'content'],
    missingDates: p ? findMissingDates(experience) : [],
    duplicateExperiences: p ? findDuplicateExperiences(experience) : [],
    detected: {
      languages,
      skills: skills.slice(0, 24),
      contact: {
        name: String(p?.name || '').trim() || null,
        title: String(p?.title || '').trim() || null,
        email: String(p?.email || '').trim() || null,
        phone: String(p?.phone || '').trim() || null,
        linkedin: String(p?.linkedin || '').trim() || null,
        location: String(p?.location || '').trim() || null,
        portfolio: String(p?.portfolio || '').trim() || null,
      },
    },
    toClassifyCount,
    sectionKeys: SECTION_KEYS,
  };
}

/**
 * @param {object|null} report from buildReviewReadinessReport
 */
export function isExportReady(report) {
  return !!(report && report.exportReady);
}
