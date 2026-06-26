#!/usr/bin/env node
/**
 * OCR regression — cv2022 yohann azancot copie.pdf
 *
 * Bad OCR (ION3IIHIAXI / NOILY3NQ3 / YOLVEISNTN / Buipeoy) must NOT reach parser.
 * Good rotated OCR must report OCR_OK + chosenRotation.
 *
 * npm run test:ocr-quality
 */
import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import {
  OCR_STATUS,
  GIBBERISH_MARKERS,
  countGibberishMarkers,
  isMostlyGibberishOcr,
  resolveOcrQualityStatus,
} from '../core/extraction/ocr-quality-status.js';
import { evaluateOcrParserGate } from '../core/extraction/ocr-quality-score.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');
const outDir = path.join(root, 'tests/output/ocr-quality-yoaz');
fs.mkdirSync(outDir, { recursive: true });

const PDF_NAME = 'cv2022 yohann azancot copie.pdf';
const PDF_CANDIDATES = [
  process.env.HIRELY_YOAZ_PDF,
  path.join(root, 'tests/fixtures', PDF_NAME),
  `/Users/yohannazancot/Documents/${PDF_NAME}`,
  `/Users/yohannazancot/Documents/cv/${PDF_NAME}`,
].filter(Boolean);

const READABLE_MARKERS = [
  'PROFILE',
  'WORK EXPERIENCE',
  'EDUCATION',
  'Graphic Designer',
  'Illustrator',
  'LISAA',
  'Créapole',
  'Creapole',
  'Photoshop',
  'yoaz@hotmail',
];

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else {
    console.log('OK', msg);
  }
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
      '.wasm': 'application/wasm',
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

// --- Unit pre-checks (no browser) ---
const badSample = `
ION3IIHIAXI HHOM
NOILY3NQ3
YOLVEISNTN
Buipeoy
AydeiBoroug i) anneu .ysuasy
`.trim();

ok(isMostlyGibberishOcr(badSample), 'unit: bad sample is mostly gibberish');
ok(
  !evaluateOcrParserGate(badSample).pass,
  'unit: gibberish markers blocked by parser gate'
);
ok(
  resolveOcrQualityStatus({ text: badSample, chosenRotation: 180 }) ===
    OCR_STATUS.FAILED_LOW_QUALITY,
  'unit: bad sample status OCR_FAILED_LOW_QUALITY'
);
ok(
  countGibberishMarkers(badSample).length >= 3,
  `unit: ${GIBBERISH_MARKERS.length} markers, found ${countGibberishMarkers(badSample).length}`
);

const pdfPath = resolvePdf();
if (!pdfPath) {
  console.error('PDF not found — set HIRELY_YOAZ_PDF or place file in tests/fixtures/');
  process.exit(1);
}

console.log('\n=== OCR regression (browser) ===');
console.log('PDF:', pdfPath);

const port = 3070 + Math.floor(Math.random() * 50);
const server = startServer(port);
await new Promise((r) => server.listen(port, r));

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.setDefaultTimeout(360000);

const consoleLines = [];
page.on('console', (msg) => {
  const t = msg.text();
  consoleLines.push(t);
  if (/OCR_|OCR_ROTATION|OCR_QUALITY|IMPORT_|CANONICAL/i.test(t)) {
    console.log('[browser]', t);
  }
});

await page.goto(`http://127.0.0.1:${port}/?debug=true`, {
  waitUntil: 'domcontentloaded',
  timeout: 120000,
});
await page.waitForFunction(
  () => typeof window.HirelyParse?.handleFileImport === 'function',
  { timeout: 240000 }
);
await page.waitForTimeout(1500);

