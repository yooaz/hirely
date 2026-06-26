#!/usr/bin/env node
/**
 * P0 — Template gallery must sit above CV preview after import.
 */
import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { isHirelyAppFatal } from '../tests/lib/qa-console-filter.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const REPORT = path.join(ROOT, 'TEMPLATE_GALLERY_POSITION_REPORT.md');
const PASTE_FIXTURE = path.join(ROOT, 'tests/fixtures/yoaz-cv/fixture.txt');
const PORT = Number(process.env.HIRELY_TEMPLATE_GALLERY_PORT || 3014);

function mime(fp) {
  const ext = path.extname(fp).toLowerCase();
  return (
    {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.mjs': 'text/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.pdf': 'application/pdf',
    }[ext] || 'application/octet-stream'
  );
}

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);
      let fp = path.join(ROOT, decodeURIComponent(url.pathname));
      if (fp.endsWith('/')) fp = path.join(fp, 'index.html');
      if (!fp.startsWith(ROOT)) {
        res.writeHead(403);
        res.end('Forbidden');
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
    server.listen(PORT, '127.0.0.1', () => resolve(server));
  });
}

async function buildTextPdf(outPath, plainText) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  let page = pdf.addPage([595.28, 841.89]);
  let y = 800;
  for (const line of plainText.split('\n')) {
    if (y < 48) {
      page = pdf.addPage([595.28, 841.89]);
      y = 800;
    }
    page.drawText(line.slice(0, 95), { x: 48, y, size: 9, font });
    y -= 12;
  }
  fs.writeFileSync(outPath, await pdf.save());
}

async function waitImportDone(page, maxMs = 120000) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    const s = await page.evaluate(() => ({
      live: document.getElementById('cvDoc')?.classList.contains('cv--live'),
      busy: document.getElementById('wsImport')?.classList.contains('wsImport--loading'),
    }));
    if (s.live && !s.busy) return { ok: true, ms: Date.now() - t0 };
    await page.waitForTimeout(400);
  }
  return { ok: false };
}

