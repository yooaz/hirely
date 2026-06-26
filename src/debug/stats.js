/**
 * Text metrics for extraction debug / loss audit.
 */

import { flattenCvDataPreservedText } from './cv-preserved-text.js';

export function textStats(text) {
  const s = String(text || '');
  const rawLines = s.split('\n');
  const trimmed = rawLines.map((l) => l.trim()).filter((l) => l.length > 0);
  return {
    chars: s.length,
    lines: rawLines.length,
    nonEmptyLines: trimmed.length,
    words: s.trim().split(/\s+/).filter(Boolean).length,
  };
}

export function linesRemoved(raw, cleaned) {
  const rawLines = String(raw || '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 1);
  const cleanSet = new Set(
    String(cleaned || '')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
  );
  const removed = [];
  for (const line of rawLines) {
    if (!cleanSet.has(line)) removed.push(line);
  }
  return {
    count: removed.length,
    sample: removed.slice(0, 12),
  };
}

export function structuredCharCount(cv) {
  if (!cv) return 0;
  return flattenCvDataPreservedText(cv).length;
}

export function lossRatio(before, after) {
  const b = Math.max(1, before);
  return Math.max(0, Math.min(1, 1 - after / b));
}
