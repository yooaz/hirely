/**
 * HIRELY P0 — Full pipeline data-loss audit.
 * RAW_TEXT → OCR → PARSER → NORMALIZATION → REVIEW_QUEUE → FINAL_RESUME_DATA → TEMPLATE → PDF
 */
import fs from 'fs';
import vm from 'vm';
import path from 'path';
import { fileURLToPath } from 'url';
import { runProductionExtractionPipeline } from '../pipeline/production-pipeline.js';
import { productionToHirelyImportResult } from '../pipeline/hirely-import.js';
import { buildFinalResumeData } from '../validation/final-resume-contract.js';
import { normalizeResumeData, resumeDataToCvData } from '../resume-data.js';
import { cleanExtraction } from '../parsing/rich-parser.js';
import { splitLinesBySectionAnchors } from '../parsing/section-anchor-extract.js';
import { NAME_UNCERTAIN_LABEL, TITLE_UNCERTAIN_LABEL } from '../parsing/parser-recovery.js';
import { scoreTemplateCompletenessLock } from '../../ui/templates/template-completeness.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../../..');

export const PIPELINE_FIELDS = Object.freeze([
  'name',
  'title',
  'summary',
  'experience',
  'education',
  'skills',
  'tools',
  'languages',
  'clients',
  'projects',
  'awards',
  'portfolio',
  'linkedin',
]);

export const PIPELINE_STAGES = Object.freeze([
  'DETECTED',
  'NORMALIZED',
  'REVIEWED',
  'COMMITTED',
  'RENDERED',
  'EXPORTED',
]);

const UNCERTAIN = new Set([
  NAME_UNCERTAIN_LABEL,
  TITLE_UNCERTAIN_LABEL,
  'Information non détectée',
  'Nom à confirmer',
  'Poste à compléter',
]);

const REVIEW_FIELD_MAP = {
  'identity.name': 'name',
  'identity.title': 'title',
  'identity.linkedin': 'linkedin',
  'identity.website': 'portfolio',
  experience: 'experience',
  experiences: 'experience',
  education: 'education',
  skills: 'skills',
  tools: 'tools',
  languages: 'languages',
  clients: 'clients',
  projects: 'projects',
  awards: 'awards',
  summary: 'summary',
  raw: 'summary',
};

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const LINKEDIN_RE = /linkedin\.com/i;
const URL_RE = /https?:\/\/|www\.\w/i;

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, (m) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[m]
  );
}

function scalarOk(val) {
  const s = String(val || '').trim();
  return s.length > 0 && !UNCERTAIN.has(s) ? 1 : 0;
}

function listCount(arr) {
  if (!Array.isArray(arr)) return 0;
  return arr.filter((x) => {
    if (x == null) return false;
    if (typeof x === 'string') return String(x).trim().length > 0;
    if (typeof x === 'object') return !!(x.role || x.company || x.school || x.degree || (x.bullets || []).length);
    return false;
  }).length;
}

export function countFromStructured(sr, field) {
  if (!sr) return field === 'name' || field === 'title' || field === 'summary' || field === 'linkedin' || field === 'portfolio' ? 0 : 0;
  const id = sr.identity || {};
  switch (field) {
    case 'name':
      return scalarOk(id.name);
    case 'title':
      return scalarOk(id.title);
    case 'linkedin':
      return scalarOk(id.linkedin);
    case 'portfolio':
      return listCount(sr.portfolioLinks) + scalarOk(id.website || id.portfolio);
    case 'summary':
      return scalarOk(sr.summary);
    case 'experience':
      return listCount(sr.experiences);
    case 'education':
      return listCount(sr.education);
    case 'skills':
      return listCount(sr.skills);
    case 'tools':
      return listCount(sr.tools);
    case 'languages':
      return listCount(sr.languages);
    case 'clients':
      return listCount(sr.clients);
    case 'projects':
      return listCount(sr.projects);
    case 'awards':
      return listCount(sr.awards);
    default:
      return 0;
  }
}

export function countFromResumeData(rd, field) {
  if (!rd) return 0;
  const id = rd.identity || {};
  switch (field) {
    case 'name':
      return scalarOk(id.name);
    case 'title':
      return scalarOk(id.title);
    case 'linkedin':
      return scalarOk(id.linkedin);
    case 'portfolio':
      return listCount(rd.portfolioLinks) + scalarOk(id.website || id.portfolio);
    case 'summary':
      return scalarOk(rd.summary);
    case 'experience':
      return listCount(rd.experiences);
    case 'education':
      return listCount(rd.education);
    case 'skills':
      return listCount(rd.skills);
    case 'tools':
      return listCount(rd.tools);
    case 'languages':
      return listCount(rd.languages);
    case 'clients':
      return listCount(rd.clients);
    case 'projects':
      return listCount(rd.projects);
    case 'awards':
      return listCount(rd.awards);
    default:
      return 0;
  }
}

