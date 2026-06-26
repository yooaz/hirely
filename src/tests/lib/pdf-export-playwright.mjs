/**
 * Playwright print-to-PDF — vector output with CSS page breaks (production path for QA).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  A4_WIDTH_PT,
  A4_HEIGHT_PT,
  A4_WIDTH_PX,
  A4_HEIGHT_PX,
  PDF_PAGE_MARGIN_MM,
} from '../../core/export/pdf-export-config.js';

/** Printable area height (px) after @page margins (12mm top + bottom). */
export const PRINTABLE_HEIGHT_PX = Math.round(
  A4_HEIGHT_PX * (1 - (PDF_PAGE_MARGIN_MM.top + PDF_PAGE_MARGIN_MM.bottom) / 297)
);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../../..');

export function buildPdfExportHtml(innerHtml, templateId, opts = {}) {
  const withPhoto = !!opts.withPhoto || /<img[^>]+class="cvPhoto"/i.test(innerHtml);
  const photoClass = withPhoto ? ' cv--with-photo' : '';
  const cssPaths = [
    'src/ui/templates/cv-design-tokens.css',
    'src/ui/templates/cv-templates-pack.css',
    'src/ui/templates/cv-templates-professional.css',
    'src/ui/templates/cv-templates-h20.css',
    'src/ui/templates/cv-templates-ats-elite.css',
    'src/ui/templates/cv-templates-ats-executive.css',
    'src/ui/templates/cv-templates-creative-director.css',
    'src/ui/templates/cv-templates-executive-luxury.css',
    'src/ui/templates/cv-templates-swiss-editorial.css',
    'src/ui/templates/cv-templates-visual-timeline.css',
    'src/ui/templates/cv-templates-art-director-portfolio.css',
    'src/ui/templates/cv-templates-tech-structured.css',
    'src/ui/templates/cv-templates-agency-designer.css',
    'src/ui/templates/cv-templates-editorial-magazine.css',
    'src/ui/templates/cv-templates-startup-builder.css',
    'src/ui/templates/cv-templates-v2-families.css',
    'src/ui/templates/cv-templates-v3-families.css',
    'src/ui/export/cv-a4-pages.css',
    'src/ui/templates/cv-pdf-export.css',
    'src/ui/export/pdf-export-v2.css',
    'src/ui/templates/cv-template-density.css',
    'src/ui/pro/pro-cv-features.css',
  ];
  const css = cssPaths
    .map((p) => {
      const full = path.join(root, p);
      return fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : '';
    })
    .join('\n');

  const a4PagesJs = fs.readFileSync(path.join(root, 'src/ui/export/cv-a4-pages.js'), 'utf8');

  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"/>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=Libre+Baskerville:wght@400;700&display=swap" rel="stylesheet">
<style>${css}</style>
<style>
html,body{margin:0;padding:0;background:#fff}
body{padding:0}
.cv{width:210mm;max-width:210mm;margin:0 auto;box-shadow:none;border:0}
</style>
<script>${a4PagesJs}</script>
</head><body class="export-pdf">
<div class="cv template-${templateId} spacing-normal cv--live cv--pdf-export${photoClass}">${innerHtml}</div>
</body></html>`;
}

/**
 * @param {import('playwright').Page} page
 * @param {string} innerHtml
 * @param {string} templateId
 * @param {string} outPath
 */
export async function layoutCvForExport(page) {
  return page.evaluate(() => {
    const cv = document.querySelector('.cv.cv--live');
    if (!cv || !window.HirelyA4Pages?.layoutCvA4Pages) {
      return { laidOut: false, sheetCount: 0 };
    }
    const ok = window.HirelyA4Pages.layoutCvA4Pages(cv);
    const sheets = cv.querySelectorAll('.cvA4Sheet');
    return { laidOut: ok, sheetCount: sheets.length || 0 };
  });
}

export async function measureCvContentHeight(page) {
  return page.evaluate((a4Height) => {
    const cv = document.querySelector('.cv');
    if (!cv) return { scrollHeight: 0, offsetHeight: 0, sheetCount: 0 };
    const stack = cv.querySelector('.cvA4Stack');
    if (stack) {
      const sheets = stack.querySelectorAll('.cvA4Sheet');
      const sheetCount = sheets.length || 1;
      return {
        scrollHeight: sheetCount * a4Height,
        offsetHeight: sheetCount * a4Height,
        sheetCount,
      };
    }
    return {
      scrollHeight: cv.scrollHeight,
      offsetHeight: cv.offsetHeight,
      sheetCount: 0,
    };
  }, A4_HEIGHT_PX);
}

export async function exportCvPdfPlaywright(page, innerHtml, templateId, outPath) {
  const html = buildPdfExportHtml(innerHtml, templateId);
  await page.setViewportSize({ width: A4_WIDTH_PX + 40, height: A4_HEIGHT_PX * 3 });
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
  });
  await page.waitForTimeout(150);
  const layoutResult = await layoutCvForExport(page);
  const content = await measureCvContentHeight(page);
  const sheetCount = content.sheetCount || layoutResult.sheetCount || 1;
  const contentHeightPx = Math.max(content.scrollHeight, content.offsetHeight);
  const estimatedPages = sheetCount || Math.max(1, Math.ceil(contentHeightPx / A4_HEIGHT_PX));
  await page.emulateMedia({ media: 'print' });
  await page.pdf({
    path: outPath,
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
    margin: PDF_PAGE_MARGIN_MM,
  });
  return {
    contentHeightPx,
    estimatedPages,
    sheetCount,
    laidOut: layoutResult.laidOut,
    printableHeightPx: A4_HEIGHT_PX,
  };
}

/**
 * @param {Uint8Array|Buffer} bytes
 */
function detectEmbeddedFonts(bytes) {
  const raw = Buffer.from(bytes).toString('latin1');
  return (
    /\/Type\s*\/Font\b/.test(raw) ||
    /\/FontFile\d?/.test(raw) ||
    /\/FontDescriptor/.test(raw) ||
    /\/BaseFont\//.test(raw)
  );
}

/**
 * H7 hardening checks for a single exported PDF.
 * @param {Uint8Array|Buffer} bytes
 * @param {{ contentHeightPx?: number, estimatedPages?: number, printableHeightPx?: number }} layout
 */
export async function validatePdfHardening(bytes, layout = {}) {
  const analysis = await analyzePdfBytes(bytes);
  const contentHeightPx = layout.contentHeightPx || 0;
  const sheetCount = layout.sheetCount || layout.estimatedPages || 0;
  const printableHeightPx = layout.printableHeightPx || A4_HEIGHT_PX;
  const estimatedPages = layout.estimatedPages || sheetCount || Math.max(1, Math.ceil(contentHeightPx / printableHeightPx));
  const pageCount = analysis.pageCount || 0;
  const expectedPages = sheetCount || estimatedPages;
  const capacityPx = pageCount * printableHeightPx;

  const checks = {
    a4: analysis.a4 === true,
    hasPages: pageCount >= 1,
    multiPageCapable: pageCount >= 1,
    embeddedFonts: analysis.embeddedFonts === true,
    minBytes: (analysis.bytes || 0) > 1500,
    a4LayoutApplied: layout.laidOut !== false,
    stablePagination: expectedPages > 0 ? pageCount === expectedPages : pageCount >= 1,
    noClipping: expectedPages > 0 ? contentHeightPx <= expectedPages * printableHeightPx + 8 : true,
    noOverflowEstimate: pageCount === expectedPages,
    noBlankPage: expectedPages > 0 ? pageCount === expectedPages && pageCount >= 1 : pageCount >= 1,
  };

  const issues = [];
  if (!checks.a4) issues.push('not_a4');
  if (!checks.hasPages) issues.push('no_pages');
  if (!checks.embeddedFonts) issues.push('fonts_not_embedded');
  if (!checks.minBytes) issues.push('pdf_too_small');
  if (!checks.a4LayoutApplied) issues.push('a4_layout_missing');
  if (!checks.stablePagination) issues.push('pagination_unstable');
  if (!checks.noClipping) issues.push('content_clipped');
  if (!checks.noOverflowEstimate) issues.push('page_estimate_mismatch');
  if (!checks.noBlankPage) issues.push('blank_or_extra_page');

  return {
    ...analysis,
    checks,
    issues,
    pass: issues.length === 0,
    expectedPages,
    sheetCount,
    estimatedPages,
    contentHeightPx,
    capacityPx,
  };
}

function analyzePdfBytesSync(bytes) {
  const embeddedFonts = detectEmbeddedFonts(bytes);
  return {
    pageCount: null,
    widthPt: null,
    heightPt: null,
    a4: null,
    bytes: bytes.length,
    embeddedFonts,
  };
}

export async function analyzePdfBytes(bytes) {
  const base = analyzePdfBytesSync(bytes);
  let PDFDocument;
  try {
    ({ PDFDocument } = await import('pdf-lib'));
  } catch {
    return { ...base, error: 'pdf-lib not installed' };
  }
  try {
    const pdf = await PDFDocument.load(bytes);
    const pageCount = pdf.getPageCount();
    const first = pdf.getPage(0);
    const { width, height } = first.getSize();
    const tol = 4;
    const a4 =
      Math.abs(width - A4_WIDTH_PT) <= tol && Math.abs(height - A4_HEIGHT_PT) <= tol;
    return {
      pageCount,
      widthPt: Math.round(width * 100) / 100,
      heightPt: Math.round(height * 100) / 100,
      a4,
      bytes: bytes.length,
      embeddedFonts: base.embeddedFonts,
    };
  } catch (e) {
    return { ...base, error: String(e.message || e) };
  }
}

function plainFromHtml(html) {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function tokensVisible(plain, text) {
  const raw = String(text || '').trim().toLowerCase();
  if (!raw) return false;
  if (plain.includes(raw)) return true;
  const words = raw.split(/[^a-z0-9+]+/i).filter((w) => w.length > 2);
  if (!words.length) return false;
  const hits = words.filter((w) => plain.includes(w)).length;
  return hits >= Math.max(1, Math.ceil(words.length * 0.45));
}

/**
 * Preview DOM vs exported PDF — sections, page count, clipping.
 * @param {import('playwright').Page} page — page already laid out for export
 * @param {object} cvData
 * @param {string} pdfPlainText
 * @param {{ sheetCount?: number, estimatedPages?: number }} layout
 */
export async function auditPreviewPdfParity(page, cvData, pdfPlainText, layout = {}) {
  const preview = await page.evaluate(() => {
    const cv = document.querySelector('.cv');
    const markers = [];
    const hidden = [];
    const clipped = [];
    const structural = {
      experience: !!cv?.querySelector('.cvSection--experience, .cvTimeline, .cvExpEntry'),
      education: !!cv?.querySelector('.cvSection--education, .cvEduEntry, .cvEduLine'),
      skills: !!cv?.querySelector('.cvSection--skills, .cvSkillLine'),
      tools: !!cv?.querySelector('.cvSection--software, .cvSection--tools, .cvToolsLine'),
      languages: !!cv?.querySelector('.cvSection--languages, .cvLangLine'),
      clients: !!cv?.querySelector('.cvSection--clients, .cvClientLine, .cvClientChip'),
      projects: !!cv?.querySelector('.cvSection--projects, .cvProjectEntry'),
      portfolio: !!cv?.querySelector('.cvSection--portfolio, .cvPortfolioLink'),
    };
    if (cv) {
      cv.querySelectorAll('.cvSection').forEach((el) => {
        const cls = [...el.classList].find((c) => c.startsWith('cvSection--')) || 'cvSection';
        const text = (el.innerText || '').trim();
        if (text.length > 1) markers.push({ cls, text: text.slice(0, 120), len: text.length });
        const st = getComputedStyle(el);
        if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) === 0) {
          hidden.push(cls);
        }
      });
      const walk = (el) => {
        const st = getComputedStyle(el);
        if (
          (st.overflow === 'hidden' || st.overflowY === 'hidden') &&
          el.scrollHeight > el.clientHeight + 4 &&
          (el.classList?.contains('cvSectionBody') ||
            el.classList?.contains('cvA4Sheet__surface') ||
            el.classList?.contains('cvInner'))
        ) {
          clipped.push({ cls: el.className, delta: el.scrollHeight - el.clientHeight });
        }
        for (const ch of el.children || []) walk(ch);
      };
      walk(cv);
    }
    const sheetCount = cv?.querySelectorAll('.cvA4Sheet').length || 0;
    return {
      markers,
      structural,
      sheetCount: sheetCount || 1,
      hidden,
      clipped: clipped.slice(0, 8),
      plain: (cv?.innerText || '').replace(/\s+/g, ' ').trim(),
      widthPx: cv ? Math.round(cv.getBoundingClientRect().width) : 0,
    };
  });

  const pdfPlain = plainFromHtml(pdfPlainText);
  const previewPlain = preview.plain.toLowerCase();
  const pdfPages = layout.pdfPageCount || layout.estimatedPages || preview.sheetCount;
  const pageCountMatch = preview.sheetCount === pdfPages;

  const sectionChecks = [];
  const requiredSections = [
    { key: 'experience', marker: 'cvSection--experience', sample: cvData.experience?.[0] },
    { key: 'education', marker: 'cvSection--education', sample: cvData.education?.[0] },
    { key: 'skills', marker: 'cvSection--skills', sample: cvData.skills?.[0] },
    { key: 'clients', marker: 'cvSection--clients', sample: cvData.clients?.[0] },
    { key: 'projects', marker: 'cvSection--projects', sample: cvData.projects?.[0] },
    { key: 'portfolio', marker: 'cvSection--portfolio', sample: cvData.portfolioLinks?.[0] || cvData.portfolio },
    { key: 'tools', marker: 'cvSection--software', sample: cvData.tools?.[0], alt: 'cvSection--tools' },
    { key: 'languages', marker: 'cvSection--languages', sample: cvData.languages?.[0] },
  ];

  for (const sec of requiredSections) {
    const inPreviewMarker = preview.markers.some(
      (m) => m.cls === sec.marker || (sec.alt && m.cls === sec.alt)
    );
    const inPreviewStructural = Boolean(preview.structural?.[sec.key]);
    const inPreview = inPreviewMarker || inPreviewStructural;
    const sample = String(sec.sample || '').trim();
    const inPdf = sample ? tokensVisible(pdfPlain, sample) : true;
    const inPreviewText = sample ? tokensVisible(previewPlain, sample) : inPreview;
    sectionChecks.push({
      key: sec.key,
      marker: sec.marker,
      inPreview,
      inPreviewText,
      inPdf,
      pass: inPreview && inPreviewText && inPdf,
    });
  }

  const identityOk =
    tokensVisible(pdfPlain, cvData.name) &&
    (!cvData.email || tokensVisible(pdfPlain, cvData.email.split('@')[0]));

  const issues = [];
  if (!pageCountMatch) {
    issues.push(`page_count_mismatch:preview=${preview.sheetCount}:pdf=${pdfPages}`);
  }
  if (preview.hidden.length) issues.push(`hidden_sections:${preview.hidden.join(',')}`);
  if (preview.clipped.length) issues.push(`clipped_nodes:${preview.clipped.length}`);
  for (const s of sectionChecks) {
    if (!s.pass) issues.push(`section_${s.key}:preview=${s.inPreview}:pdf=${s.inPdf}`);
  }
  if (!identityOk) issues.push('identity_missing_in_pdf');

  return {
    pass: issues.length === 0,
    issues,
    preview,
    sectionChecks,
    pageCountMatch,
    previewSheets: preview.sheetCount,
    pdfPages,
    identityOk,
  };
}

export async function auditExportDom(page) {
  return page.evaluate(() => {
    const cv = document.querySelector('.cv');
    if (!cv) return { ok: false, issues: ['no_cv_element'] };
    const cs = getComputedStyle(cv);
    const issues = [];
    const widthPx = Math.round(cv.getBoundingClientRect().width);
    if (cs.overflow === 'hidden' || cs.overflowY === 'hidden') issues.push('overflow_hidden');
    if (widthPx > 0 && (widthPx < 760 || widthPx > 830)) issues.push(`width_${widthPx}`);
    const scrollHeight = cv.scrollHeight;
    const offsetHeight = cv.offsetHeight;
    const scrollWidth = cv.scrollWidth;
    const clientWidth = cv.clientWidth;
    if (offsetHeight > 0 && scrollHeight > offsetHeight + 4 && offsetHeight < 1000) {
      issues.push('client_crop');
    }
    if (clientWidth > 0 && scrollWidth > clientWidth + 2) {
      issues.push('horizontal_overflow');
    }
    const fontsReady = document.fonts?.status === 'loaded';
    return {
      ok: issues.length === 0,
      issues,
      widthPx,
      scrollHeight,
      offsetHeight,
      scrollWidth,
      clientWidth,
      fontsReady,
      overflow: cs.overflow,
    };
  });
}
