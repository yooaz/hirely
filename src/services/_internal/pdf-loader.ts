/**
 * Node PDF.js loader for native extraction.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let pdfjsPromise: Promise<typeof import('pdfjs-dist')> | null = null;

export async function loadPdfJs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist/legacy/build/pdf.mjs').then(async (pdfjs) => {
      const workerPath = path.join(
        path.dirname(fileURLToPath(import.meta.url)),
        '../../../node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs'
      );
      try {
        pdfjs.GlobalWorkerOptions.workerSrc = workerPath;
      } catch {
        // worker optional for text-only extraction in some environments
      }
      return pdfjs;
    });
  }
  return pdfjsPromise;
}

export async function loadPdfFromBuffer(buffer: ArrayBuffer | Uint8Array | Buffer) {
  const pdfjs = await loadPdfJs();
  const data = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return pdfjs.getDocument({ data, isEvalSupported: false }).promise;
}

export async function loadPdfFromPath(filePath: string) {
  const buf = await readFile(filePath);
  return loadPdfFromBuffer(buf);
}
