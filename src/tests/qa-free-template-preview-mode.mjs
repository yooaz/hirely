#!/usr/bin/env node
/**
 * P0 — Free template preview mode (all templates selectable; export stays Pro-gated).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  FREE_TEMPLATE_PREVIEW_MODE_V1,
  isTemplatePreviewAllowedForFreeUser,
  isTemplateExportProLocked,
  indexHtmlEnablesFreeTemplatePreview,
} from '../ui/templates/free-template-preview-mode.js';
import { FEATURED_TEMPLATE_IDS } from '../ui/templates/production-template-ids.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const INDEX = path.join(ROOT, 'index.html');
const OUT_DIR = path.join(ROOT, 'tests/output/free-template-preview-mode');
const OUT_JSON = path.join(OUT_DIR, 'report.json');

let failed = 0;
const checks = [];

function record(id, pass, detail = '') {
  checks.push({ id, pass, detail });
  if (!pass) {
    failed++;
    console.error(`FAIL ${id}${detail ? ` — ${detail}` : ''}`);
  } else {
    console.log(`PASS ${id}`);
  }
}

const indexHtml = fs.readFileSync(INDEX, 'utf8');

record('policy_version', FREE_TEMPLATE_PREVIEW_MODE_V1 === 'FREE_TEMPLATE_PREVIEW_MODE_V1');
record('preview_allowed_flag', isTemplatePreviewAllowedForFreeUser() === true);
record('index_wiring', indexHtmlEnablesFreeTemplatePreview(indexHtml));
record('featured_count', FEATURED_TEMPLATE_IDS.length === 8, String(FEATURED_TEMPLATE_IDS.length));
record('no_render_downgrade', !/if\s*\(\s*!isPro\(\)\s*&&\s*isPremiumTemplate\(tpl\)\)/.test(indexHtml));
record('no_switch_paywall', !/switchTemplateAnimated[\s\S]{0,500}requirePro\(\)/.test(indexHtml));
record('pro_badge_css', indexHtml.includes('tplCard--locked'));
record('export_still_pro', /async function downloadPDF\(\)[\s\S]{0,200}requirePro\(\)/.test(indexHtml));
record('switch_updates_preview', /switchTemplateAnimated[\s\S]{0,400}renderCV\(\)/.test(indexHtml));
record('pro_tier_locked_export_meta', isTemplateExportProLocked({ tier: 'pro' }));
record('free_tier_not_locked', !isTemplateExportProLocked({ tier: 'free' }));

for (const id of FEATURED_TEMPLATE_IDS.slice(0, 3)) {
  record(`featured_listed_${id}`, indexHtml.includes(id));
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const report = {
  version: FREE_TEMPLATE_PREVIEW_MODE_V1,
  generatedAt: new Date().toISOString(),
  pass: failed === 0,
  summary: { total: checks.length, pass: checks.filter((c) => c.pass).length, fail: failed },
  checks,
  featuredTemplates: FEATURED_TEMPLATE_IDS,
};
fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2));

console.log(`\n═══ Free Template Preview Mode: ${report.summary.pass}/${report.summary.total} PASS ═══`);
process.exit(failed ? 1 : 0);
