/**
 * HIRELY P0 — Data retention trace per import.
 * Identifies the exact pipeline stage where section content disappears.
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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../../..');

export const RETENTION_TRACE_SECTIONS = Object.freeze([
  'identity',
  'summary',
  'experience',
  'education',
  'skills',
  'tools',
  'languages',
  'clients',
  'projects',
  'portfolio',
]);

export const RETENTION_TRACE_STAGES = Object.freeze([
  'RAW_TEXT_COUNT',
  'NORMALIZED_TEXT_COUNT',
  'SECTION_CANDIDATES_COUNT',
  'STRUCTURED_RESUME_COUNT',
  'RESUME_DATA_COUNT',
  'FINAL_RESUME_DATA_COUNT',
  'RENDERED_DOM_COUNT',
]);

const UNCERTAIN = new Set([
  NAME_UNCERTAIN_LABEL,
  TITLE_UNCERTAIN_LABEL,
  'Information non détectée',
  'Nom à confirmer',
  'Poste à compléter',
  'Company à confirmer',
  'Entreprise à confirmer',
]);

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const LINKEDIN_RE = /linkedin\.com/i;
const URL_RE = /https?:\/\/|www\.\w/i;
const PHONE_RE = /^\+?[\d\s().-]{8,}$/;

const SECTION_ANCHOR_KEYS = Object.freeze({
  summary: ['summary', 'profile', 'profil'],
  experience: ['experience', 'experiences', 'expérience', 'expériences'],
  education: ['education', 'formation', 'formations'],
  skills: ['skills', 'skill', 'compétences', 'competences'],
  tools: ['tools', 'tool', 'software', 'outils'],
  languages: ['languages', 'language', 'langues', 'langue'],
  clients: ['clients', 'client'],
  projects: ['projects', 'project', 'projets', 'projet'],
  portfolio: ['portfolio', 'websites', 'website'],
});

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, (m) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[m]
  );
}

function normKey(item) {
  const s = typeof item === 'string' ? item : formatItem(item);
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

function formatItem(item) {
  if (item == null) return '';
  if (typeof item === 'string') return String(item).trim();
  if (typeof item === 'object') {
    const dates = item.dates || [item.startDate, item.endDate].filter(Boolean).join('–');
    return [item.role, item.company, item.school, item.degree, item.title, dates]
      .filter(Boolean)
      .join(' — ')
      .trim();
  }
  return String(item).trim();
}

function scalarOk(val) {
  const s = String(val || '').trim();
  return s.length > 0 && !UNCERTAIN.has(s);
}

function emptySectionMap() {
  return Object.fromEntries(RETENTION_TRACE_SECTIONS.map((s) => [s, []]));
}

function dedupeItems(items) {
  const out = [];
  const seen = new Set();
  for (const item of items || []) {
    const text = formatItem(item);
    const k = normKey(text);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(text);
  }
  return out;
}

function splitListLine(line) {
  const s = String(line || '').trim();
  if (!s) return [];
  if (/[·,|/;]/.test(s)) {
    return s
      .split(/\s*[·,|/;]\s*/)
      .map((x) => x.trim())
      .filter((x) => x.length >= 2);
  }
  return [s];
}

function linesFromSections(sections, keys = []) {
  const out = [];
  for (const key of keys) {
    for (const line of sections[key] || []) {
      out.push(...splitListLine(line));
    }
  }
  return dedupeItems(out);
}

function itemRetainedInNext(item, nextItems) {
  const k = normKey(item);
  if (!k) return false;
  const nextKeys = (nextItems || []).map(normKey).filter(Boolean);
  if (nextKeys.includes(k)) return true;
  const tokens = k.split(/\s+/).filter((t) => t.length >= 4);
  if (!tokens.length) return false;
  return nextKeys.some((nk) => tokens.some((t) => nk.includes(t) || t.includes(nk)));
}

function computeLost(prevItems, nextItems, limit = 10) {
  return (prevItems || [])
    .filter((item) => !itemRetainedInNext(item, nextItems))
    .slice(0, limit);
}

function buildSectionTrace(items, prevItems = null) {
  const list = dedupeItems(items);
  const prev = prevItems ? dedupeItems(prevItems) : [];
  return {
    count: list.length,
    examples: list.slice(0, 5),
    lostExamples: prev.length ? computeLost(prev, list, 10) : [],
  };
}

