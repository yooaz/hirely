/**
 * structuredResume — built ONLY from DocumentBlock[] (never raw parseCV).
 */

import {
  emptyStructuredResume,
  parseExperienceString,
} from './structured-resume.js';
import { CLASSIFICATION_CONFIDENCE_THRESHOLD } from './document-block.js';
import { splitListItems } from './rich-parser.js';
import { isValidSummaryField, isValidEducationItem } from './field-sanitize.js';
import { lineLooksLikeRole } from '../../data/dictionaries/roleKeywords.js';
import { normalizeEmail, normalizePhone } from './line-cleaner.js';
import {
  harvestExperienceFromLines,
  structureEducationEntries,
  isBadTitleCandidate,
  consolidateExperiences,
  NAME_UNCERTAIN_LABEL,
  TITLE_UNCERTAIN_LABEL,
} from './parser-recovery.js';
import {
  extractLockedIdentity,
  isValidIdentityName,
  isValidIdentityTitle,
  IDENTITY_CONFIDENCE_MIN,
} from './identity-extraction.js';
import { ensureExperienceBlock } from './structured-resume.js';
import { coerceParserInputText } from '../pipeline/pipeline-contract.js';
import { HIRELY_FLOW_LOCK, isHirelyFlowLocked } from '../pipeline/hirely-flow-lock.js';
import { isLineCorruptedForExport } from './corruption-detector.js';
import { mustNeverBeExperience, hasEducationSchool } from './education-confidence.js';
import { passesExperienceGate } from './section-sanity.js';
import {
  isCreativeClientEntityLine,
  isCreativeJobLine,
  isCreativeNonExperienceLine,
} from './creative-parsing-mode.js';
import { documentBlocksToReviewItems } from './document-block.js';
import { normalizeReviewItem } from './review-queue.js';
import { mergeUnsortedLines, routeUnclassifiedBlocksToUnsorted } from './no-data-loss.js';
import { runSectionEngineV2 } from './section-engine-v2.js';
import { extractExperiencesFromSectionAnchors } from './section-anchor-extract.js';
import { logParserCoverageTable } from './parser-coverage-report.js';
import { runExperienceRebuilder } from './experience-rebuilder.js';
import { parseStrictExperiencesFromLines } from './experience-parser.js';
import { splitLinesBySectionAnchors } from './section-anchor-extract.js';
import { runExperienceRecovery, recoverSafeParsedExperiences } from './experience-recovery.js';
import { applyOcrExperienceSupplement } from './ocr-experience-merge.js';
import {
  mergeFragmentedExperienceBlocks,
  applyMergedExperiencesToStructured,
} from './experience-block-merge.js';
import { looksLikeOcrText } from './ocr-postprocess.js';
import { recoverSafeParsedEducation } from './education-recovery.js';
import { flattenStructuredPreservedText } from '../../debug/cv-preserved-text.js';
import {
  isLikelyFreelanceCareerLine,
  parseFreelanceCareerLine,
  parseInternshipLine,
  parseEducationLineWithContact,
  repairOcrYearTokens,
  isStrictSoftwareLine,
  isCreativeSkillPhrase,
} from './classification-fixes.js';

const URL_RE = /https?:\/\/[^\s]+/i;
const PORTFOLIO_HOST_RE = /\b(behance|dribbble|artstation|cargo|adobe\.com\/portfolio)\./i;

/**
 * @param {import('./document-block.js').DocumentBlock[]} documentBlocks
 * @param {object} opts
 */
export function buildStructuredResumeFromDocumentBlocks(documentBlocks = [], opts = {}) {
  return buildStructuredResumeFromBlocks(documentBlocks, opts);
}

/**
 * Locked path — SECTION_ENGINE_V2 only (blocks → classify → experience V2). No raw-line experience parse.
 * @param {object} sectionParse
 * @param {object} opts
 * @param {object[]} blocks
 */
