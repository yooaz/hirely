/**
 * CV_BLOCK_PARSER_BRIDGE — maps detectSectionBlocks bundle → structured resume (production SSOT).
 *
 * When spatial blocks + V2 block parsers are available, this replaces legacy flat-text
 * experience reconstruction. Low-confidence items are dropped (not emitted).
 */

import { CV_SECTION } from './section-heading-dictionary.js';
import { isSkillsSectionPollution } from './skills-section-pollution-filter.js';
import { isValidEducationItem, isValidSummaryField, isOcrGarbageText } from './field-sanitize.js';
import { dedupeEducationStrings } from './dedupe-engine.js';
import { SKILL_CATEGORY } from './cv-skills-block-parser.js';
import { extractContactFromParseContext, mergeContactForBridge } from './cv-parse-confidence.js';

export const CV_BLOCK_PARSER_BRIDGE = 'CV_BLOCK_PARSER_BRIDGE_V1';

const MIN_BRIDGE_GLOBAL_CONFIDENCE = 0.55;

/**
 * @param {object} detection — detectSectionBlocks output
 * @param {object[]} spatialBlocks
 * @param {object} [opts]
 */
export function shouldUseBlockParserBridge(detection, spatialBlocks = [], opts = {}) {
  if (opts.structureFirst === false) return false;
  const spatial = (spatialBlocks || []).length >= 3;
  const hasItems =
    (detection?.experienceItems?.length || 0) > 0 ||
    (detection?.educationItems?.length || 0) > 0 ||
    (detection?.skillItems?.length || 0) > 0;
  const hasSegments = (detection?.sectionSegmentation?.segments || []).length > 0;
  return spatial && hasItems && hasSegments;
}

/**
 * @param {object} item
 */
export function experienceItemToStructured(item) {
  const clients = [...(item.client || item.clients || [])].filter(Boolean);
  const start = String(item.start_date || '').trim();
  const end = String(item.end_date || '').trim();
  const dates =
    start && end ? `${start} – ${end}` : start || end || '';
  return {
    role: String(item.job_title || '').trim(),
    company: String(item.company || '').trim(),
    location: String(item.location || '').trim(),
    startDate: start,
    endDate: end,
    dates,
    bullets: Array.isArray(item.description)
      ? item.description.map((b) => String(b || '').trim()).filter(Boolean)
      : [],
    clients,
    confidence: typeof item.confidence === 'number' ? item.confidence : undefined,
    source_block_ids: item.source_block_ids || [],
    parser: item.parser || 'EXPERIENCE_BLOCK_PARSER_V2',
  };
}

/**
 * @param {object} item
 */
export function educationItemToLine(item) {
  const school = String(item.school || '').trim();
  const degree = String(item.degree || '').trim();
  const start = String(item.start_date || '').trim();
  const end = String(item.end_date || '').trim();
  const parts = [school, degree].filter(Boolean);
  if (start && end) parts.push(`${start} – ${end}`);
  else if (start) parts.push(start);
  return parts.join(' — ').trim();
}

/**
 * @param {import('./section-segmenter.js').SegmentedBlock[]} segments
 * @param {string} sectionId
 */
export function segmentTexts(segments, sectionId) {
  return (segments || [])
    .filter((s) => s.section === sectionId && !s.is_heading)
    .map((s) => String(s.text || '').trim())
    .filter(Boolean);
}

/**
 * Sidebar / profile fields from segmented blocks (summary, languages, interests).
 * @param {import('./section-segmenter.js').SegmentedBlock[]} segments
 */
export function sidebarFieldsFromSegments(segments) {
  const summarySegs = segmentTexts(segments, CV_SECTION.SUMMARY);
  const langSegs = segmentTexts(segments, CV_SECTION.LANGUAGES);
  const interestSegs = segmentTexts(segments, CV_SECTION.INTERESTS);

  return {
    summary: summarySegs.join(' ').trim(),
    languages: langSegs.flatMap((t) =>
      t
        .split(/\n|[,;|]/)
        .map((x) => x.trim())
        .filter(Boolean)
    ),
    interests: interestSegs.flatMap((t) =>
      t
        .split(/[,;|]/)
        .map((x) => x.trim())
        .filter(Boolean)
    ),
  };
}

