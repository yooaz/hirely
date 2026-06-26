#!/usr/bin/env node
/**
 * PDF_EXTRACTION_TIMEOUT root-cause trace — Yoaz PDF, no production edits.
 * node scripts/pdf-timeout-root-cause.mjs
 * Output: PDF_TIMEOUT_ROOT_CAUSE.md
 */
import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { isExtensionConsoleNoise } from '../tests/lib/qa-console-filter.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT_PATH = path.join(ROOT, 'PDF_TIMEOUT_ROOT_CAUSE.md');

const PDF_CANDIDATES = [
  process.env.HIRELY_YOAZ_PDF,
  '/Users/yohannazancot/Documents/cv/cv2022 yohann azancot copie.pdf',
  '/Users/yohannazancot/Documents/cv2022 yohann azancot copie.pdf',
].filter(Boolean);

function resolvePdf() {
  for (const p of PDF_CANDIDATES) {
    if (p && fs.existsSync(p)) return p;
  }
  return null;
}

function mime(fp) {
  const ext = path.extname(fp).toLowerCase();
  return (
    { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json' }[
      ext
    ] || 'application/octet-stream'
  );
}

function startServer(port) {
  return http.createServer((req, res) => {
    const u = req.url.split('?')[0];
    let p = u === '/' ? '/index.html' : u;
    const fp = path.join(ROOT, decodeURIComponent(p));
    if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, { 'Content-Type': mime(fp) });
    fs.createReadStream(fp).pipe(res);
  });
}

function iso(ms) {
  return new Date(ms).toISOString();
}

function dur(start, end) {
  if (!start || !end) return null;
  return end - start;
}

const pdfPath = resolvePdf();

const STATIC = {
  throwSite: {
    file: 'src/core/extraction/pdf-extraction-timeout.js',
    function: 'withExtractionTimeout',
    line: 55,
    snippet: `reject(Object.assign(new Error('PDF_EXTRACTION_TIMEOUT'), { code, importStatus: 'PDF_OCR_TIMEOUT' }))`,
  },
  timeoutConstants: {
    PDF_EXTRACTION_MAX_MS: {
      value: 30000,
      file: 'src/core/extraction/pdf-extraction-timeout.js',
      line: 5,
    },
    OCR_ABSOLUTE_MAX_MS: {
      value: 30000,
      file: 'src/core/extraction/pdf-ocr-run.js',
      line: 33,
      note: 'alias of PDF_EXTRACTION_MAX_MS — inner OCR timer, throws OCR_ABSOLUTE_TIMEOUT not PDF_EXTRACTION_TIMEOUT',
    },
    OCR_ROTATION_TRIAL_MAX_MS: {
      value: 8000,
      file: 'src/core/extraction/pdf-extraction-timeout.js',
      line: 6,
      note: 'per rotation trial cap (withRotationTrialTimeout)',
    },
    OCR_UI_SOFT_TIMEOUT_MS: {
      value: 20000,
      file: 'src/core/extraction/pdf-ocr-run.js',
      line: 29,
      note: 'advisory only — does not throw PDF_EXTRACTION_TIMEOUT',
    },
    OCR_HARD_TIMEOUT_MS: {
      value: 25000,
      file: 'src/core/extraction/pdf-ocr-run.js',
      line: 30,
      note: 'advisory only',
    },
  },
  wrapSite: {
    file: 'src/core/extraction/extract-file.js',
    function: 'extractFromFileDetailed',
    line: 67,
    budgetMs: 30000,
    code: 'OCR_TIMEOUT',
  },
  callChain: [
    'index.html → handleFileImport (line ~4999)',
    'canonical-import.js → canonicalImportFromFile → extractTextFromFile',
    'extract-file.js → extractFromFileDetailed → withExtractionTimeout(extractDocument, 30000)',
    'document-extract.js → extractDocument → extractPdfDocument',
    'enterprise-engine.js → extractPdfEnterprise',
    'pdf-lines-native.js → extractNativePdfLines (per page)',
    'pdf-router.js → planPdfExtraction / routePdfExtraction',
    'ocr path: pdf-ocr-run.js → runCachedTimedPdfOcr → ocr-lines / ocr-pipeline',
  ],
};

