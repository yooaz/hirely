/**
 * HIRELY Parser Enterprise — confidence-driven parsing, no invented structure.
 */

import {
  ROLE_TITLE_RE,
  lineLooksLikeRole,
} from '../../data/dictionaries/roleKeywords.js';
import {
  EDUCATION_KEYWORDS,
  INSTITUTION_HINT_RE,
} from '../../data/dictionaries/educationKeywords.js';
import { lineMatchesSchool } from '../../data/dictionaries/schools.js';
import { TOOLS } from '../../data/dictionaries/tools.js';
import { SKILLS, SKILL_HINT_RE } from '../../data/dictionaries/skills.js';
import { LANGUAGES, LANGUAGE_ALIASES } from '../../data/dictionaries/languages.js';
import { CLIENT_COMPANY_KEYWORDS } from '../../data/dictionaries/clientCompanyKeywords.js';
import { textContainsAny, termRegex } from '../../data/dictionaries/match-utils.js';
import {
  classifyLineWithConfidence,
  passesExperienceGate,
  scoreExperience,
  isLikelyPortfolioProject,
  hasExperienceDate,
} from './section-sanity.js';
import {
  extractDateRangeFromText,
  harvestExperienceFromLines,
  isBadTitleCandidate,
} from './parser-recovery.js';
import { extractExperiencesFromSectionAnchors } from './section-anchor-extract.js';
import {
  IDENTITY_CONFIDENCE_MIN,
  isValidIdentityName,
  isValidIdentityTitle,
} from './identity-extraction.js';
import { fuzzySectionKey } from './section-fuzzy.js';
import { isValidExperienceLine, isValidEducationItem } from './field-sanitize.js';
import {
  qualifiesStrictExperience,
  scoreStrictExperienceEntry,
  EXPERIENCE_PARSER_CONFIDENCE_MIN,
} from './experience-parser.js';
import {
  classifyLineByDictionary,
  findLongestDictionaryTerm,
  SCHOOL_TERMS,
  CLIENT_TERMS,
  TOOL_TERMS,
  DICTIONARY_BOOST,
} from '../../data/dictionaries/json-dictionary-match.js';
import {
  clearParserClassificationLog,
  getParserClassificationLog,
  getParserClassificationSummary,
} from './parser-classification-debug.js';
import {
  scoreEducationConfidence,
  mustNeverBeExperience,
} from './education-confidence.js';
import {
  applyCreativeParsingPass,
  detectCreativeParsingMode,
  CREATIVE_EXTRA_BUCKETS,
  isCreativeNonExperienceLine,
  classifyCreativeLine,
} from './creative-parsing-mode.js';

export const PARSER_ENTERPRISE_THRESHOLD = 70;

/** Shown when career content cannot be structured — never discard. */
export const UNKNOWN_EXPERIENCE_LABEL = 'Unknown Experience';

/** Human-readable rule ids for PDF root cause / forensic. */
export const EXPERIENCE_DROP_RULES = {
  structure_threshold:
    'buildExperienceEntries.flush — confidence < 70 without role signal',
  unclassified_line: 'buildExperienceEntries — not scored as experience (no role regex)',
  low_confidence_line: 'buildExperienceEntries — scoreExperience < 70',
  unassigned_line: 'buildExperienceEntries — career line never consumed into an entry',
  held: 'buildEnterpriseParse — entry not approved (title length / confidence / review)',
  unclassified: 'buildUnknownExperienceBlocks — preserved as Unknown Experience (not lost)',
  portfolio: 'separateProjectsFromExperience / isLikelyPortfolioProject',
  mustNeverBeExperience: 'applyParserEnterprisePass — mustNeverBeExperience → education',
  creativeReroute: 'applyParserEnterprisePass — creativeNonExperienceLine',
  dictionaryReroute: 'applyParserEnterprisePass — dictionary bucket ≠ experience',
  lowScoreReroute: 'applyParserEnterprisePass.reroute — scoreExperience < 70 → unsorted',
  otherBucket: 'applyParserEnterprisePass.reroute — OTHER_LINE_RE or short line → other',
};

/**
 * Simulate why a line would leave the experience bucket before buildExperienceEntries.
 * @param {string} line
 */
