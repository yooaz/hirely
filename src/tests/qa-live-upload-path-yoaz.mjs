#!/usr/bin/env node
/**
 * Live UI import path proof: index.html → handleFileImport → resumeData → cvDoc.
 * node src/tests/qa-live-upload-path-yoaz.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import {
  startStaticServer,
  waitImportDone,
  browserImportFile,
  collectLiveSnap,
  assertLiveUploadCriteria,
  educationDuplicateCount,
} from './lib/live-upload-path-harness.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');
const outDir = path.join(root, 'tests/output/live-upload-path-yoaz');
fs.mkdirSync(outDir, { recursive: true });

const PDF_CANDIDATES = [
  process.env.HIRELY_YOAZ_PDF,
  path.join(root, 'tests/fixtures/yoaz-pdf-benchmark/document.pdf'),
  '/Users/yohannazancot/Documents/cv/cv2022 yohann azancot copie.pdf',
  '/Users/yohannazancot/ART_ARCHIVE/PSD/cv2022 yohann azancot copie.pdf',
].filter(Boolean);

function resolvePdf() {
  for (const p of PDF_CANDIDATES) {
    if (p && fs.existsSync(p)) return p;
  }
  return null;
}

const PORTFOLIO_MARKERS = [
  'sunglass',
  'cubist art',
  'god of war',
  'fortune 500',
  'metro display',
  'personal project',
  'adidas creation',
];

const pdfPath = resolvePdf();
if (!pdfPath) {
  console.error('Yoaz PDF not found — set HIRELY_YOAZ_PDF');
  process.exit(1);
}

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

const port = 3060 + Math.floor(Math.random() * 40);
const server = await startStaticServer(root, port);
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.setDefaultTimeout(360000);

const consoleLines = [];
page.on('console', (msg) => {
  const text = msg.text();
  consoleLines.push(text);
  if (/IMPORT_|OCR_|EXTRACTION_|PARSER_|RENDER_|BROWSER_RESUMEDATA|CORE_BOOT/i.test(text)) {
    console.log('[browser]', text);
  }
});

try {
  await page.goto(`http://127.0.0.1:${port}/?pro=true`, {
    waitUntil: 'domcontentloaded',
    timeout: 120000,
  });
  await page.waitForFunction(
    () => typeof window.HirelyParse?.handleFileImport === 'function',
    { timeout: 180000 }
  );
  await page.evaluate(() => {
    if (typeof window.HirelyCore?.clearPdfOcrCache === 'function') {
      window.HirelyCore.clearPdfOcrCache();
    }
    globalThis.HIRELY_PDF_EXTRACTION_MAX_MS = 90000;
    globalThis.HIRELY_PDF_OCR_PER_PAGE_MS = 35000;
    globalThis.HIRELY_PDF_EXTRACTION_HARD_CAP_MS = 120000;
  });

  await browserImportFile(page, pdfPath, 'live-upload-path-yoaz');
  await waitImportDone(page);
  await page.waitForTimeout(1500);

  const snap = await collectLiveSnap(page);
  const boot = await page.evaluate(() => ({
    boot: window.__HIRELY_CORE_BOOT__,
    tier: window.__HIRELY_CORE_BOOT_ASSESSMENT__?.tier,
    missingOptional: window.__HIRELY_CORE_BOOT_ASSESSMENT__?.missingOptional || [],
    spatialBlocks: window.__hirelyState?.lastEnterpriseExtraction?.spatialBlocks?.length || 0,
  }));

  const criteria = assertLiveUploadCriteria(snap, {
    portfolioMarkers: PORTFOLIO_MARKERS,
    requireSpatialBridge: !snap.correctionState,
  });
  for (const f of criteria.failures) ok(false, f);
  if (criteria.pass) ok(true, 'all universal live-upload criteria');

  ok(
    snap.extractionRuntime?.pageRuntimeTrace?.length > 0 ||
      snap.extractionRuntime?.extractionDebug?.pageRuntimeTrace?.length > 0 ||
      snap.extractionRuntime?.method,
    'extraction runtime persisted'
  );
  ok(
    snap.correctionState ||
      !/nom à vérifier/i.test(snap.cvText) ||
      /yohann\s+azancot/i.test(snap.identity?.name || ''),
    'safe preview: correction state or valid identity (not placeholder blob)'
  );

  ok(boot.boot === 'ok' || boot.boot === 'degraded', `core boot loaded (${boot.boot})`);
  ok(/yohann\s+azancot/i.test(snap.identity?.name || ''), `identity.name (${snap.identity?.name})`);
  ok(/yoaz@hotmail\.fr/i.test(snap.identity?.email || ''), `email (${snap.identity?.email})`);

  const eduPollution = [/yoaz27/i, /\+33649434839\s+2011/i, /ignfin hie/i, /tumblr\.com/i];
  for (const re of eduPollution) {
    ok(!re.test(snap.cvText || ''), `no OCR pollution in cvDoc: ${re}`);
  }
  ok(educationDuplicateCount(snap.education) === 0, `education deduped (dup=${educationDuplicateCount(snap.education)})`);

  const beforePath = path.join(outDir, 'before-fix-snapshot.json');
  const before = fs.existsSync(beforePath) ? JSON.parse(fs.readFileSync(beforePath, 'utf8')) : null;

  const report = {
    pdf: pdfPath,
    timestamp: new Date().toISOString(),
    path: 'index.html → HirelyParse.handleFileImport → canonicalImportFromFile → commitResumeData → renderCV',
    snap,
    boot,
    criteria,
    extractionRuntime: snap.extractionRuntime,
    before_after: before
      ? {
          before: {
            education_count: before.snap?.counts?.education,
            cvText_excerpt: before.snap?.cvText_excerpt,
            criteria_failures: before.criteria_failures,
          },
          after: {
            education_count: snap.counts.education,
            education: snap.education,
            cvText: snap.cvText,
            import_path_winner: snap.importDebug?.import_path_winner,
          },
        }
      : null,
    consoleHasParserDone: consoleLines.some((t) => /PARSER_DONE/i.test(t)),
    consoleHasRenderDone: consoleLines.some((t) => /RENDER_DONE/i.test(t)),
  };
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
  await page.screenshot({ path: path.join(outDir, 'after-import.png'), fullPage: false });

  console.log('\nReport:', path.join(outDir, 'report.json'));
} finally {
  await browser.close();
  server.close();
}

process.exit(failed ? 1 : 0);
