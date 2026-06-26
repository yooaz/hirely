/**
 * Page-level document classification — resume core vs portfolio/gallery pages.
 *
 * See PAGE_DOCUMENT_CLASSIFIER_ASSUMPTIONS.md
 */

import { hirelyDebugLog } from '../runtime/hirely-debug.js';
import { matchSectionHeading } from '../parsing/section-heading-dictionary.js';
import { classifyPageLayout } from './page-layout.js';
import { EMAIL_RE, PHONE_RE } from '../parsing/field-sanitize.js';

export const PAGE_DOCUMENT_CLASSIFIER = 'PAGE_DOCUMENT_CLASSIFIER_V2';

export const PAGE_DOCUMENT_CLASS = Object.freeze({
  RESUME_CORE: 'resume_core',
  PORTFOLIO_PAGE: 'portfolio_page',
  MIXED: 'mixed',
  UNKNOWN: 'unknown',
});

const PORTFOLIO_MARKER_RE =
  /\b(page\s*\d+\s*portfolio|portfolio\s*page|selected\s+works?|gallery|case\s+stud(?:y|ies)|personal\s+work)\b/i;

const PORTFOLIO_CAPTION_RE =
  /\b(personal\s+project|personal\s+artwork|t-shirt\s+design\s+for|fortune\s+500\s+cover|compelling\s+illustration\s+for|portrait\s+of|creation\s+of\s+an\s+illustration|metro\s+display|god\s+of\s+war)\b/i;

const EDUCATION_SIGNAL_RE =
  /\b(lisaa|créapole|creapole|university|college|bachelor|master|diploma|licence|visual\s+communication|product\s+design|multisectoral)\b/i;

const WORK_SIGNAL_RE =
  /\b(freelanc|internship|intern|agency|art\s+director|graphic\s+designer|illustrator)\b/i;

const PARSING_GATES = Object.freeze([
  'contact',
  'experience',
  'education',
  'skills',
  'section_segmentation',
]);

const EXPERIENCE_STRUCTURE_RE =
  /\b(freelanc|internship|intern|agency|art\s+director|illustrator|designer)\b.*\b(19|20)\d{2}\b|\b(19|20)\d{2}\s*[-–—]\s*((?:19|20)\d{2}|present)\b/i;

const CV_HEADING_SECTIONS = new Set([
  'contact',
  'summary',
  'experience',
  'education',
  'skills',
  'languages',
  'certifications',
  'interests',
  'tools',
]);

function lineText(ln) {
  return String(ln?.cleanedText ?? ln?.text ?? '').trim();
}

function pageLines(lines, page) {
  return (lines || []).filter((l) => (l.page || l.page_number || 1) === page && lineText(l));
}

function lineBox(ln) {
  const x = Number(ln.x) || 0;
  const y = Number(ln.y) || 0;
  const w = Number(ln.width) > 0 ? Number(ln.width) : Math.max(20, lineText(ln).length * 6.5);
  const h = Number(ln.height) > 0 ? Number(ln.height) : 14;
  return { x, y, w, h, cx: x + w / 2, cy: y - h / 2 };
}

function variance(nums) {
  if (!nums.length) return 0;
  const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
  return nums.reduce((a, n) => a + (n - mean) ** 2, 0) / nums.length;
}

/**
 * @param {object[]} lines
 * @param {number} page
 * @param {object} [pageMeta]
 */
function estimateImageDensity(lines, page, pageMeta = {}) {
  if (Number.isFinite(pageMeta.image_area_ratio)) {
    return Math.max(0, Math.min(1, pageMeta.image_area_ratio));
  }
  if (Number.isFinite(pageMeta.image_block_ratio)) {
    return Math.max(0, Math.min(1, pageMeta.image_block_ratio));
  }

  const pageLs = pageLines(lines, page);
  const imageHints = pageLs.filter(
    (l) => l.is_image || l.visual_role === 'image' || l.block_kind === 'image'
  ).length;
  if (imageHints > 0) {
    return Math.min(1, imageHints / Math.max(pageLs.length, 1));
  }

  const textChars = pageLs.reduce((s, l) => s + lineText(l).length, 0);
  if (pageLs.length <= 6 && textChars < 220) return 0.55;
  if (pageLs.length <= 4) return 0.45;
  return 0.1;
}

