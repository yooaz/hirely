#!/usr/bin/env node
/**
 * Live UI upload path — multi-fixture corpus via handleFileImport (browser).
 * node src/tests/qa-live-upload-path-corpus.mjs
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
} from './lib/live-upload-path-harness.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');
const outDir = path.join(root, 'tests/output/live-upload-path-corpus');
fs.mkdirSync(outDir, { recursive: true });

const PDF_CANDIDATES = [
  process.env.HIRELY_YOAZ_PDF,
  path.join(root, 'tests/fixtures/yoaz-pdf-benchmark/document.pdf'),
  '/Users/yohannazancot/Documents/cv/cv2022 yohann azancot copie.pdf',
].filter(Boolean);

function resolveYoazPdf() {
  for (const p of PDF_CANDIDATES) {
    if (p && fs.existsSync(p)) return p;
  }
  return null;
}

const TXT_CASES = [
  {
    id: 'developer-cv',
    file: path.join(root, 'tests/fixtures/developer-cv/fixture.txt'),
    expect: { name: /alex chen/i, expMin: 2, eduMin: 1 },
    portfolioMarkers: [],
    requireSpatialBridge: false,
    mode: 'preview',
  },
  {
    id: 'student-cv',
    file: path.join(root, 'tests/fixtures/student-cv/fixture.txt'),
    expect: { name: /emma johnson/i, expMin: 1, eduMin: 0 },
    portfolioMarkers: [],
    requireSpatialBridge: false,
    mode: 'preview',
  },
  {
    id: 'consultant-cv',
    file: path.join(root, 'tests/fixtures/consultant-cv/fixture.txt'),
    expect: { name: /sophie martin/i, expMin: 2, eduMin: 0 },
    portfolioMarkers: [],
    requireSpatialBridge: false,
    mode: 'preview',
  },
  {
    id: 'two-column-cv',
    file: path.join(root, 'tests/fixtures/two-column-cv/fixture.txt'),
    expect: { name: /marie dupont/i, expMin: 2, eduMin: 0 },
    portfolioMarkers: [],
    requireSpatialBridge: false,
    mode: 'preview',
  },
  {
    id: 'marketing-cv',
    file: path.join(root, 'tests/fixtures/marketing-cv/fixture.txt'),
    expect: { name: /laura bennett/i, expMin: 2, eduMin: 0 },
    portfolioMarkers: [],
    requireSpatialBridge: false,
    mode: 'preview',
  },
];

const CORPUS_CASES = [];
const yoazPdf = resolveYoazPdf();
if (yoazPdf) {
  CORPUS_CASES.push({
    id: 'yoaz-pdf-live',
    file: yoazPdf,
    expect: { name: /yohann\s+azancot/i, expMin: 3, eduMin: 2 },
    portfolioMarkers: [
      'sunglass',
      'cubist art',
      'god of war',
      'fortune 500',
      'metro display',
      'personal project',
      'adidas creation',
    ],
    requireSpatialBridge: true,
    mode: 'structured',
  });
}
CORPUS_CASES.push(...TXT_CASES);

let failed = 0;
const results = [];

const port = 3070 + Math.floor(Math.random() * 30);
const server = await startStaticServer(root, port);
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.setDefaultTimeout(360000);

try {
  await page.goto(`http://127.0.0.1:${port}/?pro=true`, {
    waitUntil: 'domcontentloaded',
    timeout: 120000,
  });
  await page.waitForFunction(
    () => typeof window.HirelyParse?.handleFileImport === 'function',
    { timeout: 180000 }
  );

  for (const tc of CORPUS_CASES) {
    if (!fs.existsSync(tc.file)) {
      console.error('SKIP missing file', tc.id, tc.file);
      results.push({ id: tc.id, pass: false, skipped: true, reason: 'missing file' });
      failed++;
      continue;
    }

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
    });

    console.log(`\n--- ${tc.id} ---`);
    await browserImportFile(page, tc.file, `live-corpus:${tc.id}`);
    await waitImportDone(page);
    await page.waitForTimeout(1200);

    const snap = await collectLiveSnap(page);
    const criteria = assertLiveUploadCriteria(snap, {
      portfolioMarkers: tc.portfolioMarkers,
      requireSpatialBridge: tc.requireSpatialBridge,
      mode: tc.mode || 'structured',
    });

    const name = snap.identity?.name || snap.cvText.split('\n')[0] || '';
    const extra = [];
    if (tc.expect.name && !tc.expect.name.test(name) && !tc.expect.name.test(snap.cvText)) {
      extra.push(`expected name ${tc.expect.name}, got "${name}"`);
    }
    if (tc.mode === 'structured') {
      if (snap.counts.experiences < tc.expect.expMin) {
        extra.push(`experiences ${snap.counts.experiences} < ${tc.expect.expMin}`);
      }
      if (snap.counts.education < tc.expect.eduMin) {
        extra.push(`education ${snap.counts.education} < ${tc.expect.eduMin}`);
      }
    }

    const allFailures = [...criteria.failures, ...extra];
    const pass = criteria.pass && extra.length === 0;
    if (!pass) {
      failed++;
      for (const f of allFailures) console.error('FAIL', tc.id, f);
    } else {
      console.log('OK', tc.id, 'live upload criteria pass');
    }

    results.push({
      id: tc.id,
      file: tc.file,
      pass,
      failures: allFailures,
      snap: {
        identity: snap.identity,
        counts: snap.counts,
        import_path_winner: snap.importDebug?.import_path_winner,
        cvText_head: (snap.cvText || '').slice(0, 400),
        education: snap.education,
      },
    });
  }

  const report = {
    timestamp: new Date().toISOString(),
    total: results.length,
    passed: results.filter((r) => r.pass).length,
    failed: results.filter((r) => !r.pass).length,
    results,
  };
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
  console.log('\nReport:', path.join(outDir, 'report.json'));
} finally {
  await browser.close();
  server.close();
}

process.exit(failed ? 1 : 0);
