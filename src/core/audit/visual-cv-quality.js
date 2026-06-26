/**
 * P0 — Visual CV quality scoring (browser DOM, not JSON counts).
 */

export const VISUAL_CV_QUALITY_VERSION = 'VISUAL_CV_QUALITY_V1';
export const REAL_VISUAL_BROWSER_QA_VERSION = 'REAL_VISUAL_BROWSER_QA_V1';

/** Required content hierarchy (identity handled via header). */
export const CANONICAL_SECTION_ORDER = Object.freeze([
  'summary',
  'experience',
  'clients',
  'projects',
  'education',
  'skills',
  'tools',
  'languages',
]);

export const VISUAL_MIN_PAGE1_FILL = 0.4;
export const VISUAL_MAX_BLANK_ZONE_RATIO = 0.38;
export const VISUAL_MIN_PAGE1_CHARS = 180;

const SECTION_CLASS_MAP = Object.freeze({
  summary: /\bcvSection--summary\b|\bcvLead\b/,
  experience: /\bcvSection--experience\b/,
  clients: /\bcvSection--clients\b/,
  projects: /\bcvSection--projects\b/,
  education: /\bcvSection--education\b/,
  skills: /\bcvSection--skills\b/,
  tools: /\bcvSection--tools\b|\bcvSection--software\b/,
  languages: /\bcvSection--languages\b/,
});

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * @param {ParentNode|null} root
 * @returns {string[]}
 */
export function extractSectionOrderFromDom(root) {
  if (!root) return [];
  const order = [];
  const seen = new Set();
  const nodes = root.querySelectorAll(
    '.cvHead, .cvLead, .cvSection, .cvMetaFooter .cvSection, .cvMetaFooter > .cvSection'
  );
  for (const node of nodes) {
    if (node.classList.contains('cvHead')) {
      if (!seen.has('identity')) {
        seen.add('identity');
        order.push('identity');
      }
      continue;
    }
    if (node.classList.contains('cvLead') && !seen.has('summary')) {
      seen.add('summary');
      order.push('summary');
      continue;
    }
    for (const [key, re] of Object.entries(SECTION_CLASS_MAP)) {
      if (re.test(node.className) && !seen.has(key)) {
        seen.add(key);
        order.push(key);
        break;
      }
    }
  }
  return order;
}

/**
 * @param {string[]} order
 * @param {Record<string, boolean>} present
 */
export function scoreSectionOrder(order, present = {}) {
  const issues = [];
  const filtered = order.filter((k) => k !== 'identity' && present[k]);
  const rank = (key) => {
    const i = CANONICAL_SECTION_ORDER.indexOf(key);
    return i === -1 ? 99 : i;
  };
  for (let i = 0; i < filtered.length - 1; i++) {
    const a = filtered[i];
    const b = filtered[i + 1];
    if (rank(a) > rank(b)) {
      issues.push(`${a}_before_${b}`);
    }
  }
  if (present.experience && present.skills) {
    const expIdx = filtered.indexOf('experience');
    const skillIdx = filtered.indexOf('skills');
    if (skillIdx !== -1 && expIdx !== -1 && skillIdx < expIdx) {
      issues.push('skills_before_experience');
    }
  }
  if (present.experience && present.tools) {
    const expIdx = filtered.indexOf('experience');
    const toolIdx = filtered.indexOf('tools');
    if (toolIdx !== -1 && expIdx !== -1 && toolIdx < expIdx) {
      issues.push('tools_before_experience');
    }
  }
  const score = issues.length ? Math.max(0, 100 - issues.length * 25) : 100;
  return { score, issues, order: filtered };
}

/**
 * @param {HTMLElement|null} sheet
 * @param {number} pageHeightPx
 */
export function measurePageFill(sheet, pageHeightPx = 1123) {
  if (!sheet) return { fillRatio: 0, textLen: 0, blankRatio: 1 };
  const surface = sheet.querySelector('.cvA4Sheet__surface') || sheet;
  const text = String(surface.innerText || '').replace(/\s+/g, ' ').trim();
  const textLen = text.length;
  const contentPx = Math.max(surface.scrollHeight || 0, surface.offsetHeight || 0);
  const fillRatio = pageHeightPx > 0 ? Math.min(1, contentPx / pageHeightPx) : 0;
  const blankRatio = Math.max(0, 1 - fillRatio);
  return { fillRatio, textLen, blankRatio, contentPx };
}

/**
 * @param {ParentNode|null} cvDoc
 */
export function page1HasExperience(cvDoc) {
  if (!cvDoc) return false;
  const first =
    cvDoc.querySelector('.cvA4Stack > .cvA4Sheet:first-child') ||
    cvDoc.querySelector('.cvInner') ||
    cvDoc;
  return !!first.querySelector(
    '.cvSection--experience .cvExpEntry, .cvSection--experience .cvTimelineItem, .cvSection--experience .cvExpList'
  );
}

/**
 * @param {ParentNode|null} cvDoc
 */
export function findDuplicateSections(cvDoc) {
  if (!cvDoc) return [];
  const counts = {};
  const dups = [];
  for (const key of CANONICAL_SECTION_ORDER) {
    const re = SECTION_CLASS_MAP[key];
    if (!re) continue;
    const n = cvDoc.querySelectorAll(`.cvSection`).length
      ? [...cvDoc.querySelectorAll('.cvSection')].filter((el) => re.test(el.className)).length
      : 0;
    if (n > 1) dups.push({ section: key, count: n });
  }
  return dups;
}

/**
 * @param {object} detectionRows
 * @param {Record<string, boolean>} present
 */
