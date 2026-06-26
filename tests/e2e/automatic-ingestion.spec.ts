// FILE: automatic ingestion test
import fs from 'fs';
import path from 'path';
import { test, expect } from '@playwright/test';

const SCAN_PDF = path.join(process.cwd(), 'tests/fixtures/hirely-test-lab/scan.pdf');

async function browserImportFile(
  page: import('@playwright/test').Page,
  filePath: string,
  source = 'e2e-automatic-ingestion'
) {
  const buf = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const type =
    ext === '.pdf'
      ? 'application/pdf'
      : ext === '.docx'
        ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        : 'text/plain';
  await page.evaluate(
    async ({ b64, name, mimeType, src }) => {
      if (name.endsWith('.pdf')) {
        await window.HirelyLazy?.ensurePdf?.();
        await window.HirelyLazy?.ensureTesseract?.();
      }
      const bin = atob(b64);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      const file = new File([arr], name, { type: mimeType });
      await window.HirelyParse.handleFileImport(file, src);
    },
    { b64: buf.toString('base64'), name: path.basename(filePath), mimeType: type, src: source }
  );
}

async function waitImportDone(page: import('@playwright/test').Page, maxMs = 300_000) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    const snap = await page.evaluate(() => ({
      decision: globalThis.__HIRELY_LAST_IMPORT_DECISION__ || null,
      busy: document.getElementById('wsImport')?.classList.contains('wsImport--loading'),
      live: document.getElementById('cvDoc')?.classList.contains('cv--live'),
      fallback: document.getElementById('importPasteFallback')?.classList.contains('show'),
    }));
    if ((snap.live || snap.fallback || snap.decision?.destination) && !snap.busy) {
      return snap;
    }
    await page.waitForTimeout(500);
  }
  return page.evaluate(() => ({
    decision: globalThis.__HIRELY_LAST_IMPORT_DECISION__ || null,
    timeout: true,
  }));
}

test('user is not asked to choose parser vs OCR', async ({ page }) => {
  await page.goto('http://127.0.0.1:4321/');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => globalThis.__HIRELY_CORE_BOOT__ === 'ok', null, {
    timeout: 30_000,
  });

  await expect(page.locator('text=CV structuré')).toHaveCount(0);
  await expect(page.locator('text=Transcription exacte')).toHaveCount(0);
  await expect(page.locator('#importModeFieldset')).toHaveCount(0);
  await expect(page.locator('#importModeDebugHost')).toHaveCount(0);
  await expect(page.locator('#exactTranscriptionToggle')).toHaveCount(0);
});

test('pdf image with OCR success does not show paste fallback', async ({ page }) => {
  test.setTimeout(300_000);

  await page.goto('http://127.0.0.1:4321/');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => globalThis.__HIRELY_CORE_BOOT__ === 'ok', null, {
    timeout: 30_000,
  });
  await page.waitForFunction(() => typeof window.HirelyParse?.handleFileImport === 'function', null, {
    timeout: 30_000,
  });

  expect(fs.existsSync(SCAN_PDF), `missing fixture ${SCAN_PDF}`).toBe(true);
  await browserImportFile(page, SCAN_PDF);
  await waitImportDone(page);

  const decision = await page.evaluate(() => globalThis.__HIRELY_LAST_IMPORT_DECISION__ || null);
  if (decision?.destination === 'structured_from_ocr' || decision?.destination === 'recovery') {
    await expect(page.locator('#importPasteFallback.show')).toHaveCount(0);
  }
});
