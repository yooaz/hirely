// FILE: scanned CV browser regression — real fixture upload + OCR + import decision
import fs from 'fs';
import { test, expect } from '@playwright/test';
import { attachConsoleErrorRecorder } from './helpers/console-errors';
import {
  SCAN_PDF_FIXTURE,
  browserImportFile,
  waitImportDone,
} from './helpers/browser-import';

const PARSER_OCR_UI_SELECTORS = [
  '#importModeFieldset',
  '#importModeDebugHost',
  '#exactTranscriptionToggle',
] as const;

test.describe('scanned CV flow (real browser)', () => {
  test('upload scan.pdf → OCR → structured_from_ocr without paste or engine selector', async ({
    page,
  }) => {
    test.setTimeout(300_000);

    const recorded = attachConsoleErrorRecorder(page);

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForFunction(() => globalThis.__HIRELY_CORE_BOOT__ === 'ok', null, {
      timeout: 30_000,
    });
    await page.waitForFunction(
      () => typeof window.HirelyParse?.handleFileImport === 'function',
      null,
      { timeout: 30_000 }
    );

    expect(fs.existsSync(SCAN_PDF_FIXTURE), `missing fixture ${SCAN_PDF_FIXTURE}`).toBe(true);

    for (const sel of PARSER_OCR_UI_SELECTORS) {
      await expect(page.locator(sel)).toHaveCount(0);
    }
    await expect(page.locator('text=CV structuré')).toHaveCount(0);
    await expect(page.locator('text=Transcription exacte')).toHaveCount(0);

    await browserImportFile(page, SCAN_PDF_FIXTURE);
    const snap = await waitImportDone(page);

    expect(snap.timeout, 'import did not settle within timeout').toBeFalsy();

    const decision = snap.decision;
    expect(decision, '__HIRELY_LAST_IMPORT_DECISION__ must be set').toBeTruthy();

    expect(recorded.fatalErrors, 'no CORE_BOOT_FAILED / HIRELY_ENGINE_FAILED / export SyntaxError').toEqual(
      []
    );
    expect(
      [...recorded.consoleErrors, ...recorded.pageErrors].some((e) =>
        /CORE_BOOT_FAILED|HIRELY_ENGINE_FAILED|does not provide an export named/i.test(e)
      ),
      'console must not contain boot/engine/export failures'
    ).toBe(false);

    if (decision?.destination === 'structured_from_ocr' || decision?.destination === 'recovery') {
      await expect(page.locator('#importPasteFallback.show')).toHaveCount(0);
      await expect(page.locator('.importPasteFallback--early.show')).toHaveCount(0);
      expect(snap.fallback, 'paste fallback must stay hidden').toBe(false);
      expect(snap.earlyPaste, 'early OCR paste offer must stay hidden').toBe(false);
      expect(
        snap.structuredFlowOpen,
        'structured flow must open (committed non-paste OCR route)'
      ).toBe(true);
    }

    for (const sel of PARSER_OCR_UI_SELECTORS) {
      await expect(page.locator(sel)).toHaveCount(0);
    }
    await expect(page.locator('text=CV structuré')).toHaveCount(0);
    await expect(page.locator('text=Transcription exacte')).toHaveCount(0);
  });
});