/** Heuristic field counts from plain text (RAW / OCR). */
export function detectFieldsFromText(text) {
  const raw = String(text || '').trim();
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const sections = splitLinesBySectionAnchors(lines);
  const top = sections.top || [];

  const counts = Object.fromEntries(PIPELINE_FIELDS.map((f) => [f, 0]));

  if (top[0] && top[0].length >= 2 && top[0].length < 80 && !EMAIL_RE.test(top[0])) counts.name = 1;
  if (top[1] && top[1].length >= 2 && top[1].length < 100 && !EMAIL_RE.test(top[1])) counts.title = 1;

  for (const line of lines) {
    if (EMAIL_RE.test(line)) counts.name = counts.name || 0;
    if (LINKEDIN_RE.test(line)) counts.linkedin = 1;
    if (URL_RE.test(line) && !LINKEDIN_RE.test(line)) counts.portfolio = Math.max(counts.portfolio, 1);
  }

  const summaryLines = sections.summary || [];
  if (summaryLines.length) counts.summary = summaryLines.filter((l) => l.length > 24).length || 1;

  counts.experience = listCount(sections.experience || sections.experiences || []);
  counts.education = listCount(sections.education || []);
  counts.skills = listCount(sections.skills || []);
  counts.tools = listCount(sections.tools || sections.software || []);
  counts.languages = listCount(sections.languages || []);
  counts.clients = listCount(sections.clients || []);
  counts.projects = listCount(sections.projects || []);
  counts.awards = listCount(sections.awards || []);

  if (!counts.experience && lines.some((l) => /\b(19|20)\d{2}\b/.test(l) && l.length > 12)) {
    counts.experience = Math.max(1, Math.floor(lines.filter((l) => /\b(19|20)\d{2}\b/.test(l)).length / 2));
  }

  return counts;
}

function countReviewQueue(queue = []) {
  const counts = Object.fromEntries(PIPELINE_FIELDS.map((f) => [f, 0]));
  for (const item of queue) {
    if (!item || (item.status && item.status !== 'pending')) continue;
    const field = REVIEW_FIELD_MAP[String(item.field || item.detectedType || 'raw').trim()] || null;
    if (field) counts[field] += 1;
  }
  return counts;
}

function countRendered(html, frd, pending = []) {
  const lock = scoreTemplateCompletenessLock(html, frd);
  const counts = Object.fromEntries(PIPELINE_FIELDS.map((f) => [f, 0]));

  counts.name = scalarOk(frd?.identity?.name) && /cvName/.test(html) ? 1 : 0;
  counts.title = scalarOk(frd?.identity?.title) && /cvTitle/.test(html) ? 1 : 0;
  counts.linkedin = scalarOk(frd?.identity?.linkedin) && norm(html).includes(norm(frd.identity.linkedin)) ? 1 : 0;
  counts.portfolio =
    (listCount(frd?.portfolioLinks) + scalarOk(frd?.identity?.website)) > 0 &&
    (norm(html).includes(norm(frd?.identity?.website || '')) || /portfolio|cvPortfolioLink/i.test(html))
      ? 1
      : 0;
  counts.summary = lock.sections?.summary?.visible ?? (frd?.summary && /cvLead|cvSection--summary/i.test(html) ? 1 : 0);

  const mapList = {
    experience: 'experiences',
    education: 'education',
    skills: 'skills',
    tools: 'tools',
    languages: 'languages',
    clients: 'clients',
    projects: 'projects',
  };
  for (const [field, frdKey] of Object.entries(mapList)) {
    counts[field] = lock.sections?.[frdKey]?.visible ?? 0;
  }

  counts.awards = listCount(frd?.awards) > 0 && /cvSection--awards|award/i.test(html) ? listCount(frd.awards) : 0;

  if (/cvSection--pendingReview/.test(html)) {
    for (const item of pending) {
      if (!item || (item.status && item.status !== 'pending')) continue;
      const field = REVIEW_FIELD_MAP[String(item.field || '').trim()];
      if (field && counts[field] != null) counts[field] += 1;
    }
  }

  return counts;
}

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function loadTemplates() {
  const code = fs.readFileSync(path.join(ROOT, 'src/ui/templates/cv-templates.js'), 'utf8');
  const sandbox = { console };
  sandbox.window = sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  sandbox.initHirelyTemplates({
    esc,
    sectionLabel: (k) => k,
    cvBlock: (t, h) => h || '',
    cvSkillsHtml: (s) => `<p class="cvSkillLine">${s.map(esc).join(' · ')}</p>`,
    getPhotoHtml: () => '',
  });
  return sandbox.HirelyTemplates;
}

function stageRow(counts) {
  return Object.fromEntries(PIPELINE_STAGES.map((s) => [s, { ...counts[s] }]));
}

