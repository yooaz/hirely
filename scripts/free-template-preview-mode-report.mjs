#!/usr/bin/env node
/**
 * P0 — Generate FREE_TEMPLATE_PREVIEW_MODE_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'FREE_TEMPLATE_PREVIEW_MODE_REPORT.md');
const QA_JSON = path.join(ROOT, 'tests/output/free-template-preview-mode/report.json');

function runQa() {
  const res = spawnSync('node', ['src/tests/qa-free-template-preview-mode.mjs'], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 120000,
  });
  return { pass: res.status === 0 };
}

const qa = process.env.HIRELY_SKIP_QA === '1' ? { pass: null } : runQa();
const report = fs.existsSync(QA_JSON) ? JSON.parse(fs.readFileSync(QA_JSON, 'utf8')) : null;
const pass = report?.pass === true && (qa.pass === true || qa.pass === null);

const lines = [
  '# FREE_TEMPLATE_PREVIEW_MODE_REPORT',
  '',
  `**Status:** ${pass ? 'PASS' : 'FAIL'}`,
  `**Policy:** \`${report?.version || 'FREE_TEMPLATE_PREVIEW_MODE_V1'}\``,
  `**Generated:** ${report?.generatedAt || new Date().toISOString()}`,
  `**Checks:** ${report ? `${report.summary.pass}/${report.summary.total}` : 'not run'}`,
  '',
  '## Problem',
  '',
  'Pro templates were blocked at selection time (`requirePro` + preview downgrade to ATS), so free users could not evaluate premium layouts before upgrading.',
  '',
  '## Rules enforced',
  '',
  '| Rule | Behavior |',
  '|------|----------|',
  '| Free user preview | Every featured template is selectable |',
  '| CV preview | Renders selected template immediately (`renderCV` on switch) |',
  '| Pro badge | `tplCard--locked` visual badge kept on Pro tier cards |',
  '| PDF export | Still gated by `requirePro()` |',
  '| No preview paywall | Removed `requirePro()` from `switchTemplateAnimated` |',
  '| No render downgrade | Removed `isPremiumTemplate` → `FREE_TEMPLATE_ID` override |',
  '',
  '## Changes',
  '',
  '| File | Change |',
  '|------|--------|',
  '| `index.html` | `canPreviewTemplate`, preview unlock in gallery + render |',
  '| `free-template-preview-mode.js` | Policy constants + QA helpers |',
  '',
  '## Featured templates (all previewable)',
  '',
  (report?.featuredTemplates || []).map((id) => `- \`${id}\``).join('\n') || '—',
  '',
  '## QA summary',
  '',
  `| Metric | Value |`,
  `|--------|------:|`,
  `| Total | ${report?.summary?.total ?? '—'} |`,
  `| Passed | ${report?.summary?.pass ?? '—'} |`,
  `| Failed | ${report?.summary?.fail ?? '—'} |`,
  '',
];

if (report?.checks?.length) {
  lines.push('## Checklist', '', '| Check | Status | Detail |', '|-------|--------|--------|');
  for (const c of report.checks) {
    lines.push(`| ${c.id} | ${c.pass ? 'PASS' : 'FAIL'} | ${c.detail || '—'} |`);
  }
  lines.push('');
}

lines.push(
  '## Verification',
  '',
  '```bash',
  'npm run qa:free-template-preview-mode',
  'npm run free-template-preview-mode-report',
  'npm run qa:premium-template-gallery',
  '```',
  ''
);

fs.writeFileSync(OUT, lines.join('\n'));
console.log(`Wrote ${OUT}`);
process.exit(pass ? 0 : 1);
