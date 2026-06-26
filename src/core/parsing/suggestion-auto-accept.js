/**
 * Auto-accept high-confidence suggestions into resumeData sections.
 */

import { classifyLineType } from './block-line-classifier.js';
import { validateCvSectionItem } from './cv-section-contract.js';
import { normalizeResumeData } from '../resume-data.js';
import { normalizeEmail } from './line-cleaner.js';
import { validatePhone } from './rich-parser.js';
import {
  AUTO_ACCEPT_MIN_CONFIDENCE,
  isSafeAutoAccept,
  parseFreelanceCareerLine,
  parseInternshipLine,
  parseEducationLineWithContact,
  extractInlinePhone,
  isCreativeSkillPhrase,
  isStrictSoftwareLine,
  isClientListLine,
} from './classification-fixes.js';
import { scoreEducationLine } from '../validation/confidence-gate.js';
import { recoverSafeParsedExperiences } from './experience-recovery.js';
import { recoverSafeParsedEducation } from './education-recovery.js';

function pushUnique(arr, value) {
  const v = String(value || '').trim();
  if (!v) return;
  if (!arr.some((x) => String(x).trim().toLowerCase() === v.toLowerCase())) arr.push(v);
}

function pushExperience(rd, exp, sourceLine = '') {
  if (!exp?.role && !exp?.company) return;
  const key = `${exp.role}|${exp.company}|${exp.startDate}`.toLowerCase();
  const exists = (rd.experiences || []).some(
    (e) => `${e.role}|${e.company}|${e.startDate}`.toLowerCase() === key
  );
  if (!exists) {
    const src = String(sourceLine || '').trim();
    rd.experiences.push({
      ...exp,
      clients: exp.clients || [],
      bullets: exp.bullets || [],
      sourceLines: src ? [src, ...(exp.sourceLines || [])].filter(Boolean) : exp.sourceLines || [],
    });
  }
}

function pushEducation(rd, line) {
  const parsed = parseEducationLineWithContact(line);
  const edu = parsed?.education || '';
  if (!edu) return false;
  if (parsed?.phone && !rd.identity.phone) rd.identity.phone = parsed.phone;
  if (parsed?.email && !rd.identity.email) rd.identity.email = parsed.email;
  if (scoreEducationLine(edu) < 85) return false;
  pushUnique(rd.education, edu);
  return true;
}

function applyContact(rd, line) {
  const l = String(line || '').trim();
  if (/@/.test(l)) {
    const email = normalizeEmail(l);
    if (email && !rd.identity.email) rd.identity.email = email;
  }
  const phone = extractInlinePhone(l);
  if (validatePhone(phone) && !rd.identity.phone) rd.identity.phone = phone;
  if (/https?:\/\//i.test(l) || /\b(behance|linkedin|instagram|dribbble)\b/i.test(l)) {
    if (/linkedin/i.test(l) && !rd.identity.linkedin) rd.identity.linkedin = l.slice(0, 120);
    else if (!rd.identity.website) rd.identity.website = l.slice(0, 120);
  }
}

/**
 * @param {import('../resume-data.js').ResumeData} data
 * @param {object} [opts]
 */
export function autoAcceptSafeSuggestions(data, opts = {}) {
  const rd =
    data && typeof data === 'object' && data.identity ? data : normalizeResumeData(data);
  const sourceLines = [];
  const seen = new Set();
  const pushLine = (line) => {
    const t = String(line || '').trim();
    if (!t || t.length < 8 || seen.has(t)) return;
    seen.add(t);
    sourceLines.push(t);
  };
  for (const blob of [opts.sourceText, opts.cleanedText, opts.rawText]) {
    for (const line of String(blob || '').split(/\r?\n/)) pushLine(line);
  }
  for (const line of rd.unsorted || []) pushLine(line);
  recoverSafeParsedExperiences(rd, { lines: sourceLines, nearbyLines: rd.unsorted || [] });
  recoverSafeParsedEducation(rd, { lines: sourceLines, nearbyLines: rd.unsorted || [] });
  const kept = [];
  let accepted = 0;

  for (const line of [...(rd.unsorted || [])]) {
    const text = String(line || '').trim();
    if (!text || text.length < 3) continue;

    const freelance = parseFreelanceCareerLine(text);
    if (freelance) {
      pushExperience(rd, freelance, text);
      accepted++;
      continue;
    }

    const internship = parseInternshipLine(text);
    if (internship && (internship.confidence ?? 0) >= 70 && internship.startDate) {
      pushExperience(rd, internship, text);
      accepted++;
      continue;
    }

    if (pushEducation(rd, text)) {
      accepted++;
      continue;
    }

    if (isCreativeSkillPhrase(text)) {
      const parts = text.split(/[,;·]/).map((p) => p.trim()).filter((p) => p.length > 2);
      for (const part of parts.length ? parts : [text]) {
        if (validateCvSectionItem('skill', part).valid) pushUnique(rd.skills, part);
      }
      accepted++;
      continue;
    }

    if (isStrictSoftwareLine(text)) {
      const parts = text.split(/[,;·]/).map((p) => p.trim()).filter((p) => isStrictSoftwareLine(p));
      for (const part of parts.length ? parts : [text]) {
        if (validateCvSectionItem('tool', part).valid) pushUnique(rd.tools, part);
      }
      accepted++;
      continue;
    }

    if (isClientListLine(text)) {
      const parts = text
        .replace(/^[\s(]+/, '')
        .replace(/[)\s]+$/, '')
        .split(/[,;]/)
        .map((p) => p.trim())
        .filter((p) => p.length > 2);
      for (const part of parts) {
        if (validateCvSectionItem('client', part).valid) pushUnique(rd.clients, part);
      }
      accepted++;
      continue;
    }

    const hit = classifyLineType(text, opts.activeSection || null, opts);
    const type = hit.type === 'client' ? 'clients' : hit.type;
    const conf = hit.confidence || 0;

    if (conf >= AUTO_ACCEPT_MIN_CONFIDENCE && isSafeAutoAccept(type, text)) {
      if (type === 'experience') {
        const exp = parseFreelanceCareerLine(text) || parseInternshipLine(text);
        if (exp) pushExperience(rd, exp, text);
      } else if (type === 'education') {
        pushEducation(rd, text);
      } else if (type === 'skills') {
        pushUnique(rd.skills, text);
      } else if (type === 'tools') {
        pushUnique(rd.tools, text);
      } else if (type === 'languages') {
        pushUnique(rd.languages, text);
      } else if (type === 'clients') {
        pushUnique(rd.clients, text);
      } else if (type === 'contact') {
        applyContact(rd, text);
      }
      accepted++;
      continue;
    }

    kept.push(text);
  }

  rd.unsorted = kept;
  if (accepted > 0) {
    rd.meta.warnings = [...(rd.meta.warnings || []), `AUTO_ACCEPT_SUGGESTIONS:${accepted}`];
  }
  return rd;
}