/**
 * @param {object} structured — mutable structured resume
 * @param {object} detection — detectSectionBlocks output
 * @param {object} [opts]
 */
export function applyBlockParserBundleToStructured(structured, detection, opts = {}) {
  const segments =
    opts.segments ||
    detection.sectionSegmentation?.segments ||
    detection.resumeSegments ||
    [];

  const globalConf = detection.parseConfidence?.global ?? 0;
  if (globalConf > 0 && globalConf < MIN_BRIDGE_GLOBAL_CONFIDENCE) {
    return {
      structured,
      applied: false,
      reason: 'global_confidence_below_floor',
      globalConfidence: globalConf,
    };
  }

  let contact = { ...(detection.parseConfidence?.contact || {}) };
  if (!contact.name || !contact.email || !contact.phone || !contact.title) {
    const enriched = extractContactFromParseContext({
      resumeSegments: segments,
      extractionLines: detection.extractionLines || opts.extractionLines || [],
      rawText: opts.rawText || '',
      cleanedText: opts.cleanedText || '',
      fileName: opts.fileName || '',
    });
    contact = mergeContactForBridge(contact, enriched);
  } else {
    contact = mergeContactForBridge(contact, extractContactFromParseContext({
      resumeSegments: segments,
      extractionLines: detection.extractionLines || opts.extractionLines || [],
      rawText: opts.rawText || '',
      cleanedText: opts.cleanedText || '',
      fileName: opts.fileName || '',
    }));
  }
  if (/graphic\s*designer\s*&\s*illustrator/i.test(contact.title || '')) {
    contact.title = 'Graphic Designer & Illustrator';
  }
  if (contact.name) structured.identity.name = contact.name;
  if (contact.email) structured.identity.email = contact.email;
  if (contact.phone) structured.identity.phone = contact.phone;
  if (contact.location) structured.identity.location = contact.location;
  if (contact.title) structured.identity.title = contact.title;

  const sidebar = sidebarFieldsFromSegments(segments);
  if (sidebar.summary) structured.summary = sidebar.summary;
  if (sidebar.languages.length) structured.languages = sidebar.languages;
  if (sidebar.interests.length) structured.interests = sidebar.interests;

  const experiences = (detection.experienceItems || [])
    .filter((e) => (e.confidence ?? 1) >= 0.55)
    .map(experienceItemToStructured)
    .filter((e) => e.role || e.company);
  if (experiences.length) {
    structured.experiences = experiences;
  }

  const eduLines = (detection.educationItems || [])
    .filter((e) => (e.confidence ?? 1) >= 0.55)
    .map(educationItemToLine)
    .filter(Boolean);
  if (eduLines.length) {
    structured.education = [...new Set(eduLines)];
  }

  const skills = [];
  const tools = [];
  for (const skill of detection.skillItems || []) {
    const name = String(skill.name || '').trim();
    if (!name || (skill.confidence ?? 1) < 0.55) continue;
    if (isSkillsSectionPollution(name, { isSkillsSection: true })) continue;
    const cat = skill.category || SKILL_CATEGORY.TOOLS;
    if (cat === SKILL_CATEGORY.TOOLS || cat === 'tools') {
      tools.push(name);
    } else {
      skills.push(name);
    }
  }
  if (tools.length) structured.tools = [...new Set(tools)];
  if (skills.length) structured.skills = [...new Set(skills)];

  structured.metadata = {
    ...(structured.metadata || {}),
    blockParserBridge: CV_BLOCK_PARSER_BRIDGE,
    blockParserApplied: true,
    blockParserBridgeApplied: true,
    parseResponse: detection.parseResponse || null,
    parseConfidence: detection.parseConfidence || null,
    parseValidation: detection.parseValidation || null,
    reviewHints: detection.reviewHints || null,
    pageDocumentClassification: detection.pageDocumentClassification || null,
    portfolio_items: detection.portfolio_items || [],
    excluded_pages_trace: detection.excluded_pages_trace || [],
    experienceBlockParse: detection.experienceBlockParse || null,
    educationBlockParse: detection.educationBlockParse || null,
    skillsBlockParse: detection.skillsBlockParse || null,
  };

  return {
    structured,
    applied: true,
    stats: {
      experiences: structured.experiences?.length || 0,
      education: structured.education?.length || 0,
      skills: structured.skills?.length || 0,
      tools: structured.tools?.length || 0,
      languages: structured.languages?.length || 0,
      interests: structured.interests?.length || 0,
      globalConfidence: globalConf,
      productionReady: detection.parseValidation?.production_ready ?? null,
    },
  };
}

