/**
 * structuredResume schema — canonical render model for templates.
 */

import { CLIENT_COMPANY_KEYWORDS } from '../../data/dictionaries/clientCompanyKeywords.js';
import { TOOLS } from '../../data/dictionaries/tools.js';
import { lineLooksLikeRole } from '../../data/dictionaries/roleKeywords.js';

const LOCATION_IN_ROLE =
  /\b(Paris|London|New York|San Francisco|Berlin|Amsterdam|Remote|Chicago|Boston|Seattle|Toronto|Singapore)\b/i;
import {
  stripContactFromProse,
  isValidSummaryField,
  isValidExperienceLine,
  isValidListItem,
  isValidEducationItem,
  sanitizeSummaryText,
  segregateClientBrands,
  EMAIL_RE,
  PHONE_RE,
} from './field-sanitize.js';
import { hasExperienceDate } from './section-sanity.js';
import {
  isLikelyGarbageLine,
  isLikelyInterest,
  isLikelyTool,
  isLikelyLanguage,
  isLanguageProficiencyLine,
  normalizeEmail,
  normalizePhone,
} from './line-cleaner.js';
import { extractDateRangeFromText } from './parser-recovery.js';
import {
  consolidateExperiences,
  detectTitleFromText,
  harvestEducation,
  structureEducationEntries,
  harvestExperienceFromLines,
  partitionSkillsAndInterests,
  isBadTitleCandidate,
  sanitizeEducationLine,
  NAME_UNCERTAIN_LABEL,
  NAME_CANDIDATE_SEP,
  TITLE_UNCERTAIN_LABEL,
} from './parser-recovery.js';
import {
  extractExperiencesFromSectionAnchors,
  extractEducationFromSectionAnchors,
  extractSkillsFromSectionAnchors,
  resolveCreativeProfessionalTitle,
} from './section-anchor-extract.js';
import {
  extractLockedIdentity,
  isValidIdentityName,
  isValidIdentityTitle,
  IDENTITY_CONFIDENCE_MIN,
} from './identity-extraction.js';
import { slimStructuredResume } from '../pipeline/pipeline-contract.js';
import { runResumeGraphEngine } from './resume-graph-engine.js';
import { simpleCvDataFromStructured } from './simple-cv-mapper.js';
import { isHirelyFlowLocked } from '../pipeline/hirely-flow-lock.js';
import {
  experienceEntryToLegacyString,
  PARSER_ENTERPRISE_THRESHOLD,
} from './parser-enterprise.js';
import { isLineCorruptedForExport } from './corruption-detector.js';

export { NAME_UNCERTAIN_LABEL };

export function emptyStructuredResume() {
  return {
    identity: {
      name: '',
      title: '',
      email: '',
      phone: '',
      location: '',
      website: '',
      linkedin: '',
    },
    summary: '',
    experiences: [],
    education: [],
    clients: [],
    awards: [],
    exhibitions: [],
    publications: [],
    portfolioLinks: [],
    skills: [],
    tools: [],
    languages: [],
    interests: [],
    needsReview: [],
    projects: [],
    unsorted: [],
    sectionConfidence: {},
    nameCandidates: [],
    titleCandidates: [],
    selectedName: '',
    selectedTitle: '',
    nameConfidence: 0,
    titleConfidence: 0,
    pdfExtraction: null,
    metadata: {},
    rawExtraction: '',
    extractionLines: [],
  };
}

