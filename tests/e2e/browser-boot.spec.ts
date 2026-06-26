// FILE: browser boot smoke test
import { test, expect } from '@playwright/test';

const CACHE_FACADE_SYMBOLS = [
  'getOrRunCachedPdfOcr',
  'getCachedPdfOcrIfReady',
  'markPdfOcrTimedOut',
  'clearPdfOcrTimedOut',
  'isPdfOcrTimedOut',
  'setOcrInFlightPromise',
  'clearOcrInFlightPromise',
  'peekOcrInFlightPromise',
  'awaitOcrSettlementForFile',
];

test('browser boot has no core boot failure', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    const text = msg.text();
    if (/CORE_BOOT_FAILED|HIRELY_ENGINE_FAILED|does not provide an export named/i.test(text)) {
      errors.push(text);
    }
  });

  await page.goto('http://127.0.0.1:4321/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  const boot = await page.evaluate(() => globalThis.__HIRELY_CORE_BOOT__ || null);
  expect(boot).toBe('ok');
  expect(errors).toEqual([]);
});

test('pdf-ocr-cache.js facade exports boot-required cache symbols', async ({ page }) => {
  await page.goto('http://127.0.0.1:4321/', { waitUntil: 'domcontentloaded' });

  const missing = await page.evaluate(async (symbols) => {
    const mod = await import('/src/core/extraction/pdf-ocr-cache.js');
    return symbols.filter((name) => typeof mod[name] !== 'function');
  }, CACHE_FACADE_SYMBOLS);

  expect(missing).toEqual([]);
});
