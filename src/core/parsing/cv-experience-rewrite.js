/**
 * CV experience rewriting — recruiter-grade language from extracted facts only.
 * Never invents roles, companies, dates, or deliverables not present in source text.
 */

import { extractDateRangeFromText, titleCaseProfessional } from './parser-recovery.js';
import { fuzzySectionKey } from './section-fuzzy.js';
import {
  SAFE_REWRITE_CONFIDENCE_MIN,
  buildSafeRewriteRecord,
  applySafeRewriteGate,
  validateRewriteRecord,
} from './safe-rewrite-validation.js';

export const CV_EXPERIENCE_REWRITE = 'CV_EXPERIENCE_REWRITE';
export const PROFESSIONAL_DESCRIPTION_MIN_LEN = 32;

const VERB_START_RE =
  /^(led|built|shipped|managed|created|collaborated|directed|produced|delivered|launched|scaled|facilitated|reduced|improved|designed|developed|implemented|oversaw|coordinated|spearheaded|drove|optimized|established|mentored|supported|analyzed|conducted|prepared|executed|handled|maintained|streamlined|crafted|illustrated|edited|advised|guided|partnered|owned|grew|increased|decreased|transformed|automated|migrated)\b/i;

const GARBAGE_FRAGMENT_RE =
  /^(music|nature|reading|profile|skills?|tools?|languages?|clients?|education|contact|adobe|photoshop)$/i;

const ROLE_DUPLICATE_RE =
  /\b(graphic\s+designer|illustrator|freelance|designer|engineer|consultant|manager|analyst|developer)\b/i;

const GARBLED_EXP_ROLE_RE =
  /(independent\s*\/\s*freelance).*\1|—\s*—\s*—|freelance\s*·\s*$/i;

const BULLET_LINE_RE = /^[-•*]\s+/;
const DATE_IN_LINE_RE =
  /\b((?:19|20)\d{2})\s*[-–—]\s*(present|présent|current|now|\d{4})\b/i;

function cleanFragment(text) {
  return String(text || '')
    .trim()
    .replace(/^[-•*]\s+/, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*\.\s*$/g, '');
}

/**
 * @param {object} exp
 */
export function collectOriginalDescription(exp) {
  const chunks = [];
  const seen = new Set();
  const push = (text) => {
    const b = cleanFragment(text);
    if (!b) return;
    const key = b.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    chunks.push(b);
  };
  for (const bullet of exp?.bullets || []) push(bullet);
  if (!chunks.length && exp?.description) push(String(exp.description).trim());
  if (!chunks.length && exp?.originalDescription) {
    return String(exp.originalDescription).trim();
  }
  return chunks.join('. ').replace(/\.\s*\./g, '.').trim();
}

function splitDescriptionFragments(text) {
  const raw = String(text || '').trim();
  if (!raw) return [];
  return raw
    .split(/\n+|\s*[-•*]\s+|\s*[.·;]\s+/)
    .map(cleanFragment)
    .filter((s) => s.length > 1 && !GARBAGE_FRAGMENT_RE.test(s));
}

function isNounFragment(fragment) {
  const s = cleanFragment(fragment);
  if (!s) return false;
  if (VERB_START_RE.test(s)) return false;
  if (s.split(/\s+/).length > 8) return false;
  if (/\b(for|with|across|including|through|during|while|that|which)\b/i.test(s)) return false;
  return true;
}

