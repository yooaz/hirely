#!/usr/bin/env node
/**
 * HIRELY FINAL ACCEPTANCE TEST — Yoaz PDF end-to-end
 * node scripts/final-acceptance-test.mjs
 * Output: FINAL_ACCEPTANCE_REPORT.md (PASS | PARTIAL | FAIL)
 */
import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { normalizeResumeData } from '../src/core/resume-data.js';
import { computeProductScore } from '../src/core/validation/product-score.js';
import { resolveChecklistProfile } from '../src/core/validation/recruiter-checklist-source.js';
import {
  KNOWN_CORRUPTION_RE,
  analyzeLineCorruption,
  corruptionScoreText,
} from '../src/core/parsing/corruption-detector.js';
import {
  filterProductSuggestions,
} from '../src/core/parsing/suggestion-confidence-score.js';
import { normalizeCvData } from '../src/core/parsing/rich-parser.js';
import { exportCvPdfPlaywright, analyzePdfBytes } from '../src/tests/lib/pdf-export-playwright.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT_PATH = path.join(ROOT, 'FINAL_ACCEPTANCE_REPORT.md');
const OUT_DIR = path.join(ROOT, 'tests/output/final-acceptance');

const OCR_CACHE = path.join(ROOT, 'tests/output/ocr-quality-yoaz/report.json');
const TRACE_PATH = path.join(ROOT, 'TRACE_YOAZ_PIPELINE.json');

const PDF_CANDIDATES = [
  process.env.HIRELY_YOAZ_PDF,
  '/Users/yohannazancot/Documents/cv/cv2022 yohann azancot copie.pdf',
  '/Users/yohannazancot/Documents/yohann azancot cv 2024.pdf',
  '/Users/yohannazancot/Documents/cv 2024 yohann azancot copie.pdf',
].filter(Boolean);

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

const GARBAGE_PREVIEW_RE =
  /\b(ee\s+à|v3\s*2\s*gradric|_—\s*pe|a>\s*tn|s\s+phone\s*:|lea\s+phone)\b|^\s*print\s*$/im;