/**
 * @param {object[]} lines
 * @param {number} page
 */
function gridLayoutScore(lines, page) {
  const pageLs = pageLines(lines, page);
  if (pageLs.length < 3) return 0;

  const boxes = pageLs.map(lineBox);
  const xVar = variance(boxes.map((b) => b.cx));
  const ySpread = Math.max(...boxes.map((b) => b.y)) - Math.min(...boxes.map((b) => b.y));
  const avgLen = pageLs.reduce((s, l) => s + lineText(l).length, 0) / pageLs.length;

  let score = 0;
  if (xVar > 8000) score += 0.35;
  if (pageLs.length >= 4 && pageLs.length <= 12) score += 0.2;
  if (avgLen >= 36 && avgLen <= 120) score += 0.25;
  if (ySpread > 80 && ySpread < 500) score += 0.15;
  return Math.min(1, score);
}

/**
 * @param {object[]} lines
 * @param {number} page
 */
function countCvHeadings(lines, page) {
  const pageLs = pageLines(lines, page);
  const sections = new Set();
  for (const ln of pageLs) {
    const t = lineText(ln);
    const hit = matchSectionHeading(t);
    if (hit?.section && CV_HEADING_SECTIONS.has(hit.section)) {
      sections.add(hit.section);
    }
  }
  return { count: sections.size, sections: [...sections] };
}

/**
 * @param {object[]} lines
 * @param {number} page
 */
function countPortfolioCaptions(lines, page) {
  const pageLs = pageLines(lines, page);
  let captions = 0;
  let marker = false;
  for (const ln of pageLs) {
    const t = lineText(ln);
    if (PORTFOLIO_MARKER_RE.test(t)) marker = true;
    if (PORTFOLIO_CAPTION_RE.test(t)) captions += 1;
    else if (/^personal\b/i.test(t) && t.length >= 16) captions += 1;
  }
  return { captions, marker };
}

/**
 * Human-readable decision reasons for debug / QA.
 * @param {string} page_class
 * @param {object} ctx
 * @returns {string[]}
 */
export function buildPageDecisionReasons(page_class, ctx = {}) {
  /** @type {string[]} */
  const reasons = [];
  const {
    resume_score = 0,
    portfolio_score = 0,
    cv_heading_count = 0,
    has_contact = false,
    has_experience_structure = false,
    has_education_signals = false,
    has_work_signals = false,
    portfolio_caption_count = 0,
    image_density = 0,
    text_density = 0,
    line_count = 0,
    grid_score = 0,
  } = ctx;

  if (page_class === PAGE_DOCUMENT_CLASS.RESUME_CORE) {
    if (cv_heading_count >= 3) reasons.push(`resume: ${cv_heading_count} CV section headings`);
    else if (cv_heading_count >= 1) reasons.push(`resume: CV headings present (${cv_heading_count})`);
    if (has_contact) reasons.push('resume: contact signals (email/phone)');
    if (has_experience_structure) reasons.push('resume: dated work/experience structure');
    if (has_education_signals) reasons.push('resume: education signals');
    if (has_work_signals) reasons.push('resume: work role keywords');
    if (line_count >= 14) reasons.push(`resume: high text line count (${line_count})`);
    if (resume_score > portfolio_score) {
      reasons.push(`resume score ${resume_score} > portfolio score ${portfolio_score}`);
    }
    return reasons.length ? reasons : ['resume: dominant resume signals'];
  }

  if (page_class === PAGE_DOCUMENT_CLASS.PORTFOLIO_PAGE) {
    if (portfolio_caption_count >= 2) {
      reasons.push(`portfolio: repeated artwork captions (${portfolio_caption_count})`);
    } else if (portfolio_caption_count === 1) {
      reasons.push('portfolio: artwork caption detected');
    }
    if (cv_heading_count === 0) reasons.push('portfolio: no standard resume headings');
    if (!has_contact && !has_experience_structure && !has_education_signals) {
      reasons.push('portfolio: lacks contact/work/education signals');
    }
    if (image_density >= 0.4) reasons.push(`portfolio: high image density (${image_density})`);
    if (line_count <= 8) reasons.push(`portfolio: low text line count (${line_count})`);
    if (grid_score >= 0.45) reasons.push(`portfolio: card/grid visual structure (${grid_score})`);
    if (text_density > 0 && text_density <= 95) {
      reasons.push(`portfolio: caption-style text density (${text_density})`);
    }
    if (portfolio_score > resume_score) {
      reasons.push(`portfolio score ${portfolio_score} > resume score ${resume_score}`);
    }
    return reasons.length ? reasons : ['portfolio: dominant gallery signals'];
  }

  if (page_class === PAGE_DOCUMENT_CLASS.MIXED) {
    reasons.push(`mixed: resume score ${resume_score}, portfolio score ${portfolio_score}`);
    reasons.push('mixed: kept in resume parsing path (not excluded)');
    return reasons;
  }

  reasons.push(`unknown: weak signals (resume ${resume_score}, portfolio ${portfolio_score})`);
  reasons.push('unknown: not excluded from resume parsing');
  return reasons;
}

