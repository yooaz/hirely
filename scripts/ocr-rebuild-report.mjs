#!/usr/bin/env node
/**
 * P0 — OCR rebuild audit: local assets, worker/WASM paths, CSP, timeouts, load time, failure rate.
 * Generates OCR_REBUILD_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import http from 'http';
import { spawn, spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import {
  TESSERACT_VENDOR_PATHS,
  TESSERACT_REQUIRED_ASSETS,
  getLocalTesseractOptions,
} from '../src/vendor/tesseract-runtime.js';
import {
  PDF_EXTRACTION_MAX_MS,
  OCR_UX_EARLY_PASTE_MS,
} from '../src/core/extraction/pdf-extraction-timeout.js';
import {
  OCR_ABSOLUTE_MAX_MS,
  OCR_UI_SOFT_TIMEOUT_MS,
} from '../src/core/extraction/pdf-ocr-run.js';
import { OCR_QUALITY_MIN_PASS } from '../src/core/extraction/ocr-quality-score.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT_MD = path.join(ROOT, 'OCR_REBUILD_REPORT.md');
const OUT_JSON = path.join(ROOT, 'tests/output/ocr-rebuild/report.json');
const VENDOR_ROOT = path.join(ROOT, 'vendor', 'tesseract');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function runNode(script) {
  const res = spawnSync('node', [script], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 80 * 1024 * 1024,
    timeout: 180000,
  });
  return { ok: res.status === 0, out: `${res.stdout || ''}\n${res.stderr || ''}`.trim() };
}

function ensureVendor() {
  const missing = TESSERACT_REQUIRED_ASSETS.filter(
    (p) => !fs.existsSync(path.join(ROOT, p.replace(/^\//, '')))
  );
  if (!missing.length) return { ok: true, missing: [] };
  const res = spawnSync('node', ['scripts/setup-vendor-tesseract.mjs'], {
    cwd: ROOT,
    stdio: 'inherit',
    timeout: 300000,
  });
  const stillMissing = TESSERACT_REQUIRED_ASSETS.filter(
    (p) => !fs.existsSync(path.join(ROOT, p.replace(/^\//, '')))
  );
  return { ok: res.status === 0 && stillMissing.length === 0, missing: stillMissing };
}

function mime(fp) {
  const ext = path.extname(fp).toLowerCase();
  return (
    {
      '.html': 'text/html; charset=utf-8',
      '.js': 'text/javascript; charset=utf-8',
      '.mjs': 'text/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.wasm': 'application/wasm',
      '.gz': 'application/gzip',
    }[ext] || 'application/octet-stream'
  );
}

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url || '/', 'http://127.0.0.1');
      let fp = path.join(ROOT, decodeURIComponent(url.pathname));
      if (fp.endsWith('/')) fp = path.join(fp, 'index.html');
      if (!fp.startsWith(ROOT)) {
        res.writeHead(403);
        res.end();
        return;
      }
      fs.readFile(fp, (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end('Not found');
          return;
        }
        res.writeHead(200, { 'Content-Type': mime(fp) });
        res.end(data);
      });
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function loadBenchmarkFailureRate() {
  const paths = [
    'tests/output/real-format-qa/report.json',
    'tests/output/real-cv-benchmark-pack/report.json',
    'tests/output/scanned-pdf-master/report.json',
  ];
  for (const rel of paths) {
    const fp = path.join(ROOT, rel);
    if (!fs.existsSync(fp)) continue;
    try {
      const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
      const byOutcome = data.byOutcome || data.outcomes || {};
      const needsPaste = Number(byOutcome.IMPORT_NEEDS_PASTE || data.needsPaste || 0);
      const ready = Number(byOutcome.IMPORT_READY || data.importReady || 0);
      const total = needsPaste + ready + Number(byOutcome.IMPORT_FAILED || 0);
      if (total > 0) {
        return {
          source: rel,
          total,
          needsPaste,
          ready,
          failureRatePct: Math.round((needsPaste / total) * 1000) / 10,
          generatedAt: data.generatedAt || null,
        };
      }
    } catch {
      /* next */
    }
  }
  return null;
}

