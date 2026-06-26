/**
 * Dedupe suggestions — remove OCR lines already consumed by resumeData sections.
 */

import { normalizeLineKey } from '../extraction/extracted-line.js';
import { extractDateRangeFromText } from './parser-recovery.js';
import {
  parseFreelanceCareerLine,
  parseInternshipLine,
  parseEducationLineWithContact,
  isStrictSoftwareLine,
  isCreativeSkillPhrase,
  isClientListLine,
} from './classification-fixes.js';

/**
 * @typedef {{ id: string, text: string, normalized: string, index: number }} SourceLineEntry
 */

/**
 * @param {string} text
 * @returns {SourceLineEntry[]}
 */
export function buildSourceLineRegistry(text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 1);
  const entries = [];
  const byNorm = new Map();
  lines.forEach((lineText, index) => {
    const id = `src-${index}`;
    const normalized = normalizeLineKey(lineText);
    const entry = { id, text: lineText, normalized, index };
    entries.push(entry);
    if (normalized && !byNorm.has(normalized)) byNorm.set(normalized, id);
  });
  return { entries, byNorm };
}

/**
 * @param {string} text
 * @param {{ entries: SourceLineEntry[], byNorm: Map<string,string> }} registry
 * @returns {string|null}
 */
export function resolveSourceLineId(text, registry) {
  const norm = normalizeLineKey(text);
  if (!norm) return null;
  if (registry.byNorm.has(norm)) return registry.byNorm.get(norm);
  for (const entry of registry.entries) {
    if (entry.normalized.length < 8) continue;
    if (norm.includes(entry.normalized) || entry.normalized.includes(norm)) return entry.id;
  }
  return null;
}

