#!/usr/bin/env node
/**
 * HIRELY H6 — Product polish & commercial UX QA
 */
import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT_DIR = path.join(ROOT, 'tests/output/h6-product-polish');

fs.mkdirSync(OUT_DIR, { recursive: true });

const results = [];
let failed = 0;

function record(id, pass, detail = '') {
  results.push({ id, pass, detail });
  if (!pass) {
    failed++;
    console.error('FAIL', id, detail);
  } else {
    console.log('OK', id, detail);
  }
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
    }[ext] || 'application/octet-stream'
  );
}

function startServer(port) {
  return http.createServer((req, res) => {
    const u = req.url.split('?')[0];
    let p = u === '/' ? '/index.html' : u;
    const fp = path.join(ROOT, decodeURIComponent(p));
    if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, { 'Content-Type': mime(fp) });
    fs.createReadStream(fp).pipe(res);
  });
}

const port = 3070 + Math.floor(Math.random() * 40);
const server = startServer(port);
await new Promise((r) => server.listen(port, r));

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

try {
  await page.goto(`http://127.0.0.1:${port}/?pro=true`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForTimeout(600);

  const hero = await page.evaluate(() => {
    const vis = (el) => {
      if (!el) return false;
      const st = window.getComputedStyle(el);
      return st.display !== 'none' && st.visibility !== 'hidden';
    };
    const steps = [...document.querySelectorAll('.heroPipeline--three .heroStep')];
    const stepTitles = steps.map((s) => s.querySelector('.heroStepTitle')?.textContent?.trim() || '');
    const stepDescs = steps.map((s) => s.querySelector('.heroStepDesc')?.textContent?.trim() || '');
    const jargon = /pipeline|extraction debug|classification debug|OCR pipeline/i.test(
      document.getElementById('hero')?.innerText || ''
    );
    return {
      h1: document.querySelector('#heroTitle')?.innerText?.trim() || '',
      lead: document.querySelector('#hero .lead')?.textContent?.trim() || '',
      uploadBtn: vis(document.getElementById('heroUploadBtn')),
      uploadLabel: document.getElementById('heroUploadBtn')?.textContent?.trim() || '',
      stepCount: steps.length,
      stepTitles,
      stepDescs,
      jargon,
    };
  });

  record('homepage_clear_headline', hero.h1.length > 8, hero.h1.slice(0, 48));
  record('homepage_simple_promise', hero.lead.length > 20, hero.lead.slice(0, 60));
  record('upload_cta_above_fold', hero.uploadBtn && /importer|upload/i.test(hero.uploadLabel), hero.uploadLabel);
  record('hero_three_steps', hero.stepCount === 3, hero.stepTitles.join(' → '));
  record(
    'hero_steps_import_review_export',
    /import/i.test(hero.stepTitles[0] || '') &&
      /relire|review/i.test(hero.stepTitles[1] || '') &&
      /export/i.test(hero.stepTitles[2] || ''),
    hero.stepTitles.join(',')
  );
  record('hero_no_debug_jargon', !hero.jargon, 'clean');

  const pricing = await page.evaluate(() => {
    const free = [...document.querySelectorAll('.price:not(.pro) .priceFeatures li')].map((li) =>
      li.textContent.trim()
    );
    const pro = [...document.querySelectorAll('.price.pro .priceFeatures li')].map((li) =>
      li.textContent.trim()
    );
    return {
      title: document.querySelector('#pricing h2')?.textContent?.trim() || '',
      free,
      pro,
      proPrice: document.querySelector('.price.pro strong')?.textContent?.trim() || '',
    };
  });

  record('pricing_free_features', pricing.free.length >= 2, pricing.free.join(' · '));
  record(
    'pricing_free_ats',
    pricing.free.some((f) => /ats|contrôle/i.test(f)),
    pricing.free.join(',')
  );
  record('pricing_pro_features', pricing.pro.length >= 4, `${pricing.pro.length} items`);
  record(
    'pricing_pro_bundle',
    pricing.pro.some((f) => /modèle|template|premium/i.test(f)) &&
      pricing.pro.some((f) => /lettre|letter/i.test(f)) &&
      pricing.pro.some((f) => /pdf/i.test(f)) &&
      pricing.pro.some((f) => /linkedin/i.test(f)),
    pricing.pro.join(',')
  );
  record('pricing_pro_9eur', pricing.proPrice.includes('9'), pricing.proPrice);

  // Import fixture to reach review step
  await page.waitForFunction(
    () => typeof window.HirelyParse?.handleFileImport === 'function',
    { timeout: 120000 }
  );

  const fixture = path.join(ROOT, 'tests/fixtures/yoaz-cv/fixture.txt');
  const { PDFDocument, StandardFonts } = await import('pdf-lib');
  const pdfPath = path.join(OUT_DIR, 'h6-upload.pdf');
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const p = pdf.addPage();
  let y = 750;
  for (const line of fs.readFileSync(fixture, 'utf8').split('\n').slice(0, 40)) {
    p.drawText(line.slice(0, 90), { x: 48, y, size: 9, font });
    y -= 12;
  }
  fs.writeFileSync(pdfPath, await pdf.save());
  await page.locator('#fileInput').setInputFiles(pdfPath);

  const t0 = Date.now();
  while (Date.now() - t0 < 120000) {
    const live = await page.evaluate(() =>
      document.getElementById('cvDoc')?.classList.contains('cv--live')
    );
    if (live) break;
    await page.waitForTimeout(400);
  }

  const enabled = page.locator('#docNav .hirelyProgressBtn[data-doc-step="edit"]:not([disabled])');
  if ((await enabled.count()) > 0) await enabled.click();
  else {
    await page.evaluate(() => {
      if (typeof setDocStep === 'function') setDocStep('edit');
    });
  }
  await page.waitForTimeout(500);

  const review = await page.evaluate(() => {
    const steps = [...document.querySelectorAll('.hirelyProgressStep')];
    const labels = steps.map((s) => s.querySelector('.hirelyProgressLabel')?.textContent?.trim() || '');
    const analysis = document.getElementById('reviewStudioAnalysis');
    const vis = (el) => {
      if (!el || el.classList.contains('hidden')) return false;
      const st = window.getComputedStyle(el);
      return st.display !== 'none' && st.visibility !== 'hidden';
    };
    const text = analysis?.innerText || '';
    const debugTerms = /pipeline d'extraction|classification debug|score extraction|blocs|validateur/i.test(
      text
    );
    return {
      stepCount: steps.length,
      labels,
      analysisVisible: vis(analysis),
      analysisTitle: document.querySelector('#reviewStudioAnalysis h3')?.textContent?.trim() || '',
      checklistTitle:
        document.querySelector('#reviewStudioAnalysis h4')?.textContent?.trim() || '',
      debugTerms,
    };
  });

  record('stepper_three_steps', review.stepCount === 3, review.labels.join(' → '));
  record(
    'stepper_import_review_export',
    /import/i.test(review.labels[0] || '') &&
      /relire|review/i.test(review.labels[1] || '') &&
      /export/i.test(review.labels[2] || ''),
    review.labels.join(',')
  );
  record('review_panel_visible', review.analysisVisible, review.analysisTitle);
  record(
    'review_clean_titles',
    !/analyse recruteur|recruiter analysis/i.test(review.analysisTitle) &&
      /qualité|quality/i.test(review.analysisTitle),
    `${review.analysisTitle} / ${review.checklistTitle}`
  );
  record('review_no_debug_language', !review.debugTerms, 'no pipeline jargon');
} catch (e) {
  record('qa_runner_fatal', false, String(e?.message || e).split('\n')[0]);
} finally {
  const report = {
    timestamp: new Date().toISOString(),
    version: 'H6',
    results,
    passed: results.filter((r) => r.pass).length,
    failed: results.filter((r) => !r.pass).length,
    pass: failed === 0,
  };
  fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
  server.close();
}

if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exitCode = 1;
} else {
  console.log('\nqa-h6-product-polish: PASS');
}
