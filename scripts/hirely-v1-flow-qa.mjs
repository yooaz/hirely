
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';

const root = process.cwd();
const qaDir = path.join(root, 'tests', 'hirely-v1-manual');
const screenshotsDir = path.join(root, 'tests', 'output', 'hirely-v1-flow-screens');
fs.mkdirSync(screenshotsDir, { recursive: true });

const samples = [
  { name: 'TXT', mode: 'file', path: path.join(qaDir, 'sample_cv.txt') },
  { name: 'DOCX', mode: 'file', path: path.join(qaDir, 'sample_cv.docx') },
  { name: 'PDF text', mode: 'file', path: path.join(qaDir, 'sample_cv_text.pdf') },
  { name: 'PDF image', mode: 'file', path: path.join(qaDir, 'sample_cv_scanned_image.pdf'), allowPasteFallback: true },
  { name: 'Paste', mode: 'paste', path: path.join(qaDir, 'sample_cv.txt') },
];

const server = spawn('node', ['scripts/dev-server.mjs'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
await new Promise((resolve) => setTimeout(resolve, 1200));

const browser = await chromium.launch({ headless: false, executablePath: '/usr/bin/chromium', args: ['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--disable-software-rasterizer','--single-process','--disable-features=VizDisplayCompositor'] });
const results = [];
for (const sample of samples) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, acceptDownloads: true });
  const row = { file: sample.name, import: 'FAIL', review: 'FAIL', style: 'FAIL', export: 'FAIL', downloadPdf: 'FAIL', firstFailure: '' };
  page.on('console', msg => {
    if (msg.type() === 'error') console.log(`[${sample.name}] console error:`, msg.text());
  });
  try {
    await page.goto('http://127.0.0.1:3001/index.html', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForSelector('#fileInput', { timeout: 10000 });
    if (sample.mode === 'file') {
      await page.setInputFiles('#fileInput', sample.path);
    } else {
      const text = fs.readFileSync(sample.path, 'utf8');
      await page.click('#drop');
      await page.fill('#importPasteFallbackText', text);
      await page.click('#importPasteFallbackApply');
    }

    const importOk = await page.waitForFunction(() => {
      const doc = document.querySelector('#cvDoc');
      const paste = document.querySelector('#importPasteFallback');
      const ready = document.querySelector('#workspaceGrid')?.classList.contains('workspaceGrid--ready');
      const textLen = (doc?.innerText || '').trim().length;
      if (ready && textLen > 120) return true;
      if (paste?.classList.contains('show')) return 'PASTE';
      return false;
    }, { timeout: sample.name === 'PDF image' ? 18000 : 15000 }).catch(e => null);

    if (importOk === 'PASTE') {
      const text = fs.readFileSync(path.join(qaDir, 'sample_cv.txt'), 'utf8');
      await page.fill('#importPasteFallbackText', text);
      await page.click('#importPasteFallbackApply');
      await page.waitForFunction(() => {
        const doc = document.querySelector('#cvDoc');
        return document.querySelector('#workspaceGrid')?.classList.contains('workspaceGrid--ready') &&
          (doc?.innerText || '').trim().length > 120;
      }, { timeout: 10000 });
    }
    row.import = 'PASS';

    const reviewOk = await page.evaluate(() => {
      const doc = document.querySelector('#cvDoc');
      return !!doc && (doc.innerText || '').trim().length > 120 && !doc.querySelector('.cvEmptyState');
    });
    if (!reviewOk) throw new Error('Review CV not visible');
    row.review = 'PASS';
    await page.screenshot({ path: path.join(screenshotsDir, `${sample.name.replaceAll(' ', '_')}-review.png`), fullPage: false });

    await page.evaluate(() => window.setDocStep && window.setDocStep('style'));
    await page.waitForTimeout(700);
    const styleOk = await page.evaluate(() => {
      const grid = document.querySelector('#workspaceGrid');
      const doc = document.querySelector('#cvDoc');
      const gallery = document.querySelector('#templateGrid');
      return grid?.classList.contains('docStep-style') &&
        (doc?.innerText || '').trim().length > 120 &&
        !!gallery;
    });
    if (!styleOk) throw new Error('Style step blocked or CV hidden');
    row.style = 'PASS';

    await page.evaluate(() => window.setDocStep && window.setDocStep('export'));
    await page.waitForTimeout(700);
    const exportOk = await page.evaluate(() => {
      const grid = document.querySelector('#workspaceGrid');
      const doc = document.querySelector('#cvDoc');
      const btn = document.querySelector('#downloadBtn');
      return grid?.classList.contains('docStep-export') &&
        (doc?.innerText || '').trim().length > 120 &&
        btn && !btn.disabled && !btn.closest('.hidden') && getComputedStyle(btn).display !== 'none';
    });
    if (!exportOk) throw new Error('Export step/download button blocked');
    row.export = 'PASS';

    const dlPromise = page.waitForEvent('download', { timeout: 15000 }).catch(e => null);
    await page.click('#downloadBtn');
    const dl = await dlPromise;
    if (!dl) throw new Error('No PDF download event');
    const savePath = path.join(screenshotsDir, `${sample.name.replaceAll(' ', '_')}.pdf`);
    await dl.saveAs(savePath);
    if (!fs.existsSync(savePath) || fs.statSync(savePath).size < 1000) throw new Error('Downloaded PDF empty');
    row.downloadPdf = 'PASS';
  } catch (e) {
    row.firstFailure = e.message || String(e);
    await page.screenshot({ path: path.join(screenshotsDir, `${sample.name.replaceAll(' ', '_')}-FAIL.png`), fullPage: false }).catch(()=>{});
  }
  results.push(row);
  await page.close();
}
await browser.close();
server.kill();

const report = { generatedAt: new Date().toISOString(), results };
fs.mkdirSync(path.join(root, 'tests', 'output', 'hirely-v1-flow'), { recursive: true });
fs.writeFileSync(path.join(root, 'tests', 'output', 'hirely-v1-flow', 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (results.some(r => Object.values(r).includes('FAIL'))) process.exit(1);