function normIncludes(a, b) {
  const x = normalizeLineKey(a);
  const y = normalizeLineKey(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const short = x.length <= y.length ? x : y;
  const long = x.length > y.length ? x : y;
  return short.length >= 8 && long.includes(short);
}

/**
 * @param {string} line
 * @param {import('../resume-data.js').ResumeData} rd
 */
export function lineIsConsumedByResumeData(line, rd) {
  const l = String(line || '').trim();
  if (!l || l.length < 3) return false;

  for (const exp of rd.experiences || []) {
    for (const sl of exp.sourceLines || []) {
      if (normIncludes(l, sl)) return true;
    }
    if (exp.sourceLineId && normIncludes(l, exp.sourceText || '')) return true;

    const freelance = parseFreelanceCareerLine(l);
    if (freelance?.startDate && freelance.startDate === String(exp.startDate || '').trim()) {
      if (/illustrator|graphic|designer|freelanc/i.test(l) || /illustrator|graphic|designer|freelanc/i.test(exp.role || '')) {
        return true;
      }
    }

    const dates = extractDateRangeFromText(l);
    if (dates.startDate && dates.startDate === String(exp.startDate || '').trim()) {
      if (/illustrator|graphic|designer|freelanc|mccann|internship|agency/i.test(l)) return true;
    }

    const head = [exp.role, exp.company, exp.dates, ...(exp.bullets || [])].filter(Boolean).join(' ');
    if (head.length >= 12 && normIncludes(l, head)) return true;
  }

  const internship = parseInternshipLine(l);
  if (internship && (rd.experiences || []).some((exp) => normIncludes(exp.company || '', internship.company || ''))) {
    return true;
  }

  const eduParsed = parseEducationLineWithContact(l);
  if (eduParsed?.education) {
    for (const edu of rd.education || []) {
      if (normIncludes(edu, eduParsed.education) || normIncludes(eduParsed.education, edu)) return true;
    }
  }
  for (const edu of rd.education || []) {
    if (normIncludes(l, edu)) return true;
    if (/\b(lisaa|créapole|creapole|school|university)\b/i.test(l) && /\b(lisaa|créapole|creapole|school|university)\b/i.test(edu)) {
      const ld = extractDateRangeFromText(l);
      const ed = extractDateRangeFromText(edu);
      if (ld.startDate && ed.startDate && ld.startDate === ed.startDate) return true;
    }
  }

  for (const skill of rd.skills || []) {
    if (normIncludes(l, skill)) return true;
    if (isCreativeSkillPhrase(l) && l.toLowerCase().includes(String(skill).toLowerCase())) return true;
  }

  for (const tool of rd.tools || []) {
    if (normIncludes(l, tool)) return true;
    if (isStrictSoftwareLine(l) && l.toLowerCase().includes(String(tool).toLowerCase())) return true;
  }

  for (const lang of rd.languages || []) {
    if (normIncludes(l, lang)) return true;
  }

  for (const client of rd.clients || []) {
    if (normIncludes(l, client)) return true;
    if (isClientListLine(l) && l.toLowerCase().includes(String(client).toLowerCase())) return true;
  }

  return false;
}

/**
 * @param {import('../resume-data.js').ResumeData} rd
 * @param {{ entries: SourceLineEntry[] }} registry
 * @returns {Set<string>}
 */
export function collectConsumedSourceLineIds(rd, registry) {
  const consumed = new Set();
  for (const entry of registry.entries) {
    if (lineIsConsumedByResumeData(entry.text, rd)) consumed.add(entry.id);
  }
  return consumed;
}

function tagExperiencesWithSourceLines(rd, registry) {
  for (const exp of rd.experiences || []) {
    if (exp.sourceLineId && (exp.sourceLines || []).length) continue;
    for (const entry of registry.entries) {
      if (!lineIsConsumedByResumeData(entry.text, rd)) continue;
      const freelance = parseFreelanceCareerLine(entry.text);
      const internship = parseInternshipLine(entry.text);
      const matches =
        (freelance && freelance.startDate === String(exp.startDate || '').trim()) ||
        (internship && normIncludes(exp.company || '', internship.company || '')) ||
        (extractDateRangeFromText(entry.text).startDate === String(exp.startDate || '').trim() &&
          /illustrator|graphic|designer|freelanc|mccann/i.test(entry.text));
      if (matches) {
        exp.sourceLineId = entry.id;
        exp.sourceLines = [...new Set([...(exp.sourceLines || []), entry.text])];
        break;
      }
    }
  }
}

/**
 * @param {import('../resume-data.js').ResumeData} rd
 * @param {Set<string>} consumedIds
 * @param {{ entries: SourceLineEntry[], byNorm: Map<string,string> }} registry
 */
export function pruneUnsortedByConsumedIds(rd, consumedIds, registry) {
  const kept = [];
  for (const item of rd.unsorted || []) {
    const text = typeof item === 'string' ? item : String(item?.text || item || '').trim();
    if (!text) continue;
    const id = resolveSourceLineId(text, registry);
    if (id && consumedIds.has(id)) continue;
    if (lineIsConsumedByResumeData(text, rd)) continue;
    kept.push(text);
  }
  rd.unsorted = kept;
  return rd;
}

/**
 * @param {object[]} reviewQueue
 * @param {import('../resume-data.js').ResumeData} rd
 * @param {Set<string>} consumedIds
 * @param {{ entries: SourceLineEntry[], byNorm: Map<string,string> }} registry
 */
export function filterReviewQueueConsumed(reviewQueue, rd, consumedIds, registry) {
  return (reviewQueue || []).filter((item) => {
    const chunks = [
      item?.sourceText,
      item?.detected,
      ...(item?.sourceLines || []),
    ]
      .map((x) => String(x || '').trim())
      .filter(Boolean);
    for (const text of chunks) {
      const id = resolveSourceLineId(text, registry);
      if (id && consumedIds.has(id)) return false;
      if (lineIsConsumedByResumeData(text, rd)) return false;
    }
    return true;
  });
}

/**
 * @param {import('../resume-data.js').ResumeData} resumeData
 * @param {{ rawText?: string, cleanedText?: string, reviewQueue?: object[] }} [opts]
 */
export function dedupeSuggestionsAgainstResumeData(resumeData, opts = {}) {
  const rd = { ...resumeData };
  const source = String(opts.cleanedText || opts.rawText || '').trim();
  const registry = buildSourceLineRegistry(source);
  if (!registry.entries.length) {
    return { resumeData: rd, reviewQueue: opts.reviewQueue || [], consumedSourceLineIds: [] };
  }

  tagExperiencesWithSourceLines(rd, registry);
  const consumedIds = collectConsumedSourceLineIds(rd, registry);
  pruneUnsortedByConsumedIds(rd, consumedIds, registry);
  const reviewQueue = filterReviewQueueConsumed(opts.reviewQueue || [], rd, consumedIds, registry);

  rd.meta = {
    ...(rd.meta || {}),
    consumedSourceLineIds: [...consumedIds],
    sourceLineCount: registry.entries.length,
  };

  return {
    resumeData: rd,
    reviewQueue,
    consumedSourceLineIds: [...consumedIds],
  };
}
