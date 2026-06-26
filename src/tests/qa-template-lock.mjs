#!/usr/bin/env node
/**
 * HIRELY P5 — Template system lock QA.
 * - Only ATS Clean, Creative Portfolio, Executive Minimal
 * - Same finalResumeData across templates (render-only)
 * - PDF export + no horizontal crop
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
  TEMPLATE_SYSTEM_LOCK,
} from '../ui/templates/production-template-ids.mjs';
import {
  TEMPLATE_V2_IDS,
  TEMPLATE_V2_RULES,
  TEMPLATE_SYSTEM_P5_LOCK,
  resolveTemplateV2,
  assertTemplateViewContract,
} from '../ui/templates/v2/index.js';
import { resumeDataToTemplateView } from '../ui/templates/v2/view-model.js';
import { exportCvPdfPlaywright, analyzePdfBytes } from './lib/pdf-export-playwright.mjs';
import { A4_WIDTH_PX } from '../core/export/pdf-export-config.js';
import { requireImportStabilityForTemplates } from '../ui/templates/template-import-gate.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT_DIR = path.join(ROOT, 'tests/output/template-p5-lock');

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

const REQUIRED_FACTS = [
  FINAL_RESUME_DATA.identity.name,
  FINAL_RESUME_DATA.identity.email,
  FINAL_RESUME_DATA.identity.title,
  'Independent',
  'Studio Nova',
  'Illustration',
  'Brand identity',
  'Nike',
  'Louis Vuitton',
  'Créapole',
];

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

function stripHtml(html) {
  return String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeBasicEntities(text) {
  return String(text || '')
    .replace(/&amp;/g, '&')
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
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

requireImportStabilityForTemplates(ROOT);

ok(TEMPLATE_SYSTEM_VERSION === 'p5', 'production-template-ids declares p5 lock');
ok(TEMPLATE_SYSTEM_LOCK === TEMPLATE_SYSTEM_P5_LOCK, 'template lock id matches contract');
ok(PRODUCTION_TEMPLATE_IDS.length === 5, 'five production templates only');
ok(
  PRODUCTION_TEMPLATE_IDS.join(',') === 'ats,creative,executive-minimal',
  'canonical ids: ats, creative, executive-minimal'
);
ok(
  PRODUCTION_TEMPLATE_DISPLAY_NAMES.ats === 'ATS Clean',
  'ATS Clean display name'
);
ok(
  PRODUCTION_TEMPLATE_DISPLAY_NAMES.creative === 'Creative Portfolio',
  'Creative Portfolio display name'
);
ok(
  PRODUCTION_TEMPLATE_DISPLAY_NAMES['executive-minimal'] === 'Executive Minimal',
  'Executive Minimal display name'
);
ok(TEMPLATE_V2_IDS.length === 5, 'V2 registry has five templates');
ok(TEMPLATE_V2_RULES.renderingOnly === true, 'render-only rule');
ok(TEMPLATE_V2_RULES.singleDataSource === 'finalResumeData', 'single data source is finalResumeData');
ok(TEMPLATE_V2_RULES.noParserDuplication === true, 'no parser in templates');
ok(TEMPLATE_V2_RULES.noOcrInTemplates === true, 'no OCR in templates');
ok(TEMPLATE_V2_RULES.noAtsScoringInTemplates === true, 'no ATS scoring in templates');

for (const id of PRODUCTION_TEMPLATE_IDS) {
  const meta = resolveTemplateV2(id);
  ok(meta.displayName === PRODUCTION_TEMPLATE_DISPLAY_NAMES[id], `${id} registry display name`);
}

const view = resumeDataToTemplateView(FINAL_RESUME_DATA, { skipFinalGate: true });
const viewContract = assertTemplateViewContract(view);
ok(viewContract.ok, `template view has no forbidden parser fields (${viewContract.forbidden.join(', ') || 'none'})`);

const HT = loadTemplates();
ok(HT.list.length === 5, 'cv-templates.js registers exactly 5 templates');
ok(HT.listProduction().length === 5, 'listProduction returns 5 templates');
ok(
  HT.listProduction().every((t) => PRODUCTION_TEMPLATE_IDS.includes(t.id)),
  'listProduction ids match production set'
);

const profCss = loadProfessionalCss();
const pdfCss = fs.readFileSync(path.join(ROOT, 'src/ui/templates/cv-pdf-export.css'), 'utf8');
ok(/overflow-x:\s*hidden/.test(profCss), 'preview CSS prevents horizontal overflow');
ok(/max-width:\s*794px/.test(pdfCss), 'PDF export CSS fixes A4 width');

const rendered = {};
const renderedText = {};
for (const id of PRODUCTION_TEMPLATE_IDS) {
  const html = HT.render(view, id);
  rendered[id] = html;
  const text = decodeBasicEntities(stripHtml(html));
  renderedText[id] = text;
  ok(html && html.length > 200, `${id} renders HTML`);
  for (const fact of REQUIRED_FACTS) {
    ok(text.includes(fact), `${id} renders fact: ${fact}`);
  }
  ok(!/parser|ocrText|rawText|factPipeline|atsScore|recruiterScore/i.test(html), `${id} no parser/OCR/ATS in HTML`);
  ok(new RegExp(`template-${id.replace('-', '\\-')}`).test(profCss), `${id} has CSS block`);
}

const parityTokens = [
  view.name,
  view.email,
  view.title,
  ...(view.skills || []).slice(0, 3),
  ...(view.experience || []).flatMap((line) =>
    String(line || '')
      .split(/[—:–]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 3)
  ),
].filter(Boolean);

const baseText = renderedText.ats;
for (const id of ['creative', 'executive-minimal']) {
  for (const token of parityTokens) {
    ok(
      baseText.includes(token) && renderedText[id].includes(token),
      `data parity ats↔${id}: ${token}`
    );
  }
}

const expCounts = PRODUCTION_TEMPLATE_IDS.map((id) => (rendered[id].match(/cvExpEntry/g) || []).length);
ok(
  expCounts.every((c) => c >= FINAL_RESUME_DATA.experiences.length),
  `all templates show ≥${FINAL_RESUME_DATA.experiences.length} experience entries (${expCounts.join(', ')})`
);

const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
ok(/ATS Clean/.test(indexHtml), 'index references ATS Clean');
ok(/Creative Portfolio/.test(indexHtml), 'index references Creative Portfolio');
ok(/Executive Minimal/.test(indexHtml), 'index references Executive Minimal');
ok(/listProduction/.test(indexHtml), 'picker uses listProduction in production mode');

fs.mkdirSync(OUT_DIR, { recursive: true });

async function runPdfAndPreviewChecks() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  for (const id of PRODUCTION_TEMPLATE_IDS) {
    const inner = rendered[id];
    const pdfPath = path.join(OUT_DIR, `p5-${id}.pdf`);
    try {
      const layout = await exportCvPdfPlaywright(page, inner, id, pdfPath);
      const pdfBuf = fs.readFileSync(pdfPath);
      const analysis = await analyzePdfBytes(pdfBuf);
      ok(pdfBuf.length > 2000, `${id} PDF export bytes (${pdfBuf.length})`);
      ok((analysis.pageCount || 0) >= 1, `${id} PDF has pages (${analysis.pageCount})`);
      ok(layout?.sheetCount >= 0, `${id} A4 layout ran`);
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
      return {
        scrollWidth: cv.scrollWidth,
        clientWidth: cv.clientWidth,
        a4w,
      };
    }, A4_WIDTH_PX);
    ok(
      metrics.scrollWidth <= metrics.clientWidth + 2,
      `${id} no horizontal crop (scroll ${metrics.scrollWidth} ≤ client ${metrics.clientWidth})`
    );
  }

  await browser.close();
}

await runPdfAndPreviewChecks();

const report = {
  generatedAt: new Date().toISOString(),
  version: 'P5',
  lock: TEMPLATE_SYSTEM_LOCK,
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
  console.log('\nqa-template-lock: PASS');
}
