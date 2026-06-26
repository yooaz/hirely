#!/usr/bin/env node
/**
 * CSP / eval audit — strict CSP, no unsafe-eval. Loads vendors + smoke import.
 */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const REPORT = path.join(ROOT, 'CSP_EVAL_FIX_REPORT.md');

const FIRST_PARTY_GLOBS = ['index.html', 'src/**/*.js', 'cv-templates.js'];

function ok(cond, label, failures) {
  if (!cond) failures.push(label);
  return cond;
}

function scanFirstPartyEval() {
  const hits = [];
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir)) {
      const p = path.join(dir, name);
      const st = fs.statSync(p);
      if (st.isDirectory()) {
        if (name === 'node_modules' || name === 'tests' || name === 'archive' || name === '.git') continue;
        walk(p);
        continue;
      }
      if (!/\.(js|mjs|html)$/.test(name)) continue;
      const rel = path.relative(ROOT, p);
      if (rel.startsWith('scripts/')) continue;
      if (rel.startsWith('src/tests/')) continue;
      const lines = fs.readFileSync(p, 'utf8').split('\n');
      lines.forEach((line, i) => {
        if (/\$eval\s*\(|\.evaluate\s*\(|page\.evaluate/.test(line)) return;
        const patterns = [
          { re: /\beval\s*\(/, label: 'eval(' },
          { re: /\bnew\s+Function\s*\(/, label: 'new Function(' },
          { re: /setTimeout\s*\(\s*['"`]/, label: 'setTimeout(string)' },
          { re: /setInterval\s*\(\s*['"`]/, label: 'setInterval(string)' },
        ];
        for (const { re, label } of patterns) {
          if (re.test(line)) hits.push({ file: rel, line: i + 1, pattern: label });
        }
      });
    }
  };
  walk(ROOT);
  return hits.filter((h) => !h.file.includes('node_modules'));
}

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url || '/', 'http://localhost');
      let filePath = path.join(ROOT, decodeURIComponent(url.pathname));
      if (url.pathname === '/') filePath = path.join(ROOT, 'index.html');
      if (!filePath.startsWith(ROOT)) {
        res.writeHead(403);
        res.end();
        return;
      }
      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end();
          return;
        }
        const ext = path.extname(filePath);
        const types = {
          '.html': 'text/html; charset=utf-8',
          '.js': 'text/javascript; charset=utf-8',
          '.mjs': 'text/javascript; charset=utf-8',
          '.css': 'text/css; charset=utf-8',
          '.json': 'application/json',
          '.pdf': 'application/pdf',
          '.txt': 'text/plain',
        };
        res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
        res.end(data);
      });
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

async function browserAudit(base) {
  const browser = await chromium.launch({ headless: true });
  const consoleLog = [];
  const cspViolations = [];
  const page = await browser.newPage();

  page.on('console', (msg) => {
    consoleLog.push({ type: msg.type(), text: msg.text() });
  });
  page.on('pageerror', (err) => {
    consoleLog.push({ type: 'error', text: String(err?.message || err) });
  });

  await page.addInitScript(() => {
    window.__hirelyCspViolations = [];
    document.addEventListener('securitypolicyviolation', (e) => {
      window.__hirelyCspViolations.push({
        directive: e.violatedDirective,
        blocked: e.blockedURI,
        sample: e.sample,
      });
    });
  });

  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => typeof window.HirelyLazy?.ensurePdf === 'function', { timeout: 90000 });

  await page.evaluate(async () => {
    await window.HirelyLazy.ensurePdf();
    await window.HirelyLazy.ensurePdfLib();
    await window.HirelyLazy.ensureJsZip();
    await window.HirelyLazy.ensureHtml2pdf();
  });

  const vendorState = await page.evaluate(() => ({
    pdfjs: !!window.pdfjsLib?.getDocument,
    pdfEvalOff: window.pdfjsLib?.GlobalWorkerOptions?.isEvalSupported === false,
    pdfLib: !!window.PDFLib?.PDFDocument,
    jszip: !!window.JSZip,
    html2pdf: typeof window.html2pdf === 'function',
    mammoth: !!window.mammoth,
    cspMeta: !!document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content,
    cspHasUnsafeEval: /(?:^|[;\s])unsafe-eval(?:\s|;|$)/i.test(
      document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content || ''
    ),
  }));

  const violations = await page.evaluate(() => window.__hirelyCspViolations || []);
  cspViolations.push(...violations);

  await browser.close();

  const evalConsole = consoleLog.filter(
    (l) =>
      l.type === 'error' &&
      (/blocks eval/i.test(l.text) ||
        /refused to evaluate/i.test(l.text) ||
        (/content security policy/i.test(l.text) && /eval/i.test(l.text)))
  );

  return { vendorState, cspViolations, evalConsole, consoleLog };
}

async function main() {
  const failures = [];
  const firstPartyHits = scanFirstPartyEval();

  ok(firstPartyHits.length === 0, `first-party eval patterns (${firstPartyHits.length})`, failures);

  const server = await startServer();
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}/`;

  let browser = { vendorState: {}, cspViolations: [], evalConsole: [] };
  try {
    browser = await browserAudit(base);
  } finally {
    server.close();
  }

  const { vendorState, cspViolations, evalConsole } = browser;

  ok(vendorState.pdfjs, 'pdf.js loads under CSP', failures);
  ok(vendorState.pdfEvalOff, 'pdf.js isEvalSupported=false', failures);
  ok(vendorState.pdfLib, 'pdf-lib loads under CSP', failures);
  ok(vendorState.jszip, 'JSZip loads under CSP', failures);
  ok(vendorState.html2pdf, 'html2pdf loads under CSP', failures);
  ok(!vendorState.mammoth, 'mammoth CDN removed (OOXML path)', failures);
  ok(vendorState.cspMeta, 'CSP meta present', failures);
  ok(!vendorState.cspHasUnsafeEval, 'CSP does not include unsafe-eval', failures);
  ok(cspViolations.length === 0, `CSP violations (${cspViolations.length})`, failures);
  ok(evalConsole.length === 0, `eval/CSP console errors (${evalConsole.length})`, failures);

  const status = failures.length === 0 ? 'PASS' : 'FAIL';
  const lines = [
    '# CSP Eval Fix Report',
    '',
    `**Status:** ${status}`,
    `**Date:** ${new Date().toISOString().slice(0, 10)}`,
    '',
    '## Goal',
    '',
    'Remove `eval()`, `new Function()`, and string-based timers from Hirely runtime paths. Enforce CSP **without** `unsafe-eval`.',
    '',
    '## First-party static scan',
    '',
    firstPartyHits.length
      ? firstPartyHits.map((h) => `- \`${h.file}\`: ${h.pattern}`).join('\n')
      : '- No `eval(`, `new Function(`, or string `setTimeout`/`setInterval` in app source.',
    '',
    '## Remediation',
    '',
    '| Area | Before | After |',
    '|------|--------|-------|',
    '| Vendor scripts | CDN UMD bundles (pdf.js used eval paths) | Same-origin `node_modules` via `src/vendor/csp-safe-loader.js` |',
    '| PDF.js | CDN 3.11 + default eval | `pdfjs-dist@4.2.67` ESM + `isEvalSupported: false` |',
    '| DOCX | mammoth + jszip CDN (`new Function`) | Self-hosted JSZip + native OOXML recovery (mammoth removed from browser) |',
    '| PDF export | html2pdf CDN | Self-hosted `html2pdf.js` bundle (no eval in bundle) |',
    '| OCR | tesseract CDN | Self-hosted `tesseract.js` + `wasm-unsafe-eval` only (not `unsafe-eval`) |',
    '| CSP | none | Meta + Vercel header, no `unsafe-eval` |',
    '',
    '## Browser verification',
    '',
    '| Check | Result |',
    '|-------|--------|',
    `| pdf.js loaded | ${vendorState.pdfjs ? 'yes' : 'no'} |`,
    `| isEvalSupported=false | ${vendorState.pdfEvalOff ? 'yes' : 'no'} |`,
    `| pdf-lib loaded | ${vendorState.pdfLib ? 'yes' : 'no'} |`,
    `| JSZip loaded | ${vendorState.jszip ? 'yes' : 'no'} |`,
    `| html2pdf loaded | ${vendorState.html2pdf ? 'yes' : 'no'} |`,
    `| mammoth absent | ${!vendorState.mammoth ? 'yes' : 'no'} |`,
    `| CSP meta (no unsafe-eval) | ${vendorState.cspMeta && !vendorState.cspHasUnsafeEval ? 'yes' : 'no'} |`,
    `| CSP violation events | ${cspViolations.length} |`,
    `| eval/CSP console errors | ${evalConsole.length} |`,
    '',
  ];

  if (cspViolations.length) {
    lines.push('### CSP violations', '', '```json', JSON.stringify(cspViolations, null, 2), '```', '');
  }
  if (evalConsole.length) {
    lines.push('### Console', '', '```json', JSON.stringify(evalConsole, null, 2), '```', '');
  }
  if (failures.length) {
    lines.push('## Failures', '', ...failures.map((f) => `- ${f}`), '');
  }
  lines.push('## Run', '', '```bash', 'npm run csp-eval-fix-report', '```', '');

  fs.writeFileSync(REPORT, lines.join('\n'));
  console.log(`CSP eval fix: ${status}`);
  console.log(`Report: ${REPORT}`);
  if (failures.length) {
    failures.forEach((f) => console.error('FAIL:', f));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
