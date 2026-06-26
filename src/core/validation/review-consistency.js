/**
 * HIRELY P0 — Review panel consistency with finalResumeData + rendered CV.
 * Checklist and suggestions must not contradict the live preview.
 */

import { resumeDataSectionCounts } from './recruiter-checklist-source.js';
import { resolveIdentityContact } from './identity-contact.js';

function normKey(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ');
}

function finalResumeDisplayToResumeData(frd) {
  if (!frd || typeof frd !== 'object') return null;
  if (Array.isArray(frd.experiences) || frd.identity) {
    return {
      identity: { ...(frd.identity || {}) },
      summary: String(frd.summary || '').trim(),
      experiences: Array.isArray(frd.experiences) ? frd.experiences : [],
      education: Array.isArray(frd.education) ? frd.education : [],
      skills: Array.isArray(frd.skills) ? frd.skills : [],
      tools: Array.isArray(frd.tools) ? frd.tools : [],
      languages: Array.isArray(frd.languages) ? frd.languages : [],
      clients: Array.isArray(frd.clients) ? frd.clients : [],
      projects: Array.isArray(frd.projects) ? frd.projects : [],
    };
  }
  return frd;
}

/**
 * Section counts from canonical finalResumeData only.
 * @param {object|null} finalResumeData
 */
export function getFinalResumeSectionCounts(finalResumeData) {
  const shaped = finalResumeDisplayToResumeData(finalResumeData);
  if (!shaped) {
    return { experiences: 0, education: 0, skills: 0, tools: 0, languages: 0, clients: 0, projects: 0 };
  }
  const base = resumeDataSectionCounts(shaped);
  return {
    ...base,
    clients: (shaped.clients || []).filter((s) => String(s || '').trim()).length,
    projects: (shaped.projects || []).filter((s) => String(s || '').trim()).length,
  };
}

/**
 * Product checklist — derived from finalResumeData.identity only (not gated cvData).
 * @param {object|null} finalResumeData
 */
export function buildReviewChecklistFromFinalResume(finalResumeData) {
  const shaped = finalResumeDisplayToResumeData(finalResumeData);
  const id = shaped?.identity || {};
  const contact = resolveIdentityContact(id);
  const counts = getFinalResumeSectionCounts(finalResumeData);
  const name = String(id.name || '').trim();

  return [
    { id: 'name', ok: name.length >= 2 },
    { id: 'email', ok: contact.hasEmail },
    { id: 'phone', ok: contact.hasPhone },
    { id: 'experience', ok: counts.experiences > 0 },
    { id: 'education', ok: counts.education > 0 },
    { id: 'skills', ok: counts.skills > 0 || counts.tools > 0 },
    { id: 'tools', ok: counts.tools > 0 },
    { id: 'languages', ok: counts.languages > 0 },
  ];
}

function educationLineTokens(entry) {
  if (!entry) return [];
  if (typeof entry === 'string') return [normKey(entry)].filter((t) => t.length >= 3);
  const bits = [entry.degree, entry.school, entry.field, entry.dates, entry.startDate, entry.endDate]
    .map((x) => normKey(x))
    .filter((t) => t.length >= 3);
  return bits;
}

function cvTextIndex(finalResumeData, renderedCv) {
  const exact = new Set();
  const hayParts = [];

  const add = (value) => {
    const t = normKey(value);
    if (!t || t.length < 2) return;
    exact.add(t);
    hayParts.push(t);
  };

  const shaped = finalResumeDisplayToResumeData(finalResumeData);
  if (shaped) {
    const id = shaped.identity || {};
    add(id.name);
    add(id.title);
    add(shaped.summary);
    for (const exp of shaped.experiences || []) {
      if (typeof exp === 'string') add(exp);
      else {
        add(exp?.role);
        add(exp?.company);
        add(exp?.dates);
        for (const b of exp?.bullets || []) add(b);
      }
    }
    for (const edu of shaped.education || []) {
      for (const tok of educationLineTokens(edu)) add(tok);
    }
    for (const list of [shaped.skills, shaped.tools, shaped.languages, shaped.clients, shaped.projects]) {
      for (const item of list || []) add(item);
    }
  }

  if (renderedCv && typeof renderedCv === 'object') {
    for (const line of renderedCv.experience || []) add(line);
    for (const line of renderedCv.education || []) add(line);
    for (const list of ['skills', 'tools', 'languages', 'clients', 'projects']) {
      for (const item of renderedCv[list] || []) add(item);
    }
    add(renderedCv.name);
    add(renderedCv.title);
    add(renderedCv.summary);
  }

  return { exact, hay: hayParts.join(' ') };
}

