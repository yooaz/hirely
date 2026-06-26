#!/usr/bin/env node
/**
 * P0 — Generate REAL_VISUAL_BROWSER_QA_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'REAL_VISUAL_BROWSER_QA_REPORT.md');
const QA_JSON = path.join(ROOT, 'tests/output/visual-browser-qa/report.json');
const SHOT_DIR = path.join(ROOT, 'tests/output/visual-browser-qa');

function runQa() {
  const res = spawnSync('node', ['src/tests/qa-real-visual-browser.mjs'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 40 * 1024 * 1024,
  });
  return { pass: res.status === 0, out: `${res.stdout || ''}\n${res.stderr || ''}`.trim() };
}

function pct(n) {
  return `${Math.round((n || 0) * 1000) / 10}%`;
}

const qa = runQa();
const report = fs.existsSync(QA_JSON) ? JSON.parse(fs.readFileSync(QA_JSON, 'utf8')) : null;

const lines = [
  '# REAL_VISUAL_BROWSER_QA_REPORT',
  '',
  `**Status:** ${qa.pass && report?.pass ? 'PASS' : 'FAIL'}`,
  `**Generated:** ${new Date().toISOString()}`,
  `**Screenshots:** \`tests/output/visual-browser-qa/\``,
  '',
  '## Rule',
  '',
  'PASS only when the **rendered CV looks complete** in the browser export view — not JSON field counts.',
  '',
  '### Visual/DOM checks (per template × real CV)',
  '',
  '| Check | Requirement |',
  '|-------|-------------|',
  '| Identity visible | Name/header visible in preview |',
  '| Experience on page 1 | Experience block on first A4 sheet when data exists |',
  '| Clients visible | Clients section in DOM when clients exist |',
  '| Education visible | Education section in DOM when education exists |',
  '| No giant empty page 1 | Page 1 fill ≥ 40%, ≥ 180 chars |',
  '| No internal A4 scroll | No clipped overflow inside A4 sheet surfaces |',
  '| No duplicated sections | Each section type appears once |',
  '| Export shows CV | Export step visible with live A4 CV |',
  '| CV looks complete | Identity + density + experience on P1 |',
  '',
];

for (const cv of report?.cvs || []) {
  lines.push(`## ${cv.label} (\`${cv.id}\`)`, '');
  lines.push(`**File:** \`${cv.file}\``);
  lines.push(`**Import:** ${cv.importStatus} (${cv.importPath || 'direct'})`);
  lines.push(`**Result:** ${cv.pass ? 'PASS' : 'FAIL'}`, '');

  lines.push('| Template | Score | P1 fill | Exp P1 | Export | Screenshots | Pass |');
  lines.push('|----------|-------|---------|--------|--------|-------------|------|');

  for (const t of cv.templates || []) {
    const shots = t.screenshots || {};
    const shotLinks = [
      shots.exportView ? `[export](${shots.exportView})` : '—',
      shots.page1Cv ? `[page1](${shots.page1Cv})` : '—',
    ].join(' · ');
    lines.push(
      `| ${t.templateId} | ${t.visualScore}/100 | ${pct(t.page1?.fillRatio)} | ${t.experienceOnPage1 ? '✓' : '✗'} | ${t.export?.previewVisible ? '✓' : '✗'} | ${shotLinks} | ${t.pass ? '✓' : '✗'} |`
    );
  }
  lines.push('');

  const failed = (cv.templates || []).filter((t) => !t.pass);
  if (failed.length) {
    lines.push('### Failed checks', '');
    for (const t of failed) {
      const bad = Object.entries(t.checks || {})
        .filter(([, v]) => !v)
        .map(([k]) => k);
      lines.push(`- **${t.templateId}:** ${bad.join(', ') || (t.issues || []).join(', ')}`);
      if (t.internalClip?.length) {
        lines.push(`  - Internal clip: ${t.internalClip.map((c) => `${c.cls} Δ${c.delta}px`).join('; ')}`);
      }
      if (t.duplicates?.length) {
        lines.push(`  - Duplicates: ${t.duplicates.map((d) => `${d.section}×${d.count}`).join(', ')}`);
      }
    }
    lines.push('');
  }

  lines.push('### Screenshot paths', '');
  for (const t of cv.templates || []) {
    const d = path.join(SHOT_DIR, cv.id, t.templateId);
    lines.push(`- \`${path.relative(ROOT, d)}/\` — export-view.png, page1-cv.png`);
  }
  lines.push('');
}

lines.push('## Verify', '', '```bash', 'npm run qa:real-visual-browser', 'npm run real-visual-browser-qa-report', '```', '');

if (!qa.pass) {
  lines.push('## QA output', '', '```', qa.out.slice(0, 16000), '```', '');
}

fs.writeFileSync(OUT, lines.join('\n'));
console.log(`Wrote ${OUT}`);
process.exit(qa.pass && report?.pass ? 0 : 1);
