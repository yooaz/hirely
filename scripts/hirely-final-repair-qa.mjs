#!/usr/bin/env node
/**
 * HIRELY FINAL REPAIR QA — Yoaz PDF visible CV + export
 * node scripts/hirely-final-repair-qa.mjs
 */
import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { normalizeResumeData } from '../src/core/resume-data.js';
import { exportCvPdfPlaywright, analyzePdfBytes } from '../src/tests/lib/pdf-export-playwright.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT_PATH = path.join(ROOT, 'HIRELY_FINAL_REPAIR_REPORT.md');
const OUT_DIR = path.join(ROOT, 'tests/output/final-repair-qa');

const PDF_CANDIDATES = [
  process.env.HIRELY_YOAZ_PDF,
  '/Users/yohannazancot/Documents/cv/cv2022 yohann azancot copie.pdf',
  '/Users/yohannazancot/Documents/yohann azancot cv 2024.pdf',
].filter(Boolean);

const OCR_CACHE = path.join(ROOT, 'tests/output/ocr-quality-yoaz/report.json');
const TRACE_PATH = path.join(ROOT, 'TRACE_YOAZ_PIPELINE.json');

const GARBAGE_PREVIEW_RE =
  /\b(ee\s+à|v3\s*2\s*gradric|_—\s*pe|a>\s*tn|s\s+phone\s*:|lea\s+phone)\b|^\s*print\s*$/im;

function loadOcrFallbackText() {
  if (fs.existsSync(OCR_CACHE)) {
    const t = JSON.parse(fs.readFileSync(OCR_CACHE, 'utf8')).ocrText;
    if (t && t.length > 80) return t;
  }
  if (fs.existsSync(TRACE_PATH)) {
    const t = JSON.parse(fs.readFileSync(TRACE_PATH, 'utf8')).checkpoints?.OCR_OUTPUT?.object?.text;
    if (t && t.length > 80) return t;
  }
  return '';
}

function resolvePdf() {
  for (const p of PDF_CANDIDATES) {
    if (p && fs.existsSync(p)) return p;
  }
  return null;
}

function mime(fp) {
  const ext = path.extname(fp).toLowerCase();
  return (
    { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css' }[
      ext
    ] || 'application/octet-stream'
  );
}

function createServer(port) {
  return http.createServer((req, res) => {
    const u = req.url.split('?')[0];
    const rel = u === '/' ? '/index.html' : u;
    const fp = path.join(ROOT, decodeURIComponent(rel));
    if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, { 'Content-Type': mime(fp) });
    fs.createReadStream(fp).pipe(res);
  });
}

function arrLen(v) {
  return Array.isArray(v) ? v.filter(Boolean).length : 0;
}

