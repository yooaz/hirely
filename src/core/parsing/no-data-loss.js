/**
 * No data loss rule — never discard useful extracted text.
 * Unclassified content → unsorted. Utilization vs cleanedText ≥ 70% or warn.
 */

import { recoverOrphanLinesToUnsorted } from './parser-recovery.js';
import { isSectionHeaderLine } from './rich-parser.js';
import { isLineCorruptedForExport } from './corruption-detector.js';
import { flattenCvDataPreservedText, flattenStructuredPreservedText } from '../../debug/cv-preserved-text.js';
import { capUnsortedPractical } from '../pipeline/pipeline-contract.js';
import { applyZeroTextLossMode, isZeroTextLossMode } from './zero-text-loss.js';

export const FINAL_CV_UTILIZATION_MIN_PCT = 80;

export function capUnsortedWithArchive(unsorted = [], archive = []) {
  const merged = [
    ...(unsorted || []),
    ...(archive || []).map((x) => (typeof x === 'string' ? x : x?.text || '')),
  ];
  const display = capUnsortedPractical(merged);
  const overflow = merged
    .map((x) => String(x || '').trim())
    .filter(Boolean)
    .filter((t) => !display.some((d) => d.toLowerCase() === t.toLowerCase()))
    .slice(0, 120)
    .map((text) => ({ text, reason: 'display_cap' }));
  return {
    unsorted: display,
    unsortedArchive: overflow,
  };
}

