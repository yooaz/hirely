/**
 * Extraction quality gate — PASS | NEEDS_REVIEW | FAIL
 */

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_RE = /(?:\+?\d[\d\s().-]{7,}\d)/;

import { structuredTextHasGarbage } from '../../src/data/dictionaries/garbagePatterns.js';
import { TOOLS } from '../../src/data/dictionaries/tools.js';
import { textContainsAny } from '../../src/data/dictionaries/match-utils.js';

const CRITICAL_FIELDS = ['name', 'experience'];

export function completenessScore(cv) {
  const d = cv || {};
  const checks = [
    ['name', !!String(d.name || '').trim()],
    ['title', !!String(d.title || '').trim()],
    ['contact', !!(d.email || d.phone)],
    ['summary', String(d.summary || '').trim().length >= 20],
    ['experience', (d.experience || []).length >= 1],
    ['skills', (d.skills || []).length >= 1],
    ['education', (d.education || []).length >= 1],
  ];
  const hit = checks.filter(([, ok]) => ok).length;
  return {
    percent: Math.round((hit / checks.length) * 100),
    filled: checks.filter(([, ok]) => ok).map(([k]) => k),
    total: checks.length,
  };
}

export function missingCriticalFields(cv) {
  const d = cv || {};
  const missing = [];
  if (!String(d.name || '').trim()) missing.push('name');
  if (!(d.experience || []).length) missing.push('experience');
  if (!String(d.summary || '').trim() && !(d.skills || []).length) missing.push('summary or skills');
  if (!d.email && !d.phone) missing.push('email or phone');
  return missing;
}

function isBlankCv(cv) {
  if (!cv) return true;
  const hasIdentity = String(cv.name || '').trim() || String(cv.title || '').trim();
  const hasBody =
    String(cv.summary || '').trim().length >= 15 ||
    (cv.experience || []).length > 0 ||
    (cv.skills || []).length > 0;
  return !hasIdentity && !hasBody;
}

/** Renderable CV text only — exclude nested structuredResume JSON (avoids `null` false positives). */
function structuredBlob(cv) {
  const d = cv || {};
  return [
    d.name,
    d.title,
    d.email,
    d.phone,
    d.location,
    d.summary,
    ...(d.experience || []),
    ...(d.education || []),
    ...(d.skills || []),
    ...(d.tools || []),
    ...(d.languages || []),
    ...(d.clients || []),
    ...(d.interests || []),
  ]
    .filter(Boolean)
    .join('\n');
}

export function hasOcrGarbageInStructured(cv) {
  const blob = structuredBlob(cv);
  if (structuredTextHasGarbage(blob)) return true;
  const stripped = blob.replace(/\b([A-Z])&([A-Z])\b/g, '$1$2');
  const oneLetterWords = stripped.match(/\b[A-Za-z]\b/g) || [];
  if (oneLetterWords.length > 24) return true;
  if (/\[body\]|\[header\]|PUF\s+Tom|Isnowboard|indesign\s+NEE/i.test(blob)) return true;
  return false;
}

export function emailInSummary(cv) {
  const s = String(cv?.summary || '');
  return EMAIL_RE.test(s);
}

export function contactInEducation(cv) {
  const edu = cv?.education || [];
  return edu.some((line) => EMAIL_RE.test(line) || PHONE_RE.test(line));
}

export function toolsInEducation(cv) {
  const edu = cv?.education || [];
  return edu.some((line) => textContainsAny(line, TOOLS).length > 0);
}

/**
 * @returns {{ status: 'PASS'|'NEEDS_REVIEW'|'FAIL', failures: string[], reviews: string[], completeness: object, missingCritical: string[] }}
 */
export function evaluateExtraction({ cv, audit, rejectedLinesCount = 0 }) {
  const failures = [];
  const reviews = [];
  const completeness = completenessScore(cv);
  const missingCritical = missingCriticalFields(cv);

  if (isBlankCv(cv)) failures.push('blank CV');
  const name = String(cv?.name || '').trim();
  if (!name) failures.push('no name');
  if (name === 'Name to confirm') reviews.push('name needs confirmation');
  if (name && name.includes(' · ') && name.split(' · ').length >= 2) {
    reviews.push('name candidates listed — confirm one');
  }
  if (!(cv?.experience || []).length) failures.push('no experience');
  if (hasOcrGarbageInStructured(cv)) failures.push('OCR garbage in final structuredResume');
  if (emailInSummary(cv)) failures.push('email inside summary');
  if (contactInEducation(cv)) failures.push('phone/email inside education');
  if (toolsInEducation(cv)) failures.push('tools inside education');
  const clients = cv?.clients || [];
  const dup = clients.filter((c, i) => clients.indexOf(c) !== i);
  if (dup.length) failures.push('duplicate clients');

  if (audit?.warnings?.length && !failures.length) {
    reviews.push(...audit.warnings.slice(0, 3));
  }
  if (rejectedLinesCount > 8 && !failures.length) {
    reviews.push(`clean stage dropped ${rejectedLinesCount} lines`);
  }
  if (completeness.percent < 60 && !failures.length) {
    reviews.push(`low completeness (${completeness.percent}%)`);
  }
  if (missingCritical.length > 2 && !failures.length) {
    reviews.push(`missing fields: ${missingCritical.join(', ')}`);
  }

  let status = 'PASS';
  if (failures.length) status = 'FAIL';
  else if (reviews.length) status = 'NEEDS_REVIEW';

  return { status, failures, reviews, completeness, missingCritical };
}

/** Universal structural bar — no person-specific expected values. */
export function evaluateUniversalFixture(cv, cleanedText = '') {
  const failures = [];
  const blob = structuredBlob(cv);
  const hasName = String(cv?.name || '').trim().length >= 2;
  const hasEmail = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(String(cv?.email || ''));
  const hasPhone = /(?:\+?\d[\d\s().-]{7,}\d)/.test(String(cv?.phone || ''));
  if (!hasName && !hasEmail && !hasPhone) {
    failures.push('no identity/contact detected');
  }
  const expCount = (cv?.experience || cv?.structuredResume?.experiences || []).length;
  const unsorted = [
    ...(cv?.unsorted || []),
    ...(cv?.structuredResume?.unsorted || []),
  ].join('\n');
  const careerBlob = `${blob}\n${unsorted}\n${cleanedText}`;
  if (
    expCount < 1 &&
    !/\b(experience|freelance|intern|designer|manager|consultant)\b/i.test(careerBlob)
  ) {
    failures.push('no experience and no career text preserved');
  }
  const edu = (cv?.education || []).join(' ');
  const eduBlob = [edu, cv?.structuredResume?.education?.join(' ') || '', cleanedText].join(' ');
  if (!edu.trim() && !/\b(education|school|university|degree|formation)\b/i.test(eduBlob)) {
    failures.push('no education and no education text preserved');
  }
  const skillCount = (cv?.skills?.length || 0) + (cv?.tools?.length || 0);
  if (skillCount < 1 && !/\b(skill|tool|python|javascript|photoshop|figma)\b/i.test(careerBlob)) {
    failures.push('no skills/tools preserved');
  }
  if (emailInSummary(cv)) failures.push('email inside summary');
  if (hasOcrGarbageInStructured(cv)) failures.push('OCR garbage in structured CV');
  return failures;
}

/** @deprecated Use evaluateUniversalFixture */
export function evaluateYoazFixture(cv, cleanedText = '') {
  return evaluateUniversalFixture(cv, cleanedText);
}