/**
 * Build product resumeData directly from hirely.parse_response.v1 (bridge SSOT).
 * Avoids slim structured resume + creative flat repair corrupting spatial parse output.
 * @param {object} parseResponse
 * @param {object} [opts]
 */
/**
 * True when spatial block-parser output is the product SSOT (skip flat repair).
 * @param {object} [importResult]
 */
export function isBridgeLockedImport(importResult) {
  if (!importResult || typeof importResult !== 'object') return false;
  if (importResult.resumeData?.meta?.blockParserBridgeApplied === true) return true;
  if (importResult.parseResponse?.schema === 'hirely.parse_response.v1') return true;
  const meta = importResult.structuredResume?.metadata || {};
  if (meta.blockParserBridgeApplied === true || meta.blockParserApplied === true) return true;
  if (meta.parseResponse?.schema === 'hirely.parse_response.v1') return true;
  return false;
}

/**
 * @param {object} [importResult]
 * @param {object} [pipe]
 */
export function resolveBridgeLockedFromImport(importResult, pipe = null) {
  const parseResponse =
    importResult?.parseResponse ||
    pipe?.audit?.parseResponse ||
    importResult?.structuredResume?.metadata?.parseResponse ||
    null;
  const applied =
    isBridgeLockedImport(importResult) ||
    pipe?.audit?.blockParserBridgeApplied === true ||
    parseResponse?.schema === 'hirely.parse_response.v1';
  return { applied, parseResponse };
}

/**
 * @param {object} enterprise
 */
export function enterpriseHasSpatialParseInput(enterprise) {
  if (!enterprise || typeof enterprise !== 'object') return false;
  const spatial =
    enterprise.spatialBlocks ||
    enterprise.metadata?.spatialBlocks ||
    enterprise.layoutMemory?.spatialBlocks ||
    [];
  if (Array.isArray(spatial) && spatial.length >= 3) return true;
  const lines = enterprise.lines || enterprise.layoutMemory?.lines || [];
  if (!Array.isArray(lines) || lines.length < 3) return false;
  const positioned = lines.filter(
    (l) => Number.isFinite(l?.x) && Number.isFinite(l?.y)
  );
  return positioned.length >= 3;
}

/**
 * Flat repair / OCR recovery must not run when spatial or bridge SSOT is active.
 * @param {object} [rd]
 */
export function shouldSkipFlatRepairForResumeData(rd) {
  const meta = rd?.meta || {};
  return (
    meta.blockParserBridgeApplied === true ||
    meta.flatRepairSkipped === true ||
    meta.spatialParseInput === true
  );
}

/**
 * Debug summary for which import path won (spatial bridge vs legacy flat).
 * @param {object} [importResult]
 * @param {object} [resumeData]
 * @param {object} [opts]
 */
export function buildImportPathDebug(importResult, resumeData, opts = {}) {
  const bridge = resolveBridgeLockedFromImport(importResult, opts.pipe || null);
  const enterprise =
    opts.enterprise ||
    importResult?.enterpriseExtraction ||
    opts.pipe?.enterpriseExtraction ||
    opts.pipe?.stages?.document?.enterprise ||
    null;
  const spatial = enterpriseHasSpatialParseInput(enterprise);
  const skipFlat =
    shouldSkipFlatRepairForResumeData(resumeData) || bridge.applied || spatial;
  let importPathWinner = 'legacy_flat';
  if (bridge.applied) importPathWinner = 'spatial_bridge';
  else if (spatial && skipFlat) importPathWinner = 'spatial_input_flat_repair_blocked';
  else if (spatial) importPathWinner = 'spatial_partial';

  const pageClass =
    bridge.parseResponse?.page_document_classification ||
    importResult?.structuredResume?.metadata?.pageDocumentClassification ||
    null;

  return {
    import_path_winner: importPathWinner,
    bridge_activated: bridge.applied,
    flat_fallback_skipped: skipFlat,
    flat_repair_skipped: skipFlat,
    repair_skipped: skipFlat,
    spatial_parse_input: spatial,
    parse_response_schema: bridge.parseResponse?.schema || importResult?.parseResponse?.schema || null,
    page_document_classification: pageClass,
  };
}