function normLine(s) {
  return String(s || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * @param {string[]} existing
 * @param {...(string[]|string)} batches
 */
export function mergeUnsortedLines(existing = [], ...batches) {
  const seen = new Set((existing || []).map((x) => normLine(x)).filter(Boolean));
  const out = [...(existing || [])].map((x) => String(x || '').trim()).filter(Boolean);
  for (const batch of batches) {
    const list = Array.isArray(batch) ? batch : [batch];
    for (const raw of list) {
      const t = String(raw || '').trim();
      if (!t || t.length < 3 || isSectionHeaderLine(t)) continue;
      if (isLineCorruptedForExport(t)) continue;
      const k = normLine(t);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      out.push(t);
    }
  }
  return out.slice(0, 96);
}

/**
 * All user-visible CV text (for retention accounting).
 * @param {object} cvData
 */
export function flattenCvPreservedText(cvData) {
  return flattenCvDataPreservedText(cvData);
}

export { flattenStructuredPreservedText };

function lineAccountedFor(line, blob) {
  const k = normLine(line);
  if (!k || k.length < 3) return true;
  if (blob.includes(k)) return true;
  if (k.length >= 12) {
    const words = k.split(/\s+/).filter((w) => w.length > 2);
    if (words.length >= 2) {
      const hits = words.filter((w) => blob.includes(w)).length;
      if (hits / words.length >= 0.6) return true;
    }
  }
  return false;
}

/**
 * How much of cleanedText appears in final CV fields (by line).
 * @param {string} cleanedText
 * @param {object} cvData
 */
export function measureCleanedTextUtilization(cleanedText, cvData) {
  const clean = String(cleanedText || '').trim();
  const cleanLen = Math.max(1, clean.length);
  const blob = normLine(flattenCvPreservedText(cvData));
  const lines = clean.split('\n').map((l) => l.trim()).filter((l) => l.length >= 3);
  let accountedChars = 0;
  let orphanLines = 0;
  for (const line of lines) {
    if (lineAccountedFor(line, blob)) accountedChars += line.length;
    else orphanLines += 1;
  }
  const utilizationPct = Math.min(100, Math.round((accountedChars / cleanLen) * 1000) / 10);
  const meetsTarget = utilizationPct >= FINAL_CV_UTILIZATION_MIN_PCT;
  return {
    cleanLength: cleanLen,
    accountedChars,
    utilizationPct,
    orphanLineCount: orphanLines,
    meetsTarget,
    warning: meetsTarget
      ? null
      : `Final CV uses ${utilizationPct}% of cleaned text (minimum ${FINAL_CV_UTILIZATION_MIN_PCT}%)`,
  };
}

/**
 * Lines from blocks not represented in structured fields → unsorted.
 * @param {object} structured
 * @param {object[]} blocks
 */
export function routeUnclassifiedBlocksToUnsorted(structured, blocks = []) {
  const s = structured || {};
  const blob = normLine(flattenStructuredPreservedText(s));
  const extra = [];
  for (const block of blocks || []) {
    const texts = block.lines?.length
      ? block.lines.map((l) => String(l.cleanedText ?? l.text ?? '').trim()).filter(Boolean)
      : String(block.text || '')
          .split('\n')
          .map((t) => t.trim())
          .filter(Boolean);
    for (const t of texts) {
      if (!t || t.length < 3) continue;
      if (lineAccountedFor(t, blob)) continue;
      extra.push(t);
    }
  }
  s.unsorted = mergeUnsortedLines(s.unsorted, extra);
  return s;
}

/**
 * @param {object} opts
 */
export function enforceNoDataLossRule(opts = {}) {
  const rawText = String(opts.rawText || '').trim();
  const cleanedText = String(opts.cleanedText || rawText).trim();
  let cvData = { ...(opts.cvData || {}) };
  let structuredResume = opts.structuredResume
    ? { ...opts.structuredResume }
    : cvData.structuredResume
      ? { ...cvData.structuredResume }
      : null;

  const lineSources = [
    cleanedText.split('\n'),
    opts.rejectedLines || [],
    opts.uncertainLines || [],
  ];

  for (const block of opts.reviewBlocks || []) {
    if (block.text) lineSources.push(String(block.text).split('\n'));
    if (block.lines?.length) {
      lineSources.push(block.lines.map((l) => String(l.cleanedText ?? l.text ?? '').trim()));
    }
  }

  for (const item of opts.reviewQueue || []) {
    const t = String(item?.sourceText || item?.detected || '').trim();
    if (t) lineSources.push(t.split('\n'));
  }

  cvData.unsorted = mergeUnsortedLines(
    cvData.unsorted,
    ...lineSources,
    cvData.unknownExperience
  );

  const orphanLines = recoverOrphanLinesToUnsorted(cleanedText.split('\n').filter(Boolean), cvData);
  cvData.unsorted = mergeUnsortedLines(cvData.unsorted, orphanLines);

  const utilizationPreview = measureCleanedTextUtilization(cleanedText, cvData);
  if (!utilizationPreview.meetsTarget) {
    const blob = normLine(flattenCvPreservedText(cvData));
    const unaccounted = cleanedText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length >= 3 && !lineAccountedFor(l, blob));
    cvData.unsorted = mergeUnsortedLines(cvData.unsorted, unaccounted);
    if (structuredResume) {
      structuredResume.unsorted = mergeUnsortedLines(structuredResume.unsorted, unaccounted);
    }
  }

  if (structuredResume) {
    if (opts.blocks?.length) {
      structuredResume = routeUnclassifiedBlocksToUnsorted(structuredResume, opts.blocks);
    }
    structuredResume.unsorted = mergeUnsortedLines(
      structuredResume.unsorted,
      cvData.unsorted,
      opts.rejectedLines,
      opts.uncertainLines
    );
    structuredResume.metadata = {
      ...(structuredResume.metadata || {}),
      rawText: rawText || structuredResume.metadata?.rawText,
      cleanedText: cleanedText || structuredResume.metadata?.cleanedText,
      noDataLoss: true,
    };
    cvData.structuredResume = structuredResume;
  }

  cvData.rawText = rawText || cvData.rawText || '';
  cvData.cleanedText = cleanedText || cvData.cleanedText || '';
  cvData.blocks = opts.blocks || cvData.blocks || null;

  const capped = capUnsortedWithArchive(
    cvData.unsorted,
    structuredResume?.metadata?.unsortedArchive || structuredResume?.unsortedArchive
  );
  cvData.unsorted = capped.unsorted;
  if (structuredResume) {
    structuredResume.unsorted = capped.unsorted;
    structuredResume.metadata = {
      ...(structuredResume.metadata || {}),
      unsortedArchive: capped.unsortedArchive,
    };
    structuredResume.unsortedArchive = capped.unsortedArchive;
    cvData.structuredResume = structuredResume;
  }

  if (isZeroTextLossMode() && structuredResume) {
    const rawForLoss = rawText || structuredResume.rawExtraction || '';
    const ztl = applyZeroTextLossMode(rawForLoss, structuredResume, {
      throwOnLoss: opts.throwOnPipelineLoss !== false,
    });
    structuredResume = ztl.structured;
    cvData.structuredResume = structuredResume;
    cvData.meta = {
      ...(cvData.meta || {}),
      zeroTextLossAudit: ztl.audit,
      UNSORTED_ARCHIVE: structuredResume.metadata?.UNSORTED_ARCHIVE,
    };
  }

  const utilization = measureCleanedTextUtilization(cleanedText, cvData);
  const renderable = cvDataIsRenderableWithUnsorted(cvData);

  return {
    cvData,
    structuredResume,
    utilization,
    renderable,
    zeroTextLossAudit: structuredResume?.metadata?.zeroTextLossAudit || null,
    incomplete: !renderable || !utilization.meetsTarget,
    warnings: [
      ...(utilization.warning ? [utilization.warning] : []),
      ...(!renderable ? ['CV preview has no renderable content — check import or paste full text'] : []),
    ],
  };
}

export function cvDataIsRenderableWithUnsorted(d) {
  if (!d) return false;
  const has =
    !!(d.name && String(d.name).trim().length > 1) ||
    !!(d.title && String(d.title).trim().length > 1) ||
    !!(d.summary && String(d.summary).length > 5) ||
    (d.experience && d.experience.length) ||
    (d.unknownExperience && d.unknownExperience.length) ||
    (d.education && d.education.length) ||
    (d.skills && d.skills.length) ||
    (d.tools && d.tools.length) ||
    (d.unsorted && d.unsorted.length) ||
    (d.toClassify && d.toClassify.length);
  return has;
}
