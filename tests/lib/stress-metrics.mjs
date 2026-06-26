/**
 * Stress-test metrics — extraction, classification, confidence, text loss.
 */

import { measureTextRetention } from '../../src/core/extraction/stages/extraction-archive.js';

const BUCKET_TO_CV_KEYS = {
  experience: ['experience'],
  education: ['education'],
  skills: ['skills'],
  tools: ['tools'],
  languages: ['languages'],
  clients: ['clients'],
  projects: ['projects'],
  awards: ['awards'],
  exhibitions: ['exhibitions'],
  publications: ['publications'],
  contact: ['email', 'phone', 'linkedin', 'portfolio'],
  summary: ['summary'],
  identity: ['name', 'title'],
};

/**
 * @param {object} cv
 * @param {string} bucket
 */
export function cvBucketBlob(cv, bucket) {
  const keys = BUCKET_TO_CV_KEYS[bucket] || [bucket];
  const parts = [];
  for (const key of keys) {
    const val = cv?.[key];
    if (Array.isArray(val)) parts.push(...val.map(String));
    else if (val) parts.push(String(val));
  }
  return parts.join('\n').toLowerCase();
}

/**
 * @param {object} cv
 * @param {{ text: string, bucket: string }} anchor
 */
export function anchorInBucket(cv, anchor) {
  const needle = String(anchor.text || '').trim().toLowerCase();
  if (!needle || needle.length < 2) return false;
  const blob = cvBucketBlob(cv, anchor.bucket);
  if (blob.includes(needle)) return true;
  const anywhere = [
    cv?.name,
    cv?.title,
    cv?.summary,
    cv?.email,
    ...(cv?.experience || []),
    ...(cv?.education || []),
    ...(cv?.skills || []),
    ...(cv?.tools || []),
    ...(cv?.languages || []),
    ...(cv?.clients || []),
    ...(cv?.projects || []),
    ...(cv?.awards || []),
    ...(cv?.exhibitions || []),
    ...(cv?.publications || []),
  ]
    .filter(Boolean)
    .join('\n')
    .toLowerCase();
  return anywhere.includes(needle);
}

/**
 * Semantic classification accuracy from labeled anchors.
 * @param {object} cv
 * @param {Array<{ text: string, bucket: string }>} anchors
 */
export function anchorClassificationPct(cv, anchors = []) {
  const list = anchors.filter((a) => a.text && a.bucket);
  if (!list.length) return 100;
  let hit = 0;
  const misses = [];
  for (const a of list) {
    if (anchorInBucket(cv, a)) hit += 1;
    else misses.push(a);
  }
  return {
    pct: Math.round((hit / list.length) * 1000) / 10,
    hit,
    total: list.length,
    misses,
  };
}

/**
 * Structural block classification rate (P0 classified blocks).
 * @param {object} pipelineResult
 */
export function blockClassificationPct(pipelineResult) {
  const blocks =
    pipelineResult?.stages?.documentBlocks?.documentBlocks ||
    pipelineResult?.stages?.documentBlocks?.classifiedBlocks ||
    pipelineResult?.stages?.parser?.classifiedBlocks ||
    pipelineResult?.classifiedBlocks ||
    [];
  if (!blocks.length) return { pct: 0, classified: 0, total: 0, avgConfidence: 0 };
  const good = blocks.filter(
    (b) => b.type && b.type !== 'unknown' && b.accepted !== false && (b.confidence ?? 0) >= 50
  );
  const confSum = blocks.reduce((s, b) => s + (Number(b.confidence) || 0), 0);
  return {
    pct: Math.round((good.length / blocks.length) * 1000) / 10,
    classified: good.length,
    total: blocks.length,
    avgConfidence: Math.round(confSum / blocks.length),
  };
}

/**
 * @param {object} pipelineResult
 * @param {string} rawText
 */
export function extractStressMetrics(pipelineResult, rawText) {
  const cv = pipelineResult?.validatedCVData || pipelineResult?.structured || {};
  const raw = pipelineResult?.rawText || rawText || '';
  const cleaned = pipelineResult?.cleanedText || raw;
  const retention =
    pipelineResult?.retention ||
    measureTextRetention(raw, cleaned, cv, pipelineResult?.stages?.archive?.lines || []);

  const extractionPct =
    pipelineResult?.extractionScore?.retentionPct ??
    pipelineResult?.retention?.retentionPct ??
    retention.retentionPct ??
    0;

  const extractionScore =
    pipelineResult?.extractionScore?.extractionScore ??
    pipelineResult?.audit?.extractionScore ??
    pipelineResult?.assessment?.extractionScore ??
    null;

  const confidence =
    pipelineResult?.parseConfidence ??
    pipelineResult?.confidenceReport?.overall ??
    pipelineResult?.assessment?.fieldConfidence?.overall ??
    blockClassificationPct(pipelineResult).avgConfidence ??
    0;

  const textLossPct = retention.lossPct ?? Math.max(0, 100 - extractionPct);

  const archive = pipelineResult?.stages?.archive || {};
  const lineCount = archive.lineCount ?? pipelineResult?.stages?.archive?.lineCount ?? 0;
  const avgLineConfidence = archive.avgConfidence ?? null;

  return {
    extractionPct: Math.round(extractionPct * 10) / 10,
    extractionScore,
    confidence: Math.round(confidence),
    textLossPct: Math.round(textLossPct * 10) / 10,
    retentionPct: Math.round((retention.retentionPct ?? extractionPct) * 10) / 10,
    rawChars: retention.rawLength ?? raw.length,
    structuredChars: retention.structuredLength ?? 0,
    lineCount,
    avgLineConfidence,
    layoutType: pipelineResult?.layoutType || pipelineResult?.stages?.layout?.layoutType || '—',
    reviewPending: (pipelineResult?.reviewQueue || []).filter((r) => r.status === 'pending').length,
  };
}

/**
 * @param {object} pipelineResult
 * @param {string} rawText
 * @param {Array<{ text: string, bucket: string }>} anchors
 */
export function fullStressMetrics(pipelineResult, rawText, anchors = []) {
  const base = extractStressMetrics(pipelineResult, rawText);
  const blocks = blockClassificationPct(pipelineResult);
  const anchorsResult = anchorClassificationPct(pipelineResult?.validatedCVData || {}, anchors);

  const classificationPct = Math.round(
    anchors.length > 0 ? anchorsResult.pct * 0.6 + blocks.pct * 0.4 : blocks.pct
  );

  return {
    ...base,
    classificationPct,
    blockClassificationPct: blocks.pct,
    anchorClassificationPct: anchorsResult.pct,
    anchorsHit: anchorsResult.hit,
    anchorsTotal: anchorsResult.total,
    anchorMisses: anchorsResult.misses.slice(0, 5),
    blocksClassified: blocks.classified,
    blocksTotal: blocks.total,
  };
}