function buildFlowLockedStructured(sectionParse, opts, blocks = []) {
  const structured = sectionParse.structured;
  const bridgeApplied = sectionParse.blockParserBridge?.applied === true;
  const raw = String(opts.rawText || opts.enterprise?.rawExtraction || '').trim();
  const cleaned = coerceParserInputText(
    opts.cleanedText || opts.enterprise?.cleanedText || raw,
    raw
  );
  const pdfMeta = opts.pdfExtraction || null;
  const headerLines = pdfMeta?.firstPageHeaderLines || opts.headerLines || [];

  for (const line of opts.rejectedLines || []) pushUnique(structured.unsorted, line);
  for (const line of opts.uncertainLines || []) pushUnique(structured.unsorted, line);

  const lowConf = (blocks || []).filter(
    (b) => b.needsReview || (b.confidence ?? 100) < CLASSIFICATION_CONFIDENCE_THRESHOLD
  );
  for (const block of lowConf) {
    lineTexts(block).forEach((line) => pushUnique(structured.unsorted, line));
  }
  structured.unsorted = mergeUnsortedLines(structured.unsorted || []);

  const allLines = cleaned.split('\n').map((l) => l.trim()).filter(Boolean);
  if (!bridgeApplied) {
    const locked = extractLockedIdentity(allLines, {
      identityLines: [],
      contactLines: [],
      headerLines,
      unsortedLines: structured.unsorted,
      toClassifyLines: opts.toClassifyLines || [],
      reviewQueueLines: structured.needsReview || [],
      skillsLines: structured.skills,
      interestsLines: structured.interests,
      toolsLines: structured.tools,
      fileName: opts.fileName || opts.file?.name || null,
      contact: {
        email: structured.identity?.email,
        phone: structured.identity?.phone,
      },
    });
    finalizeIdentity(structured, locked, raw, cleaned);
  }

  appendOcrStructuredLineRecovery(structured, allLines);

  structured.metadata = {
    ...(structured.metadata || {}),
    flowLock: HIRELY_FLOW_LOCK,
    parseSource: 'SECTION_ENGINE_V2+FLOW_LOCK',
    neverRawParseCv: true,
    neverRawExperienceParse: true,
    neverRawTemplateRender: true,
    pipelineVersion: 'flow-lock-v2',
    extractionMethod:
      opts.extractionMethod || opts.enterprise?.method || opts.enterprise?.metadata?.extractionMethod || 'paste',
    blockParserBridgeApplied: bridgeApplied,
  };

  if (!bridgeApplied && looksLikeOcrText(cleaned)) {
    applyOcrExperienceSupplement(structured, cleaned);
  }

  stripEducationLeakFromExperiences(structured);
  dedupeStructuredEducation(structured);

  const coverage = logParserCoverageTable(cleaned, structured);
  structured.metadata.parserCoverage = coverage;
  structured.metadata.parserOutputChars = flattenStructuredPreservedText(structured).length;
  return structured;
}

/**
 * @param {Array<{ type?: string, bucket?: string, text: string, confidence?: number, accepted?: boolean, needsReview?: boolean, lines?: object[] }>} blocks
 * @param {object} opts
 */