export function parseExperienceString(entry) {
  const s = String(entry || '').trim();
  if (!s) return null;
  const dateM = s.match(/\b((?:19|20)\d{2}\s*[-–—]\s*(?:present|présent|current|now|aujourd'?hui|\d{4}))\b/i);
  const dates = dateM ? dateM[1].replace(/\s+/g, ' ').trim() : '';
  let rest = dates ? s.replace(dates, '').trim() : s;
  const parts = rest.split(/\s*[-–—|@]\s*/).map((p) => p.trim()).filter(Boolean);
  const role = parts[0] || rest;
  const company = parts.length > 1 ? parts.slice(1).join(' — ') : '';
  const bulletM = s.match(/:\s*(.+)$/);
  const bullets = bulletM
    ? bulletM[1]
        .split(/\s*·\s*|\s*;\s*/)
        .map((b) => b.trim())
        .filter((b) => b.length > 8)
    : [];
  const dateParts = dates.split(/[-–—]/).map((p) => p.trim());
  return {
    role,
    company,
    location: '',
    startDate: dateParts[0] || '',
    endDate: dateParts[1] || '',
    bullets,
    clients: [],
  };
}

function splitCategories(cv) {
  const skills = [];
  const tools = [];
  const languages = [];
  const interests = [];
  const clients = new Set((cv.clients || []).map((c) => c.trim()).filter(Boolean));

  const pushUnique = (arr, val) => {
    const t = String(val || '').trim();
    if (!t) return;
    const k = t.toLowerCase();
    if (arr.some((x) => x.toLowerCase() === k)) return;
    arr.push(t);
  };

  (cv.interests || []).forEach((item) => {
    const t = String(item || '').trim();
    if (t) pushUnique(interests, t);
  });

  (cv.skills || []).forEach((item) => {
    const t = String(item || '').trim();
    if (!t) return;
    if (CLIENT_COMPANY_KEYWORDS.some((c) => c.toLowerCase() === t.toLowerCase())) {
      clients.add(t);
      return;
    }
    if (TOOLS.some((tool) => tool.toLowerCase() === t.toLowerCase()) || isLikelyTool(t)) {
      pushUnique(tools, t);
      return;
    }
    if (isLikelyLanguage(t)) {
      pushUnique(languages, t);
      return;
    }
    if (isLikelyInterest(t)) {
      pushUnique(interests, t);
      return;
    }
    if (isValidListItem(t)) pushUnique(skills, t);
  });

  (cv.tools || []).forEach((t) => pushUnique(tools, t));
  (cv.languages || []).forEach((t) => pushUnique(languages, t));

  return { skills, tools, languages, interests, clients: [...clients] };
}

export function ensureExperienceBlock(structured, cleanedText, allLines = []) {
  if (structured.experiences.length) return structured;

  const blob = String(cleanedText || '');
  const dates = extractDateRangeFromText(blob);
  const hasCareer = lineLooksLikeRole(blob) || dates.startDate || structured.identity.title;

  if (hasCareer) {
    const harvested = harvestExperienceFromLines(allLines.length ? allLines : blob.split('\n'), {});
    for (const text of harvested) {
      const parsed = parseExperienceString(text);
      if (parsed) structured.experiences.push(parsed);
    }
    if (!structured.experiences.length) {
      structured.needsReview.push({
        field: 'experiences',
        detected: 'Career signals in document',
        suggestion: 'Add or confirm experience entries',
        reason: 'Experience inferred from career keywords — verify dates and role',
        action: 'edit',
      });
    }
  }

  return structured;
}

function collectNeedsReview(structured, rejectedLines, rawText, nameResult, uncertainLines = []) {
  const review = [...(structured.needsReview || [])];

  uncertainLines.slice(0, 8).forEach((line) => {
    const t = String(line || '').trim();
    if (!t) return;
    review.push({
      field: 'raw',
      detected: t.slice(0, 80),
      suggestion: 'Verify this line',
      reason: 'Uncertain after safe clean — kept in text',
      action: 'review',
    });
  });

  if (nameResult?.uncertain && nameResult.candidates?.length) {
    review.push({
      field: 'identity.name',
      detected: nameResult.candidates.join(' · '),
      suggestion: 'Check your name',
      reason: 'More than one possible name at the top',
      action: 'edit',
    });
  }

  rejectedLines.slice(0, 8).forEach((line) => {
    const t = String(line || '').trim();
    if (!t || /^\+?\d[\d\s().-]{7,}\d$/.test(t) || /@/.test(t)) return;
    if (isLikelyGarbageLine(t)) {
      review.push({
        field: 'raw',
        detected: t.slice(0, 80),
        suggestion: 'Remove line',
        reason: 'Possible scan or paste error',
        action: 'ignore',
      });
    }
  });

  if (!structured.experiences.length && lineLooksLikeRole(rawText)) {
    review.push({
      field: 'experiences',
      detected: 'Roles found in text',
      suggestion: 'Add experience',
      reason: 'Could not structure job history',
      action: 'edit',
    });
  }

  return review.slice(0, 12);
}

/**
 * Build structuredResume from legacy cvData + optional rejected lines.
 */
export function buildStructuredResume(cvData, opts = {}) {
  const raw = opts.rawText || '';
  const cleaned = opts.cleanedText || '';
  const rejected = opts.rejectedLines || [];
  const uncertain = opts.uncertainLines || [];
  const parseHelpers = opts.parseHelpers || {};
  const base = segregateClientBrands(cvData || {});
  const cats = splitCategories(base);
  const structured = emptyStructuredResume();
  const allLines = (cleaned || raw).split('\n').filter(Boolean);

  const pdfMeta = opts.pdfExtraction || null;
  const headerLines = pdfMeta?.firstPageHeaderLines || opts.headerLines || [];

  const locked = extractLockedIdentity(allLines, {
    headerLines,
    contact: {
      email: normalizeEmail(base.email || raw),
      phone: normalizePhone(base.phone || raw),
    },
    unsortedLines: base.unsorted || [],
    toClassifyLines: base.toClassify || [],
    skillsLines: base.skills || [],
    interestsLines: base.interests || [],
    toolsLines: base.tools || [],
  });

  const displayName =
    locked.name && locked.nameConfidence >= IDENTITY_CONFIDENCE_MIN ? locked.name : '';
  const displayTitle =
    locked.title && locked.titleConfidence >= IDENTITY_CONFIDENCE_MIN ? locked.title : '';

  structured.nameCandidates = (locked.nameCandidates || []).filter((c) => isValidIdentityName(c));
  structured.selectedName = displayName;
  structured.nameConfidence = displayName ? locked.nameConfidence : 0;
  structured.pdfExtraction = pdfMeta;
  structured.rawExtraction = String(opts.rawText || opts.enterprise?.rawExtraction || raw || '').trim();
  structured.extractionLines = [...(opts.extractionLines || opts.enterprise?.lines || [])];
  const creativeMode = opts.creativeMode || base._creativeMode || opts.enterprise?.creativeMode;
  structured.metadata = {
    ...(opts.enterprise?.metadata || {}),
    extractionMethod:
      opts.extractionMethod || opts.enterprise?.method || opts.enterprise?.metadata?.extractionMethod || 'paste',
    rawExtraction: structured.rawExtraction,
    cleanedText: cleaned,
    engine: 'hirely-enterprise-v1',
    creativeParsingMode: creativeMode?.active === true || creativeMode === true,
    creativeMode: creativeMode || null,
  };
  structured.identity = {
    name: displayName,
    title: isValidIdentityTitle(String(base.title || '').trim()) ? String(base.title || '').trim() : displayTitle,
    email: normalizeEmail(base.email || raw),
    phone: normalizePhone(base.phone || raw),
    location: String(base.location || '').trim(),
    website: String(base.portfolio || '').trim(),
    linkedin: String(base.linkedin || '').trim(),
  };
  if (!isValidIdentityTitle(structured.identity.title)) {
    structured.identity.title = displayTitle;
  }
  structured.identitySources = {
    name: locked.nameSource,
    title: locked.titleSource,
  };

  structured.titleCandidates = (locked.titleCandidates || []).filter((c) => isValidIdentityTitle(c));
  structured.titleConfidence = structured.identity.title ? locked.titleConfidence : 0;
  structured.selectedTitle = structured.identity.title || '';

  structured.summary = sanitizeSummaryText(base.summary, {
    email: structured.identity.email,
    phone: structured.identity.phone,
  });

  const enterprise = base._enterprise || opts.enterprise || null;
  structured.parserEnterprise = enterprise;
  structured.metadata = {
    ...(structured.metadata || {}),
    parserEngine: enterprise?.engine || structured.metadata?.engine || 'hirely-parser-v1',
    parserThreshold: enterprise?.threshold ?? PARSER_ENTERPRISE_THRESHOLD,
  };

  if (enterprise?.experiences?.length) {
    structured.experiences = enterprise.experiences.map((e) => ({
      role: e.title,
      company: e.company,
      location: '',
      startDate: e.startDate,
      endDate: e.endDate,
      bullets: e.bullets || [],
      clients: [],
      confidence: e.confidence,
      sourceLines: e.sourceLines || [],
    }));
  } else {
    structured.experiences = (base.experience || [])
      .map(parseExperienceString)
      .filter(Boolean)
      .filter((e) =>
        isValidExperienceLine([e.role, e.company, ...e.bullets].filter(Boolean).join(' — '))
      );
  }

  const seenExp = new Set();
  structured.experiences = structured.experiences.filter((e) => {
    const role = String(e.role || '').trim();
    const key = `${role}|${e.company}`.toLowerCase();
    if (seenExp.has(key)) return false;
    seenExp.add(key);
    if (role.length < 8 && !(e.bullets?.length) && !e.startDate) return false;
    if (role.length < 4 || isLikelyGarbageLine(role)) return false;
    if (/^https?:|github\.com|www\./i.test(role)) return false;
    if (LOCATION_IN_ROLE.test(role) && !lineLooksLikeRole(role)) return false;
    if (EMAIL_RE.test(role) || (PHONE_RE.test(role) && !hasExperienceDate(role))) return false;
    if (role.length > 100 && !lineLooksLikeRole(role)) return false;
    return true;
  });

  const eduRaw = enterprise?.education?.length
    ? enterprise.education.map((e) => e.text)
    : [
        ...new Set([
          ...(base.education || []).map((e) => sanitizeEducationLine(e)).filter(Boolean),
          ...harvestEducation(allLines, base.education || [], parseHelpers),
        ]),
      ];
  structured.education = structureEducationEntries(
    eduRaw.filter((e) => isValidEducationItem(e) && !isLikelyTool(e) && !isLanguageProficiencyLine(e))
  ).slice(0, 6);

  if (enterprise?.skills?.length) structured.skills = enterprise.skills.map((e) => e.text);
  if (enterprise?.tools?.length) structured.tools = enterprise.tools.map((e) => e.text);
  if (enterprise?.languages?.length) structured.languages = enterprise.languages.map((e) => e.text);
  if (enterprise?.clients?.length) structured.clients = enterprise.clients.map((e) => e.text);
  if (enterprise?.awards?.length) {
    structured.awards = enterprise.awards.map((e) => (typeof e === 'string' ? e : e.text)).filter(Boolean);
  }
  if (enterprise?.exhibitions?.length) {
    structured.exhibitions = enterprise.exhibitions
      .map((e) => (typeof e === 'string' ? e : e.text))
      .filter(Boolean);
  }
  if (enterprise?.publications?.length) {
    structured.publications = enterprise.publications
      .map((e) => (typeof e === 'string' ? e : e.text))
      .filter(Boolean);
  }
  if (enterprise?.portfolioLinks?.length) {
    structured.portfolioLinks = enterprise.portfolioLinks
      .map((e) => (typeof e === 'string' ? e : e.text))
      .filter(Boolean);
  }
  if (!structured.awards?.length) structured.awards = base.awards || [];
  if (!structured.exhibitions?.length) structured.exhibitions = base.exhibitions || [];
  if (!structured.publications?.length) structured.publications = base.publications || [];
  if (!structured.portfolioLinks?.length) {
    structured.portfolioLinks = base.portfolioLinks || [];
  }

  if (!structured.skills?.length) structured.skills = cats.skills;
  if (!structured.tools?.length) structured.tools = cats.tools;
  if (!structured.languages?.length) structured.languages = cats.languages;
  structured.clients = structured.clients?.length ? structured.clients : cats.clients;
  const entInterests = (enterprise?.interests || [])
    .map((e) => (typeof e === 'string' ? e : e?.text || ''))
    .map((t) => String(t || '').trim())
    .filter(Boolean);
  structured.interests = [...new Set([...cats.interests, ...entInterests])].slice(0, 8);
  const entProjects = (enterprise?.projects || [])
    .map((e) => (typeof e === 'string' ? e : e?.text || ''))
    .map((t) => String(t || '').trim())
    .filter(Boolean);
  structured.projects = [...new Set([...entProjects, ...(base.projects || [])])].slice(0, 12);
  structured.unsorted = [...new Set(base.unsorted || [])].slice(0, 96);
  structured.sectionConfidence = base.sectionConfidence || {};

  if (!enterprise?.experiences?.length) {
    structured.experiences = consolidateExperiences(
      structured.experiences,
      cleaned,
      structured.identity
    );
  }

  const part = partitionSkillsAndInterests(structured.skills);
  structured.skills = part.skills;
  structured.interests = [...new Set([...structured.interests, ...part.interests])];

  ensureExperienceBlock(structured, cleaned, allLines);
  if (!structured.experiences.length) {
    const anchored = extractExperiencesFromSectionAnchors(allLines, cleaned || raw);
    if (anchored.length) structured.experiences = anchored;
  }
  if (!structured.education?.length) {
    const edu = extractEducationFromSectionAnchors(allLines);
    if (edu.length) structured.education = edu;
  }
  const skillBlock = extractSkillsFromSectionAnchors(allLines);
  if (!structured.skills?.length && skillBlock.skills.length) {
    structured.skills = skillBlock.skills;
  }
  if (!structured.tools?.length && skillBlock.tools.length) {
    structured.tools = skillBlock.tools;
  }
  if (!structured.experiences.length && /\b(work experience|freelanc|mccann)\b/i.test(cleaned || raw)) {
    const careerLines = allLines.filter(
      (l) =>
        /\b(freelanc|mccann|graphic designer|illustrator|internship|agency)\b/i.test(l) ||
        /\b(19|20)\d{2}\s*[-–—]/.test(l)
    );
    structured.unsorted = [...new Set([...(structured.unsorted || []), ...careerLines])].slice(0, 96);
  }
  const titleUncertain =
    !structured.identity.title ||
    structured.identity.title === TITLE_UNCERTAIN_LABEL ||
    !isValidIdentityTitle(structured.identity.title) ||
    isBadTitleCandidate(structured.identity.title);
  if (titleUncertain) {
    const creativeTitle = resolveCreativeProfessionalTitle(
      allLines,
      cleaned || raw || structured.rawExtraction
    );
    if (creativeTitle && isValidIdentityTitle(creativeTitle)) {
      structured.identity.title = creativeTitle;
      structured.selectedTitle = creativeTitle;
      structured.titleConfidence = Math.max(structured.titleConfidence || 0, 78);
    }
  }
  const extractionReview = [...(base._extractionReview || []), ...(opts.extractionReview || [])];
  const parserReview = [...(base._parserReview || []), ...(enterprise?.needsReview || [])];
  structured.needsReview = [
    ...collectNeedsReview(structured, rejected, raw, nameResult, uncertain),
    ...extractionReview,
    ...parserReview,
  ].slice(0, 32);

  return structured;
}

/** Map structuredResume → legacy cvData. Product mode uses direct mapper (no graph). */
export function structuredToCvData(structured) {
  const src = structured || emptyStructuredResume();
  const useGraph =
    !isHirelyFlowLocked() &&
    typeof globalThis !== 'undefined' &&
    globalThis.HIRELY_USE_GRAPH_ENGINE === true;
  if (useGraph) {
    return runResumeGraphEngine(src).resumeJson;
  }
  return simpleCvDataFromStructured(src);
}

function identityNameResolved(name) {
  const n = String(name || '').trim();
  if (!n || n === NAME_UNCERTAIN_LABEL) return false;
  if (n.includes(NAME_CANDIDATE_SEP)) return false;
  return true;
}

export function buildConfidenceReport(structured, audit, rejectedCount = 0) {
  const nameOk = identityNameResolved(structured?.identity?.name);
  const filled = [
    nameOk,
    structured?.identity?.title,
    structured?.identity?.email || structured?.identity?.phone,
    structured?.summary,
    (structured?.experiences || []).length,
    (structured?.skills || []).length,
  ].filter(Boolean).length;
  return {
    overall: Math.min(92, 35 + filled * 9 - Math.min(20, rejectedCount)),
    sections: {
      identity: !!(nameOk && structured?.identity?.title),
      experience: (structured?.experiences || []).length > 0,
      clients: (structured?.clients || []).length > 0,
      education: (structured?.education || []).length > 0,
    },
    warnings: audit?.warnings || [],
    rejectedLinesCount: rejectedCount,
  };
}
