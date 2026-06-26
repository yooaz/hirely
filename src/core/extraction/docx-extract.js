/**
 * DOCX → plain text with paragraph boundaries (OOXML recovery + Mammoth HTML).
 */

import { normalizeRawExtract, repairCompactWordBoundaries } from '../parsing/clean.js';
import {
  recoverDocxStructure,
  auditDocxStructureRecovery,
  DOCX_RECOVERY_VERSION,
} from './docx-structure-recovery.js';

export { recoverDocxStructure, auditDocxStructureRecovery, DOCX_RECOVERY_VERSION };

function decodeHtmlEntities(html) {
  return String(html || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'");
}

/**
 * @param {string} html
 */
export function mammothHtmlToPlainText(html) {
  let s = decodeHtmlEntities(String(html || ''));
  s = s
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n')
    .replace(/<\/div>\s*<div[^>]*>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/li>\s*<li[^>]*>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<\/tr>\s*<tr[^>]*>/gi, '\n')
    .replace(/<\/td>\s*<td[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, '');
  return repairCompactWordBoundaries(
    s
      .split('\n')
      .map((l) => l.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .join('\n')
  );
}

/**
 * @param {ArrayBuffer} buffer
 * @param {object} mammoth
 */
function mammothInputFromBuffer(buffer) {
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(buffer)) {
    return { buffer };
  }
  const nodeBuffer = Buffer.from(buffer);
  return { buffer: nodeBuffer };
}

/**
 * Full structure recovery result (OOXML + Mammoth merge).
 * @param {ArrayBuffer} buffer
 * @param {object} mammoth
 */
export async function extractDocxWithRecovery(buffer, mammoth) {
  return recoverDocxStructure(buffer, mammoth);
}

/**
 * @param {ArrayBuffer} buffer
 * @param {object} mammoth
 */
export async function extractDocxTextFromBuffer(buffer, mammoth) {
  const recovered = await recoverDocxStructure(buffer, mammoth);
  return normalizeRawExtract(recovered.text);
}