/**
 * Trace which pages are excluded from resume field parsers.
 * @param {object} classification
 */
export function buildExcludedPagesTrace(classification) {
  const pages = classification?.pages || [];
  /** @type {object[]} */
  const trace = [];

  for (const p of pages) {
    const excluded =
      p.page_class === PAGE_DOCUMENT_CLASS.PORTFOLIO_PAGE ? [...PARSING_GATES] : [];
    trace.push({
      page: p.page,
      page_class: p.page_class,
      excluded_from: excluded,
      included_in_resume_parsing: excluded.length === 0,
      confidence: p.confidence,
      decision_reasons: p.decision_reasons || buildPageDecisionReasons(p.page_class, {
        resume_score: p.resume_score,
        portfolio_score: p.portfolio_score,
        cv_heading_count: p.cv_heading_sections?.length || 0,
        has_contact: (p.signals || []).includes('contact-signals'),
        has_experience_structure: (p.signals || []).includes('experience-structure'),
        has_education_signals: (p.signals || []).includes('education-signals'),
        has_work_signals: (p.signals || []).includes('work-signals'),
        portfolio_caption_count: p.portfolio_caption_count,
        image_density: p.image_density,
        text_density: p.text_density,
        line_count: p.line_count,
        grid_score: p.grid_layout_score,
      }),
      signals: p.signals || [],
    });
  }

  return trace;
}

/**
 * @typedef {object} PageDocumentClassification
 * @property {number} page
 * @property {string} page_class
 * @property {number} confidence
 * @property {string[]} signals
 * @property {number} resume_score
 * @property {number} portfolio_score
 * @property {number} line_count
 * @property {number} text_density
 * @property {number} image_density
 */

/**
 * @param {object[]} lines
 * @param {number} [page]
 * @param {object} [opts]
 * @returns {PageDocumentClassification}
 */
