/**
 * General parser recovery heuristics — no person-specific rules.
 */

import { EDUCATION_KEYWORDS, INSTITUTION_HINT_RE } from '../../data/dictionaries/educationKeywords.js';
import {
  ROLE_KEYWORDS,
  ROLE_TITLE_RE,
  lineLooksLikeRole,
  lineIsRoleOnly,
} from '../../data/dictionaries/roleKeywords.js';
import {
  EMAIL_RE,
  PHONE_RE,
  URL_RE,
  isValidTitleField,
  lineIsClientList,
  stripContactFromProse,
} from './field-sanitize.js';
import {
  isLikelyInterest,
  isLanguageProficiencyLine,
  partitionSkillsAndInterests,
} from './line-cleaner.js';
import { repairCompactWordBoundaries } from './clean.js';
import { hasEducationSchool, mustNeverBeExperience } from './education-confidence.js';
import {
  parseStrictExperiencesFromLines,
  qualifiesStrictExperience,
  scoreStrictExperienceEntry,
  EXPERIENCE_PARSER_CONFIDENCE_MIN,
} from './experience-parser.js';
import { findLongestDictionaryTerm, SCHOOL_TERMS } from '../../data/dictionaries/json-dictionary-match.js';
import { termMatchesHay, sanitizeDictionaryTerm } from '../../data/dictionaries/match-utils.js';
import {
  isValidIdentityName,
  isValidIdentityTitle,
  IDENTITY_CONFIDENCE_MIN,
  extractLockedIdentity,
} from './identity-extraction.js';
import {
  NAME_CONFIRM_LABEL,
  EMAIL_CONFIRM_LABEL,
  PHONE_CONFIRM_LABEL,
  TITLE_CONFIRM_LABEL,
  UNDETECTED_INFORMATION_LABEL,
} from '../display/identity-labels.js';
import {
  isUncertainIdentityName,
  isUncertainIdentityTitle,
  stripUncertainToEmpty,
} from '../display/undetected-label.js';

export { partitionSkillsAndInterests };

export const NAME_UNCERTAIN_LABEL = NAME_CONFIRM_LABEL;
export const EMAIL_UNCERTAIN_LABEL = EMAIL_CONFIRM_LABEL;
export const PHONE_UNCERTAIN_LABEL = PHONE_CONFIRM_LABEL;
export const TITLE_UNCERTAIN_LABEL = TITLE_CONFIRM_LABEL;

export { isUncertainIdentityName, isUncertainIdentityTitle, stripUncertainToEmpty };
export const NAME_CANDIDATE_SEP = ' · ';

/** Display top name candidates when confidence is low (instead of generic label). */
export function formatNameCandidateDisplay(candidates) {
  const list = (candidates || []).map((c) => String(c || '').trim()).filter(Boolean).slice(0, 3);
  if (!list.length) return NAME_UNCERTAIN_LABEL;
  return list.join(NAME_CANDIDATE_SEP);
}

function nameConfidenceScore(topPerson, uncertain) {
  if (!topPerson) return 0;
  if (uncertain) return Math.min(72, 28 + topPerson.score * 8);
  return Math.min(98, 68 + topPerson.score * 5);
}

const SECTION_HEADER_REJECT =
  /^(profile|summary|about|experience|work experience|education|formation|formations?|skills|competences|compétences|competences cles|outils|tools|languages|langues|projects|clients|interests|contact|references|cv|resume|curriculum)\b/i;

const TITLE_REJECT_RE =
  /^(a\s+mail|mail\s*:|e\s*mail\s*:|contact\s*info|coordonnées|profile\s*summary|visual\s+communication)\s*$/i;

const NAME_FRAGMENT_REJECT =
  /^(a\s+mail|visual\s+communication|work\s+experience|professional\s+experience|profile|summary|education|skills)$/i;

const LOCATION_HINT =
  /\b(Paris|London|New York|San Francisco|Berlin|Amsterdam|Brussels|Remote|Lyon|Marseille|Chicago|Boston|Seattle|Austin|Toronto|Singapore|Hong Kong)\b/i;

