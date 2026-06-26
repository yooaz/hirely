#!/usr/bin/env node
/**
 * P0 — Template quality gate: every production template must pass visual + PDF rules.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { requireImportStabilityForTemplates } from '../ui/templates/template-import-gate.mjs';
import { resumeDataToTemplateView } from '../ui/templates/v2/view-model.js';
import {
  TEN_PREMIUM_TEMPLATE_IDS,
  TEN_PREMIUM_TEMPLATE_NAMES,
} from '../ui/templates/ten-premium-templates.mjs';
import {
  countPopulatedSections,
  TEMPLATE_QUALITY_MIN_FIRST_PAGE_DENSITY,
  TEMPLATE_QUALITY_MAX_BLANK_TAIL,
} from '../ui/templates/template-density.mjs';
import {
  TEMPLATE_QUALITY_GATE_V1,
  TEMPLATE_QUALITY_RULES,
  htmlHasFakeContent,
  htmlHasParserLabels,
  htmlEmailMatches,
} from '../ui/templates/template-quality-gate.mjs';
import { isAcceptableDisplayName } from '../core/validation/no-fake-data-policy.js';
import { A4_HEIGHT_PX } from '../core/export/pdf-export-config.js';
import { loadHirelyTemplates } from './lib/pdf-hardening-suite.mjs';
import {
  exportCvPdfPlaywright,
  buildPdfExportHtml,
  layoutCvForExport,
  auditExportDom,
  validatePdfHardening,
} from './lib/pdf-export-playwright.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT_DIR = path.join(ROOT, 'tests/output/template-quality-gate');

const FIXTURE = {
  identity: {
    name: 'Alex Morgan',
    title: 'Product Lead',
    email: 'alex@venture.example',
    phone: '+1 415 555 0100',
    location: 'San Francisco, CA',
    portfolio: 'https://alexmorgan.dev',
  },
  summary:
    'Operator and product leader scaling venture-backed teams from zero to Series B with measurable revenue and retention outcomes.',
  experiences: [
    {
      role: 'Co-Founder & CEO',
      company: 'Northline',
      dates: '2021–Present',
      bullets: ['Grew ARR from $0 to $4.2M in 28 months.', 'Raised $8M Series A with 3x YoY retention.'],
    },
    {
      role: 'Head of Product',
      company: 'Stripe',
      dates: '2017–2021',
      bullets: ['Led onboarding used by 14M merchants.', 'Shipped billing APIs adopted by 120+ partners.'],
    },
  ],
  education: ['Stanford GSB — MBA', 'MIT — BS Computer Science'],
  skills: ['Product strategy', 'Go-to-market', 'Team building', 'Fundraising'],
  tools: ['Figma', 'Notion', 'Linear', 'SQL'],
  languages: ['English — native', 'French — professional'],
  clients: ['Nike', 'Adobe', 'Apple'],
  projects: ['Payments platform relaunch — 2023', 'Creator economy suite — 2022'],
  unsorted: [],
  meta: {},
};

let failed = 0;
const checks = [];
const templates = [];

function record(id, pass, detail = '') {
  checks.push({ id, pass, detail });
  if (!pass) {
    failed++;
    console.error(`FAIL ${id}${detail ? ` — ${detail}` : ''}`);
  } else {
    console.log(`PASS ${id}`);
  }
}

requireImportStabilityForTemplates(ROOT);
fs.mkdirSync(OUT_DIR, { recursive: true });

record('engine_version', TEMPLATE_QUALITY_GATE_V1 === 'TEMPLATE_QUALITY_GATE_V1');
record('template_count', TEN_PREMIUM_TEMPLATE_IDS.length === 8);

const HT = loadHirelyTemplates();
const view = resumeDataToTemplateView(FIXTURE, { skipFinalGate: true });
const sectionCount = countPopulatedSections(FIXTURE);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 900, height: 1200 } });

for (const id of TEN_PREMIUM_TEMPLATE_IDS) {
  const html = String(HT.render(view, id) || '');
  const fakeContent = htmlHasFakeContent(html);
  const parserLabel = htmlHasParserLabels(html);
  const emailOk = htmlEmailMatches(html, FIXTURE.identity.email);

  const nameMatch = html.match(/class="cvName"[^>]*>([^<]+)/i);
  const renderedName = (nameMatch?.[1] || '')
    .replace(/&amp;/g, '&')
    .trim();
  const nameOk = isAcceptableDisplayName(renderedName, FIXTURE.experiences);

  record(`${id}:no_fake_content`, !fakeContent);
  record(`${id}:no_parser_labels`, !parserLabel, parserLabel || '');
  record(`${id}:no_wrong_email`, emailOk, FIXTURE.identity.email);
  record(`${id}:no_company_as_name`, nameOk, renderedName);

  const exportHtml = buildPdfExportHtml(html, id);
  await page.setContent(exportHtml, { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
  });
  await page.waitForTimeout(120);
  await layoutCvForExport(page);

  const domMetrics = await page.evaluate((a4H) => {
    const sheet = document.querySelector('.cvA4Sheet[data-page="1"]') || document.querySelector('.cvA4Sheet');
    const innerEl = sheet?.querySelector('.cvInner');
    const cv = document.querySelector('.cv');
    const contentPx = innerEl ? Math.max(innerEl.scrollHeight, innerEl.offsetHeight) : 0;
    const fillRatio = a4H > 0 ? contentPx / a4H : 0;
    const clipped = [];
    const tinyFonts = [];
    const walk = (el) => {
      if (!el || el.nodeType !== 1) return;
      const st = getComputedStyle(el);
      const fs = parseFloat(st.fontSize);
      const text = (el.childNodes.length === 1 && el.childNodes[0]?.nodeType === 3
        ? el.textContent
        : ''
      ).trim();
      if (text && fs > 0 && fs < 8) tinyFonts.push(fs);
      if (
        (st.overflow === 'hidden' || st.overflowY === 'hidden') &&
        el.scrollHeight > el.clientHeight + 4 &&
        (el.classList?.contains('cvSectionBody') ||
          el.classList?.contains('cvA4Sheet__surface') ||
          el.classList?.contains('cvInner') ||
          el.classList?.contains('cvName') ||
          el.classList?.contains('cvTitle'))
      ) {
        clipped.push({ cls: el.className, delta: el.scrollHeight - el.clientHeight });
      }
      for (const ch of el.children || []) walk(ch);
    };
    if (cv) walk(cv);

    const blankTailRatio = sheet
      ? (() => {
          const rect = sheet.getBoundingClientRect();
          const last = sheet.querySelector(
            '.cvSection:last-of-type, .cvMetaFooter:last-of-type, .cvHead, .cvExpEntry:last-of-type'
          );
          if (!last || !rect.height) return 0;
          const lb = last.getBoundingClientRect();
          return Math.max(0, (rect.bottom - lb.bottom) / rect.height);
        })()
      : 1;

    const cvCs = cv ? getComputedStyle(cv) : null;
    const scaleBad =
      cvCs?.transform &&
      cvCs.transform !== 'none' &&
      /scale\(([\d.]+)/.test(cvCs.transform) &&
      parseFloat(cvCs.transform.match(/scale\(([\d.]+)/)[1]) < 0.95;

    const scrollWidth = cv?.scrollWidth || 0;
    const clientWidth = cv?.clientWidth || 0;

    return {
      fillRatio,
      blankTailRatio,
      clippedCount: clipped.length,
      tinyFontCount: tinyFonts.length,
      scaleBad: !!scaleBad,
      horizontalOverflow: clientWidth > 0 && scrollWidth > clientWidth + 2,
      textLen: (sheet?.innerText || '').replace(/\s+/g, ' ').trim().length,
    };
  }, A4_HEIGHT_PX);

  const domAudit = await auditExportDom(page);
  const horizontalOverflow = domMetrics.horizontalOverflow || domAudit.issues?.includes('horizontal_overflow');
  const cropped = domMetrics.clippedCount > 0 || domAudit.issues?.includes('client_crop');

  record(`${id}:no_cropped_text`, !cropped, `clipped=${domMetrics.clippedCount}`);
  record(
    `${id}:no_text_overflow`,
    !horizontalOverflow,
    domAudit.issues?.join(',') || ''
  );
  record(
    `${id}:readable_at_100`,
    domMetrics.tinyFontCount === 0 && !domMetrics.scaleBad,
    `tiny=${domMetrics.tinyFontCount}`
  );

  const fillPct = Math.round(domMetrics.fillRatio * 1000) / 10;
  const densityOk = domMetrics.fillRatio >= TEMPLATE_QUALITY_MIN_FIRST_PAGE_DENSITY || sectionCount < 4;
  record(
    `${id}:first_page_density_55`,
    densityOk,
    `${fillPct}% (min ${Math.round(TEMPLATE_QUALITY_MIN_FIRST_PAGE_DENSITY * 100)}%)`
  );

  const blankOk =
    domMetrics.blankTailRatio <= TEMPLATE_QUALITY_MAX_BLANK_TAIL ||
    domMetrics.fillRatio >= TEMPLATE_QUALITY_MIN_FIRST_PAGE_DENSITY;
  record(
    `${id}:no_excessive_blank_space`,
    blankOk,
    `tail=${(domMetrics.blankTailRatio * 100).toFixed(1)}% fill=${fillPct}%`
  );

  const pdfPath = path.join(OUT_DIR, `${id}.pdf`);
  let pdfOk = false;
  let pdfIssues = [];
  try {
    const layout = await exportCvPdfPlaywright(page, html, id, pdfPath);
    const bytes = fs.readFileSync(pdfPath);
    const hardening = await validatePdfHardening(bytes, layout);
    pdfOk = hardening.pass && bytes.length > 2000;
    pdfIssues = hardening.issues || [];
  } catch (e) {
    pdfIssues = [e?.message || String(e)];
  }
  record(`${id}:printable_pdf`, pdfOk, pdfIssues.join(',') || '');

  const templateChecks = checks.filter((c) => c.id.startsWith(`${id}:`));
  const templatePass = templateChecks.every((c) => c.pass);
  const templateFailures = templateChecks.filter((c) => !c.pass).map((c) => c.id.split(':')[1]);

  templates.push({
    id,
    name: TEN_PREMIUM_TEMPLATE_NAMES[id],
    fillPct,
    blankTailPct: Math.round(domMetrics.blankTailRatio * 1000) / 10,
    pass: templatePass,
    failures: templateFailures,
    textLen: domMetrics.textLen,
  });
}

await browser.close();

const report = {
  version: TEMPLATE_QUALITY_GATE_V1,
  generatedAt: new Date().toISOString(),
  rules: TEMPLATE_QUALITY_RULES,
  minFirstPageDensity: TEMPLATE_QUALITY_MIN_FIRST_PAGE_DENSITY,
  maxBlankTail: TEMPLATE_QUALITY_MAX_BLANK_TAIL,
  pass: failed === 0,
  passCount: checks.filter((c) => c.pass).length,
  failCount: failed,
  checks,
  templates,
};

fs.writeFileSync(path.join(OUT_DIR, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);

console.log(`\n═══ Template Quality Gate: ${report.passCount}/${checks.length} PASS ═══`);
process.exit(failed ? 1 : 0);