function buildStageTrace(sectionItems, prevStageItems = null) {
  const stage = {};
  for (const section of RETENTION_TRACE_SECTIONS) {
    const items = sectionItems[section] || [];
    const prev = prevStageItems?.[section] || null;
    stage[section] = buildSectionTrace(items, prev);
  }
  return stage;
}

/** @param {string} text */
export function extractRawTextItems(text) {
  const raw = String(text || '').trim();
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const sections = splitLinesBySectionAnchors(lines);
  const out = emptySectionMap();

  const top = sections.top || [];
  for (const line of top.slice(0, 8)) {
    if (EMAIL_RE.test(line) || URL_RE.test(line) || PHONE_RE.test(line)) continue;
    if (line.length >= 2 && line.length < 100) out.identity.push(line);
    if (out.identity.length >= 2) break;
  }

  out.summary = (sections.summary || sections.profile || sections.profil || []).filter((l) => l.length > 16);
  out.experience = dedupeItems([
    ...linesFromSections(sections, SECTION_ANCHOR_KEYS.experience),
    ...lines.filter((l) => /\b(19|20)\d{2}\b/.test(l) && l.length > 10),
  ]);
  out.education = linesFromSections(sections, SECTION_ANCHOR_KEYS.education);
  out.skills = linesFromSections(sections, SECTION_ANCHOR_KEYS.skills);
  out.tools = linesFromSections(sections, SECTION_ANCHOR_KEYS.tools);
  out.languages = linesFromSections(sections, SECTION_ANCHOR_KEYS.languages);
  out.clients = linesFromSections(sections, SECTION_ANCHOR_KEYS.clients);
  out.projects = linesFromSections(sections, SECTION_ANCHOR_KEYS.projects);
  out.portfolio = dedupeItems([
    ...linesFromSections(sections, SECTION_ANCHOR_KEYS.portfolio),
    ...lines.filter((l) => URL_RE.test(l) && !LINKEDIN_RE.test(l)),
  ]);

  return out;
}

/** Section-bucket candidates from normalized text (anchored sections only, pre-structured parse). */
export function extractSectionCandidateItems(text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const sections = splitLinesBySectionAnchors(lines);
  const out = emptySectionMap();

  const top = sections.top || [];
  for (const line of top.slice(0, 8)) {
    if (EMAIL_RE.test(line) || URL_RE.test(line) || PHONE_RE.test(line)) continue;
    if (line.length >= 2 && line.length < 100) out.identity.push(line);
    if (out.identity.length >= 2) break;
  }

  out.summary = (sections.summary || sections.profile || sections.profil || []).filter((l) => l.length > 16);
  out.experience = linesFromSections(sections, SECTION_ANCHOR_KEYS.experience);
  out.education = linesFromSections(sections, SECTION_ANCHOR_KEYS.education);
  out.skills = linesFromSections(sections, SECTION_ANCHOR_KEYS.skills);
  out.tools = linesFromSections(sections, SECTION_ANCHOR_KEYS.tools);
  out.languages = linesFromSections(sections, SECTION_ANCHOR_KEYS.languages);
  out.clients = linesFromSections(sections, SECTION_ANCHOR_KEYS.clients);
  out.projects = linesFromSections(sections, SECTION_ANCHOR_KEYS.projects);
  out.portfolio = dedupeItems([
    ...linesFromSections(sections, SECTION_ANCHOR_KEYS.portfolio),
    ...(sections.top || []).filter((l) => URL_RE.test(l) && !LINKEDIN_RE.test(l)),
  ]);

  return out;
}

/** @param {object} sr */
export function extractStructuredResumeItems(sr) {
  const out = emptySectionMap();
  if (!sr) return out;
  const id = sr.identity || {};
  if (scalarOk(id.name)) out.identity.push(String(id.name).trim());
  if (scalarOk(id.title)) out.identity.push(String(id.title).trim());
  if (scalarOk(sr.summary)) out.summary.push(String(sr.summary).trim());
  out.experience = dedupeItems((sr.experiences || []).map(formatItem));
  out.education = dedupeItems(sr.education || []);
  out.skills = dedupeItems(sr.skills || []);
  out.tools = dedupeItems(sr.tools || []);
  out.languages = dedupeItems(sr.languages || []);
  out.clients = dedupeItems(sr.clients || []);
  out.projects = dedupeItems(sr.projects || []);
  out.portfolio = dedupeItems([
    ...(sr.portfolioLinks || []),
    id.website,
    id.portfolio,
  ].filter(Boolean));
  return out;
}