export function isInterestItem(text) {
  return isLikelyInterest(text);
}

const SKILL_FRAGMENT_TITLE_RE =
  /\b(print|logo|vector|illustration|reading|typography|branding|packaging|photoshop|illustrator|indesign|figma|sketch|artwork|icon|layout)\b/i;

function isBadIdentityName(text) {
  return !isValidIdentityName(text);
}

export function isBadTitleCandidate(text) {
  const s = String(text || '').trim();
  if (!s || s.length < 3) return true;
  if (SKILL_FRAGMENT_TITLE_RE.test(s) && !lineLooksLikeRole(s)) return true;
  if (TITLE_REJECT_RE.test(s)) return true;
  if (NAME_FRAGMENT_REJECT.test(s)) return true;
  if (SECTION_HEADER_REJECT.test(s)) return true;
  if (EMAIL_RE.test(s)) return true;
  if (/@[a-z0-9.-]+\.[a-z]{2,}/i.test(s)) return true;
  if (PHONE_RE.test(s)) return true;
  if (URL_RE.test(s)) return true;
  if (/^a\s+mail\b/i.test(s)) return true;
  if (/\bmail\s*:\s*visual\b/i.test(s)) return true;
  if (/^visual\s+communication$/i.test(s) && !lineLooksLikeRole(s)) return true;
  if (lineIsClientList(s) && !lineLooksLikeRole(s)) return true;
  return false;
}

export function titleCaseProfessional(s) {
  return String(s || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\b[\p{L}'-]+/gu, (w) => {
      if (w.length <= 2 && !/^[A-Z]{2,}$/.test(w)) return w.toLowerCase();
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    });
}