export function diagnoseExperienceBucketLine(line) {
  const l = String(line || '').trim();
  if (!l) return null;

  if (isLikelyPortfolioProject(l)) {
    return {
      rule: EXPERIENCE_DROP_RULES.portfolio,
      reason: 'Portfolio / project description — removed from experience bucket',
      confidence: scoreProjectLine(l) || 0,
    };
  }
  if (mustNeverBeExperience(l)) {
    return {
      rule: EXPERIENCE_DROP_RULES.mustNeverBeExperience,
      reason: 'Education / institution signal — rerouted to education bucket',
      confidence: scoreEducationLine(l) || 0,
    };
  }
  if (isCreativeNonExperienceLine(l)) {
    const ch = classifyCreativeLine(l);
    return {
      rule: EXPERIENCE_DROP_RULES.creativeReroute,
      reason: `Creative mode — rerouted to "${ch?.bucket || 'clients'}"`,
      confidence: ch?.confidence ?? 0,
    };
  }
  const dict = classifyLineByDictionary(l);
  if (dict && dict.bucket !== 'experience') {
    return {
      rule: EXPERIENCE_DROP_RULES.dictionaryReroute,
      reason: `Dictionary match "${dict.term || dict.bucket}" → bucket "${dict.bucket}"`,
      confidence: dict.confidence ?? 0,
    };
  }
  const scored = scoreExperience(l);
  const conf = scored?.confidence ?? 0;
  if (conf < PARSER_ENTERPRISE_THRESHOLD) {
    if (OTHER_LINE_RE.test(l) || l.length < 4) {
      return {
        rule: EXPERIENCE_DROP_RULES.otherBucket,
        reason: 'Low score and matches OTHER_LINE_RE or too short — moved to other',
        confidence: conf,
      };
    }
    return {
      rule: EXPERIENCE_DROP_RULES.lowScoreReroute,
      reason: `scoreExperience ${conf}% < ${PARSER_ENTERPRISE_THRESHOLD}% — moved to unsorted`,
      confidence: conf,
    };
  }
  return null;
}

function pushExperienceDrop(dropped, sourceLines, reason, extra = {}) {
  dropped.push({
    sourceLines: [...sourceLines],
    reason,
    confidence: extra.confidence ?? null,
    rule: extra.rule || EXPERIENCE_DROP_RULES[reason] || reason,
    detail: extra.detail || '',
  });
}

/** Enterprise parser buckets (canonical). */
export const ENTERPRISE_PARSER_BUCKETS = [
  'identity',
  'summary',
  'experience',
  'education',
  'clients',
  'awards',
  'exhibitions',
  'publications',
  'portfolioLinks',
  'projects',
  'skills',
  'tools',
  'languages',
  'other',
  'unsorted',
  'needsReview',
];

const OTHER_LINE_RE =
  /^(page\s+\d|©|copyright|confidential|references?\s+available|visa|work authorization|hobbies?|interests?)\b/i;

const EXPERIENCE_ROLE_RE =
  /\b(freelance|illustrator|graphic\s+designer|designer|art\s+director|creative\s+director|product\s+designer|visual\s+designer|motion\s+designer|senior\s+designer|lead\s+designer|graphiste|directeur\s+artistique|directeur\s+créatif|illustrateur)\b/i;

