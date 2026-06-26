/**
 * CSP-safe lazy vendor loader — same-origin scripts only (no CDN eval bundles).
 * PDF.js: isEvalSupported=false. DOCX: JSZip ESM + native OOXML (no mammoth).
 */

import {
  TESSERACT_VENDOR_PATHS,
  OcrUnavailableError,
  verifyTesseractVendorAssetsDetailed,
} from './tesseract-runtime.js';
import {
  setOcrDiagnostic,
  markOcrAssetsLoaded,
  setOcrFailReason,
} from '../core/extraction/ocr-runtime-diagnostics.js';

const VENDOR = {
  // Browser-stable local vendor assets.
  // Never load from /node_modules at runtime: some local servers and agents do not expose it.
  pdfJs: '/vendor/pdf.min.mjs',
  pdfWorker: '/vendor/pdf.worker.min.mjs',
  pdfLib: '/vendor/pdf-lib.esm.min.js',
  jszip: '/vendor/jszip.min.js',
  jspdf: '/vendor/jspdf.umd.min.js',
  html2pdf: '/vendor/html2pdf.bundle.min.js',
  tesseract: TESSERACT_VENDOR_PATHS.main,
  tesseractWorker: TESSERACT_VENDOR_PATHS.worker,
};

function loadScript(src, id) {
  const existing = document.querySelector(`script[data-hirely-vendor="${id}"]`);
  if (existing) {
    return existing.dataset.hirelyLoaded === '1'
      ? Promise.resolve()
      : new Promise((resolve, reject) => {
          existing.addEventListener('load', () => resolve(), { once: true });
          existing.addEventListener('error', reject, { once: true });
        });
  }
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.dataset.hirelyVendor = id;
    s.onload = () => {
      s.dataset.hirelyLoaded = '1';
      resolve();
    };
    s.onerror = () => reject(new Error(`HIRELY_VENDOR_LOAD_FAILED:${id}`));
    document.head.appendChild(s);
  });
}

function applyPdfCspGuards(pdfjsLib) {
  if (!pdfjsLib?.GlobalWorkerOptions) return;
  pdfjsLib.GlobalWorkerOptions.workerSrc = VENDOR.pdfWorker;
  pdfjsLib.GlobalWorkerOptions.isEvalSupported = false;
}

export async function ensurePdf() {
  if (globalThis.pdfjsLib) {
    applyPdfCspGuards(globalThis.pdfjsLib);
    return globalThis.pdfjsLib;
  }
  const lib = await import(VENDOR.pdfJs);
  globalThis.pdfjsLib = lib;
  applyPdfCspGuards(lib);
  return lib;
}

export async function ensurePdfLib() {
  if (globalThis.PDFLib) return globalThis.PDFLib;
  const mod = await import(VENDOR.pdfLib);
  globalThis.PDFLib = mod;
  return mod;
}

export async function ensureJsZip() {
  if (globalThis.JSZip) return globalThis.JSZip;
  await loadScript(VENDOR.jszip, 'jszip');
  if (!globalThis.JSZip) throw new Error('JSZip failed to load');
  return globalThis.JSZip;
}

export async function ensureHtml2pdf() {
  if (typeof globalThis.html2pdf === 'function') return globalThis.html2pdf;
  if (!globalThis.jspdf?.jsPDF) {
    await loadScript(VENDOR.jspdf, 'jspdf');
  }
  await loadScript(VENDOR.html2pdf, 'html2pdf');
  if (typeof globalThis.html2pdf !== 'function') {
    throw new Error('html2pdf failed to load');
  }
  return globalThis.html2pdf;
}

export async function ensureTesseract() {
  if (globalThis.Tesseract) return globalThis.Tesseract;

  setOcrDiagnostic('OCR_ASSET_PATH', TESSERACT_VENDOR_PATHS.main);
  setOcrDiagnostic('OCR_WORKER_PATH', TESSERACT_VENDOR_PATHS.worker);
  setOcrDiagnostic(
    'OCR_WASM_PATH',
    `${TESSERACT_VENDOR_PATHS.core}/tesseract-core-simd-lstm.wasm`
  );
  setOcrDiagnostic('OCR_LANG_PATH', TESSERACT_VENDOR_PATHS.lang);

  const assetReport = await verifyTesseractVendorAssetsDetailed();
  const wasmOk =
    assetReport.loaded[`${TESSERACT_VENDOR_PATHS.core}/tesseract-core-simd-lstm.wasm`] ||
    assetReport.loaded[`${TESSERACT_VENDOR_PATHS.core}/tesseract-core-lstm.wasm`];
  const langOk =
    assetReport.loaded[`${TESSERACT_VENDOR_PATHS.lang}/eng.traineddata.gz`] &&
    assetReport.loaded[`${TESSERACT_VENDOR_PATHS.lang}/fra.traineddata.gz`];
  markOcrAssetsLoaded({ wasm: wasmOk, lang: langOk });

  if (!assetReport.ok) {
    setOcrFailReason(`OCR_ASSETS_MISSING:${assetReport.missing.join(',')}`);
    throw new OcrUnavailableError(
      'Local OCR assets missing — run npm run setup:ocr',
      'OCR_ASSETS_MISSING'
    );
  }
  try {
    await loadScript(VENDOR.tesseract, 'tesseract');
    markOcrAssetsLoaded({ worker: true });
    setOcrDiagnostic('OCR_WORKER_LOADED', true);
  } catch (err) {
    setOcrFailReason(`OCR_SCRIPT_LOAD_FAILED:${err?.message || 'unknown'}`);
    throw new OcrUnavailableError(
      err?.message || 'Tesseract script failed to load',
      'OCR_SCRIPT_LOAD_FAILED'
    );
  }
  if (!globalThis.Tesseract) {
    setOcrFailReason('OCR_SCRIPT_LOAD_FAILED:global_missing');
    throw new OcrUnavailableError('Tesseract global missing after load', 'OCR_SCRIPT_LOAD_FAILED');
  }
  globalThis.HIRELY_TESSERACT_LOCAL = true;
  return globalThis.Tesseract;
}

export const HIRELY_CSP_VENDOR_PATHS = { ...VENDOR };