function scoreNameLine(line, helpers) {
  const {
    isBadName = () => false,
    nameLooksLikeBrandList = () => false,
    isSectionHeaderLine = () => false,
  } = helpers;

  const l = String(line || '').trim();
  if (!l || l.length < 4 || l.length > 56) return -10;
  if (EMAIL_RE.test(l) || PHONE_RE.test(l) || URL_RE.test(l)) return -10;
  if (/linkedin|github|portfolio|behance|dribbble/i.test(l)) return -10;
  if (isSectionHeaderLine(l) || SECTION_HEADER_REJECT.test(l)) return -10;
  if (NAME_FRAGMENT_REJECT.test(l) || isBadIdentityName(l)) return -10;
  if (lineIsRoleOnly(l)) return -10;
  if (LOCATION_HINT.test(l)) return -10;
  if (lineIsClientList(l) || nameLooksLikeBrandList(l)) return -8;

  const cleaned = l.replace(/[^A-Za-zÀ-ÿ' -]/g, ' ').replace(/\s+/g, ' ').trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 5) return -4;

  let score = 2;
  const titleCaseCount = words.filter(
    (w) => /^[A-ZÀ-Ö][a-zà-ö'-]+$/.test(w) || /^[A-ZÀ-Ö]{2,}$/.test(w)
  ).length;
  if (titleCaseCount === words.length) score += 4;
  if (words.length >= 2 && words.length <= 3) score += 2;
  const letters = (cleaned.match(/[A-Za-zÀ-ÿ]/g) || []).length;
  if (letters / cleaned.length < 0.7) score -= 4;
  if (isBadName(cleaned)) score -= 6;
  return score;
}

/**
 * Score top lines for name likelihood.
 * @returns {{ best: string, candidates: string[], uncertain: boolean }}
 */
export function detectNameCandidates(lines, helpers = {}) {
  if (helpers.skipFlatRepair || helpers.spatialParseInput) {
    return {
      best: '',
      candidates: [],
      uncertain: true,
      confidence: 0,
      resolvedName: '',
      selectedName: '',
      displayName: '',
      source: null,
      sourceLine: '',
    };
  }
  const locked = extractLockedIdentity(lines, {
    headerLines: helpers.headerLines || lines.slice(0, 12),
    experiences: helpers.experiences || [],
  });

  const resolved = locked.name && isValidIdentityName(locked.name) ? locked.name : '';
  const confidence = resolved ? locked.nameConfidence : 0;
  const source = locked.nameSource;

  return {
    best: resolved,
    candidates: locked.nameCandidates || [],
    uncertain: !resolved || confidence < IDENTITY_CONFIDENCE_MIN,
    confidence,
    resolvedName: resolved,
    selectedName: resolved,
    displayName: resolved || NAME_UNCERTAIN_LABEL,
    source,
    sourceLine: source?.line || '',
  };
}

/**
 * Score professional title lines near the candidate name.
 */
export function detectTitleCandidates(lines, name = '', contact = {}, helpers = {}) {
  const { lineLooksLikeTitle = () => false, headerLines = [] } = helpers;
  const headerSet = new Set((headerLines || []).map((l) => String(l).trim().toLowerCase()));
  const contextName =
    name && name !== NAME_UNCERTAIN_LABEL && !name.includes(NAME_CANDIDATE_SEP)
      ? name
      : String(name || '').split(NAME_CANDIDATE_SEP)[0]?.trim() || '';

  const nameIdx = contextName
    ? lines.findIndex(
        (l) =>
          l.trim() === contextName ||
          l.includes(contextName) ||
          contextName.includes(l.trim())
      )
    : -1;
  const pool = [];
  const poolSeen = new Set();
  const addPool = (raw) => {
    const key = String(raw || '').trim().toLowerCase();
    if (!key || poolSeen.has(key)) return;
    poolSeen.add(key);
    pool.push(String(raw || '').trim());
  };
  if (nameIdx >= 0) lines.slice(nameIdx, nameIdx + 5).forEach(addPool);
  else lines.slice(0, 20).forEach(addPool);
  (headerLines || []).forEach(addPool);

  const scored = [];

  for (const raw of pool) {
    const l = String(raw || '').trim();
    if (!l || l === contextName) continue;
    if (contextName && l.includes(contextName)) continue;
    if (contact.email && l.includes(contact.email)) continue;
    if (contact.phone && l.includes(contact.phone)) continue;
    if (isBadTitleCandidate(l)) continue;
    if (!isValidIdentityTitle(l) && !lineLooksLikeRole(l)) continue;

    let score = 0;
    if (lineLooksLikeRole(l)) score += 8;
    if (lineLooksLikeTitle(l)) score += 3;
    if (!lineLooksLikeRole(l)) continue;
    if (headerSet.has(l.toLowerCase())) score += 3;
    if (score < 4) continue;

    const title = titleCaseProfessional(l.replace(/^[\W\d]+/, '').replace(/\s+/g, ' ').trim());
    if (!isValidIdentityTitle(title)) continue;
    scored.push({ title, score, line: l, lineIndex: lines.indexOf(raw) });
  }

  scored.sort((a, b) => b.score - a.score);
  const candidates = [...new Set(scored.map((s) => s.title))].slice(0, 3);
  const best = candidates[0] || '';
  const top = scored[0];
  const second = scored[1];
  const uncertain = !top || (second && top.score - second.score < 2);
  let confidence = top && isValidIdentityTitle(best) ? Math.min(96, 58 + top.score * 6) : 0;
  if (confidence < IDENTITY_CONFIDENCE_MIN) {
    confidence = 0;
  }
  const resolvedTitle = confidence >= IDENTITY_CONFIDENCE_MIN ? best : '';
  const source = top && resolvedTitle
    ? { lineIndex: top.lineIndex, line: top.line, reason: 'title_candidate' }
    : null;

  return {
    best: resolvedTitle,
    candidates: resolvedTitle ? candidates.filter((c) => isValidIdentityTitle(c)) : [],
    uncertain: uncertain || !resolvedTitle,
    confidence,
    selectedTitle: resolvedTitle,
    source,
    sourceLine: source?.line || '',
    sourceLines: source ? [source.line] : [],
  };
}

export function detectNameFromLines(lines, helpers = {}) {
  const r = detectNameCandidates(lines, helpers);
  return r.displayName || r.resolvedName || '';
}

/**
 * Find professional title near name using role keyword dictionary.
 */
export function detectTitleFromText(lines, name = '', contact = {}, helpers = {}) {
  const r = detectTitleCandidates(lines, name, contact, helpers);
  return r.best || '';
}

/**
 * Split merged DOCX education blobs (school + years + degree on one line).
 * @param {string} line
 * @returns {string[]}
 */
/**
 * One school → up to 3 display lines: school, years, program.
 * @param {string[]} entries
 * @returns {string[]}
 */
export function structureEducationEntries(entries) {
  const out = [];
  for (const raw of entries || []) {
    for (const chunk of splitMergedEducationLine(raw)) {
      let s = sanitizeEducationLine(chunk);
      if (!s || s.length < 3) continue;

      const rangeM = s.match(
        /\b(?:Year\s*)?((?:19|20)\d{2})\s*[-–—]\s*((?:19|20)\d{2})\b/i
      );
      let years = '';
      let school = s;
      let program = '';

      if (rangeM) {
        years = `${rangeM[1]}–${rangeM[2]}`;
        school = s.slice(0, rangeM.index).replace(/\s*[-–—]\s*$/,'').trim();
        program = s.slice(rangeM.index + rangeM[0].length).replace(/^[\s·–—-]+/,'').trim();
      } else {
        const ys = [...s.matchAll(/\b((?:19|20)\d{2})\b/g)];
        if (ys.length >= 2) {
          years = `${ys[0][1]}–${ys[1][1]}`;
          school = s.slice(0, ys[0].index).replace(/\s*[-–—]\s*$/,'').trim();
          program = s.slice(ys[1].index + ys[1][0].length).replace(/^[\s·–—-]+/,'').trim();
        }
      }

      school = school
        .replace(/\b(Multisectoral|Year)\b/gi, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
      const inst = findLongestDictionaryTerm(school, SCHOOL_TERMS);
      if (inst) school = inst.trim();
      else if (school.length > 48) {
        school = school.split(/\s+[-–—]\s+/)[0].trim();
      }

      if (school.length > 2) out.push(school);
      if (years) out.push(years);
      if (program.length > 4) out.push(program);
      else if (!years && school.length > 3) out.push(school);
    }
  }
  return [...new Set(out.map((x) => x.trim()).filter(Boolean))].slice(0, 6);
}

function schoolTermPositions(line) {
  const hay = String(line || '').trim();
  if (!hay || hay.length > 160 || hay.length < 8) return [];
  const hits = [];
  const hayLower = hay.toLowerCase();
  for (const raw of SCHOOL_TERMS) {
    const term = sanitizeDictionaryTerm(raw);
    if (!term || term.length < 4) continue;
    if (!termMatchesHay(hay, term)) continue;
    const idx = hayLower.indexOf(term.toLowerCase());
    if (idx >= 0) hits.push({ term, index: idx });
    if (hits.length >= 12) break;
  }
  hits.sort((a, b) => a.index - b.index || b.term.length - a.term.length);
  const out = [];
  for (const h of hits) {
    if (out.some((u) => Math.abs(u.index - h.index) <= 1)) continue;
    out.push(h);
  }
  return out;
}

function preserveEducationYearSpans(text) {
  const placeholders = [];
  let out = String(text || '');
  out = out.replace(
    /\b((?:19|20)\d{2})\s*([-–—]|to)\s*((?:19|20)\d{2})\b/gi,
    (_m, y1, _sep, y2) => {
      const token = `__EDUYR${placeholders.length}__`;
      placeholders.push(`${y1}–${y2}`);
      return token;
    }
  );
  return { text: out, placeholders };
}

function restoreEducationYearSpans(text, placeholders) {
  let out = String(text || '');
  placeholders.forEach((label, i) => {
    out = out.replace(`__EDUYR${i}__`, label);
  });
  return out;
}

function looksLikeSchoolLead(text) {
  const t = String(text || '');
  return hasEducationSchool(t) || /universit|college|[eé]cole|institute|faculty/i.test(t);
}

export function splitMergedEducationLine(line) {
  const raw = repairCompactWordBoundaries(String(line || '').trim());
  if (!raw) return [];
  const preserved = preserveEducationYearSpans(raw);
  const s = preserved.text;
  const segments = s.split(/\s*[—–-]\s*/).map((p) => p.trim()).filter(Boolean);
  const restored = restoreEducationYearSpans(raw, preserved.placeholders);
  if (
    segments.length >= 2 &&
    /\b(19|20)\d{2}\b/.test(restored) &&
    looksLikeSchoolLead(segments[0]) &&
    schoolTermPositions(restored).length <= 1
  ) {
    return [restored];
  }
  const parts = s
    .split(/\s+[-–—]\s+(?=Year\s*(?:19|20)\d{2}|(?:19|20)\d{2}\s*[-–—]\s*(?:19|20)\d{2}|[A-ZÀ-Ö])/i)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length > 1) {
    return parts.map((p) => restoreEducationYearSpans(p, preserved.placeholders));
  }

  const schools = schoolTermPositions(restored);
  if (schools.length >= 2) {
    const splitAt = schools[1].index;
    const first = restored.slice(0, splitAt).replace(/\s+[-–—]\s*$/, '').trim();
    const second = restored.slice(splitAt).trim();
    if (first.length >= 4 && second.length >= 4) return [first, second];
  }

  return [restored];
}

/**
 * Split contact noise from education lines.
 */
export function sanitizeEducationLine(line) {
  let s = repairCompactWordBoundaries(String(line || '').trim());
  if (!s) return '';
  if (isLanguageProficiencyLine(s)) return '';
  if (PHONE_RE.test(s) && INSTITUTION_HINT_RE.test(s)) {
    s = s.replace(PHONE_RE, ' ').replace(EMAIL_RE, ' ').trim();
  }
  if (/\b(19|20)\d{2}\b/.test(s)) {
    s = s
      .replace(EMAIL_RE, ' ')
      .replace(URL_RE, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  } else {
    s = stripContactFromProse(s);
  }
  if (EMAIL_RE.test(s) || URL_RE.test(s)) return '';
  if (PHONE_RE.test(s) && !/\b(19|20)\d{2}\b/.test(s)) return '';
  if (lineIsClientList(s)) return '';
  return s.replace(/\s+/g, ' ').trim();
}

function lineLooksLikeJobNotSchool(line) {
  const l = String(line || '').trim();
  if (!l) return true;
  if (INSTITUTION_HINT_RE.test(l) || /\b(school|university|college|école|lycée|mba|bachelor|master|b\.s\.?|bsc|degree|diploma|a-levels)\b/i.test(l)) {
    return false;
  }
  if (
    /\b(intern|engineer|consultant|analyst|assistant|manager|developer|designer|freelance)\b/i.test(l) &&
    /\b(19|20)\d{2}\b/.test(l)
  ) {
    return true;
  }
  return false;
}

/**
 * Scan document for education entries (general cues).
 */
export function harvestEducation(lines, blockLines = [], helpers = {}) {
  const { lineHasJunk = () => false, isSectionHeaderLine = () => false } = helpers;
  const out = new Set();

  const add = (t) => {
    for (const chunk of splitMergedEducationLine(t)) {
      const s = sanitizeEducationLine(chunk);
      if (s.length < 3 || s.length > 160) continue;
      if (lineHasJunk(s)) continue;
      if (isSectionHeaderLine(s) && s.length < 24) continue;
      out.add(s);
    }
  };

  const parseBlock = (block) => {
    block.forEach((raw) => {
      const t = String(raw || '').trim();
      if (t.length < 4 || lineHasJunk(t) || isSectionHeaderLine(t)) return;
      if (/^(education|formation|studies|opleiding|ausbildung)\s*$/i.test(t)) return;
      if (/\s{2,}/.test(t) && t.length > 24) {
        t.split(/\s{2,}|\s+—\s+(?=[A-Z])/).forEach((chunk) => add(chunk.trim()));
        return;
      }
      add(t);
    });
  };

  parseBlock(blockLines || []);

  for (const raw of lines || []) {
    const l = String(raw || '').trim();
    if (!l || l.length < 3) continue;
    if (lineLooksLikeJobNotSchool(l)) continue;
    if (isLanguageProficiencyLine(l)) continue;
    if (/^[A-Z][A-Za-zÀ-ö0-9'&.()-]{1,40}\s*[—–-]\s+\S/.test(l) && l.length < 120) {
      add(l);
      continue;
    }
    if (INSTITUTION_HINT_RE.test(l) && l.length < 88) {
      add(l);
      continue;
    }
    for (const kw of EDUCATION_KEYWORDS) {
      if (kw.length < 4) continue;
      const re = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (!re.test(l)) continue;
      if (l.length < 80) {
        add(l);
        break;
      }
    }
  }

  return [...out].slice(0, 6);
}

export function extractDateRangeFromText(text) {
  const s = String(text || '');
  const m = s.match(
    /\b((?:19|20)\d{2})\s*[-–—]\s*(present|présent|current|now|aujourd'?hui|heden|actuel|\d{4})\b/i
  );
  if (m) return { startDate: m[1], endDate: m[2].replace(/\s+/g, ' ').trim() };
  const season = s.match(/\b(?:spring|summer|fall|autumn|winter)\s*((?:19|20)\d{2})\b/i);
  if (season) return { startDate: season[1], endDate: season[1] };
  const years = s.match(/\b((?:19|20)\d{2})\b/g);
  if (years?.length === 1) return { startDate: years[0], endDate: '' };
  return { startDate: '', endDate: '' };
}

const CAREER_BULLET_RE =
  /\b(led|managed|built|developed|designed|delivered|created|implemented|collaborated|achieved|increased|reduced|launched|supported|coordinated|analyzed|researched|taught|sold|advised|produced|maintained)\b/i;

/**
 * Merge fragmented experience rows; infer one block when career signals exist without structure.
 */
export function consolidateExperiences(experiences, cleanedText, identity = {}) {
  const exps = [...(experiences || [])].filter((e) => String(e.role || '').trim().length > 2);
  const blob = String(cleanedText || '');
  const dates = extractDateRangeFromText(blob);
  const hasCareerSignal = exps.length > 0 || lineLooksLikeRole(blob) || dates.startDate;

  if (!hasCareerSignal) return exps;

  const thin = exps.filter(
    (e) => !e.company && (!e.bullets || !e.bullets.length) && String(e.role || '').length < 60
  );
  const substantial = exps.filter((e) => e.company || (e.bullets && e.bullets.length));
  if (substantial.length >= 1) return exps;

  if (exps.length >= 2 && thin.length === exps.length) {
    const distinctStarts = new Set(
      exps
        .map((e) => e.startDate || extractDateRangeFromText(`${e.dates || ''} ${e.role || ''}`).startDate)
        .filter(Boolean)
    );
    const distinctCompanies = new Set(
      exps.map((e) => String(e.company || '').trim().toLowerCase()).filter((c) => c.length >= 2)
    );
    if (distinctStarts.size >= 2 || distinctCompanies.size >= 2 || exps.length >= 3) {
      return exps;
    }

    const roles = exps.map((e) => e.role).filter(Boolean);
    const mergedRole =
      (identity.title && !isBadTitleCandidate(identity.title) ? identity.title : '') ||
      roles.find((r) => lineLooksLikeRole(r)) ||
      roles[0] ||
      'Professional Experience';

    const bullets = exps
      .flatMap((e) => e.bullets || [])
      .filter((b) => b && b.length > 8);
    const careerLine = blob
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l.length > 28 && l.length < 220 && CAREER_BULLET_RE.test(l) && !EMAIL_RE.test(l));
    if (!bullets.length && careerLine) bullets.push(careerLine.slice(0, 200));

    const company = exps.find((e) => e.company)?.company || '';
    const isFreelance = /\b(freelance|independent|self[- ]?employed|contractor)\b/i.test(blob + mergedRole);

    return [
      {
        role: titleCaseProfessional(mergedRole),
        company: company || (isFreelance ? 'Independent / Freelance' : ''),
        location: exps.find((e) => e.location)?.location || '',
        startDate: dates.startDate || exps.find((e) => e.startDate)?.startDate || '',
        endDate: dates.endDate || exps.find((e) => e.endDate)?.endDate || '',
        bullets: [...new Set(bullets)].slice(0, 4),
        clients: [],
      },
    ];
  }

  if (!exps.length && hasCareerSignal) {
    const strict = parseStrictExperiencesFromLines(blob.split('\n'));
    return strict.experiences;
  }

  return exps;
}

const EXPERIENCE_HARVEST_ROLE_RE =
  /\b(freelance|illustrator|graphic\s+designer|designer|art\s+director|creative\s+director|graphiste|illustrateur|directeur\s+artistique)\b/i;

/**
 * When no Experience section exists, recover role + date + prose lines from full text.
 * @param {string[]} lines
 * @param {object} [helpers]
 * @returns {string[]}
 */
export function harvestExperienceFromLines(lines, helpers = {}) {
  void helpers;
  const strict = parseStrictExperiencesFromLines(lines || []);
  return strict.experiences
    .map((e) => {
      const head = [e.role, e.company, e.dates || e.startDate].filter(Boolean).join(' — ');
      const b = (e.bullets || []).join(' · ');
      return b ? `${head}: ${b}` : head;
    })
    .filter(Boolean)
    .slice(0, 8);
}

/**
 * Lines not mapped to a section → unsorted (never dropped).
 * @param {string[]} lines
 * @param {object} cvData
 */
export function recoverOrphanLinesToUnsorted(lines, cvData) {
  const d = cvData || {};
  const blob = String(
    [
      d.name,
      d.title,
      d.summary,
      ...(d.experience || []),
      ...(d.experiences || []).flatMap((e) =>
        typeof e === 'string' ? [e] : [e.role, e.company, e.dates, ...(e.bullets || [])]
      ),
      ...(d.education || []),
      ...(d.skills || []),
      ...(d.unsorted || []),
    ]
      .filter(Boolean)
      .join('\n')
  ).toLowerCase();
  const used = new Set(blob.split('\n').map((x) => x.trim()).filter((x) => x.length > 2));
  const unsorted = new Set((d.unsorted || []).map((x) => String(x).trim()).filter(Boolean));
  for (const raw of lines || []) {
    const l = String(raw || '').trim();
    if (!l || l.length < 6) continue;
    const k = l.toLowerCase();
    if (used.has(k)) continue;
    if ([...used].some((u) => u.length > 12 && (k.includes(u) || u.includes(k)))) continue;
    unsorted.add(l);
  }
  return [...unsorted].slice(0, 96);
}

/** @deprecated use consolidateExperiences */
export const consolidateFreelanceExperiences = consolidateExperiences;

export function buildParserDetectionSummary(structured) {
  const s = structured || {};
  const id = s.identity || {};
  return {
    name: id.name || '(missing)',
    selectedName: s.selectedName || id.name || '',
    nameCandidates: s.nameCandidates || [],
    nameConfidence: s.nameConfidence ?? null,
    title: id.title || '(missing)',
    selectedTitle: s.selectedTitle || id.title || '',
    titleCandidates: s.titleCandidates || [],
    titleConfidence: s.titleConfidence ?? null,
    pdfExtraction: s.pdfExtraction || null,
    education: (s.education || []).slice(0, 6),
    clients: (s.clients || []).slice(0, 12),
    interests: (s.interests || []).slice(0, 8),
    experiences: (s.experiences || []).length,
    skills: (s.skills || []).length,
    tools: (s.tools || []).length,
    languages: (s.languages || []).length,
  };
}