export function classifyPageDocument(lines, page = 1, opts = {}) {
  const pageLs = pageLines(lines, page);
  const pageMeta = opts.pageMeta?.[page] || opts.pageMeta || {};
  const layout = opts.pageLayout || classifyPageLayout(lines, page);

  const { count: cvHeadingCount, sections: cvSections } = countCvHeadings(lines, page);
  const { captions: portfolioCaptions, marker: portfolioMarker } = countPortfolioCaptions(lines, page);

  const blob = pageLs.map(lineText).join('\n');
  const hasContact = EMAIL_RE.test(blob) || PHONE_RE.test(blob);
  const hasExperienceStructure = EXPERIENCE_STRUCTURE_RE.test(blob);
  const hasEducationSignals =
    EDUCATION_SIGNAL_RE.test(blob) || cvSections.includes('education');
  const hasWorkSignals = WORK_SIGNAL_RE.test(blob) || cvSections.includes('experience');
  const textChars = pageLs.reduce((s, l) => s + lineText(l).length, 0);
  const textDensity = pageLs.length ? textChars / pageLs.length : 0;
  const imageDensity = estimateImageDensity(lines, page, pageMeta);
  const gridScore = gridLayoutScore(lines, page);

  let resumeScore = 0;
  let portfolioScore = 0;
  /** @type {string[]} */
  const signals = [];

  resumeScore += Math.min(60, cvHeadingCount * 18);
  if (cvHeadingCount >= 3) signals.push('cv-headings-rich');
  else if (cvHeadingCount >= 1) signals.push('cv-headings-present');

  if (hasContact) {
    resumeScore += 14;
    signals.push('contact-signals');
  }
  if (hasExperienceStructure) {
    resumeScore += 12;
    signals.push('experience-structure');
  }
  if (hasEducationSignals) {
    resumeScore += 10;
    signals.push('education-signals');
  }
  if (hasWorkSignals) {
    resumeScore += 8;
    signals.push('work-signals');
  }
  if (layout?.layout_type === 'sidebar_left' || layout?.layout_type === 'sidebar_right') {
    resumeScore += 10;
    signals.push('sidebar-layout');
  }
  if (pageLs.length >= 14) {
    resumeScore += 8;
    signals.push('high-text-line-count');
  }
  if (textDensity >= 18 && textDensity <= 90) {
    resumeScore += 6;
    signals.push('resume-text-density');
  }

  if (portfolioMarker) {
    portfolioScore += 35;
    signals.push('portfolio-marker');
  }
  portfolioScore += Math.min(40, portfolioCaptions * 18);
  if (portfolioCaptions >= 2) signals.push('artwork-captions-repeated');

  if (cvHeadingCount === 0) {
    portfolioScore += 18;
    signals.push('no-cv-headings');
  } else if (cvHeadingCount === 1 && portfolioCaptions >= 1) {
    portfolioScore += 10;
    signals.push('sparse-headings-with-captions');
  }

  if (!hasContact && !hasExperienceStructure && !hasEducationSignals) {
    portfolioScore += 14;
    signals.push('no-resume-core-signals');
  }

  if (pageLs.length <= 8) {
    portfolioScore += 12;
    signals.push('low-line-count');
  }
  if (imageDensity >= 0.4) {
    portfolioScore += Math.round(imageDensity * 22);
    signals.push('high-image-density');
  }
  if (gridScore >= 0.45) {
    portfolioScore += Math.round(gridScore * 20);
    signals.push('card-grid-layout');
  }
  if (textDensity > 95 && portfolioCaptions >= 1) {
    portfolioScore += 8;
    signals.push('long-caption-lines');
  }

  let page_class = PAGE_DOCUMENT_CLASS.UNKNOWN;
  let confidence = 0.45;

  if (resumeScore >= 52 && portfolioScore < 38) {
    page_class = PAGE_DOCUMENT_CLASS.RESUME_CORE;
    confidence = Math.min(0.98, 0.62 + resumeScore / 200);
  } else if (portfolioScore >= 46 && resumeScore < 42) {
    page_class = PAGE_DOCUMENT_CLASS.PORTFOLIO_PAGE;
    confidence = Math.min(0.96, 0.58 + portfolioScore / 200);
  } else if (resumeScore >= 38 && portfolioScore >= 38) {
    page_class = PAGE_DOCUMENT_CLASS.MIXED;
    confidence = 0.62;
    signals.push('mixed-signals');
  } else if (resumeScore >= 40) {
    page_class = PAGE_DOCUMENT_CLASS.RESUME_CORE;
    confidence = 0.55;
    signals.push('resume-lean');
  } else if (portfolioScore >= 40) {
    page_class = PAGE_DOCUMENT_CLASS.PORTFOLIO_PAGE;
    confidence = 0.55;
    signals.push('portfolio-lean');
  }

  const decisionCtx = {
    resume_score: resumeScore,
    portfolio_score: portfolioScore,
    cv_heading_count: cvHeadingCount,
    has_contact: hasContact,
    has_experience_structure: hasExperienceStructure,
    has_education_signals: hasEducationSignals,
    has_work_signals: hasWorkSignals,
    portfolio_caption_count: portfolioCaptions,
    image_density: imageDensity,
    text_density: textDensity,
    line_count: pageLs.length,
    grid_score: gridScore,
  };
  const decision_reasons = buildPageDecisionReasons(page_class, decisionCtx);

  return {
    page,
    page_class,
    confidence: Math.round(confidence * 1000) / 1000,
    signals,
    decision_reasons,
    resume_score: resumeScore,
    portfolio_score: portfolioScore,
    line_count: pageLs.length,
    text_density: Math.round(textDensity * 10) / 10,
    image_density: Math.round(imageDensity * 1000) / 1000,
    grid_layout_score: Math.round(gridScore * 1000) / 1000,
    cv_heading_sections: cvSections,
    portfolio_caption_count: portfolioCaptions,
    has_contact: hasContact,
    has_experience_structure: hasExperienceStructure,
    has_education_signals: hasEducationSignals,
    has_work_signals: hasWorkSignals,
    layout_type: layout?.layout_type || null,
    classifier: PAGE_DOCUMENT_CLASSIFIER,
    parsing_gate:
      page_class === PAGE_DOCUMENT_CLASS.PORTFOLIO_PAGE
        ? { excluded_from: [...PARSING_GATES], included: false }
        : { excluded_from: [], included: true },
  };
}

