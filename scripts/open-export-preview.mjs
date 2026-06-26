#!/usr/bin/env node
/** Open headed browser on export step with sample CV. */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
const paste = fs.readFileSync(path.join(ROOT, 'tests/fixtures/mvp-sample.txt'), 'utf8');

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://127.0.0.1:3001/?pro=true', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof window.HirelyParse?.importText === 'function', { timeout: 120000 });
await page.evaluate(async (text) => {
  await window.HirelyParse.importText(text, { source: 'paste-text', trusted: true, forceContinue: true });
}, paste);
await page.waitForFunction(
  () => {
    const doc = document.getElementById('cvDoc');
    return doc?.classList.contains('cv--live') && (doc.innerText || '').length > 80;
  },
  { timeout: 120000 }
);
await page.evaluate(() => setDocStep('export'));
console.log('Export preview open — close the browser window when done.');
await page.waitForEvent('close', { timeout: 0 }).catch(() => {});
await browser.close();
