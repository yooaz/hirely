#!/usr/bin/env node
/**
 * P0 — Review queue quality filter (confidence gate, compact OCR, À classer labels).
 */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import {
  REVIEW_QUEUE_MIN_VISIBLE_CONFIDENCE,
  meetsReviewVisibilityThreshold,
  compactSuggestionDisplayText,
  resolveDisplayCategory,
  filterVisibleCategoryAlternatives,
  reviewSuggestionConfidence,
} from '../src/core/parsing/review-queue-quality-filter.js';
import { filterProductSuggestions } from '../src/core/parsing/suggestion-confidence-score.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const REPORT = path.join(ROOT, 'REVIEW_QUEUE_QUALITY_REPORT.md');
const FIXTURE = path.join(ROOT, 'tests/fixtures/yoaz-cv/fixture.txt');

function mime(fp) {
  const ext = path.extname(fp).toLowerCase();
  return (
    {
      '.html': 'text/html; charset=utf-8',
      '.js': 'text/javascript; charset=utf-8',
      '.mjs': 'text/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.json': 'application/json',
      '.wasm': 'application/wasm',
      '.svg': 'image/svg+xml',
      '.woff2': 'font/woff2',
      '.txt': 'text/plain',
    }[ext] || 'application/octet-stream'
  );
}

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url || '/', 'http://127.0.0.1');
      let fp = path.join(ROOT, decodeURIComponent(url.pathname));
      if (fp.endsWith('/')) fp = path.join(fp, 'index.html');
      if (!fp.startsWith(ROOT)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }
      fs.readFile(fp, (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end('Not found');
          return;
        }
        res.writeHead(200, { 'Content-Type': mime(fp) });
        res.end(data);
      });
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