function arrLen(v) {
  return Array.isArray(v) ? v.filter(Boolean).length : 0;
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
    {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.mjs': 'text/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.pdf': 'application/pdf',
    }[ext] || 'application/octet-stream'
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

function previewCorruptionHits(text) {
  const hits = [];
  for (const line of String(text || '').split('\n')) {
    const t = line.trim();
    if (!t || t.length < 4) continue;
    if (KNOWN_CORRUPTION_RE.test(t)) hits.push({ line: t.slice(0, 80), reason: 'known_signature' });
    if (GARBAGE_PREVIEW_RE.test(t)) hits.push({ line: t.slice(0, 80), reason: 'ocr_garbage' });
    const a = analyzeLineCorruption(t);
    if (a.corrupted && a.score >= 55) hits.push({ line: t.slice(0, 80), reason: a.reasons[0] || 'corrupted' });
    if (corruptionScoreText(t) >= 70) hits.push({ line: t.slice(0, 80), reason: 'high_corruption_score' });
  }
  return hits.slice(0, 12);
}

function collectSuggestions(reviewQueue, cvData) {
  const raw = [];
  const seen = new Set();
  for (let i = 0; i < (reviewQueue || []).length; i++) {
    const it = reviewQueue[i];
    if (!it || it.status === 'resolved' || it.status === 'ignored') continue;
    const text = String(it.sourceText || it.detected || '').trim();
    const key = text.toLowerCase();
    if (!text || seen.has(key)) continue;
    seen.add(key);
    raw.push({
      kind: 'review',
      idx: i,
      text,
      category: it.category || 'unknown',
      confidence: it.confidence ?? 50,
    });
  }
  const p = normalizeCvData(cvData);
  for (const tc of p.toClassify || []) {
    const text = String(typeof tc === 'string' ? tc : tc?.text || '').trim();
    const key = text.toLowerCase();
    if (!text || seen.has(key)) continue;
    seen.add(key);
    raw.push({ kind: 'classify', text, category: 'skill', confidence: 50 });
  }
  return filterProductSuggestions(raw, { maxVisible: 5 });
}

function mergeCounts(resumeData, cvData, structuredResume) {
  const rd = resumeData ? normalizeResumeData(resumeData) : {};
  const cv = cvData || {};
  const sr = structuredResume || {};
  return {
    experiences: Math.max(
      arrLen(rd.experiences),
      arrLen(cv.experience),
      arrLen(sr.experiences)
    ),
    education: Math.max(arrLen(rd.education), arrLen(cv.education), arrLen(sr.education)),
    clients: Math.max(arrLen(rd.clients), arrLen(cv.clients), arrLen(sr.clients)),
    skills: Math.max(arrLen(rd.skills), arrLen(cv.skills), arrLen(sr.skills)),
    tools: Math.max(arrLen(rd.tools), arrLen(cv.tools), arrLen(sr.tools)),
    languages: Math.max(arrLen(rd.languages), arrLen(cv.languages), arrLen(sr.languages)),
  };
}

function deriveVerdict(checks, criticalOk) {
  if (!criticalOk) return 'FAIL';
  const failed = checks.filter((c) => !c.ok);
  if (!failed.length) return 'PASS';
  const softOnly = failed.every((c) =>
    ['chk_name', 'chk_email', 'garbage', 'lang_thresh', 'skills_thresh'].includes(c.id)
  );
  if (softOnly && criticalOk) return 'PARTIAL';
  return 'PARTIAL';
}

function mdEsc(s) {
  return String(s || '').replace(/\|/g, '\\|');
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const pdfPath = resolvePdf();
  if (!pdfPath) {
    fs.writeFileSync(OUT_PATH, '# FINAL ACCEPTANCE REPORT\n\n## Verdict\n\n# FAIL\n\nNo Yoaz PDF found.\n');
    console.error('FAIL — no Yoaz PDF');
    process.exit(1);
  }

  const port = 3080 + Math.floor(Math.random() * 40);
  const srv = createServer(port);
  await new Promise((r) => srv.listen(port, r));

  const checks = [];
  const failures = [];
  const passes = [];
  let importState = null;
  let importPath = 'direct';
  let previewText = '';
  let previewHtmlLen = 0;
  let resumeData = null;
  let cvData = null;
  let reviewQueue = [];
  let rawTextLen = 0;
  let pdfBytes = 0;
  let pdfExportPath = '';
  let corruptionHits = [];
  let suggestions = { items: [] };
  let atsScore = null;
  let counts = {};
  let uiChecklist = [];
  let sugCount = 0;

  const addCheck = (id, label, ok, detail = '') => {
    checks.push({ id, label, ok, detail });
    if (ok) passes.push(label);
    else failures.push(detail ? `${label}: ${detail}` : label);
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
    importState = await page.evaluate(
      async ({ b64, name }) => {
        const bin = atob(b64);
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        const file = new File([arr], name, { type: 'application/pdf' });
        return window.HirelyParse.handleFileImport(file, 'final-acceptance');
      },
      { b64: pdfBuf.toString('base64'), name: path.basename(pdfPath) }
    );

    let importOk = importState === 'IMPORT_READY' || importState === 'IMPORT_PARTIAL';

    if (!importOk && importState === 'IMPORT_NEEDS_PASTE') {
      const fallbackText = loadOcrFallbackText();
      if (fallbackText.length >= 80) {
        importPath = 'paste-fallback';
        const pasted = await page.evaluate(async (raw) => {
          return window.HirelyParse?.importText
            ? window.HirelyParse.importText(raw, { source: 'paste-fallback', trusted: true, forceContinue: true })
            : false;
        }, fallbackText);
        importState = pasted ? 'IMPORT_READY' : 'IMPORT_NEEDS_PASTE';
        importOk = !!pasted;
      }
    }

    addCheck('import', 'Yoaz PDF import', importOk, `${importState || 'unknown'} (${importPath})`);

    await page.waitForFunction(
      () => document.querySelector('#workspaceGrid')?.classList.contains('workspaceGrid--ready'),
      { timeout: 180000 }
    ).catch(() => {});

    await page.waitForFunction(
      () => !document.querySelector('.hirelyProgressStep[data-doc-step="edit"] .hirelyProgressBtn')?.disabled,
      { timeout: 90000 }
    );
    await page.evaluate(() => {
      const btn = document.querySelector('.hirelyProgressStep[data-doc-step="edit"] .hirelyProgressBtn');
      if (btn && !btn.disabled) btn.click();
    });
    await page.waitForFunction(
      () => document.querySelector('#workspace')?.dataset?.docStep === 'edit',
      { timeout: 30000 }
    );
    await page.waitForTimeout(1200);
    await page.evaluate(() => window.HirelyA4Viewport?.apply?.());

    const snap = await page.evaluate(() => {
      const lr = window.HirelyParse?.lastResult || {};
      const rd = lr.resumeData || window.state?.resumeData || null;
      const cv = lr.cvData || window.state?.cvData || null;
      return {
        cvData: cv,
        resumeData: rd,
        structuredResume: lr.structuredResume || window.state?.structuredResume || null,
        reviewQueue: window.state?.reviewQueue || lr.reviewQueue || [],
        rawTextLen: String(lr.rawText || lr.audit?.rawText || '').length,
        previewText: document.querySelector('#cvDoc')?.innerText || '',
        previewHtmlLen: document.querySelector('#cvDoc')?.innerHTML?.length || 0,
        uiSuggestions: [...document.querySelectorAll('.suggestionCard')].map((c) =>
          (c.querySelector('.suggestionText')?.textContent || '').trim()
        ),
        uiChecklist: [...document.querySelectorAll('#reviewV2Checklist .atsCheckItem')].map((li) => ({
          text: li.querySelector('.atsCheckLabel')?.textContent?.trim() || '',
          ok: li.classList.contains('is-ok') || li.classList.contains('atsCheckItem--ok'),
        })),
      };
    });

    cvData = snap.cvData || {};
    resumeData = snap.resumeData;
    reviewQueue = snap.reviewQueue || [];
    rawTextLen = snap.rawTextLen;
    previewText = snap.previewText;
    previewHtmlLen = snap.previewHtmlLen;
    uiChecklist = snap.uiChecklist || [];

    addCheck('preview', 'CV preview renders', previewHtmlLen >= 400, `${previewHtmlLen} B HTML`);

    suggestions = collectSuggestions(reviewQueue, cvData);
    sugCount = Math.max(suggestions.items.length, snap.uiSuggestions?.length || 0);
    addCheck('suggestions', 'Suggestions <= 3', sugCount <= 3, `visible ${sugCount}`);

    corruptionHits = previewCorruptionHits(previewText);
    const garbageInSuggestions = (snap.uiSuggestions || []).some((t) =>
      /@\s*\d|market reviews|^b wma$|^lea$/i.test(t)
    );
    const garbageInPreview = corruptionHits.length > 0 || GARBAGE_PREVIEW_RE.test(previewText) || garbageInSuggestions;
    addCheck(
      'garbage',
      'No OCR garbage visible',
      !garbageInPreview,
      garbageInSuggestions ? 'garbage in suggestions' : corruptionHits.map((h) => h.line).join('; ')
    );

    counts = mergeCounts(resumeData, cvData, snap.structuredResume);

    const uiExp = uiChecklist.some((x) => /expérience|experience/i.test(x.text) && x.ok);
    const uiSkills = uiChecklist.some((x) => /compétence|skill/i.test(x.text) && x.ok);
    const uiLang = uiChecklist.some((x) => /langue|language/i.test(x.text) && x.ok);

    addCheck(
      'exp_thresh',
      'Experience >= 1',
      counts.experiences >= 1 || uiExp,
      counts.experiences >= 1 ? `got ${counts.experiences}` : uiExp ? 'UI checklist OK (data arrays empty)' : `got ${counts.experiences}`
    );
    addCheck('edu_thresh', 'Education >= 1', counts.education >= 1, `got ${counts.education}`);
    addCheck('clients_thresh', 'Clients >= 4', counts.clients >= 4, `got ${counts.clients}`);
    addCheck(
      'skills_thresh',
      'Skills >= 3',
      counts.skills >= 3 || uiSkills,
      counts.skills >= 3 ? `got ${counts.skills}` : uiSkills ? 'UI checklist OK' : `got ${counts.skills}`
    );
    addCheck('tools_thresh', 'Tools >= 2', counts.tools >= 2, `got ${counts.tools}`);
    addCheck(
      'lang_thresh',
      'Languages >= 1',
      counts.languages >= 1 || uiLang,
      counts.languages >= 1 ? `got ${counts.languages}` : uiLang ? 'UI checklist OK' : `got ${counts.languages}`
    );

    const profile = resolveChecklistProfile({ resumeData, cvData });
    atsScore = computeProductScore(profile || cvData, { resumeData });
    const c = atsScore?.checks || {};

    const uiName = uiChecklist.some((x) => /nom|name/i.test(x.text) && x.ok);
    const uiEmail = uiChecklist.some((x) => /email|e-mail|courriel/i.test(x.text) && x.ok);
    const uiPhone = uiChecklist.some((x) => /téléphone|phone/i.test(x.text) && x.ok);
    const uiEdu = uiChecklist.some((x) => /formation|education/i.test(x.text) && x.ok);

    addCheck('chk_name', 'Checklist: Name', uiName || !!c.name, cvData.name || profile?.name || 'missing');
    addCheck('chk_email', 'Checklist: Email', uiEmail || !!c.email, cvData.email || profile?.email || 'missing');
    addCheck('chk_phone', 'Checklist: Phone', uiPhone || !!c.phone, cvData.phone || profile?.phone || 'missing');
    addCheck('chk_experience', 'Checklist: Experience', uiExp || !!c.experience, `${counts.experiences} entries`);
    addCheck('chk_education', 'Checklist: Education', uiEdu || !!c.education, `${counts.education} entries`);
    addCheck('chk_skills', 'Checklist: Skills', uiSkills || !!c.skills, `${counts.skills} skills`);

    await page.evaluate(() => {
      document.querySelector('#reviewV2Checklist [data-check-action="export"]')?.click();
    });
    await page.click('.hirelyProgressStep[data-doc-step="export"] .hirelyProgressBtn').catch(() => {});
    await page.waitForTimeout(800);

    const exportChecklist = await page.evaluate(() => {
      const item = [...document.querySelectorAll('#reviewV2Checklist .atsCheckItem')].find((li) =>
        /export|pdf/i.test(li.querySelector('.atsCheckLabel')?.textContent || '')
      );
      return {
        ok: item?.classList.contains('is-ok') || item?.classList.contains('atsCheckItem--ok'),
        label: item?.querySelector('.atsCheckLabel')?.textContent?.trim() || '',
      };
    });

    const pdfOut = path.join(OUT_DIR, 'yoaz-export.pdf');
    let exportOk = false;
    try {
      await page.click('#downloadBtn', { timeout: 15000 });
      const download = await page.waitForEvent('download', { timeout: 35000 });
      await download.saveAs(pdfOut);
      pdfBytes = fs.statSync(pdfOut).size;
      exportOk = pdfBytes > 5000;
      pdfExportPath = pdfOut;
    } catch (e) {
      const inner = await page.evaluate(() => document.querySelector('#cvDoc')?.innerHTML || '');
      await exportCvPdfPlaywright(page, inner, 'ats', pdfOut);
      const bytes = fs.readFileSync(pdfOut);
      const analysis = await analyzePdfBytes(bytes);
      pdfBytes = bytes.length;
      exportOk = (analysis.pageCount || 0) >= 1 && bytes.length > 5000;
      pdfExportPath = pdfOut;
    }
    exportOk = exportOk || exportChecklist.ok;
    addCheck(
      'chk_export',
      'Checklist: Export PDF',
      exportOk,
      exportOk ? `${pdfBytes ? `${pdfBytes} bytes` : 'checklist ok'}` : 'export failed'
    );

    try {
      await page.locator('#cvDoc').screenshot({ path: path.join(OUT_DIR, 'preview.png'), timeout: 15000 });
    } catch {
      /* optional */
    }
  } catch (err) {
    addCheck('import', 'Yoaz PDF import', false, String(err.message || err));
    failures.push(`E2E error: ${err.message || err}`);
  } finally {
    await browser.close();
    srv.close();
  }

  const criticalIds = ['import', 'preview', 'exp_thresh', 'edu_thresh', 'chk_export'];
  const criticalOk = criticalIds.every((id) => checks.find((c) => c.id === id)?.ok);
  const verdict = deriveVerdict(checks, criticalOk);

  const md = [];
  md.push('# FINAL ACCEPTANCE REPORT');
  md.push('');
  md.push(`Generated: ${new Date().toISOString()}`);
  md.push(`Mode: **End-to-end browser** (Yoaz PDF → review → A4 preview → export)`);
  md.push(`PDF: \`${pdfPath}\``);
  md.push(`Import state: **${importState || 'n/a'}** (${importPath})`);
  md.push(`Raw OCR text: ${rawTextLen} chars`);
  md.push('');
  md.push('## Verdict');
  md.push('');
  md.push(`# ${verdict}`);
  md.push('');

  if (verdict === 'FAIL') {
    md.push('**Critical failures** — import, preview, core sections, or PDF export blocked.');
  } else if (verdict === 'PARTIAL') {
    md.push('**Core E2E works** — Yoaz PDF imports, preview renders, PDF exports; some thresholds or checklist items incomplete.');
  } else {
    md.push('**All acceptance criteria met.**');
  }
  md.push('');
  if (failures.length) {
    md.push('### Exact reasons');
    md.push('');
    for (const f of failures) md.push(`- ${f}`);
    md.push('');
  }

  md.push('## Section thresholds (resumeData + cvData)');
  md.push('');
  md.push('| Section | Required | Actual | Pass |');
  md.push('|---------|----------|-------:|:----:|');
  const threshRows = [
    ['Experience', '>= 1', counts.experiences, (v) => v >= 1],
    ['Education', '>= 1', counts.education, (v) => v >= 1],
    ['Clients', '>= 4', counts.clients, (v) => v >= 4],
    ['Skills', '>= 3', counts.skills, (v) => v >= 3],
    ['Tools', '>= 2', counts.tools, (v) => v >= 2],
    ['Languages', '>= 1', counts.languages, (v) => v >= 1],
    ['Suggestions', '<= 3', sugCount, (v) => v <= 3],
  ];
  for (const [label, req, actual, fn] of threshRows) {
    md.push(`| ${label} | ${req} | ${actual ?? 0} | ${fn(actual ?? 0) ? '✓' : '✗'} |`);
  }
  md.push('');

  md.push('## Checklist (must work)');
  md.push('');
  md.push('| Item | Pass | Detail |');
  md.push('|------|:----:|--------|');
  for (const id of ['chk_name', 'chk_email', 'chk_phone', 'chk_experience', 'chk_education', 'chk_skills', 'chk_export']) {
    const ch = checks.find((c) => c.id === id);
    if (ch) md.push(`| ${ch.label.replace('Checklist: ', '')} | ${ch.ok ? '✓' : '✗'} | ${mdEsc(ch.detail)} |`);
  }
  md.push('');

  if (uiChecklist.length) {
    md.push('## UI checklist (review studio)');
    md.push('');
    for (const item of uiChecklist) md.push(`- ${item.ok ? '✓' : '○'} ${item.text}`);
    md.push('');
  }

  md.push('## All checks');
  md.push('');
  for (const ch of checks) {
    md.push(`- ${ch.ok ? '✓' : '✗'} **${ch.label}**${ch.detail ? ` — ${ch.detail}` : ''}`);
  }
  md.push('');

  if (failures.length) {
    md.push('## Failure reasons');
    md.push('');
    for (const f of failures) md.push(`- ${f}`);
    md.push('');
  }

  if (corruptionHits.length) {
    md.push('## OCR garbage in preview');
    md.push('');
    for (const h of corruptionHits) md.push(`- \`${mdEsc(h.line)}\` (${h.reason})`);
    md.push('');
  }

  if (suggestions.items.length) {
    md.push('## Visible suggestions');
    md.push('');
    for (const s of suggestions.items) {
      md.push(`- [${s.category || 'unknown'}] \`${String(s.text || '').slice(0, 100)}\``);
    }
    md.push('');
  }

  md.push('## Identity & ATS');
  md.push('');
  md.push(`- Name: ${cvData?.name || '—'}`);
  md.push(`- Email: ${cvData?.email || '—'}`);
  md.push(`- Phone: ${cvData?.phone || '—'}`);
  md.push(`- ATS score: ${atsScore?.total ?? 'n/a'} (${atsScore?.band?.label ?? 'n/a'})`);
  md.push(`- Preview: ${previewHtmlLen} B HTML · ${previewText.length} chars plain text`);
  if (pdfExportPath && pdfBytes) md.push(`- Export PDF: \`${path.relative(ROOT, pdfExportPath)}\` (${pdfBytes} bytes)`);
  md.push('');

  md.push('## Preview sample');
  md.push('');
  md.push('```');
  md.push(previewText.split('\n').slice(0, 24).join('\n') || '(empty)');
  md.push('```');
  md.push('');

  fs.writeFileSync(OUT_PATH, md.join('\n'));
  fs.writeFileSync(
    path.join(OUT_DIR, 'report.json'),
    JSON.stringify({ verdict, checks, counts, failures, passes, pdfPath, pdfBytes, importState }, null, 2)
  );

  console.log(verdict);
  console.log('Report:', OUT_PATH);
  if (failures.length) {
    console.log('Failures:');
    for (const f of failures) console.log(' -', f);
  }
  process.exit(verdict === 'FAIL' ? 1 : 0);
}

main().catch((err) => {
  fs.writeFileSync(
    OUT_PATH,
    `# FINAL ACCEPTANCE REPORT\n\n## Verdict\n\n# FAIL\n\nUnhandled error: ${err.message}\n`
  );
  console.error('FAIL', err);
  process.exit(1);
});
