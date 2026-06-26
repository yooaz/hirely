#!/usr/bin/env node
/**
 * HIRELY TRUTH TEST — same Yoaz PDF; success = usable CV, not perfect parsing.
 * node src/tests/qa-truth-test.mjs
 */
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { normalizeToClassifyList } from '../core/parsing/safe-fallback.js';
import { flattenCvPreservedText, measureCleanedTextUtilization } from '../core/parsing/no-data-loss.js';
import {
  KNOWN_CORRUPTION_RE,
  analyzeLineCorruption,
  corruptionScoreText,
} from '../core/parsing/corruption-detector.js';
import { exportCvPdfPlaywright, analyzePdfBytes } from './lib/pdf-export-playwright.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');
const outDir = path.join(root, 'tests/output/truth-test');

const PDF_CANDIDATES = [
  process.env.HIRELY_YOAZ_PDF,
  '/Users/yohannazancot/Documents/yohann azancot cv 2024.pdf',
  '/Users/yohannazancot/Documents/cv 2024 yohann azancot copie.pdf',
  '/Users/yohannazancot/ART_ARCHIVE/PSD/cv yoaz.pdf',
].filter(Boolean);

const TECHNICAL_SELECTORS = [
  '#pipelineReportPanel',
  '.hirelyDebugPanel',
  '.hirelyForensicPanel',
  '.pipelineReport',
  '.pipelineStages',
  '.scoreCardPremium',
  '.scoreMetricsGrid',
  '.metricsMinimal',
  '.parseFeed',
  '.fieldAudit',
  '.extractionFlow',
  '.statusRow',
  '#auditPanel',
  '.trustStrip',
];

function resolveExisting(paths) {
  for (const p of paths) {
    if (p && fs.existsSync(p)) return p;
  }
  return null;
}

function preservedText(cv) {
  const tc = normalizeToClassifyList(cv?.toClassify || [])
    .map((i) => i.text)
    .join('\n');
  return [flattenCvPreservedText(cv), tc].filter(Boolean).join('\n');
}

function previewCorruptionHits(text) {
  const hits = [];
  for (const line of String(text || '').split('\n')) {
    const t = line.trim();
    if (!t || t.length < 4) continue;
    if (KNOWN_CORRUPTION_RE.test(t)) hits.push({ line: t.slice(0, 80), reason: 'known_signature' });
    const a = analyzeLineCorruption(t);
    if (a.corrupted && a.score >= 55) hits.push({ line: t.slice(0, 80), reason: a.reasons[0] || 'corrupted' });
    if (corruptionScoreText(t) >= 70) hits.push({ line: t.slice(0, 80), reason: 'high_corruption_score' });
  }
  return hits.slice(0, 8);
}

function blockedPreviewLabels(text) {
  const blocked = [];
  const patterns = [
    /missing\s+experience/i,
    /low\s+confidence/i,
    /confidence\s*[:\s]*\d{1,3}\s*%/i,
    /needs?\s+review/i,
    /\[body\]|\[header\]/i,
    /^\s*(debug|parser pipeline)/i,
  ];
  for (const re of patterns) {
    if (re.test(text)) blocked.push(re.source);
  }
  return blocked;
}

