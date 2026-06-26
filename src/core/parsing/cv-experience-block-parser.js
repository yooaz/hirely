/**
 * Dedicated CV experience block parser — date-anchored entries from experience section blocks.
 *
 * See EXPERIENCE_BLOCK_PARSER_ASSUMPTIONS.md for design constraints.
 */

import { hirelyDebugLog } from '../runtime/hirely-debug.js';
import { extractDateRangeFromText } from './parser-recovery.js';
import {
  isExperienceEntryStartLine,
  extractExperienceDateRange,
} from './experience-split-parser.js';
import {
  parseFreelanceCareerLine,
  parseInternshipLine,
  parseDashSeparatedExperienceLine,
} from './classification-fixes.js';
import { clientNamesInText, lineIsClientList } from './field-sanitize.js';
import { splitListItems } from './rich-parser.js';
import { fuzzySectionKey } from './section-fuzzy.js';
import { CV_SECTION } from './section-heading-dictionary.js';

export const EXPERIENCE_BLOCK_PARSER = 'EXPERIENCE_BLOCK_PARSER_V2';

/** Items below this confidence are rejected (not emitted). */
export const MIN_EXPERIENCE_EMIT_CONFIDENCE = 0.55;

/** Borderline items at or above emit floor but below this get review hints. */
export const EXPERIENCE_REVIEW_CONFIDENCE = 0.72;

const SOFTWARE_SKILL_RE =
  /\b(photoshop|illustrator|indesign|after\s+effects|procreate|figma|sketch|blender|premiere)\b/i;

const DATE_ONLY_LINE_RE =
  /^\s*((?:19|20)\d{2})\s*[-–—]\s*((?:19|20)\d{2}|present|présent|current|now|aujourd'?hui|actuel)?\s*$/i;
const YEAR_TOKEN_RE = /^\s*((?:19|20)\d{2})\s*$/;

const CLIENTS_PREFIX_RE =
  /\bclients?\s*(?:include|includes|included|such as|like|worked with|for)\s*[:—-]?\s*/i;
const FREELANCE_RE = /\bfreelanc/i;
const INTERNSHIP_RE = /\b(internship|intern|stage|stagiaire)\b/i;
const LOCATION_RE =
  /\b(paris|lyon|london|new york|berlin|remote|hybrid)\b[^,]{0,24}(?:\s*,\s*[A-Za-zÀ-ÿ]{2,})?/i;
const BULLET_RE = /^[-•*]\s+/;

/**
 * @typedef {object} ParsedExperienceItem
 * @property {string} job_title
 * @property {string} company
 * @property {string[]} client — @deprecated use clients
 * @property {string[]} clients
 * @property {string} location
 * @property {string} start_date
 * @property {string} end_date
 * @property {boolean} is_current
 * @property {string[]} description
 * @property {string[]} skills
 * @property {string[]} source_block_ids
 * @property {number} confidence
 * @property {string} entry_type — freelance | employer | internship | unknown
 * @property {string} [parser]
 * @property {string[]} [rejection_reasons]
 * @property {string[]} [review_flags]
 */

/**
 * @typedef {object} ExperienceReviewHint
 * @property {string} id
 * @property {string} type
 * @property {'low'|'medium'|'high'} severity
 * @property {string} message
 * @property {string[]} target_ids
 * @property {string[]} source_block_ids
 * @property {string} suggested_action
 */

/**
 * @param {string} line
 */
function isSectionHeaderLine(line) {
  const t = String(line || '').trim();
  return !!fuzzySectionKey(t) || /^(work experience|professional experience|expérience)/i.test(t);
}

/**
 * @param {string} text
 */
function isDateAnchorLine(text) {
  const t = String(text || '').trim();
  if (!t) return false;
  return (
    DATE_ONLY_LINE_RE.test(t) ||
    YEAR_TOKEN_RE.test(t) ||
    isExperienceEntryStartLine(t)
  );
}

/**
 * @param {string} text
 */
function isYearOnlyLine(text) {
  return YEAR_TOKEN_RE.test(String(text || '').trim());
}

/**
 * @param {string} text
 */
function isClientsLine(text) {
  const t = String(text || '').trim();
  return CLIENTS_PREFIX_RE.test(t) || (lineIsClientList(t) && !FREELANCE_RE.test(t) && !INTERNSHIP_RE.test(t));
}

/**
 * @param {string} text
 */
function isInternshipLabelLine(text) {
  return INTERNSHIP_RE.test(String(text || ''));
}

/**
 * @param {string} text
 */
function isCompactOneLineEntry(text) {
  const t = String(text || '').trim();
  if (!t || t.length > 180) return false;
  if (isDateAnchorLine(t) && !/\b(designer|illustrator|agency|freelance)\b/i.test(t)) return false;
  const dash = parseDashSeparatedExperienceLine(t);
  return !!(dash?.company && (dash.startDate || dash.role));
}

/**
 * @typedef {object} ExperienceSourceBlock
 * @property {string} text
 * @property {string} [block_id]
 * @property {number} [reading_order]
 */

/**
 * @param {ExperienceSourceBlock[]} blocks
 */
function groupExperienceEntries(blocks) {
  const items = (blocks || [])
    .map((b) => ({
      text: String(b.text || '').trim(),
      block_id: b.block_id || null,
      reading_order: b.reading_order,
    }))
    .filter((b) => b.text && !isSectionHeaderLine(b.text));

  /** @type {ExperienceSourceBlock[][]} */
  const groups = [];
  /** @type {ExperienceSourceBlock[]} */
  let pendingLead = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    if (isCompactOneLineEntry(item.text)) {
      if (pendingLead.length) {
        groups.push([...pendingLead]);
        pendingLead = [];
      }
      groups.push([item]);
      continue;
    }

    if (isInternshipLabelLine(item.text)) {
      if (pendingLead.length) {
        groups.push([...pendingLead]);
        pendingLead = [];
      }
      const group = [item];
      if (i + 1 < items.length && isYearOnlyLine(items[i + 1].text)) {
        group.push(items[i + 1]);
        i += 1;
      }
      groups.push(group);
      continue;
    }

    if (isDateAnchorLine(item.text)) {
      const group = [...pendingLead, item];
      pendingLead = [];
      let j = i + 1;
      while (j < items.length) {
        const next = items[j];
        if (isSectionHeaderLine(next.text)) break;
        if (isInternshipLabelLine(next.text) || isCompactOneLineEntry(next.text)) break;
        if (isDateAnchorLine(next.text) && !isClientsLine(next.text) && j > i + 1) break;
        if (isDateAnchorLine(next.text) && pendingLead.length === 0 && group.length > 1) break;
        if (isYearOnlyLine(next.text) && group.some((g) => isInternshipLabelLine(g.text))) break;
        group.push(next);
        j += 1;
        if (isInternshipLabelLine(next.text)) {
          if (j < items.length && isYearOnlyLine(items[j].text)) {
            group.push(items[j]);
            j += 1;
          }
          break;
        }
      }
      groups.push(group);
      i = j - 1;
      continue;
    }

    pendingLead.push(item);
  }

  if (pendingLead.length) groups.push(pendingLead);
  return groups.filter((g) => g.length);
}