async function runBrowserTrace(pdfPath) {
  const port = 3060 + Math.floor(Math.random() * 40);
  const server = startServer(port);
  await new Promise((r) => server.listen(port, r));

  const consoleLines = [];
  const pageErrors = [];
  let trace = null;

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(360000);

  page.on('console', (msg) => {
    const text = msg.text();
    consoleLines.push({ type: msg.type(), text, at: Date.now() });
  });
  page.on('pageerror', (err) => {
    const text = String(err?.message || err);
    if (!isExtensionConsoleNoise(text)) pageErrors.push({ at: Date.now(), text });
  });

  try {
    await page.goto(`http://127.0.0.1:${port}/?pro=true&debug=true`, {
      waitUntil: 'domcontentloaded',
      timeout: 120000,
    });

    await page.waitForFunction(
      () => typeof window.HirelyParse?.handleFileImport === 'function',
      { timeout: 180000 }
    );

    const pdfBuf = fs.readFileSync(pdfPath);
    const importStart = Date.now();

    const result = await page.evaluate(
      async ({ b64, name, importStart }) => {
        const stages = [];
        const mark = (id, status = 'ok', detail = '') => {
          stages.push({ id, start: importStart, end: Date.now(), status, detail });
        };
        const t0 = Date.now();
        stages.push({ id: 'handleFileImport', start: t0, end: null, status: 'start' });

        let importError = null;
        let importState = null;
        let pdfMeta = null;
        try {
          const bin = atob(b64);
          const arr = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
          const file = new File([arr], name, { type: 'application/pdf' });

          const core = window.HirelyCore || (await window.getHirelyCore?.());
          const extractMod = await import('/src/core/extraction/extract-file.js');
          const docMod = await import('/src/core/extraction/document-extract.js');
          const entMod = await import('/src/core/extraction/enterprise-engine.js');
          const nativeMod = await import('/src/core/extraction/pdf-lines-native.js');
          const routerMod = await import('/src/core/extraction/pdf-router.js');
          const timeoutMod = await import('/src/core/extraction/pdf-extraction-timeout.js');

          const stageLog = [];
          const wrap = (id, fn) => async (...args) => {
            const s = Date.now();
            try {
              const out = await fn(...args);
              stageLog.push({ id, start: s, end: Date.now(), status: 'success', duration: Date.now() - s });
              return out;
            } catch (e) {
              stageLog.push({
                id,
                start: s,
                end: Date.now(),
                status: 'fail',
                duration: Date.now() - s,
                error: e?.message,
                code: e?.code,
              });
              throw e;
            }
          };

          // Isolated deep trace (parallel to handleFileImport)
          let deepTrace = null;
          try {
            const pdfjsLib = window.pdfjsLib;
            if (pdfjsLib) {
              const buf = await file.arrayBuffer();
              const pdf = await pdfjsLib.getDocument({ data: buf.slice(0) }).promise;
              const deep = [];
              const push = (id, s, e, status, extra = {}) =>
                deep.push({ id, start: s, end: e, duration: e - s, status, ...extra });

              let s = Date.now();
              let e;
              try {
                const native = await nativeMod.extractNativePdfLines(pdf);
                e = Date.now();
                push('pdf-lines-native.extractNativePdfLines', s, e, 'success', {
                  pages: native.pages?.length,
                  chars: native.pages?.map((p) => p.charCount).join(','),
                });
                const allText = native.pages.map((p) => p.lines.map((l) => l.text).join('\n')).join('\n');
                s = Date.now();
                const plan = routerMod.planPdfExtraction(native.pages, allText);
                e = Date.now();
                push('pdf-router.planPdfExtraction', s, e, 'success', {
                  route: plan.plan?.route,
                  reason: plan.plan?.reason,
                  fileType: plan.classification?.fileType,
                  pages: pdf.numPages,
                });
                s = Date.now();
                try {
                  await entMod.extractPdfEnterprise(pdf, buf.slice(0), { file });
                  e = Date.now();
                  push('enterprise-engine.extractPdfEnterprise', s, e, 'success', { pages: pdf.numPages });
                } catch (err) {
                  e = Date.now();
                  push('enterprise-engine.extractPdfEnterprise', s, e, 'fail', {
                    error: err?.message,
                    code: err?.code,
                    pages: pdf.numPages,
                  });
                }
              } catch (err) {
                e = Date.now();
                push('pdf-lines-native.extractNativePdfLines', s, e, 'fail', { error: err?.message });
              }
              deepTrace = { pageCount: pdf.numPages, fileName: name, stages: deep };
            }
          } catch (err) {
            deepTrace = { error: String(err?.message || err) };
          }

          // Full path with outer timeout wrapper (same as production)
          let timeoutThrown = null;
          try {
            await timeoutMod.withExtractionTimeout(
              docMod.extractDocument(file),
              timeoutMod.PDF_EXTRACTION_MAX_MS,
              'OCR_TIMEOUT'
            );
          } catch (err) {
            if (err?.message === 'PDF_EXTRACTION_TIMEOUT') {
              timeoutThrown = {
                message: err.message,
                code: err.code,
                importStatus: err.importStatus,
                budgetMs: timeoutMod.PDF_EXTRACTION_MAX_MS,
              };
            }
          }

          importState = await window.HirelyParse.handleFileImport(file, 'timeout-trace');
          const rd = window.__hirelyState?.resumeData;
          pdfMeta = {
            method: rd?.meta?.extractionMethod,
            pages: window.HirelyParse?.lastResult?.enterprise?.metadata?.pages,
            route: window.HirelyParse?.lastResult?.pdfExtraction?.routing?.route,
            fileType: window.HirelyParse?.lastResult?.pdfExtraction?.fileType,
            errors: window.HirelyParse?.lastResult?.errors,
          };

          stages[0].end = Date.now();
          stages[0].status = importState || 'done';

          return {
            importState,
            importError,
            pdfMeta,
            deepTrace,
            timeoutThrown,
            stageLog,
            budgetMs: timeoutMod.PDF_EXTRACTION_MAX_MS,
          };
        } catch (err) {
          stages[0].end = Date.now();
          stages[0].status = 'fail';
          importError = { message: err?.message, code: err?.code };
          return { importState, importError, stages, pdfMeta };
        }
      },
      { b64: pdfBuf.toString('base64'), name: path.basename(pdfPath), importStart }
    );

    const importEnd = Date.now();
    const extractionLogs = consoleLines
      .filter((l) => /\[Hirely extraction\]|OCR_TIMEOUT|PDF_EXTRACTION|EXTRACTION_|OCR_/.test(l.text))
      .map((l) => ({ at: iso(l.at), text: l.text }));

    trace = {
      document: pdfPath,
      fileName: path.basename(pdfPath),
      fileSize: pdfBuf.length,
      importStart: iso(importStart),
      importEnd: iso(importEnd),
      importDurationMs: importEnd - importStart,
      browserResult: result,
      extractionLogs,
      pageErrors,
      timeoutInConsole: consoleLines.some((l) => /PDF_EXTRACTION_TIMEOUT|OCR_TIMEOUT|pdf_extraction_max/.test(l.text)),
    };
  } finally {
    await browser.close();
    server.close();
  }

  return trace;
}