export function buildStructuredResumeFromBlocks(blocks = [], opts = {}) {
  const raw = String(opts.rawText || opts.enterprise?.rawExtraction || '').trim();
  const cleaned = coerceParserInputText(
    opts.cleanedText || opts.enterprise?.cleanedText || raw,
    raw
  );
  const blockMerge = mergeFragmentedExperienceBlocks(blocks, {
    minConfidence: opts.experienceMinConfidence,
    cleanedText: cleaned,
    minExpected: looksLikeOcrText(cleaned) ? 3 : 2,
  });
  blocks = blockMerge.blocks;
  const parseHelpers = opts.parseHelpers || {};
  const pdfMeta = opts.pdfExtraction || null;
  const headerLines = pdfMeta?.firstPageHeaderLines || opts.headerLines || [];

  const sectionParse = runSectionEngineV2(cleaned, {
    rawText: raw,
    headerLines,
    extractionMethod: opts.extractionMethod,
    fileName: opts.fileName || opts.file?.name || '',
    structureFirst:
      opts.structureFirst !== false ||
      (Array.isArray(opts.spatialBlocks) && opts.spatialBlocks.length >= 3) ||
      opts.enterprise?.metadata?.spatialParseInput === true,
    extractionLines: opts.extractionLines || opts.enterprise?.lines || opts.layoutMemory?.lines,
    layoutMemory: opts.layoutMemory || opts.enterprise?.metadata?.layoutMemory,
    spatialBlocks:
      opts.spatialBlocks ||
      opts.layoutMemory?.spatialBlocks ||
      opts.enterprise?.spatialBlocks ||
      opts.enterprise?.metadata?.spatialBlocks ||
      opts.enterprise?.metadata?.layoutMemory?.spatialBlocks ||
      null,
    layoutStage: opts.layoutStage || opts.enterprise?.metadata?.layoutStage,
    readingStage: opts.readingStage || opts.enterprise?.metadata?.readingStage,
    orderedLines: opts.orderedLines || opts.readingStage?.orderedLines,
    layoutType: opts.layoutType || opts.readingStage?.layoutType,
  });

  if (isHirelyFlowLocked()) {
    const locked = buildFlowLockedStructured(sectionParse, opts, blocks);
    if (blockMerge.mergedCount > 0) {
      applyMergedExperiencesToStructured(locked, blockMerge.experiences);
    }
    return locked;
  }

  const structured = sectionParse.structured;
  const creativeMode = sectionParse.creativeMode || opts.creativeMode || null;
  structured.extractionLines = [...(opts.extractionLines || opts.enterprise?.lines || [])];
  structured.pdfExtraction = pdfMeta;
  structured.metadata = {
    ...structured.metadata,
    ...(opts.enterprise?.metadata || {}),
    pipelineVersion: 'p0-layout',
    parseSource: 'SECTION_ENGINE_V2+p0_blocks',
    neverRawParseCv: true,
    neverRawFieldExtract: true,
    extractionMethod:
      opts.extractionMethod || opts.enterprise?.method || opts.enterprise?.metadata?.extractionMethod || 'paste',
    layoutType: opts.layoutType || null,
    documentBlockCount: blocks.length,
    creativeParsingMode: creativeMode?.active === true || opts.creativeMode?.active === true,
    creativeMode: creativeMode || opts.creativeMode || null,
    creativeCvMode: creativeMode?.active ? creativeMode : null,
  };

  const accepted = blocks.filter(
    (b) =>
      b.accepted !== false &&
      (b.confidence ?? 0) >= CLASSIFICATION_CONFIDENCE_THRESHOLD &&
      !b.needsReview
  );

  const identityLines = [];
  const contactLines = [];
  for (const block of accepted) {
    const type = block.type || block.bucket || 'unknown';
    const lines = lineTexts(block).filter((t) => !isLineCorruptedForExport(t));

    switch (type) {
      case 'identity':
        identityLines.push(...lines);
        ingestIdentityBlock(structured, lines, null);
        break;
      case 'contact':
        contactLines.push(...lines);
        ingestContactBlock(structured, lines, raw);
        break;
      case 'summary':
        ingestSummaryBlock(structured, lines);
        break;
      case 'experience':
        ingestExperienceBlock(
          structured,
          lines,
          creativeMode?.active === true || opts.creativeMode?.active === true,
          true
        );
        break;
      case 'education':
        ingestEducationBlock(structured, lines);
        break;
      case 'clients':
        lines.forEach((line) => pushUnique(structured.clients, line));
        splitListItems(block.text).forEach((item) => {
          if (!passesExperienceGate(item) && !mustNeverBeExperience(item)) {
            pushUnique(structured.clients, item);
          }
        });
        break;
      case 'skills':
        lines.forEach((line) => {
          splitListItems(line).forEach((item) => pushUnique(structured.skills, item));
        });
        break;
      case 'tools':
        lines.forEach((line) => {
          if (isLikelyFreelanceCareerLine(line)) {
            const exp = parseFreelanceCareerLine(line);
            if (exp) {
              structured.experiences.push({ ...exp, clients: [], location: '' });
              return;
            }
          }
          if (isCreativeSkillPhrase(line)) {
            splitListItems(line).forEach((item) => pushUnique(structured.skills, item));
            return;
          }
          if (isStrictSoftwareLine(line)) {
            splitListItems(line).forEach((item) => {
              if (isStrictSoftwareLine(item)) pushUnique(structured.tools, item);
            });
          }
        });
        break;
      case 'languages':
        lines.forEach((line) => {
          splitListItems(line).forEach((item) => pushUnique(structured.languages, item));
        });
        break;
      case 'portfolio':
        ingestPortfolioBlock(structured, lines);
        break;
      case 'projects':
        lines.forEach((line) => {
          if (!passesExperienceGate(line) || opts.creativeMode?.active) pushUnique(structured.projects, line);
          splitListItems(line).forEach((item) => {
            if (!passesExperienceGate(item) || opts.creativeMode?.active) {
              pushUnique(structured.projects, item);
            }
          });
        });
        break;
      case 'exhibitions':
        lines.forEach((line) => {
          pushUnique(structured.exhibitions, line);
          splitListItems(line).forEach((item) => pushUnique(structured.exhibitions, item));
        });
        break;
      case 'awards':
      case 'award':
        lines.forEach((line) => {
          pushUnique(structured.awards, line);
          splitListItems(line).forEach((item) => pushUnique(structured.awards, item));
        });
        break;
      case 'publications':
      case 'publication':
        lines.forEach((line) => {
          pushUnique(structured.publications, line);
          splitListItems(line).forEach((item) => pushUnique(structured.publications, item));
        });
        break;
      case 'interests':
        lines.forEach((line) => {
          splitListItems(line).forEach((item) => pushUnique(structured.interests, item));
        });
        break;
      default:
        if (block.sectionHint === 'interests') {
          lines.forEach((line) => {
            splitListItems(line).forEach((item) => pushUnique(structured.interests, item));
          });
        } else {
          lines.forEach((line) => pushUnique(structured.unsorted, line));
          splitListItems(block.text).forEach((item) => pushUnique(structured.unsorted, item));
        }
        break;
    }
  }

  const lowConf = blocks.filter(
    (b) => b.needsReview || (b.confidence ?? 100) < CLASSIFICATION_CONFIDENCE_THRESHOLD
  );
  for (const block of lowConf) {
    lineTexts(block).forEach((line) => pushUnique(structured.unsorted, line));
  }
  for (const line of opts.rejectedLines || []) pushUnique(structured.unsorted, line);
  for (const line of opts.uncertainLines || []) pushUnique(structured.unsorted, line);

  const reviewRaw = [...documentBlocksToReviewItems(blocks), ...(opts.extraReview || [])];
  const review = [];
  const seen = new Set();
  for (const item of reviewRaw) {
    const norm = normalizeReviewItem(item);
    if (!norm) continue;
    const key = `${norm.field}|${norm.detected?.slice(0, 80)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    review.push(norm);
  }
  structured.needsReview = review.slice(0, 32);
  structured.documentBlocks = blocks;
  structured.unsorted = mergeUnsortedLines(structured.unsorted);
  routeUnclassifiedBlocksToUnsorted(structured, blocks);

  const allLines = cleaned.split('\n').map((l) => l.trim()).filter(Boolean);
  const locked = extractLockedIdentity(allLines, {
    identityLines,
    contactLines,
    headerLines,
    unsortedLines: structured.unsorted,
    toClassifyLines: opts.toClassifyLines || [],
    reviewQueueLines: structured.needsReview,
    skillsLines: structured.skills,
    interestsLines: structured.interests,
    toolsLines: structured.tools,
    contact: {
      email: structured.identity.email,
      phone: structured.identity.phone,
    },
  });
  finalizeIdentity(structured, locked, raw, cleaned);

  for (const line of allLines) {
    const freelance = parseFreelanceCareerLine(line);
    if (freelance) {
      const key = `${freelance.role}|${freelance.company}|${freelance.startDate}`.toLowerCase();
      if (
        !structured.experiences.some(
          (e) => `${e.role}|${e.company}|${e.startDate}`.toLowerCase() === key
        )
      ) {
        structured.experiences.push({ ...freelance, clients: [], location: '' });
      }
    }
    const internship = parseInternshipLine(line, { nearbyLines: allLines });
    if (internship) {
      const key = `${internship.role}|${internship.company}|${internship.startDate}`.toLowerCase();
      if (
        !structured.experiences.some(
          (e) => `${e.role}|${e.company}|${e.startDate}`.toLowerCase() === key
        )
      ) {
        structured.experiences.push({ ...internship, clients: [], location: '' });
      }
    }
    const eduParsed = parseEducationLineWithContact(line);
    if (eduParsed?.phone && !structured.identity.phone) structured.identity.phone = eduParsed.phone;
    if (eduParsed?.education && isValidEducationItem(eduParsed.education)) {
      pushUnique(structured.education, eduParsed.education);
    }
  }

  const sections = splitLinesBySectionAnchors(allLines);
  const strict = parseStrictExperiencesFromLines(allLines, {
    experienceSectionLines: sections.experience?.length ? sections.experience : allLines,
  });
  for (const exp of strict.experiences) {
    const key = `${exp.role}|${exp.company}|${exp.startDate}`.toLowerCase();
    if (
      !structured.experiences.some(
        (e) => `${e.role}|${e.company}|${e.startDate}`.toLowerCase() === key
      )
    ) {
      structured.experiences.push(exp);
    }
  }
  if (!structured.experiences.length) {
    const anchored = extractExperiencesFromSectionAnchors(allLines, cleaned);
    if (anchored.length) structured.experiences = anchored;
  }
  strict.unclassified.forEach((line) => pushUnique(structured.unsorted, line));
  recoverSafeParsedExperiences(structured, { lines: allLines, nearbyLines: allLines });
  recoverSafeParsedEducation(structured, { lines: allLines, nearbyLines: allLines });
  const expRebuild = runExperienceRebuilder(structured, cleaned);
  if (!expRebuild.rebuilt && !structured.experiences.length) runExperienceRecovery(structured, cleaned);
  if (looksLikeOcrText(cleaned)) {
    const ocrSupplement = applyOcrExperienceSupplement(structured, cleaned);
    structured = ocrSupplement.structured;
  }
  ensureExperienceBlock(structured, cleaned, allLines);

  stripEducationLeakFromExperiences(structured);
  dedupeStructuredEducation(structured);

  const coverage = logParserCoverageTable(cleaned, structured);
  structured.metadata.parserCoverage = coverage;
  structured.metadata.parserOutputChars = flattenStructuredPreservedText(structured).length;

  return structured;
}

function experienceBlob(exp) {
  if (typeof exp === 'string') return exp;
  return [exp.role, exp.company, exp.title, exp.description, exp.location]
    .filter(Boolean)
    .join(' ');
}

function stripEducationLeakFromExperiences(structured) {
  if (!structured?.experiences?.length) return;
  structured.experiences = structured.experiences.filter((exp) => {
    const blob = experienceBlob(exp);
    if (!blob) return true;
    return !mustNeverBeExperience(blob) && !hasEducationSchool(blob);
  });
}

function dedupeStructuredEducation(structured) {
  if (!structured?.education?.length) return;
  const seen = new Set();
  structured.education = structured.education.filter((row) => {
    const key = String(row || '').trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function lineTexts(block) {
  if (block.lines?.length) {
    return block.lines
      .map((l) => String(l.cleanedText ?? l.text ?? '').trim())
      .filter(Boolean);
  }
  return String(block.text || '')
    .split('\n')
    .map((t) => t.trim())
    .filter(Boolean);
}

function pushUnique(arr, val) {
  const t = String(val || '').trim();
  if (!t || t.length < 2) return;
  const k = t.toLowerCase();
  if (arr.some((x) => String(x).toLowerCase() === k)) return;
  arr.push(t);
}

function isInterestOrSkillListLine(line) {
  const l = String(line || '').trim();
  if (!l) return true;
  if (isBadTitleCandidate(l)) return true;
  if (/[,;·]/.test(l) && l.split(/[,;·]/).filter((x) => x.trim().length > 1).length >= 3) {
    return true;
  }
  if (SKILL_LIST_LINE_RE.test(l) && !lineLooksLikeRole(l)) return true;
  return false;
}

const SKILL_LIST_LINE_RE =
  /\b(print|logo|vector|illustration|reading|music|nature|drawing|movies?|graphic design)\b/i;

function ingestIdentityBlock(structured, lines, _nameResult) {
  for (const line of lines) {
    if (isInterestOrSkillListLine(line)) {
      splitListItems(line).forEach((item) => pushUnique(structured.interests, item));
      pushUnique(structured.unsorted, line);
      continue;
    }
    if (!structured.identity.name && isValidIdentityName(line)) {
      structured.identity.name = line;
    } else if (!structured.identity.title && isValidIdentityTitle(line)) {
      structured.identity.title = line;
    } else if (!isValidIdentityName(line) && !isValidIdentityTitle(line)) {
      pushUnique(structured.unsorted, line);
    }
  }
}

function ingestContactBlock(structured, lines, raw) {
  const blob = [...lines, raw].join('\n');
  if (!structured.identity.email) structured.identity.email = normalizeEmail(blob);
  if (!structured.identity.phone) structured.identity.phone = normalizePhone(blob);
  for (const line of lines) {
    if (/linkedin\.com/i.test(line)) structured.identity.linkedin = line;
    else if (URL_RE.test(line) && !/linkedin/i.test(line)) {
      structured.identity.website = line.match(URL_RE)?.[0] || line;
    }
  }
}

function ingestSummaryBlock(structured, lines) {
  const text = lines.join('\n').trim();
  if (isValidSummaryField(text)) structured.summary = text;
}

function ingestExperienceBlock(structured, lines, creativeMode = false, permissive = false) {
  void creativeMode;
  void permissive;
  const strict = parseStrictExperiencesFromLines(lines, { experienceSectionLines: lines });
  for (const exp of strict.experiences) {
    const key = `${exp.role}|${exp.company}|${exp.startDate}`.toLowerCase();
    if (!structured.experiences.some((e) => `${e.role}|${e.company}|${e.startDate}`.toLowerCase() === key)) {
      structured.experiences.push(exp);
    }
  }
  strict.unclassified.forEach((line) => pushUnique(structured.unsorted, line));
}

function ingestEducationBlock(structured, lines) {
  const safe = lines.filter((l) => mustNeverBeExperience(l) || !passesExperienceGate(l));
  const bridgeLocked = structured.metadata?.blockParserBridgeApplied === true;
  for (const line of safe) {
    const parsed = parseEducationLineWithContact(line);
    if (parsed?.phone && !structured.identity.phone) structured.identity.phone = parsed.phone;
    if (parsed?.email && !structured.identity.email) structured.identity.email = parsed.email;
    if (parsed?.education && isValidEducationItem(parsed.education)) {
      pushUnique(structured.education, parsed.education);
      continue;
    }
    if (isValidEducationItem(line)) pushUnique(structured.education, line);
  }
  // structureEducationEntries expands single lines into duplicates — skip when bridge SSOT is active.
  if (bridgeLocked) return;
  const entries = structureEducationEntries(safe);
  for (const e of entries) {
    const t = typeof e === 'string' ? e : e?.text || e?.school || '';
    if (isValidEducationItem(t)) pushUnique(structured.education, t);
  }
}

function ingestPortfolioBlock(structured, lines) {
  for (const line of lines) {
    if (URL_RE.test(line) || PORTFOLIO_HOST_RE.test(line)) {
      const url = line.match(URL_RE)?.[0] || line;
      pushUnique(structured.portfolioLinks, url);
      if (!structured.identity.website) structured.identity.website = url;
    } else {
      pushUnique(structured.projects, line);
    }
  }
}

function appendOcrStructuredLineRecovery(structured, allLines) {
  for (const rawLine of allLines) {
    const line = repairOcrYearTokens(
      String(rawLine || '')
        .replace(/^\+?\d[\d\s().-]{8,}\d\s+/, '')
        .trim()
    );
    const freelance = parseFreelanceCareerLine(line);
    if (freelance) {
      const key = `${freelance.role}|${freelance.company}|${freelance.startDate}`.toLowerCase();
      if (
        !structured.experiences.some(
          (e) => `${e.role}|${e.company}|${e.startDate}`.toLowerCase() === key
        )
      ) {
        structured.experiences.push({ ...freelance, clients: [], location: '' });
      }
    }
    const intern = parseInternshipLine(line);
    if (intern) {
      const key = `${intern.role}|${intern.company}|${intern.startDate}`.toLowerCase();
      if (
        !structured.experiences.some(
          (e) => `${e.role}|${e.company}|${e.startDate}`.toLowerCase() === key
        )
      ) {
        structured.experiences.push({ ...intern, clients: [], location: '' });
      }
    }
    const eduParsed = parseEducationLineWithContact(line);
    if (eduParsed?.phone && !structured.identity.phone) structured.identity.phone = eduParsed.phone;
    if (eduParsed?.education && isValidEducationItem(eduParsed.education)) {
      pushUnique(structured.education, eduParsed.education);
    }
  }
}

function finalizeIdentity(structured, locked, raw, cleaned) {
  const name = locked.name && locked.nameConfidence >= IDENTITY_CONFIDENCE_MIN ? locked.name : '';
  const title = locked.title && locked.titleConfidence >= IDENTITY_CONFIDENCE_MIN ? locked.title : '';

  structured.identity.name = name || NAME_UNCERTAIN_LABEL;
  structured.identity.title = title || TITLE_UNCERTAIN_LABEL;
  structured.nameCandidates = (locked.nameCandidates || []).filter((c) => isValidIdentityName(c));
  structured.titleCandidates = (locked.titleCandidates || []).filter((c) => isValidIdentityTitle(c));
  structured.selectedName = name;
  structured.selectedTitle = title;
  structured.nameConfidence = name ? locked.nameConfidence : 0;
  structured.titleConfidence = title ? locked.titleConfidence : 0;
  structured.identitySources = {
    name: locked.nameSource,
    title: locked.titleSource,
  };

  if (!structured.identity.email) structured.identity.email = normalizeEmail(raw);
  if (!structured.identity.phone) structured.identity.phone = normalizePhone(raw);
}