/**
 * @param {string} line
 */
function parseClientsFromLine(line) {
  const t = String(line || '').trim();
  if (!t) return [];
  let tail = t;
  if (CLIENTS_PREFIX_RE.test(t)) {
    tail = t.replace(/^.*?\b(?:include|includes|included|such as|like|worked with|for)\s*[:—-]?\s*/i, '');
  }
  const fromDict = clientNamesInText(tail);
  const split = splitListItems(tail.replace(/\.$/, ''));
  const merged = [...new Set([...fromDict, ...split].map((c) => c.trim()).filter(Boolean))];
  return merged.filter(
    (c) =>
      c.length >= 2 &&
      !/^(and|et|more)$/i.test(c) &&
      !SOFTWARE_SKILL_RE.test(c) &&
      !/^(illustration|graphic design|packaging)$/i.test(c)
  );
}

/**
 * @param {ParsedExperienceItem} item
 * @returns {string[]}
 */
export function collectExperienceRejectionReasons(item) {
  /** @type {string[]} */
  const reasons = [];
  if (!item) return ['empty_item'];
  if (item.confidence < MIN_EXPERIENCE_EMIT_CONFIDENCE) reasons.push('low_confidence');
  if (!item.start_date && !item.end_date && !item.is_current) reasons.push('missing_dates');
  if (!item.job_title && !item.company) reasons.push('missing_role_and_company');
  if (item.entry_type === 'employer' && !item.company) reasons.push('missing_company');
  if (item.entry_type === 'internship' && !item.company) reasons.push('internship_missing_company');
  if (item.entry_type === 'freelance' && !item.job_title && !FREELANCE_RE.test(item.company || '')) {
    reasons.push('freelance_missing_title');
  }
  return reasons;
}

/**
 * @param {ParsedExperienceItem} item
 */
