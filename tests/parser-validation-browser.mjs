#!/usr/bin/env node
/**
 * Browser validation — paste each clean fixture → live preview → PDF export.
 * Requires: npm run dev (port 3456) and playwright.
 *
 * Run: npm run validate:parser:browser
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { PARSER_VALIDATION_PROFILES } from './lib/parser-validation-gate.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.HIRELY_URL || 'http://127.0.0.1:3456/?pro=true&debug=true';

function loadCleanText(fixtureId) {
  return fs.readFileSync(path.join(__dirname, 'fixtures', fixtureId, 'fixture.txt'), 'utf8');
}

async function pasteAndValidate(page, profile) {
  const text = loadCleanText(profile.fixture);
  const failures = [];

  const pipelineOk = await page.evaluate(async (raw) => {
    if (!window.HirelyParse?.applyCvPipeline) return false;
    return !!(await window.HirelyParse.applyCvPipeline(raw, {
      source: 'validate-paste',
      extractionMethod: 'paste',
      trusted: true,
    }));
  }, text);
  if (!pipelineOk) {
    return { failures: ['applyCvPipeline failed'], state: {} };
  }

  await page.waitForFunction(
    () => {
      const doc = document.getElementById('cvDoc');
      return doc?.classList.contains('cv--live') && doc.innerHTML.length > 300;
    },
    { timeout: 15000 }
  );

  const state = await page.evaluate(() => {
    const cv = window.HirelyParse?.lastResult?.cvData || {};
    const doc = document.getElementById('cvDoc');
    const docText = doc?.textContent || '';
    return {
      method:
        window.HirelyParse?.lastResult?.extractionMethod ||
        window.HirelyParse?.lastResult?.audit?.extractionMethod ||
        '',
      name: cv.name || document.querySelector('#cvDoc .cvName')?.textContent?.trim() || '',
      email: cv.email || '',
      phone: cv.phone || '',
      htmlLen: doc?.innerHTML?.length || 0,
      textLen: docText.trim().length,
      hasName: !!document.querySelector('#cvDoc .cvName')?.textContent?.trim(),
      previewHasEmail: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(docText),
      previewHasPhone: /(?:\+?\d[\d\s().-]{7,}\d)/.test(docText),
    };
  });

  if (state.method && /ocr|pdf-ocr/i.test(state.method)) {
    failures.push(`wrong extraction method: ${state.method}`);
  }
  if (!state.hasName || state.textLen < 200) {
    failures.push('CV preview empty or missing name');
  }
  if (profile.expect.email && !profile.expect.email.test(state.email) && !state.previewHasEmail) {
    failures.push('email missing in parsed CV / preview');
  }
  if (
    profile.expect.phone &&
    !profile.expect.phone.test(String(state.phone).replace(/\s/g, '')) &&
    !profile.expect.phone.test(state.phone) &&
    !state.previewHasPhone
  ) {
    failures.push('phone missing in parsed CV / preview');
  }
  if (/name to confirm/i.test(state.name)) {
    failures.push('Name to confirm shown in UI');
  }

  await page.waitForFunction(() => typeof window.HirelyLazy?.ensureHtml2pdf === 'function', {
    timeout: 8000,
  });
  await page.evaluate(() => window.HirelyLazy.ensureHtml2pdf());
  await page.waitForFunction(() => typeof window.html2pdf === 'function', { timeout: 20000 });

  const exportOk = await page.evaluate(async () => {
    const cv = document.getElementById('cvDoc');
    if (!cv || !window.html2pdf) return false;
    try {
      const blob = await window
        .html2pdf()
        .set({
          margin: 0,
          filename: 'validate.pdf',
          image: { type: 'jpeg', quality: 0.5 },
          html2canvas: { scale: 1, logging: false },
          jsPDF: { unit: 'px', format: [794, 1123], orientation: 'portrait' },
        })
        .from(cv)
        .outputPdf('blob');
      return blob && blob.size > 800;
    } catch {
      return false;
    }
  });

  if (!exportOk) failures.push('PDF export failed');

  return { failures, state };
}

async function main() {
  console.log('HIRELY PARSER VALIDATION (browser — paste → preview → PDF)\n');
  console.log(`URL: ${BASE}\n`);

  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await page.waitForFunction(() => window.HirelyParse?.applyCvPipeline, { timeout: 15000 });
  } catch (e) {
    console.error(`Cannot load app — start server: python3 -m http.server 3456`);
    console.error(e.message);
    await browser.close();
    process.exit(1);
  }

  let failed = 0;
  for (const profile of PARSER_VALIDATION_PROFILES) {
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await page.waitForFunction(() => window.HirelyParse?.applyCvPipeline, { timeout: 15000 });

    const { failures, state } = await pasteAndValidate(page, profile);
    const status = failures.length ? 'FAIL' : 'PASS';
    console.log(`── ${profile.label} [${status}]`);
    console.log(`  preview: ${state.textLen} chars · ${state.name}`);
    if (failures.length) {
      console.log(`  ✗ ${failures.join('; ')}`);
      failed++;
    }
    console.log('');
  }

  await browser.close();

  if (failed) {
    console.error(`BROWSER VALIDATION FAILED (${failed}/${PARSER_VALIDATION_PROFILES.length})`);
    process.exit(1);
  }
  console.log(`OK all ${PARSER_VALIDATION_PROFILES.length} profiles: paste → preview → PDF export`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