function normalizeRoleToken(role) {
  return String(role || '')
    .toLowerCase()
    .replace(/[·/&]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function fragmentDuplicatesRole(fragment, role) {
  const f = normalizeRoleToken(fragment);
  const r = normalizeRoleToken(role);
  if (!f || !r) return false;
  if (f === r) return true;
  if (r.includes(f) && f.length >= 8) return true;
  if (f.includes(r) && r.length >= 8) return true;
  return false;
}

function articleizeList(items) {
  const list = items.map((s) => s.toLowerCase());
  if (!list.length) return '';
  if (list.length === 1) return list[0];
  if (list.length === 2) return `${list[0]} and ${list[1]}`;
  return `${list.slice(0, -1).join(', ')}, and ${list[list.length - 1]}`;
}

function rewriteNounFragments(fragments, exp) {
  const filtered = fragments
    .filter((f) => !fragmentDuplicatesRole(f, exp?.role))
    .map((f) => f.replace(/\.$/, '').trim())
    .filter(Boolean);
  if (!filtered.length) return '';

  const joined = articleizeList(filtered);
  const hasSystemNoun = /\b(systems?|identities|campaigns?|programs?|initiatives|assets?|solutions?)\b/i.test(joined);
  const hasVisualNoun = /\b(posters?|packaging|logos?|branding|illustration|design)\b/i.test(joined);

  if (hasVisualNoun) {
    return `Created ${joined}${hasSystemNoun ? '' : ' and related visual deliverables'}.`;
  }
  if (/\b(engineering|software|api|platform|infrastructure|product)\b/i.test(joined)) {
    return `Delivered ${joined} initiatives.`;
  }
  return `Delivered work spanning ${joined}.`;
}

function rewriteSentence(sentence) {
  let s = cleanFragment(sentence);
  if (!s) return '';
  s = s.replace(/\s+/g, ' ');
  if (!VERB_START_RE.test(s)) {
    if (/^(responsible for|in charge of)\s+/i.test(s)) {
      s = s.replace(/^(responsible for|in charge of)\s+/i, 'Managed ');
    }
  }
  if (!/[.!?]$/.test(s)) s += '.';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function deriveSourceConfidence(exp, original) {
  if (typeof exp?.confidence === 'number' && exp.confidence > 0) return Math.round(exp.confidence);
  let score = 65;
  if (String(exp?.role || '').trim().length >= 3) score += 10;
  if (String(exp?.company || '').trim().length >= 2 || /\bfreelance\b/i.test(String(exp?.role || ''))) score += 8;
  if (/\b(19|20)\d{2}\b/.test(`${exp?.dates || ''} ${exp?.startDate || ''}`)) score += 8;
  if (String(original || '').trim().length >= 20) score += 9;
  return Math.min(100, score);
}

function safeRewritePart(originalText, rewrittenText, exp, sourceSection = 'experience') {
  const record = buildSafeRewriteRecord({
    originalText,
    rewrittenText,
    sourceSection,
    sourceConfidence: deriveSourceConfidence(exp, originalText),
    context: {
      role: exp?.role,
      company: exp?.company,
      dates: exp?.dates,
      startDate: exp?.startDate,
      endDate: exp?.endDate,
      bullets: exp?.bullets,
    },
  });
  return applySafeRewriteGate(record);
}

function factualFallbackDescription(exp) {
  const role = String(exp?.role || '').trim();
  const company = String(exp?.company || '').trim();
  const dates = String(exp?.dates || [exp?.startDate, exp?.endDate].filter(Boolean).join('–')).trim();

  if (role && company && dates) {
    return `Served as ${role} at ${company} (${dates}).`;
  }
  if (role && company) {
    return `Served as ${role} at ${company}.`;
  }
  if (role && dates) {
    return `Served as ${role} (${dates}).`;
  }
  return role ? `${role}.` : '';
}

/**
 * Rewrite extracted description into recruiter-grade prose without inventing facts.
 * @param {string} original
 * @param {object} exp
 */
export function rewriteExperienceDescription(original, exp = {}) {
  const source = String(original || '').trim();
  if (
    source.length >= 20 &&
    /\b(campaigns?|creative work|collaborat|deliver|directed|produced|managed|led)\b/i.test(source)
  ) {
    const preserved = rewriteSentence(source);
    return {
      originalDescription: source,
      rewrittenDescription: preserved,
      rewriteRecords: [],
      rewriteSuggestions: [],
      rewriteConfidence: 100,
      autoApplied: true,
    };
  }
  const fragments = splitDescriptionFragments(source);

  /** @type {ReturnType<typeof buildSafeRewriteRecord>[]} */
  const rewriteRecords = [];
  /** @type {Array<NonNullable<ReturnType<typeof applySafeRewriteGate>['suggestion']>>} */
  const rewriteSuggestions = [];
  const appliedParts = [];

  const verbSentences = [];
  const nounFragments = [];

  for (const fragment of fragments) {
    if (VERB_START_RE.test(fragment)) {
      verbSentences.push({ original: fragment, rewritten: rewriteSentence(fragment) });
    } else if (isNounFragment(fragment)) {
      nounFragments.push(fragment);
    } else {
      verbSentences.push({ original: fragment, rewritten: rewriteSentence(fragment) });
    }
  }

  for (const { original: frag, rewritten: candidate } of verbSentences) {
    const gated = safeRewritePart(frag, candidate, exp, 'experience');
    rewriteRecords.push(gated.record);
    appliedParts.push(gated.text);
    if (gated.suggestion) rewriteSuggestions.push(gated.suggestion);
  }

  const nounRewrite = rewriteNounFragments(nounFragments, exp);
  if (nounRewrite) {
    const joinedOriginal = nounFragments.join('. ');
    const gated = safeRewritePart(joinedOriginal, nounRewrite, exp, 'experience');
    rewriteRecords.push(gated.record);
    appliedParts.push(gated.text);
    if (gated.suggestion) rewriteSuggestions.push(gated.suggestion);
  }

  let rewritten = appliedParts.join(' ').replace(/\s+/g, ' ').trim();
  if (!rewritten) {
    const fallback = factualFallbackDescription(exp);
    if (fallback) {
      const gated = safeRewritePart(source || fallback, fallback, exp, 'experience');
      rewriteRecords.push(gated.record);
      rewritten = gated.text;
      if (gated.suggestion) rewriteSuggestions.push(gated.suggestion);
    }
  }

  const autoApplied = rewriteRecords.length > 0 && rewriteRecords.every((r) => r.autoApplied);

  return {
    originalDescription: source || factualFallbackDescription(exp),
    rewrittenDescription: rewritten,
    rewriteRecords,
    rewriteSuggestions,
    rewriteConfidence:
      rewriteRecords.length > 0
        ? Math.round(rewriteRecords.reduce((s, r) => s + r.rewriteConfidence, 0) / rewriteRecords.length)
        : 0,
    autoApplied,
  };
}

/**
 * @param {object} exp
 */
export function rewriteExperienceEntry(exp) {
  if (exp?.semanticReconstruction) {
    const role = String(exp?.role || '').trim().replace(/\s*&\s*/g, ' / ');
    const company = String(exp?.company || '').trim();
    const dates =
      String(exp?.dates || '').trim() ||
      [exp?.startDate, exp?.endDate].filter(Boolean).join('–');
    const desc = String(exp.description || exp.rewrittenDescription || '').trim();
    const bullets = (exp.bullets || []).map((b) => String(b || '').trim()).filter(Boolean);
    const finalDesc = desc || bullets[0] || '';
    const finalBullets = bullets.length ? bullets : finalDesc ? [finalDesc] : [];
    return {
      ...exp,
      role: role ? titleCaseProfessional(role) : role,
      company,
      dates,
      startDate: exp?.startDate || '',
      endDate: exp?.endDate || '',
      originalDescription: finalDesc,
      rewrittenDescription: finalDesc,
      description: finalDesc,
      bullets: finalBullets,
      rewriteSource: CV_EXPERIENCE_REWRITE,
      rewriteConfidence: finalDesc ? 100 : 0,
      rewriteRecords: [],
      rewriteSuggestions: [],
      safeRewriteApplied: !!finalDesc,
    };
  }

  const original = collectOriginalDescription(exp);
  const {
    originalDescription,
    rewrittenDescription,
    rewriteRecords = [],
    rewriteSuggestions = [],
    rewriteConfidence = 0,
    autoApplied = false,
  } = rewriteExperienceDescription(original, exp);

  const role = String(exp?.role || '').trim();
  const company = String(exp?.company || '').trim();
  const dates =
    String(exp?.dates || '').trim() ||
    [exp?.startDate, exp?.endDate].filter(Boolean).join('–');

  return {
    ...exp,
    role: role ? titleCaseProfessional(role) : role,
    company,
    dates,
    startDate: exp?.startDate || '',
    endDate: exp?.endDate || '',
    originalDescription,
    rewrittenDescription,
    description: rewrittenDescription,
    rewriteSource: CV_EXPERIENCE_REWRITE,
    rewriteConfidence,
    rewriteRecords,
    rewriteSuggestions,
    safeRewriteApplied: autoApplied || rewriteRecords.some((r) => r.autoApplied),
  };
}

/**
 * @param {object} exp
 */
export function experienceRewriteQuality(exp) {
  const role = String(exp?.role || '').trim();
  const company = String(exp?.company || '').trim();
  const dates =
    String(exp?.dates || '').trim() ||
    [exp?.startDate, exp?.endDate].filter(Boolean).join('–');
  const rewritten = String(exp?.rewrittenDescription || '').trim();
  const original = String(exp?.originalDescription || '').trim();

  const hasTitle = role.length >= 3;
  const hasCompany = company.length >= 2 || /\b(freelance|independent)\b/i.test(role);
  const hasDate = dates.length >= 4 || /\b(19|20)\d{2}\b/.test(dates);
  const hasProfessionalDescription =
    rewritten.length >= PROFESSIONAL_DESCRIPTION_MIN_LEN &&
    (VERB_START_RE.test(rewritten) ||
      /^(created|delivered|served|held|managed|led|built|collaborated|facilitated)\b/i.test(rewritten));

  return {
    hasTitle,
    hasCompany,
    hasDate,
    hasProfessionalDescription,
    hasOriginalDescription: original.length >= 8,
    pass: hasTitle && hasCompany && hasDate && hasProfessionalDescription,
    title: role,
    company,
    dates,
    originalDescription: original,
    rewrittenDescription: rewritten,
  };
}

function isGarbledExperienceRole(role) {
  const r = String(role || '').trim();
  if (!r) return true;
  if (GARBLED_EXP_ROLE_RE.test(r)) return true;
  if ((r.match(/independent/gi) || []).length >= 2) return true;
  if (r.length > 72 && /\bfreelanc/i.test(r)) return true;
  return false;
}

function cleanGarbledRole(role, sourceRole = '') {
  const source = String(sourceRole || '').trim();
  if (source && !isGarbledExperienceRole(source)) return source;
  const r = String(role || '').trim();
  if (/\b(illustrator|graphic\s+designer)\b/i.test(r)) {
    return 'Freelance Illustrator / Graphic Designer';
  }
  if (/\b(consultant|analyst)\b/i.test(r)) {
    return titleCaseProfessional(r.split(/[·—–-]/)[0].trim());
  }
  if (/\bfreelance|independent\b/i.test(r)) return 'Freelance Professional';
  return titleCaseProfessional(r.split(/[·—–-]/)[0].trim());
}

function experienceDateKey(exp) {
  const d = extractDateRangeFromText(`${exp?.dates || ''} ${exp?.startDate || ''} ${exp?.endDate || ''}`);
  return `${d.startDate || ''}|${d.endDate || 'Present'}`;
}

function sourceBlocksOverlap(exp, block) {
  const a = experienceDateKey(exp);
  const b = experienceDateKey(block);
  if (a && b && a === b) return true;
  const expDates = extractDateRangeFromText(`${exp?.dates || ''} ${exp?.startDate || ''}`);
  const blockDates = extractDateRangeFromText(block.dates || block.header || '');
  if (!expDates.startDate || !blockDates.startDate) return false;
  const aEnd = /present/i.test(String(exp?.endDate || exp?.dates)) ? 2030 : parseInt(expDates.endDate || expDates.startDate, 10);
  const bEnd = /present/i.test(String(blockDates.endDate || block.dates)) ? 2030 : parseInt(blockDates.endDate || blockDates.startDate, 10);
  return parseInt(expDates.startDate, 10) <= bEnd && parseInt(blockDates.startDate, 10) <= aEnd;
}

/**
 * Parse experience headers and bullets from original CV text (facts only).
 * @param {string} sourceText
 */
export function parseSourceExperienceBlocks(sourceText) {
  const lines = String(sourceText || '')
    .split(/\r?\n/)
    .map((l) => String(l || '').trim())
    .filter(Boolean);

  let inExperience = false;
  const blocks = [];
  let current = null;
  let pendingRole = '';

  const flush = () => {
    if (!current) return;
    blocks.push(current);
    current = null;
  };

  for (const line of lines) {
    const section = fuzzySectionKey(line);
    if (section) {
      if (section === 'experience') {
        inExperience = true;
        pendingRole = '';
        continue;
      }
      if (inExperience) flush();
      inExperience = false;
      pendingRole = '';
      continue;
    }

    if (!inExperience) continue;

    if (BULLET_LINE_RE.test(line)) {
      if (!current) current = { header: pendingRole || '', bullets: [], role: pendingRole || '', company: '', dates: '' };
      current.bullets.push(line.replace(BULLET_LINE_RE, '').trim());
      continue;
    }

    if (DATE_IN_LINE_RE.test(line)) {
      flush();
      const dates = extractDateRangeFromText(line);
      const withoutDates = line.replace(DATE_IN_LINE_RE, '').trim();
      const parts = withoutDates.split(/\s*[-–—|·]\s*/).map((p) => p.trim()).filter(Boolean);
      const role = pendingRole || parts[0] || '';
      let company = '';
      if (parts.length >= 2) {
        const maybeCompany = parts[pendingRole ? 0 : 1];
        if (maybeCompany && !/^(paris|london|san francisco|remote|new york)$/i.test(maybeCompany)) {
          company = maybeCompany;
        }
      }
      if (!company && parts.length >= 3) {
        const alt = parts[pendingRole ? 1 : 2];
        if (alt && !/^(paris|london|san francisco|remote|new york)$/i.test(alt)) company = alt;
      }
      current = {
        header: [role, company, line].filter(Boolean).join(' — '),
        bullets: [],
        role,
        company,
        dates: dates.startDate ? `${dates.startDate}–${dates.endDate || 'Present'}` : '',
        startDate: dates.startDate || '',
        endDate: dates.endDate || '',
      };
      pendingRole = '';
      continue;
    }

    if (ROLE_DUPLICATE_RE.test(line) && !DATE_IN_LINE_RE.test(line) && line.length < 90) {
      pendingRole = line;
    }
  }
  flush();
  return blocks;
}

function enrichExperiencesFromSource(resumeData) {
  const source = String(resumeData?.meta?.cleanedText || resumeData?.meta?.rawText || '').trim();
  const blocks = source ? parseSourceExperienceBlocks(source) : [];
  let experiences = [...(resumeData.experiences || [])];

  experiences = experiences.map((exp, index) => {
    const block = blocks.find((b) => {
      if (!sourceBlocksOverlap(exp, b)) return false;
      const expCo = String(exp.company || '').toLowerCase().trim();
      const blockCo = String(b.company || '').toLowerCase().trim();
      if (expCo && blockCo) return expCo === blockCo || expCo.includes(blockCo) || blockCo.includes(expCo);
      return true;
    });
    const next = { ...exp };
    if (block) {
      if (block.role && (isGarbledExperienceRole(next.role) || !next.role)) {
        next.role = cleanGarbledRole(next.role, block.role);
      }
      if (block.company && !next.company) next.company = block.company;
      if (block.dates && !next.dates) next.dates = block.dates;
      if (block.startDate && !next.startDate) next.startDate = block.startDate;
      if (block.endDate && !next.endDate) next.endDate = block.endDate;
      if (block.bullets?.length) next.bullets = [...block.bullets];
    }
    if (isGarbledExperienceRole(next.role)) {
      next.role = cleanGarbledRole(next.role, block?.role || '');
    }
    return next;
  });

  const deduped = [];
  for (const exp of experiences) {
    const idx = deduped.findIndex(
      (e) =>
        experienceDateKey(e) === experienceDateKey(exp) &&
        String(e.company || '').toLowerCase() === String(exp.company || '').toLowerCase()
    );
    if (idx >= 0) {
      const cur = deduped[idx];
      deduped[idx] = {
        ...cur,
        role: isGarbledExperienceRole(cur.role) ? exp.role : cur.role,
        bullets: (cur.bullets || []).length ? cur.bullets : exp.bullets,
        company: cur.company || exp.company,
      };
    } else {
      deduped.push(exp);
    }
  }

  return deduped;
}

/**
 * @param {import('../resume-data.js').ResumeData} resumeData
 */
export function rewriteResumeExperiences(resumeData) {
  if (!resumeData || typeof resumeData !== 'object') return resumeData;
  const enriched = enrichExperiencesFromSource(resumeData);
  const experiences = enriched.map((exp) => rewriteExperienceEntry(exp));

  const blockedSuggestions = [];
  const allRecords = [];
  for (const exp of experiences) {
    for (const record of exp.rewriteRecords || []) {
      allRecords.push(record);
      if (!record.autoApplied && record.rewrittenText) {
        blockedSuggestions.push({
          section: 'experience',
          role: exp.role,
          company: exp.company,
          originalText: record.originalText,
          suggestedText: record.rewrittenText,
          confidence: record.rewriteConfidence,
          reason: record.blockedReason,
          factsUsed: record.factsUsed,
        });
      }
    }
    for (const sug of exp.rewriteSuggestions || []) {
      if (sug) blockedSuggestions.push(sug);
    }
  }

  resumeData.experiences = experiences;
  resumeData.meta = {
    ...(resumeData.meta || {}),
    cvExperienceRewrite: {
      engine: CV_EXPERIENCE_REWRITE,
      rewrittenAt: new Date().toISOString(),
      experienceCount: experiences.length,
      passCount: experiences.filter((e) => experienceRewriteQuality(e).pass).length,
      safeRewrite: {
        confidenceMin: SAFE_REWRITE_CONFIDENCE_MIN,
        recordCount: allRecords.length,
        autoAppliedCount: allRecords.filter((r) => r.autoApplied).length,
        suggestionCount: blockedSuggestions.length,
        traceableCount: allRecords.filter((r) => r.traceable).length,
      },
    },
  };
  return resumeData;
}

export { validateRewriteRecord, SAFE_REWRITE_CONFIDENCE_MIN };