function collectExperienceReviewFlags(item) {
  /** @type {string[]} */
  const flags = [];
  if (item.confidence < EXPERIENCE_REVIEW_CONFIDENCE) flags.push('borderline_confidence');
  if (!item.start_date) flags.push('missing_start_date');
  if (!item.end_date && !item.is_current) flags.push('missing_end_date');
  if (item.entry_type === 'freelance' && !item.clients?.length) flags.push('freelance_no_clients');
  if (item.entry_type === 'internship' && !INTERNSHIP_RE.test(item.company || '')) {
    flags.push('internship_label_weak');
  }
  if (item.entry_type === 'employer' && FREELANCE_RE.test(item.job_title || '')) {
    flags.push('freelance_vs_employer_ambiguous');
  }
  return flags;
}

let reviewHintSeq = 0;

/**
 * @param {ParsedExperienceItem[]} accepted
 * @param {ParsedExperienceItem[]} rejected
 * @returns {ExperienceReviewHint[]}
 */
export function buildExperienceReviewHints(accepted = [], rejected = []) {
  /** @type {ExperienceReviewHint[]} */
  const hints = [];

  for (const item of rejected) {
    reviewHintSeq += 1;
    hints.push({
      id: `exp-reject-${reviewHintSeq}`,
      type: 'experience_rejected',
      severity: 'high',
      message: `Experience entry rejected: ${(item.rejection_reasons || []).join(', ') || 'low quality'}.`,
      target_ids: [],
      source_block_ids: item.source_block_ids || [],
      suggested_action: 'ask_user_confirmation',
    });
  }

  accepted.forEach((item, index) => {
    const flags = item.review_flags || [];
    if (!flags.length) return;
    reviewHintSeq += 1;
    const severity =
      flags.includes('borderline_confidence') && item.confidence < 0.62 ? 'high' : 'medium';
    hints.push({
      id: `exp-review-${reviewHintSeq}`,
      type: flags.includes('freelance_vs_employer_ambiguous')
        ? 'ambiguous_freelance_employer'
        : flags.includes('missing_start_date')
          ? 'missing_dates'
          : 'ambiguous_experience',
      severity,
      message: buildExperienceHintMessage(item, flags),
      target_ids: [`experience-${index}`],
      source_block_ids: item.source_block_ids || [],
      suggested_action: 'ask_user_confirmation',
    });
  });

  return hints;
}

/**
 * @param {ParsedExperienceItem} item
 * @param {string[]} flags
 */
function buildExperienceHintMessage(item, flags) {
  if (flags.includes('freelance_vs_employer_ambiguous')) {
    return 'This line could be freelance work or an employer role — please confirm.';
  }
  if (flags.includes('missing_start_date')) {
    return 'This experience is missing a start date.';
  }
  if (flags.includes('freelance_no_clients') && item.entry_type === 'freelance') {
    return 'Freelance entry has no client list — confirm if clients are listed elsewhere.';
  }
  if (flags.includes('borderline_confidence')) {
    return 'We have low confidence on this experience entry.';
  }
  return 'Please review this experience entry.';
}

/**
 * @param {ParsedExperienceItem|null} raw
 * @returns {ParsedExperienceItem|null}
 */
function finalizeExperienceItem(raw) {
  if (!raw) return null;

  const uniqueClients = [...new Set((raw.client || []).map((c) => c.trim()).filter(Boolean))];
  const uniqueDescription = [...new Set((raw.description || []).map((d) => d.trim()).filter(Boolean))];
  const skillBlocklist = new Set(uniqueClients.map((c) => c.toLowerCase()));

  const item = {
    ...raw,
    client: uniqueClients,
    clients: uniqueClients,
    description: uniqueDescription,
    skills: (raw.skills || []).filter((s) => !skillBlocklist.has(s.toLowerCase())),
    confidence: scoreExperienceConfidence(
      { ...raw, client: uniqueClients },
      { entry_type: raw.entry_type }
    ),
  };

  item.review_flags = collectExperienceReviewFlags(item);
  item.rejection_reasons = collectExperienceRejectionReasons(item);
  return item;
}

/**
 * @param {ParsedExperienceItem[]} items
 */
export function partitionExperienceItems(items) {
  /** @type {ParsedExperienceItem[]} */
  const accepted = [];
  /** @type {ParsedExperienceItem[]} */
  const rejected = [];

  for (const raw of items || []) {
    const item = finalizeExperienceItem(raw);
    if (!item) continue;
    if (item.rejection_reasons?.length) {
      rejected.push(item);
    } else {
      accepted.push(item);
    }
  }

  return {
    accepted,
    rejected,
    review_hints: buildExperienceReviewHints(accepted, rejected),
  };
}

