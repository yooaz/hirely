/**
 * HIRELY H7 — PDF export hardening suite (100 generated resumes).
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { A4_WIDTH_PX } from '../../core/export/pdf-export-config.js';
import { generateHardeningResumes } from './pdf-hardening-resumes.mjs';
import {
  exportCvPdfPlaywright,
  validatePdfHardening,
  auditExportDom,
  PRINTABLE_HEIGHT_PX,
} from './pdf-export-playwright.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.join(__dirname, '../../..');
export const OUT_DIR = path.join(ROOT, 'tests/output/pdf-hardening');
export const REPORT_JSON = path.join(OUT_DIR, 'report.json');

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, (m) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[m]
  );
}

export function loadHirelyTemplates() {
  const code = fs.readFileSync(path.join(ROOT, 'src/ui/templates/cv-templates.js'), 'utf8');
  const sandbox = { console };
  sandbox.window = sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  let currentCv = null;
  sandbox.initHirelyTemplates({
    esc,
    sectionLabel: (k) =>
      ({
        profile: 'Profile',
        experience: 'Experience',
        education: 'Education',
        skills: 'Skills',
        clients: 'Clients',
        tools: 'Tools',
        languages: 'Languages',
        projects: 'Projects',
      })[k] || k,
    cvBlock: (title, html) =>
      html
        ? `<section class="cvSection"><h3 class="cvSectionTitle">${esc(title)}</h3><div class="cvSectionBody">${html}</div></section>`
        : '',
    cvSkillsHtml: (skills) => `<p class="cvSkillLine">${skills.map(esc).join(' · ')}</p>`,
    getPhotoHtml: () => {
      const photo = currentCv?.photo;
      if (!photo) return '';
      return `<div class="cvPhotoWrap"><img class="cvPhoto" src="${photo}" alt=""></div>`;
    },
  });
  const T = sandbox.HirelyTemplates;
  return {
    ...T,
    render(cv, templateId) {
      currentCv = cv;
      return T.render(cv, templateId);
    },
  };
}

/**
 * @param {{ count?: number, writePdfs?: boolean }} [opts]
 */
export async function runPdfHardeningSuite(opts = {}) {
  const count = opts.count ?? 100;
  const writePdfs = opts.writePdfs !== false;
  const resumes = generateHardeningResumes(count);
  const T = loadHirelyTemplates();

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const results = [];

  for (const item of resumes) {
    let row = {
      id: item.id,
      templateId: item.templateId,
      label: item.label,
      pass: false,
      issues: [],
      error: null,
    };

    try {
      const inner = T.render(item.cv, item.templateId);
      if (!inner || inner.length < 80) {
        row.issues.push('render_failed');
        results.push(row);
        continue;
      }

      const pdfPath = path.join(OUT_DIR, `${item.id}.pdf`);
      const layout = await exportCvPdfPlaywright(page, inner, item.templateId, pdfPath);
      const dom = await auditExportDom(page);
      const bytes = fs.readFileSync(pdfPath);
      const hardening = await validatePdfHardening(bytes, layout);

      const domOk = dom.ok;
      const issues = [
        ...hardening.issues,
        ...(domOk ? [] : dom.issues.map((x) => `dom_${x}`)),
      ];

      row = {
        ...row,
        pass: hardening.pass && domOk,
        issues,
        layout,
        dom,
        analysis: {
          pageCount: hardening.pageCount,
          widthPt: hardening.widthPt,
          heightPt: hardening.heightPt,
          a4: hardening.a4,
          bytes: hardening.bytes,
          embeddedFonts: hardening.embeddedFonts,
          sheetCount: layout.sheetCount,
        },
        checks: hardening.checks,
        expectPages: item.expectPages,
        sheetCount: layout.sheetCount,
        pdfPath: writePdfs ? path.relative(ROOT, pdfPath) : null,
      };
    } catch (e) {
      row.error = String(e.message || e);
      row.issues.push('export_error');
    }

    results.push(row);
  }

  await browser.close();

  const passed = results.filter((r) => r.pass).length;
  const report = {
    generatedAt: new Date().toISOString(),
    engine: 'PDF_EXPORT_P6',
    count,
    requirements: {
      a4: true,
      multiPage: true,
      noOverflow: '794px fixed width + overflow visible',
      noClipping: 'contentHeight <= pageCount * printableHeight',
      embeddedFonts: 'PDF /Font objects present',
      stablePagination: 'PDF pageCount === HirelyA4Pages sheet count',
    },
    a4Spec: { widthPx: A4_WIDTH_PX, printableHeightPx: PRINTABLE_HEIGHT_PX },
    exportPath: 'playwright-print (Chromium)',
    results,
    summary: {
      total: count,
      passed,
      failed: count - passed,
      passRate: count ? Math.round((passed / count) * 1000) / 10 : 0,
      pass: passed === count,
    },
  };

  fs.writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2), 'utf8');
  return report;
}

