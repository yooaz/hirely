/**
 * Safe File → ArrayBuffer reads and clones for pdf.js / pdf-lib (avoid detached buffers).
 */

import { hirelyDebugLog } from '../runtime/hirely-debug.js';

/**
 * @param {File} file
 * @returns {Promise<ArrayBuffer>}
 */
export async function readFileBuffer(file) {
  const buffer = await file.arrayBuffer();
  logExtractionStep('PDF_BUFFER_READ', `${buffer.byteLength}b`);
  return buffer;
}

/**
 * @param {ArrayBuffer} buffer
 * @returns {ArrayBuffer}
 */
export function cloneArrayBuffer(buffer) {
  return buffer.slice(0);
}

/**
 * @param {string} tag
 * @param {string|number} [detail]
 */
export function logExtractionStep(tag, detail) {
  const msg =
    detail != null && detail !== ''
      ? `[Hirely extraction] ${tag} ${detail}`
      : `[Hirely extraction] ${tag}`;
  hirelyDebugLog(msg);
}