/**
 * @param {object[]} lines
 * @param {object} [opts]
 */
export function classifyDocumentPages(lines, opts = {}) {
  const pages = new Set((lines || []).map((l) => l.page || l.page_number || 1));
  if (!pages.size) pages.add(1);

  const pageLayouts = opts.pageLayouts?.pages || opts.pageLayouts || [];
  const layoutByPage = new Map(
    (Array.isArray(pageLayouts) ? pageLayouts : []).map((p) => [p.page, p])
  );

  const classified = [...pages].sort((a, b) => a - b).map((page) =>
    classifyPageDocument(lines, page, {
      ...opts,
      pageLayout: layoutByPage.get(page) || null,
      pageMeta: opts.pageMeta?.[page] ? { [page]: opts.pageMeta[page] } : opts.pageMeta,
    })
  );

  const resumeCorePages = classified
    .filter((p) => p.page_class === PAGE_DOCUMENT_CLASS.RESUME_CORE)
    .map((p) => p.page);
  const portfolioPages = classified
    .filter((p) => p.page_class === PAGE_DOCUMENT_CLASS.PORTFOLIO_PAGE)
    .map((p) => p.page);

  const excluded_pages_trace = buildExcludedPagesTrace({ pages: classified });

  const result = {
    stage: 'page_document_classification',
    classifier: PAGE_DOCUMENT_CLASSIFIER,
    pages: classified,
    resume_core_pages: resumeCorePages,
    portfolio_pages: portfolioPages,
    excluded_pages: portfolioPages.slice(),
    excluded_pages_trace,
    parsing_gates: [...PARSING_GATES],
    at: new Date().toISOString(),
  };

  result.portfolio_items = extractPortfolioItems(lines, result);

  hirelyDebugLog('PAGE_DOCUMENT_CLASSIFIER', {
    pages: classified.map((p) => ({
      page: p.page,
      page_class: p.page_class,
      confidence: p.confidence,
      decision_reasons: p.decision_reasons,
    })),
    resume_core_pages: resumeCorePages,
    portfolio_pages: portfolioPages,
    excluded_pages_trace,
    portfolio_items: result.portfolio_items.length,
  });

  if (typeof globalThis !== 'undefined') {
    globalThis.__HIRELY_PAGE_DOCUMENT_CLASSIFIER = result;
  }

  return result;
}

/**
 * @param {object} classification
 * @param {number} page
 */
export function isResumeCorePage(classification, page) {
  const hit = classification?.pages?.find((p) => p.page === page);
  if (!hit) return true;
  return (
    hit.page_class === PAGE_DOCUMENT_CLASS.RESUME_CORE ||
    hit.page_class === PAGE_DOCUMENT_CLASS.MIXED
  );
}

/**
 * @param {object} classification
 * @param {number} page
 */
export function isPortfolioPage(classification, page) {
  const hit = classification?.pages?.find((p) => p.page === page);
  return hit?.page_class === PAGE_DOCUMENT_CLASS.PORTFOLIO_PAGE;
}

/**
 * Exclude portfolio-only pages from CV field parsing (contact, experience, education, skills).
 * Mixed pages are kept for resume parsing.
 * @param {object[]} lines
 * @param {object} classification
 */
export function filterLinesForResumeParsing(lines, classification) {
  if (!classification?.pages?.length) return lines || [];
  return (lines || []).filter((l) => {
    const page = l.page || l.page_number || 1;
    return isResumeCorePage(classification, page);
  });
}

/**
 * @param {object[]} blocks
 * @param {object} classification
 */