async function probeBrowserLoadTime() {
  const server = await startServer();
  const port = server.address().port;
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const cdnRequests = [];
  const localRequests = [];
  const timings = {};

  page.on('request', (req) => {
    const url = req.url();
    if (/jsdelivr|unpkg\.com|cdnjs/i.test(url)) cdnRequests.push(url);
    if (/vendor\/tesseract/i.test(url)) localRequests.push(url);
  });

  const t0 = Date.now();
  await page.goto(`http://127.0.0.1:${port}/index.html`, {
    waitUntil: 'domcontentloaded',
    timeout: 120000,
  });
  timings.pageDomMs = Date.now() - t0;

  await page.waitForFunction(() => window.HirelyLazy?.ensureTesseract, null, { timeout: 60000 });

  const probe = await page.evaluate(async () => {
    const opts = {
      workerPath: '/vendor/tesseract/worker.min.js',
      corePath: '/vendor/tesseract/core',
      langPath: '/vendor/tesseract/lang',
      workerBlobURL: false,
      gzip: true,
      logger: () => {},
    };
    const out = {
      scriptLoadMs: 0,
      recognizeMs: 0,
      text: '',
      error: null,
      workerPath: opts.workerPath,
      corePath: opts.corePath,
      langPath: opts.langPath,
      langs: 'fra+eng',
    };
    const tScript = performance.now();
    try {
      await window.HirelyLazy.ensureTesseract();
      out.scriptLoadMs = Math.round(performance.now() - tScript);
      const canvas = document.createElement('canvas');
      canvas.width = 200;
      canvas.height = 60;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, 200, 60);
      ctx.fillStyle = '#000';
      ctx.font = '18px sans-serif';
      ctx.fillText('Hirely OCR Test', 10, 36);
      const tRec = performance.now();
      const { data } = await window.Tesseract.recognize(canvas, 'eng', opts);
      out.recognizeMs = Math.round(performance.now() - tRec);
      out.text = String(data?.text || '').trim();
    } catch (e) {
      out.error = e?.message || String(e);
    }
    return out;
  });

  timings.totalProbeMs = Date.now() - t0;
  await browser.close();
  server.close();

  return {
    cdnRequestCount: cdnRequests.length,
    cdnRequests,
    localRequestCount: localRequests.length,
    localRequestsSample: [...new Set(localRequests.map((u) => new URL(u).pathname))].slice(0, 12),
    probe,
    timings,
    pass:
      cdnRequests.length === 0 &&
      !probe.error &&
      probe.text.length > 0 &&
      localRequests.some((u) => /worker\.min\.js/.test(u)),
  };
}

