#!/usr/bin/env node
/**
 * P0 — Photo + section order in collapsible drawer; CV preview stays primary.
 */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const REPORT = path.join(ROOT, 'COLLAPSIBLE_EDITOR_PANEL_REPORT.md');
const FIXTURE = path.join(ROOT, 'tests/fixtures/yoaz-cv/fixture.txt');
const MAX_CLOSED_TOOLS_HEIGHT = 56;

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
  const server = await startServer();
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}/index.html?pro=true`;

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  let metrics = null;

  try {
    await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction(
      () => typeof window.HirelyParse?.importText === 'function',
      null,
      { timeout: 180000 }
    );

    const sample = fs.readFileSync(FIXTURE, 'utf8');
    await page.evaluate(async (text) => {
      await window.HirelyParse.importText(text, {
        source: 'collapsible-panel-qa',
        trusted: true,
        forceContinue: true,
      });
    }, sample);

    await page.waitForFunction(
      () => document.getElementById('cvDoc')?.classList.contains('cv--live'),
      null,
      { timeout: 120000 }
    );

    metrics = await page.evaluate(() => {
      const tools = document.getElementById('proCvLayoutTools');
      const toggle = document.getElementById('proCvLayoutToggle');
      const drawer = document.getElementById('proCvEditDrawer');
      const photoBtn = document.getElementById('proCvPhotoBtn');
      const photoToggle = document.getElementById('proCvPhotoTemplateToggle');
      const orderList = document.getElementById('proCvSectionOrder');
      const resetBtn = document.getElementById('proCvSectionOrderReset');
      const cvStage = document.getElementById('cvStage');
      const toolsRect = tools?.getBoundingClientRect();
      const cvRect = cvStage?.getBoundingClientRect();
      const toggleLabel = toggle?.textContent?.trim() || '';
      const photoToggleLabel =
        photoToggle?.closest('label')?.querySelector('span')?.textContent?.trim() || '';
      return {
        toolsVisible: tools && !tools.classList.contains('hidden'),
        drawerHidden: drawer?.hidden ?? true,
        ariaExpanded: toggle?.getAttribute('aria-expanded'),
        toggleLabel,
        hasPhotoBtn: photoBtn?.textContent?.includes('Ajouter une photo'),
        photoToggleLabel,
        sectionOrderCount: orderList?.querySelectorAll('li').length || 0,
        hasResetBtn: resetBtn?.textContent?.trim() === 'Reset ordre',
        toolsHeight: toolsRect?.height || 0,
        cvTop: cvRect?.top || 0,
        cvHeight: cvRect?.height || 0,
      };
    });

    if (!metrics.toolsVisible) failures.push('layout tools not visible after import');
    if (!metrics.drawerHidden) failures.push('drawer must be closed by default');
    if (metrics.ariaExpanded !== 'false') failures.push(`toggle aria-expanded expected false, got ${metrics.ariaExpanded}`);
    if (metrics.toggleLabel !== 'Modifier la mise en page') {
      failures.push(`toggle label "${metrics.toggleLabel}" !== "Modifier la mise en page"`);
    }
    if (!metrics.hasPhotoBtn) failures.push('missing "Ajouter une photo" in drawer');
    if (metrics.photoToggleLabel !== 'Afficher photo sur ce modèle') {
      failures.push(`photo toggle label "${metrics.photoToggleLabel}" wrong`);
    }
    if (metrics.sectionOrderCount < 5) failures.push('section order list not populated');
    if (!metrics.hasResetBtn) failures.push('missing "Reset ordre" button');
    if (metrics.toolsHeight > MAX_CLOSED_TOOLS_HEIGHT) {
      failures.push(`closed tools height ${metrics.toolsHeight}px > ${MAX_CLOSED_TOOLS_HEIGHT}px — drawer content visible when closed`);
    }

    await page.click('#proCvLayoutToggle');
    await page.waitForTimeout(200);

    const openMetrics = await page.evaluate(() => {
      const drawer = document.getElementById('proCvEditDrawer');
      const toggle = document.getElementById('proCvLayoutToggle');
      const bar = document.getElementById('proCvEditBar');
      const barRect = bar?.getBoundingClientRect();
      return {
        drawerHidden: drawer?.hidden ?? true,
        ariaExpanded: toggle?.getAttribute('aria-expanded'),
        barHeight: barRect?.height || 0,
      };
    });

    if (openMetrics.drawerHidden) failures.push('drawer did not open on toggle click');
    if (openMetrics.ariaExpanded !== 'true') failures.push('toggle aria-expanded not true when open');
    if (openMetrics.barHeight < 80) failures.push('editor bar too small when open');

    await page.evaluate(() => {
      const order = document.getElementById('proCvSectionOrder');
      const items = [...(order?.querySelectorAll('li') || [])];
      if (items.length >= 2) {
        const first = items[0];
        const last = items[items.length - 1];
        order?.insertBefore(last, first);
      }
    });
    await page.click('#proCvSectionOrderReset');
    await page.waitForTimeout(150);
    const resetOk = await page.evaluate(() => {
      const def = window.HirelyProCvFeatures?.DEFAULT_SECTION_ORDER || [];
      const keys = [...document.querySelectorAll('#proCvSectionOrder li')].map((li) => li.dataset.sectionKey);
      return JSON.stringify(keys) === JSON.stringify(def);
    });
    if (!resetOk) failures.push('Reset ordre did not restore default section order');

    await page.click('#proCvLayoutToggle');
    await page.waitForTimeout(150);
    const closedAgain = await page.evaluate(() => document.getElementById('proCvEditDrawer')?.hidden);
    if (!closedAgain) failures.push('drawer did not close on second toggle click');
  } finally {
    await browser.close();
    server.close();
  }

  const status = failures.length === 0 ? 'PASS' : 'FAIL';
  const lines = [
    '# Collapsible Editor Panel Report',
    '',
    `**Status:** ${status}`,
    `**Date:** ${new Date().toISOString().slice(0, 10)}`,
    '',
    '## Goal',
    '',
    'Photo + section order live in a collapsible drawer so the A4 CV preview stays primary.',
    '',
    '## UI',
    '',
    '| Element | Implementation |',
    '|---------|----------------|',
    '| Toggle button | `#proCvLayoutToggle` — « Modifier la mise en page » |',
    '| Drawer (closed by default) | `#proCvEditDrawer[hidden]` |',
    '| Photo upload | `#proCvPhotoBtn` — « Ajouter une photo » |',
    '| Photo on template | `#proCvPhotoTemplateToggle` — « Afficher photo sur ce modèle » |',
    '| Section order | `#proCvSectionOrder` drag list |',
    '| Reset order | `#proCvSectionOrderReset` — « Reset ordre » |',
    '',
    '## Browser check (1440×900, ?pro=true)',
    '',
    metrics
      ? [
          '| Metric | Value |',
          '|--------|-------|',
          `| Tools visible | ${metrics.toolsVisible ? 'yes' : 'no'} |`,
          `| Drawer closed (default) | ${metrics.drawerHidden ? 'yes' : 'no'} |`,
          `| Closed tools height | ${Math.round(metrics.toolsHeight)}px |`,
          `| CV stage height | ${Math.round(metrics.cvHeight)}px |`,
          `| Section order items | ${metrics.sectionOrderCount} |`,
          '',
        ].join('\n')
      : '',
    failures.length
      ? ['## Failures', '', ...failures.map((f) => `- ${f}`), ''].join('\n')
      : '## Acceptance\n\nCV preview remains primary. Editor tools are available via the drawer without dominating the layout.\n',
    '## Run',
    '',
    '```bash',
    'npm run collapsible-editor-panel-report',
    '```',
    '',
  ];

  fs.writeFileSync(REPORT, lines.join('\n'));
  console.log(`Collapsible editor panel: ${status}`);
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
