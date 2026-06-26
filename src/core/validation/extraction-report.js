/**
 * Stage 7 extraction report — PDF type, layout, chars, sections, confidence per section.
 */

import { CONTENT_RETENTION_TARGET_PCT } from '../extraction/stages/extraction-archive.js';
import { EXTRACTION_ACCURACY_TARGET_PCT } from '../parsing/stages/extraction-score-stage.js';

/**
 * @param {object} pipelineResult
 */
export function generateExtractionReport(pipelineResult = {}) {
  const stages = pipelineResult.stages || {};
  const doc = stages.document || {};
  const layout = stages.layout || {};
  const archive = stages.archive || stages.extraction || {};
  const score = stages.score || {};
  const parser = stages.parser || {};
  const validation = stages.validation || {};
  const retention = pipelineResult.retention || {};
  const structuredResume = pipelineResult.structuredResume || null;

  const missingSections = [
    ...(validation.missingFields || []),
    ...(parser.missingBuckets || []),
  ].filter(Boolean);

  const sectionConfidence = score.sectionConfidence || structuredResume?.sectionConfidence || {};

  const report = {
    engine: score.engine || 'hirely-extraction-7-stage-v1',
    pipelineVersion: 7,
    at: new Date().toISOString(),
    documentType: doc.documentType || score.pdfType || pipelineResult.extractionMethod || 'unknown',
    documentLabel: doc.label || score.pdfLabel || doc.documentType,
    useOcr: doc.useOcr ?? score.useOcr ?? false,
    nativeTextLayer: doc.nativeTextLayer ?? score.nativeTextLayer ?? false,
    ocrPolicy: doc.ocrPolicy || 'none',
    layoutType: layout.layoutType || score.layoutType || 'unknown',
    layoutConfidence: layout.confidence ?? score.layoutConfidence ?? null,
    layoutSignals: layout.signals || [],
    extractionMethod: archive.method || pipelineResult.extractionMethod || 'paste',
    rawLength: score.rawChars ?? retention.rawLength ?? archive.rawExtraction?.length ?? 0,
    cleanLength: score.cleanChars ?? retention.cleanLength ?? archive.cleanedText?.length ?? 0,
    structuredLength: score.structuredChars ?? retention.structuredLength ?? 0,
    lineCount: archive.lineCount ?? score.lineCount ?? 0,
    readingBlockCount: stages.readingBlocks?.blockCount ?? 0,
    lossPercentage: retention.lossPct ?? 0,
    retentionPercentage: retention.retentionPct ?? 0,
    extractionScore: score.extractionScore ?? null,
    meetsAccuracyTarget:
      score.meetsAccuracyTarget !== false &&
      (score.extractionScore ?? 100) >= EXTRACTION_ACCURACY_TARGET_PCT,
    accuracyTargetPct: EXTRACTION_ACCURACY_TARGET_PCT,
    meetsRetentionTarget:
      retention.meetsTarget !== false &&
      (retention.retentionPct ?? 100) >= CONTENT_RETENTION_TARGET_PCT,
    retentionTargetPct: CONTENT_RETENTION_TARGET_PCT,
    avgLineConfidence: archive.avgConfidence ?? null,
    sectionsFound: score.sectionsFound || [],
    sectionConfidence,
    avgSectionConfidence: score.avgSectionConfidence ?? null,
    confidence: {
      extraction: archive.avgConfidence ?? null,
      layout: layout.confidence ?? null,
      document: doc.confidence ?? null,
      parse: parser.parseConfidence ?? score.avgSectionConfidence ?? null,
      overall: score.extractionScore ?? null,
    },
    missingSections: [...new Set(missingSections)],
    missingFields: validation.missingFields || [],
    reviewQueueCount:
      score.reviewQueueCount ??
      validation.pendingReview?.length ??
      validation.reviewQueue?.length ??
      0,
    conflictCount: stages.conflict?.conflictCount ?? 0,
    dictionaryBoostedBlocks: stages.dictionary?.boostedBlockCount ?? 0,
    sectionViolations: stages.sectionValidator?.violationCount ?? 0,
    neverEmptyCv: validation.neverEmpty !== false,
    parserBuckets: parser.bucketCounts || null,
    creativeDictionary: pipelineResult.creativeDictionary || null,
    warnings: [
      ...(validation.warnings || []),
      ...(retention.meetsTarget === false
        ? [`Content retention ${retention.retentionPct}% below ${CONTENT_RETENTION_TARGET_PCT}% target`]
        : []),
      ...(score.meetsAccuracyTarget === false
        ? [`Extraction score ${score.extractionScore}% below ${EXTRACTION_ACCURACY_TARGET_PCT}% target`]
        : []),
    ],
    stages: {
      document: !!stages.document,
      layout: !!stages.layout,
      readingBlocks: !!stages.readingBlocks,
      blockClassification: !!stages.blockClassification,
      dictionary: !!stages.dictionary,
      sectionValidator: !!stages.sectionValidator,
      conflict: !!stages.conflict,
      score: !!stages.score,
      parser: !!stages.parser,
      validation: !!stages.validation,
    },
  };

  return report;
}

/**
 * @param {object} report
 */
export function printExtractionReport(report) {
  console.log('\n═══ HIRELY 7-Stage Extraction Report ═══');
  console.log(`PDF type: ${report.documentLabel} (${report.documentType}) · OCR: ${report.useOcr ? 'yes' : 'no'}`);
  console.log(`Layout: ${report.layoutType} (${report.layoutConfidence ?? '—'}%)`);
  console.log(
    `Chars: raw=${report.rawLength} clean=${report.cleanLength} structured=${report.structuredLength} · blocks=${report.readingBlockCount}`
  );
  console.log(
    `Retention: ${report.retentionPercentage}% · Extraction score: ${report.extractionScore ?? '—'}% · target ≥${report.accuracyTargetPct}% · ${report.meetsAccuracyTarget ? 'PASS' : 'WARN'}`
  );
  if (report.sectionsFound?.length) {
    console.log(`Sections: ${report.sectionsFound.join(', ')}`);
    const conf = Object.entries(report.sectionConfidence || {})
      .map(([k, v]) => `${k}:${v}%`)
      .join(' · ');
    if (conf) console.log(`Section confidence: ${conf}`);
  }
  if (report.missingSections.length) {
    console.log(`Missing: ${report.missingSections.join(', ')}`);
  }
  console.log(
    `Review: ${report.reviewQueueCount} · conflicts ${report.conflictCount} · dict boosts ${report.dictionaryBoostedBlocks}`
  );
  if (report.warnings?.length) {
    console.log(`Warnings: ${report.warnings.slice(0, 5).join(' | ')}`);
  }
  console.log('');
}
