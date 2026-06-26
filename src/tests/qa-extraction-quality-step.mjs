#!/usr/bin/env node
/**
 * HIRELY P0 — Extraction quality step before template selection.
 */
import fs from 'fs';
import http from 'http';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT_DIR = path.join(ROOT, 'tests/output/extraction-quality-step');
const OUT_JSON = path.join(OUT_DIR, 'report.json');
const PASTE_FIXTURE = path.join(ROOT, 'tests/fixtures/mvp-sample.txt');

fs.mkdirSync(OUT_DIR, { recursive: true });

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

function loadQualityModule() {
  const code = fs.readFileSync(
    path.join(ROOT, 'src/ui/product/extraction-quality-step.js'),
    'utf8'
  );
  const sandbox = { globalThis: {} };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return sandbox.HirelyExtractionQualityStep;
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
    }[ext] || 'application/octet-stream'
  );
}

function startServer(port) {
  return http.createServer((req, res) => {
    const rel = (req.url || '/').split('?')[0];
    const fp = path.join(ROOT, decodeURIComponent(rel === '/' ? '/index.html' : rel));
    if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
      res.writeHead(404);
      res.end('not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': mime(fp) });
    fs.createReadStream(fp).pipe(res);
  });
}

async function waitForCv(page, timeout = 120000) {
  await page.waitForFunction(
    () => {
      const doc = document.getElementById('cvDoc');
      return doc?.classList.contains('cv--live') && (doc.innerText || '').length > 40;
    },
    { timeout }
  );
}

const Q = loadQualityModule();
ok(!!Q?.buildExtractionQualityStep, 'quality module loads');

const rich = Q.buildExtractionQualityStep({
  finalResumeData: {
    identity: { name: 'Yohann Azancot', email: 'y@example.com', phone: '+33 6 00 00 00 00' },
    experiences: [{ role: 'Designer', company: 'Studio', dates: '2020' }],
    education: [{ school: 'ENSAD', degree: 'Art' }],
    skills: ['Illustration'],
    tools: ['Photoshop'],
  },
});
ok(rich.rows.length === 5, 'five quality rows');
ok(rich.rows.every((r) => r.ok), 'rich profile all detected');
ok(!rich.needsVerification, 'rich profile no verification warn');

const weak = Q.buildExtractionQualityStep({
  finalResumeData: { identity: { name: 'Information non détectée' }, experiences: [], education: [], skills: [] },
});
ok(weak.needsVerification, 'weak profile needs verification');
ok(
  weak.warnMessage.includes('Certaines informations doivent être vérifiées'),
  'french warn message'
);
ok(weak.criticalMissing.includes('name'), 'name critical missing');
ok(weak.criticalMissing.includes('experience'), 'experience critical missing');

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
ok(html.includes('id="extractionQualityStep"'), 'index has extraction quality panel');
ok(html.includes('extraction-quality-step.js'), 'index loads quality script');
ok(html.includes('renderExtractionQualityStep'), 'index renders quality step');
ok(html.includes('Nom détecté') || html.includes('extractionQuality_nameOk'), 'french name label');
ok(html.includes('Certaines informations doivent être vérifiées'), 'warn copy in index');

let browserSnap = {};
try {
  const port = 3080 + Math.floor(Math.random() * 40);
  const server = startServer(port);
  await new Promise((r) => server.listen(port, r));
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`http://127.0.0.1:${port}/?pro=true`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.HirelyParse?.importText === 'function', {
    timeout: 120000,
  });

  const sample = fs.readFileSync(PASTE_FIXTURE, 'utf8');
  await page.evaluate(async (text) => {
    await window.HirelyParse.importText(text, {
      source: 'paste-text',
      trusted: true,
      forceContinue: true,
    });
  }, sample);
  await waitForCv(page);

  browserSnap.editVisible = await page.evaluate(() => {
    const el = document.getElementById('extractionQualityStep');
    return !!el && !el.classList.contains('hidden');
  });
  ok(browserSnap.editVisible, 'quality panel visible on edit step');

  browserSnap.editLabels = await page.evaluate(() => {
    const list = document.getElementById('extractionQualityList');
    return (list?.innerText || '').trim();
  });
  ok(/Nom détecté/.test(browserSnap.editLabels), 'edit step shows Nom détecté');
  ok(/Expérience détectée/.test(browserSnap.editLabels), 'edit step shows Expérience détectée');
  ok(/Compétences détectées/.test(browserSnap.editLabels), 'edit step shows Compétences détectées');

  browserSnap.templateHiddenOnEdit = await page.evaluate(() => {
    const bar = document.getElementById('templatePickerBar');
    return bar?.classList.contains('hidden');
  });
  ok(browserSnap.templateHiddenOnEdit, 'templates hidden on edit step');

  await page.evaluate(() => {
    if (typeof setDocStep === 'function') setDocStep('style');
  });
  await page.waitForTimeout(500);

  browserSnap.styleVisible = await page.evaluate(() => {
    const q = document.getElementById('extractionQualityStep');
    const t = document.getElementById('templatePickerBar');
    return !!q && !q.classList.contains('hidden') && !!t && !t.classList.contains('hidden');
  });
  ok(browserSnap.styleVisible, 'quality + templates visible on style step');

  browserSnap.orderOk = await page.evaluate(() => {
    const q = document.getElementById('extractionQualityStep');
    const t = document.getElementById('templatePickerBar');
    if (!q || !t) return false;
    return !!(q.compareDocumentPosition(t) & Node.DOCUMENT_POSITION_FOLLOWING);
  });
  ok(browserSnap.orderOk, 'quality panel appears before template picker');

  browserSnap.ctaNotBlocked = await page.evaluate(() => {
    const btn = document.getElementById('flowPrimaryCtaBtn');
    return !!btn && !btn.disabled;
  });
  ok(browserSnap.ctaNotBlocked, 'flow CTA not blocked');

  await browser.close();
  server.close();
} catch (err) {
  ok(false, `browser QA: ${err.message}`);
}

const report = {
  feature: 'EXTRACTION_QUALITY_STEP',
  pass: failed === 0,
  generatedAt: new Date().toISOString(),
  unit: { richOk: rich.rows.every((r) => r.ok), weakWarn: weak.needsVerification },
  browser: browserSnap,
};

fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2));
console.log(failed ? '\nFAIL extraction-quality-step' : '\nPASS extraction-quality-step');
process.exit(failed ? 1 : 0);
