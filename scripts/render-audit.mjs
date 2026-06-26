#!/usr/bin/env node
/**
 * RENDER AUDIT — trace resumeData → sanitize → mapper → cvData → renderCV.
 * node scripts/render-audit.mjs
 * Output: RENDER_AUDIT.md
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';
import { extractPlainTextEnterprise } from '../src/core/extraction/enterprise-engine.js';
import { runProductionExtractionPipeline } from '../src/core/pipeline/production-pipeline.js';
import { productionToHirelyImportResult } from '../src/core/pipeline/hirely-import.js';
import {
  resumeDataFromStructured,
  resumeDataToCvData,
  reconcileTextRetention,
  emptyResumeData,
  sanitizeIdentity,
} from '../src/core/resume-data.js';
import { repairResumeDataFromRaw } from '../src/core/parsing/import-repair.js';
import { autoAcceptSafeSuggestions } from '../src/core/parsing/suggestion-auto-accept.js';
import { reconcileCreativeSections } from '../src/core/creative-resume-mode.js';
import { capUnsortedWithArchive } from '../src/core/parsing/no-data-loss.js';
import { polishResumeOutput } from '../src/core/parsing/resume-output-quality.js';
import { applyConfidenceGate } from '../src/core/validation/confidence-gate.js';
import { sanitizeResumeForDisplay } from '../src/core/validation/sanitize-resume-display.js';
import { simpleCvDataFromStructured } from '../src/core/parsing/simple-cv-mapper.js';
import { normalizeCvData, cvDataIsRenderable } from '../src/core/parsing/rich-parser.js';
import { stripTemplateCvData } from '../src/core/pipeline/hirely-flow-lock.js';
import { sectionCounts as pipelineSectionCounts } from '../src/core/runtime/render-pipeline-trace.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const TRACE_PATH = path.join(ROOT, 'TRACE_YOAZ_PIPELINE.json');
const OUT_PATH = path.join(ROOT, 'RENDER_AUDIT.md');
const TEMPLATES_PATH = path.join(ROOT, 'src/ui/templates/cv-templates.js');

const SECTION_KEYS = [
  'experiences',
  'experience',
  'education',
  'skills',
  'tools',
  'languages',
  'clients',
  'projects',
  'unsorted',
  'summary',
];

function arrLen(v) {
  return Array.isArray(v) ? v.filter(Boolean).length : 0;
}

function countsForStage(data, stage) {
  const d = data || {};
  const exp = d.experiences ?? d.experience ?? [];
  const base = {
    experiences: arrLen(exp),
    education: arrLen(d.education),
    skills: arrLen(d.skills),
    tools: arrLen(d.tools),
    languages: arrLen(d.languages),
    clients: arrLen(d.clients),
    projects: arrLen(d.projects),
    unsorted: arrLen(d.unsorted),
    summary: d.summary && String(d.summary).trim() ? 1 : 0,
    identity_name: d.identity?.name || d.name ? 1 : 0,
    identity_title: d.identity?.title || d.title ? 1 : 0,
    identity_email: d.identity?.email || d.email ? 1 : 0,
    identity_phone: d.identity?.phone || d.phone ? 1 : 0,
  };
  if (stage === 'renderCV') {
    base.html_sections = d._htmlSections || 0;
    base.html_list_items = d._htmlListItems || 0;
  }
  return base;
}

function firstOf(data, key) {
  const d = data || {};
  if (key === 'identity') {
    const id = d.identity || {
      name: d.name,
      title: d.title,
      email: d.email,
      phone: d.phone,
      location: d.location,
      website: d.portfolio,
      linkedin: d.linkedin,
    };
    return id;
  }
  if (key === 'experiences' || key === 'experience') {
    const exp = d.experiences ?? d.experience ?? [];
    return exp[0] ?? null;
  }
  if (key === 'summary') return d.summary ? String(d.summary).slice(0, 200) : null;
  const arr = d[key];
  return Array.isArray(arr) && arr.length ? arr[0] : null;
}

function cloneResumeShape(rd) {
  return JSON.parse(JSON.stringify(rd || emptyResumeData()));
}

function shapeLikeNormalize(data) {
  const base = emptyResumeData();
  const d = data || {};
  return {
    identity: sanitizeIdentity({ ...base.identity, ...(d.identity || {}) }),
    summary: String(d.summary || '').trim(),
    experiences: Array.isArray(d.experiences) ? d.experiences.map((e) => ({ ...e })) : [],
    education: (d.education || []).map((x) => String(x || '').trim()).filter(Boolean),
    clients: (d.clients || []).map((x) => String(x || '').trim()).filter(Boolean),
    projects: (d.projects || []).map((x) => String(x || '').trim()).filter(Boolean),
    exhibitions: (d.exhibitions || []).map((x) => String(x || '').trim()).filter(Boolean),
    awards: (d.awards || []).map((x) => String(x || '').trim()).filter(Boolean),
    publications: (d.publications || []).map((x) => String(x || '').trim()).filter(Boolean),
    portfolioLinks: (d.portfolioLinks || []).map((x) => String(x || '').trim()).filter(Boolean),
    skills: (d.skills || []).map((x) => String(x || '').trim()).filter(Boolean),
    tools: (d.tools || []).map((x) => String(x || '').trim()).filter(Boolean),
    languages: (d.languages || []).map((x) => String(x || '').trim()).filter(Boolean),
    unsorted: (d.unsorted || []).map((x) => String(x || '').trim()).filter(Boolean),
    meta: { ...base.meta, ...(d.meta || {}) },
  };
}

function buildPreSanitizeResumeData(structured, { rawText, cleanedText }) {
  let rd = resumeDataFromStructured(structured);
  rd = repairResumeDataFromRaw(rd, { rawText, cleanedText });
  rd = autoAcceptSafeSuggestions(rd, { rawText, cleanedText });
  rd = reconcileTextRetention(rd, { rawText, cleanedText, rejectedLines: [] });
  rd = autoAcceptSafeSuggestions(rd, { rawText, cleanedText });
  rd = reconcileCreativeSections(rd);
  rd = shapeLikeNormalize(rd);
  rd = polishResumeOutput(rd);
  const capped = capUnsortedWithArchive(rd.unsorted, rd.meta?.unsortedArchive);
  rd.unsorted = capped.unsorted;
  rd.meta.unsortedArchive = capped.unsortedArchive;
  return applyConfidenceGate(rd);
}

function mapperToCvData(sanitized) {
  const structured = {
    identity: { ...sanitized.identity },
    summary: sanitized.summary,
    experiences: sanitized.experiences,
    education: sanitized.education,
    clients: sanitized.clients,
    projects: sanitized.projects,
    exhibitions: sanitized.exhibitions,
    awards: sanitized.awards,
    publications: sanitized.publications,
    portfolioLinks: sanitized.portfolioLinks,
    skills: sanitized.skills,
    tools: sanitized.tools,
    languages: sanitized.languages,
    unsorted: sanitized.unsorted,
  };
  const cv = simpleCvDataFromStructured(structured);
  if (!(cv.experience || []).length && (sanitized.experiences || []).length) {
    cv.experience = sanitized.experiences
      .filter((e) => e && (e.role || e.company || (e.bullets || []).length))
      .map((e) => {
        const dates = e.dates || [e.startDate, e.endDate].filter(Boolean).join('–');
        const head = [e.role, e.company, dates].filter(Boolean).join(' — ');
        const bullets = (e.bullets || []).filter(Boolean);
        return bullets.length ? `${head}: ${bullets.join(' · ')}` : head;
      })
      .filter(Boolean);
  }
  cv.name = sanitized.identity.name;
  cv.title = sanitized.identity.title;
  cv.email = sanitized.identity.email;
  cv.phone = sanitized.identity.phone;
  cv.location = sanitized.identity.location;
  cv.portfolio = sanitized.identity.website;
  cv.linkedin = sanitized.identity.linkedin;
  cv.unsorted = [];
  cv.toClassify = [];
  cv.unknownExperience = [];
  cv._creativeMode = sanitized.meta?.creativeMode || null;
  return stripTemplateCvData(cv);
}

function renderCvInput(cvData) {
  const active = normalizeCvData(cvData);
  return {
    ...active,
    extra: (active.extra || []).filter(Boolean),
  };
}

function loadHirelyTemplates() {
  const code = fs.readFileSync(TEMPLATES_PATH, 'utf8');
  const sandbox = {
    global: {},
    window: {},
    document: undefined,
    console,
  };
  sandbox.global = sandbox;
  sandbox.window = sandbox;
  vm.runInNewContext(code, sandbox, { filename: 'cv-templates.js' });
  const esc = (s) =>
    String(s || '').replace(/[&<>"']/g, (m) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[m]
    );
  const sectionLabel = (k) =>
    ({
      experience: 'Experience',
      education: 'Education',
      skills: 'Skills',
      tools: 'Tools',
      languages: 'Languages',
      clients: 'Clients',
      projects: 'Projects',
      profile: 'Profile',
    })[k] || k;
  const cvBlock = (title, html) => html || '';
  const cvSkillsHtml = (skills) => skills.join(' · ');
  const getPhotoHtml = () => '';
  sandbox.initHirelyTemplates({ esc, sectionLabel, cvBlock, cvSkillsHtml, getPhotoHtml });
  return sandbox.HirelyTemplates;
}

function countRenderedHtml(html) {
  const h = String(html || '');
  const sections = (h.match(/class="cvSection/g) || []).length;
  const expItems = (h.match(/class="cvExpItem/g) || []).length;
  const edu = /cvSection--education/.test(h);
  const skills = /cvSection--skills|cvSkillLine/.test(h);
  const tools = /cvSection--tools/.test(h);
  const languages = /cvSection--languages/.test(h);
  const clients = /cvSection--clients/.test(h);
  const experience = /cvSection--experience/.test(h);
  const listItems =
    expItems +
    (h.match(/class="chip"/g) || []).length +
    (edu ? 1 : 0) +
    (skills ? (h.match(/cvSkillLine/g) || []).length : 0);
  return {
    html_sections: sections,
    html_experience_items: expItems,
    html_has_education: edu ? 1 : 0,
    html_has_skills: skills ? 1 : 0,
    html_has_tools: tools ? 1 : 0,
    html_has_languages: languages ? 1 : 0,
    html_has_clients: clients ? 1 : 0,
    html_has_experience: experience ? 1 : 0,
    html_list_items: listItems,
    html_chars: h.length,
  };
}

function deltaCounts(before, after) {
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  const delta = {};
  for (const k of keys) {
    const b = before[k] ?? 0;
    const a = after[k] ?? 0;
    if (b !== a) delta[k] = { before: b, after: a, lost: Math.max(0, b - a), gained: Math.max(0, a - b) };
  }
  return delta;
}

function mdEsc(s) {
  return String(s || '').replace(/\|/g, '\\|');
}

function fmtObj(obj) {
  if (obj == null) return '_empty_';
  if (typeof obj === 'string') return obj.length > 120 ? `${obj.slice(0, 120)}…` : obj;
  return JSON.stringify(obj, null, 2);
}

async function main() {
  let ocrText = '';
  let trace = null;
  if (fs.existsSync(TRACE_PATH)) {
    trace = JSON.parse(fs.readFileSync(TRACE_PATH, 'utf8'));
    ocrText = trace.checkpoints?.OCR_OUTPUT?.object?.text || '';
  }
  if (!ocrText) {
    console.error('Missing OCR text in TRACE_YOAZ_PIPELINE.json — run scripts/trace-yoaz-pipeline.mjs first');
    process.exit(1);
  }

  const enterprise = extractPlainTextEnterprise(ocrText, 'ocr');
  const pipe = await runProductionExtractionPipeline(ocrText, {
    rawText: ocrText,
    extractionMethod: 'ocr',
    enterpriseExtraction: enterprise,
    canonicalImport: true,
  });
  const imp = productionToHirelyImportResult(pipe, { name: 'yoaz.pdf' });
  const structured = pipe.structuredResume || trace?.checkpoints?.STRUCTURED_RESUME?.object;
  const cleanedText = enterprise?.cleanedText || ocrText;

  const resumeData = buildPreSanitizeResumeData(structured, { rawText: ocrText, cleanedText });
  const sanitized = sanitizeResumeForDisplay(cloneResumeShape(resumeData));
  const mapped = mapperToCvData(sanitized);
  const cvData = normalizeCvData(mapped);
  const renderInput = renderCvInput(cvData);

  pipelineSectionCounts('RESUMEDATA_COUNTS', resumeData);
  pipelineSectionCounts('SANITIZED_COUNTS', sanitized);
  pipelineSectionCounts('CVDATA_COUNTS', cvData);

  let renderHtml = '';
  let renderMeta = { renderable: cvDataIsRenderable(renderInput), template: 'ats' };
  try {
    const templates = loadHirelyTemplates();
    renderHtml = templates.render(renderInput, 'ats') || '';
    pipelineSectionCounts('TEMPLATE_COUNTS', renderInput);
    renderMeta = { ...renderMeta, ...countRenderedHtml(renderHtml) };
  } catch (err) {
    renderMeta.error = String(err?.message || err);
  }

  const stages = [
    { id: 'resumeData', label: 'resumeData (pre-sanitize)', data: resumeData },
    { id: 'sanitizeResumeForDisplay', label: 'sanitizeResumeForDisplay', data: sanitized },
    { id: 'simple-cv-mapper', label: 'simple-cv-mapper', data: mapped },
    { id: 'cvData', label: 'cvData (normalizeCvData)', data: cvData },
    { id: 'renderCV', label: 'renderCV (template input + HTML)', data: renderInput },
  ];

  const stageCounts = stages.map((s) => {
    const counts = countsForStage(s.data, s.id);
    if (s.id === 'renderCV' && renderMeta.html_chars) {
      Object.assign(counts, {
        html_sections: renderMeta.html_sections ?? 0,
        html_experience_items: renderMeta.html_experience_items ?? 0,
        html_chars: renderMeta.html_chars,
        html_has_education: renderMeta.html_has_education ?? 0,
        html_has_skills: renderMeta.html_has_skills ?? 0,
        html_has_tools: renderMeta.html_has_tools ?? 0,
        html_has_languages: renderMeta.html_has_languages ?? 0,
        html_has_clients: renderMeta.html_has_clients ?? 0,
      });
    }
    return {
    ...s,
    counts,
    examples: {
      identity: firstOf(s.data, 'identity'),
      experiences: firstOf(s.data, 'experiences'),
      education: firstOf(s.data, 'education'),
      skills: firstOf(s.data, 'skills'),
      tools: firstOf(s.data, 'tools'),
      languages: firstOf(s.data, 'languages'),
      clients: firstOf(s.data, 'clients'),
      unsorted: firstOf(s.data, 'unsorted'),
      summary: firstOf(s.data, 'summary'),
    },
  };
  });

  const canonicalCv = resumeDataToCvData(imp.resumeData || sanitized);
  const losses = [];
  for (let i = 1; i < stageCounts.length; i++) {
    const from = stageCounts[i - 1];
    const to = stageCounts[i];
    const d = deltaCounts(from.counts, to.counts);
    if (Object.keys(d).length) losses.push({ from: from.id, to: to.id, delta: d });
  }

  const md = [];
  md.push('# RENDER AUDIT — Yoaz PDF');
  md.push('');
  md.push(`Generated: ${new Date().toISOString()}`);
  md.push('Pipeline: `resumeData` → `sanitizeResumeForDisplay` → `simple-cv-mapper` → `cvData` → `renderCV`');
  md.push('');
  md.push('> Audit only — trace render losses. No fixes applied.');
  md.push('');

  md.push('## Summary');
  md.push('');
  md.push('| Stage | Exp | Edu | Skills | Tools | Lang | Clients | Unsorted | Summary |');
  md.push('|-------|----:|----:|-------:|------:|-----:|--------:|---------:|--------:|');
  for (const s of stageCounts) {
    const c = s.counts;
    md.push(
      `| ${s.label} | ${c.experiences} | ${c.education} | ${c.skills} | ${c.tools} | ${c.languages} | ${c.clients} | ${c.unsorted} | ${c.summary} |`
    );
  }
  if (renderMeta.html_chars) {
    md.push('');
    md.push(`**renderCV HTML:** ${renderMeta.html_chars} chars · ${renderMeta.html_sections ?? 0} sections · ${renderMeta.html_experience_items ?? 0} experience items · renderable: ${renderMeta.renderable ? 'yes' : 'no'}`);
  }
  md.push('');

  md.push('## Counts by stage');
  md.push('');
  for (const s of stageCounts) {
    md.push(`### ${s.label}`);
    md.push('');
    md.push('```json');
    md.push(JSON.stringify(s.counts, null, 2));
    md.push('```');
    md.push('');
  }

  md.push('## First object per section');
  md.push('');
  for (const s of stageCounts) {
    md.push(`### ${s.label}`);
    md.push('');
    for (const key of ['identity', 'experiences', 'education', 'skills', 'tools', 'languages', 'clients', 'unsorted', 'summary']) {
      const ex = s.examples[key];
      md.push(`**${key}:**`);
      md.push('```');
      md.push(fmtObj(ex));
      md.push('```');
      md.push('');
    }
  }

  md.push('## Render losses (stage → stage)');
  md.push('');
  if (!losses.length) {
    md.push('_No count deltas between stages._');
  } else {
    for (const block of losses) {
      md.push(`### ${block.from} → ${block.to}`);
      md.push('');
      md.push('| Field | Before | After | Lost | Gained |');
      md.push('|-------|-------:|------:|-----:|-------:|');
      for (const [field, d] of Object.entries(block.delta)) {
        md.push(`| ${field} | ${d.before} | ${d.after} | ${d.lost} | ${d.gained} |`);
      }
      md.push('');
    }
  }

  md.push('## Key render loss findings');
  md.push('');
  const rd = stageCounts.find((s) => s.id === 'resumeData')?.counts || {};
  const san = stageCounts.find((s) => s.id === 'sanitizeResumeForDisplay')?.counts || {};
  const cv = stageCounts.find((s) => s.id === 'cvData')?.counts || {};

  if (san.unsorted > rd.unsorted) {
    md.push(`- **sanitizeResumeForDisplay** routes rejected lines to unsorted (+${san.unsorted - rd.unsorted}).`);
  }
  if (rd.tools > cv.tools) {
    md.push(`- **Tools:** ${rd.tools} → ${cv.tools} — \`TOOL_OK_RE\` in sanitize keeps only recognized software names.`);
  }
  if (rd.languages > cv.languages) {
    md.push(`- **Languages:** ${rd.languages} → ${cv.languages} — OCR-noise language line dropped by \`LANGUAGE_OK_RE\` / \`INVALID_LANGUAGE_RE\`.`);
  }
  if (rd.unsorted > 0 && cv.unsorted === 0) {
    md.push('- **Unsorted cleared:** `resumeDataToCvData` / mapper sets `cv.unsorted = []` — unsorted never reaches template.');
  }
  if (rd.clients > cv.clients) {
    md.push(`- **Clients:** ${rd.clients} → ${cv.clients} — brand extraction + dedup in sanitize/mapper.`);
  }
  if (rd.skills !== cv.skills) {
    md.push(`- **Skills:** ${rd.skills} → ${cv.skills} — \`SKILL_OK_RE\` filters non-skill phrases; mapper may add \`Graphic design\` from title recovery.`);
  }
  if (renderMeta.html_has_tools === 0 && cv.tools > 0) {
    md.push(`- **Template render loss:** ${cv.tools} tool(s) in cvData but **0** in HTML — blocked by \`normalizeProfile\` / \`fieldRenderable\` (OCR tool line fails \`TOOL_OK_RE\` at template layer).`);
  }
  if (renderMeta.html_has_languages === 0 && cv.languages > 0) {
    md.push(`- **Template render loss:** ${cv.languages} language(s) in cvData but **0** in HTML — \`filterSectionByConfidence\` or \`fieldRenderable\` at template layer.`);
  }
  if ((renderMeta.html_experience_items ?? 0) === 0 && cv.experiences > 0) {
    md.push('- **Template:** experience string present in cvData but rendered as compact section (no `cvExpItem` nodes) — ATS template joins education on one line.');
  }
  md.push('');
  md.push('## Canonical path check');
  md.push('');
  md.push('`resumeDataToCvData(import.resumeData)` (production shortcut):');
  md.push('');
  md.push('```json');
  md.push(JSON.stringify(countsForStage(canonicalCv, 'cvData'), null, 2));
  md.push('```');
  md.push('');

  fs.writeFileSync(OUT_PATH, md.join('\n'));
  console.log('RENDER_AUDIT.md written:', OUT_PATH);
  console.log(
    stageCounts.map((s) => ({ stage: s.id, counts: s.counts }))
  );
  if (renderMeta.error) console.warn('template render:', renderMeta.error);
}

main().catch((err) => {
  console.error('render audit failed:', err);
  process.exit(1);
});
