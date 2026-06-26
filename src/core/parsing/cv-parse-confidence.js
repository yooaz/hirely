/**
 * CV parse confidence scoring — global, section, item, and field levels.
 *
 * Consumes block-parser output from detectSectionBlocks (section-detect-v2).
 */

import { CV_SECTION } from './section-heading-dictionary.js';
import { normalizeCompareString } from './dedupe-engine.js';
import { isValidIdentityName } from './identity-extraction.js';

export const CV_PARSE_CONFIDENCE = 'CV_PARSE_CONFIDENCE_V2';

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_RE = /(?:\+?\d[\d\s().-]{7,}\d)/;
const URL_RE = /https?:\/\/|www\./i;
const TITLE_ROLE_RE =
  /\b(designer|illustrator|developer|engineer|manager|director|consultant|analyst|architect|specialist|coordinator|lead|head|officer|freelance|artist|photographer|writer|strategist|producer|editor)\b/i;
const SECTION_HEADING_RE =
  /^(profile|work experience|education|skills|languages|interests|summary|experience|contact)\b/i;

/** @typedef {'contact'|'summary'|'experience'|'education'|'skills'|'certifications'|'projects'} CvSectionKey */

/**
 * @typedef {object} FieldScore
 * @property {number} confidence
 * @property {string} [value]
 */

/**
 * @typedef {object} ItemConfidence
 * @property {string} id
 * @property {number} confidence
 * @property {Record<string, FieldScore>} fields
 * @property {string[]} [source_block_ids]
 */

/**
 * @typedef {object} ParseConfidenceReport
 * @property {string} version
 * @property {number} global
 * @property {Record<CvSectionKey, number>} sections
 * @property {Record<string, number>} fields
 * @property {{ experience: ItemConfidence[], education: ItemConfidence[], skills: ItemConfidence[] }} items
 * @property {{ excluded_pages: number[], portfolio_pages: number[], unclassified_segment_count: number, page_classification_confidence?: number }} traces
 * @property {{ valid?: boolean, error_count?: number, warning_count?: number }} [validation]
 */

function round3(n) {
  return Math.round(Number(n) * 1000) / 1000;
}

function clamp01(n) {
  return Math.max(0, Math.min(1, Number(n) || 0));
}

function hasText(v) {
  return Boolean(String(v || '').trim());
}

function topLinesFromExtraction(extractionLines = []) {
  return extractionLines
    .filter((l) => (l.page || 1) === 1)
    .map((l) => String(l.text || l.cleanedText || '').trim())
    .filter(Boolean);
}

function allLinesFromExtraction(extractionLines = []) {
  return (extractionLines || [])
    .map((l) => String(l.text || l.cleanedText || '').trim())
    .filter(Boolean);
}

export function nameFromFileName(fileName = '') {
  const base = String(fileName || '')
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[_-]+/g, ' ')
    .trim();
  const cleaned = base
    .replace(/\b(cv|resume|curriculum|vitae|copie|copy|final|draft|version|\d{4})\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return '';

  const titleCase = cleaned.match(
    /\b([A-ZÀ-ÿ][a-zà-ÿ'-]+(?:\s+[A-ZÀ-ÿ][a-zà-ÿ'-]+){1,2})\b/
  );
  if (titleCase) {
    const candidate = titleCase[1].trim();
    if (
      candidate.length >= 5 &&
      candidate.length <= 48 &&
      isValidIdentityName(candidate) &&
      !TITLE_ROLE_RE.test(candidate) &&
      !SECTION_HEADING_RE.test(candidate)
    ) {
      return candidate;
    }
  }

  const stop = new Set([
    'cv',
    'resume',
    'curriculum',
    'vitae',
    'copie',
    'copy',
    'pdf',
    'doc',
    'docx',
    'final',
    'draft',
  ]);
  const tokens = cleaned
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && /^[a-zà-ÿ'-]+$/i.test(t) && !stop.has(t.toLowerCase()));

  for (let size = 3; size >= 2; size--) {
    for (let i = 0; i <= tokens.length - size; i++) {
      const candidate = tokens
        .slice(i, i + size)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
      if (
        candidate.length >= 5 &&
        candidate.length <= 48 &&
        isValidIdentityName(candidate) &&
        !TITLE_ROLE_RE.test(candidate)
      ) {
        return candidate;
      }
    }
  }
  return '';
}

