/**
 * H8 — synthetic OCR layer for stress corpus (noise → postProcessOcrText).
 */
import { postProcessOcrText } from '../../src/core/parsing/ocr-postprocess.js';

/**
 * Apply mild scan-like noise then run production OCR post-process.
 * @param {string} canonicalText
 * @param {number} [seed]
 */
export function simulateOcrScan(canonicalText, seed = 0) {
  let t = String(canonicalText || '');
  if (!t.trim()) return t;

  if (seed % 4 === 0) t = t.replace(/\bExperience\b/g, 'Expérience');
  if (seed % 5 === 1) t = t.replace(/\bEducation\b/g, 'Formation');
  if (seed % 6 === 2) t = t.replace(/\bSkills\b/g, 'Compétences');

  t = t
    .replace(/·/g, '  ·  ')
    .replace(/([a-z])\.([A-Z])/g, '$1. $2')
    .replace(/(\d{4})\s*–\s*(\d{4}|Present)/g, '$1 - $2');

  if (seed % 3 === 0) {
    t = t
      .split('\n')
      .map((line, i) => (i % 7 === 0 && line.trim() ? ` ${line.trim()} ` : line))
      .join('\n');
  }

  return postProcessOcrText(t, { ocr: true });
}

/**
 * Image scan (PNG/JPG) — extra fragmentation on top of OCR sim.
 * @param {string} canonicalText
 * @param {number} [seed]
 * @param {'PNG'|'JPG'} [format]
 */
export function simulateImageScan(canonicalText, seed = 0, format = 'PNG') {
  let t = simulateOcrScan(canonicalText, seed);
  if (format === 'JPG') {
    t = t.replace(/\n{3,}/g, '\n\n');
  }
  t = t
    .split('\n')
    .map((line, i) => (i % 6 === 0 && line.trim() ? ` ${line.trim().replace(/ /g, '  ')} ` : line))
    .join('\n');
  return postProcessOcrText(t, { ocr: true });
}
