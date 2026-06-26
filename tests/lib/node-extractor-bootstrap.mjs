/**
 * Bootstrap mammoth + pdfjs for Node import QA scripts.
 */
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

export async function bootstrapNodeExtractors() {
  if (!globalThis.mammoth) {
    const m = await import('mammoth');
    globalThis.mammoth = m.default || m;
  }
  if (!globalThis.JSZip) {
    const z = await import('jszip');
    globalThis.JSZip = z.default || z;
  }
  if (!globalThis.pdfjsLib) {
    try {
      const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');
      pdfjs.GlobalWorkerOptions.workerSrc = require.resolve(
        'pdfjs-dist/legacy/build/pdf.worker.js'
      );
      globalThis.pdfjsLib = pdfjs;
      return;
    } catch {
      /* pdfjs v4+ */
    }
    const pdfjs = await import('pdfjs-dist/build/pdf.mjs');
    const lib = pdfjs.default || pdfjs;
    lib.GlobalWorkerOptions.workerSrc = require.resolve(
      'pdfjs-dist/build/pdf.worker.mjs'
    );
    globalThis.pdfjsLib = lib;
  }
}
