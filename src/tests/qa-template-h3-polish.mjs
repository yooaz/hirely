#!/usr/bin/env node
/**
 * HIRELY H3 — Template Polish QA
 * - 3 stable templates render same finalResumeData
 * - A4 / PDF safe, no horizontal crop at 90% preview
 * - PDF export for all 3 templates
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import {
  PRODUCTION_TEMPLATE_IDS,
  PRODUCTION_TEMPLATE_DISPLAY_NAMES,
  TEMPLATE_SYSTEM_VERSION,
} from '../ui/templates/production-template-ids.mjs';
import {
  TEMPLATE_V2_IDS,
  resolveTemplateV2,
  resumeDataToTemplateView,
} from '../ui/templates/v2/index.js';
import { exportCvPdfPlaywright, analyzePdfBytes } from './lib/pdf-export-playwright.mjs';
import { A4_WIDTH_PX } from '../core/export/pdf-export-config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT_DIR = path.join(ROOT, 'tests/output/template-h3-polish');

const FINAL_RESUME_DATA = {
  identity: {
    name: 'Yohann Azancot',
    title: 'Graphic Designer & Illustrator',
    email: 'yoaz@hotmail.fr',
    phone: '+33 6 49 43 48 39',
    location: 'Paris, France',
  },
  summary:
    'Creative professional specializing in illustration, graphic design and visual storytelling for cultural and commercial brands.',
  experiences: [
    {
      role: 'Freelance Illustrator / Graphic Designer',
      company: 'Independent',
      dates: '2011–Present',
      bullets: ['Posters, packaging, logos, visual identity for global clients.'],
    },
    {
      role: 'Senior Designer',
      company: 'Studio Nova',
      dates: '2016–2020',
      bullets: ['Campaign toolkits for Nike, Adobe, Louis Vuitton.'],
    },
  ],
  education: ['LISAA — Web & Motion', 'Créapole — Visual Communication'],
  skills: ['Illustration', 'Brand identity', 'Art direction', 'Typography'],
  tools: ['Photoshop', 'Illustrator', 'InDesign', 'Figma'],
  languages: ['French (native)', 'English (fluent)'],
  clients: ['Nike', 'Adobe', 'Louis Vuitton', 'Pantone'],
  projects: ['Brand campaign — Global sportswear client · 2023'],
  unsorted: [],
  meta: {},
};

let failed = 0;
const results = [];

function ok(cond, msg) {
  const pass = !!cond;
  if (!pass) {
    console.error('FAIL', msg);
    failed++;
  } else {
    console.log('OK', msg);
  }
  results.push({ check: msg, pass });
  return pass;
}

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
  vm.runInContext(code, sandbox, { filename: 'cv-templates.js' });
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
      }[k] || k),
    cvBlock: (title, html) => (html ? `<section class="cvSection"><h3>${title}</h3>${html}</section>` : ''),
    cvSkillsHtml: (skills) => `<p class="cvSkillLine">${skills.map(esc).join(' · ')}</p>`,
    getPhotoHtml: () => '',
  });
  return sandbox.HirelyTemplates;
}

function loadProfessionalCss() {
  return fs.readFileSync(path.join(ROOT, 'src/ui/templates/cv-templates-professional.css'), 'utf8');
}

ok(TEMPLATE_SYSTEM_VERSION === 'p5', 'production-template-ids declares p5 lock');
ok(PRODUCTION_TEMPLATE_IDS.length === 5, 'five production templates');
ok(
  PRODUCTION_TEMPLATE_IDS.join(',') === 'ats,creative,executive-minimal',
  'canonical order ats → creative → executive-minimal'
);
ok(
  TEMPLATE_V2_IDS.every((id) => PRODUCTION_TEMPLATE_IDS.includes(id)),
  'V2 ids match production set'
);

for (const id of PRODUCTION_TEMPLATE_IDS) {
  const meta = resolveTemplateV2(id);
  ok(meta.displayName === PRODUCTION_TEMPLATE_DISPLAY_NAMES[id], `${id} display name`);
}

const view = resumeDataToTemplateView(FINAL_RESUME_DATA, { skipFinalGate: true });
const HT = loadTemplates();
const profCss = loadProfessionalCss();

const rendered = {};
for (const id of PRODUCTION_TEMPLATE_IDS) {
  const html = HT.render(view, id);
  rendered[id] = html;
  ok(html && html.length > 200, `${id} renders HTML`);
  ok(html.includes(esc(FINAL_RESUME_DATA.identity.name)), `${id} renders name`);
  ok(html.includes(esc(FINAL_RESUME_DATA.identity.email)), `${id} renders email`);
  ok(
    html.includes('Studio Nova') || html.includes('Freelance') || html.includes('Senior Designer'),
    `${id} renders experience`
  );
  ok(!/parser|ocrText|rawText|factPipeline/i.test(html), `${id} no parser logic in HTML`);
  ok(new RegExp(`template-${id.replace('-', '\\-')}`).test(profCss), `${id} has professional CSS`);
}

const expCounts = PRODUCTION_TEMPLATE_IDS.map((id) => (rendered[id].match(/cvExpEntry/g) || []).length);
ok(
  expCounts.every((c) => c >= FINAL_RESUME_DATA.experiences.length),
  `all templates show ≥${FINAL_RESUME_DATA.experiences.length} experience entries (${expCounts.join(', ')})`
);

ok(/overflow-x:\s*hidden/.test(profCss), 'H3 overflow-x hidden in CSS');
ok(/template-executive-minimal/.test(profCss), 'executive-minimal CSS block');

const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
ok(/ATS Clean/.test(indexHtml), 'index displays ATS Clean');
ok(/Creative Portfolio/.test(indexHtml), 'index displays Creative Portfolio');
ok(/Executive Minimal/.test(indexHtml), 'index displays Executive Minimal');

fs.mkdirSync(OUT_DIR, { recursive: true });

async function runPdfAndPreviewChecks() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  for (const id of PRODUCTION_TEMPLATE_IDS) {
    const inner = rendered[id];
    const pdfPath = path.join(OUT_DIR, `h3-${id}.pdf`);
    try {
      const layout = await exportCvPdfPlaywright(page, inner, id, pdfPath);
      const pdfBuf = fs.readFileSync(pdfPath);
      const pdfBytes = pdfBuf.length;
      const analysis = await analyzePdfBytes(pdfBuf);
      ok(pdfBytes > 2000, `${id} PDF export bytes (${pdfBytes})`);
      ok((analysis.pageCount || 0) >= 1, `${id} PDF has pages (${analysis.pageCount})`);
      ok(layout?.sheetCount >= 0, `${id} A4 layout ran`);
      results.push({ check: `${id} pdf`, pass: pdfBytes > 2000, pdfBytes, pages: analysis.pageCount });
    } catch (e) {
      ok(false, `${id} PDF export: ${e?.message || e}`);
    }

    const previewHtml = `<!DOCTYPE html><html><head>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&family=Libre+Baskerville:wght@400;700&display=swap" rel="stylesheet">
<style>${profCss}
html,body{margin:0;padding:0;background:#f5f5f4}
.cvPreviewWrap--90{width:794px;transform:scale(0.9);transform-origin:top left}
</style></head><body>
<div class="cvPreviewWrap--90"><div class="cv template-${id} spacing-normal">${inner}</div></div>
</body></html>`;
    await page.setViewportSize({ width: 900, height: 1200 });
    await page.setContent(previewHtml, { waitUntil: 'networkidle' });
    const metrics = await page.evaluate((a4w) => {
      const cv = document.querySelector('.cv');
      if (!cv) return { scrollWidth: 0, clientWidth: 0 };
      const rect = cv.getBoundingClientRect();
      return {
        scrollWidth: cv.scrollWidth,
        clientWidth: cv.clientWidth,
        width: rect.width,
        a4w,
      };
    }, A4_WIDTH_PX);
    ok(
      metrics.scrollWidth <= metrics.clientWidth + 2,
      `${id} no horizontal crop at 90% preview (scroll ${metrics.scrollWidth} ≤ client ${metrics.clientWidth})`
    );
  }

  await browser.close();
}

await runPdfAndPreviewChecks();

const report = {
  generatedAt: new Date().toISOString(),
  version: 'H3',
  templates: PRODUCTION_TEMPLATE_IDS.map((id) => ({
    id,
    displayName: PRODUCTION_TEMPLATE_DISPLAY_NAMES[id],
    renderLayer: resolveTemplateV2(id).renderLayerId,
  })),
  dataSource: 'finalResumeData (shared)',
  checks: results,
  pass: failed === 0,
};

fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));

if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exitCode = 1;
} else {
  console.log('\nqa-template-h3-polish: PASS');
}