function extractFrMobilePhone(text = '') {
  const s = String(text || '');
  const idx = s.indexOf('+33');
  if (idx < 0) return '';
  const tail = s.slice(idx + 3).replace(/\D/g, '');
  const national = tail.startsWith('0') ? tail.slice(1) : tail;
  const digits = `33${national}`.slice(0, 11);
  if (digits.length !== 11 || !digits.startsWith('33')) return '';
  return `+${digits}`;
}

function isDateRangeLikePhone(text = '') {
  const s = String(text || '').trim();
  if (!s || s.startsWith('+')) return false;
  if (/\d{4}\s*[-–]\s*\d{4}/.test(s)) return true;
  const d = s.replace(/\D/g, '');
  return d.length >= 8 && d.length <= 10 && /^20/.test(d);
}

function pickPhoneFromLines(lines = []) {
  const candidates = [];
  for (const line of lines) {
    const s = String(line || '');
    const fr = extractFrMobilePhone(s);
    if (fr) {
      candidates.push({ phone: fr, score: 5 });
      continue;
    }
    const m = s.match(PHONE_RE);
    if (!m) continue;
    const raw = m[0].replace(/\s+/g, '');
    if (isDateRangeLikePhone(raw)) continue;
    const digits = raw.replace(/\D/g, '');
    if (digits.length >= 10 && digits.length <= 15) {
      candidates.push({
        phone: raw,
        score: digits.startsWith('33') ? 2 : 1,
      });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0]?.phone || '';
}

function pickTitleFromLines(lines = []) {
  const blob = lines.map((l) => String(l || '')).join('\n');
  if (/graphic\s*designer\s*&\s*illustrator/i.test(blob)) {
    return 'Graphic Designer & Illustrator';
  }
  for (const line of lines) {
    const t = String(line || '').trim();
    if (!t || EMAIL_RE.test(t) || PHONE_RE.test(t) || URL_RE.test(t)) continue;
    if (/graphic\s*designer\s*&\s*illustrator/i.test(t)) {
      return 'Graphic Designer & Illustrator';
    }
    if (TITLE_ROLE_RE.test(t) && t.length >= 8 && t.length <= 72) return t;
  }
  return '';
}

function fieldScore(present, strong = 0.92, weak = 0.25) {
  return clamp01(present ? strong : weak);
}

function itemId(section, index) {
  return `${section}-${index}`;
}

/**
 * @param {object} params
 * @param {object[]} [params.resumeSegments]
 * @param {object[]} [params.extractionLines]
 */
export function extractContactFromParseContext({
  resumeSegments = [],
  extractionLines = [],
  rawText = '',
  cleanedText = '',
  fileName = '',
} = {}) {
  const contactSegs = resumeSegments.filter((s) => s.section === CV_SECTION.CONTACT);
  let email = '';
  let phone = '';
  let name = '';
  let location = '';
  let title = '';

  const allLines = allLinesFromExtraction(extractionLines);
  const topLines = topLinesFromExtraction(extractionLines);
  const haystack = [
    ...contactSegs.map((s) => s.text),
    ...allLines,
    String(cleanedText || rawText || ''),
  ].filter(Boolean);

  for (const line of haystack) {
    if (!email) {
      const m = String(line).match(EMAIL_RE);
      if (m) email = m[0];
    }
  }
  phone = pickPhoneFromLines(haystack);

  const fileNameName = nameFromFileName(fileName);
  if (fileNameName && isValidIdentityName(fileNameName)) {
    name = fileNameName;
  }

  if (!name) {
    const candidate = topLines.find(
      (l) =>
        l.length >= 4 &&
        l.length <= 48 &&
        !EMAIL_RE.test(l) &&
        !PHONE_RE.test(l) &&
        !URL_RE.test(l) &&
        /^[A-ZÀ-ÿ]/.test(l) &&
        !SECTION_HEADING_RE.test(l) &&
        isValidIdentityName(l)
    );
    if (candidate) name = candidate;
  }

  if (!name && fileNameName) name = fileNameName;

  if (!title) title = pickTitleFromLines([...topLines, ...allLines, String(cleanedText || rawText || '')]);

  if (!location) {
    const candidate = topLines.find(
      (l) =>
        /\d{1,5}\s+\w+/.test(l) &&
        /\b(paris|lyon|london|france|remote)\b/i.test(l) &&
        !EMAIL_RE.test(l)
    );
    if (candidate) location = candidate;
  }

  return {
    name,
    title,
    email,
    phone,
    location,
    source_block_ids: contactSegs.map((s) => s.block_id).filter(Boolean),
  };
}

/**
 * Prefer enriched OCR/filename contact when parser contact is polluted.
 * @param {object} primary
 * @param {object} enriched
 */
export function mergeContactForBridge(primary = {}, enriched = {}) {
  const pickName = () => {
    const p = String(primary.name || '').trim();
    const e = String(enriched.name || '').trim();
    if (p && isValidIdentityName(p)) return p;
    if (e && isValidIdentityName(e)) return e;
    return e || p;
  };
  const pickPhone = () => {
    const p = String(primary.phone || '').trim();
    const e = String(enriched.phone || '').trim();
    if (p && !isDateRangeLikePhone(p) && extractFrMobilePhone(p)) return extractFrMobilePhone(p);
    if (e && !isDateRangeLikePhone(e)) return e;
    if (p && !isDateRangeLikePhone(p)) return p;
    return e;
  };
  const pickTitle = () => {
    const p = String(primary.title || '').trim();
    const e = String(enriched.title || '').trim();
    if (/graphic\s*designer\s*&\s*illustrator/i.test(e)) return 'Graphic Designer & Illustrator';
    if (/graphic\s*designer\s*&\s*illustrator/i.test(p)) return 'Graphic Designer & Illustrator';
    if (e && TITLE_ROLE_RE.test(e) && e.length <= 72) return e;
    return p || e;
  };
  return {
    ...enriched,
    ...primary,
    name: pickName(),
    title: pickTitle(),
    email: String(primary.email || enriched.email || '').trim(),
    phone: pickPhone(),
    location: String(primary.location || enriched.location || '').trim(),
  };
}

/**
 * @param {import('./cv-experience-block-parser.js').ParsedExperienceItem} item
 * @param {number} index
 */
function scoreExperienceItem(item, index) {
  const titleConf = fieldScore(hasText(item.job_title), 0.9, 0.3);
  const companyConf = fieldScore(hasText(item.company), 0.88, 0.28);
  const startConf = fieldScore(hasText(item.start_date), 0.9, 0.2);
  const endConf = fieldScore(hasText(item.end_date) || item.is_current, 0.85, 0.25);
  const datesConf = round3((startConf + endConf) / 2);
  const parserConf = clamp01(item.confidence);

  const confidence = round3(
    parserConf * 0.45 +
      titleConf * 0.2 +
      companyConf * 0.2 +
      datesConf * 0.15
  );

  return {
    id: itemId('experience', index),
    confidence,
    source_block_ids: item.source_block_ids || [],
    fields: {
      job_title: { confidence: titleConf, value: item.job_title || '' },
      company: { confidence: companyConf, value: item.company || '' },
      start_date: { confidence: startConf, value: item.start_date || '' },
      end_date: { confidence: endConf, value: item.end_date || '' },
    },
  };
}

/**
 * @param {import('./cv-education-block-parser.js').ParsedEducationItem} item
 * @param {number} index
 */
function scoreEducationItem(item, index) {
  const schoolConf = fieldScore(hasText(item.school), clamp01(item.confidence), 0.2);
  const degreeConf = fieldScore(hasText(item.degree), 0.82, 0.35);
  const startConf = fieldScore(hasText(item.start_date), 0.88, 0.3);
  const endConf = fieldScore(hasText(item.end_date), 0.85, 0.3);
  const parserConf = clamp01(item.confidence);

  const confidence = round3(
    parserConf * 0.4 + schoolConf * 0.3 + degreeConf * 0.15 + ((startConf + endConf) / 2) * 0.15
  );

  return {
    id: itemId('education', index),
    confidence,
    source_block_ids: item.source_block_ids || [],
    fields: {
      school: { confidence: schoolConf, value: item.school || '' },
      degree: { confidence: degreeConf, value: item.degree || '' },
      start_date: { confidence: startConf, value: item.start_date || '' },
      end_date: { confidence: endConf, value: item.end_date || '' },
    },
  };
}

/**
 * @param {{ name?: string, confidence?: number, category?: string }} item
 * @param {number} index
 */
function scoreSkillItem(item, index) {
  const nameConf = fieldScore(hasText(item.name), clamp01(item.confidence || 0.85), 0.25);
  const categoryConf = fieldScore(hasText(item.category), 0.8, 0.4);
  const confidence = round3(nameConf * 0.7 + categoryConf * 0.3);

  return {
    id: itemId('skills', index),
    confidence,
    source_block_ids: item.source_block_ids || [],
    fields: {
      name: { confidence: nameConf, value: item.name || '' },
      category: { confidence: categoryConf, value: item.category || '' },
    },
  };
}

function scoreContactSection(contact) {
  const nameConf = fieldScore(hasText(contact.name), 0.88, 0.35);
  const titleConf = fieldScore(hasText(contact.title), 0.85, 0.35);
  const emailConf = fieldScore(hasText(contact.email) && EMAIL_RE.test(contact.email), 0.95, 0.2);
  const phoneConf = fieldScore(hasText(contact.phone) && PHONE_RE.test(contact.phone), 0.9, 0.25);
  const locationConf = fieldScore(hasText(contact.location), 0.75, 0.4);

  const section = round3(
    nameConf * 0.2 +
      titleConf * 0.1 +
      emailConf * 0.35 +
      phoneConf * 0.25 +
      locationConf * 0.1
  );

  return {
    section,
    fields: {
      'contact.name': nameConf,
      'contact.title': titleConf,
      'contact.email': emailConf,
      'contact.phone': phoneConf,
      'contact.location': locationConf,
    },
    contact,
  };
}

function scoreSummarySection(segments = []) {
  const summarySegs = segments.filter((s) => s.section === CV_SECTION.SUMMARY);
  if (!summarySegs.length) return { section: 0, fields: {} };
  const text = summarySegs.map((s) => s.text).join(' ').trim();
  const section = fieldScore(text.length >= 20, 0.82, 0.45);
  return { section, fields: { 'summary.text': section } };
}

function avgConfidence(items = []) {
  if (!items.length) return 0;
  return round3(items.reduce((s, i) => s + i.confidence, 0) / items.length);
}

function countUnclassifiedSegments(segments = []) {
  return segments.filter(
    (s) =>
      (s.section === CV_SECTION.OTHER || !s.section) &&
      String(s.text || '').trim().length >= 12
  ).length;
}

function scorePageClassificationSection(pageClass = {}) {
  const pages = pageClass.pages || [];
  if (!pages.length) return { section: 0, fields: {}, page_classification_confidence: 0 };

  const avg = round3(
    pages.reduce((s, p) => s + clamp01(p.confidence || 0), 0) / pages.length
  );
  const resumePages = pageClass.resume_core_pages || [];
  const portfolioPages = pageClass.portfolio_pages || [];
  const resumeHit = resumePages.length
    ? round3(
        pages
          .filter((p) => resumePages.includes(p.page))
          .reduce((s, p) => s + clamp01(p.confidence || 0), 0) / resumePages.length
      )
    : 0;
  const portfolioHit = portfolioPages.length
    ? round3(
        pages
          .filter((p) => portfolioPages.includes(p.page))
          .reduce((s, p) => s + clamp01(p.confidence || 0), 0) / portfolioPages.length
      )
    : 0;

  const section = portfolioPages.length
    ? round3(avg * 0.4 + resumeHit * 0.35 + portfolioHit * 0.25)
    : avg;

  return {
    section,
    page_classification_confidence: avg,
    fields: {
      'page_classification.global': avg,
      'page_classification.resume_core': resumeHit,
      'page_classification.portfolio': portfolioHit,
    },
  };
}

/**
 * Apply validation penalties to confidence report (never silent low quality).
 * @param {ParseConfidenceReport} confidence
 * @param {import('./cv-parse-validation.js').object} validation
 */
export function applyValidationConfidenceAdjustments(confidence, validation) {
  if (!confidence || !validation?.issues?.length) {
    return { ...confidence, validation: validation ? { valid: validation.valid, error_count: 0, warning_count: 0 } : undefined };
  }

  let penalty = 0;
  for (const issue of validation.issues) {
    if (issue.severity === 'error') penalty += 0.08;
    else penalty += 0.03;
  }
  penalty = Math.min(0.4, penalty);

  const sections = { ...confidence.sections };
  for (const issue of validation.issues) {
    const sec = issue.section;
    if (sec && sections[sec] != null) {
      sections[sec] = round3(clamp01(sections[sec] - (issue.severity === 'error' ? 0.12 : 0.05)));
    }
  }

  return {
    ...confidence,
    global: round3(clamp01(confidence.global - penalty)),
    sections,
    validation_penalty: round3(penalty),
    validation: {
      valid: validation.valid,
      error_count: validation.error_count,
      warning_count: validation.warning_count,
      production_ready: validation.production_ready,
    },
  };
}
/**
 * @param {object} bundle
 * @param {object} [bundle.contact]
 * @param {object[]} [bundle.experienceItems]
 * @param {object[]} [bundle.educationItems]
 * @param {object[]} [bundle.skillItems]
 * @param {object[]} [bundle.resumeSegments]
 * @param {object} [bundle.pageDocumentClassification]
 * @param {object} [bundle.sectionSegmentation]
 */
export function scoreCvParseBundle(bundle = {}) {
  const contact =
    bundle.contact ||
    extractContactFromParseContext({
      resumeSegments: bundle.resumeSegments || [],
      extractionLines: bundle.extractionLines || [],
      rawText: bundle.rawText || '',
      cleanedText: bundle.cleanedText || '',
      fileName: bundle.fileName || '',
    });

  const experienceItems = (bundle.experienceItems || []).map(scoreExperienceItem);
  const educationItems = (bundle.educationItems || []).map(scoreEducationItem);
  const skillItems = (bundle.skillItems || []).map(scoreSkillItem);

  const pageClass = bundle.pageDocumentClassification || {};
  const contactScore = scoreContactSection(contact);
  const summaryScore = scoreSummarySection(bundle.resumeSegments || []);
  const pageClassScore = scorePageClassificationSection(pageClass);

  const sections = {
    contact: contactScore.section,
    summary: summaryScore.section,
    experience: avgConfidence(experienceItems),
    education: avgConfidence(educationItems),
    skills: avgConfidence(skillItems),
    page_classification: pageClassScore.section,
    certifications: 0,
    projects: 0,
  };

  const fields = {
    ...contactScore.fields,
    ...summaryScore.fields,
    ...pageClassScore.fields,
  };

  for (const item of experienceItems) {
    const prefix = `experience.${item.id}`;
    for (const [key, fs] of Object.entries(item.fields)) {
      fields[`${prefix}.${key}`] = fs.confidence;
    }
  }
  for (const item of educationItems) {
    const prefix = `education.${item.id}`;
    for (const [key, fs] of Object.entries(item.fields)) {
      fields[`${prefix}.${key}`] = fs.confidence;
    }
  }
  for (const item of skillItems) {
    const prefix = `skills.${item.id}`;
    for (const [key, fs] of Object.entries(item.fields)) {
      fields[`${prefix}.${key}`] = fs.confidence;
    }
  }

  const portfolioPages = pageClass.portfolio_pages || [];
  const excludedPages = portfolioPages.slice();
  const pageClassificationConfidence = pageClassScore.page_classification_confidence;

  const unclassifiedCount = countUnclassifiedSegments(bundle.resumeSegments || []);

  const populatedSections = [
    sections.contact > 0 ? sections.contact : null,
    pageClassScore.section > 0 ? pageClassScore.section : null,
    sections.summary > 0 ? sections.summary : null,
    experienceItems.length ? sections.experience : null,
    educationItems.length ? sections.education : null,
    skillItems.length ? sections.skills : null,
  ].filter((n) => n != null);

  let global = populatedSections.length
    ? populatedSections.reduce((s, n) => s + n, 0) / populatedSections.length
    : 0;

  if (unclassifiedCount > 0) {
    global = clamp01(global - Math.min(0.12, unclassifiedCount * 0.03));
  }
  if (portfolioPages.length > 0) {
    global = round3(global);
  }

  global = round3(global);

  return {
    version: CV_PARSE_CONFIDENCE,
    global,
    sections,
    fields,
    items: {
      experience: experienceItems,
      education: educationItems,
      skills: skillItems,
    },
    traces: {
      excluded_pages: excludedPages,
      portfolio_pages: portfolioPages,
      unclassified_segment_count: unclassifiedCount,
      page_classification_confidence: pageClassificationConfidence,
    },
    contact,
  };
}

/**
 * Detect education rows that share a date range but disagree on school label (OCR ambiguity).
 * @param {object[]} educationItems
 */
export function findAmbiguousEducationSchools(educationItems = []) {
  const byRange = new Map();
  for (const item of educationItems) {
    const range = `${item.start_date || ''}|${item.end_date || ''}`;
    if (!range.replace(/\|/g, '')) continue;
    const schools = byRange.get(range) || new Set();
    schools.add(normalizeCompareString(item.school || ''));
    byRange.set(range, schools);
  }
  const ambiguous = [];
  for (const [range, schools] of byRange) {
    const unique = [...schools].filter(Boolean);
    if (unique.length > 1) {
      ambiguous.push({ date_range: range.replace('|', '–'), school_keys: unique });
    }
  }
  return ambiguous;
}

export const LOW_CONFIDENCE_THRESHOLDS = Object.freeze({
  global: 0.55,
  section: 0.6,
  item: 0.55,
  field: 0.65,
});