export function scoreDetectionParity(detectionRows = [], present = {}) {
  const issues = [];
  const rowMap = Object.fromEntries((detectionRows || []).map((r) => [r.key, r]));
  if (present.education && rowMap.education && !rowMap.education.ok) {
    issues.push('education_detected_but_panel_miss');
  }
  if (present.experience && rowMap.experience && !rowMap.experience.ok) {
    issues.push('experience_detected_but_panel_miss');
  }
  if (present.skills && rowMap.skills && !rowMap.skills.ok) {
    issues.push('skills_detected_but_panel_miss');
  }
  return { score: issues.length ? 0 : 100, issues };
}

/**
 * @param {object} input
 */
export function scoreVisualCvQuality(input = {}) {
  const cvDoc = input.cvDoc || null;
  const pageHeightPx = input.pageHeightPx || 1123;
  const detectionRows = input.detectionRows || [];
  const dataPresent = input.dataPresent || {};

  const root = cvDoc?.querySelector('.cvA4Stack .cvA4Sheet:first-child .cvA4Sheet__surface')
    || cvDoc?.querySelector('.cvInner')
    || cvDoc;

  const order = extractSectionOrderFromDom(root || cvDoc);
  const present = {
    summary: dataPresent.summary ?? order.includes('summary'),
    experience: dataPresent.experience ?? order.includes('experience'),
    clients: dataPresent.clients ?? order.includes('clients'),
    projects: dataPresent.projects ?? order.includes('projects'),
    education: dataPresent.education ?? order.includes('education'),
    skills: dataPresent.skills ?? order.includes('skills'),
    tools: dataPresent.tools ?? order.includes('tools'),
    languages: dataPresent.languages ?? order.includes('languages'),
  };

  const orderAudit = scoreSectionOrder(order, present);
  const firstSheet = cvDoc?.querySelector('.cvA4Stack > .cvA4Sheet:first-child') || cvDoc;
  const page1 = measurePageFill(firstSheet, pageHeightPx);
  const expOnPage1 = !present.experience || page1HasExperience(cvDoc);
  const dups = findDuplicateSections(cvDoc);
  const detection = scoreDetectionParity(detectionRows, present);

  const checks = {
    page1Density:
      page1.fillRatio >= VISUAL_MIN_PAGE1_FILL && page1.textLen >= VISUAL_MIN_PAGE1_CHARS,
    sectionOrder: orderAudit.score >= 75 && !orderAudit.issues.includes('skills_before_experience'),
    noGiantBlank: page1.blankRatio <= VISUAL_MAX_BLANK_ZONE_RATIO,
    experienceOnPage1: expOnPage1,
    noDuplicateSections: dups.length === 0,
    detectionParity: detection.score === 100,
    meaningfulIdentity: !!(input.identityName && String(input.identityName).trim().length > 2),
  };

  const weights = {
    page1Density: 20,
    sectionOrder: 20,
    noGiantBlank: 15,
    experienceOnPage1: 20,
    noDuplicateSections: 10,
    detectionParity: 10,
    meaningfulIdentity: 5,
  };

  let visualScore = 0;
  for (const [k, w] of Object.entries(weights)) {
    if (checks[k]) visualScore += w;
  }

  const pass = Object.values(checks).every(Boolean);

  return {
    version: VISUAL_CV_QUALITY_VERSION,
    visualScore,
    pass,
    checks,
    order: orderAudit.order,
    orderIssues: orderAudit.issues,
    page1,
    duplicates: dups,
    detectionIssues: detection.issues,
  };
}

/**
 * Score real visual browser QA from a DOM snapshot (Playwright page.evaluate).
 * @param {object} snapshot
 */
export function scoreRealVisualBrowser(snapshot = {}) {
  const dataPresent = snapshot.dataPresent || {};
  const page1 = snapshot.page1 || {};
  const exportState = snapshot.export || {};
  const dom = snapshot.dom || {};
  const internalClip = snapshot.internalClip || [];
  const duplicates = snapshot.duplicateSections || [];

  const checks = {
    identityVisible: !!dom.identityVisible,
    experienceOnPage1: !dataPresent.experience || !!snapshot.experienceOnPage1,
    clientsVisible: !dataPresent.clients || !!dom.clientsVisible,
    educationVisible: !dataPresent.education || !!dom.educationVisible,
    noGiantEmptyPage1:
      page1.fillRatio >= VISUAL_MIN_PAGE1_FILL && page1.textLen >= VISUAL_MIN_PAGE1_CHARS,
    noInternalA4Scroll: internalClip.length === 0,
    noDuplicateSections: duplicates.length === 0,
    exportShowsCv:
      exportState.docStep === 'export' &&
      exportState.previewVisible &&
      exportState.cvVisible &&
      exportState.cvLive &&
      (exportState.cvTextLen || 0) >= VISUAL_MIN_PAGE1_CHARS,
    cvLooksComplete:
      !!dom.identityVisible &&
      (exportState.cvTextLen || page1.textLen || 0) >= VISUAL_MIN_PAGE1_CHARS &&
      (!dataPresent.experience || !!snapshot.experienceOnPage1),
  };

  const weights = {
    identityVisible: 12,
    experienceOnPage1: 18,
    clientsVisible: 10,
    educationVisible: 10,
    noGiantEmptyPage1: 12,
    noInternalA4Scroll: 10,
    noDuplicateSections: 8,
    exportShowsCv: 12,
    cvLooksComplete: 8,
  };

  let visualScore = 0;
  for (const [k, w] of Object.entries(weights)) {
    if (checks[k]) visualScore += w;
  }

  const issues = [];
  for (const [k, ok] of Object.entries(checks)) {
    if (!ok) issues.push(k);
  }

  const pass = Object.values(checks).every(Boolean);

  return {
    version: REAL_VISUAL_BROWSER_QA_VERSION,
    visualScore,
    pass,
    checks,
    issues,
    page1,
    internalClip,
    duplicates,
  };
}