async function main() {
  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });

  const vendor = ensureVendor();
  const staticQa = runNode('src/tests/qa-ocr-reliability-audit.mjs');
  const auditJsonPath = path.join(ROOT, 'tests/output/ocr-reliability-audit/report.json');
  const auditJson = fs.existsSync(auditJsonPath)
    ? JSON.parse(fs.readFileSync(auditJsonPath, 'utf8'))
    : null;

  let browserProbe = null;
  try {
    browserProbe = await probeBrowserLoadTime();
  } catch (err) {
    browserProbe = { pass: false, error: err?.message || String(err) };
  }

  const manifest = fs.existsSync(path.join(VENDOR_ROOT, 'manifest.json'))
    ? JSON.parse(fs.readFileSync(path.join(VENDOR_ROOT, 'manifest.json'), 'utf8'))
    : null;
  const opts = getLocalTesseractOptions();
  const csp =
    read('index.html').match(/Content-Security-Policy[^>]+content="([^"]+)"/i)?.[1] || '';
  const failureBench = loadBenchmarkFailureRate();

  const assets = TESSERACT_REQUIRED_ASSETS.map((p) => {
    const fp = path.join(ROOT, p.replace(/^\//, ''));
    return {
      path: p,
      exists: fs.existsSync(fp),
      size: fs.existsSync(fp) ? fs.statSync(fp).size : 0,
      source:
        p.includes('/lang/')
          ? 'setup-vendor-tesseract (build-time download → vendored)'
          : p.includes('/core/')
            ? 'node_modules/tesseract.js-core (copied)'
            : 'node_modules/tesseract.js/dist (copied)',
    };
  });

  const payload = {
    version: 'OCR_REBUILD_V1',
    generatedAt: new Date().toISOString(),
    vendorOk: vendor.ok,
    staticQaPass: staticQa.ok,
    browserProbePass: browserProbe?.pass === true,
    workerSource: opts.workerPath,
    wasmSources: [
      `${opts.corePath}/tesseract-core-simd-lstm.wasm`,
      `${opts.corePath}/tesseract-core-lstm.wasm`,
    ],
    langPacks: ['fra.traineddata.gz', 'eng.traineddata.gz'],
    langPath: opts.langPath,
    loadTimeMs: {
      pageDom: browserProbe?.timings?.pageDomMs ?? null,
      tesseractScript: browserProbe?.probe?.scriptLoadMs ?? null,
      firstRecognize: browserProbe?.probe?.recognizeMs ?? null,
      totalProbe: browserProbe?.timings?.totalProbeMs ?? null,
    },
    failureRate: failureBench,
    cdnRequestsAtRuntime: browserProbe?.cdnRequestCount ?? null,
    localTesseractRequests: browserProbe?.localRequestCount ?? null,
    thresholds: {
      PDF_EXTRACTION_MAX_MS,
      OCR_ABSOLUTE_MAX_MS,
      OCR_UI_SOFT_TIMEOUT_MS,
      OCR_UX_EARLY_PASTE_MS,
      OCR_QUALITY_MIN_PASS,
    },
    assets,
    manifest,
  };

  fs.writeFileSync(OUT_JSON, JSON.stringify(payload, null, 2));

  const pass =
    vendor.ok &&
    staticQa.ok &&
    browserProbe?.pass === true &&
    (browserProbe?.cdnRequestCount ?? 0) === 0;

  const lines = [
    '# OCR_REBUILD_REPORT',
    '',
    `**Status:** ${pass ? 'PASS' : 'FAIL'}`,
    `**Audit:** \`OCR_REBUILD_V1\``,
    `**Generated:** ${payload.generatedAt}`,
    '',
    '## Executive summary',
    '',
    '| Requirement | Status |',
    '|-------------|--------|',
    `| Local Tesseract assets | ${vendor.ok ? '✓' : '✗'} ${vendor.missing.length ? vendor.missing.join(', ') : 'all present'} |`,
    `| No CDN at runtime | ${(browserProbe?.cdnRequestCount ?? 0) === 0 ? '✓' : `✗ ${browserProbe?.cdnRequestCount} CDN hits`} |`,
    `| No remote worker | ${browserProbe?.pass ? '✓ same-origin worker' : '✗'} |`,
    `| No fake OCR success | ${staticQa.ok ? '✓ OCR_EMPTY + quality gate' : '✗'} |`,
    `| OCR fail → IMPORT_NEEDS_PASTE | ${staticQa.ok ? '✓' : '✗'} |`,
    '',
    '**Policy:** Missing paste prompt is honest. Empty OCR never becomes \`IMPORT_READY\`.',
    '',
    '## Worker & WASM sources',
    '',
    '| Component | Source | Path |',
    '|-----------|--------|------|',
    `| Main script | \`node_modules/tesseract.js/dist\` → vendored | \`${TESSERACT_VENDOR_PATHS.main}\` |`,
    `| Worker | \`node_modules/tesseract.js/dist/worker.min.js\` → vendored | \`${opts.workerPath}\` |`,
    `| WASM loader (SIMD) | \`tesseract.js-core\` → vendored | \`${opts.corePath}/tesseract-core-simd-lstm.wasm.js\` |`,
    `| WASM binary (SIMD) | \`tesseract.js-core\` → vendored | \`${opts.corePath}/tesseract-core-simd-lstm.wasm\` |`,
    `| WASM loader (fallback) | \`tesseract.js-core\` → vendored | \`${opts.corePath}/tesseract-core-lstm.wasm.js\` |`,
    `| WASM binary (fallback) | \`tesseract.js-core\` → vendored | \`${opts.corePath}/tesseract-core-lstm.wasm\` |`,
    `| Language packs | build-time fetch → vendored | \`${opts.langPath}/fra.traineddata.gz\`, \`eng.traineddata.gz\` |`,
    '',
    'Runtime loader: `src/vendor/csp-safe-loader.js` → `ensureTesseract()` → `getLocalTesseractOptions()` with `workerBlobURL: false`.',
    '',
    '## Load time (browser probe)',
    '',
    '| Phase | ms |',
    '|-------|---:|',
    `| Page DOM ready | ${payload.loadTimeMs.pageDom ?? '—'} |`,
    `| Tesseract script + asset verify | ${payload.loadTimeMs.tesseractScript ?? '—'} |`,
    `| First \`recognize()\` (eng, 200×60 canvas) | ${payload.loadTimeMs.firstRecognize ?? '—'} |`,
    `| Total probe | ${payload.loadTimeMs.totalProbe ?? '—'} |`,
    '',
    browserProbe?.probe?.text
      ? `Probe OCR text: \`${browserProbe.probe.text.replace(/`/g, "'")}\``
      : browserProbe?.probe?.error
        ? `Probe error: \`${browserProbe.probe.error}\``
        : '*(browser probe not run)*',
    '',
    'Local requests during probe:',
    ...(browserProbe?.localRequestsSample?.length
      ? browserProbe.localRequestsSample.map((p) => `- \`${p}\``)
      : ['- *(none)*']),
    '',
    '## Failure rate (benchmark snapshot)',
    '',
    failureBench
      ? [
          `Source: \`${failureBench.source}\` (${failureBench.generatedAt || 'unknown date'})`,
          '',
          '| Metric | Value |',
          '|--------|------:|',
          `| Total cases | ${failureBench.total} |`,
          `| IMPORT_READY | ${failureBench.ready} |`,
          `| IMPORT_NEEDS_PASTE | ${failureBench.needsPaste} |`,
          `| Paste fallback rate | **${failureBench.failureRatePct}%** |`,
          '',
          'Note: \`IMPORT_NEEDS_PASTE\` is an honest outcome (scanned PDF, OCR timeout, quality fail) — not a crash.',
        ].join('\n')
      : 'No benchmark JSON found — run `npm run qa:real-format-qa` for live failure-rate stats.',
    '',
    '## CSP rules',
    '',
    '```',
    csp,
    '```',
    '',
    '| Rule | Purpose |',
    '|------|---------|',
    '| `worker-src \'self\' blob:` | Local Tesseract worker only |',
    '| `script-src ... wasm-unsafe-eval` | WASM OCR core (no broad `unsafe-eval`) |',
    '| `connect-src \'self\' blob: data:` | No remote OCR API in browser path |',
    '',
    '## Timeout handling',
    '',
    '| Constant | Value | Behavior |',
    '|----------|------:|----------|',
    `| \`PDF_EXTRACTION_MAX_MS\` | ${PDF_EXTRACTION_MAX_MS} | Hard PDF/OCR budget |`,
    `| \`OCR_ABSOLUTE_MAX_MS\` | ${OCR_ABSOLUTE_MAX_MS} | Absolute OCR race cap |`,
    `| \`OCR_UI_SOFT_TIMEOUT_MS\` | ${OCR_UI_SOFT_TIMEOUT_MS} | Early paste hint |`,
    `| \`OCR_UX_EARLY_PASTE_MS\` | ${OCR_UX_EARLY_PASTE_MS} | UX soft message |`,
    `| \`OCR_QUALITY_MIN_PASS\` | ${OCR_QUALITY_MIN_PASS} | Parser gate min score |`,
    '',
    'On timeout/empty/quality fail: `OCR_EMPTY` / `OCR_QUALITY_FAILED` → `IMPORT_NEEDS_PASTE` with user copy from `import-fallback-ux.js`.',
    '',
    '## IMPORT_NEEDS_PASTE explanations',
    '',
    '| Trigger | User message (FR) |',
    '|---------|-------------------|',
    '| OCR assets missing | La lecture OCR locale est indisponible — collez le texte du CV pour continuer. |',
    '| Scanned / quality fail | Le document semble scanné, protégé ou illisible. |',
    '| Timeout | La lecture automatique a pris trop de temps — collez le texte du CV pour continuer. |',
    '| Thin text | Le contenu extrait est insuffisant pour continuer. |',
    '',
    'Lead copy: **Lecture incomplète. Collez le texte du CV pour continuer.**',
    '',
    '## Vendored assets',
    '',
    '| Asset | Size | Source |',
    '|-------|-----:|--------|',
    ...assets.map(
      (a) =>
        `| \`${a.path}\` | ${a.exists ? a.size.toLocaleString() : 'MISSING'} | ${a.source} |`
    ),
    '',
    manifest
      ? `Tesseract npm **${manifest.package}** / core **${manifest.core}** (\`${manifest.version}\`)`
      : '',
    '',
    '## No fake OCR success',
    '',
    '- `hasValidOcrResult()` guard in `pdf-ocr-run.js`',
    '- Throws `OCR_EMPTY` when text/lines invalid',
    '- `evaluateOcrParserGate()` before parser',
    '- `buildOcrParserBlockedResult()` → `IMPORT_NEEDS_PASTE`',
    '- Empty gate score fails (`evaluateOcrParserGate(\'\')`)',
    '',
    '## Architecture',
    '',
    '```mermaid',
    'flowchart TD',
    '  A[Upload PDF/Image] --> B{Native text usable?}',
    '  B -->|yes| C[Native path]',
    '  B -->|no| D[verifyTesseractVendorAssets]',
    '  D -->|fail| E[OCR_ASSETS_MISSING → IMPORT_NEEDS_PASTE]',
    '  D -->|ok| F[/vendor/tesseract/worker.min.js]',
    '  F --> G[WASM core + fra+eng traineddata]',
    '  G --> H[OCR passes ≤20s]',
    '  H --> I{evaluateOcrParserGate}',
    '  I -->|pass| J[Parser]',
    '  I -->|fail| K[IMPORT_NEEDS_PASTE + scanned copy]',
    '  H -->|empty| L[OCR_EMPTY → IMPORT_NEEDS_PASTE]',
    '```',
    '',
    '## Static QA',
    '',
    `Result: **${staticQa.ok ? 'PASS' : 'FAIL'}** (\`qa:ocr-reliability-audit\`)`,
    '',
    auditJson
      ? `Checks: ${auditJson.checks.filter((c) => c.pass).length}/${auditJson.checks.length}`
      : '',
    '',
    '## Verification',
    '',
    '```bash',
    'npm run setup:vendor-tesseract',
    'npm run qa:ocr-reliability-audit',
    'npm run ocr-rebuild-report',
    'npm run local-ocr-csp-fix-report   # browser CSP + 0 CDN',
    '```',
    '',
    '## Related',
    '',
    '- `OCR_RELIABILITY_AUDIT_REPORT.md`',
    '- `LOCAL_OCR_CSP_FIX_REPORT.md`',
    '- `src/vendor/tesseract-runtime.js`',
    '',
  ];

  fs.writeFileSync(OUT_MD, lines.join('\n'));
  console.log(`Wrote ${OUT_MD}`);
  console.log(`Static QA: ${staticQa.ok ? 'PASS' : 'FAIL'}`);
  console.log(`Browser probe: ${browserProbe?.pass ? 'PASS' : 'FAIL'}`);
  if (failureBench) {
    console.log(`Failure rate: ${failureBench.failureRatePct}% needs paste (${failureBench.source})`);
  }
  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