function buildFieldMatrix(stagesByName) {
  const matrix = {};
  for (const field of PIPELINE_FIELDS) {
    matrix[field] = {};
    for (const stage of PIPELINE_STAGES) {
      matrix[field][stage] = stagesByName[stage]?.[field] ?? 0;
    }
  }
  return matrix;
}

function findLossPoints(matrix) {
  const losses = [];
  const transitions = [
    ['DETECTED', 'NORMALIZED', 'RAW/OCR → Parser+Normalization'],
    ['NORMALIZED', 'COMMITTED', 'Normalization → finalResumeData (semantic gate / cleanup)'],
    ['COMMITTED', 'RENDERED', 'finalResumeData → Template renderer'],
    ['RENDERED', 'EXPORTED', 'Template → PDF export'],
  ];
  for (const field of PIPELINE_FIELDS) {
    const row = matrix[field];
    for (const [from, to, label] of transitions) {
      const drop = Math.max(0, (row[from] || 0) - (row[to] || 0));
      if (drop > 0) losses.push({ field, from, to, label, count: drop });
    }
    if ((row.REVIEWED || 0) > 0 && (row.COMMITTED || 0) < (row.NORMALIZED || 0)) {
      losses.push({
        field,
        from: 'REVIEW_QUEUE',
        to: 'COMMITTED',
        label: 'Semantic confidence gate / pending review',
        count: row.REVIEWED,
      });
    }
  }
  return losses;
}

/** Field coverage: committed+pending visible vs detected (capped 0–100). */
function fieldCoveragePct(matrix) {
  let expected = 0;
  let covered = 0;
  for (const field of PIPELINE_FIELDS) {
    const detected = matrix[field].DETECTED || 0;
    const committed = matrix[field].COMMITTED || 0;
    const rendered = matrix[field].RENDERED || 0;
    const baseline = Math.max(detected, committed);
    if (!baseline) continue;
    expected += baseline;
    covered += Math.min(rendered, baseline);
  }
  if (!expected) return 100;
  return Math.round((covered / expected) * 100);
}

/**
 * @param {string} rawText
 * @param {{ templateId?: string }} [opts]
 */
export async function auditPipelineDataLoss(rawText, opts = {}) {
  const templateId = opts.templateId || 'ats';
  const raw = String(rawText || '').trim();
  const cleanedOcr = cleanExtraction(raw);

  const pipe = await runProductionExtractionPipeline(raw, {
    trusted: true,
    forceContinue: true,
    canonicalImport: true,
  });
  const importResult = productionToHirelyImportResult(pipe);
  const normalizedRd = normalizeResumeData(importResult.resumeData, { skipSanitize: true });
  const reviewQueue = [...(importResult.reviewQueue || [])];
  const built = buildFinalResumeData(importResult.resumeData, { existingReview: reviewQueue });
  const frd = built.finalResumeData;
  const pending = [...reviewQueue, ...(built.reviewItems || [])].filter(
    (it) => it && (!it.status || it.status === 'pending')
  );

  const detected = detectFieldsFromText(raw);
  const ocr = detectFieldsFromText(pipe.cleanedText || cleanedOcr || importResult.cleanedText);
  const parser = Object.fromEntries(PIPELINE_FIELDS.map((f) => [f, countFromStructured(pipe.structuredResume, f)]));
  const normalized = Object.fromEntries(PIPELINE_FIELDS.map((f) => [f, countFromResumeData(normalizedRd, f)]));
  const reviewed = countReviewQueue(pending);
  const committed = Object.fromEntries(PIPELINE_FIELDS.map((f) => [f, countFromResumeData(frd, f)]));

  const cv = frd
    ? {
        ...resumeDataToCvData(frd, { skipNormalize: true }),
        _fromFinalResumeData: true,
        _pendingReview: pending,
      }
    : null;

  const T = loadTemplates();
  const html = cv ? T.render(cv, templateId) : '';
  const rendered = countRendered(html, frd, pending);
  const exported = { ...rendered };
  const templateLock = scoreTemplateCompletenessLock(html, frd);

  const stagesByName = {
    DETECTED: detected,
    NORMALIZED: normalized,
    REVIEWED: reviewed,
    COMMITTED: committed,
    RENDERED: rendered,
    EXPORTED: exported,
  };

  const matrix = buildFieldMatrix(stagesByName);
  const losses = findLossPoints(matrix);

  return {
    templateId,
    rawTextLen: raw.length,
    cleanedTextLen: String(pipe.cleanedText || importResult.cleanedText || '').length,
    intermediate: { ocr, parser },
    matrix,
    losses,
    completenessPct: templateLock.score,
    fieldCoveragePct: fieldCoveragePct(matrix),
    templateLockScore: templateLock.score,
    templateLock,
    reviewQueueSize: pending.length,
    contractRenderable: built.contract?.renderable ?? false,
    htmlLength: html.length,
  };
}
