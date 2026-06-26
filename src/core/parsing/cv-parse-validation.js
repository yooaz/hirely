/**
 * CV parse validation — structural checks before treating output as production-ready.
 */

import { normalizeCompareString } from './dedupe-engine.js';
import { CV_SECTION } from './section-heading-dictionary.js';
import {
  isDeniedClientBrand,
  pollutionReason,
} from './skills-section-pollution-filter.js';
import { PAGE_DOCUMENT_CLASS } from '../layout/page-document-classifier.js';

export const CV_PARSE_VALIDATION = 'CV_PARSE_VALIDATION_V2';

const YEAR_RE = /^(19|20)\d{2}$/;
const PORTFOLIO_LEAK_RE =
  /\b(personal\s+project|god\s+of\s+war|playstation|fortune\s+500|elon\s+musk|sunglass\s+man|t-shirt\s+design\s+for)\b/i;

/**
 * @typedef {object} ParseValidationIssue
 * @property {string} code
 * @property {'error'|'warning'} severity
 * @property {string} message
 * @property {string} [section]
 * @property {string} [item_id]
 * @property {string[]} [target_ids]
 * @property {string[]} [source_block_ids]
 * @property {object} [trace]
 */

function isValidYear(value) {
  return YEAR_RE.test(String(value || '').trim());
}

/**
 * @param {string} start
 * @param {string} end
 * @param {boolean} [isCurrent]
 */
export function isValidItemDateRange(start, end, isCurrent = false) {
  if (!isValidYear(start)) return false;
  if (isCurrent || /present|présent|current|now/i.test(String(end || ''))) return true;
  if (!isValidYear(end)) return false;
  return parseInt(start, 10) <= parseInt(end, 10);
}

function itemPageNumber(item, segmentsByBlock = new Map()) {
  const ids = item.source_block_ids || [];
  for (const id of ids) {
    const seg = segmentsByBlock.get(id);
    if (seg?.page_number || seg?.page) return seg.page_number || seg.page;
  }
  return item.page_number || item.page || null;
}

/**
 * @param {object} bundle
 * @param {import('./cv-parse-confidence.js').ParseConfidenceReport} [confidence]
 */