const pdfBuf = fs.readFileSync(pdfPath);
const result = await page.evaluate(
  async ({ b64, name }) => {
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    const file = new File([arr], name, {
      type: 'application/pdf',
      lastModified: 1700000000000,
    });
    let importState = 'unknown';
    let importError = null;
    try {
      importState = await window.HirelyParse.handleFileImport(file, 'test-ocr-quality');
    } catch (e) {
      importError = String(e?.message || e);
      importState = 'error';
    }
    const lr = window.HirelyParse?.lastResult || {};
    const state = window.__hirelyState || {};
    const enterprise = lr.enterprise || state.lastEnterprise || null;
    const pdfMeta = enterprise?.pdfExtraction || lr.pdfExtraction || {};
    const rotation =
      window.HirelyCore?.peekLastOcrRotationDecision?.() ||
      lr.ocrRotation ||
      null;
    const ocrText = String(
      enterprise?.rawExtraction || lr.rawText || state.rawText || lr.cleanedText || ''
    ).trim();
    const rd = lr.resumeData || state.resumeData || null;
    const rotationTrials = pdfMeta.ocrRotationTrials || rotation?.trials || [];
    const chosenRotation =
      pdfMeta.ocrRotation ?? rotation?.chosenRotation ?? null;
    const ocrStatus = pdfMeta.ocrStatus || null;
    return {
      importState,
      importError,
      ocrText,
      ocrTextLen: ocrText.length,
      ocrStatus,
      chosenRotation,
      rotationTrials,
      ocrQualityScore: pdfMeta.ocrQualityScore ?? null,
      resumeData: !!rd,
      pasteFallback: !!document.getElementById('importPasteFallback')?.classList.contains('show'),
      cvLive: !!document.getElementById('cvDoc')?.classList.contains('cv--live'),
      expCount: (rd?.experiences || []).length,
    };
  },
  { b64: pdfBuf.toString('base64'), name: path.basename(pdfPath) }
);

await page.waitForTimeout(1500);
await browser.close();
server.close();

const gibberishHits = countGibberishMarkers(result.ocrText);
const readableHits = READABLE_MARKERS.filter((m) =>
  result.ocrText.toUpperCase().includes(m.toUpperCase())
);
const mostlyGibberish = isMostlyGibberishOcr(result.ocrText);
const gate = evaluateOcrParserGate(result.ocrText);
const acceptedByParser = result.resumeData && !result.pasteFallback;
const ocrStatus =
  result.ocrStatus ||
  resolveOcrQualityStatus({
    text: result.ocrText,
    gatePass: gate.pass,
    chosenRotation: result.chosenRotation,
    acceptedByParser,
  });

const report = {
  pdf: pdfPath,
  at: new Date().toISOString(),
  ocrStatus,
  mostlyGibberish,
  gibberishHits,
  readableHits,
  gatePass: gate.pass,
  gateScore: gate.qualityScore,
  acceptedByParser,
  ...result,
  consoleSnippet: consoleLines
    .filter((t) => /OCR_|OCR_ROTATION|quality|GATE/i.test(t))
    .slice(0, 60),
};

fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));

console.log('\nOCR status:', ocrStatus);
console.log('Chosen rotation:', result.chosenRotation);
console.log('Gibberish hits:', gibberishHits.join(', ') || '(none)');
console.log('Readable hits:', readableHits.slice(0, 6).join(', '));

if (ocrStatus === OCR_STATUS.FAILED_LOW_QUALITY) {
  ok(mostlyGibberish || gibberishHits.length > 0 || !gate.pass, 'bad OCR detected');
  ok(!acceptedByParser, 'bad OCR not accepted by parser (no resumeData)');
  ok(!result.cvLive || result.pasteFallback, 'no live fake CV on bad OCR');
  ok(
    result.importState === 'IMPORT_NEEDS_PASTE' ||
      result.pasteFallback ||
      !result.resumeData,
    'import needs paste fallback on bad OCR'
  );
} else if (ocrStatus === OCR_STATUS.OK) {
  ok(result.chosenRotation != null, `chosenRotation set (${result.chosenRotation}°)`);
  ok(gibberishHits.length === 0, 'no gibberish markers in accepted OCR');
  ok(!mostlyGibberish, 'OCR text is not mostly gibberish');
  ok(gate.pass, `parser gate pass (score ${gate.qualityScore})`);
  ok(readableHits.length >= 4, `readable CV markers (${readableHits.length})`);
  ok(
    (result.rotationTrials?.length ?? 0) > 0,
    `rotation trials recorded (${result.rotationTrials?.length ?? 0})`
  );
} else {
  ok(false, `unexpected ocrStatus: ${ocrStatus}`);
}

console.log('\nRotation trials:');
for (const t of result.rotationTrials || []) {
  const trialGibberish = countGibberishMarkers(
    (t.topWords || []).join(' ')
  ).length;
  console.log(
    `  ${t.rotation}° score=${t.qualityScore} chars=${t.charCount} gibberishTop=${trialGibberish}`
  );
}

// Every rotation trial with gibberish markers must score below acceptance
for (const trial of result.rotationTrials || []) {
  const trialText = (trial.topWords || []).join(' ');
  if (countGibberishMarkers(trialText).length > 0) {
    ok(
      trial.qualityScore < 42 || trial.rotation !== result.chosenRotation,
      `gibberish rotation ${trial.rotation}° not chosen (score ${trial.qualityScore})`
    );
  }
}

console.log('\nReport:', path.join(outDir, 'report.json'));
if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log('\nOCR regression OK');