async function main() {
  const failures = [];
  const unit = [];

  const noisyOcr =
    'Ic) yoaz27 2008 2009 : Créapole creation school management visual communication branding illustration packaging';
  const compact = compactSuggestionDisplayText(noisyOcr);
  unit.push({
    name: 'compact noisy OCR primary text',
    pass: compact.length <= 80 && !compact.includes('2008 2009 : Créapole creation school management'),
    detail: compact,
  });

  const ambiguous = resolveDisplayCategory(
    { text: '@ man visual communication', confidence: 28, needsReview: true },
    { category: 'skill', predictedCategory: 'skill', confidence: 28, needsReview: true }
  );
  unit.push({
    name: 'ambiguous low confidence → unknown (À classer)',
    pass: ambiguous === 'unknown',
    detail: ambiguous,
  });

  const zeroHidden = meetsReviewVisibilityThreshold({
    text: 'v38 A',
    confidence: 0,
    item: { field: 'raw', confidence: 0 },
  });
  unit.push({
    name: '0% non-critical hidden',
    pass: zeroHidden === false,
    detail: String(zeroHidden),
  });

  const cats = filterVisibleCategoryAlternatives(
    { text: 'Print', item: { field: 'raw' } },
    [
      { id: 'skill', label: 'Skill', confidence: 0 },
      { id: 'education', label: 'Education', confidence: 12 },
      { id: 'unknown', label: 'Unknown', confidence: 0 },
    ]
  );
  unit.push({
    name: 'hide 0% category alternatives',
    pass: cats.every((c) => c.confidence > 0) && !cats.some((c) => c.id === 'skill' && c.confidence === 0),
    detail: JSON.stringify(cats),
  });

  const candidates = [
    { kind: 'classify', id: 'g1', text: 'v38 A', category: 'skill', confidence: 0 },
    { kind: 'classify', id: 'g2', text: 'Mustrator RE scowboscc', category: 'skill', confidence: 0 },
    { kind: 'classify', id: 'l1', text: '@ man visual communication', category: 'skill', confidence: 28 },
    {
      kind: 'classify',
      id: 'm1',
      text: 'Branding and illustration for global fashion campaigns',
      category: 'skill',
      confidence: 85,
    },
  ];
  const filtered = filterProductSuggestions(candidates, { maxVisible: 2 });
  unit.push({
    name: 'filter hides <35% and 0% suggestions',
    pass:
      filtered.items.every((it) => reviewSuggestionConfidence(it) >= REVIEW_QUEUE_MIN_VISIBLE_CONFIDENCE) &&
      filtered.stats.lowConfidenceHidden >= 2,
    detail: `visible=${filtered.items.length} hidden=${filtered.stats.hidden} lowHidden=${filtered.stats.lowConfidenceHidden}`,
  });

  unit.push({
    name: 'masked count includes archived weak items',
    pass: filtered.stats.hidden >= filtered.stats.before - filtered.items.length,
    detail: `hidden=${filtered.stats.hidden}`,
  });

  for (const u of unit) {
    if (!u.pass) failures.push(`unit: ${u.name} — ${u.detail}`);
  }

  const server = await startServer();
  const port = server.address().port;
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  let browserMetrics = null;

  try {
    await page.goto(`http://127.0.0.1:${port}/index.html?pro=true`, {
      waitUntil: 'domcontentloaded',
      timeout: 120000,
    });
    await page.waitForFunction(
      () => typeof window.HirelyParse?.importText === 'function',
      null,
      { timeout: 180000 }
    );

    const sample = fs.readFileSync(FIXTURE, 'utf8');
    await page.evaluate(async (text) => {
      await window.HirelyParse.importText(text, {
        source: 'review-queue-quality-qa',
        trusted: true,
        forceContinue: true,
      });
    }, sample);

    await page.waitForFunction(
      () => document.getElementById('cvDoc')?.classList.contains('cv--live'),
      null,
      { timeout: 120000 }
    );

    await page.evaluate(() => {
      if (typeof setDocStep === 'function') setDocStep('edit');
      if (typeof renderSuggestionsPanel === 'function') renderSuggestionsPanel();
    });
    await page.waitForTimeout(800);

    browserMetrics = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('#suggestionsList .suggestionCard')];
      const texts = cards.map((c) => c.querySelector('.suggestionText')?.textContent?.trim() || '');
      const categories = cards.map(
        (c) => c.querySelector('.suggestionCategory strong')?.textContent?.trim() || ''
      );
      const zeroPct = [...document.querySelectorAll('#suggestionsList .recruiterDetectionPct')].map(
        (el) => el.textContent?.trim() || ''
      );
      const more = document.getElementById('suggestionsMore')?.textContent?.trim() || '';
      const panelText = document.getElementById('suggestionsPanel')?.innerText || '';
      return {
        cardCount: cards.length,
        texts,
        categories,
        zeroPct,
        more,
        panelText,
        hasSkillLabel: categories.some((c) => /^compétences$|^skills$/i.test(c)),
        hasAClasser: categories.some((c) => /à classer|unclassified/i.test(c)) || /à valider/i.test(panelText),
        longPrimary: texts.some((t) => t.length > 85),
        showsZeroPct: zeroPct.some((p) => p === '0%'),
      };
    });

    if (browserMetrics.longPrimary) {
      failures.push('browser: primary suggestion card shows long noisy OCR fragment');
    }
    if (browserMetrics.showsZeroPct) {
      failures.push('browser: visible suggestion shows 0% confidence category');
    }
    if (browserMetrics.cardCount > 0 && browserMetrics.hasSkillLabel && !browserMetrics.hasAClasser) {
      failures.push('browser: ambiguous items labeled as Skill instead of À classer');
    }
  } finally {
    await browser.close();
    server.close();
  }

  const status = failures.length === 0 ? 'PASS' : 'FAIL';
  const lines = [
    '# Review Queue Quality Report',
    '',
    `**Status:** ${status}`,
    `**Date:** ${new Date().toISOString().slice(0, 10)}`,
    '',
    '## Goal',
    '',
    'Review panel shows only useful, actionable suggestions — weak OCR noise hidden.',
    '',
    '## Rules',
    '',
    '| Rule | Implementation |',
    '|------|----------------|',
    `| Min confidence ${REVIEW_QUEUE_MIN_VISIBLE_CONFIDENCE}% | \`meetsReviewVisibilityThreshold\` in \`filterProductSuggestions\` |`,
    '| No 0% unless critical | `filterVisibleCategoryAlternatives` + archive `zero_confidence` |',
    '| Ambiguous → À classer | `resolveDisplayCategory` (not Skill) |',
    '| Compact primary text | `compactSuggestionDisplayText` (≤72 chars) |',
    '| Weak items grouped | `+ {n} éléments masqués` via filter stats |',
    '',
    '## Unit checks',
    '',
    '| Check | Result |',
    '|-------|--------|',
    ...unit.map((u) => `| ${u.name} | ${u.pass ? 'PASS' : 'FAIL'} ${u.detail ? `(${u.detail})` : ''} |`),
    '',
    '## Browser check (Yoaz fixture)',
    '',
    browserMetrics
      ? [
          '| Metric | Value |',
          '|--------|-------|',
          `| Visible cards | ${browserMetrics.cardCount} |`,
          `| Long primary text | ${browserMetrics.longPrimary ? 'yes' : 'no'} |`,
          `| 0% in panel | ${browserMetrics.showsZeroPct ? 'yes' : 'no'} |`,
          `| Masked line | ${browserMetrics.more || '—'} |`,
          `| Sample categories | ${browserMetrics.categories.join(', ') || '—'} |`,
          '',
        ].join('\n')
      : '',
    failures.length
      ? ['## Failures', '', ...failures.map((f) => `- ${f}`), ''].join('\n')
      : '## Acceptance\n\nReview panel shows only useful, actionable items; weak suggestions archived under masked count.\n',
    '## Run',
    '',
    '```bash',
    'npm run review-queue-quality-report',
    '```',
    '',
  ];

  fs.writeFileSync(REPORT, lines.join('\n'));
  console.log(`Review queue quality: ${status}`);
  console.log(`Report: ${REPORT}`);
  if (failures.length) {
    failures.forEach((f) => console.error('FAIL:', f));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
