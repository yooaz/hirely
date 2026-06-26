#!/usr/bin/env node
/**
 * P0 — CV preview must be readable at default zoom (100% desktop, no panel shrink).
 */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const REPORT = path.join(ROOT, 'CV_PREVIEW_READABILITY_REPORT.md');
const FIXTURE = path.join(ROOT, 'tests/fixtures/yoaz-cv/fixture.txt');
const MIN_ZOOM = 0.98;
const MIN_BODY_PX = 11.5;
const MIN_NAME_PX = 16;

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
  const base = `http://127.0.0.1:${port}/`;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  let metrics = null;

  try {
    await page.addInitScript(() => {
      try {
        sessionStorage.removeItem('hirely-a4-zoom-mode');
      } catch {
        /* ignore */
      }
    });

    await page.goto(`${base}index.html`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction(
      () => window.__HIRELY_CORE_BOOT__ === 'ok' && typeof window.HirelyParse?.importText === 'function',
      null,
      { timeout: 180000 }
    );

    const sample = fs.readFileSync(FIXTURE, 'utf8');
    await page.evaluate(async (text) => {
      await window.HirelyParse?.importText?.(text, { source: 'readability-qa', trusted: true, forceContinue: true });
    }, sample);

    await page.waitForFunction(
      () => document.getElementById('cvDoc')?.classList.contains('cv--live'),
      null,
      { timeout: 120000 }
    );

    await page.evaluate(() => {
      if (window.HirelyA4Viewport?.apply) window.HirelyA4Viewport.apply();
      else if (typeof syncStudioCvScale === 'function') syncStudioCvScale();
    });

    await page.waitForTimeout(400);

    metrics = await page.evaluate(() => {
      const inner = document.querySelector('.cvStageInner');
      const stage = document.getElementById('cvStage');
      const viewport = document.getElementById('a4Viewport');
      const name = document.querySelector('#cvDoc .cvName');
      const body = document.querySelector('#cvDoc .cvSectionBody, #cvDoc .cvExpEntry');
      const innerStyle = inner ? getComputedStyle(inner) : null;
      const transform = innerStyle?.transform || 'none';
      let scale = 1;
      if (transform && transform !== 'none') {
        const m = transform.match(/matrix\(([^)]+)\)/);
        if (m) scale = parseFloat(m[1].split(',')[0]) || 1;
      }
      const namePx = name ? parseFloat(getComputedStyle(name).fontSize) : 0;
      const bodyPx = body ? parseFloat(getComputedStyle(body).fontSize) : 0;
      const stageRect = stage?.getBoundingClientRect();
      const innerRect = inner?.getBoundingClientRect();
      return {
        zoomMode: window.HirelyA4Viewport?.getZoomMode?.() || viewport?.dataset?.a4Mode || '',
        zoom: Number(viewport?.dataset?.a4Zoom || scale),
        scale,
        namePx,
        bodyPx,
        stageW: stageRect?.width || 0,
        visualW: innerRect?.width || 0,
        nativeClass: viewport?.classList.contains('a4Viewport--native') || false,
        centered:
          stage && inner
            ? Math.abs((stageRect.left + stageRect.width / 2) - (innerRect.left + innerRect.width / 2)) < 48
            : false,
      };
    });

    if (metrics.zoomMode !== '100') failures.push(`default zoom mode is ${metrics.zoomMode || 'unknown'}, expected 100`);
    if (metrics.scale < MIN_ZOOM) failures.push(`preview scale ${metrics.scale} < ${MIN_ZOOM}`);
    if (metrics.bodyPx < MIN_BODY_PX) failures.push(`body text ${metrics.bodyPx}px < ${MIN_BODY_PX}px`);
    if (metrics.namePx < MIN_NAME_PX) failures.push(`name text ${metrics.namePx}px < ${MIN_NAME_PX}px`);
    if (!metrics.nativeClass) failures.push('a4Viewport--native not set at 100% zoom');
    if (!metrics.centered) failures.push('CV preview not centered in stage');

    const narrowPage = await context.newPage();
    await narrowPage.setViewportSize({ width: 1180, height: 820 });
    await narrowPage.addInitScript(() => {
      try {
        sessionStorage.removeItem('hirely-a4-zoom-mode');
      } catch {
        /* ignore */
      }
    });
    await narrowPage.goto(`${base}index.html`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await narrowPage.waitForFunction(
      () => window.__HIRELY_CORE_BOOT__ === 'ok' && typeof window.HirelyParse?.importText === 'function',
      null,
      { timeout: 180000 }
    );
    await narrowPage.evaluate(async (text) => {
      await window.HirelyParse?.importText?.(text, { source: 'readability-narrow', trusted: true, forceContinue: true });
    }, sample);
    await narrowPage.waitForFunction(
      () => document.getElementById('cvDoc')?.classList.contains('cv--live'),
      null,
      { timeout: 120000 }
    );
    await narrowPage.evaluate(() => window.HirelyA4Viewport?.apply?.());
    const narrow = await narrowPage.evaluate(() => {
      const inner = document.querySelector('.cvStageInner');
      const transform = inner ? getComputedStyle(inner).transform : 'none';
      let scale = 1;
      if (transform && transform !== 'none') {
        const m = transform.match(/matrix\(([^)]+)\)/);
        if (m) scale = parseFloat(m[1].split(',')[0]) || 1;
      }
      return { scale, mode: window.HirelyA4Viewport?.getZoomMode?.() || '' };
    });
    if (narrow.scale < MIN_ZOOM) {
      failures.push(`narrow layout (${1180}px) shrinks CV to ${narrow.scale} — panels must scroll, not shrink CV`);
    }
    await narrowPage.close();
  } finally {
    await browser.close();
    server.close();
  }

  const status = failures.length === 0 ? 'PASS' : 'FAIL';
  const lines = [
    '# CV Preview Readability Report',
    '',
    `**Status:** ${status}`,
    `**Date:** ${new Date().toISOString().slice(0, 10)}`,
    '',
    '## Goal',
    '',
    'CV preview readable without browser zoom. Desktop default 100%. Side panels scroll; A4 stays native size and centered.',
    '',
    '## Rules',
    '',
    '| Rule | Implementation |',
    '|------|----------------|',
    '| Desktop default 100% | `ZOOM_MODES.P100` default + session default on desktop |',
    '| Wide screen readable A4 | Native 794px width at scale 1.0 |',
    '| No shrink for side panels | `computeZoom` skips `scaleW` cap on desktop/tablet for 100% |',
    '| Panels scroll, CV readable | `overflow: auto` on stage/viewport; min-heights raised |',
    '| Centered prominent preview | `transform-origin: top center`, fit wrapper margin auto |',
    '',
    '## Browser check (1440×900)',
    '',
    metrics
      ? [
          '| Metric | Value |',
          '|--------|-------|',
          `| Zoom mode | ${metrics.zoomMode} |`,
          `| Scale | ${metrics.scale} |`,
          `| Name font | ${metrics.namePx}px |`,
          `| Body font | ${metrics.bodyPx}px |`,
          `| Visual width | ${Math.round(metrics.visualW)}px |`,
          `| Centered | ${metrics.centered ? 'yes' : 'no'} |`,
          '',
        ].join('\n')
      : '',
    failures.length
      ? ['## Failures', '', ...failures.map((f) => `- ${f}`), ''].join('\n')
      : '## Acceptance\n\nUser can read CV text at default zoom without browser zoom.\n',
    '## Run',
    '',
    '```bash',
    'npm run cv-preview-readability-report',
    '```',
    '',
  ];

  fs.writeFileSync(REPORT, lines.join('\n'));
  console.log(`CV preview readability: ${status}`);
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
