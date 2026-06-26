#!/usr/bin/env node
/**
 * PDF EXPORT AUDIT — A4 preview vs exported PDF vs cvData vs resumeData vs ATS text.
 * node scripts/pdf-export-audit.mjs
 * Output: PDF_EXPORT_AUDIT.md
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { extractPlainTextEnterprise } from '../src/core/extraction/enterprise-engine.js';
import { runProductionExtractionPipeline } from '../src/core/pipeline/production-pipeline.js';
import { productionToHirelyImportResult } from '../src/core/pipeline/hirely-import.js';
import { buildResumeData, resumeDataToCvData } from '../src/core/resume-data.js';
import { formatCvAsStructuredText } from '../src/core/export/format-cv.js';
import { analyzeAts } from '../src/core/validation/ats-analyzer.js';
import {
  PRODUCTION_TEMPLATE_IDS,
  PRODUCTION_TEMPLATE_DISPLAY_NAMES,
} from '../src/ui/templates/production-template-ids.mjs';
import {
  exportCvPdfPlaywright,
  analyzePdfBytes,
  buildPdfExportHtml,
  measureCvContentHeight,
  PRINTABLE_HEIGHT_PX,
} from '../src/tests/lib/pdf-export-playwright.mjs';
import { A4_WIDTH_PX, A4_HEIGHT_PX } from '../src/core/export/pdf-export-config.js';

const require = createRequire(import.meta.url);
const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');
const { getDocument, GlobalWorkerOptions } = pdfjs;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const TRACE_PATH = path.join(ROOT, 'TRACE_YOAZ_PIPELINE.json');
const TEMPLATES_PATH = path.join(ROOT, 'src/ui/templates/cv-templates.js');
const OUT_MD = path.join(ROOT, 'PDF_EXPORT_AUDIT.md');
const OUT_DIR = path.join(ROOT, 'tests/output/pdf-export-audit');

GlobalWorkerOptions.workerSrc = path.join(
  ROOT,
  'node_modules/pdfjs-dist/legacy/build/pdf.worker.js'
);

const TRACKED_SECTIONS = [
  { id: 'experiences', resumeKey: 'experiences', cvKey: 'experience', label: 'Experiences', atsLabel: 'Experience' },
  { id: 'education', resumeKey: 'education', cvKey: 'education', label: 'Education', atsLabel: 'Education' },
  { id: 'clients', resumeKey: 'clients', cvKey: 'clients', label: 'Clients', atsLabel: 'Clients' },
  { id: 'skills', resumeKey: 'skills', cvKey: 'skills', label: 'Skills', atsLabel: 'Skills' },
  { id: 'tools', resumeKey: 'tools', cvKey: 'tools', label: 'Tools', atsLabel: 'Tools' },
  { id: 'languages', resumeKey: 'languages', cvKey: 'languages', label: 'Languages', atsLabel: 'Languages' },
];

function mdEsc(s) {
  return String(s || '').replace(/\|/g, '\\|');
}

function plainText(html) {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
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

function countVisible(items, plain) {
  let visible = 0;
  const missing = [];
  for (const item of items) {
    if (itemVisibleInPlain(plain, item)) visible++;
    else missing.push(item);
  }
  return { visible, missing, total: items.length };
}

async function extractPdfText(pdfPath) {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const pdf = await getDocument({ data }).promise;
  const parts = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const pageText = content.items.map((it) => it.str).join(' ');
    parts.push(pageText);
  }
  return parts.join('\n');
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

async function loadYoazResumeData() {
  let ocrText = '';
  if (fs.existsSync(TRACE_PATH)) {
    const trace = JSON.parse(fs.readFileSync(TRACE_PATH, 'utf8'));
    ocrText = trace.checkpoints?.OCR_OUTPUT?.object?.text || '';
  }
  if (!ocrText && fs.existsSync(path.join(ROOT, 'tests/output/ocr-quality-yoaz/report.json'))) {
    const rep = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'tests/output/ocr-quality-yoaz/report.json'), 'utf8')
    );
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

async function auditPreviewLayout(page, innerHtml, templateId) {
  const fullHtml = buildPdfExportHtml(innerHtml, templateId);
  await page.setContent(fullHtml, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts?.ready);

  const layout = await page.evaluate(() => {
    const cv = document.querySelector('.cv');
    const hiddenSections = [];
    const overflowNodes = [];
    if (cv) {
      const walk = (el) => {
        const st = getComputedStyle(el);
        if (st.display === 'none' || st.visibility === 'hidden' || st.opacity === '0') {
          if (el.classList?.contains('cvSection') || el.closest?.('.cvSection')) {
            hiddenSections.push(el.className || el.tagName);
          }
        }
        if (
          (st.overflow === 'hidden' || st.overflowY === 'hidden') &&
          el.scrollHeight > el.clientHeight + 4 &&
          (el.classList?.contains('cv') ||
            el.classList?.contains('cvBody') ||
            el.classList?.contains('cvMain') ||
            el.classList?.contains('cvSectionBody'))
        ) {
          overflowNodes.push({
            cls: el.className,
            scroll: el.scrollHeight,
            client: el.clientHeight,
            clipped: el.scrollHeight - el.clientHeight,
          });
        }
        for (const ch of el.children || []) walk(ch);
      };
      walk(cv);
    }
    const previewText = cv?.innerText || '';
    const width = cv ? cv.getBoundingClientRect().width : 0;
    return {
      previewText,
      previewPlain: previewText.replace(/\s+/g, ' ').trim().toLowerCase(),
      widthPx: Math.round(width),
      hiddenSections: hiddenSections.slice(0, 8),
      overflowNodes: overflowNodes.slice(0, 8),
    };
  });

  const dims = await measureCvContentHeight(page);
  const contentHeightPx = Math.max(dims.scrollHeight, dims.offsetHeight);
  return { ...layout, contentHeightPx };
}

function atsSectionTokens(atsText, section) {
  const block = new RegExp(`${section.atsLabel}[\\s\\S]*?(?=\\n\\n|$)`, 'i').exec(atsText);
  if (!block) return [];
  return block[0]
    .split(/[\n,·]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 3 && !new RegExp(`^${section.atsLabel}$`, 'i').test(s));
}

function analyzeTemplate(templateId, displayName, resumeData, cvData, innerHtml, pdfPath, layoutMeta, pdfMeta) {
  const previewPlain = layoutMeta.previewPlain;
  const pdfPlain = plainText(pdfMeta.text);
  const atsText = formatCvAsStructuredText(cvData);
  const ats = analyzeAts(cvData);

  const rows = [];
  const issues = {
    missing_in_pdf: [],
    preview_pdf_mismatch: [],
    resume_cv_loss: [],
    overflow: [],
    hidden: [],
    ats_mismatch: [],
  };

  for (const section of TRACKED_SECTIONS) {
    const rdItems = resumeItems(resumeData, section);
    const cvList = cvItems(cvData, section);
    const previewStats = countVisible(cvList, previewPlain);
    const pdfStats = countVisible(cvList, pdfPlain);
    const atsTokens = atsSectionTokens(atsText, section);
    const atsStats = countVisible(cvList, plainText(atsText));

    const resumeToCvLost = Math.max(0, rdItems.length - cvList.length);
    const previewToPdfLost = Math.max(0, previewStats.visible - pdfStats.visible);
    const cvToPdfLost = Math.max(0, cvList.length - pdfStats.visible);

    let status = 'ok';
    if (resumeToCvLost > 0) {
      status = 'resume_cv_loss';
      issues.resume_cv_loss.push({
        section: section.label,
        resumeCount: rdItems.length,
        cvCount: cvList.length,
        lost: resumeToCvLost,
      });
    }
    if (cvList.length > 0 && pdfStats.visible === 0) {
      status = 'missing_in_pdf';
      issues.missing_in_pdf.push({
        section: section.label,
        cvCount: cvList.length,
        examples: cvList.slice(0, 3),
      });
    } else if (cvList.length > 0 && pdfStats.visible < cvList.length) {
      status = 'truncated_pdf';
      issues.missing_in_pdf.push({
        section: section.label,
        cvCount: cvList.length,
        pdfVisible: pdfStats.visible,
        missing: pdfStats.missing.slice(0, 4),
      });
    }
    if (previewStats.visible > pdfStats.visible) {
      issues.preview_pdf_mismatch.push({
        section: section.label,
        previewVisible: previewStats.visible,
        pdfVisible: pdfStats.visible,
        missingInPdf: pdfStats.missing.slice(0, 3),
      });
    }
    if (atsStats.visible < cvList.length && cvList.length > 0) {
      issues.ats_mismatch.push({
        section: section.label,
        cvCount: cvList.length,
        atsVisible: atsStats.visible,
        atsTokenCount: atsTokens.length,
      });
    }

    rows.push({
      section: section.label,
      resumeCount: rdItems.length,
      cvCount: cvList.length,
      previewVisible: previewStats.visible,
      pdfVisible: pdfStats.visible,
      atsVisible: atsStats.visible,
      status,
      resumeToCvLost,
      previewToPdfLost,
      cvToPdfLost,
    });
  }

  const estimatedPages = Math.max(1, Math.ceil(layoutMeta.contentHeightPx / PRINTABLE_HEIGHT_PX));
  const pageCount = pdfMeta.analysis.pageCount || 1;
  const capacityPx = pageCount * PRINTABLE_HEIGHT_PX;
  const overflowPx = Math.max(0, layoutMeta.contentHeightPx - capacityPx);
  const severeOverflow = overflowPx > PRINTABLE_HEIGHT_PX * 0.15;
  const pagesUnderestimated = estimatedPages > pageCount + 1;

  if (severeOverflow || pagesUnderestimated) {
    issues.overflow.push({
      contentHeightPx: layoutMeta.contentHeightPx,
      printablePerPage: PRINTABLE_HEIGHT_PX,
      estimatedPages,
      pdfPages: pageCount,
      overflowPx,
      severeOverflow,
      pagesUnderestimated,
    });
  }

  if (layoutMeta.hiddenSections?.length) {
    issues.hidden.push({ hiddenSections: layoutMeta.hiddenSections });
  }
  if (layoutMeta.overflowNodes?.length) {
    issues.hidden.push({ overflowClipping: layoutMeta.overflowNodes });
  }

  const identityOk =
    itemVisibleInPlain(pdfPlain, cvData.name) &&
    (!cvData.email || itemVisibleInPlain(pdfPlain, cvData.email.split('@')[0]));

  const a4Ok = pdfMeta.analysis.a4 !== false;
  const widthOk = Math.abs(layoutMeta.widthPx - A4_WIDTH_PX) <= 12;

  const pass =
    a4Ok &&
    identityOk &&
    widthOk &&
    issues.missing_in_pdf.length === 0 &&
    issues.preview_pdf_mismatch.length === 0 &&
    issues.overflow.length === 0 &&
    issues.hidden.length === 0 &&
    issues.resume_cv_loss.length === 0;

  return {
    templateId,
    displayName,
    rows,
    issues,
    layout: {
      contentHeightPx: layoutMeta.contentHeightPx,
      estimatedPages,
      pdfPages: pageCount,
      overflowPx,
      previewWidthPx: layoutMeta.widthPx,
      printableHeightPx: PRINTABLE_HEIGHT_PX,
    },
    pdf: {
      path: path.relative(ROOT, pdfPath),
      bytes: pdfMeta.analysis.bytes,
      a4: pdfMeta.analysis.a4,
      pageCount,
    },
    ats: {
      score: ats?.score ?? null,
      grade: ats?.grade ?? null,
      categories: ats?.categories?.length ?? 0,
    },
    identityOk,
    a4Ok,
    widthOk,
    pass,
  };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const T = loadHirelyTemplates();
  const { resumeData, cvData, source } = await loadYoazResumeData();
  const atsBaseline = analyzeAts(cvData);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const results = [];

  for (const templateId of PRODUCTION_TEMPLATE_IDS) {
    const innerHtml = T.render(cvData, templateId) || '';
    const pdfPath = path.join(OUT_DIR, `yoaz-${templateId}.pdf`);

    const layoutMeta = await auditPreviewLayout(page, innerHtml, templateId);
    const exportMeta = await exportCvPdfPlaywright(page, innerHtml, templateId, pdfPath);
    layoutMeta.contentHeightPx = Math.max(layoutMeta.contentHeightPx, exportMeta.contentHeightPx);

    const bytes = fs.readFileSync(pdfPath);
    const analysis = await analyzePdfBytes(bytes);
    const pdfText = await extractPdfText(pdfPath);

    results.push(
      analyzeTemplate(
        templateId,
        PRODUCTION_TEMPLATE_DISPLAY_NAMES[templateId] || templateId,
        resumeData,
        cvData,
        innerHtml,
        pdfPath,
        layoutMeta,
        { text: pdfText, analysis }
      )
    );
  }

  await browser.close();

  const globalPass = results.every((r) => r.pass);
  const anyOverflow = results.some((r) => r.issues.overflow.length);
  const anyMissing = results.some((r) => r.issues.missing_in_pdf.length);
  const anyMismatch = results.some((r) => r.issues.preview_pdf_mismatch.length);
  const anyResumeLoss = results.some((r) => r.issues.resume_cv_loss.length);

  const md = [];
  md.push('# PDF EXPORT AUDIT');
  md.push('');
  md.push(`Generated: ${new Date().toISOString()}`);
  md.push(`Data source: **${source}**`);
  md.push(`Export engine: **Playwright print-to-PDF** (production vector path)`);
  md.push(`Templates audited: **${PRODUCTION_TEMPLATE_IDS.length}** (${PRODUCTION_TEMPLATE_IDS.join(', ')})`);
  md.push(`A4 preview spec: **${A4_WIDTH_PX}×${A4_HEIGHT_PX}px** (794×1123 CSS px)`);
  md.push('');
  md.push('## Verdict');
  md.push('');
  md.push(`# ${globalPass ? 'PASS' : 'FAIL'}`);
  md.push('');
  if (!globalPass) {
    const reasons = [];
    if (anyResumeLoss) reasons.push('resumeData → cvData section loss');
    if (anyMissing) reasons.push('cvData content missing or truncated in exported PDF');
    if (anyMismatch) reasons.push('A4 preview content not fully preserved in PDF');
    if (anyOverflow) reasons.push('layout overflow / page capacity risk');
    md.push('**Failure reasons:**');
    for (const r of reasons) md.push(`- ${r}`);
    md.push('');
  }

  md.push('## Audit scope');
  md.push('');
  md.push('Verify exported PDF matches:');
  md.push('');
  md.push('1. **A4 preview** — Playwright-rendered export HTML at 794px width');
  md.push('2. **ATS data** — `formatCvAsStructuredText(cvData)` + `analyzeAts(cvData)`');
  md.push('3. **resumeData** — canonical pipeline output via `buildResumeData`');
  md.push('4. **No missing sections** — all cvData items visible in PDF plain text');
  md.push('5. **No hidden content** — no clipped `overflow:hidden` or hidden `.cvSection` nodes');
  md.push('6. **No layout overflow** — content height fits within PDF page capacity');
  md.push('');

  md.push('## Global ATS baseline');
  md.push('');
  md.push(`- ATS score: **${atsBaseline?.score ?? 'n/a'}** (${atsBaseline?.grade ?? 'n/a'})`);
  md.push(`- Identity: ${cvData.name || '—'} · ${cvData.email || '—'}`);
  md.push(`- Structured text length: ${formatCvAsStructuredText(cvData).length} chars`);
  md.push('');

  md.push('## Summary by template');
  md.push('');
  md.push('| Template | Pages | A4 | Preview W | Content H | Est. pages | PDF issues | Pass |');
  md.push('|----------|------:|:--:|----------:|----------:|-----------:|-----------:|:----:|');
  for (const r of results) {
    const issueCount =
      r.issues.missing_in_pdf.length +
      r.issues.preview_pdf_mismatch.length +
      r.issues.overflow.length +
      r.issues.hidden.length +
      r.issues.resume_cv_loss.length;
    md.push(
      `| ${r.displayName} (\`${r.templateId}\`) | ${r.pdf.pageCount} | ${r.a4Ok ? '✓' : '✗'} | ${r.layout.previewWidthPx}px | ${r.layout.contentHeightPx}px | ${r.layout.estimatedPages} | ${issueCount} | ${r.pass ? '✓' : '✗'} |`
    );
  }
  md.push('');

  md.push('## Section matrix (Yoaz → PDF)');
  md.push('');
  md.push('| Template | Section | resumeData | cvData | Preview | PDF | ATS | Status |');
  md.push('|----------|---------|----------:|-------:|--------:|----:|----:|--------|');
  for (const r of results) {
    for (const row of r.rows) {
      md.push(
        `| ${r.templateId} | ${row.section} | ${row.resumeCount} | ${row.cvCount} | ${row.previewVisible} | ${row.pdfVisible} | ${row.atsVisible} | ${row.status} |`
      );
    }
  }
  md.push('');

  const reportIssues = (title, list, fmt) => {
    md.push(`## ${title}`);
    md.push('');
    if (!list.length) {
      md.push('_None._');
    } else {
      for (const item of list) {
        md.push(fmt(item));
        md.push('');
      }
    }
    md.push('');
  };

  const allMissing = results.flatMap((r) =>
    r.issues.missing_in_pdf.map((i) => ({ template: r.templateId, ...i }))
  );
  const allMismatch = results.flatMap((r) =>
    r.issues.preview_pdf_mismatch.map((i) => ({ template: r.templateId, ...i }))
  );
  const allOverflow = results.flatMap((r) =>
    r.issues.overflow.map((i) => ({ template: r.templateId, ...i }))
  );
  const allHidden = results.flatMap((r) =>
    r.issues.hidden.map((i) => ({ template: r.templateId, ...i }))
  );
  const allResumeLoss = results.flatMap((r) =>
    r.issues.resume_cv_loss.map((i) => ({ template: r.templateId, ...i }))
  );

  reportIssues('Missing or truncated in PDF', allMissing, (i) => {
    const lines = [`### ${i.template} — ${i.section}`];
    if (i.cvCount != null) lines.push(`- cvData items: ${i.cvCount}`);
    if (i.pdfVisible != null) lines.push(`- PDF visible: ${i.pdfVisible}`);
    if (i.examples?.length) {
      lines.push('- Examples not in PDF:');
      for (const ex of i.examples) lines.push(`  - \`${String(ex).slice(0, 90)}\``);
    }
    if (i.missing?.length) {
      lines.push('- Missing tokens:');
      for (const ex of i.missing) lines.push(`  - \`${String(ex).slice(0, 90)}\``);
    }
    return lines.join('\n');
  });

  reportIssues('A4 preview vs PDF mismatch', allMismatch, (i) =>
    [
      `### ${i.template} — ${i.section}`,
      `- Preview visible: ${i.previewVisible}`,
      `- PDF visible: ${i.pdfVisible}`,
      i.missingInPdf?.length
        ? `- Lost in PDF:\n${i.missingInPdf.map((m) => `  - \`${String(m).slice(0, 90)}\``).join('\n')}`
        : '',
    ]
      .filter(Boolean)
      .join('\n')
  );

  reportIssues('Layout overflow', allOverflow, (i) =>
    [
      `### ${i.template}`,
      `- Content height: ${i.contentHeightPx}px`,
      `- Printable per page: ${i.printablePerPage}px`,
      `- Estimated pages: ${i.estimatedPages}`,
      `- PDF pages: ${i.pdfPages}`,
      `- Overflow: ${i.overflowPx}px`,
      i.severeOverflow ? '- **Severe overflow** (>15% page)' : '',
      i.pagesUnderestimated ? '- **Page count underestimated**' : '',
    ]
      .filter(Boolean)
      .join('\n')
  );

  reportIssues('Hidden / clipped content in export preview', allHidden, (i) => {
    const lines = [`### ${i.template}`];
    if (i.hiddenSections?.length) lines.push(`- Hidden sections: ${i.hiddenSections.join(', ')}`);
    if (i.overflowClipping?.length) {
      lines.push('- Overflow clipping:');
      for (const n of i.overflowClipping) {
        lines.push(`  - \`${n.cls}\` scroll=${n.scroll} client=${n.client} clipped=${n.clipped}px`);
      }
    }
    return lines.join('\n');
  });

  reportIssues('resumeData → cvData loss (upstream)', allResumeLoss, (i) =>
    [
      `### ${i.template} — ${i.section}`,
      `- resumeData: ${i.resumeCount}`,
      `- cvData: ${i.cvCount}`,
      `- Lost: ${i.lost}`,
    ].join('\n')
  );

  md.push('## Per-template detail');
  md.push('');
  for (const r of results) {
    md.push(`### ${r.displayName} (\`${r.templateId}\`)`);
    md.push('');
    md.push(`- PDF: \`${r.pdf.path}\` (${r.pdf.bytes} bytes, ${r.pdf.pageCount} page(s), A4=${r.a4Ok})`);
    md.push(`- Layout: ${r.layout.contentHeightPx}px content · est. ${r.layout.estimatedPages} pg · overflow ${r.layout.overflowPx}px`);
    md.push(`- ATS export score: ${r.ats.score ?? 'n/a'} (${r.ats.grade ?? 'n/a'})`);
    md.push(`- Identity in PDF: ${r.identityOk ? 'yes' : 'no'}`);
    md.push('');
    for (const row of r.rows) {
      md.push(
        `- **${row.section}:** resume=${row.resumeCount} cv=${row.cvCount} preview=${row.previewVisible} pdf=${row.pdfVisible} ats=${row.atsVisible} · ${row.status}`
      );
    }
    md.push('');
  }

  md.push('## Pipeline notes');
  md.push('');
  md.push('- **Export path:** `hirely-pdf-export.js` (browser html2pdf) and Playwright `page.pdf()` share A4 constants from `pdf-export-config.js`.');
  md.push('- **Preview parity:** Audit uses full-width 794px export HTML (not UI zoom 0.82) — matches `applyExportMode` / `cv--pdf-export`.');
  md.push('- **PDF text extraction:** `pdfjs-dist` `getTextContent` per page; token overlap ≥45% counts as visible.');
  md.push('- **Known upstream gaps (Yoaz):** Tools `Adobe` filtered by `fieldRenderable`; Languages corrupt line dropped resumeData→cvData — both propagate to preview and PDF.');
  md.push('- **Artifacts:** `tests/output/pdf-export-audit/yoaz-*.pdf`');
  md.push('');

  fs.writeFileSync(OUT_MD, md.join('\n'));
  console.log('PDF_EXPORT_AUDIT.md written:', OUT_MD);
  console.log({
    verdict: globalPass ? 'PASS' : 'FAIL',
    templates: results.length,
    passed: results.filter((r) => r.pass).length,
    pdfDir: path.relative(ROOT, OUT_DIR),
  });
}

main().catch((err) => {
  console.error('pdf export audit failed:', err);
  process.exit(1);
});
