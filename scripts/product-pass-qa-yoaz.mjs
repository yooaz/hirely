#!/usr/bin/env node
/**
 * Hirely product pass QA — Yoaz PDF
 * node scripts/product-pass-qa-yoaz.mjs
 */
import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { isExtensionConsoleNoise } from '../tests/lib/qa-console-filter.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'PRODUCT_PASS_QA.md');
const SHOT_DIR = path.join(ROOT, '.qa-screenshots');

const PDF = [
  process.env.HIRELY_YOAZ_PDF,
  '/Users/yohannazancot/Documents/cv/cv2022 yohann azancot copie.pdf',
].find((p) => p && fs.existsSync(p));

function mime(fp) {
  const ext = path.extname(fp).toLowerCase();
  return (
    { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json' }[
      ext
    ] || 'application/octet-stream'
  );
}

function server(port) {
  return http.createServer((req, res) => {
    const u = req.url.split('?')[0];
    let rel = u === '/' ? '/index.html' : u;
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

async function main() {
  if (!PDF) {
    fs.writeFileSync(OUT, '# Product pass QA\n\nFAIL — Yoaz PDF not found\n');
    console.error('Yoaz PDF missing');
    process.exit(1);
  }

  fs.mkdirSync(SHOT_DIR, { recursive: true });
  const port = 3070 + Math.floor(Math.random() * 30);
  const srv = server(port);
  await new Promise((r) => srv.listen(port, r));

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 960 } });
  page.setDefaultTimeout(360000);

  const consoleErrors = [];
  page.on('pageerror', (e) => {
    const text = String(e.message || e);
    if (!isExtensionConsoleNoise(text)) consoleErrors.push(text);
  });
  page.on('console', (msg) => {
    const text = msg.text();
    if (msg.type() === 'error' && !isExtensionConsoleNoise(text)) consoleErrors.push(text);
  });

  const checks = {};
  try {
    await page.goto(`http://127.0.0.1:${port}/?pro=true`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction(() => typeof window.HirelyParse?.handleFileImport === 'function', { timeout: 240000 });

    const pdfBuf = fs.readFileSync(PDF);
    const importState = await page.evaluate(
      async ({ b64, name }) => {
        const bin = atob(b64);
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        const file = new File([arr], name, { type: 'application/pdf' });
        return window.HirelyParse.handleFileImport(file, 'qa');
      },
      { b64: pdfBuf.toString('base64'), name: path.basename(PDF) }
    );
    checks.import = importState;

    await page.waitForFunction(
      () => document.querySelector('#workspaceGrid')?.classList.contains('workspaceGrid--ready'),
      { timeout: 120000 }
    );
    await page.screenshot({ path: path.join(SHOT_DIR, 'product-pass-review-before.png'), fullPage: false });

    await page.waitForFunction(
      () => !document.querySelector('.hirelyProgressStep[data-doc-step="edit"] .hirelyProgressBtn')?.disabled,
      { timeout: 60000 }
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

    const review = await page.evaluate(() => {
      const grid = document.querySelector('.wsProduct');
      const cols = grid ? getComputedStyle(grid).gridTemplateColumns : '';
      const docStep = document.querySelector('#workspace')?.dataset?.docStep || '';
      const zoom = document.querySelector('#a4Viewport')?.dataset?.a4Zoom || '';
      const cards = [...document.querySelectorAll('.suggestionCard')];
      const more = document.querySelector('#suggestionsMore')?.textContent || '';
      const selects = cards.map((c) => {
        const sel = c.querySelector('select[data-suggestion-category]');
        const text = c.querySelector('.suggestionText')?.textContent?.trim() || '';
        return { text: text.slice(0, 60), value: sel?.value || '', label: sel?.selectedOptions?.[0]?.textContent?.trim() || '' };
      });
      const checklist = [...document.querySelectorAll('#reviewV2Checklist .atsCheckItem')].map((li) => ({
        text: li.querySelector('.atsCheckLabel')?.textContent?.trim(),
        ok: li.classList.contains('is-ok') || li.classList.contains('atsCheckItem--ok'),
      }));
      const scoreLead = document.querySelector('#reviewV2ScoreLead')?.textContent?.trim() || '';
      const headerVisible = !document.querySelector('#cvHeaderBar')?.classList.contains('hidden');
      const a4Text = document.querySelector('#cvDoc')?.innerText?.slice(0, 2000) || '';
      return {
        docStep,
        cols,
        zoom: parseFloat(zoom) || 0,
        suggestionCount: cards.length,
        more,
        selects,
        checklist,
        scoreLead,
        headerVisible,
        hasExperience: checklist.some((c) => /expérience|experience/i.test(c.text || '') && c.ok),
        hasEducation: checklist.some((c) => /formation|education/i.test(c.text || '') && c.ok),
        hasSkills: checklist.some((c) => /compétence|skill/i.test(c.text || '') && c.ok),
        hasPhone: checklist.some((c) => /téléphone|phone/i.test(c.text || '') && c.ok),
        a4HasAdobe: /adobe/i.test(a4Text),
        garbageInSuggestions: selects.some((s) => /@\s*\d|market reviews|^b wma|^lea$/i.test(s.text)),
        wrongDefaults: selects.filter((s) => {
          const t = s.text.toLowerCase();
          if (/créapole|creapole|2007|2009|lisaa/.test(t) && s.value !== 'education') return true;
          if (/drawing|branding|illustration/.test(t) && s.value !== 'skill') return true;
          if (/photoshop|illustrator|figma/.test(t) && s.value !== 'tool') return true;
          if (/english|french|fluent/.test(t) && s.value !== 'language') return true;
          if (/\bnike\b/.test(t) && s.value !== 'client') return true;
          return false;
        }),
      };
    });

    checks.review = review;
    await page.screenshot({ path: path.join(SHOT_DIR, 'product-pass-review-after.png'), fullPage: false });

    await page.evaluate(() => {
      document.querySelector('#reviewV2Checklist [data-check-action="export"]')?.click();
    });
    try {
      await page.waitForFunction(
        () => {
          const item = [...document.querySelectorAll('#reviewV2Checklist .atsCheckItem')].find((li) =>
            /export|pdf/i.test(li.querySelector('.atsCheckLabel')?.textContent || '')
          );
          return item?.classList.contains('is-ok') || item?.classList.contains('atsCheckItem--ok');
        },
        { timeout: 90000 }
      );
    } catch {
      /* recorded below */
    }

    await page.click('.hirelyProgressStep[data-doc-step="export"] .hirelyProgressBtn');
    await page.waitForTimeout(600);
    await page.evaluate(() => document.querySelector('#openLetterBtn')?.click());
    await page.waitForTimeout(400);

    const exportStep = await page.evaluate(() => ({
      letterOpen: !document.querySelector('#coverLetterWorkspace')?.classList.contains('hidden'),
      exportPanel: !document.querySelector('#exportFinalPanel')?.classList.contains('hidden'),
      exportScore: document.querySelector('#exportFinalScore')?.textContent?.trim() || '',
    }));
    checks.export = exportStep;
    await page.screenshot({ path: path.join(SHOT_DIR, 'product-pass-export-after.png'), fullPage: false });

    const exportCheck = await page.evaluate(() => {
      const item = [...document.querySelectorAll('#reviewV2Checklist .atsCheckItem')].find((li) =>
        /export|pdf/i.test(li.querySelector('.atsCheckLabel')?.textContent || '')
      );
      return {
        ok: item?.classList.contains('is-ok') || item?.classList.contains('atsCheckItem--ok'),
        label: item?.querySelector('.atsCheckLabel')?.textContent?.trim() || '',
      };
    });
    checks.exportPdfCheck = exportCheck;

    const fatal = consoleErrors.filter(
      (e) => !isExtensionConsoleNoise(e) && /hirely|fatal|uncaught/i.test(e) && !/favicon/i.test(e)
    );
    checks.fatalConsole = fatal;

    const pass =
      (importState === 'IMPORT_READY' || importState === 'IMPORT_PARTIAL') &&
      review.docStep === 'edit' &&
      review.zoom >= 0.8 &&
      review.suggestionCount <= 5 &&
      !review.garbageInSuggestions &&
      review.wrongDefaults.length === 0 &&
      review.hasExperience &&
      review.hasEducation &&
      review.hasSkills &&
      review.hasPhone &&
      review.headerVisible &&
      /Score recruteur:\s*\d+\/100/.test(review.scoreLead) &&
      exportStep.letterOpen &&
      exportStep.exportPanel &&
      exportCheck.ok &&
      fatal.length === 0;

    const md = [
      '# Product Pass QA — Yoaz PDF',
      '',
      `Generated: ${new Date().toISOString()}`,
      '',
      `## Result: **${pass ? 'PASS' : 'FAIL'}**`,
      '',
      '## Checks',
      '',
      `| Check | Result |`,
      `|-------|--------|`,
      `| Import | ${importState} |`,
      `| docStep | ${review.docStep} |`,
      `| A4 layout columns | ${review.cols} |`,
      `| A4 zoom | ${review.zoom || '—'} |`,
      `| Suggestions ≤ 5 | ${review.suggestionCount} |`,
      `| Garbage hidden | ${!review.garbageInSuggestions ? 'yes' : 'no'} |`,
      `| Category defaults OK | ${review.wrongDefaults.length === 0 ? 'yes' : 'no'} |`,
      `| Experience ✓ | ${review.hasExperience ? 'yes' : 'no'} |`,
      `| Formation ✓ | ${review.hasEducation ? 'yes' : 'no'} |`,
      `| Compétences ✓ | ${review.hasSkills ? 'yes' : 'no'} |`,
      `| Téléphone ✓ | ${review.hasPhone ? 'yes' : 'no'} |`,
      `| Score lead | ${review.scoreLead} |`,
      `| Header bar | ${review.headerVisible ? 'visible' : 'hidden'} |`,
      `| Cover letter panel | ${exportStep.letterOpen ? 'open' : 'closed'} |`,
      `| Export panel | ${exportStep.exportPanel ? 'visible' : 'hidden'} |`,
      `| Export PDF ✓ | ${exportCheck.ok ? 'yes' : 'no'} |`,
      `| Fatal console | ${fatal.length ? fatal.join('; ') : 'none'} |`,
      '',
      '## Suggestion dropdowns',
      '',
      ...review.selects.map((s) => `- \`${s.text}\` → **${s.value}** (${s.label})`),
      '',
      review.wrongDefaults.length
        ? `### Wrong defaults\n${review.wrongDefaults.map((w) => `- ${w.text} → ${w.value}`).join('\n')}`
        : '',
      '',
      `More line: ${review.more || '—'}`,
      '',
      '## Screenshots',
      '',
      `- Before: \`.qa-screenshots/product-pass-review-before.png\``,
      `- After: \`.qa-screenshots/product-pass-review-after.png\``,
      `- Export: \`.qa-screenshots/product-pass-export-after.png\``,
      '',
    ].join('\n');

    fs.writeFileSync(OUT, md);
    const hidden = +(String(review.more || '').match(/(\d+)/) || [])[1] || 0;
    const checklistLine = review.checklist.map((c) => `${c.text} ${c.ok ? '✓' : '○'}`).join(', ');
    console.log(
      JSON.stringify({
        a4Readable: review.zoom >= 0.8,
        suggestions: review.suggestionCount,
        hiddenGarbage: hidden,
        atsScore: review.scoreLead,
        checklist: checklistLine,
        coverLetter: exportStep.letterOpen,
        pdfExport: exportCheck.ok,
        pass,
      })
    );
    console.log(pass ? 'PASS' : 'FAIL');
    console.log('Written', OUT);
    if (!pass) process.exit(1);
  } finally {
    await browser.close();
    srv.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