export function filterSpatialBlocksForResumeParsing(blocks, classification) {
  if (!classification?.pages?.length) return blocks || [];
  return (blocks || []).filter((b) => {
    const page = b.page_number || b.page || 1;
    if (!isResumeCorePage(classification, page)) return false;
    return true;
  });
}

/**
 * Hard guard — portfolio pages must never supply resume-core spatial blocks.
 * @param {object} classification
 * @param {object[]} blocks
 */
export function assertPortfolioPagesExcludedFromSpatialBlocks(classification, blocks) {
  const portfolioPages = (classification?.pages || [])
    .filter((p) => p.page_class === PAGE_DOCUMENT_CLASS.PORTFOLIO_PAGE)
    .map((p) => p.page);
  if (!portfolioPages.length) return { ok: true, leaked: [] };
  const leaked = (blocks || []).filter((b) =>
    portfolioPages.includes(b.page_number || b.page || 1)
  );
  return { ok: leaked.length === 0, leaked, portfolioPages };
}

/**
 * @param {object[]} segments
 * @param {object} classification
 */
export function filterSegmentsForResumeParsing(segments, classification) {
  if (!classification?.pages?.length) return segments || [];
  return (segments || []).filter((s) => {
    const page = s.page_number || s.page || 1;
    return isResumeCorePage(classification, page);
  });
}

/**
 * @typedef {object} PortfolioItem
 * @property {string} title
 * @property {number} page_number
 * @property {string} source_text
 * @property {number} confidence
 */

/**
 * @param {object[]} lines
 * @param {object} classification
 * @returns {PortfolioItem[]}
 */
export function extractPortfolioItems(lines, classification) {
  const portfolioPages = new Set(classification?.portfolio_pages || []);
  if (!portfolioPages.size) {
    for (const p of classification?.pages || []) {
      if (p.page_class === PAGE_DOCUMENT_CLASS.PORTFOLIO_PAGE) {
        portfolioPages.add(p.page);
      }
    }
  }

  /** @type {PortfolioItem[]} */
  const items = [];
  const seen = new Set();

  for (const ln of lines || []) {
    const page = ln.page || ln.page_number || 1;
    if (!portfolioPages.has(page)) continue;

    const t = lineText(ln);
    if (!t || t.length < 8) continue;
    if (/^---\s*page\s*\d+/i.test(t)) continue;

    const key = `${page}|${t.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    let confidence = 0.62;
    if (PORTFOLIO_CAPTION_RE.test(t)) confidence += 0.2;
    if (/^personal\b/i.test(t)) confidence += 0.08;
    if (t.length >= 24) confidence += 0.05;

    items.push({
      title: t.slice(0, 160),
      page_number: page,
      source_text: t,
      confidence: Math.min(1, Math.round(confidence * 1000) / 1000),
    });
  }

  return items;
}

/**
 * @param {object} classification
 */
export function buildPageDocumentClassificationDebug(classification) {
  return {
    classifier: classification?.classifier,
    at: classification?.at,
    resume_core_pages: classification?.resume_core_pages || [],
    portfolio_pages: classification?.portfolio_pages || [],
    excluded_pages: classification?.excluded_pages || classification?.portfolio_pages || [],
    excluded_pages_trace: classification?.excluded_pages_trace || buildExcludedPagesTrace(classification),
    parsing_gates: classification?.parsing_gates || [...PARSING_GATES],
    portfolio_item_count: classification?.portfolio_items?.length || 0,
    portfolio_items: (classification?.portfolio_items || []).map((i) => ({
      title: i.title,
      page_number: i.page_number,
      confidence: i.confidence,
    })),
    pages: (classification?.pages || []).map((p) => ({
      page: p.page,
      page_class: p.page_class,
      confidence: p.confidence,
      signals: p.signals,
      decision_reasons: p.decision_reasons,
      resume_score: p.resume_score,
      portfolio_score: p.portfolio_score,
      line_count: p.line_count,
      text_density: p.text_density,
      image_density: p.image_density,
      grid_layout_score: p.grid_layout_score,
      cv_heading_sections: p.cv_heading_sections,
      portfolio_caption_count: p.portfolio_caption_count,
      has_contact: p.has_contact,
      has_education_signals: p.has_education_signals,
      has_work_signals: p.has_work_signals,
      parsing_gate: p.parsing_gate,
    })),
  };
}