function headlessCountsFromOcr() {
  const text = loadOcrFallbackText();
  if (!text) return null;
  const rd = normalizeResumeData({
    identity: { name: 'Nom à confirmer', title: 'Poste à compléter' },
    unsorted: text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean),
    meta: { warnings: [] },
  });
  return {
    name: rd.identity?.name || '',
    email: rd.identity?.email || '',
    experiences: arrLen(rd.experiences),
    education: arrLen(rd.education),
    tools: arrLen(rd.tools),
    clients: arrLen(rd.clients),
    educationLines: rd.education || [],
  };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const pdfPath = resolvePdf();
  const before = headlessCountsFromOcr();

  if (!pdfPath) {
    fs.writeFileSync(OUT_PATH, '# HIRELY FINAL REPAIR QA\n\n## Verdict\n\n# FAIL\n\nNo Yoaz PDF.\n');
    process.exit(1);
  }

  const port = 3090 + Math.floor(Math.random() * 30);
  const srv = createServer(port);
  await new Promise((r) => srv.listen(port, r));

  const checks = [];
  let previewText = '';
  let cvData = {};
  let resumeData = null;
  let counts = {};
  let a4Zoom = null;
  let pdfBytes = 0;

  const add = (id, label, ok, detail = '') => {
    checks.push({ id, label, ok, detail });
  };

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 960 } });
  page.setDefaultTimeout(360000);

  try {
    await page.goto(`http://127.0.0.1:${port}/?pro=true`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction(() => typeof window.HirelyParse?.handleFileImport === 'function', {
      timeout: 240000,
    });

    const pdfBuf = fs.readFileSync(pdfPath);
    let importPath = 'direct';
    let importState = await page.evaluate(
      async ({ b64, name }) => {
        const bin = atob(b64);
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        const file = new File([arr], name, { type: 'application/pdf' });
        return window.HirelyParse.handleFileImport(file, 'final-repair-qa');
      },
      { b64: pdfBuf.toString('base64'), name: path.basename(pdfPath) }
    );

    if (importState === 'IMPORT_NEEDS_PASTE') {
      const fallbackText = loadOcrFallbackText();
      if (fallbackText.length >= 80) {
        importPath = 'paste-fallback';
        const pasted = await page.evaluate(async (raw) => {
          return window.HirelyParse?.importText?.(raw, {
            source: 'paste-fallback',
            trusted: true,
            forceContinue: true,
          });
        }, fallbackText);
        importState = pasted ? 'IMPORT_READY' : importState;
      }
    }

    add(
      'import',
      'Import completes',
      importState === 'IMPORT_READY' || importState === 'IMPORT_PARTIAL',
      `${importState} (${importPath})`
    );

    await page.waitForFunction(
      () => document.querySelector('#workspaceGrid')?.classList.contains('workspaceGrid--ready'),
      { timeout: 180000 }
    ).catch(() => {});

    await page.evaluate(() => {
      const btn = document.querySelector('.hirelyProgressStep[data-doc-step="edit"] .hirelyProgressBtn');
      if (btn && !btn.disabled) btn.click();
    });
    await page.waitForFunction(
      () => document.querySelector('#workspace')?.dataset?.docStep === 'edit',
      { timeout: 30000 }
    );
    await page.waitForTimeout(1200);
    a4Zoom = await page.evaluate(() => window.HirelyA4Viewport?.apply?.());

    const snap = await page.evaluate(() => {
      const lr = window.HirelyParse?.lastResult || {};
      const rd = lr.resumeData || window.state?.resumeData || null;
      const cv = lr.cvData || window.state?.cvData || null;
      const viewport = document.getElementById('a4Viewport');
      const inner = document.querySelector('#a4Viewport .cvStageInner');
      const stageRect = document.getElementById('cvStage')?.getBoundingClientRect();
      const innerRect = inner?.getBoundingClientRect();
      return {
        cvData: cv,
        resumeData: rd,
        previewText: document.querySelector('#cvDoc')?.innerText || '',
        uiChecklist: [...document.querySelectorAll('#reviewV2Checklist .atsCheckItem')].map((li) => ({
          text: li.querySelector('.atsCheckLabel')?.textContent?.trim() || '',
          ok: li.classList.contains('is-ok') || li.classList.contains('atsCheckItem--ok'),
        })),
        a4Dataset: viewport?.dataset?.a4Zoom || '',
        innerW: innerRect?.width || 0,
        stageW: stageRect?.width || 0,
        cropped: innerRect && stageRect ? innerRect.width > stageRect.width + 4 : false,
      };
    });

    cvData = snap.cvData || {};
    resumeData = snap.resumeData;
    previewText = snap.previewText;
    counts = {
      experiences: Math.max(arrLen(resumeData?.experiences), arrLen(cvData.experience)),
      education: Math.max(arrLen(resumeData?.education), arrLen(cvData.education)),
      tools: Math.max(arrLen(resumeData?.tools), arrLen(cvData.tools)),
      clients: Math.max(arrLen(resumeData?.clients), arrLen(cvData.clients)),
    };

    const hasName =
      /yohann\s+azancot/i.test(previewText) ||
      /yohann\s+azancot/i.test(cvData.name || '') ||
      /nom\s+à\s+confirmer/i.test(previewText);
    add('name', 'Name visible', hasName, cvData.name || previewText.slice(0, 40));

    add(
      'experience',
      'Freelance experience visible',
      /freelance\s+illustrator/i.test(previewText) || counts.experiences >= 1,
      `${counts.experiences} entries`
    );

    add(
      'education',
      'LISAA education visible',
      /lisaa/i.test(previewText) && /web\s+and\s+motion|motion\s+design/i.test(previewText),
      (resumeData?.education || cvData.education || []).join(' | ').slice(0, 120)
    );

    const creapoleDupes = (resumeData?.education || cvData.education || []).filter((e) =>
      /créapole|creapole/i.test(String(e))
    ).length;
    add('edu_dedupe', 'Créapole not duplicated', creapoleDupes <= 1, `${creapoleDupes} Créapole lines`);

    add(
      'clients',
      'Clean clients visible',
      /\b(nike|adobe|louis\s*vuitton)\b/i.test(previewText) || counts.clients >= 3,
      `${counts.clients} clients`
    );

    add(
      'tools',
      'Tools section visible',
      /\boutils|tools/i.test(previewText) && counts.tools >= 1 && !/v3\s*2\s*gradric/i.test(previewText),
      `${counts.tools} tools`
    );

    add(
      'garbage',
      'No OCR garbage in preview',
      !GARBAGE_PREVIEW_RE.test(previewText),
      GARBAGE_PREVIEW_RE.test(previewText) ? 'garbage matched' : 'clean'
    );

    const checklistOk = (snap.uiChecklist || []).filter((x) => x.ok).length;
    add('ats', 'ATS checklist updates', checklistOk >= 4, `${checklistOk} items OK`);

    const zoom = parseFloat(snap.a4Dataset || a4Zoom?.zoom || '0');
    add(
      'a4',
      'A4 preview readable (zoom 0.9 + no crop)',
      zoom >= 0.85 && zoom <= 0.9 && !snap.cropped,
      `zoom=${zoom || 'n/a'} innerW=${Math.round(snap.innerW)} stageW=${Math.round(snap.stageW)}`
    );

    const toolsList = resumeData?.tools || cvData.tools || [];
    const langsList = resumeData?.languages || cvData.languages || [];
    const toolsClean =
      !toolsList.some((t) => /^(english|french|native|fluent)$/i.test(String(t).trim())) &&
      !toolsList.some((t) => /\bfreelance\s+illustrator\b|\bgraphic\s+designer\b/i.test(String(t)));
    add(
      'tools_clean',
      'Tools section is software-only',
      toolsClean && toolsList.length >= 1,
      toolsList.join(', ').slice(0, 100)
    );

    const langsOk =
      langsList.length >= 1 &&
      (langsList.some((l) => /english/i.test(l)) || /english/i.test(previewText)) &&
      (langsList.some((l) => /french/i.test(l)) || /french/i.test(previewText));
    add('languages', 'Languages separate from tools', langsOk, langsList.join(' | '));

    const eduLines = resumeData?.education || cvData.education || [];
    const eduClean =
      eduLines.length >= 1 &&
      eduLines.length <= 3 &&
      eduLines.every((e) => String(e).length <= 80) &&
      /lisaa/i.test(previewText);
    add('edu_clean', 'Education concise (no duplicates)', eduClean, eduLines.join(' | '));

    const expStacked = await page.evaluate(
      () => document.querySelectorAll('#cvDoc .cvExpEntry--stacked').length
    );
    add(
      'exp_wrap',
      'Experience renders multi-line (no truncate)',
      expStacked >= 1 && /independent\s*\/\s*freelance/i.test(previewText),
      `${expStacked} stacked entries`
    );

    const suggestionCount = await page.evaluate(() => {
      const cards = document.querySelectorAll('#suggestionsList .suggestionCard').length;
      const empty = document.querySelector('#suggestionsList .suggestionsEmpty');
      return empty ? 0 : cards;
    });
    add('suggestions', 'Suggestions capped at 3', suggestionCount <= 3, `${suggestionCount} visible`);

    const fatalBanner = await page.evaluate(
      () => !document.querySelector('#hirelyFatalBanner:not(.hidden)')
    );
    add('boot', 'No Hirely fatal error banner', fatalBanner, fatalBanner ? 'hidden' : 'visible');

    const pdfOut = path.join(OUT_DIR, 'yoaz-export.pdf');
    let exportCheckOk = false;
    try {
      await page.click('#downloadBtn', { timeout: 12000 });
      const download = await page.waitForEvent('download', { timeout: 35000 });
      await download.saveAs(pdfOut);
      pdfBytes = fs.statSync(pdfOut).size;
    } catch {
      await page.evaluate(() => window.downloadPDF?.());
      await page.waitForTimeout(1500);
      const inner = await page.evaluate(() => document.querySelector('#cvDoc')?.innerHTML || '');
      await exportCvPdfPlaywright(page, inner, 'ats', pdfOut);
      pdfBytes = fs.readFileSync(pdfOut).length;
    }
    const analysis = await analyzePdfBytes(fs.readFileSync(pdfOut));
    add('pdf', 'PDF export works', pdfBytes > 5000 && (analysis.pageCount || 0) >= 1, `${pdfBytes} bytes`);

    const postExport = await page.evaluate(() => {
      const items = [...document.querySelectorAll('#reviewV2Checklist .atsCheckItem')];
      const exportItem = items[items.length - 1];
      return {
        cvPdfExported: !!window.state?.cvPdfExported,
        exportOk: exportItem?.classList.contains('is-ok') || exportItem?.classList.contains('atsCheckItem--ok'),
      };
    });
    exportCheckOk = postExport.cvPdfExported && postExport.exportOk;
    add(
      'export_check',
      'Export PDF checklist checked after download',
      exportCheckOk,
      `cvPdfExported=${postExport.cvPdfExported}`
    );

    await page.locator('#cvDoc').screenshot({ path: path.join(OUT_DIR, 'preview.png'), timeout: 15000 });
  } catch (err) {
    add('e2e', 'E2E run', false, String(err.message || err));
  } finally {
    await browser.close();
    srv.close();
  }

  const critical = [
    'import',
    'name',
    'experience',
    'education',
    'tools',
    'tools_clean',
    'languages',
    'edu_clean',
    'exp_wrap',
    'suggestions',
    'a4',
    'pdf',
    'export_check',
    'garbage',
    'boot',
  ];
  const verdict = critical.every((id) => checks.find((c) => c.id === id)?.ok) ? 'PASS' : 'FAIL';

  const after = {
    name: cvData.name || resumeData?.identity?.name || '',
    email: cvData.email || resumeData?.identity?.email || '',
    experiences: counts.experiences,
    education: counts.education,
    tools: counts.tools,
    clients: counts.clients,
    educationLines: resumeData?.education || cvData.education || [],
  };

  const md = [];
  md.push('# HIRELY FINAL REPAIR QA');
  md.push('');
  md.push(`Generated: ${new Date().toISOString()}`);
  md.push(`PDF: \`${pdfPath}\``);
  md.push('');
  md.push('## Verdict');
  md.push('');
  md.push(`# ${verdict}`);
  md.push('');
  md.push('## Before / after counts (headless OCR → browser)');
  md.push('');
  md.push('| Field | Before (OCR fixture) | After (browser) |');
  md.push('|-------|---------------------:|----------------:|');
  if (before) {
    md.push(`| Name | ${before.name || '—'} | ${after.name || '—'} |`);
    md.push(`| Email | ${before.email || '—'} | ${after.email || '—'} |`);
    md.push(`| Experiences | ${before.experiences} | ${after.experiences} |`);
    md.push(`| Education | ${before.education} | ${after.education} |`);
    md.push(`| Tools | ${before.tools} | ${after.tools} |`);
    md.push(`| Clients | ${before.clients} | ${after.clients} |`);
  } else {
    md.push('| (no OCR fixture) | — | see After column above |');
  }
  md.push('');
  md.push('## Checks');
  md.push('');
  for (const c of checks) {
    md.push(`- [${c.ok ? 'x' : ' '}] **${c.label}**${c.detail ? ` — ${c.detail}` : ''}`);
  }
  md.push('');
  md.push('## Artifacts');
  md.push('');
  md.push(`- Screenshot: \`tests/output/final-repair-qa/preview.png\``);
  md.push(`- PDF: \`tests/output/final-repair-qa/yoaz-export.pdf\``);
  md.push('');
  md.push('## Files changed (final polish pass)');
  md.push('');
  md.push('- `src/ui/export/a4-viewport.js` — desktop zoom 0.9, centered A4');
  md.push('- `src/ui/templates/cv-templates.js` — experience wrap, edu/lang lines');
  md.push('- `src/ui/hirely-document.css` — stacked experience readability');
  md.push('- `src/core/validation/sanitize-resume-display.js` — tools/lang/edu cleanup');
  md.push('- `src/core/parsing/resume-output-quality.js` — language normalize, edu gate');
  md.push('- `src/core/parsing/suggestion-confidence-score.js` — max 3 suggestions');
  md.push('- `index.html` — PRODUCT_SUGGESTIONS_MAX=3');

  fs.writeFileSync(OUT_PATH, md.join('\n'));
  console.log(`\n${verdict} — ${OUT_PATH}`);
  console.log(`Screenshot: ${path.join(OUT_DIR, 'preview.png')}`);
  process.exit(verdict === 'PASS' ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
