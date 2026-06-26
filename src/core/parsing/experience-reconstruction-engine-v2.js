/**
 * EXPERIENCE_RECONSTRUCTION_ENGINE_V2 — maximum experience recovery from raw text.
 *
 * Input: raw text (OCR / paste / native PDF)
 * Output: experiences + review queue (never discard lines)
 *
 * Recovers: date ranges, companies, freelance careers, internships, client lists.
 */

import { fuzzySectionKey } from './section-fuzzy.js';
import { isSectionHeaderLine } from './rich-parser.js';
import { extractDateRangeFromText, titleCaseProfessional } from './parser-recovery.js';
import {
  parseFreelanceCareerLine,
  parseInternshipLine,
} from './classification-fixes.js';
import {
  buildExperienceEntryFromLineGroup,
  normalizeExperienceRole,
  lineIsEducationData,
  lineIsSkillOrTagOnly,
} from './experience-parser.js';
import { mustNeverBeExperience } from './education-confidence.js';
import { mergeFragmentedOcrLines } from './ocr-experience-merge.js';
import { findLongestDictionaryTerm, CLIENT_TERMS } from '../../data/dictionaries/json-dictionary-match.js';
import {
  DATE_RANGE_RE,
  FREELANCE_RE,
  INTERNSHIP_RE,
  GENERIC_ROLE_WORDS_RE,
  ORGANIZATION_CONTEXT_RE,
  lineLooksLikeCareerHistory,
} from './generic-career-signals.js';
import {
  extractExperienceDateRange,
  isExperienceEntryStartLine,
} from './experience-split-parser.js';
import {
  isCompanyHeaderLine,
  parseExperienceGroupLight,
  experienceEntryComplete,
} from './experience-segmentation-engine.js';
import {
  classifyEmploymentKind,
  mustNeverMergeExperiences,
  reconstructExperienceEntries,
  EXPERIENCE_RECONSTRUCTION_ENGINE,
} from './experience-reconstruction-engine.js';
import { normalizeReviewItem, mergeReviewQueues } from './review-queue-merge.js';
import { hirelyDebugLog } from '../runtime/hirely-debug.js';

export const EXPERIENCE_RECONSTRUCTION_ENGINE_V2 = 'EXPERIENCE_RECONSTRUCTION_ENGINE_V2';
export const EXPERIENCE_V2_RECALL_GOAL = 0.92;
export const EXPERIENCE_V2_MAX_ENTRIES = 32;

const SPACE_YEAR_PAIR_RE =
  /^\s*((?:19|20)\d{2})\s+((?:19|20)\d{2}|present|présent|current|now|aujourd'?hui|actuel)\s*$/i;

const CLIENT_LIST_RE = /^\s*\(?[A-ZÀ-Ö][\w&.'-]+(?:\s*,\s*[A-ZÀ-Ö][\w&.'-]+){2,}/;
const PAREN_CLIENT_RE = /^\s*\([^)]{8,120}\)\s*$/;

const FORBIDDEN_SECTION_KEYS = new Set([
  'education',
  'skills',
  'tools',
  'languages',
  'contact',
  'summary',
  'profile',
  'interests',
]);

const BULLET_RE = /^[-•*]\s+/;
const SECTION_HEADER_EXP_RE =
  /^(profile(\s+work)?\s+experience|work\s+experience|professional\s+experience|employment|expérience|experience|career|clients)\b/i;
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_RE = /(?:\+?\d[\d\s().-]{7,}\d)/;