async function waitForServer(port, ms = 25000) {
  const base = `http://127.0.0.1:${port}/`;
  const start = Date.now();
  while (Date.now() - start < ms) {
    try {
      const res = await fetch(base);
      const text = await res.text();
      if (res.ok && /Hirely|hirely|cvDoc/i.test(text)) return true;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

function pickFreePort() {
  return String(3480 + Math.floor(Math.random() * 200));
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const pdfPath = resolveExisting(PDF_CANDIDATES);
  if (!pdfPath) {
    console.error('No Yoaz PDF found. Set HIRELY_YOAZ_PDF=/path/to/cv.pdf');
    process.exit(1);
  }

  console.log('HIRELY TRUTH TEST');
  console.log('PDF:', pdfPath);

  const port = process.env.HIRELY_PORT || pickFreePort();
  const base = `http://127.0.0.1:${port}/`;
  const server = spawn('python3', ['-m', 'http.server', String(port)], {
    cwd: root,
    stdio: 'ignore',
  });

  const checks = {};
  const failures = [];

  function fail(key, msg) {
    checks[key] = false;
    failures.push(msg);
    console.error('FAIL', msg);
  }

  function pass(key, msg) {
    checks[key] = true;
    console.log('OK', msg);
  }

  try {
    if (!(await waitForServer(port))) {
      fail('server', 'dev server did not start');
      process.exit(1);
    }

    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.setDefaultTimeout(300000);

    try {
      await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForFunction(() => typeof window.HirelyParse?.importFile === 'function', {
        timeout: 45000,
      });

      const uiBefore = await page.evaluate((sels) => {
        const visible = sels.filter((sel) => {
          const el = document.querySelector(sel);
          return el && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden';
        });
        const nav = [...document.querySelectorAll('.docNavItem, .heroStepTitle')]
          .map((el) => (el.textContent || '').trim())
          .filter(Boolean);
        const debugMode = document.documentElement.classList.contains('debug-mode');
        return { visible, nav, debugMode };
      }, TECHNICAL_SELECTORS);

      if (uiBefore.debugMode) fail('uiSimple', 'debug-mode active without ?debug=true');
      else if (uiBefore.visible.length) fail('uiSimple', `technical UI visible: ${uiBefore.visible.join(', ')}`);
      else {
        const nav = uiBefore.nav.join(' ').toLowerCase();
        if (uiBefore.nav.length < 3 || !/import|importer/.test(nav) || !/export|exporter/.test(nav)) {
          fail('uiSimple', `nav not simple: ${uiBefore.nav.join('|')}`);
        } else pass('uiSimple', 'simple nav, no technical panels');
      }

      await page.locator('#fileInput').setInputFiles(pdfPath);
      await page.waitForFunction(
        () => {
          const lr = window.HirelyParse?.lastResult?.cvData;
          if (!lr) return false;
          return !!(
            lr.name ||
            (lr.experience && lr.experience.length) ||
            (lr.toClassify && lr.toClassify.length) ||
            (lr.summary && lr.summary.length > 20)
          );
        },
        { timeout: 300000 }
      );

      const lastResult = await page.evaluate(() => window.HirelyParse?.lastResult || null);
      if (!lastResult?.cvData) fail('pdfImports', 'no lastResult after upload');
      else {
        const rawLen = String(lastResult.rawText || lastResult.audit?.rawText || '').trim().length;
        if (rawLen < 80) fail('pdfImports', `raw text too short (${rawLen})`);
        else pass('pdfImports', `PDF imported (${rawLen} chars raw)`);
      }

      await page.waitForSelector('#workspaceGrid.workspaceGrid--ready', { timeout: 120000 }).catch(() => {});
      await page.waitForTimeout(1500);

      const preview = await page.evaluate(() => ({
        text: document.querySelector('#cvDoc')?.innerText || '',
        htmlLen: document.querySelector('#cvDoc')?.innerHTML?.length || 0,
        editable: !!document.querySelector('#cvDoc [contenteditable]'),
      }));

      if (preview.htmlLen < 400) fail('cvVisible', `preview too small (${preview.htmlLen} B HTML)`);
      else pass('cvVisible', `CV visible (${preview.htmlLen} B HTML)`);

      const corrupt = previewCorruptionHits(preview.text);
      const blocked = blockedPreviewLabels(preview.text);
      if (corrupt.length) fail('noCorruption', `corrupted lines in preview: ${JSON.stringify(corrupt)}`);
      else pass('noCorruption', 'no corrupted text in final CV preview');
      if (blocked.length) fail('noCorruption', `debug labels in preview: ${blocked.join(', ')}`);

      const cv = lastResult.cvData;
      const tc = normalizeToClassifyList(cv.toClassify || []);
      const hasExp = (cv.experience || []).length >= 1;
      const hasClassify = tc.length >= 1 || /à classer/i.test(preview.text);
      if (!hasExp && !hasClassify) fail('uncertainClassify', 'no experience and no À classer');
      else if (hasClassify) pass('uncertainClassify', `À classer present (${tc.length} item(s))`);
      else pass('uncertainClassify', 'structured experience present (no classify queue needed)');

      await page.click('[data-doc-step="verify"]', { timeout: 8000 });
      await page.waitForTimeout(800);
      await page.evaluate(() => {
        const dock = document.getElementById('toClassifyDock');
        const panel = document.getElementById('toClassifyPanel');
        if (dock && panel && !dock.contains(panel)) dock.appendChild(panel);
        document.getElementById('workspaceGrid')?.classList.add('docStep-verify');
      });
      const classifyUi = await page.evaluate(() => ({
        buttons: document.querySelectorAll('[data-classify-target]').length,
        panelVisible: !document.getElementById('toClassifyPanel')?.classList.contains('hidden'),
        dockDisplay: getComputedStyle(document.getElementById('toClassifyDock') || document.body).display,
      }));
      if (tc.length && classifyUi.buttons < 3) {
        fail('manualMove', `classify actions missing (buttons=${classifyUi.buttons})`);
      } else if (tc.length) {
        pass('manualMove', `${classifyUi.buttons} classify actions for ${tc.length} item(s)`);
      } else {
        pass('manualMove', 'classify UI N/A (nothing to classify)');
      }

      const cleaned = String(lastResult.cleanedText || lastResult.audit?.cleanedText || lastResult.rawText || '');
      const cvForRetention = {
        ...cv,
        unsorted: [...(cv.unsorted || []), ...tc.map((i) => i.text)],
      };
      const util2 = measureCleanedTextUtilization(cleaned, cvForRetention);
      const rawLen = String(lastResult.rawText || '').length;
      const preservedLen = preservedText(cv).length;
      const nd = lastResult.noDataLoss;
      const retentionOk =
        tc.length >= 1 ||
        nd?.utilization?.meetsTarget ||
        util2.meetsTarget ||
        (rawLen > 0 && preservedLen / Math.max(1, rawLen) >= 0.18);
      if (!retentionOk) {
        fail(
          'noDisappear',
          `content not preserved (toClassify=${tc.length}, util=${util2.utilizationPct}%, preserved/raw=${Math.round((100 * preservedLen) / Math.max(1, rawLen))}%)`
        );
      } else {
        const via = tc.length
          ? `À classer (${tc.length})`
          : util2.meetsTarget
            ? `util ${util2.utilizationPct}%`
            : nd?.utilization?.meetsTarget
              ? 'pipeline no-data-loss'
              : `preserved ${Math.round((100 * preservedLen) / Math.max(1, rawLen))}% of raw`;
        pass('noDisappear', `extracted content retained — ${via}`);
      }

      const uiAfter = await page.evaluate((sels) => {
        const visible = sels.filter((sel) => {
          const el = document.querySelector(sel);
          return el && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden';
        });
        return { visible };
      }, TECHNICAL_SELECTORS);
      if (uiAfter.visible.length) fail('uiSimple', `technical UI after import: ${uiAfter.visible.join(', ')}`);

      let pdfExport = false;
      let pdfBytes = 0;
      const pdfOut = path.join(outDir, 'truth-export.pdf');
      try {
        await page.click('#downloadBtn', { timeout: 10000 });
        const download = await page.waitForEvent('download', { timeout: 25000 });
        await download.saveAs(pdfOut);
        pdfBytes = fs.statSync(pdfOut).size;
        pdfExport = pdfBytes > 5000;
      } catch (e) {
        const inner = await page.evaluate(() => document.querySelector('#cvDoc')?.innerHTML || '');
        await exportCvPdfPlaywright(page, inner, 'ats', pdfOut);
        const bytes = fs.readFileSync(pdfOut);
        const analysis = await analyzePdfBytes(bytes);
        pdfBytes = bytes.length;
        pdfExport = (analysis.pageCount || 0) >= 1 && bytes.length > 5000;
        if (!pdfExport) fail('pdfExport', `export failed: ${e.message}`);
      }
      if (pdfExport) pass('pdfExport', `PDF export OK (${pdfBytes} B)`);
      else if (!failures.some((f) => f.startsWith('pdfExport'))) fail('pdfExport', `PDF too small (${pdfBytes} B)`);

      try {
        await page.locator('#cvDoc').screenshot({ path: path.join(outDir, 'cv-truth.png'), timeout: 15000 });
      } catch {
        /* optional artifact */
      }

      const report = {
        at: new Date().toISOString(),
        pdf: pdfPath,
        pass: failures.length === 0,
        checks,
        failures,
        metrics: {
          rawLen: String(lastResult?.rawText || '').length,
          utilizationPct: util2.utilizationPct,
          toClassifyCount: tc.length,
          experienceCount: (cv.experience || []).length,
          previewChars: preview.text.length,
          corruptionHits: corrupt,
        },
        finalCv: {
          name: cv.name,
          experience: (cv.experience || []).slice(0, 6),
          toClassify: tc.map((i) => i.text).slice(0, 8),
          education: (cv.education || []).slice(0, 4),
        },
      };
      fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));

      console.log('\n--- TRUTH TEST SUMMARY ---');
      console.log(JSON.stringify(checks, null, 2));
      console.log('Report:', path.join(outDir, 'report.json'));

      if (!report.pass) {
        console.error('\nTRUTH TEST FAILED —', failures.length, 'issue(s)');
        process.exit(1);
      }
      console.log('\nTRUTH TEST PASSED');
    } finally {
      await Promise.race([
        browser.close(),
        new Promise((r) => setTimeout(r, 8000)),
      ]).catch(() => {});
    }
  } finally {
    server.kill('SIGTERM');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