export function validateCvParseBundle(bundle = {}, confidence = null) {
  /** @type {ParseValidationIssue[]} */
  const issues = [];
  const stats = {
    invalid_dates: 0,
    duplicate_entries: 0,
    polluted_skills: 0,
    empty_critical_fields: 0,
    page_leakage: 0,
    unclassified_blocks: 0,
  };

  const contact = confidence?.contact || bundle.contact || {};
  if (!String(contact.email || '').trim()) {
    issues.push({
      code: 'empty_critical_field',
      severity: 'error',
      message: 'Contact email is missing.',
      section: 'contact',
      target_ids: [],
      source_block_ids: contact.source_block_ids || [],
    });
    stats.empty_critical_fields += 1;
  }

  const experienceItems = bundle.experienceItems || [];
  const educationItems = bundle.educationItems || [];
  const skillItems = bundle.skillItems || [];
  const resumeSegments = bundle.resumeSegments || [];
  const pageClass = bundle.pageDocumentClassification || {};
  const excludedPages = new Set(
    pageClass.excluded_pages || pageClass.portfolio_pages || []
  );

  const segmentsByBlock = new Map(
    resumeSegments.filter((s) => s.block_id).map((s) => [s.block_id, s])
  );

  const experienceKeys = new Map();
  for (let i = 0; i < experienceItems.length; i++) {
    const item = experienceItems[i];
    const itemConf = confidence?.items?.experience?.[i];
    const id = itemConf?.id || `experience-${i}`;

    if (!String(item.job_title || '').trim() || !String(item.company || '').trim()) {
      issues.push({
        code: 'empty_critical_field',
        severity: 'warning',
        message: 'This experience entry is missing a job title or company.',
        section: 'experience',
        item_id: id,
        target_ids: [id],
        source_block_ids: item.source_block_ids || [],
      });
      stats.empty_critical_fields += 1;
    }

    if (!isValidItemDateRange(item.start_date, item.end_date, item.is_current)) {
      issues.push({
        code: 'invalid_dates',
        severity: 'error',
        message: 'This experience has invalid or missing dates.',
        section: 'experience',
        item_id: id,
        target_ids: [id],
        source_block_ids: item.source_block_ids || [],
        trace: { start_date: item.start_date, end_date: item.end_date },
      });
      stats.invalid_dates += 1;
    } else if (
      (itemConf?.fields?.start_date?.confidence ?? 1) < 0.65 ||
      (itemConf?.fields?.end_date?.confidence ?? 1) < 0.65
    ) {
      issues.push({
        code: 'weak_date_confidence',
        severity: 'warning',
        message: 'This experience has weak date confidence.',
        section: 'experience',
        item_id: id,
        target_ids: [id],
        source_block_ids: item.source_block_ids || [],
      });
    }

    const key = [
      normalizeCompareString(item.company),
      item.start_date || '',
      item.end_date || '',
      normalizeCompareString(item.job_title),
    ].join('|');
    if (experienceKeys.has(key)) {
      issues.push({
        code: 'duplicate_experience_entry',
        severity: 'warning',
        message: 'This experience entry may be duplicated.',
        section: 'experience',
        item_id: id,
        target_ids: [id, experienceKeys.get(key)],
        source_block_ids: item.source_block_ids || [],
      });
      stats.duplicate_entries += 1;
    } else {
      experienceKeys.set(key, id);
    }

    const page = itemPageNumber(item, segmentsByBlock);
    if (page && excludedPages.has(page)) {
      issues.push({
        code: 'page_leakage_suspected',
        severity: 'error',
        message: `Experience content may have leaked from excluded page ${page}.`,
        section: 'experience',
        item_id: id,
        target_ids: [id],
        source_block_ids: item.source_block_ids || [],
        trace: { page, excluded_pages: [...excludedPages] },
      });
      stats.page_leakage += 1;
    }
  }

  const educationKeys = new Map();
  for (let i = 0; i < educationItems.length; i++) {
    const item = educationItems[i];
    const itemConf = confidence?.items?.education?.[i];
    const id = itemConf?.id || `education-${i}`;

    if (!String(item.school || '').trim()) {
      issues.push({
        code: 'empty_critical_field',
        severity: 'warning',
        message: 'This education entry is missing a school name.',
        section: 'education',
        item_id: id,
        target_ids: [id],
        source_block_ids: item.source_block_ids || [],
      });
      stats.empty_critical_fields += 1;
    }

    if (item.start_date || item.end_date) {
      if (!isValidItemDateRange(item.start_date, item.end_date)) {
        issues.push({
          code: 'invalid_dates',
          severity: 'error',
          message: 'This education entry has invalid dates.',
          section: 'education',
          item_id: id,
          target_ids: [id],
          source_block_ids: item.source_block_ids || [],
          trace: { start_date: item.start_date, end_date: item.end_date },
        });
        stats.invalid_dates += 1;
      }
    }

    const key = [
      normalizeCompareString(item.school),
      item.start_date || '',
      item.end_date || '',
      normalizeCompareString(item.degree),
    ].join('|');
    if (educationKeys.has(key)) {
      issues.push({
        code: 'duplicate_education_entry',
        severity: 'warning',
        message: 'This education entry may be duplicated.',
        section: 'education',
        item_id: id,
        target_ids: [id, educationKeys.get(key)],
        source_block_ids: item.source_block_ids || [],
      });
      stats.duplicate_entries += 1;
    } else {
      educationKeys.set(key, id);
    }

    const page = itemPageNumber(item, segmentsByBlock);
    if (page && excludedPages.has(page)) {
      issues.push({
        code: 'page_leakage_suspected',
        severity: 'error',
        message: `Education content may have leaked from excluded page ${page}.`,
        section: 'education',
        item_id: id,
        target_ids: [id],
        source_block_ids: item.source_block_ids || [],
        trace: { page, excluded_pages: [...excludedPages] },
      });
      stats.page_leakage += 1;
    }
  }

  const skillKeys = new Set();
  for (let i = 0; i < skillItems.length; i++) {
    const item = skillItems[i];
    const itemConf = confidence?.items?.skills?.[i];
    const id = itemConf?.id || `skills-${i}`;
    const name = String(item.name || '').trim();

    const pollution = pollutionReason(name, { isSkillsSection: true, sourceLine: name });
    if (pollution || isDeniedClientBrand(name) || PORTFOLIO_LEAK_RE.test(name)) {
      issues.push({
        code: 'polluted_skill',
        severity: 'error',
        message: `Skill “${name}” looks like client, portfolio, or OCR pollution.`,
        section: 'skills',
        item_id: id,
        target_ids: [id],
        source_block_ids: item.source_block_ids || [],
        trace: { pollution_reason: pollution || 'portfolio_or_client' },
      });
      stats.polluted_skills += 1;
    }

    const key = normalizeCompareString(name);
    if (key && skillKeys.has(key)) {
      issues.push({
        code: 'duplicate_skill_entry',
        severity: 'warning',
        message: 'This skill may be duplicated.',
        section: 'skills',
        item_id: id,
        target_ids: [id],
        source_block_ids: item.source_block_ids || [],
      });
      stats.duplicate_entries += 1;
    } else if (key) {
      skillKeys.add(key);
    }

    const page = itemPageNumber(item, segmentsByBlock);
    if (page && excludedPages.has(page)) {
      issues.push({
        code: 'page_leakage_suspected',
        severity: 'error',
        message: `Skill “${name}” may have leaked from excluded page ${page}.`,
        section: 'skills',
        item_id: id,
        target_ids: [id],
        source_block_ids: item.source_block_ids || [],
        trace: { page, excluded_pages: [...excludedPages] },
      });
      stats.page_leakage += 1;
    }
  }

  for (const seg of resumeSegments) {
    const page = seg.page_number || seg.page || 1;
    const text = String(seg.text || '').trim();
    if (!text || text.length < 16) continue;

    if (
      (seg.section === CV_SECTION.OTHER || !seg.section) &&
      page &&
      !excludedPages.has(page)
    ) {
      issues.push({
        code: 'unclassified_block',
        severity: 'warning',
        message: 'This block could not be classified safely.',
        section: 'unknown',
        target_ids: [seg.block_id].filter(Boolean),
        source_block_ids: [seg.block_id].filter(Boolean),
        trace: { page, text_preview: text.slice(0, 80) },
      });
      stats.unclassified_blocks += 1;
    }

    if (
      excludedPages.has(page) &&
      [CV_SECTION.EXPERIENCE, CV_SECTION.EDUCATION, CV_SECTION.SKILLS, CV_SECTION.CONTACT].includes(
        seg.section
      )
    ) {
      issues.push({
        code: 'page_leakage_suspected',
        severity: 'error',
        message: `Segment on excluded page ${page} is tagged as ${seg.section}.`,
        section: seg.section,
        target_ids: [seg.block_id].filter(Boolean),
        source_block_ids: [seg.block_id].filter(Boolean),
        trace: { page, section: seg.section },
      });
      stats.page_leakage += 1;
    }
  }

  for (const page of excludedPages) {
    const pageMeta = pageClass.pages?.find((p) => p.page === page);
    const hasPortfolioClass =
      pageMeta?.page_class === PAGE_DOCUMENT_CLASS.PORTFOLIO_PAGE;
    if (!hasPortfolioClass && pageMeta?.confidence >= 0.7) continue;
  }

  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;

  return {
    version: CV_PARSE_VALIDATION,
    valid: errorCount === 0,
    production_ready: errorCount === 0 && warningCount === 0,
    issues,
    stats,
    error_count: errorCount,
    warning_count: warningCount,
  };
}
