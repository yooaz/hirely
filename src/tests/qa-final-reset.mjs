#!/usr/bin/env node
/**
 * Final reset acceptance — full product flow with screenshots.
 * node src/tests/qa-final-reset.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { startQaStaticServer } from '../../tests/lib/qa-static-server.mjs';
import { isExtensionConsoleNoise } from '../../tests/lib/qa-console-filter.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');
const outDir = path.join(root, 'tests/output/final-reset');
fs.mkdirSync(outDir, { recursive: true });

const FIXTURE = path.join(root, 'tests/fixtures/creative-cv/fixture.txt');

let failed = 0;
const consoleLog = [];
function ok(c, m) {
  if (!c) {
    console.error('FAIL', m);
    failed++;
  } else console.log('OK', m);
}

async function waitForBoot(page, serverPort, timeoutMs = 180000) {
  await page.goto(`http://127.0.0.1:${serverPort}/`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(
    () =>
      window.__hirelyCoreReady === true &&
      typeof window.HirelyParse?.ingestCvText === 'function',
    null,
    { timeout: timeoutMs }
  );
}

const port = 3800 + Math.floor(Math.random() * 200);
const server = startQaStaticServer(root);
await new Promise((r) => server.listen(port, r));

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

page.on('console', (msg) => {
  const t = msg.text();
  consoleLog.push({ type: msg.type(), text: t });
});

try {
  await waitForBoot(page, port);
  ok(consoleLog.some((l) => l.text.includes('CORE_BOOT_OK')), 'CORE_BOOT_OK in console');

  const text = fs.readFileSync(FIXTURE, 'utf8');
  await page.evaluate(async (t) => {
    await window.HirelyParse.ingestCvText(t, {
      silent: true,
      force: true,
      confirmed: true,
      trusted: true,
    });
    if (typeof setDocStep === 'function') setDocStep('edit');
    if (typeof renderMetrics === 'function') renderMetrics();
  }, text);

  await page.waitForFunction(
    () => {
      const doc = document.querySelector('#cvDoc');
      return doc && doc.classList.contains('cv--live') && doc.innerHTML.length > 200;
    },
    { timeout: 120000 }
  );

  const cvCheck = await page.evaluate(() => {
    const plain = (document.querySelector('#cvDoc')?.innerText || '').toLowerCase();
    const bad =
      /\b(ben, graphic|incision|wustrator|snoutors)\b/.test(plain) ||
      document.querySelectorAll('#cvDoc .cvExpEntry--toClassify, #cvDoc .cvSection--toClassify').length > 0;
    const name = document.querySelector('#cvDoc .cvName')?.textContent?.trim() || '';
    const rawLen = (window.HirelyParse?.lastResult?.rawText || '').length;
    const rd = window.HirelyParse?.lastResult?.resumeData;
    const rdSize = rd ? JSON.stringify(rd).length : 0;
    const sanSize = rd?.meta?.sanitizedResumeSize || rdSize;
    return { bad, name, rawLen, rdSize, sanSize, plain: plain.slice(0, 400) };
  });

  ok(cvCheck.rawLen > 0, `rawText > 0 (${cvCheck.rawLen})`);
  ok(!cvCheck.bad, 'final CV clean (no OCR fragments in preview)');
  ok(cvCheck.rdSize > 0, `resumeData size ${cvCheck.rdSize}`);
  ok(cvCheck.sanSize > 0, `sanitizedResume size ${cvCheck.sanSize}`);

  await page.locator('#cvDoc').screenshot({ path: path.join(outDir, 'a4-cv.png') });

  await page.waitForFunction(
    () => {
      const total = document.querySelector('#reviewV2ScoreTotal')?.textContent?.trim();
      const metrics = document.querySelectorAll('#reviewV2Metrics .metric').length;
      return total && total !== '—' && metrics >= 4;
    },
    { timeout: 20000 }
  );
  await page.locator('#reviewStudioAnalysis').screenshot({ path: path.join(outDir, 'ats-panel.png') });
  ok(true, 'ATS panel visible with metrics');

  const sugCount = await page.evaluate(() => document.querySelectorAll('#suggestionsList .suggestionCard').length);
  ok(sugCount >= 1, `suggestions panel has items (${sugCount})`);

  await page.locator('#openLetterBtn').click();
  await page.waitForTimeout(800);
  const letterVisible = await page.evaluate(
    () => !document.querySelector('#coverLetterWorkspace')?.classList.contains('hidden')
  );
  ok(letterVisible, 'cover letter workspace visible');
  await page.locator('#coverLetterWorkspace').screenshot({ path: path.join(outDir, 'cover-letter.png') });

  await page.locator('#generateLetterBtn').click();
  await page.waitForTimeout(1200);

  await page.locator('.hirelyProgressBtn[data-doc-step="style"]').click();
  await page.waitForTimeout(800);
  await page.locator('.hirelyProgressBtn[data-doc-step="export"]').click();
  await page.waitForTimeout(800);

  const fatal = consoleLog.filter(
    (l) => l.type === 'error' && !isExtensionConsoleNoise(l.text) && /hirely|import|parser/i.test(l.text)
  );
  ok(fatal.length === 0, `no Hirely fatal console errors (${fatal.length})`);

  const evalBlocked = consoleLog.filter((l) => /csp|eval/i.test(l.text) && l.type === 'error');
  ok(evalBlocked.length === 0, `no CSP eval console errors (${evalBlocked.length})`);

  fs.writeFileSync(
    path.join(outDir, 'report.json'),
    JSON.stringify(
      {
        passed: failed === 0,
        cvCheck,
        consoleSample: consoleLog.slice(-30),
        screenshots: ['a4-cv.png', 'ats-panel.png', 'cover-letter.png'],
      },
      null,
      2
    )
  );
} finally {
  await browser.close();
  server.close();
}

console.log('\nFinal reset:', failed ? 'FAILED' : 'PASSED');
console.log('Output:', outDir);
process.exit(failed ? 1 : 0);