/**
 * True when suggestion text is already represented in final resume or rendered CV.
 * @param {string} text
 * @param {object|null} finalResumeData
 * @param {object|null} [renderedCv]
 */
export function isSuggestionAlreadyRendered(text, finalResumeData, renderedCv = null) {
  const t = normKey(text);
  if (!t || t.length < 3) return false;
  const { exact, hay } = cvTextIndex(finalResumeData, renderedCv);
  if (exact.has(t)) return true;
  if (t.length >= 4 && hay.includes(t)) return true;
  for (const phrase of exact) {
    if (phrase.length >= 6 && (t.includes(phrase) || phrase.includes(t))) return true;
  }
  return false;
}

/**
 * Drop suggestions that duplicate content already on the CV.
 * @param {object[]} suggestions
 * @param {object|null} finalResumeData
 * @param {object|null} [renderedCv]
 */
export function filterSuggestionsNotInCv(suggestions = [], finalResumeData, renderedCv = null) {
  const kept = [];
  const dropped = [];
  for (const s of suggestions) {
    const text = String(s.text || s.sourceText || s.detected || '').trim();
    if (isSuggestionAlreadyRendered(text, finalResumeData, renderedCv)) {
      dropped.push({ ...s, archiveReason: 'already_rendered' });
    } else {
      kept.push(s);
    }
  }
  return { items: kept, dropped };
}

/**
 * QA: detect review vs preview contradictions.
 * @param {{ finalResumeData: object, checklist: {id:string,ok:boolean}[], missingReviewIds?: string[], suggestions?: string[], renderedCv?: object }} input
 */
export function detectReviewPreviewContradictions(input) {
  const counts = getFinalResumeSectionCounts(input.finalResumeData);
  const contradictions = [];

  const checklist = input.checklist || [];
  const byId = Object.fromEntries(checklist.map((c) => [c.id, c]));

  if (counts.education > 0 && byId.education && !byId.education.ok) {
    contradictions.push({ section: 'education', reason: 'checklist_miss_but_final_has_data', count: counts.education });
  }
  if (counts.experiences > 0 && byId.experience && !byId.experience.ok) {
    contradictions.push({ section: 'experience', reason: 'checklist_miss_but_final_has_data', count: counts.experiences });
  }
  if ((counts.skills > 0 || counts.tools > 0) && byId.skills && !byId.skills.ok) {
    contradictions.push({ section: 'skills', reason: 'checklist_miss_but_final_has_data' });
  }
  if (counts.languages > 0 && byId.languages && !byId.languages.ok) {
    contradictions.push({ section: 'languages', reason: 'checklist_miss_but_final_has_data' });
  }

  const contact = resolveIdentityContact(input.finalResumeData?.identity);
  if (contact.hasPhone && byId.phone && !byId.phone.ok) {
    contradictions.push({ section: 'phone', reason: 'checklist_miss_but_identity_has_phone' });
  }
  if (contact.hasEmail && byId.email && !byId.email.ok) {
    contradictions.push({ section: 'email', reason: 'checklist_miss_but_identity_has_email' });
  }

  for (const id of input.missingReviewIds || []) {
    if (id === 'education' && counts.education > 0) {
      contradictions.push({ section: 'education', reason: 'review_missing_but_final_has_data' });
    }
    if (id === 'experience' && counts.experiences > 0) {
      contradictions.push({ section: 'experience', reason: 'review_missing_but_final_has_data' });
    }
    if (id === 'skills' && (counts.skills > 0 || counts.tools > 0)) {
      contradictions.push({ section: 'skills', reason: 'review_missing_but_final_has_data' });
    }
  }

  for (const text of input.suggestions || []) {
    if (isSuggestionAlreadyRendered(text, input.finalResumeData, input.renderedCv)) {
      contradictions.push({ section: 'suggestions', reason: 'suggestion_duplicates_rendered_cv', text: String(text).slice(0, 80) });
    }
  }

  return { counts, contradictions, pass: contradictions.length === 0 };
}