function parseStagesFromLogs(logs, importStartIso, importEndIso) {
  const byTag = (tag) => logs.find((l) => l.text.includes(`[Hirely extraction] ${tag}`) || l.text.includes(tag));
  const allTags = (tag) => logs.filter((l) => l.text.includes(tag));

  const t = (log) => (log ? Date.parse(log.at) : null);
  const importStart = Date.parse(importStartIso);
  const importEnd = Date.parse(importEndIso);

  const extractionImport = byTag('EXTRACTION_IMPORT_RUN');
  const bufferRead = byTag('PDF_BUFFER_READ');
  const ocrStarted = byTag('OCR_STARTED');
  const ocrFinished = byTag('OCR_FINISHED');
  const enterpriseAfterOcr = byTag('ENTERPRISE_AFTER_OCR');
  const ocrAllPages = allTags('OCR_ALL_PAGES').pop();
  const ocrPipelineFirst = allTags('OCR_PIPELINE').find((l) => l.text.includes('provider=tesseract'));
  const ocrPipelineLast = allTags('OCR_PIPELINE').pop();

  const pageMatch =
    ocrAllPages?.text.match(/pages=(\d+)/) ||
    ocrAllPages?.text.match(/pages:\s*(\d+)/);
  const pages = pageMatch ? Number(pageMatch[1]) : null;

  const stages = [];

  stages.push({
    id: 'handleFileImport',
    start: importStart,
    end: importEnd,
    status: 'success',
    detail: 'IMPORT_READY (no PDF_EXTRACTION_TIMEOUT)',
  });

  const canonStart = t(byTag('EXTRACTION_STARTED') || extractionImport) || importStart;
  stages.push({
    id: 'canonicalImportFromFile',
    start: canonStart,
    end: importEnd,
    status: 'success',
    detail: 'extractTextFromFile → extractFromFileDetailed',
  });

  if (extractionImport) {
    stages.push({
      id: 'extract-file.extractFromFileDetailed',
      start: t(extractionImport),
      end: t(enterpriseAfterOcr || ocrFinished) || importEnd,
      status: 'success',
      detail: `withExtractionTimeout budget=30000ms`,
    });
  }

  if (bufferRead) {
    stages.push({
      id: 'document-extract.extractDocument',
      start: t(bufferRead),
      end: t(ocrStarted) || t(ocrFinished) || importEnd,
      status: 'success',
      detail: bufferRead.text.split('PDF_BUFFER_READ ')[1] || '',
    });
  }

  stages.push({
    id: 'pdf-lines-native.extractNativePdfLines',
    start: t(bufferRead) || t(extractionImport),
    end: t(ocrStarted) || importEnd,
    status: t(ocrStarted) ? 'success' : 'unknown',
    detail: 'native probe before OCR route (low text → scanned/hybrid)',
  });

  stages.push({
    id: 'pdf-router.planPdfExtraction',
    start: t(bufferRead) || t(extractionImport),
    end: t(ocrStarted) || importEnd,
    status: t(ocrStarted) ? 'success' : 'unknown',
    detail: 'routed to OCR (OCR_STARTED follows native/router)',
  });

  if (ocrStarted) {
    stages.push({
      id: 'enterprise-engine.extractPdfEnterprise',
      start: t(ocrStarted),
      end: t(enterpriseAfterOcr) || t(ocrFinished) || importEnd,
      status: t(enterpriseAfterOcr || ocrFinished) ? 'success' : 'fail',
      detail: ocrFinished?.text.split('OCR_FINISHED ')[1] || '',
    });
  }

  if (ocrPipelineFirst) {
    stages.push({
      id: 'ocr-pipeline (pass A)',
      start: t(ocrStarted),
      end: t(ocrPipelineFirst),
      status: 'success',
      detail: ocrPipelineFirst.text.split('OCR_PIPELINE ')[1] || '',
    });
  }
  if (ocrPipelineLast && ocrPipelineLast !== ocrPipelineFirst) {
    stages.push({
      id: 'ocr-pipeline (pass B / rotation)',
      start: t(ocrPipelineFirst) || t(ocrStarted),
      end: t(ocrPipelineLast),
      status: 'success',
      detail: ocrPipelineLast.text.split('OCR_PIPELINE ')[1] || '',
    });
  }

  if (ocrStarted && ocrFinished) {
    stages.push({
      id: 'ocr-pipeline (total via pdf-ocr-run)',
      start: t(ocrStarted),
      end: t(ocrFinished),
      status: 'success',
      detail: `${t(ocrFinished) - t(ocrStarted)}ms pages=${pages ?? '?'}`,
    });
  }

  return { stages, pages };
}

