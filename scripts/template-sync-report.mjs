#!/usr/bin/env node
/**
 * TEMPLATE SYNC REPORT — resumeData vs cvData vs rendered HTML per template.
 * node scripts/template-sync-report.mjs
 * Output: TEMPLATE_SYNC_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';
import { extractPlainTextEnterprise } from '../src/core/extraction/enterprise-engine.js';
import { runProductionExtractionPipeline } from '../src/core/pipeline/production-pipeline.js';
import { productionToHirelyImportResult } from '../src/core/pipeline/hirely-import.js';
import { buildResumeData, resumeDataToCvData } from '../src/core/resume-data.js';
import {
  PRODUCTION_TEMPLATE_IDS,
  PRODUCTION_TEMPLATE_DISPLAY_NAMES,
} from '../src/ui/templates/production-template-ids.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const TRACE_PATH = path.join(ROOT, 'TRACE_YOAZ_PIPELINE.json');
const TEMPLATES_PATH = path.join(ROOT, 'src/ui/templates/cv-templates.js');
const OUT_PATH = path.join(ROOT, 'TEMPLATE_SYNC_REPORT.md');

const TRACKED_SECTIONS = [
  { id: 'experiences', resumeKey: 'experiences', cvKey: 'experience', label: 'Experiences' },
  { id: 'education', resumeKey: 'education', cvKey: 'education', label: 'Education' },
  { id: 'clients', resumeKey: 'clients', cvKey: 'clients', label: 'Clients' },
  { id: 'skills', resumeKey: 'skills', cvKey: 'skills', label: 'Skills' },
  { id: 'tools', resumeKey: 'tools', cvKey: 'tools', label: 'Tools' },
  { id: 'languages', resumeKey: 'languages', cvKey: 'languages', label: 'Languages' },
];

function mdEsc(s) {
  return String(s || '').replace(/\|/g, '\\|');
}

function arrLen(v) {
  return Array.isArray(v) ? v.filter(Boolean).length : 0;
}

function resumeItems(rd, section) {
  if (section.id === 'experiences') {
    return (rd.experiences || []).map((e) => {
      const dates = e.dates || [e.startDate, e.endDate].filter(Boolean).join('–');
      const head = [e.role, e.company, dates].filter(Boolean).join(' — ');
      const bullets = (e.bullets || []).filter(Boolean);
      return bullets.length ? `${head}: ${bullets.join(' · ')}` : head;
    });
  }
  return (rd[section.resumeKey] || []).map((x) => String(x || '').trim()).filter(Boolean);
}

function cvItems(cv, section) {
  return (cv[section.cvKey] || []).map((x) => String(x || '').trim()).filter(Boolean);
}

function plainHtml(html) {
  return String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function significantTokens(text) {
  return String(text || '')
    .toLowerCase()
    .split(/[^a-zà-ö0-9+]+/i)
    .filter((w) => w.length > 2 && !/^\d{4}$/.test(w));
}

function itemVisibleInPlain(plain, item) {
  const raw = String(item || '').trim().toLowerCase();
  if (!raw) return false;
  if (plain.includes(raw)) return true;
  const tokens = significantTokens(raw);
  if (!tokens.length) return false;
  const hits = tokens.filter((t) => plain.includes(t)).length;
  return hits >= Math.max(1, Math.ceil(tokens.length * 0.45));
}

function sectionHtmlSlice(html, sectionId) {
  const h = String(html || '');
  const patterns = {
    experiences: [/cvSection--experience[\s\S]*?<\/section>/i, /class="cvExpItem/g],
    education: [/cvSection--education[\s\S]*?<\/section>/i, /cvEduLine/i],
    clients: [/cvSection--clients[\s\S]*?<\/section>/i, /cvClientLine/i],
    skills: [/cvSection--skills[\s\S]*?<\/section>/i, /cvSkillLine/i, />Skills</i],
    tools: [/cvSection--tools[\s\S]*?<\/section>/i, /cvToolsLine/i, />Tools</i],
    languages: [/cvSection--languages[\s\S]*?<\/section>/i, /cvLangLine/i, />Languages</i],
  };
  for (const re of patterns[sectionId] || []) {
    const m = typeof re === 'object' && re.global ? h.match(re) : h.match(re);
    if (m) return Array.isArray(m) ? m[0] : m;
  }
  return '';
}

function htmlVisibleCount(html, sectionId, items) {
  const slice = sectionHtmlSlice(html, sectionId);
  const plain = plainHtml(slice || html);
  let visible = 0;
  const missing = [];
  for (const item of items) {
    if (itemVisibleInPlain(plain, item)) visible++;
    else missing.push(item);
  }
  if (sectionId === 'experiences') {
    const expItems = (html.match(/class="cvExpItem/g) || []).length;
    if (expItems > visible) visible = expItems;
  }
  return { visible, missing, hasSection: !!slice, expItemNodes: (html.match(/class="cvExpItem/g) || []).length };
}

function loadHirelyTemplates() {
  const code = fs.readFileSync(TEMPLATES_PATH, 'utf8');
  const sandbox = { console };
  sandbox.window = sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: 'cv-templates.js' });
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
  const cvBlock = (title, body) => {
    if (!body || !String(body).replace(/<[^>]+>/g, '').trim()) return '';
    const slug = String(title || '')
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
    return `<section class="cvSection cvSection--${slug}"><h3 class="cvSectionTitle">${esc(title)}</h3><div class="cvSectionBody">${body}</div></section>`;
  };
  const cvSkillsHtml = (skills) =>
    `<p class="cvSkillLine" contenteditable>${skills.map(esc).join(' · ')}</p>`;
  sandbox.initHirelyTemplates({ esc, sectionLabel, cvBlock, cvSkillsHtml, getPhotoHtml: () => '' });
  return sandbox.HirelyTemplates;
}

function analyzeTemplate(templateId, displayName, resumeData, cvData, html) {
  const rows = [];
  const issues = { missing: [], hidden: [], truncated: [] };

  for (const section of TRACKED_SECTIONS) {
    const rdItems = resumeItems(resumeData, section);
    const cvItemsList = cvItems(cvData, section);
    const htmlStats = htmlVisibleCount(html, section.id, cvItemsList);

    const rdCount = rdItems.length;
    const cvCount = cvItemsList.length;
    const htmlCount = htmlStats.visible;

    const resumeToCvLost = Math.max(0, rdCount - cvCount);
    const cvToHtmlLost = Math.max(0, cvCount - htmlCount);
    const resumeToHtmlLost = Math.max(0, rdCount - htmlCount);

    let status = 'ok';
    if (rdCount > 0 && cvCount === 0) {
      status = 'missing';
      issues.missing.push({
        template: templateId,
        section: section.label,
        resumeCount: rdCount,
        detail: 'present in resumeData, absent in cvData',
        examples: rdItems.slice(0, 2),
      });
    } else if (cvCount > 0 && htmlCount === 0 && !htmlStats.hasSection) {
      status = 'hidden';
      issues.hidden.push({
        template: templateId,
        section: section.label,
        cvCount,
        detail: 'present in cvData, no section in rendered HTML',
        examples: cvItemsList.slice(0, 3),
      });
    } else if (cvCount > 0 && htmlCount > 0 && htmlCount < cvCount) {
      status = 'truncated';
      issues.truncated.push({
        template: templateId,
        section: section.label,
        cvCount,
        htmlCount,
        detail: 'fewer items visible in HTML than cvData',
        missing: htmlStats.missing.slice(0, 4),
      });
    } else if (resumeToCvLost > 0 && cvCount > 0) {
      status = 'partial_cv_loss';
      issues.truncated.push({
        template: templateId,
        section: section.label,
        resumeCount: rdCount,
        cvCount,
        detail: 'resumeData → cvData partial loss',
      });
    }

    rows.push({
      section: section.label,
      resumeCount: rdCount,
      cvCount,
      htmlCount,
      htmlHasSection: htmlStats.hasSection,
      expItemNodes: section.id === 'experiences' ? htmlStats.expItemNodes : null,
      status,
      resumeToCvLost,
      cvToHtmlLost,
    });
  }

  return {
    templateId,
    displayName,
    htmlChars: html.length,
    sectionCount: (html.match(/<section class="cvSection/g) || []).length,
    rows,
    issues,
    pass:
      issues.missing.length === 0 &&
      issues.hidden.length === 0 &&
      issues.truncated.length === 0,
  };
}

async function loadYoazResumeData() {
  let ocrText = '';
  if (fs.existsSync(TRACE_PATH)) {
    const trace = JSON.parse(fs.readFileSync(TRACE_PATH, 'utf8'));
    ocrText = trace.checkpoints?.OCR_OUTPUT?.object?.text || '';
  }
  if (!ocrText && fs.existsSync(path.join(ROOT, 'tests/output/ocr-quality-yoaz/report.json'))) {
    const rep = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/output/ocr-quality-yoaz/report.json'), 'utf8'));
    ocrText = rep.ocrText || '';
  }
  if (!ocrText) throw new Error('Missing Yoaz OCR text');

  const enterprise = extractPlainTextEnterprise(ocrText, 'ocr');
  const pipe = await runProductionExtractionPipeline(ocrText, {
    rawText: ocrText,
    extractionMethod: 'ocr',
    enterpriseExtraction: enterprise,
    canonicalImport: true,
  });
  const imp = productionToHirelyImportResult(pipe, { name: 'yoaz.pdf' });
  const resumeData = buildResumeData({
    importResult: imp,
    structured: pipe.structuredResume,
    rawText: ocrText,
    cleanedText: pipe.cleanedText || ocrText,
    file: { name: 'yoaz.pdf' },
    extractionMethod: 'ocr',
    warnings: imp.warnings || [],
    errors: imp.errors || [],
  });
  return { resumeData, cvData: resumeDataToCvData(resumeData), source: 'Yoaz OCR' };
}

function globalResumeCvDelta(resumeData, cvData) {
  const deltas = [];
  for (const s of TRACKED_SECTIONS) {
    const rd = resumeItems(resumeData, s).length;
    const cv = cvItems(cvData, s).length;
    if (rd !== cv) deltas.push({ section: s.label, resumeData: rd, cvData: cv, lost: Math.max(0, rd - cv) });
  }
  return deltas;
}

async function main() {
  const T = loadHirelyTemplates();
  const { resumeData, cvData, source } = await loadYoazResumeData();
  const globalDelta = globalResumeCvDelta(resumeData, cvData);

  const templateResults = [];
  for (const id of PRODUCTION_TEMPLATE_IDS) {
    const html = T.render(cvData, id) || '';
    templateResults.push(
      analyzeTemplate(id, PRODUCTION_TEMPLATE_DISPLAY_NAMES[id] || id, resumeData, cvData, html)
    );
  }

  const allMissing = templateResults.flatMap((t) => t.issues.missing);
  const allHidden = templateResults.flatMap((t) => t.issues.hidden);
  const allTruncated = templateResults.flatMap((t) => t.issues.truncated);

  const md = [];
  md.push('# TEMPLATE SYNC REPORT');
  md.push('');
  md.push(`Generated: ${new Date().toISOString()}`);
  md.push(`Data source: **${source}**`);
  md.push(`Templates audited: **${PRODUCTION_TEMPLATE_IDS.length}** (${PRODUCTION_TEMPLATE_IDS.join(', ')})`);
  md.push('');
  md.push('## Goal');
  md.push('');
  md.push('Verify **Experiences**, **Education**, **Clients**, **Skills**, **Tools**, and **Languages** across:');
  md.push('');
  md.push('1. `resumeData` (canonical)');
  md.push('2. `cvData` (template input)');
  md.push('3. Rendered HTML (`HirelyTemplates.render`)');
  md.push('');

  md.push('## Global resumeData → cvData');
  md.push('');
  if (!globalDelta.length) {
    md.push('No count deltas between resumeData and cvData for tracked sections.');
  } else {
    md.push('| Section | resumeData | cvData | Lost |');
    md.push('|---------|----------:|-------:|-----:|');
    for (const d of globalDelta) {
      md.push(`| ${d.section} | ${d.resumeData} | ${d.cvData} | ${d.lost} |`);
    }
  }
  md.push('');

  md.push('## Summary by template');
  md.push('');
  md.push('| Template | HTML chars | Sections | Missing | Hidden | Truncated | Pass |');
  md.push('|----------|----------:|---------:|--------:|-------:|----------:|:----:|');
  for (const t of templateResults) {
    md.push(
      `| ${t.displayName} (\`${t.templateId}\`) | ${t.htmlChars} | ${t.sectionCount} | ${t.issues.missing.length} | ${t.issues.hidden.length} | ${t.issues.truncated.length} | ${t.pass ? '✓' : '✗'} |`
    );
  }
  md.push('');

  md.push('## Section matrix (Yoaz data)');
  md.push('');
  md.push('| Template | Section | resumeData | cvData | HTML visible | Status |');
  md.push('|----------|---------|----------:|-------:|-------------:|--------|');
  for (const t of templateResults) {
    for (const r of t.rows) {
      md.push(
        `| ${t.templateId} | ${r.section} | ${r.resumeCount} | ${r.cvCount} | ${r.htmlCount}${r.htmlHasSection ? '' : ' (no section node)'} | ${r.status} |`
      );
    }
  }
  md.push('');

  const reportIssue = (title, list) => {
    md.push(`## ${title}`);
    md.push('');
    if (!list.length) {
      md.push('_None._');
    } else {
      for (const item of list) {
        md.push(`### ${item.template} — ${item.section}`);
        md.push('');
        md.push(`- ${item.detail || 'sync issue'}`);
        if (item.resumeCount != null) md.push(`- resumeData: ${item.resumeCount}`);
        if (item.cvCount != null) md.push(`- cvData: ${item.cvCount}`);
        if (item.htmlCount != null) md.push(`- HTML visible: ${item.htmlCount}`);
        if (item.examples?.length) {
          md.push('- Examples:');
          for (const ex of item.examples) md.push(`  - \`${String(ex).slice(0, 90)}\``);
        }
        if (item.missing?.length) {
          md.push('- Not found in HTML:');
          for (const ex of item.missing) md.push(`  - \`${String(ex).slice(0, 90)}\``);
        }
        md.push('');
      }
    }
    md.push('');
  };

  reportIssue('Missing sections (resumeData → cvData)', allMissing);
  reportIssue('Hidden sections (cvData → HTML)', allHidden);
  reportIssue('Truncated sections', allTruncated);

  md.push('## Per-template detail');
  md.push('');
  for (const t of templateResults) {
    md.push(`### ${t.displayName} (\`${t.templateId}\`)`);
    md.push('');
    md.push(`- HTML: ${t.htmlChars} chars · ${t.sectionCount} \`<section>\` nodes`);
    md.push('');
    for (const r of t.rows) {
      const bits = [
        `resumeData=${r.resumeCount}`,
        `cvData=${r.cvCount}`,
        `html=${r.htmlCount}`,
        `status=${r.status}`,
      ];
      if (r.expItemNodes != null) bits.push(`cvExpItem=${r.expItemNodes}`);
      md.push(`- **${r.section}:** ${bits.join(' · ')}`);
    }
    md.push('');
  }

  md.push('## Pipeline notes');
  md.push('');
  md.push('- **Education compact mode:** ATS/Executive/Product join multiple schools on one `cvEduLine` — counts as visible if all entries appear in plain text.');
  md.push('- **Swiss sidebar:** Skills/Tools/Languages render in `<aside>` via `cvBlock` — may lack `cvSection--skills` class but content should still be in HTML.');
  md.push('- **Template filters:** `normalizeProfile` drops lines via `fieldRenderable`, `filterSectionByConfidence`, and `TOOL_OK_RE` (tools with OCR noise).');
  md.push('- **cvData.unsorted** is always cleared before templates — never rendered.');
  md.push('');

  fs.writeFileSync(OUT_PATH, md.join('\n'));
  console.log('TEMPLATE_SYNC_REPORT.md written:', OUT_PATH);
  console.log({
    templates: templateResults.length,
    pass: templateResults.filter((t) => t.pass).length,
    missing: allMissing.length,
    hidden: allHidden.length,
    truncated: allTruncated.length,
  });
}

main().catch((err) => {
  console.error('template sync report failed:', err);
  process.exit(1);
});
