/**
 * Stage 7 — Extraction score (PDF type, layout, chars, sections, per-section confidence).
 */

export const EXTRACTION_ACCURACY_TARGET_PCT = 95;

/**
 * @param {object} opts
 */
export function runExtractionScoreStage(opts = {}) {
  const doc = opts.document || {};
  const layout = opts.layout || {};
  const archive = opts.archive || {};
  const blocks = opts.blocks || [];
  const structuredResume = opts.structuredResume || null;
  const retention = opts.retention || {};
  const validation = opts.validation || {};

  const sectionConfidence = structuredResume?.sectionConfidence || {};
  const sectionsFound = [];
  const sectionScores = {};

  const bucketFromResume = {
    identity: structuredResume?.identity?.name ? 85 : 0,
    summary: structuredResume?.summary ? 80 : 0,
    experience: (structuredResume?.experiences || []).length,
    education: (structuredResume?.education || []).length,
    clients: (structuredResume?.clients || []).length,
    skills: (structuredResume?.skills || []).length,
    tools: (structuredResume?.tools || []).length,
    languages: (structuredResume?.languages || []).length,
    contact:
      structuredResume?.identity?.email || structuredResume?.identity?.phone ? 90 : 0,
  };

  for (const [key, val] of Object.entries(bucketFromResume)) {
    if (typeof val === 'number' && val > 0 && val < 20) {
      sectionsFound.push(key);
      sectionScores[key] = sectionConfidence[key] ?? Math.min(95, 70 + val * 4);
    } else if (val >= 20) {
      sectionsFound.push(key);
      sectionScores[key] = sectionConfidence[key] ?? val;
    }
  }

  for (const b of blocks) {
    if (b.kind === 'section_header' || !b.bucket || b.bucket === 'unknown') continue;
    if (!sectionsFound.includes(b.bucket)) sectionsFound.push(b.bucket);
    sectionScores[b.bucket] = Math.max(sectionScores[b.bucket] || 0, b.confidence || 0);
  }

  const avgSection =
    sectionsFound.length > 0
      ? Math.round(
          sectionsFound.reduce((s, k) => s + (sectionScores[k] || 0), 0) / sectionsFound.length
        )
      : 0;

  const retentionPct = retention.retentionPct ?? 100;
  const parseScore = opts.parserScore ?? avgSection;
  const extractionScore = Math.round(
    retentionPct * 0.35 + parseScore * 0.45 + (doc.confidence ?? 80) * 0.1 + (layout.confidence ?? 70) * 0.1
  );

  return {
    stage: 7,
    engine: 'hirely-extraction-7-stage-v1',
    pdfType: doc.documentType || doc.fileType || 'unknown',
    pdfLabel: doc.label || doc.documentType,
    useOcr: doc.useOcr === true,
    nativeTextLayer: doc.nativeTextLayer === true,
    layoutType: layout.layoutType || 'unknown',
    layoutConfidence: layout.confidence ?? null,
    rawChars: retention.rawLength ?? archive.rawExtraction?.length ?? 0,
    cleanChars: retention.cleanLength ?? archive.cleanedText?.length ?? 0,
    structuredChars: retention.structuredLength ?? 0,
    lineCount: archive.lineCount ?? 0,
    sectionsFound: [...new Set(sectionsFound)],
    sectionConfidence: sectionScores,
    avgSectionConfidence: avgSection,
    extractionScore,
    retentionPct,
    meetsAccuracyTarget: extractionScore >= EXTRACTION_ACCURACY_TARGET_PCT,
    accuracyTargetPct: EXTRACTION_ACCURACY_TARGET_PCT,
    reviewQueueCount: validation.pendingReview?.length ?? 0,
    neverEmpty: validation.neverEmpty !== false,
    at: new Date().toISOString(),
  };
}