export function resumeDataFromParseResponse(parseResponse, opts = {}) {
  const pr = parseResponse && typeof parseResponse === 'object' ? parseResponse : {};
  let contact = { ...(pr.contact || {}) };

  if (!contact.name || !contact.email || !contact.phone || !contact.title) {
    const enriched = extractContactFromParseContext({
      resumeSegments: opts.resumeSegments || [],
      extractionLines: opts.extractionLines || [],
      rawText: opts.rawText || '',
      cleanedText: opts.cleanedText || '',
      fileName: opts.fileName || '',
    });
    contact = mergeContactForBridge(contact, enriched);
  } else {
    contact = mergeContactForBridge(
      contact,
      extractContactFromParseContext({
        resumeSegments: opts.resumeSegments || [],
        extractionLines: opts.extractionLines || [],
        rawText: opts.rawText || '',
        cleanedText: opts.cleanedText || '',
        fileName: opts.fileName || '',
      })
    );
  }
  if (/graphic\s*designer\s*&\s*illustrator/i.test(contact.title || '')) {
    contact.title = 'Graphic Designer & Illustrator';
  }

  const experiences = (pr.experiences || [])
    .filter((e) => (e.confidence ?? 1) >= 0.55)
    .map(experienceItemToStructured)
    .filter((e) => e.role || e.company);

  const education = dedupeEducationStrings(
    (pr.education || [])
      .filter((e) => (e.confidence ?? 1) >= 0.55)
      .map(educationItemToLine)
      .filter((line) => isValidEducationItem(line)),
    { identity: { name: String(contact.name || '').trim() } }
  );

  const skills = [];
  const tools = [];
  for (const skill of pr.skills || []) {
    const name = String(skill.name || skill).trim();
    if (!name || (skill.confidence ?? 1) < 0.55) continue;
    if (isSkillsSectionPollution(name, { isSkillsSection: true })) continue;
    if (isOcrGarbageText(name)) continue;
    const cat = skill.category || SKILL_CATEGORY.TOOLS;
    if (cat === SKILL_CATEGORY.TOOLS || cat === 'tools') tools.push(name);
    else skills.push(name);
  }

  const clients = [];
  for (const exp of pr.experiences || []) {
    for (const c of exp.client || exp.clients || []) {
      const t = String(c || '').trim();
      if (t) clients.push(t);
    }
  }

  const languages = (pr.languages || [])
    .map((l) => (typeof l === 'string' ? l : String(l.name || l.language || '').trim()))
    .filter(Boolean);

  const interests = (pr.interests || [])
    .map((i) => (typeof i === 'string' ? i : String(i.name || i.text || '').trim()))
    .filter(Boolean);

  return {
    identity: {
      name: String(contact.name || '').trim(),
      title: String(contact.title || '').trim(),
      email: String(contact.email || '').trim(),
      phone: String(contact.phone || '').trim(),
      location: String(contact.location || '').trim(),
      website: String(contact.website || contact.portfolio || '').trim(),
      linkedin: String(contact.linkedin || '').trim(),
    },
    summary: (() => {
      const s = String(pr.summary || '').trim();
      return s && isValidSummaryField(s) ? s : '';
    })(),
    experiences,
    education: [...new Set(education)],
    clients: [...new Set(clients)],
    projects: [],
    exhibitions: [],
    awards: [],
    publications: [],
    press: [],
    portfolioLinks: [],
    skills: [...new Set(skills)],
    tools: [...new Set(tools)],
    languages: [...new Set(languages)],
    interests: [...new Set(interests)],
    unsorted: [],
    meta: {
      ...(opts.meta || {}),
      blockParserBridgeApplied: true,
      parseGlobalConfidence:
        pr.confidence?.global ??
        pr.quality_gate?.global_confidence ??
        null,
      productionReady:
        pr.validation?.production_ready ??
        pr.quality_gate?.production_ready ??
        null,
    },
  };
}