const DATE_RE =
  /\b((?:19|20)\d{2})\s*[-–—]\s*(?:present|présent|current|now|aujourd'?hui|\d{4})\b|\b(19|20)\d{2}\b/i;

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_RE = /(?:\+?\d[\d\s().-]{7,}\d)/;

/** @typedef {{ value: string, confidence: number, sourceLines: string[], field?: string, needsReview?: boolean }} ConfidentField */
/** @typedef {{ title: string, company: string, startDate: string, endDate: string, bullets: string[], confidence: number, sourceLines: string[], needsReview?: boolean }} EnterpriseExperience */

export function makeConfidentField(value, sourceLines, confidence, field = '') {
  const v = String(value || '').trim();
  const conf = Math.round(Math.max(0, Math.min(100, confidence)));
  return {
    value: v,
    confidence: conf,
    sourceLines: [...new Set((sourceLines || []).map((l) => String(l || '').trim()).filter(Boolean))],
    field,
    needsReview: conf < PARSER_ENTERPRISE_THRESHOLD,
  };
}

export function makeListItem(text, sourceLines, confidence) {
  const t = String(text || '').trim();
  const conf = Math.round(Math.max(0, Math.min(100, confidence)));
  return {
    text: t,
    confidence: conf,
    sourceLines: [...new Set((sourceLines || []).map((l) => String(l || '').trim()).filter(Boolean))],
    needsReview: conf < PARSER_ENTERPRISE_THRESHOLD,
  };
}

export function makeReviewItem(text, sourceLines, confidence, field = 'unknown') {
  const t = String(text || '').trim();
  const conf = Math.round(Math.max(0, Math.min(100, confidence || 0)));
  return {
    text: t,
    value: t,
    confidence: conf,
    sourceLines: [...new Set((sourceLines || []).map((l) => String(l || '').trim()).filter(Boolean))],
    field,
    needsReview: true,
  };
}

export function scoreProjectLine(line) {
  const l = String(line || '').trim();
  if (!isLikelyPortfolioProject(l)) return 0;
  let score = 82;
  if (/\b(cover|campaign|portfolio|case study|artwork|illustration for)\b/i.test(l)) score += 6;
  if (hasExperienceDate(l) && EXPERIENCE_ROLE_RE.test(l)) return 0;
  return Math.min(100, score);
}

/** Pull portfolio / project descriptions out of experience — never merge into jobs. */
export function separateProjectsFromExperience(blocks) {
  const out = { ...blocks };
  const projectLines = [...(out.projects || [])];
  const kept = [];
  for (const line of out.experience || []) {
    const l = String(line || '').trim();
    if (!l) continue;
    if (isLikelyPortfolioProject(l)) projectLines.push(l);
    else kept.push(l);
  }
  out.experience = kept;
  out.projects = [...new Set(projectLines.map((l) => String(l).trim()).filter(Boolean))];
  return out;
}

export function scoreEducationLine(line) {
  const l = String(line || '').trim();
  if (!l || l.length < 4) return 0;
  const edu = scoreEducationConfidence(l);
  if (edu.forceEducation) return Math.min(100, edu.score + 25);
  if (edu.schoolMatch) return Math.min(100, edu.score + 15);
  const schoolTerm = findLongestDictionaryTerm(l, SCHOOL_TERMS);
  if (schoolTerm) return Math.min(100, 70 + DICTIONARY_BOOST.schools);
  if (passesExperienceGate(l) && !lineMatchesSchool(l)) return 0;
  if (isLikelyPortfolioProject(l)) return 0;
  let score = 0;
  if (lineMatchesSchool(l)) score += 55;
  if (INSTITUTION_HINT_RE.test(l)) score += 35;
  if (textContainsAny(l, EDUCATION_KEYWORDS)) score += 30;
  if (/\b(19|20)\d{2}\b/.test(l)) score += 15;
  if (/\s[—–-]\s/.test(l) && l.length < 120) score += 12;
  return Math.min(100, score);
}

export function scoreSkillLine(line) {
  const l = String(line || '').trim();
  if (!l) return 0;
  if (findLongestDictionaryTerm(l, TOOL_TERMS)) return 0;
  if (classifyLineByDictionary(l)?.bucket === 'clients') return 0;
  if (passesExperienceGate(l)) return 0;
  let score = 0;
  if (textContainsAny(l, SKILLS)) score += 50;
  if (SKILL_HINT_RE.test(l)) score += 35;
  if (l.includes(',') && l.length < 160 && SKILL_HINT_RE.test(l)) score += 20;
  const classified = classifyLineWithConfidence(l);
  if (classified.bucket === 'skills') score = Math.max(score, classified.confidence);
  return Math.min(100, score);
}

export function scoreToolLine(line) {
  const l = String(line || '').trim();
  if (!l) return 0;
  const toolTerm = findLongestDictionaryTerm(l, TOOL_TERMS);
  if (toolTerm) return Math.min(100, 72 + DICTIONARY_BOOST.creative_tools);
  if (findLongestDictionaryTerm(l, CLIENT_TERMS)) return 0;
  const hit = TOOLS.some((t) => termRegex(t).test(l));
  if (hit) return 94;
  const classified = classifyLineWithConfidence(l);
  return classified.bucket === 'tools' ? classified.confidence : 0;
}

export function scoreLanguageLine(line) {
  const l = String(line || '').trim();
  if (!l || l.length > 56) return 0;
  for (const { re } of LANGUAGE_ALIASES) {
    if (re.test(l)) return 92;
  }
  for (const lang of LANGUAGES) {
    if (new RegExp(`\\b${lang}\\b`, 'i').test(l)) return 88;
  }
  return 0;
}

export function scoreClientLine(line) {
  const l = String(line || '').trim();
  if (!l) return 0;
  const clientTerm = findLongestDictionaryTerm(l, CLIENT_TERMS);
  if (clientTerm && !passesExperienceGate(l)) {
    return Math.min(100, 72 + DICTIONARY_BOOST.creative_clients);
  }
  if (passesExperienceGate(l)) return 0;
  const words = l.split(/\s+/).filter(Boolean);
  const hits = CLIENT_COMPANY_KEYWORDS.filter((c) => termRegex(c).test(l));
  if (words.length === 1 && hits.length) return 96;
  if (hits.length >= 2 || (hits.length && l.includes(','))) return 90;
  if (hits.length === 1 && words.length <= 3) return 85;
  return 0;
}

function parseDatesFromLines(lines) {
  const blob = lines.join(' ');
  return extractDateRangeFromText(blob);
}

function splitRoleCompany(line) {
  const l = String(line || '').trim();
  const dateM = l.match(/\b((?:19|20)\d{2}\s*[-–—]\s*(?:present|présent|current|now|aujourd'?hui|\d{4}))\b/i);
  const dates = dateM ? dateM[1] : '';
  let rest = dates ? l.replace(dates, '').trim() : l;
  const parts = rest.split(/\s*[-–—|@]\s*/).map((p) => p.trim()).filter(Boolean);
  const title = parts[0] || rest;
  const company = parts.length > 1 ? parts.slice(1).join(' — ') : '';
  const dateParts = dates.split(/[-–—]/).map((p) => p.trim());
  return {
    title,
    company,
    startDate: dateParts[0] || '',
    endDate: dateParts[1] || '',
  };
}

/**
 * Career-like line that failed bucket classification — preserve as unknown experience.
 */
export function lineMayBeUnknownExperience(line) {
  const l = String(line || '').trim();
  if (l.length < 10) return false;
  if (EMAIL_RE.test(l) || PHONE_RE.test(l)) return false;
  if (OTHER_LINE_RE.test(l)) return false;
  if (isLikelyPortfolioProject(l)) return false;
  if (mustNeverBeExperience(l)) return false;
  return (
    passesExperienceGate(l) ||
    DATE_RE.test(l) ||
    EXPERIENCE_ROLE_RE.test(l) ||
    ROLE_TITLE_RE.test(l) ||
    lineLooksLikeRole(l)
  );
}

/**
 * @typedef {{ label: string, lines: string[], text: string, reason: string, needsReview: boolean, confidence: number }} UnknownExperienceBlock
 */

/**
 * Fallback blocks — unknown data > lost data.
 * @param {object} opts
 * @returns {UnknownExperienceBlock[]}
 */
export function buildUnknownExperienceBlocks(opts = {}) {
  const blocks = [];
  const seen = new Set();
  const approvedTexts = (opts.approvedExperienceTexts || []).map((t) =>
    String(t || '').trim().toLowerCase()
  );

  const coveredByApproved = (lines) => {
    const blob = lines.join(' ').trim().toLowerCase();
    if (!blob) return false;
    return approvedTexts.some((t) => {
      if (!t) return false;
      if (t.includes(blob) || blob.includes(t)) return true;
      return lines.every((ln) => t.includes(String(ln).trim().toLowerCase()));
    });
  };

  const add = (sourceLines, reason = 'unclassified') => {
    const lines = [...new Set((sourceLines || []).map((l) => String(l || '').trim()).filter((l) => l.length >= 4))];
    if (!lines.length || coveredByApproved(lines)) return;
    const key = lines.join('\n').toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    blocks.push({
      label: UNKNOWN_EXPERIENCE_LABEL,
      lines,
      text: lines.join(' — ').slice(0, 520),
      reason,
      needsReview: true,
      confidence: 0,
    });
  };

  for (const d of opts.droppedFromBuild || []) {
    add(d.sourceLines || [], d.reason || 'structure_threshold');
  }
  for (const e of opts.experiencesHeld || []) {
    const lines = e.sourceLines?.length
      ? e.sourceLines
      : [e.title, e.company, ...(e.bullets || [])].filter(Boolean);
    add(lines, 'held');
  }
  for (const line of opts.careerUnsortedLines || []) {
    add([line], 'unclassified_line');
  }

  return blocks.slice(0, 12);
}

/**
 * Build structured experience entries with confidence + sourceLines (no invention).
 * @returns {{ entries: EnterpriseExperience[], dropped: { sourceLines: string[], reason: string }[] }}
 */
export function buildExperienceEntries(blocks) {
  const lines = []
    .concat(blocks.experience || [], blocks.achievements || [])
    .map((l) => String(l || '').trim())
    .filter(Boolean);

  const entries = [];
  const dropped = [];
  const consumed = new Set();
  let pendingTitle = '';
  let pendingMeta = '';
  let bullets = [];

  const markConsumed = (arr) => arr.forEach((l) => consumed.add(l));

  const flush = () => {
    if (!pendingTitle && !bullets.length) return;
    const sourceLines = [
      ...(pendingTitle ? [pendingTitle] : []),
      ...(pendingMeta ? [pendingMeta] : []),
      ...bullets,
    ];
    markConsumed(sourceLines);
    const blob = sourceLines.join(' ');
    const scored = scoreExperience(blob) || scoreExperience(pendingTitle || blob);
    const parts = splitRoleCompany([pendingTitle, pendingMeta].filter(Boolean).join(' — ') || pendingTitle);
    const dateExtra = parseDatesFromLines(sourceLines);
    const title = parts.title || pendingTitle;
    const company = parts.company || pendingMeta.replace(/\b((?:19|20)\d{2}[^·]*)\b/i, '').trim();
    const head = [title, company, parts.startDate || dateExtra.startDate].filter(Boolean).join(' — ');
    const strictEntry = {
      role: title || pendingTitle,
      company,
      startDate: parts.startDate || dateExtra.startDate,
      endDate: parts.endDate || dateExtra.endDate,
      bullets,
    };
    const conf = Math.max(
      scored?.confidence ?? 0,
      scoreStrictExperienceEntry(strictEntry)
    );
    const keep =
      qualifiesStrictExperience(strictEntry) &&
      conf >= EXPERIENCE_PARSER_CONFIDENCE_MIN;
    if (!keep) {
      pushExperienceDrop(dropped, sourceLines, 'structure_threshold', {
        confidence: conf,
        detail: `Entry confidence ${conf}% < ${PARSER_ENTERPRISE_THRESHOLD} without role signal`,
      });
      pendingTitle = '';
      pendingMeta = '';
      bullets = [];
      return;
    }
    entries.push({
      title,
      company,
      startDate: parts.startDate || dateExtra.startDate,
      endDate: parts.endDate || dateExtra.endDate,
      bullets: [...bullets],
      confidence: Math.max(conf, roleSignal ? 68 : conf),
      sourceLines,
      needsReview: conf < PARSER_ENTERPRISE_THRESHOLD,
    });
    pendingTitle = '';
    pendingMeta = '';
    bullets = [];
  };

  const dateLine =
    /\b(19|20)\d{2}\s*[-–—]\s*(present|présent|aujourd'?hui|current|now|\d{4})\b/i;
  const dateOnly = /^\s*(19|20)\d{2}\s*[-–—]\s*(present|présent|current|now|\d{4})\s*$/i;

  for (const line of lines) {
    if (isLikelyPortfolioProject(line)) continue;
    if (mustNeverBeExperience(line)) continue;

    if (/^[-•*–—]\s+/.test(line) || /^\d+\.\s+/.test(line)) {
      const bullet = line.replace(/^[-•*–—]\s+|^\d+\.\s+/, '').trim();
      if (isLikelyPortfolioProject(bullet)) continue;
      markConsumed([line]);
      bullets.push(bullet);
      continue;
    }
    if (bullets.length && (dateLine.test(line) || passesExperienceGate(line))) flush();

    if (dateOnly.test(line) || dateLine.test(line)) {
      markConsumed([line]);
      if (pendingTitle) {
        pendingMeta = pendingMeta ? `${pendingMeta} ${line}` : line;
        flush();
      }
      continue;
    }

    const scored = scoreExperience(line);
    const roleLine = EXPERIENCE_ROLE_RE.test(line) || ROLE_TITLE_RE.test(line);
    if (!scored && !roleLine) {
      if (lineMayBeUnknownExperience(line)) {
        pushExperienceDrop(dropped, [line], 'unclassified_line', {
          confidence: 0,
          detail: 'No scoreExperience() match and no role regex',
        });
      }
      continue;
    }
    if (scored && scored.confidence < PARSER_ENTERPRISE_THRESHOLD && !roleLine) {
      pushExperienceDrop(dropped, [line], 'low_confidence_line', {
        confidence: scored.confidence,
        detail: `scoreExperience ${scored.confidence}% < ${PARSER_ENTERPRISE_THRESHOLD}%`,
      });
      continue;
    }

    markConsumed([line]);
    if (pendingTitle) flush();
    if (/\s[-–—|@·]\s/.test(line) && line.length < 140) {
      pendingTitle = line;
      pendingMeta = '';
      continue;
    }
    if (EXPERIENCE_ROLE_RE.test(line) || ROLE_TITLE_RE.test(line)) {
      pendingTitle = line;
      pendingMeta = '';
      continue;
    }
  }
  flush();

  for (const line of lines) {
    if (consumed.has(line)) continue;
    if (!lineMayBeUnknownExperience(line)) continue;
    pushExperienceDrop(dropped, [line], 'unassigned_line', {
      confidence: scoreExperience(line)?.confidence ?? 0,
      detail: 'Career-like line in experience bucket but never assigned to an entry',
    });
  }

  return { entries, dropped };
}

/**
 * @returns {{ approved: ReturnType<typeof makeListItem>[], review: ReturnType<typeof makeReviewItem>[] }}
 */
function partitionLinesByConfidence(lines, scorer, field) {
  const approved = [];
  const review = [];

  const pushPart = (part, raw, conf) => {
    if (!part) return;
    if (conf >= PARSER_ENTERPRISE_THRESHOLD) {
      approved.push(makeListItem(part, [raw, part].filter(Boolean), conf));
    } else if (conf > 0) {
      review.push(makeReviewItem(part, [raw, part].filter(Boolean), conf, field));
    } else {
      review.push(makeReviewItem(part, [raw], 32, field));
    }
  };

  for (const raw of lines) {
    const l = String(raw || '').trim();
    if (!l) continue;
    if (field === 'experience' && isLikelyPortfolioProject(l)) continue;
    if (l.includes(',') && l.length < 200) {
      const lineConf = typeof scorer(l) === 'number' ? scorer(l) : scorer(l)?.confidence ?? 0;
      const splitBoost =
        field === 'skills' || field === 'tools'
          ? Math.max(lineConf, PARSER_ENTERPRISE_THRESHOLD)
          : lineConf;
      l.split(/,|\s*·\s*|\s*;\s*/)
        .map((x) => x.trim())
        .filter((x) => x.length > 1)
        .forEach((part) => {
          const partConf = typeof scorer(part) === 'number' ? scorer(part) : scorer(part)?.confidence ?? 0;
          pushPart(part, raw, Math.max(partConf, splitBoost));
        });
      continue;
    }
    pushPart(l, l, scorer(l));
  }
  return { approved, review };
}

/**
 * Strict bucket filter — unknown lines never forced into experience/education.
 */
export function applyParserEnterprisePass(blocks, allLines = [], opts = {}) {
  let out = { ...blocks, unsorted: [...(blocks.unsorted || [])] };
  const creativeMode =
    opts.creativeMode ??
    detectCreativeParsingMode((allLines || []).join('\n'), { lines: allLines }).active;
  const creativePass = applyCreativeParsingPass(out, creativeMode);
  out = creativePass.blocks;
  out._creativeMode = creativeMode;
  out._creativeRerouted = creativePass.rerouted;
  out = separateProjectsFromExperience(out);

  const reroute = (key, scorer, minConf = PARSER_ENTERPRISE_THRESHOLD) => {
    const kept = [];
    for (const line of out[key] || []) {
      if (key === 'experience' && mustNeverBeExperience(line)) {
        out.education = out.education || [];
        out.education.push(line);
        continue;
      }
      if (key === 'experience' && isCreativeNonExperienceLine(line)) {
        const ch = classifyCreativeLine(line);
        const bucket = ch?.bucket || 'clients';
        out[bucket] = out[bucket] || [];
        out[bucket].push(line);
        continue;
      }
      const dict = classifyLineByDictionary(line);
      if (dict && key === 'experience' && dict.bucket !== 'experience') {
        out[dict.bucket] = out[dict.bucket] || [];
        out[dict.bucket].push(line);
        continue;
      }
      if (dict && key === 'skills' && dict.bucket === 'tools') {
        out.tools = out.tools || [];
        out.tools.push(line);
        continue;
      }
      if (dict && key === 'skills' && dict.bucket === 'clients') {
        out.clients = out.clients || [];
        out.clients.push(line);
        continue;
      }
      if (key === 'experience' && isLikelyPortfolioProject(line)) {
        out.projects = out.projects || [];
        out.projects.push(line);
        continue;
      }
      const conf = typeof scorer(line) === 'number' ? scorer(line) : scorer(line)?.confidence ?? 0;
      if (conf >= minConf) kept.push(line);
      else if (OTHER_LINE_RE.test(line) || line.length < 4) {
        out.other = out.other || [];
        out.other.push(line);
      } else out.unsorted.push(line);
    }
    out[key] = kept;
  };

  reroute('experience', (line) => scoreExperience(line)?.confidence ?? 0);
  reroute('education', scoreEducationLine);

  const enterprise = buildEnterpriseParse(out, allLines);
  out._enterprise = enterprise;
  out._parserReview = enterprise.needsReview;
  out.needsReview = (enterprise.needsReviewBucket || []).map((r) => r.text);
  return out;
}

/**
 * Full enterprise parse model for structuredResume.
 */
export function buildEnterpriseParse(blocks, allLines = []) {
  const safeBlocks = separateProjectsFromExperience(blocks);
  const needsReview = [];
  const needsReviewBucket = [];

  const pushReview = (field, detected, reason, sourceLines = [], confidence = 50) => {
    const item = makeReviewItem(detected, sourceLines, confidence, field);
    needsReviewBucket.push(item);
    needsReview.push({
      field,
      detected: String(detected || '').slice(0, 120),
      suggestion: 'Verify or edit',
      reason,
      action: 'review',
      sourceLines: [...item.sourceLines],
      confidence: item.confidence,
    });
  };

  const expBuilt = buildExperienceEntries(safeBlocks);
  let experiences = expBuilt.entries;
  if (!experiences.length && allLines.length) {
    const anchored = extractExperiencesFromSectionAnchors(allLines, allLines.join('\n'));
    if (anchored.length) {
      experiences = anchored.map((e) => ({
        title: e.role,
        company: e.company,
        startDate: e.startDate,
        endDate: e.endDate,
        bullets: e.bullets || [],
        confidence: 72,
        sourceLines: [e.role, e.company].filter(Boolean),
        needsReview: false,
      }));
    }
  }
  if (!experiences.length && allLines.length) {
    const harvested = harvestExperienceFromLines(allLines, {
      isSectionHeaderLine: (l) => !!fuzzySectionKey(l),
    });
    experiences = harvested
      .filter(
        (text) =>
          /\bfreelance|independent|contractor\b/i.test(text) ||
          /\b(19|20)\d{2}\s*[-–—]/i.test(text)
      )
      .map((text) => {
      const parts = splitRoleCompany(text.split(':')[0]);
      const bullets = text.includes(':')
        ? text
            .split(':')
            .slice(1)
            .join(':')
            .split(/\s*·\s*/)
            .map((b) => b.trim())
            .filter((b) => b.length > 8)
        : [];
      return {
        title: parts.title || text,
        company: parts.company || '',
        startDate: parts.startDate,
        endDate: parts.endDate,
        bullets,
        confidence: 65,
        sourceLines: [text],
        needsReview: true,
      };
    });
  }
  for (const e of experiences) {
    if (e.needsReview || e.confidence < PARSER_ENTERPRISE_THRESHOLD) {
      pushReview(
        'experience',
        `${e.title} — ${e.company}`,
        `Experience confidence ${e.confidence}%`,
        e.sourceLines,
        e.confidence
      );
    }
  }

  const isApprovedExperience = (e) =>
    String(e.title || '').trim().length > 2 &&
    (e.confidence ?? 0) >= PARSER_ENTERPRISE_THRESHOLD &&
    !e.needsReview;
  const approvedExperiences = experiences.filter(isApprovedExperience);
  const approvedTexts = approvedExperiences.map(experienceEntryToLegacyString);
  const experiencesHeld = experiences.filter((e) => !isApprovedExperience(e));

  const eduPart = partitionLinesByConfidence(safeBlocks.education || [], scoreEducationLine, 'education');
  eduPart.review.forEach((r) =>
    pushReview('education', r.text, 'Education below confidence threshold', r.sourceLines, r.confidence)
  );

  const skillsPart = partitionLinesByConfidence(safeBlocks.skills || [], scoreSkillLine, 'skills');
  const toolsPart = partitionLinesByConfidence(safeBlocks.tools || [], scoreToolLine, 'tools');
  const langPart = partitionLinesByConfidence(safeBlocks.languages || [], scoreLanguageLine, 'languages');
  const clientsPart = partitionLinesByConfidence(safeBlocks.clients || [], scoreClientLine, 'clients');
  const projectsPart = partitionLinesByConfidence(safeBlocks.projects || [], scoreProjectLine, 'projects');
  const listFromLines = (lines, conf = 85) =>
    (lines || []).map((l) => makeListItem(String(l).trim(), [l], conf)).filter((x) => x.text);
  const awardsPart = listFromLines(safeBlocks.awards, 88);
  const exhibitionsPart = listFromLines(safeBlocks.exhibitions, 86);
  const publicationsPart = listFromLines(safeBlocks.publications, 86);
  const portfolioLinksPart = listFromLines(safeBlocks.portfolioLinks, 92);

  for (const part of [skillsPart, toolsPart, langPart, clientsPart, projectsPart, eduPart]) {
    part.review.forEach((r) =>
      pushReview(r.field || 'unknown', r.text, `Low confidence (${r.confidence}%)`, r.sourceLines, r.confidence)
    );
  }

  const summaryLines = safeBlocks.summary || safeBlocks.profile || [];
  const summaryText = summaryLines.join(' ').replace(/\s+/g, ' ').trim();
  const summaryConf = summaryText.length >= 40 ? 82 : summaryText.length >= 20 ? 68 : 0;
  const summary = makeConfidentField(summaryText, summaryLines, summaryConf, 'summary');
  if ((summary.needsReview || summaryConf < PARSER_ENTERPRISE_THRESHOLD) && summary.value) {
    pushReview('summary', summary.value.slice(0, 120), `Summary confidence ${summary.confidence}%`, summaryLines, summary.confidence);
  }

  const pool = [
    ...new Set([...(safeBlocks.unsorted || []), ...(safeBlocks.top || []), ...(safeBlocks.other || [])]),
  ]
    .map((l) => String(l).trim())
    .filter(Boolean);

  const otherRaw = pool.filter((l) => OTHER_LINE_RE.test(l));
  const unsortedRaw = pool.filter((l) => !OTHER_LINE_RE.test(l));
  const other = otherRaw.map((l) => makeListItem(l, [l], 55));

  const careerUnsorted = unsortedRaw.filter((l) => lineMayBeUnknownExperience(l));
  const unsortedNonCareer = unsortedRaw.filter((l) => !lineMayBeUnknownExperience(l));

  const unknownExperience = buildUnknownExperienceBlocks({
    droppedFromBuild: expBuilt.dropped,
    experiencesHeld,
    approvedExperienceTexts: approvedTexts,
    careerUnsortedLines: careerUnsorted,
  });

  const unsorted = unsortedNonCareer.map((l) => {
    const classified = classifyLineWithConfidence(l);
    const conf = classified.confidence;
    const bucket = classified.bucket === 'other' ? 'other' : 'unsorted';
    if (conf < PARSER_ENTERPRISE_THRESHOLD) {
      const item = makeReviewItem(l, [l], conf, bucket);
      needsReviewBucket.push(item);
      return item;
    }
    return makeListItem(l, [l], conf);
  });

  const identity = {
    name: makeConfidentField('', [], 0, 'name'),
    title: makeConfidentField('', [], 0, 'title'),
    email: makeConfidentField('', [], 0, 'email'),
    phone: makeConfidentField('', [], 0, 'phone'),
  };

  const enterprise = {
    engine: 'hirely-parser-enterprise-v3-dictionary',
    threshold: PARSER_ENTERPRISE_THRESHOLD,
    buckets: ENTERPRISE_PARSER_BUCKETS,
    experienceAudit: {
      dropped: expBuilt.dropped,
      approvedCount: approvedExperiences.length,
      heldCount: experiencesHeld.length,
      unknownCount: unknownExperience.length,
    },
    identity,
    summary,
    experiences: approvedExperiences,
    experiencesHeld,
    unknownExperience,
    education: eduPart.approved,
    educationHeld: eduPart.review,
    skills: skillsPart.approved,
    tools: toolsPart.approved,
    languages: langPart.approved,
    clients: clientsPart.approved,
    awards: awardsPart,
    exhibitions: exhibitionsPart,
    publications: publicationsPart,
    portfolioLinks: portfolioLinksPart,
    projects: projectsPart.approved,
    projectsHeld: projectsPart.review,
    creativeMode: safeBlocks._creativeMode === true,
    interests: (safeBlocks.interests || []).map((l) => makeListItem(l, [l], 78)),
    other,
    unsorted,
    needsReview,
    needsReviewBucket,
    sectionConfidence: safeBlocks.sectionConfidence || {},
    parserClassificationLog: getParserClassificationLog(),
    parserClassificationSummary: getParserClassificationSummary(),
  };

  return enterprise;
}

export { clearParserClassificationLog, getParserClassificationLog, getParserClassificationSummary };

export function attachIdentityFields(enterprise, nameResult, titleResult, contact) {
  if (!enterprise) return enterprise;
  const nameConf = nameResult?.confidence ?? 0;
  const titleConf = titleResult?.confidence ?? titleResult?.bestScore ?? 0;
  const rawName = nameResult?.resolvedName || nameResult?.selectedName || '';
  const rawTitle = titleResult?.selectedTitle || titleResult?.best || '';
  const nameVal =
    isValidIdentityName(rawName) && nameConf >= IDENTITY_CONFIDENCE_MIN ? rawName : '';
  const titleVal =
    isValidIdentityTitle(rawTitle) && titleConf >= IDENTITY_CONFIDENCE_MIN ? rawTitle : '';
  enterprise.identity.name = makeConfidentField(
    nameVal,
    nameResult?.source ? [nameResult.source.line] : nameResult?.sourceLines || [],
    nameVal ? nameConf : 0,
    'name'
  );
  enterprise.identity.title = makeConfidentField(
    titleVal,
    titleResult?.source ? [titleResult.source.line] : titleResult?.sourceLines || [],
    titleVal ? titleConf : 0,
    'title'
  );
  if (contact?.email) {
    enterprise.identity.email = makeConfidentField(contact.email, [contact.email], 95, 'email');
  }
  if (contact?.phone) {
    enterprise.identity.phone = makeConfidentField(contact.phone, [contact.phone], 95, 'phone');
  }
  for (const key of ['name', 'title']) {
    const f = enterprise.identity[key];
    if (f?.needsReview && f.value) {
      enterprise.needsReview.push({
        field: `identity.${key}`,
        detected: f.value,
        reason: `${key} confidence ${f.confidence}% (below ${PARSER_ENTERPRISE_THRESHOLD}%)`,
        action: 'edit',
        sourceLines: f.sourceLines,
      });
    }
  }
  return enterprise;
}

export function experienceEntryToLegacyString(entry) {
  const e = entry || {};
  const head = [e.title, e.company, [e.startDate, e.endDate].filter(Boolean).join('–')]
    .filter(Boolean)
    .join(' — ');
  if (e.bullets?.length) return `${head}: ${e.bullets.join(' · ')}`;
  return head;
}

export function enterpriseToLegacyCvData(enterprise, base = {}) {
  const ent = enterprise || {};
  const id = ent.identity || {};
  let name = id.name?.needsReview ? '' : id.name?.value || base.name || '';
  let title = id.title?.needsReview ? '' : id.title?.value || base.title || '';
  if (isBadTitleCandidate(name)) name = '';
  if (isBadTitleCandidate(title)) title = '';
  return {
    ...base,
    name: name || '',
    title: title || '',
    email: id.email?.value || base.email,
    phone: id.phone?.value || base.phone,
    summary: ent.summary?.needsReview ? '' : ent.summary?.value || base.summary,
    experience: ent.experiences?.length
      ? ent.experiences.map(experienceEntryToLegacyString)
      : base.experience || [],
    unknownExperience: ent.unknownExperience?.length
      ? ent.unknownExperience.map((b) =>
          typeof b === 'string' ? b : b.text || (b.lines || []).join(' — ')
        )
      : base.unknownExperience || [],
    education: base.education?.length
      ? base.education
      : ent.education?.length
        ? ent.education.map((e) => e.text)
        : [],
    skills: ent.skills?.length ? ent.skills.map((e) => e.text) : base.skills || [],
    tools: ent.tools?.length ? ent.tools.map((e) => e.text) : base.tools || [],
    languages: ent.languages?.length ? ent.languages.map((e) => e.text) : base.languages || [],
    clients: ent.clients?.length ? ent.clients.map((e) => e.text) : base.clients || [],
    awards: ent.awards?.length
      ? ent.awards.map((e) => (typeof e === 'string' ? e : e.text))
      : base.awards || [],
    exhibitions: ent.exhibitions?.length
      ? ent.exhibitions.map((e) => (typeof e === 'string' ? e : e.text))
      : base.exhibitions || [],
    publications: ent.publications?.length
      ? ent.publications.map((e) => (typeof e === 'string' ? e : e.text))
      : base.publications || [],
    portfolioLinks: ent.portfolioLinks?.length
      ? ent.portfolioLinks.map((e) => (typeof e === 'string' ? e : e.text))
      : base.portfolioLinks || [],
    projects: ent.projects?.length
      ? ent.projects.map((e) => (typeof e === 'string' ? e : e.text))
      : base.projects || [],
    _creativeMode: ent.creativeMode ?? base._creativeMode ?? null,
    other: [
      ...new Set([
        ...(ent.other || []).map((e) => (typeof e === 'string' ? e : e.text)),
        ...(base.other || []),
      ]),
    ].filter(Boolean),
    unsorted: [
      ...new Set([
        ...(ent.unsorted || []).map((e) => (typeof e === 'string' ? e : e.text)),
        ...(base.unsorted || []),
      ]),
    ].filter(Boolean),
    needsReview: ent.needsReview || [],
    _enterprise: ent,
  };
}