export function buildHardeningMarkdown(report) {
  const lines = [];
  lines.push('# PDF HARDENING REPORT');
  lines.push('');
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Engine: \`${report.engine}\``);
  lines.push('');
  lines.push('## Verdict');
  lines.push('');
  lines.push(report.summary.pass ? '# **PASS**' : '# **FAIL**');
  lines.push('');
  lines.push(
    `**${report.summary.passed}/${report.summary.total}** exports succeeded (${report.summary.passRate}%).`
  );
  lines.push('');
  if (!report.summary.pass) {
    lines.push('Failure threshold: **100/100** required.');
    lines.push('');
  }
  lines.push('## Guarantees audited');
  lines.push('');
  lines.push('| Guarantee | Enforcement |');
  lines.push('|-----------|-------------|');
  lines.push('| A4 | PDF page size 595.28×841.89 pt (±4 pt) |');
  lines.push('| Multi-page | 1–4 pages by content volume |');
  lines.push('| No overflow | `overflow: visible` on `.cv`; width 794px / 210mm |');
  lines.push('| No clipping | Each `cvA4Sheet` packed ≤ 1123px; PDF pages match sheet count |');
  lines.push('| Embedded fonts | PDF contains `/Type /Font` or font descriptors |');
  lines.push('| Stable pagination | `pageCount === cvA4Sheet` count (HirelyA4Pages) |');
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|--------|------:|');
  lines.push(`| Total resumes | ${report.summary.total} |`);
  lines.push(`| Passed | ${report.summary.passed} |`);
  lines.push(`| Failed | ${report.summary.failed} |`);
  lines.push(`| Pass rate | ${report.summary.passRate}% |`);
  lines.push('');
  lines.push('## By template');
  lines.push('');
  const byTpl = {};
  for (const r of report.results) {
    byTpl[r.templateId] = byTpl[r.templateId] || { pass: 0, fail: 0 };
    if (r.pass) byTpl[r.templateId].pass++;
    else byTpl[r.templateId].fail++;
  }
  lines.push('| Template | Pass | Fail |');
  lines.push('|----------|-----:|-----:|');
  for (const [tpl, s] of Object.entries(byTpl).sort()) {
    lines.push(`| ${tpl} | ${s.pass} | ${s.fail} |`);
  }
  lines.push('');

  const failures = report.results.filter((r) => !r.pass);
  if (failures.length) {
    lines.push('## Failures');
    lines.push('');
    lines.push('| ID | Template | Issues |');
    lines.push('|----|----------|--------|');
    for (const f of failures.slice(0, 25)) {
      lines.push(`| ${f.id} | ${f.templateId} | ${(f.issues || []).join(', ') || f.error || '—'} |`);
    }
    if (failures.length > 25) lines.push(`| … | … | +${failures.length - 25} more |`);
    lines.push('');
  }

  lines.push('## Pipeline');
  lines.push('');
  lines.push('```');
  lines.push('generateHardeningResumes(100)');
  lines.push('    → HirelyTemplates.render(cv, templateId)');
  lines.push('    → HirelyA4Pages.layoutCvA4Pages()');
  lines.push('    → Playwright print PDF (A4, embedded fonts)');
  lines.push('    → validatePdfHardening() + auditExportDom()');
  lines.push('```');
  lines.push('');
  lines.push('## Module map');
  lines.push('');
  lines.push('| File | Role |');
  lines.push('|------|------|');
  lines.push('| `src/ui/export/hirely-pdf-export.js` | Browser html2pdf export |');
  lines.push('| `src/ui/templates/cv-pdf-export.css` | A4 print rules, break-inside |');
  lines.push('| `src/core/export/pdf-export-config.js` | Shared A4 constants |');
  lines.push('| `src/tests/lib/pdf-export-playwright.mjs` | QA print + validation |');
  lines.push('| `src/ui/export/cv-a4-pages.js` | Deterministic A4 sheet pagination |');
  lines.push('| `src/tests/lib/pdf-hardening-resumes.mjs` | 100 resume generator |');
  lines.push('| `src/tests/lib/pdf-hardening-suite.mjs` | H7 runner |');
  lines.push('');
  lines.push('## Verification');
  lines.push('');
  lines.push('```bash');
  lines.push('npm run qa:pdf-hardening');
  lines.push('npm run pdf:hardening-report');
  lines.push('```');
  lines.push('');

  return lines.join('\n');
}
