/**
 * HIRELY P0 — CV preview density audit (detected → final → rendered).
 */
import fs from 'fs';
import vm from 'vm';
import path from 'path';
import { fileURLToPath } from 'url';
import { runHirelyImportFromText } from '../pipeline/hirely-import.js';
import { buildFinalResumeData } from '../validation/final-resume-contract.js';
import { resumeDataToCvData } from '../resume-data.js';
import {
  LOCK_SECTIONS,
  countSourceSections,
  scoreTemplateCompletenessLock,
} from '../../ui/templates/template-completeness.js';
import { PRODUCTION_TEMPLATE_IDS } from '../../ui/templates/production-template-ids.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../../..');

export const AUDIT_SECTIONS = Object.freeze([
  'identity',
  'summary',
  'experiences',
  'education',
  'skills',
  'clients',
  'projects',
  'tools',
  'languages',
]);

const REVIEW_FIELD_TO_SECTION = {
  'identity.name': 'identity',
  'identity.title': 'identity',
  'identity.email': 'identity',
  'identity.phone': 'identity',
  experience: 'experiences',
  experiences: 'experiences',
  education: 'education',
  skills: 'skills',
  tools: 'tools',
  languages: 'languages',
  clients: 'clients',
  projects: 'projects',
  summary: 'summary',
  raw: 'summary',
};

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, (m) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[m]
  );
}

function loadTemplates() {
  const code = fs.readFileSync(path.join(ROOT, 'src/ui/templates/cv-templates.js'), 'utf8');
  const sandbox = { console };
  sandbox.window = sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  sandbox.initHirelyTemplates({
    esc,
    sectionLabel: (k) =>
      ({
        experience: 'Experience',
        education: 'Education',
        skills: 'Skills',
        clients: 'Clients',
        tools: 'Tools',
        languages: 'Languages',
        projects: 'Projects',
        profile: 'Profile',
        pendingReview: 'À vérifier',
      }[k] || k),
    cvBlock: (title, html) =>
      html
        ? `<section class="cvSection"><h3 class="cvSectionTitle">${title}</h3><div class="cvSectionBody">${html}</div></section>`
        : '',
    cvSkillsHtml: (skills) => `<p class="cvSkillLine">${skills.map(esc).join(' · ')}</p>`,
    getPhotoHtml: () => '',
  });
  return sandbox.HirelyTemplates;
}

function countResumeSection(rd, key) {
  if (!rd) return 0;
  if (key === 'identity') {
    const id = rd.identity || {};
    return [id.name, id.title, id.email, id.phone].filter((s) => String(s || '').trim()).length;
  }
  if (key === 'summary') return String(rd.summary || '').trim() ? 1 : 0;
  const arr = rd[key];
  return Array.isArray(arr) ? arr.filter((x) => x != null && String(x === typeof x ? x : JSON.stringify(x)).trim()).length : 0;
}

function countReviewQueueBySection(queue = []) {
  const counts = Object.fromEntries(AUDIT_SECTIONS.map((k) => [k, 0]));
  for (const item of queue) {
    if (!item || (item.status && item.status !== 'pending')) continue;
    const field = String(item.field || item.detectedType || 'raw').trim();
    const section = REVIEW_FIELD_TO_SECTION[field] || 'summary';
    if (counts[section] != null) counts[section] += 1;
  }
  return counts;
}

function mergeDetectedCounts(resumeData, reviewQueue) {
  const base = Object.fromEntries(AUDIT_SECTIONS.map((k) => [k, countResumeSection(resumeData, k)]));
  const rq = countReviewQueueBySection(reviewQueue);
  for (const key of AUDIT_SECTIONS) {
    base[key] += rq[key] || 0;
  }
  return base;
}

function countRenderedSections(html, frd, pendingReview = []) {
  const lock = scoreTemplateCompletenessLock(html, frd);
  const counts = {};
  for (const key of AUDIT_SECTIONS) {
    const sec = lock.sections?.[key];
    counts[key] = sec?.visible ?? 0;
  }
  const pendingEntries = (html.match(/cvPendingReviewEntry/g) || []).length;
  if (pendingEntries) {
    counts._pendingReview = pendingEntries;
    if (/cvSection--pendingReview/.test(html)) {
      for (const item of pendingReview) {
        if (!item || (item.status && item.status !== 'pending')) continue;
        const field = String(item.field || item.detectedType || 'raw').trim();
        const section = REVIEW_FIELD_TO_SECTION[field] || 'summary';
        if (counts[section] != null) counts[section] += 1;
      }
    }
  }
  return { counts, lock };
}

function densityPct(detected, rendered) {
  const d = Object.values(detected).reduce((a, b) => a + (b || 0), 0);
  const r = Object.values(rendered).reduce((a, b) => a + (b || 0), 0);
  if (!d) return 100;
  return Math.round((r / d) * 100);
}

/**
 * @param {string} rawText
 * @param {{ templateId?: string }} [opts]
 */
export async function auditCvPreviewDensity(rawText, opts = {}) {
  const templateId = opts.templateId || 'ats';
  const importResult = await runHirelyImportFromText(rawText, {
    trusted: true,
    forceContinue: true,
  });
  const resumeData = importResult.resumeData;
  const reviewQueue = importResult.reviewQueue || [];
  const built = buildFinalResumeData(resumeData, { existingReview: reviewQueue });
  const frd = built.finalResumeData;
  const pending = [...reviewQueue, ...(built.reviewItems || [])].filter(
    (it) => it && (!it.status || it.status === 'pending')
  );

  const detected = mergeDetectedCounts(resumeData, pending);
  const finalCounts = frd ? countSourceSections(frd).counts : Object.fromEntries(AUDIT_SECTIONS.map((k) => [k, 0]));

  const cv = frd
    ? {
        ...resumeDataToCvData(frd, { skipNormalize: true }),
        _fromFinalResumeData: true,
        _pendingReview: pending,
      }
    : null;

  const T = loadTemplates();
  const html = cv ? T.render(cv, templateId) : '';
  const rendered = frd
    ? countRenderedSections(html, frd, pending)
    : { counts: {}, lock: { score: 0, pass: false } };

  const sectionRows = {};
  for (const key of AUDIT_SECTIONS) {
    sectionRows[key] = {
      DETECTED_DATA_COUNT: detected[key] || 0,
      FINAL_DATA_COUNT: finalCounts[key] ?? 0,
      RENDERED_DATA_COUNT: rendered.counts[key] ?? 0,
      dropFinal: Math.max(0, (detected[key] || 0) - (finalCounts[key] ?? 0)),
      dropRender: Math.max(0, (finalCounts[key] ?? 0) - (rendered.counts[key] ?? 0)),
    };
  }

  const previewDensity = densityPct(detected, rendered.counts);

  const lossPoints = [];
  for (const [key, row] of Object.entries(sectionRows)) {
    if (row.dropFinal > 0) lossPoints.push({ stage: 'finalResumeData', section: key, count: row.dropFinal });
    if (row.dropRender > 0) lossPoints.push({ stage: 'templateRenderer', section: key, count: row.dropRender });
  }

  return {
    templateId,
    detected,
    final: finalCounts,
    rendered: rendered.counts,
    sectionRows,
    previewDensity,
    pendingReviewRendered: rendered.counts._pendingReview || 0,
    pendingReviewCount: pending.length,
    visibilityScore: rendered.lock?.score ?? 0,
    visibilityPass: rendered.lock?.pass ?? false,
    lossPoints,
    htmlLength: html.length,
    contractRenderable: built.contract?.renderable ?? false,
  };
}