/**
 * @param {ParsedExperienceItem} item
 */
function scoreExperienceConfidence(item, meta = {}) {
  let score = 0.42;
  if (item.start_date) score += 0.22;
  if (item.end_date || item.is_current) score += 0.08;
  if (item.job_title && item.job_title.length >= 3) score += 0.14;
  if (item.company && item.company.length >= 2) score += 0.12;
  if (item.client?.length || item.clients?.length) score += 0.06;
  if (item.description?.length) score += 0.04;
  if (meta.entry_type === 'internship' && INTERNSHIP_RE.test(item.company || item.job_title)) score += 0.06;
  if (meta.entry_type === 'freelance' && FREELANCE_RE.test(item.job_title || '')) score += 0.06;
  if (!item.start_date && !item.end_date) score -= 0.2;
  if (!item.job_title && !item.company) score -= 0.25;
  return Math.max(0, Math.min(1, Math.round(score * 1000) / 1000));
}

/**
 * @param {ExperienceSourceBlock[]} group
 * @returns {ParsedExperienceItem|null}
 */
export function parseExperienceEntryFromGroup(group) {
  const lines = (group || []).map((g) => String(g.text || '').trim()).filter(Boolean);
  if (!lines.length) return null;

  const source_block_ids = group.map((g) => g.block_id).filter(Boolean);
  const blob = lines.join('\n');

  /** @type {string[]} */
  const description = [];
  /** @type {string[]} */
  const clients = [];
  /** @type {string[]} */
  const skills = [];

  let entry_type = 'employer';
  let job_title = '';
  let company = '';
  let location = '';
  let start_date = '';
  let end_date = '';
  let is_current = false;

  const internship = parseInternshipLine(lines[0], { nearbyLines: lines.slice(1) });
  if (internship) {
    entry_type = 'internship';
    job_title = internship.role || 'Internship';
    company = internship.company || '';
    start_date = internship.startDate || '';
    end_date = internship.endDate || start_date || '';
    is_current = /present/i.test(end_date);
    if (internship.bullets?.length) description.push(...internship.bullets);
  }

  const freelance = !internship ? parseFreelanceCareerLine(blob) || parseFreelanceCareerLine(lines.join(' ')) : null;
  if (freelance) {
    entry_type = 'freelance';
    job_title = freelance.role || '';
    company = freelance.company || 'Independent / Freelance';
    start_date = freelance.startDate || '';
    end_date = freelance.endDate || '';
    is_current = /present/i.test(end_date);
    if (freelance.bullets?.length) description.push(...freelance.bullets);
  }

  const dash = !internship && !freelance ? parseDashSeparatedExperienceLine(blob) : null;
  if (dash) {
    job_title = dash.role || job_title;
    company = dash.company || company;
    start_date = dash.startDate || start_date;
    end_date = dash.endDate || end_date;
    is_current = /present/i.test(end_date);
    entry_type = FREELANCE_RE.test(blob) ? 'freelance' : entry_type;
  }

  const dates = extractExperienceDateRange(blob);
  if (dates.startDate) {
    start_date = dates.startDate;
    end_date = dates.endDate || end_date;
    is_current = /present/i.test(end_date);
  }

  for (const line of lines) {
    if (isClientsLine(line)) {
      clients.push(...parseClientsFromLine(line));
      continue;
    }
    if (BULLET_RE.test(line)) {
      description.push(line.replace(BULLET_RE, '').trim());
      continue;
    }
    if (isDateAnchorLine(line)) continue;

    if (isInternshipLabelLine(line) && !company) {
      company = line.replace(/\s*\((internship|intern|stage)\)\s*/gi, '').trim();
      if (!job_title || job_title === 'Internship') job_title = 'Internship';
      entry_type = 'internship';
      continue;
    }

    if (FREELANCE_RE.test(line) && !job_title) {
      job_title = line.replace(/\s+/g, ' ').trim();
      company = company || 'Independent / Freelance';
      entry_type = 'freelance';
      continue;
    }

    if (!job_title && !company) {
      if (/\b(agency|agence|studio|inc|gmbh|llc|corp|group)\b/i.test(line) || INTERNSHIP_RE.test(line)) {
        company = line.replace(/\s*\((internship|intern|stage)\)\s*/gi, '').trim();
        if (INTERNSHIP_RE.test(line)) entry_type = 'internship';
      } else if (line.length <= 96) {
        job_title = line;
      }
    } else if (!company && line.length <= 80 && !isClientsLine(line)) {
      company = line.replace(/\s*\((internship|intern|stage)\)\s*/gi, '').trim();
    } else if (line.length > 20 && !isClientsLine(line)) {
      description.push(line);
    }

    const loc = line.match(LOCATION_RE);
    if (loc && !location) location = loc[0].trim();
  }

  if (FREELANCE_RE.test(job_title) || FREELANCE_RE.test(blob)) {
    entry_type = 'freelance';
    if (!company || /^independent$/i.test(company)) company = 'Independent / Freelance';
  }

  if (INTERNSHIP_RE.test(company) || INTERNSHIP_RE.test(lines[0])) {
    entry_type = 'internship';
    company = company.replace(/\s*\((internship|intern|stage)\)\s*/gi, '').trim();
    if (!job_title) job_title = 'Internship';
  }

  if (entry_type === 'internship' && start_date && !end_date) {
    end_date = start_date;
  }

  for (const line of lines) {
    if (isYearOnlyLine(line) && !start_date) {
      start_date = line.trim();
      end_date = end_date || start_date;
    }
  }

  const uniqueClients = [...new Set(clients.map((c) => c.trim()).filter(Boolean))];
  const uniqueDescription = [...new Set(description.map((d) => d.trim()).filter(Boolean))];

  return finalizeExperienceItem({
    job_title: job_title.trim(),
    company: company.trim(),
    client: uniqueClients,
    clients: uniqueClients,
    location: location.trim(),
    start_date,
    end_date: is_current ? 'Present' : end_date,
    is_current,
    description: uniqueDescription,
    skills,
    source_block_ids,
    confidence: 0,
    entry_type,
    parser: EXPERIENCE_BLOCK_PARSER,
  });
}