async function main() {
  const checks = [];
  const fail = (name, detail) => checks.push({ name, ok: false, detail });
  const pass = (name, detail = '') => checks.push({ name, ok: true, detail });

  const pasteText = fs.readFileSync(PASTE_FIXTURE, 'utf8');
  const pdfPath = path.join(ROOT, 'tests/output/template-gallery-position/upload.pdf');
  fs.mkdirSync(path.dirname(pdfPath), { recursive: true });
  await buildTextPdf(pdfPath, pasteText);

  const server = await startServer();
  const url = `http://127.0.0.1:${PORT}/?pro=true`;
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error' && isHirelyAppFatal(msg.text())) consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => {
    const t = String(err?.message || err);
    if (isHirelyAppFatal(t)) consoleErrors.push(t);
  });

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForFunction(
      () => typeof window.HirelyParse?.handleFileImport === 'function',
      { timeout: 120000 }
    );

    await page.locator('#fileInput').setInputFiles(pdfPath);
    const imp = await waitImportDone(page);
    imp.ok ? pass('import completes', `${imp.ms}ms`) : fail('import completes', 'timeout');

    const layout = await page.evaluate(() => {
      const isVisible = (el) => {
        if (!el || el.classList.contains('hidden')) return false;
        const st = window.getComputedStyle(el);
        return st.display !== 'none' && st.visibility !== 'hidden' && st.opacity !== '0';
      };
      const extraction = document.getElementById('extractionQualityStep');
      const tplBar = document.getElementById('templatePickerBar');
      const cvCanvas = document.querySelector('.workspaceCanvas');
      const cvDoc = document.getElementById('cvDoc');
      const center = document.getElementById('reviewStudioCenter');
      const analysis = document.getElementById('reviewStudioAnalysis');
      const follows = (a, b) =>
        !!(a && b && (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING));
      const orderOk =
        follows(extraction, tplBar) &&
        follows(tplBar, cvCanvas) &&
        follows(cvCanvas, center) &&
        follows(center, analysis);

      const tplRect = tplBar?.getBoundingClientRect();
      const cvRect = cvCanvas?.getBoundingClientRect();
      const galleryAboveCv = !!(tplRect && cvRect && tplRect.bottom <= cvRect.top + 4);

      const active = document.querySelector('.premiumTplCard.active, .tplCard.active');
      const cvHtml = cvDoc?.innerHTML?.trim() || '';
      return {
        orderOk,
        tplVisible: isVisible(tplBar),
        galleryAboveCv,
        activeId: active?.dataset?.id || null,
        cvLive: cvDoc?.classList.contains('cv--live'),
        cvChars: cvHtml.length,
        docStep: document.getElementById('workspaceGrid')?.className || '',
        tplTop: tplBar ? tplBar.getBoundingClientRect().top + window.scrollY : null,
        viewportTop: window.scrollY,
      };
    });

    layout.orderOk
      ? pass('vertical stack order', 'extraction → gallery → CV → review')
      : fail('vertical stack order', 'DOM order mismatch');

    layout.tplVisible
      ? pass('template gallery visible on edit step')
      : fail('template gallery visible on edit step', layout.docStep);

    layout.galleryAboveCv
      ? pass('gallery above CV preview')
      : fail('gallery above CV preview', 'templatePickerBar not above workspaceCanvas');

    layout.activeId
      ? pass('active template highlighted', layout.activeId)
      : fail('active template highlighted', 'no .active card');

    layout.cvLive && layout.cvChars > 80
      ? pass('CV preview not blank', `${layout.cvChars} chars`)
      : fail('CV preview not blank', `live=${layout.cvLive} chars=${layout.cvChars}`);

    const before = await page.evaluate(() => ({
      active: document.querySelector('.premiumTplCard.active, .tplCard.active')?.dataset?.id,
      htmlLen: document.getElementById('cvDoc')?.innerHTML?.length || 0,
    }));

    const switched = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('.premiumTplCard, .tplCard')];
      const cur = document.querySelector('.premiumTplCard.active, .tplCard.active');
      const next = cards.find((c) => c !== cur);
      if (!next) return { ok: false, reason: 'no alternate template' };
      if (typeof next.onclick === 'function') next.onclick();
      else next.click();
      return { ok: true, nextId: next.dataset.id };
    });

    await page.waitForTimeout(500);

    const after = await page.evaluate(() => ({
      active: document.querySelector('.premiumTplCard.active, .tplCard.active')?.dataset?.id,
      htmlLen: document.getElementById('cvDoc')?.innerHTML?.length || 0,
      cvLive: document.getElementById('cvDoc')?.classList.contains('cv--live'),
    }));

    switched.ok && after.active && after.active !== before.active
      ? pass('template switch updates selection', `${before.active} → ${after.active}`)
      : fail('template switch updates selection', switched.reason || 'selection unchanged');

    after.cvLive && after.htmlLen > 80
      ? pass('preview stays populated after switch', `${after.htmlLen} chars`)
      : fail('preview stays populated after switch', `chars=${after.htmlLen}`);

    consoleErrors.length === 0
      ? pass('no fatal console errors')
      : fail('no fatal console errors', consoleErrors.slice(0, 2).join('; '));
  } finally {
    await browser.close();
    server.close();
  }

  const allOk = checks.every((c) => c.ok);
  const lines = [
    '# Template Gallery Position Report',
    '',
    `**Result:** ${allOk ? 'PASS' : 'FAIL'}`,
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Target layout (post-import)',
    '',
    '1. Extraction summary (`#extractionQualityStep`)',
    '2. Template gallery (`#templatePickerBar`)',
    '3. CV preview (`.workspaceCanvas` / `#cvDoc`)',
    '4. Review panel (`#reviewStudioCenter`, `#reviewStudioAnalysis`)',
    '',
    '## Checks',
    '',
    ...checks.map((c) => `- [${c.ok ? 'x' : ' '}] ${c.name}${c.detail ? ` — ${c.detail}` : ''}`),
    '',
    '## Changes',
    '',
    '- Moved extraction summary and review panels inside `#studioPreview` / `.wsCenterStack`',
    '- Removed edit-step CSS/JS that hid `#templatePickerBar`',
    '- Switched edit layout from 3-column grid to single vertical stack',
    '- Added `src/ui/studio/template-gallery-position.css` for compact sticky gallery',
    '',
    '## Verify',
    '',
    '```bash',
    'npm run test:template-gallery-position',
    '```',
    '',
  ];
  fs.writeFileSync(REPORT, lines.join('\n'));
  console.log(allOk ? 'PASS' : 'FAIL');
  console.log(`Report: ${REPORT}`);
  for (const c of checks) {
    console.log(`${c.ok ? 'OK' : 'FAIL'} ${c.name}${c.detail ? `: ${c.detail}` : ''}`);
  }
  process.exit(allOk ? 0 : 1);
}

main().catch((err) => {
  console.error('TEMPLATE_GALLERY_POSITION_TEST_CRASH', err);
  process.exit(1);
});