/** @param {object} rd */
export function extractResumeDataItems(rd) {
  const out = emptySectionMap();
  if (!rd) return out;
  const id = rd.identity || {};
  if (scalarOk(id.name)) out.identity.push(String(id.name).trim());
  if (scalarOk(id.title)) out.identity.push(String(id.title).trim());
  if (scalarOk(rd.summary)) out.summary.push(String(rd.summary).trim());
  out.experience = dedupeItems((rd.experiences || []).map(formatItem));
  out.education = dedupeItems(rd.education || []);
  out.skills = dedupeItems(rd.skills || []);
  out.tools = dedupeItems(rd.tools || []);
  out.languages = dedupeItems(rd.languages || []);
  out.clients = dedupeItems(rd.clients || []);
  out.projects = dedupeItems(rd.projects || []);
  out.portfolio = dedupeItems([
    ...(rd.portfolioLinks || []),
    id.website,
    id.portfolio,
  ].filter(Boolean));
  return out;
}

function htmlDecode(s) {
  return String(s || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

function matchClassText(html, className) {
  const re = new RegExp(`class="[^"]*${className}[^"]*"[^>]*>([^<]+)<`, 'gi');
  const out = [];
  let m;
  while ((m = re.exec(html))) {
    const t = htmlDecode(m[1]);
    if (t) out.push(t);
  }
  return out;
}

function splitInlineList(text) {
  return String(text || '')
    .split(/\s*·\s*/)
    .map((x) => x.trim())
    .filter((x) => x.length >= 2);
}

/** @param {string} html */
export function extractRenderedDomItems(html) {
  const out = emptySectionMap();
  if (!html) return out;

  out.identity = dedupeItems([
    ...matchClassText(html, 'cvName'),
    ...matchClassText(html, 'cvTitle'),
  ]);

  const lead = matchClassText(html, 'cvLead');
  if (lead.length) out.summary = dedupeItems(lead);

  const expBlocks = html.match(/<div class="cvExpEntry[^"]*"[\s\S]*?<\/div>/gi) || [];
  for (const block of expBlocks) {
    const role = matchClassText(block, 'cvExpRole')[0];
    const company = matchClassText(block, 'cvExpCompany')[0];
    const dates = matchClassText(block, 'cvExpDates')[0];
    const bullets = matchClassText(block, 'cvExpBullet');
    const head = [role, company, dates].filter(Boolean).join(' — ');
    if (head) out.experience.push(head);
    else {
      const plain = block.match(/contenteditable>([^<]+)</i);
      if (plain?.[1]) out.experience.push(htmlDecode(plain[1]));
    }
    out.experience.push(...bullets);
  }

  for (const line of matchClassText(html, 'cvEduLine')) out.education.push(line);
  for (const block of html.match(/<div class="cvEduEntry[^"]*"[\s\S]*?<\/div>/gi) || []) {
    const school = matchClassText(block, 'cvEduSchool')[0];
    const program = matchClassText(block, 'cvEduProgram')[0];
    const dates = matchClassText(block, 'cvEduDates')[0];
    const line = [school, program, dates].filter(Boolean).join(' — ');
    if (line) out.education.push(line);
  }

  for (const line of matchClassText(html, 'cvSkillLine')) {
    if (!/cvToolsLine/i.test(line)) out.skills.push(...splitInlineList(line));
  }
  for (const line of matchClassText(html, 'cvToolsLine')) out.tools.push(...splitInlineList(line));
  for (const line of matchClassText(html, 'cvLangLine')) out.languages.push(...splitInlineList(line));

  out.clients = dedupeItems([
    ...matchClassText(html, 'cvClientChip'),
    ...matchClassText(html, 'cvClientLine').flatMap(splitInlineList),
  ]);

  for (const block of html.match(/<div class="cvProjectEntry[^"]*"[\s\S]*?<\/div>/gi) || []) {
    const t = block.match(/contenteditable>([^<]+)</i);
    if (t?.[1]) out.projects.push(htmlDecode(t[1]));
  }

  for (const block of html.match(/<div class="cvPortfolioLink[^"]*"[\s\S]*?<\/div>/gi) || []) {
    const t = block.match(/contenteditable>([^<]+)</i);
    if (t?.[1]) out.portfolio.push(htmlDecode(t[1]));
  }

  for (const section of RETENTION_TRACE_SECTIONS) {
    out[section] = dedupeItems(out[section]);
  }
  return out;
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

function buildTransitions(stageTraces) {
  const transitions = [];
  for (let i = 1; i < RETENTION_TRACE_STAGES.length; i++) {
    const from = RETENTION_TRACE_STAGES[i - 1];
    const to = RETENTION_TRACE_STAGES[i];
    const fromStage = stageTraces[from];
    const toStage = stageTraces[to];
    const losses = {};

    for (const section of RETENTION_TRACE_SECTIONS) {
      const fromCount = fromStage?.[section]?.count ?? 0;
      const toCount = toStage?.[section]?.count ?? 0;
      const dropped = Math.max(0, fromCount - toCount);
      const lostExamples = toStage?.[section]?.lostExamples || [];
      if (dropped > 0 || lostExamples.length) {
        losses[section] = { dropped, fromCount, toCount, lostExamples: lostExamples.slice(0, 10) };
      }
    }

    if (Object.keys(losses).length) {
      transitions.push({ from, to, losses });
    }
  }
  return transitions;
}

function identifyHotspots(transitions) {
  const hotspots = [];
  for (const t of transitions) {
    for (const [section, loss] of Object.entries(t.losses)) {
      hotspots.push({
        stage: `${t.from} → ${t.to}`,
        section,
        dropped: loss.dropped,
        fromCount: loss.fromCount,
        toCount: loss.toCount,
        lostExamples: loss.lostExamples,
      });
    }
  }
  return hotspots.sort((a, b) => b.dropped - a.dropped).slice(0, 24);
}

/**
 * Run full retention trace for one import.
 * @param {string} rawText
 * @param {{ id?: string, templateId?: string, extractionMethod?: string }} [opts]
 */
export async function traceDataRetention(rawText, opts = {}) {
  const id = opts.id || 'import';
  const templateId = opts.templateId || 'ats';
  const extractionMethod = opts.extractionMethod || 'paste';
  const raw = String(rawText || '').trim();

  const cleanedOcr = cleanExtraction(raw);
  const pipe = await runProductionExtractionPipeline(raw, {
    trusted: true,
    forceContinue: true,
    canonicalImport: true,
    extractionMethod,
  });
  const importResult = productionToHirelyImportResult(pipe);
  const normalizedText = String(pipe.cleanedText || importResult.cleanedText || cleanedOcr).trim();
  const normalizedRd = normalizeResumeData(importResult.resumeData, { skipSanitize: true });
  const reviewQueue = [...(importResult.reviewQueue || [])];
  const built = buildFinalResumeData(importResult.resumeData, { existingReview: reviewQueue });
  const frd = built.finalResumeData;

  const cv = frd
    ? {
        ...resumeDataToCvData(frd, { skipNormalize: true }),
        _fromFinalResumeData: true,
        _pendingReview: reviewQueue,
      }
    : null;

  const T = loadTemplates();
  const html = cv ? T.render(cv, templateId) : '';

  const itemStages = {
    RAW_TEXT_COUNT: extractRawTextItems(raw),
    NORMALIZED_TEXT_COUNT: extractRawTextItems(normalizedText),
    SECTION_CANDIDATES_COUNT: extractSectionCandidateItems(normalizedText),
    STRUCTURED_RESUME_COUNT: extractStructuredResumeItems(pipe.structuredResume),
    RESUME_DATA_COUNT: extractResumeDataItems(normalizedRd),
    FINAL_RESUME_DATA_COUNT: extractResumeDataItems(frd),
    RENDERED_DOM_COUNT: extractRenderedDomItems(html),
  };

  const stageTraces = {};
  let prevItems = null;
  for (const stageId of RETENTION_TRACE_STAGES) {
    stageTraces[stageId] = buildStageTrace(itemStages[stageId], prevItems);
    prevItems = itemStages[stageId];
  }

  const transitions = buildTransitions(stageTraces);
  const hotspots = identifyHotspots(transitions);

  return {
    id,
    templateId,
    extractionMethod,
    rawTextLength: raw.length,
    normalizedTextLength: normalizedText.length,
    reviewQueueSize: reviewQueue.length + (built.reviewItems || []).length,
    stageTraces,
    transitions,
    hotspots,
    summary: {
      clients: {
        raw: stageTraces.RAW_TEXT_COUNT.clients.count,
        structured: stageTraces.STRUCTURED_RESUME_COUNT.clients.count,
        resumeData: stageTraces.RESUME_DATA_COUNT.clients.count,
        final: stageTraces.FINAL_RESUME_DATA_COUNT.clients.count,
        rendered: stageTraces.RENDERED_DOM_COUNT.clients.count,
      },
      projects: {
        raw: stageTraces.RAW_TEXT_COUNT.projects.count,
        structured: stageTraces.STRUCTURED_RESUME_COUNT.projects.count,
        resumeData: stageTraces.RESUME_DATA_COUNT.projects.count,
        final: stageTraces.FINAL_RESUME_DATA_COUNT.projects.count,
        rendered: stageTraces.RENDERED_DOM_COUNT.projects.count,
      },
    },
  };
}

/**
 * @param {object[]} traces
 */
export function buildRetentionTraceMarkdown(traces = []) {
  const lines = [
    '# HIRELY P0 — Data Retention Trace',
    '',
    `**Generated:** ${new Date().toISOString()}`,
    '',
    '## Pipeline stages',
    '',
    ...RETENTION_TRACE_STAGES.map((s) => `- \`${s}\``),
    '',
    '## Sections traced',
    '',
    RETENTION_TRACE_SECTIONS.map((s) => `\`${s}\``).join(' · '),
    '',
  ];

  for (const trace of traces) {
    lines.push(`## Import: ${trace.id}`, '');
    lines.push(
      `Raw ${trace.rawTextLength} chars → normalized ${trace.normalizedTextLength} chars · review queue ${trace.reviewQueueSize}`,
      ''
    );

    lines.push('### Clients / projects funnel', '');
    lines.push('| Stage | Clients | Projects |');
    lines.push('| --- | ---: | ---: |');
    for (const stage of RETENTION_TRACE_STAGES) {
      const st = trace.stageTraces[stage];
      lines.push(`| ${stage} | ${st.clients.count} | ${st.projects.count} |`);
    }
    lines.push('');

    if (trace.hotspots?.length) {
      lines.push('### Top loss hotspots', '');
      lines.push('| Stage transition | Section | Dropped | Lost examples |');
      lines.push('| --- | --- | ---: | --- |');
      for (const h of trace.hotspots.slice(0, 12)) {
        const ex = (h.lostExamples || []).slice(0, 3).join('; ') || '—';
        lines.push(`| ${h.stage} | ${h.section} | ${h.dropped} | ${ex} |`);
      }
      lines.push('');
    }

    for (const section of ['clients', 'projects', 'experience', 'skills']) {
      const st = trace.stageTraces;
      if (st.RAW_TEXT_COUNT[section].count === 0 && st.FINAL_RESUME_DATA_COUNT[section].count === 0) continue;
      lines.push(`### ${section} — stage detail`, '');
      lines.push('| Stage | Count | Examples (first 5) | Lost from previous |');
      lines.push('| --- | ---: | --- | --- |');
      for (const stage of RETENTION_TRACE_STAGES) {
        const row = st[stage][section];
        const ex = (row.examples || []).slice(0, 3).join('; ') || '—';
        const lost = (row.lostExamples || []).slice(0, 3).join('; ') || '—';
        lines.push(`| ${stage} | ${row.count} | ${ex} | ${lost} |`);
      }
      lines.push('');
    }
  }

  lines.push('## How to read', '');
  lines.push('- **lostExamples** on a stage = items present in the previous stage but missing here.');
  lines.push('- The stage with the largest drop for a section is where content disappears.');
  lines.push('');
  lines.push('```bash');
  lines.push('npm run test:data-retention-trace');
  lines.push('```');
  lines.push('');

  return `${lines.join('\n')}`;
}

/**
 * @param {object[]} traces
 * @param {{ jsonPath?: string, mdPath?: string }} [opts]
 */
export function writeRetentionTraceArtifacts(traces, opts = {}) {
  const jsonPath = opts.jsonPath || path.join(ROOT, 'DATA_RETENTION_TRACE.json');
  const mdPath = opts.mdPath || path.join(ROOT, 'DATA_RETENTION_TRACE_REPORT.md');
  const payload = {
    version: 'DATA_RETENTION_TRACE_V1',
    generatedAt: new Date().toISOString(),
    stages: RETENTION_TRACE_STAGES,
    sections: RETENTION_TRACE_SECTIONS,
    imports: traces,
  };
  fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2));
  fs.writeFileSync(mdPath, buildRetentionTraceMarkdown(traces));
  return { jsonPath, mdPath, payload };
}