/**
 * @param {ExperienceSourceBlock[]|import('./section-segmenter.js').SegmentedBlock[]} blocks
 * @param {object} [opts]
 * @returns {{ items: ParsedExperienceItem[], groups: ExperienceSourceBlock[][], stats: object }}
 */
export function parseExperienceSectionBlocks(blocks, opts = {}) {
  const normalized = (blocks || [])
    .map((b, i) => ({
      text: String(b.text || '').trim(),
      block_id: b.block_id || b.id || `exp-b-${i}`,
      reading_order: b.reading_order ?? i,
      section: b.section,
    }))
    .filter((b) => b.text);

  const experienceBlocks = opts.section
    ? normalized
    : normalized.filter(
        (b) =>
          !b.section ||
          b.section === CV_SECTION.EXPERIENCE ||
          b.section === 'experience' ||
          b.section === 'EXPERIENCE'
      );

  const groups = groupExperienceEntries(experienceBlocks);
  const rawItems = groups.map((g) => parseExperienceEntryFromGroup(g)).filter(Boolean);
  const { accepted, rejected, review_hints } = partitionExperienceItems(rawItems);

  const stats = {
    inputBlocks: normalized.length,
    experienceBlocks: experienceBlocks.length,
    groups: groups.length,
    parsed: accepted.length,
    rejected: rejected.length,
    reviewHintCount: review_hints.length,
    avgConfidence:
      accepted.length > 0
        ? Math.round((accepted.reduce((s, e) => s + e.confidence, 0) / accepted.length) * 1000) / 1000
        : 0,
  };

  hirelyDebugLog('EXPERIENCE_BLOCK_PARSER', { ...stats, engine: EXPERIENCE_BLOCK_PARSER });

  if (typeof globalThis !== 'undefined') {
    globalThis.__HIRELY_EXPERIENCE_BLOCK_PARSER = {
      items: accepted,
      rejected,
      review_hints,
      groups,
      stats,
    };
  }

  return { items: accepted, rejected, review_hints, groups, stats };
}

/**
 * @param {string[]|string} lines
 */
export function parseExperienceLines(lines) {
  const list = Array.isArray(lines)
    ? lines
    : String(lines || '')
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
  return parseExperienceSectionBlocks(
    list.map((text, i) => ({ text, block_id: `line-${i}`, reading_order: i }))
  );
}

/**
 * @param {import('./section-segmenter.js').SegmentedBlock[]} segments
 */
export function parseExperienceFromSegments(segments) {
  const expBlocks = (segments || []).filter(
    (s) => s.section === CV_SECTION.EXPERIENCE || s.section === 'experience'
  );
  return parseExperienceSectionBlocks(expBlocks);
}
