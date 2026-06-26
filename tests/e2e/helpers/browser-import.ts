import fs from 'fs';
import path from 'path';

export const SCAN_PDF_FIXTURE = path.join(
  process.cwd(),
  'tests/fixtures/hirely-test-lab/scan.pdf'
);

export async function browserImportFile(
  page: import('@playwright/test').Page,
  filePath: string,
  source = 'e2e-scanned-cv-regression'
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

export type ImportDoneSnap = {
  decision: { destination?: string; reason?: string } | null;
  busy: boolean;
  live: boolean;
  fallback: boolean;
  earlyPaste: boolean;
  structuredFlowOpen: boolean;
  importDestination: string;
  timeout?: boolean;
};

function isStructuredDestination(dest: string): boolean {
  return (
    dest === 'structured_from_ocr' ||
    dest === 'structured_native' ||
    dest === 'recovery' ||
    dest === 'review'
  );
}

export async function waitImportDone(
  page: import('@playwright/test').Page,
  maxMs = 300_000
): Promise<ImportDoneSnap> {
  const readSnap = (): Promise<ImportDoneSnap> =>
    page.evaluate(() => {
      const decision = globalThis.__HIRELY_LAST_IMPORT_DECISION__ || null;
      const dest = String(
        decision?.destination ||
          globalThis.HIRELY_LAST_IMPORT_DESTINATION ||
          ''
      ).toLowerCase();
      const pasteVisible = document
        .getElementById('importPasteFallback')
        ?.classList.contains('show');
      const earlyPaste = !!document.querySelector('.importPasteFallback--early.show');
      const structuredFlowOpen =
        (dest === 'structured_from_ocr' ||
          dest === 'structured_native' ||
          dest === 'recovery' ||
          dest === 'review') &&
        !pasteVisible &&
        !earlyPaste;
      return {
        decision,
        busy: document.getElementById('wsImport')?.classList.contains('wsImport--loading'),
        live: document.getElementById('cvDoc')?.classList.contains('cv--live'),
        fallback: !!pasteVisible,
        earlyPaste,
        structuredFlowOpen,
        importDestination: dest,
      };
    });

  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    const snap = await readSnap();
    if (!snap.busy) {
      if (snap.fallback) return snap;
      if (snap.live) return snap;
      if (isStructuredDestination(snap.importDestination) && snap.structuredFlowOpen) {
        return snap;
      }
      if (snap.decision?.destination && !isStructuredDestination(snap.importDestination)) {
        return snap;
      }
    }
    await page.waitForTimeout(500);
  }
  const snap = await readSnap();
  return { ...snap, timeout: true };
}
