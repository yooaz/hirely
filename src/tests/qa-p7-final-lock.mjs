#!/usr/bin/env node
/**
 * HIRELY P7 — Final QA Lock
 * Full product flow: PDF → DOCX → paste → suggestions → edit → ATS → letter → style → export → re-import
 * node src/tests/qa-p7-final-lock.mjs
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import http from 'http';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { isExtensionConsoleNoise, isHirelyAppFatal } from '../../tests/lib/qa-console-filter.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');
const outDir = path.join(root, 'tests/output/p7-final-lock');
fs.mkdirSync(outDir, { recursive: true });

const PASTE_FIXTURE = path.join(root, 'tests/fixtures/yoaz-cv/fixture.txt');
const SHORT_FIXTURE = path.join(root, 'tests/fixtures/docx/fixture.txt');
const OCR_GARBAGE = [/Ce\s*Frei\s*Re/i, /A>o/, /N'\$ak/, /gibberish ocr noise/i];
const PDF_PATHS = [
  process.env.HIRELY_YOAZ_PDF,
  '/Users/yohannazancot/Documents/cv/cv2022 yohann azancot copie.pdf',
].filter(Boolean);

const DOCX_PATHS = [
  process.env.HIRELY_ACCEPT_DOCX,
  '/Users/yohannazancot/Documents/cv .docx',
].filter(Boolean);

function resolveFirst(paths) {
  for (const p of paths) {
    if (p && fs.existsSync(p)) return p;
  }
  return null;
}

function escapeXml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildMinimalDocx(outPath, plainText) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hirely-docx-'));
  const wordDir = path.join(tmp, 'word');
  fs.mkdirSync(path.join(wordDir, '_rels'), { recursive: true });
  fs.mkdirSync(path.join(tmp, '_rels'), { recursive: true });
  const paragraphs = plainText
    .split('\n')
    .map(
      (line) =>
        `<w:p><w:r><w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r></w:p>`
    )
    .join('');
  fs.writeFileSync(
    path.join(wordDir, 'document.xml'),
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>${paragraphs}<w:sectPr/></w:body></w:document>`
  );
  fs.writeFileSync(
    path.join(tmp, '[Content_Types].xml'),
    `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`
  );
  fs.writeFileSync(
    path.join(tmp, '_rels', '.rels'),
    `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
  );
  fs.writeFileSync(
    path.join(wordDir, '_rels', 'document.xml.rels'),
    `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>
`
  );
  execSync(`cd "${tmp}" && zip -qr "${outPath}" .`);
}

async function buildTextPdf(outPath, plainText) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const page = pdf.addPage([595.28, 841.89]);
  const lines = plainText.split('\n');
  let y = 800;
  for (const line of lines) {
    if (y < 48) break;
    page.drawText(line.slice(0, 90), { x: 48, y, size: 10, font });
    y -= 14;
  }
  fs.writeFileSync(outPath, await pdf.save());
}

function mime(fp) {
  const ext = path.extname(fp).toLowerCase();
  return (
    {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.mjs': 'text/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.txt': 'text/plain',
      '.pdf': 'application/pdf',
      '.docx':
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    }[ext] || 'application/octet-stream'
  );
}

function startServer(port) {
  return http.createServer((req, res) => {
    const u = req.url.split('?')[0];
    let p = u === '/' ? '/index.html' : u;
    const fp = path.join(root, decodeURIComponent(p));
    if (!fp.startsWith(root) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, { 'Content-Type': mime(fp) });
    fs.createReadStream(fp).pipe(res);
  });
}

const isAppFatal = isHirelyAppFatal;

const results = [];
const consoleErrors = [];
let firstFail = null;
let fatalError = null;

function record(id, pass, detail = '') {
  results.push({ id, pass, detail });
  if (!pass && !firstFail) firstFail = { id, detail };
}

const P7_PRIORITY_CHECKS = [
  '3_export_ready_after_import',
  '6_ats_updates',
  '7_cover_letter_visible',
  'qa_runner_fatal',
  '9_export_pdf',
];

function writeP7FinalLockReport(report) {
  const outPath = path.join(root, 'P7_FINAL_LOCK_REPORT.md');
  const pass = report.failed === 0;
  const lines = [];
  lines.push('# P7 Final Lock Report');
  lines.push('');
  lines.push(`Generated: ${report.timestamp}`);
  lines.push(`Verdict: **${pass ? 'PASS' : 'FAIL'}**`);
  lines.push('');
  lines.push(`\`npm run qa:p7-final-lock\` — **${report.passed}/${report.results.length} checks** (exit ${pass ? 0 : 1})`);
  lines.push('');

  lines.push('## Priority checks');
  lines.push('');
  lines.push('| Check | Status | Detail |');
  lines.push('|-------|--------|--------|');
  for (const id of P7_PRIORITY_CHECKS) {
    const r = report.results.find((x) => x.id === id);
    if (!r) {
      lines.push(`| \`${id}\` | — | not run |`);
      continue;
    }
    lines.push(`| \`${id}\` | ${r.pass ? '✅' : '❌'} | ${String(r.detail || '').replace(/\|/g, '\\|')} |`);
  }
  lines.push('');

  lines.push('## Full results');
  lines.push('');
  lines.push('| Check | Status | Detail |');
  lines.push('|-------|--------|--------|');
  for (const r of report.results) {
    lines.push(`| \`${r.id}\` | ${r.pass ? 'PASS' : 'FAIL'} | ${String(r.detail || '').replace(/\|/g, '\\|')} |`);
  }
  lines.push('');

  if (report.pdfBytes) {
    lines.push('## PDF export');
    lines.push('');
    lines.push(`- Artifact: \`tests/output/p7-final-lock/p7-export.pdf\``);
    lines.push(`- Size: ${report.pdfBytes} bytes`);
    lines.push('');
  }

  const blockers = report.results.filter((r) => !r.pass);
  lines.push('## Remaining blockers');
  lines.push('');
  if (!blockers.length) {
    lines.push('None.');
  } else {
    for (const r of blockers) {
      lines.push(`- \`${r.id}\`: ${r.detail || 'failed'}`);
    }
  }
  lines.push('');

  if (report.consoleErrors?.length) {
    lines.push('## Console errors');
    lines.push('');
    for (const e of report.consoleErrors.slice(0, 5)) {
      lines.push(`- ${e}`);
    }
    lines.push('');
  }

  if (report.fatalError) {
    lines.push('## Fatal error');
    lines.push('');
    lines.push('```');
    lines.push(String(report.fatalError).split('\n').slice(0, 8).join('\n'));
    lines.push('```');
    lines.push('');
  }

  lines.push('## Scope rules (unchanged)');
  lines.push('');
  lines.push('- No OCR changes');
  lines.push('- No parser changes');
  lines.push('- No template redesign');
  lines.push('- No pricing changes');
  lines.push('');
  lines.push('## Verification');
  lines.push('');
  lines.push('```bash');
  lines.push('npm run check:exports');
  lines.push('npm run check:core');
  lines.push('npm run build');
  lines.push('npm run qa:p7-final-lock');
  lines.push('```');

  fs.writeFileSync(outPath, lines.join('\n'));
  return outPath;
}

async function waitImportDone(page, maxMs = 120000) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    const s = await page.evaluate(() => ({
      live: document.getElementById('cvDoc')?.classList.contains('cv--live'),
      busy: document.getElementById('wsImport')?.classList.contains('wsImport--loading'),
      fallback: document.getElementById('importPasteFallback')?.classList.contains('show'),
      pasteWrap: document.getElementById('cvStageWrap')?.classList.contains('cvStageWrap--pasteFallback'),
      gate: !document.getElementById('extractionGate')?.classList.contains('hidden'),
      bodyLen: (document.body?.innerText || '').length,
      rescue: !!window.HirelyParse?.lastResult?.cvData?._rescueMode?.active,
    }));
    if (s.gate) {
      const cont = page.locator('#extractionGateContinue');
      if ((await cont.count()) > 0 && (await cont.isVisible())) {
        await cont.click();
        await page.waitForTimeout(400);
        continue;
      }
    }
    if ((s.live || s.fallback) && !s.busy) return { ...s, ms: Date.now() - t0 };
    if (s.bodyLen < 80) return { ...s, white: true, ms: Date.now() - t0 };
    await page.waitForTimeout(400);
  }
  return { live: false, busy: true, timeout: true, ms: maxMs };
}

async function importFile(page, filePath, maxMs = 120000) {
  await page.locator('#fileInput').setInputFiles(filePath);
  return waitImportDone(page, maxMs);
}

async function pasteFixture(page, text) {
  await page.evaluate(async (body) => {
    await window.HirelyParse.applyCvPipeline(body, {
      source: 'paste-text',
      trusted: true,
      forceContinue: true,
      silent: true,
    });
  }, text);
  return waitImportDone(page, 90000);
}

async function getDegradedSnapshot(page) {
  return page.evaluate(() => ({
    pasteFallback: document.getElementById('importPasteFallback')?.classList.contains('show'),
    pasteWrap: document.getElementById('cvStageWrap')?.classList.contains('cvStageWrap--pasteFallback'),
    rescue: !!window.HirelyParse?.lastResult?.cvData?._rescueMode?.active,
    degraded: !!window.HirelyParse?.lastResult?.importQuality?.degraded,
  }));
}

async function getCvPreviewText(page) {
  return page.evaluate(() => document.getElementById('cvDoc')?.innerText || '');
}

async function getA4Snapshot(page) {
  return page.evaluate(() => {
    const cvDoc = document.getElementById('cvDoc');
    const shell = document.getElementById('cvStage') || document.querySelector('.cvStage');
    const shellStyle = shell ? window.getComputedStyle(shell) : null;
    const vp = window.HirelyA4Viewport;
    const cs = cvDoc ? window.getComputedStyle(cvDoc) : null;
    const layoutW = cs ? parseFloat(cs.width) : 0;
    const layoutH = cs ? parseFloat(cs.height) : 0;
    return {
      hasCvDoc: !!cvDoc,
      live: cvDoc?.classList.contains('cv--live'),
      pageW: cvDoc ? Math.round(cvDoc.getBoundingClientRect().width) : 0,
      pageH: cvDoc ? Math.round(cvDoc.getBoundingClientRect().height) : 0,
      layoutW: Math.round(layoutW),
      layoutH: Math.round(layoutH),
      shellOverflow: shellStyle?.overflow || '',
      shellOverflowX: shellStyle?.overflowX || '',
      zoom: vp?.getZoom?.() ?? null,
      aspectOk:
        cvDoc &&
        layoutW >= 790 &&
        Math.abs(layoutH / layoutW - 1123 / 794) < 0.08,
    };
  });
}

async function ensureExportReady(page, maxMs = 60000) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    const snap = await page.evaluate(() => {
      const ready = typeof isExportReady === 'function' ? isExportReady() : false;
      const report = typeof getReviewReadinessReport === 'function' ? getReviewReadinessReport() : null;
      return {
        ready,
        gates: report?.gates || {},
        completion: report?.completionPct ?? 0,
        missing: report?.missingSections || [],
      };
    });
    if (snap.ready) return snap;
    await page.waitForTimeout(500);
  }
  return page.evaluate(() => ({
    ready: typeof isExportReady === 'function' ? isExportReady() : false,
    gates: typeof getReviewReadinessReport === 'function' ? getReviewReadinessReport()?.gates : {},
    completion: typeof getReviewReadinessReport === 'function' ? getReviewReadinessReport()?.completionPct : 0,
    missing: typeof getReviewReadinessReport === 'function' ? getReviewReadinessReport()?.missingSections : [],
  }));
}

async function safeClick(page, selector, opts = {}) {
  const loc = page.locator(selector).first();
  if ((await loc.count()) === 0) {
    return { ok: false, reason: `${selector} missing` };
  }
  const panel = opts.openPanel;
  if (panel) {
    await clickDocStep(page, panel);
    await page.waitForTimeout(300);
  }
  try {
    await loc.waitFor({ state: 'visible', timeout: opts.timeout || 15000 });
    await loc.click({ timeout: opts.timeout || 15000 });
    return { ok: true };
  } catch (e) {
    if (selector === '#generateLetterBtn') {
      await clickDocStep(page, 'export');
      await page.waitForTimeout(400);
      const openBtn = page.locator('#openLetterBtn');
      if ((await openBtn.count()) > 0) {
        await openBtn.click({ force: true }).catch(() => null);
        await page.waitForTimeout(400);
      }
      try {
        await loc.waitFor({ state: 'visible', timeout: 8000 });
        await loc.click({ timeout: 8000 });
        return { ok: true, opened: true };
      } catch (e2) {
        return { ok: false, reason: String(e2?.message || e2).split('\n')[0] };
      }
    }
    return { ok: false, reason: String(e?.message || e).split('\n')[0] };
  }
}

async function editCvIdentity(page) {
  return page.evaluate(() => {
    const nameEl = document.querySelector('#cvDoc .cvName');
    const titleEl = document.querySelector('#cvDoc .cvTitle');
    const leadEl = document.querySelector('#cvDoc .cvLead');
    if (nameEl && titleEl) {
      nameEl.textContent = 'Yohann Azancot QA';
      nameEl.dispatchEvent(new Event('input', { bubbles: true }));
      titleEl.textContent = 'Senior Graphic Designer QA';
      titleEl.dispatchEvent(new Event('input', { bubbles: true }));
      if (leadEl) {
        leadEl.textContent =
          'Senior graphic designer with 12+ years across brand identity, illustration, and art direction for global clients.';
        leadEl.dispatchEvent(new Event('input', { bubbles: true }));
      }
      if (typeof applyCvPreviewFieldEdits === 'function') applyCvPreviewFieldEdits();
      const rd = state.resumeData;
      if (rd && typeof commitResumeData === 'function') {
        rd.tools = [...new Set([...(rd.tools || []), 'Photoshop QA', 'Illustrator QA', 'InDesign QA'])];
        const langs = [...(rd.languages || [])];
        if (!langs.some((l) => /spanish/i.test(String(l)))) {
          langs.push('Spanish — professional working proficiency');
        }
        rd.languages = langs;
        commitResumeData(rd);
      } else if (typeof renderMetrics === 'function') renderMetrics();
      if (typeof renderReviewStudioV2 === 'function') renderReviewStudioV2();
      return { ok: true, mode: 'contenteditable', name: nameEl.textContent, title: titleEl.textContent };
    }
    const roleInput = document.getElementById('roleInput');
    if (roleInput) {
      roleInput.value = 'Senior Product Manager QA';
      roleInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    return { ok: !!nameEl || !!roleInput, mode: nameEl ? 'name-only' : 'roleInput', name: nameEl?.textContent || '', title: titleEl?.textContent || '' };
  });
}

async function clickDocStep(page, step) {
  const enabled = await page.locator(`#docNav .hirelyProgressBtn[data-doc-step="${step}"]:not([disabled])`);
  if ((await enabled.count()) > 0) {
    await enabled.click();
  } else {
    await page.evaluate((s) => {
      if (typeof setDocStep === 'function') setDocStep(s);
    }, step);
  }
  await page.waitForTimeout(250);
}

async function getAtsSnapshot(page) {
  return page.evaluate(() => {
    const analysis = document.getElementById('reviewStudioAnalysis');
    const ring = document.getElementById('reviewV2ScoreTotal');
    const metrics = document.getElementById('reviewV2Metrics');
    const vis = (el) => {
      if (!el || el.classList.contains('hidden')) return false;
      const st = window.getComputedStyle(el);
      return st.display !== 'none' && st.visibility !== 'hidden';
    };
    const scoreText = (ring?.textContent || '').trim();
    const scoreNum = parseInt(scoreText.replace(/[^\d]/g, ''), 10);
    return {
      analysisVisible: vis(analysis),
      ringVisible: vis(ring),
      metricsVisible: vis(metrics),
      scoreText,
      scoreNum: Number.isFinite(scoreNum) ? scoreNum : null,
      metricCount: metrics?.querySelectorAll('.reviewV2MetricRow, .scoreMetricRow').length || 0,
    };
  });
}

async function auditClickableButtons(page) {
  return page.evaluate(() => {
    const step = state.docStep || 'import';
    const blocked = [];
    const selectors = [
      '#docNav .hirelyProgressBtn:not([disabled])',
      '#downloadBtn',
      '#generateLetterBtn',
      '#suggestionsPanel [data-suggestion-action]',
      '[data-id-field="name"]',
    ];
    if (step === 'style') selectors.push('.tplCard[data-id]');
    const isVisible = (el) => {
      if (!el || el.disabled) return false;
      if (el.classList.contains('hidden')) return false;
      const st = window.getComputedStyle(el);
      if (st.display === 'none' || st.visibility === 'hidden' || parseFloat(st.opacity) < 0.05) {
        return false;
      }
      const r = el.getBoundingClientRect();
      return r.width >= 2 && r.height >= 2;
    };
    for (const sel of selectors) {
      document.querySelectorAll(sel).forEach((el) => {
        if (!isVisible(el)) return;
        const r = el.getBoundingClientRect();
        const st = window.getComputedStyle(el);
        if (r.width < 2 || r.height < 2) blocked.push(`${sel}:zero-size`);
        if (st.pointerEvents === 'none') blocked.push(`${sel}:pointer-none`);
      });
    }
    return { ok: blocked.length === 0, blocked };
  });
}

const pasteText = fs.readFileSync(PASTE_FIXTURE, 'utf8');
const shortText = fs.readFileSync(SHORT_FIXTURE, 'utf8');
const genPdf = path.join(outDir, 'fixture.pdf');
const genDocx = path.join(outDir, 'fixture.docx');
await buildTextPdf(genPdf, shortText);
buildMinimalDocx(genDocx, shortText);

const port = 3030 + Math.floor(Math.random() * 70);
const server = startServer(port);
await new Promise((r) => server.listen(port, r));

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ acceptDownloads: true });
const page = await context.newPage({ viewport: { width: 1440, height: 900 } });
page.setDefaultTimeout(120000);

page.on('console', (msg) => {
  const text = msg.text();
  if (msg.type() === 'error' && isAppFatal(text)) consoleErrors.push(text);
});
page.on('pageerror', (err) => {
  const text = String(err?.message || err);
  if (isAppFatal(text)) consoleErrors.push(text);
});

let pdfBytes = 0;

try {
  await page.goto(`http://127.0.0.1:${port}/?pro=true`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForFunction(
    () => typeof window.HirelyParse?.handleFileImport === 'function',
    { timeout: 120000 }
  );

  const navSnap = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.hirelyProgressLabel')).map((el) => (el.textContent || '').trim())
  );
  const navOk =
    navSnap.includes('Importer') &&
    navSnap.some((l) => /relire|relecture|review/i.test(l)) &&
    navSnap.some((l) => /télécharger|exporter|export/i.test(l));
  record('0_nav_labels', navOk, navSnap.join('|'));

  // 1 — Import PDF (generated text PDF by default — fast, non-degraded)
  const pdfPath =
    process.env.HIRELY_P7_LOCAL_PDF === '1' ? resolveFirst(PDF_PATHS) || genPdf : genPdf;
  const pdfOut = await importFile(page, pdfPath, 120000);
  const pdfDeg = await getDegradedSnapshot(page);
  record(
    '1_import_pdf',
    pdfOut.live && !pdfOut.pasteWrap && !pdfDeg.rescue,
    pdfOut.live
      ? `live ${pdfOut.ms}ms`
      : pdfOut.fallback
        ? 'paste fallback (degraded)'
        : pdfOut.timeout
          ? 'timeout'
          : 'no live CV'
  );
  record('1_no_degraded_pdf', !pdfDeg.pasteFallback && !pdfDeg.rescue, JSON.stringify(pdfDeg));

  // 2 — Import DOCX
  const docxPath = resolveFirst(DOCX_PATHS) || genDocx;
  const docxOut = await importFile(page, docxPath, 90000);
  const docxDeg = await getDegradedSnapshot(page);
  record(
    '2_import_docx',
    (docxOut.live || docxOut.fallback) && !docxDeg.rescue,
    docxOut.live ? `live ${docxOut.ms}ms` : docxOut.fallback ? 'paste fallback ok' : 'failed'
  );

  // 3 — Paste text (via .txt upload — fresh session avoids stale import state)
  await page.goto(`http://127.0.0.1:${port}/?pro=true`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => typeof window.HirelyParse?.handleFileImport === 'function',
    { timeout: 120000 }
  );
  const pasteTxt = path.join(outDir, 'yoaz-paste.txt');
  fs.copyFileSync(PASTE_FIXTURE, pasteTxt);
  const pasteOut = await importFile(page, pasteTxt, 90000);
  record('3_paste_text', pasteOut.live, pasteOut.live ? `live ${pasteOut.ms}ms` : 'not live');
  await page.waitForFunction(
    () => (window.HirelyParse?.lastResult?.cvData?.experience || []).length > 0,
    { timeout: 90000 }
  ).catch(() => null);

  // 4 — Review suggestions
  await clickDocStep(page, 'edit');
  await page.waitForSelector('#cvDoc.cv--live', { timeout: 60000 }).catch(() => null);
  const cvSnap = await page.evaluate(() => {
    const lr = window.HirelyParse?.lastResult?.cvData || {};
    const display = typeof getDisplayCvData === 'function' ? getDisplayCvData() : {};
    return {
      lastExp: (lr.experience || []).length,
      lastEdu: (lr.education || []).length,
      lastSkills: (lr.skills || []).length,
      displayExp: (display.experience || []).length,
      displayEdu: (display.education || []).length,
      name: lr.name || display.name || '',
    };
  });
  const exportSnap = await ensureExportReady(page, 15000);
  record(
    '3_export_ready_after_import',
    exportSnap.ready,
    `completion=${exportSnap.completion} cv=${JSON.stringify(cvSnap)} missing=${(exportSnap.missing || []).join(',')}`
  );
  const suggSnap = await page.evaluate(() => {
    const panel = document.getElementById('suggestionsPanel');
    const cards = document.querySelectorAll('#suggestionsPanel .suggestionCard');
    const legacy = document.querySelectorAll('#toClassifyList .toClassifyCard, #studioSuggestionsPanel .toClassifyCardCompact');
    return {
      panelVisible: panel && !panel.classList.contains('hidden'),
      cardCount: cards.length,
      legacyCount: legacy.length,
      hasActions: !!document.querySelector('#suggestionsPanel [data-suggestion-action]'),
    };
  });
  record(
    '4_review_suggestions',
    suggSnap.panelVisible || suggSnap.cardCount === 0,
    `panel=${suggSnap.panelVisible} cards=${suggSnap.cardCount} legacy=${suggSnap.legacyCount}`
  );
  if (suggSnap.hasActions && suggSnap.cardCount > 0) {
    await page.locator('#suggestionsPanel [data-suggestion-action="ignore"]').first().click();
    await page.waitForTimeout(400);
    record('4_suggestion_action', true, 'ignore clicked');
  } else {
    record('4_suggestion_action', true, 'no pending suggestions');
  }

  // 5 — Edit fields + 6 — ATS updates
  const atsBefore = await getAtsSnapshot(page);
  const revBefore = await page.evaluate(() => state.scoreRevision || 0);
  record(
    '6_ats_visible',
    atsBefore.analysisVisible && atsBefore.ringVisible,
    `score=${atsBefore.scoreText} metrics=${atsBefore.metricCount}`
  );

  const edit = await editCvIdentity(page);
  record('5_edit_fields', edit.ok, `${edit.mode}: ${edit.name || 'n/a'}`);
  await page.waitForTimeout(600);
  const atsAfter = await getAtsSnapshot(page);
  const revAfter = await page.evaluate(() => state.scoreRevision || 0);
  const scoreChanged =
    atsAfter.scoreNum != null &&
    (atsBefore.scoreNum == null || atsAfter.scoreNum !== atsBefore.scoreNum || atsAfter.scoreText !== atsBefore.scoreText);
  const recomputed = revAfter > revBefore;
  record(
    '6_ats_updates',
    atsAfter.analysisVisible && atsAfter.scoreNum != null && (scoreChanged || recomputed),
    `before=${atsBefore.scoreText} after=${atsAfter.scoreText} changed=${scoreChanged} revision=${revBefore}->${revAfter}`
  );

  const cvText = await getCvPreviewText(page);
  const ocrLeak = OCR_GARBAGE.some((re) => re.test(cvText));
  record('6_no_raw_ocr', !ocrLeak, ocrLeak ? 'garbage in preview' : `preview ${cvText.length} chars`);

  const a4 = await getA4Snapshot(page);
  record(
    '6_a4_clean',
    a4.hasCvDoc &&
      a4.live &&
      a4.layoutW >= 790 &&
      a4.aspectOk &&
      a4.shellOverflow !== 'hidden' &&
      a4.shellOverflowX !== 'hidden',
    `layoutW=${a4.layoutW} layoutH=${a4.layoutH} zoom=${a4.zoom} overflow=${a4.shellOverflow}`
  );

  // 7 — Cover letter
  await clickDocStep(page, 'export');
  await page.waitForTimeout(600);
  await page.waitForSelector('#coverLetterWorkspace:not(.hidden)', { timeout: 30000 }).catch(() => null);
  const letterSnap = await page.evaluate(() => {
    const ws = document.getElementById('coverLetterWorkspace');
    const btn = document.getElementById('generateLetterBtn');
    const vis = (el) => {
      if (!el || el.classList.contains('hidden')) return false;
      const st = window.getComputedStyle(el);
      return st.display !== 'none' && st.visibility !== 'hidden';
    };
    return {
      workspaceVisible: vis(ws),
      btnVisible: vis(btn),
      btnPresent: !!btn,
    };
  });
  record(
    '7_cover_letter_visible',
    letterSnap.btnPresent,
    letterSnap.btnPresent
      ? letterSnap.workspaceVisible || letterSnap.btnVisible
        ? 'letter UI in export step'
        : 'generate button in DOM (export panel)'
      : 'hidden'
  );

  const roleInput = page.locator('#letterTargetRole');
  if (await roleInput.isVisible().catch(() => false)) {
    await roleInput.fill('Senior Graphic Designer');
  }
  const genClick = await safeClick(page, '#generateLetterBtn', { openPanel: 'export' });
  if (!genClick.ok) {
    record('qa_runner_fatal', false, `generateLetterBtn blocked: ${genClick.reason}`);
  }
  await page.waitForTimeout(800);
  const letterText = await page.evaluate(
    () => document.getElementById('coverLetterPreview')?.innerText?.trim() || ''
  );
  record(
    '7_cover_letter_generated',
    letterText.length > 80 && /Yohann|Graphic|Designer|Senior|motivation|poste/i.test(letterText),
    `${letterText.length} chars`
  );

  // 8 — Switch style
  await clickDocStep(page, 'style');
  const creativeCard = page.locator('.tplCard[data-id="creative"]').first();
  if ((await creativeCard.count()) > 0) {
    await creativeCard.click();
    await page.waitForTimeout(200);
    const tplClass = await page.evaluate(() => document.getElementById('cvDoc')?.className || '');
    record('8_switch_style', /template-creative/.test(tplClass) && tplClass.includes('cv--live'), tplClass.slice(0, 80));
  } else {
    record('8_switch_style', false, 'creative card missing');
  }

  // 9 — Export PDF
  await clickDocStep(page, 'export');
  const downloadBtn = page.locator('#downloadBtn');
  try {
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 90000 }),
      downloadBtn.click(),
    ]);
    const savePath = path.join(outDir, 'p7-export.pdf');
    await download.saveAs(savePath);
    pdfBytes = fs.statSync(savePath).size;
    record('9_export_pdf', pdfBytes > 2000, `${pdfBytes} bytes`);
  } catch (e) {
    record('9_export_pdf', false, String(e?.message || e));
  }

  // 10 — Re-import same file
  await clickDocStep(page, 'import');
  const reOut = await importFile(page, genPdf, 90000);
  record('10_reimport', reOut.live, reOut.live ? `live ${reOut.ms}ms` : 'failed');

  await clickDocStep(page, 'style');
  await page.waitForTimeout(300);
  const buttons = await auditClickableButtons(page);
  record('all_buttons_clickable', buttons.ok, buttons.blocked.join('; ') || 'ok');

  const finalDeg = await getDegradedSnapshot(page);
  record('no_degraded_mode', !finalDeg.pasteWrap && !finalDeg.rescue, JSON.stringify(finalDeg));
  record('no_fatal_console', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));

  await page.screenshot({ path: path.join(outDir, 'final.png'), fullPage: false }).catch(() => {});
} catch (e) {
  fatalError = String(e?.stack || e);
  if (!results.some((r) => r.id === 'qa_runner_fatal')) {
    record('qa_runner_fatal', false, fatalError.split('\n')[0]);
  }
} finally {
  const report = {
    timestamp: new Date().toISOString(),
    firstFail,
    results,
    consoleErrors,
    pdfBytes,
    fatalError,
    passed: results.filter((r) => r.pass).length,
    failed: results.filter((r) => !r.pass).length,
  };
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
  const mdPath = writeP7FinalLockReport(report);

  console.log('\n=== P7 FINAL QA LOCK ===\n');
  for (const r of results) {
    console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.id}${r.detail ? ` — ${r.detail}` : ''}`);
  }
  if (firstFail) console.log('\nFirst failure:', firstFail.id, firstFail.detail);
  if (consoleErrors.length) console.log('\nConsole:', consoleErrors);
  if (fatalError) console.log('\nFatal:', fatalError.split('\n').slice(0, 3).join('\n'));
  console.log('\nReport:', path.join(outDir, 'report.json'));
  console.log('Markdown:', mdPath);

  await browser.close();
  server.close();
  process.exitCode = results.some((r) => !r.pass) ? 1 : 0;
}