function normSpace(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

function normExpKey(exp) {
  return [
    normSpace(exp?.role).toLowerCase(),
    normSpace(exp?.company).toLowerCase(),
    String(exp?.startDate || exp?.dates || '').replace(/\D/g, '').slice(0, 8),
  ].join('|');
}

function isDateLine(line) {
  const l = normSpace(line);
  if (!l) return false;
  if (SPACE_YEAR_PAIR_RE.test(l)) return true;
  if (DATE_RANGE_RE.test(l) && l.length < 48) return true;
  if (/^\s*((?:19|20)\d{2})\s*[-–—]\s*((?:19|20)\d{2}|present|présent|current|now|aujourd'?hui|actuel)?\s*$/i.test(l)) {
    return true;
  }
  if (isExperienceEntryStartLine(l) && /\b(19|20)\d{2}\b/.test(l)) return true;
  return false;
}

function extractDatesFromLine(line) {
  const l = normSpace(line);
  const spaced = l.match(SPACE_YEAR_PAIR_RE);
  if (spaced) {
    const end = /present|présent|current|now|aujourd'?hui|actuel/i.test(spaced[2])
      ? 'Present'
      : spaced[2];
    return { startDate: spaced[1], endDate: end };
  }
  return extractExperienceDateRange(l);
}

function looksLikeRoleLine(line) {
  const l = normSpace(line);
  if (!l || l.length > 120) return false;
  if (isDateLine(l)) return false;
  if (BULLET_RE.test(l)) return false;
  if (isCompanyHeaderLine(l) && !GENERIC_ROLE_WORDS_RE.test(l)) return false;
  return GENERIC_ROLE_WORDS_RE.test(l) || /\b(lead|senior|junior|art\s+director|visual\s+designer)\b/i.test(l);
}

function splitCompanyRoleCombo(line) {
  const l = normSpace(line);
  if (!l) return { company: '', role: '' };

  const roleMatch = l.match(
    /\b((?:senior|lead|junior|freelance\s+)?(?:art\s+director|creative\s+director|visual\s+designer|illustrator(?:\s*\/\s*designer)?|graphic\s+designer|designer|developer|engineer|manager|consultant)(?:\s*\/\s*\w+)?)\s*$/i
  );
  if (roleMatch) {
    const role = roleMatch[1].trim();
    const company = normSpace(l.slice(0, roleMatch.index));
    if (company.length >= 2) return { company, role };
  }

  if (isCompanyHeaderLine(l) && !GENERIC_ROLE_WORDS_RE.test(l)) {
    return { company: l, role: '' };
  }

  return { company: '', role: l };
}

function lineIsForbiddenSource(line) {
  const l = normSpace(line);
  if (!l) return true;
  if (SECTION_HEADER_EXP_RE.test(l)) return true;
  const section = fuzzySectionKey(l);
  if (section && FORBIDDEN_SECTION_KEYS.has(section)) return true;
  if (isSectionHeaderLine(l) && section) return true;
  if (lineIsEducationData(l) || mustNeverBeExperience(l)) return true;
  if (lineIsSkillOrTagOnly(l)) return true;
  if (/^(french|english|spanish|german|native|fluent)\b/i.test(l)) return true;
  if (/^(photoshop|illustrator|indesign|figma)\b/i.test(l) && !DATE_RANGE_RE.test(l)) return true;
  const hasCareerYears =
    DATE_RANGE_RE.test(l) ||
    SPACE_YEAR_PAIR_RE.test(l) ||
    /\b(19|20)\d{2}\s+(19|20)\d{2}\b/.test(l);
  if (!hasCareerYears && (EMAIL_RE.test(l) || PHONE_RE.test(l))) return true;
  return false;
}

function lineIsIdentityHeader(line) {
  const l = normSpace(line);
  if (!l || l.length > 120) return false;
  if (DATE_RANGE_RE.test(l) || SPACE_YEAR_PAIR_RE.test(l)) return false;
  if (EMAIL_RE.test(l) || PHONE_RE.test(l)) return false;
  if (/\b(19|20)\d{2}\b/.test(l)) return false;
  const words = l.split(/\s+/).length;
  if (words <= 6 && /^[A-ZÀ-Ö]/.test(l) && /\b(designer|illustrator|developer|engineer)\b/i.test(l)) {
    return !ORGANIZATION_CONTEXT_RE.test(l) && !isCompanyHeaderLine(l);
  }
  return false;
}

/**
 * Parse compact OCR rows: "McCann Paris Lead Illustrator 2011 2014"
 * or date-first: "2023–Present Studio Example Creative Director"
 * @param {string} line
 */
function parseCompactOcrExperienceLine(line) {
  const l = normSpace(line);
  if (!l || l.length < 12) return null;

  if (FREELANCE_RE.test(l) && DATE_RANGE_RE.test(l)) {
    const freelance = parseFreelanceCareerLine(l);
    if (freelance) {
      return buildExperienceEntry({
        role: freelance.role.replace(/^[-–—\s]+/, '').trim(),
        company: freelance.company || 'Independent / Freelance',
        startDate: freelance.startDate,
        endDate: freelance.endDate,
        dates: freelance.dates,
        bullets: freelance.bullets || [],
        confidence: 84,
      });
    }
  }

  let head = '';
  let startDate = '';
  let endDate = '';

  const dateFirst = l.match(
    /^((?:19|20)\d{2})\s*[-–—]\s*(present|présent|current|now|aujourd'?hui|actuel)\s+(.+)$/i
  );
  if (dateFirst) {
    startDate = dateFirst[1];
    endDate = 'Present';
    head = normSpace(dateFirst[3]);
  }

  const spacedTail = l.match(/^(.+?)\s+((?:19|20)\d{2})\s+((?:19|20)\d{2}|present|présent|current|now|aujourd'?hui|actuel)\s*$/i);
  if (!startDate && spacedTail) {
    head = normSpace(spacedTail[1]);
    startDate = spacedTail[2];
    endDate = /present|présent|current|now|aujourd'?hui|actuel/i.test(spacedTail[3]) ? 'Present' : spacedTail[3];
  }

  const rangeTail = l.match(
    /^(.+?)\s+((?:19|20)\d{2})\s*[-–—]\s*((?:19|20)\d{2}|present|présent|current|now|aujourd'?hui|actuel)\s*$/i
  );
  if (!startDate && rangeTail) {
    head = normSpace(rangeTail[1]);
    startDate = rangeTail[2];
    endDate = /present|présent|current|now|aujourd'?hui|actuel/i.test(rangeTail[3]) ? 'Present' : rangeTail[3];
  }

  if (!startDate || !head) return null;

  const freelance = parseFreelanceCareerLine(l);
  if (freelance) {
    return buildExperienceEntry({
      role: freelance.role,
      company: freelance.company || 'Independent / Freelance',
      startDate: freelance.startDate,
      endDate: freelance.endDate,
      dates: freelance.dates,
      bullets: freelance.bullets || [],
      confidence: 84,
    });
  }

  let company = '';
  let role = '';

  const light = parseExperienceGroupLight([head]);
  if (light?.company || light?.role || light?.title) {
    role = normSpace(light.role || light.title);
    company = normSpace(light.company);
  }

  if (!role) {
    const roleTail = head.match(
      /\b((?:senior|lead|junior|freelance)\s+(?:art\s+director(?:\s+illustration)?|creative\s+director|visual\s+designer|illustrator(?:\s*\/\s*designer)?|graphic\s+designer|designer)|(?:art\s+director(?:\s+illustration)?|creative\s+director|visual\s+designer|illustrator(?:\s*\/\s*designer)?|graphic\s+designer|designer))\s*$/i
    );
    if (roleTail) {
      role = normSpace(roleTail[1]);
      company = normSpace(head.slice(0, roleTail.index));
    }
  }

  if (!role) {
    const combo = splitCompanyRoleCombo(head);
    company = combo.company;
    role = combo.role;
  }

  if (!company && isCompanyHeaderLine(head)) company = head;
  if (!role && GENERIC_ROLE_WORDS_RE.test(head)) role = head;

  if (FREELANCE_RE.test(head) && (!company || company.length < 2)) {
    company = 'Independent / Freelance';
  }

  if (!role && !company) return null;

  return buildExperienceEntry({
    role: role || '',
    company: company || '',
    startDate,
    endDate,
    confidence: role && company ? 86 : 55,
  });
}

function harvestCareerLines(rawText) {
  const merged = mergeFragmentedOcrLines(rawText);
  const lines = (Array.isArray(merged) ? merged : String(merged || '').split(/\r?\n/))
    .map((l, index) => ({ text: normSpace(l), index }))
    .filter((row) => row.text);

  const out = [];
  let inExperience = false;

  for (const row of lines) {
    if (SECTION_HEADER_EXP_RE.test(row.text) && /\bexperience\b/i.test(row.text)) {
      inExperience = true;
      continue;
    }
    const section = fuzzySectionKey(row.text);
    if (section) {
      if (section === 'experience') {
        inExperience = true;
        continue;
      }
      if (section === 'clients') {
        inExperience = true;
        out.push({ ...row, kind: 'clients-section' });
        continue;
      }
      if (FORBIDDEN_SECTION_KEYS.has(section)) {
        inExperience = false;
        continue;
      }
    }
    if (!inExperience && !lineLooksLikeCareerHistory(row.text)) continue;
    if (lineIsForbiddenSource(row.text)) continue;
    if (lineIsIdentityHeader(row.text)) continue;
    out.push(row);
  }

  if (out.length) return out;

  return lines.filter((row) => {
    if (lineIsForbiddenSource(row.text)) return false;
    if (lineIsIdentityHeader(row.text)) return false;
    return lineLooksLikeCareerHistory(row.text) || isCompanyHeaderLine(row.text) || isDateLine(row.text);
  });
}

function parseClientNames(line) {
  const l = normSpace(line).replace(/^\(|\)$/g, '');
  const commaSplit = l.split(/[,;·]/).map((p) => normSpace(p)).filter((p) => p.length >= 2);
  const fromDict = [];
  for (const part of commaSplit) {
    const hit = findLongestDictionaryTerm(part, CLIENT_TERMS);
    if (hit) fromDict.push(hit);
    else if (/^[A-ZÀ-Ö]/.test(part) && part.length <= 40) fromDict.push(part);
  }
  return [...new Set(fromDict)];
}

function buildExperienceEntry(fields) {
  const role = titleCaseProfessional(normalizeExperienceRole(fields.role || '', fields.company || ''));
  const company = normSpace(fields.company);
  const dates = fields.dates || '';
  const startDate = fields.startDate || '';
  const endDate = fields.endDate || '';
  const entry = {
    role,
    company,
    location: normSpace(fields.location || ''),
    startDate,
    endDate,
    dates: dates || (startDate ? `${startDate}–${endDate || 'Present'}` : ''),
    description: normSpace(fields.description || ''),
    bullets: fields.bullets || [],
    clients: fields.clients || [],
    confidence: fields.confidence ?? 70,
    employmentKind: classifyEmploymentKind({ role, company, dates }),
    reconstructionSource: EXPERIENCE_RECONSTRUCTION_ENGINE_V2,
  };
  return entry;
}

function parseStackedOcrBlock(rows) {
  if (!rows?.length) return null;
  const lines = rows.map((r) => r.text);

  if (lines.length === 1) {
    const compact = parseCompactOcrExperienceLine(lines[0]);
    if (compact) return compact;
    const intern = parseInternshipLine(lines[0], { nearbyLines: lines });
    if (intern) {
      return buildExperienceEntry({
        role: intern.role || 'Internship',
        company: intern.company,
        startDate: intern.startDate,
        endDate: intern.endDate,
        dates: intern.dates,
        confidence: 78,
      });
    }
    const light = parseExperienceGroupLight(lines);
    if (light) {
      return buildExperienceEntry({
        role: light.role || light.title,
        company: light.company,
        startDate: light.startDate,
        endDate: light.endDate,
        dates: light.dates,
        bullets: light.bullets,
        confidence: light.confidence,
      });
    }
    return null;
  }

  let company = '';
  let role = '';
  let dates = { startDate: '', endDate: '' };
  let description = '';
  const bullets = [];

  const freelanceBlob = lines.join(' ');
  if (FREELANCE_RE.test(freelanceBlob)) {
    const freelance = parseFreelanceCareerLine(lines[0]) || parseFreelanceCareerLine(freelanceBlob);
    if (freelance) {
      const extra = lines.slice(1).filter((l) => !CLIENT_LIST_RE.test(l) && !PAREN_CLIENT_RE.test(l));
      return buildExperienceEntry({
        role: freelance.role,
        company: freelance.company || 'Independent / Freelance',
        startDate: freelance.startDate,
        endDate: freelance.endDate,
        dates: freelance.dates,
        description: [freelance.bullets?.join(' '), ...extra].filter(Boolean).join(' '),
        bullets: [...(freelance.bullets || []), ...extra],
        confidence: 84,
      });
    }
  }

  if (isCompanyHeaderLine(lines[0]) && !isDateLine(lines[0])) {
    company = lines[0];
    if (lines[1] && looksLikeRoleLine(lines[1])) {
      role = lines[1];
      if (lines[2] && isDateLine(lines[2])) {
        dates = extractDatesFromLine(lines[2]);
        for (let i = 3; i < lines.length; i++) bullets.push(lines[i]);
      }
    } else if (lines[1] && isDateLine(lines[1])) {
      const combo = splitCompanyRoleCombo(lines[0]);
      company = combo.company || lines[0];
      role = combo.role;
      dates = extractDatesFromLine(lines[1]);
      for (let i = 2; i < lines.length; i++) bullets.push(lines[i]);
    }
  } else if (looksLikeRoleLine(lines[0]) && lines[1] && isDateLine(lines[1])) {
    role = lines[0];
    if (isCompanyHeaderLine(role)) {
      const combo = splitCompanyRoleCombo(role);
      company = combo.company;
      role = combo.role;
    }
    dates = extractDatesFromLine(lines[1]);
    for (let i = 2; i < lines.length; i++) bullets.push(lines[i]);
  } else if (isDateLine(lines[lines.length - 1])) {
    dates = extractDatesFromLine(lines[lines.length - 1]);
    const head = lines.slice(0, -1);
    if (head.length === 1) {
      const combo = splitCompanyRoleCombo(head[0]);
      company = combo.company;
      role = combo.role;
    } else if (head.length >= 2) {
      company = isCompanyHeaderLine(head[0]) ? head[0] : '';
      role = head.find((l) => looksLikeRoleLine(l)) || head[head.length - 1];
    }
  } else {
    const light = parseExperienceGroupLight(lines);
    if (light) {
      return buildExperienceEntry({
        role: light.role || light.title,
        company: light.company,
        startDate: light.startDate,
        endDate: light.endDate,
        dates: light.dates,
        bullets: light.bullets,
        confidence: light.confidence,
      });
    }
    const built = buildExperienceEntryFromLineGroup(lines);
    if (built) {
      const d = extractExperienceDateRange(lines.join('\n'));
      return buildExperienceEntry({
        role: built.role,
        company: built.company,
        startDate: d.startDate || built.startDate,
        endDate: d.endDate || built.endDate,
        dates: built.dates,
        bullets: built.bullets,
        confidence: built.confidence,
      });
    }
    return null;
  }

  if (bullets.length) description = bullets.join(' ');

  if (!role && company) {
    const combo = splitCompanyRoleCombo(company);
    company = combo.company || company;
    role = combo.role;
  }

  if (FREELANCE_RE.test([role, company, ...lines].join(' ')) && (!company || company.length < 2)) {
    company = 'Independent / Freelance';
  }

  if (!role && !company && !dates.startDate) return null;

  return buildExperienceEntry({
    role,
    company,
    startDate: dates.startDate,
    endDate: dates.endDate,
    description,
    bullets,
    confidence: role && company && dates.startDate ? 85 : dates.startDate ? 68 : 60,
  });
}

function groupStackedRows(rows) {
  const groups = [];
  let current = [];

  const flush = () => {
    if (current.length) groups.push([...current]);
    current = [];
  };

  for (const row of rows) {
    if (row.kind === 'clients-section' || CLIENT_LIST_RE.test(row.text) || PAREN_CLIENT_RE.test(row.text)) {
      flush();
      groups.push([row]);
      continue;
    }

    if (parseCompactOcrExperienceLine(row.text)) {
      flush();
      groups.push([row]);
      continue;
    }

    const isFreelanceLead =
      FREELANCE_RE.test(row.text) && (DATE_RANGE_RE.test(row.text) || /\b(19|20)\d{2}\b/.test(row.text));
    const isContinuation =
      current.length > 0 &&
      !isCompanyHeaderLine(row.text) &&
      !isDateLine(row.text) &&
      !isFreelanceLead &&
      row.text.length < 140;

    if (isContinuation) {
      current.push(row);
      continue;
    }

    if (isCompanyHeaderLine(row.text) && !isDateLine(row.text)) {
      flush();
      current = [row];
      continue;
    }

    if (isFreelanceLead) {
      flush();
      current = [row];
      continue;
    }

    flush();
    current = [row];
  }
  flush();
  return groups;
}

function buildReviewItemForLine(line, reason, confidence = 52) {
  return normalizeReviewItem({
    field: 'experiences',
    detectedType: 'experience',
    detected: line,
    sourceText: line,
    sourceLines: [line],
    confidence,
    reason: reason || 'Could not structure experience line',
    suggestion: 'Accept as experience, edit fields, or reclassify',
    status: 'pending',
    possibleCategories: ['experiences', 'clients', 'projects', 'unsorted'],
    requiresUserChoice: true,
  });
}

function attachClientsToExperiences(experiences, clients) {
  if (!clients.length || !experiences.length) return experiences;
  const out = experiences.map((e) => ({ ...e, clients: [...(e.clients || [])] }));

  const freelanceIdx = out.findIndex((e) => e.employmentKind === 'freelance' || FREELANCE_RE.test(e.role || ''));
  const targetIdx = freelanceIdx >= 0 ? freelanceIdx : 0;
  const merged = [...new Set([...(out[targetIdx].clients || []), ...clients])];
  out[targetIdx] = { ...out[targetIdx], clients: merged };
  if (!out[targetIdx].description && clients.length) {
    out[targetIdx].description = `Clients: ${clients.slice(0, 8).join(', ')}`;
  }
  return out;
}

function mergeExperienceLists(existing, recovered) {
  const out = [...(existing || [])];

  for (const candidate of recovered) {
    if (!candidate?.role && !candidate?.company && !candidate?.startDate) continue;

    const idx = out.findIndex((e) => normExpKey(e) === normExpKey(candidate));
    if (idx >= 0) {
      const cur = out[idx];
      out[idx] = {
        ...cur,
        role: cur.role || candidate.role,
        company: cur.company || candidate.company,
        startDate: cur.startDate || candidate.startDate,
        endDate: cur.endDate || candidate.endDate,
        dates: cur.dates || candidate.dates,
        description: cur.description || candidate.description,
        bullets: cur.bullets?.length ? cur.bullets : candidate.bullets,
        clients: [...new Set([...(cur.clients || []), ...(candidate.clients || [])])],
        confidence: Math.max(cur.confidence || 0, candidate.confidence || 0),
        reconstructionSource: EXPERIENCE_RECONSTRUCTION_ENGINE_V2,
      };
      continue;
    }

    const blocker = out.findIndex(
      (e) => normExpKey(e) !== normExpKey(candidate) && !mustNeverMergeExperiences(e, candidate)
    );
    if (blocker >= 0) {
      const cur = out[blocker];
      if ((candidate.confidence || 0) > (cur.confidence || 0)) out[blocker] = { ...cur, ...candidate };
      continue;
    }
    out.push(candidate);
  }

  return out.slice(0, EXPERIENCE_V2_MAX_ENTRIES);
}

/**
 * Recover maximum experiences from raw text. Unknown lines → review queue (never discard).
 * @param {string} rawText
 * @param {object} [opts]
 */
export function reconstructExperiencesFromRawText(rawText, opts = {}) {
  const text = String(rawText || '').trim();
  const harvested = harvestCareerLines(text);
  const groups = groupStackedRows(harvested);

  const experiences = [];
  const reviewQueue = [];
  const clients = [];
  const consumed = new Set();
  let clientLines = 0;

  for (const group of groups) {
    if (group.length === 1 && (CLIENT_LIST_RE.test(group[0].text) || PAREN_CLIENT_RE.test(group[0].text))) {
      const names = parseClientNames(group[0].text);
      clients.push(...names);
      consumed.add(group[0].index);
      clientLines++;
      continue;
    }

    const entry = parseStackedOcrBlock(group);
    if (entry && (entry.role || entry.company) && (entry.startDate || entry.dates)) {
      experiences.push(entry);
      for (const row of group) consumed.add(row.index);
      continue;
    }

    const compactRows = group
      .map((r) => parseCompactOcrExperienceLine(r.text))
      .filter(Boolean);
    if (compactRows.length) {
      experiences.push(...compactRows);
      for (const row of group) consumed.add(row.index);
      continue;
    }

    const inline = reconstructExperienceEntries(group.map((r) => r.text));
    if (inline.entries?.length) {
      for (const e of inline.entries) {
        experiences.push({
          ...e,
          reconstructionSource: EXPERIENCE_RECONSTRUCTION_ENGINE_V2,
        });
      }
      for (const row of group) consumed.add(row.index);
      continue;
    }

    for (const row of group) {
      if (consumed.has(row.index)) continue;
      if (lineLooksLikeCareerHistory(row.text) || isCompanyHeaderLine(row.text) || isDateLine(row.text)) {
        const item = buildReviewItemForLine(
          row.text,
          'Experience line could not be structured automatically',
          48
        );
        if (item) reviewQueue.push(item);
      }
      consumed.add(row.index);
    }
  }

  const mergedClients = [...new Set(clients)];
  const withClients = attachClientsToExperiences(experiences, mergedClients);

  const stats = {
    harvestedLines: harvested.length,
    groups: groups.length,
    recovered: withClients.length,
    queued: reviewQueue.length,
    clients: mergedClients.length,
    clientLines,
  };

  hirelyDebugLog('EXPERIENCE_RECONSTRUCTION_ENGINE_V2', stats);

  return {
    engine: EXPERIENCE_RECONSTRUCTION_ENGINE_V2,
    experiences: withClients,
    reviewQueue,
    clients: mergedClients,
    stats,
    consumedLineCount: consumed.size,
  };
}

/**
 * Apply V2 reconstruction to structured resume (merge, never discard).
 * @param {object} structured
 * @param {string} rawText
 * @param {object} [opts]
 */
export function runExperienceReconstructionV2(structured, rawText, opts = {}) {
  if (!structured || typeof structured !== 'object') {
    return { structured, recovered: [], reviewQueue: [], experienceCount: 0 };
  }

  const raw = String(rawText || structured?.metadata?.rawText || '').trim();
  const result = reconstructExperiencesFromRawText(raw, opts);
  const existing = structured.experiences || [];
  const merged = mergeExperienceLists(existing, result.experiences);

  structured.experiences = merged;
  structured.reviewQueue = mergeReviewQueues(structured.reviewQueue || [], result.reviewQueue);

  if (result.clients.length) {
    structured.clients = [...new Set([...(structured.clients || []), ...result.clients])];
  }

  const unconsumed = [];
  for (const item of result.reviewQueue) {
    if (item?.sourceText) unconsumed.push(item.sourceText);
  }

  structured.metadata = {
    ...(structured.metadata || {}),
    experienceReconstructionV2: {
      engine: EXPERIENCE_RECONSTRUCTION_ENGINE_V2,
      baseEngine: EXPERIENCE_RECONSTRUCTION_ENGINE,
      recoveredCount: result.experiences.length,
      totalExperiences: merged.length,
      reviewQueued: result.reviewQueue.length,
      clientsRecovered: result.clients.length,
      stats: result.stats,
      neverDiscard: true,
      forced: Boolean(opts.force),
    },
  };

  return {
    structured,
    recovered: result.experiences,
    reviewQueue: result.reviewQueue,
    clients: result.clients,
    experienceCount: merged.length,
    stats: result.stats,
  };
}

export {
  harvestCareerLines,
  parseStackedOcrBlock,
  parseCompactOcrExperienceLine,
  parseClientNames,
  buildReviewItemForLine,
};