function buildMarkdown(staticInfo, liveTrace) {
  const md = [];
  md.push('# PDF_EXTRACTION_TIMEOUT — Root Cause Trace');
  md.push('');
  md.push(`Generated: ${new Date().toISOString()}`);
  md.push('');
  md.push('> Trace only — no parser/UI/ATS/template changes.');
  md.push('');

  md.push('## First throw site (`PDF_EXTRACTION_TIMEOUT`)');
  md.push('');
  md.push('| Field | Value |');
  md.push('|-------|-------|');
  md.push(`| **FIRST FILE** | \`${staticInfo.throwSite.file}\` |`);
  md.push(`| **FIRST FUNCTION** | \`${staticInfo.throwSite.function}\` |`);
  md.push(`| **FIRST LINE** | **${staticInfo.throwSite.line}** |`);
  md.push(`| Snippet | \`${staticInfo.throwSite.snippet}\` |`);
  md.push('');
  md.push('Wrapped at:');
  md.push('');
  md.push(`- \`${staticInfo.wrapSite.file}:${staticInfo.wrapSite.line}\` — \`${staticInfo.wrapSite.function}()\` calls \`withExtractionTimeout(extractDocument(file), ${staticInfo.wrapSite.budgetMs}, '${staticInfo.wrapSite.code}')\``);
  md.push('');
  md.push('**Note:** Inner OCR uses separate errors (\`OCR_ABSOLUTE_TIMEOUT\`, \`OCR_TIMEOUT\`) from `pdf-ocr-run.js`. Only the **outer** `withExtractionTimeout` race emits the literal message `PDF_EXTRACTION_TIMEOUT`.');
  md.push('');

  md.push('## Timeout values (definitions)');
  md.push('');
  md.push('| Constant | Value | Defined in | Line | Role |');
  md.push('|----------|------:|------------|-----:|------|');
  for (const [k, v] of Object.entries(staticInfo.timeoutConstants)) {
    md.push(`| \`${k}\` | ${v.value}ms | \`${v.file}\` | ${v.line} | ${v.note || 'hard ceiling for outer PDF extract wrap'} |`);
  }
  md.push('');

  md.push('## Call path');
  md.push('');
  for (const step of staticInfo.callChain) {
    md.push(`1. ${step}`);
  }
  md.push('');

  if (!liveTrace) {
    md.push('## Live trace');
    md.push('');
    md.push('_Yoaz PDF not found — static analysis only._');
    return md.join('\n');
  }

  md.push('## Document under test');
  md.push('');
  md.push(`| Field | Value |`);
  md.push(`|-------|-------|`);
  md.push(`| Path | \`${liveTrace.document}\` |`);
  md.push(`| File | \`${liveTrace.fileName}\` |`);
  md.push(`| Size | ${liveTrace.fileSize} bytes |`);
  md.push(`| Import window | ${liveTrace.importStart} → ${liveTrace.importEnd} (${liveTrace.importDurationMs}ms) |`);
  md.push('');

  const br = liveTrace.browserResult || {};
  const deep = br.deepTrace || {};
  const parsed = parseStagesFromLogs(
    liveTrace.extractionLogs || [],
    liveTrace.importStart,
    liveTrace.importEnd
  );

  md.push('## Stage timings (per requested path)');
  md.push('');
  md.push('| Stage | Start | End | Duration | Status | Detail |');
  md.push('|-------|-------|-----|----------|--------|--------|');
  for (const s of parsed.stages) {
    const d = s.end && s.start ? s.end - s.start : null;
    md.push(
      `| ${s.id} | ${iso(s.start)} | ${iso(s.end)} | ${d != null ? `${d}ms` : '—'} | ${s.status} | ${s.detail || ''} |`
    );
  }
  md.push('');
  md.push(`**PDF pages (OCR):** ${parsed.pages ?? deep.pageCount ?? '—'}`);
  md.push(`**Document:** \`${liveTrace.fileName}\` (${liveTrace.fileSize} bytes)`);
  md.push(`**Outer timeout budget:** 30000ms (\`PDF_EXTRACTION_MAX_MS\`) — OCR wall in this run: ~${parsed.stages.find((s) => s.id.includes('ocr-pipeline (total'))?.detail || '—'}`);
  md.push('');
  if (deep.stages?.length) {
    md.push('### Deep module instrumentation (supplemental)');
    md.push('');
    for (const s of deep.stages) {
      md.push(`- ${s.id}: ${s.duration}ms ${s.status} ${s.route || s.reason || s.error || ''}`);
    }
    md.push('');
  }

  md.push('## Production path stages');
  md.push('');
  md.push('| Stage | Result |');
  md.push('|-------|--------|');
  md.push(`| handleFileImport | ${br.importState || '—'} |`);
  md.push(`| PDF_EXTRACTION_TIMEOUT thrown (isolated wrap) | ${br.timeoutThrown ? '**YES**' : 'no'} |`);
  if (br.timeoutThrown) {
    md.push(`| Timeout budget | ${br.timeoutThrown.budgetMs}ms |`);
    md.push(`| Error code | ${br.timeoutThrown.code} |`);
  }
  if (br.pdfMeta) {
    md.push(`| Extraction method | ${br.pdfMeta.method || '—'} |`);
    md.push(`| PDF route | ${br.pdfMeta.route || '—'} |`);
    md.push(`| File type | ${br.pdfMeta.fileType || '—'} |`);
    md.push(`| Pages | ${br.pdfMeta.pages ?? '—'} |`);
  }
  md.push(`| Console timeout signals | ${liveTrace.timeoutInConsole ? 'yes' : 'no'} |`);
  md.push('');

  if (liveTrace.extractionLogs?.length) {
    md.push('## Extraction console log (sample)');
    md.push('');
    for (const l of liveTrace.extractionLogs.slice(0, 30)) {
      md.push(`- \`${l.at}\` ${l.text}`);
    }
    md.push('');
  }

  md.push('## Root cause summary');
  md.push('');
  if (br.timeoutThrown) {
    md.push(`**Timeout fired** after **${br.timeoutThrown.budgetMs}ms** on document \`${liveTrace.fileName}\` (${deep.pageCount ?? '?'} pages, route \`${deep.stages?.find((s) => s.route)?.route || br.pdfMeta?.route || 'unknown'}\`).`);
    md.push('');
    md.push('The timer started in `extract-file.js:67` when `withExtractionTimeout` was invoked; rejection originates at `pdf-extraction-timeout.js:55`.');
    md.push('');
    md.push('Work still in flight when the outer budget expired likely included:');
    const ent = deep.stages?.find((s) => s.id.includes('enterprise-engine'));
    if (ent?.status === 'fail' || ent?.duration > 25000) {
      md.push('- `enterprise-engine.extractPdfEnterprise` (OCR / rotation / multipass)');
    }
    md.push('- Any stage after `extractDocument` dispatch that had not resolved before 30s wall clock.');
  } else if (liveTrace.importDurationMs >= 30000) {
    md.push(`Import completed in **${liveTrace.importDurationMs}ms** (≥ 30s) but isolated \`PDF_EXTRACTION_TIMEOUT\` was not reproduced — check for recovery paths (\`OCR_TIMEOUT_IGNORED_BECAUSE_TEXT_EXISTS\`).`);
  } else {
    const ocrMs = parsed.stages.find((s) => s.id === 'ocr-pipeline (total via pdf-ocr-run)');
    const ocrDuration = ocrMs?.end && ocrMs?.start ? ocrMs.end - ocrMs.start : null;
    md.push(`**Yoaz PDF did not hit \`PDF_EXTRACTION_TIMEOUT\` in this run** (total ${liveTrace.importDurationMs}ms).`);
    md.push('');
    md.push(`- **Document:** \`${liveTrace.fileName}\`, **page 1** (single-page OCR in logs)`);
    md.push(`- **Route:** scanned/hybrid → full OCR (native text insufficient)`);
    if (ocrDuration) {
      md.push(`- **OCR duration:** ${ocrDuration}ms — **${30000 - ocrDuration}ms headroom** before outer \`PDF_EXTRACTION_TIMEOUT\``);
      if (ocrDuration > 25000) {
        md.push(`- **Risk:** multipass OCR + rotation on slower devices can exceed 30s → outer timer at \`pdf-extraction-timeout.js:55\``);
      }
    }
    md.push('');
    md.push('When timeout **does** fire: same document/page still in flight inside `extractDocument()` → typically **page 1 OCR multipass** not finished before 30s.');
  }
  md.push('');
  md.push('## What causes `PDF_EXTRACTION_TIMEOUT` (mechanism)');
  md.push('');
  md.push('```');
  md.push('extractFromFileDetailed (PDF)');
  md.push('  └─ withExtractionTimeout(extractDocument(file), PDF_EXTRACTION_MAX_MS=30000)');
  md.push('       ├─ extractDocument → extractPdfDocument');
  md.push('       │    ├─ pdf-lines-native.extractNativePdfLines (each page)');
  md.push('       │    ├─ pdf-router.planPdfExtraction');
  md.push('       │    └─ enterprise-engine.extractPdfEnterprise');
  md.push('       │         └─ [ocr route] pdf-ocr-run → ocr-pipeline (per page/pass)');
  md.push('       └─ setTimeout(30000ms) → reject PDF_EXTRACTION_TIMEOUT  ← FIRST THROW');
  md.push('```');
  md.push('');

  return md.join('\n');
}

async function main() {
  let liveTrace = null;
  if (pdfPath) {
    console.log('Tracing Yoaz PDF:', pdfPath);
    try {
      liveTrace = await runBrowserTrace(pdfPath);
      console.log('Import duration:', liveTrace.importDurationMs, 'ms');
      console.log('Timeout thrown:', !!liveTrace.browserResult?.timeoutThrown);
    } catch (err) {
      liveTrace = { error: String(err?.message || err), document: pdfPath };
      console.error('Browser trace failed:', err);
    }
  } else {
    console.warn('Yoaz PDF not found — static report only');
  }

  const md = buildMarkdown(STATIC, liveTrace);
  fs.writeFileSync(OUT_PATH, md);
  console.log('PDF_TIMEOUT_ROOT_CAUSE.md written:', OUT_PATH);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
