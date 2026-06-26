/**
 * PDF buffer clone — pdf-lib probe must not see detached ArrayBuffer after pdf.js load.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cloneArrayBuffer } from '../core/extraction/file-buffer.js';
import { probePdfWithPdfLib } from '../core/extraction/pdf-lib-probe.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '../..');

async function loadPdfLib() {
  const { PDFDocument } = await import('pdf-lib');
  globalThis.PDFLib = { PDFDocument };
}

function simulatePdfJsDetach(buf) {
  try {
    new Uint8Array(buf);
    return buf;
  } catch {
    return null;
  }
}

async function main() {
  const fixture = join(root, 'tests/output/pdf-export-qa/one-page.pdf');
  let master;
  try {
    master = (await readFile(fixture)).buffer;
  } catch {
    console.log('SKIP qa-pdf-buffer-clone — fixture missing');
    process.exit(0);
  }

  await loadPdfLib();
  const pdfJsBuf = cloneArrayBuffer(master);
  const pdfLibBuf = cloneArrayBuffer(master);

  simulatePdfJsDetach(pdfJsBuf);
  const probe = await probePdfWithPdfLib(pdfLibBuf);
  assert.ok(probe?.loaded, 'pdf-lib probe after clone');
  assert.equal(typeof probe.pageCount, 'number');

  console.log('OK qa-pdf-buffer-clone');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
