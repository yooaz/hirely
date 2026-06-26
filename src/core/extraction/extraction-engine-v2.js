/**
 * HIRELY EXTRACTION ENGINE V2
 *
 * Pipeline:
 *   PDF/file → OCR detection → text normalization → section detection
 *   → entity extraction → confidence scoring → structured CV JSON
 *
 * Wraps production pipeline + V2 post-processing (skills/languages guard, field confidence).
 */

import { postProcessOcrText, looksLikeOcrText } from '../parsing/ocr-postprocess.js';
import { runProductionExtractionPipeline } from '../pipeline/production-pipeline.js';
import { runRecruiterExtractionPipeline } from './recruiter-extraction-pipeline.js';
import { cvDataV2ToLegacy, cvDataV2ToResumeData, CVDATA_V2_VERSION } from './cv-data-v2.js';
import { applySkillsLanguagesGuard } from './skills-languages-guard.js';
import {
  applyFieldConfidenceV2,
  scoreCvFieldConfidence,
  FIELD_REVIEW_THRESHOLD,
  EXTRACTION_FIELD_CONFIDENCE_V2,
} from './field-confidence-v2.js';
import { mergeReviewQueues } from '../parsing/review-queue-merge.js';

export const EXTRACTION_ENGINE_V2 = 'EXTRACTION_ENGINE_V2';

/**
 * Stage 2 — normalize OCR/native text before parsing.
 * @param {string} rawText
 * @param {object} [opts]
 */
export function normalizeExtractionTextV2(rawText, opts = {}) {
  const raw = String(rawText || '').trim();
  if (!raw) return { text: '', ocrDetected: false, steps: [] };

  const ocrDetected = opts.ocrDetected ?? looksLikeOcrText(raw);
  let text = raw;
  const steps = ['trim'];

  if (ocrDetected || opts.forceOcrRepair) {
    text = postProcessOcrText(text, { aggressive: opts.aggressiveOcr !== false });
    steps.push('ocr_postprocess');
  }

  text = text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
  steps.push('whitespace_normalize');

  return { text, ocrDetected, steps, charCount: text.length };
}

/**
 * Build structured CV JSON contract from pipeline output.
 * @param {object} pipeResult
 */
export function buildStructuredCvJsonV2(pipeResult = {}) {
  const cv = pipeResult.validatedCVData || pipeResult.structured || {};
  const sr = pipeResult.structuredResume || cv.structuredResume || {};

  return {
    version: EXTRACTION_ENGINE_V2,
    identity: {
      name: cv.name || sr.identity?.name || '',
      title: cv.title || sr.identity?.title || '',
      location: cv.location || sr.identity?.location || '',
      email: cv.email || sr.identity?.email || '',
      phone: cv.phone || sr.identity?.phone || '',
      website: cv.portfolio || cv.website || sr.identity?.website || '',
      linkedin: cv.linkedin || sr.identity?.linkedin || '',
    },
    summary: cv.summary || sr.summary || '',
    experience: cv.experience || sr.experiences || [],
    education: cv.education || sr.education || [],
    skills: cv.skills || sr.skills || [],
    tools: cv.tools || sr.tools || [],
    languages: cv.languages || sr.languages || [],
    certifications: cv.certifications || sr.certifications || [],
    projects: cv.projects || sr.projects || [],
    achievements: cv.awards || cv.achievements || sr.awards || [],
    clients: cv.clients || sr.clients || [],
    unsorted: cv.unsorted || sr.unsorted || [],
    sectionsFound: pipeResult.extractionReport?.sectionsFound || sr.metadata?.sectionsDetected || [],
    meta: {
      extractionMethod: pipeResult.extractionMethod || 'paste',
      documentType: pipeResult.documentType || '',
      ocrDetected: pipeResult.audit?.ocrDetected,
      pipelineVersion: pipeResult.pipelineVersion,
    },
  };
}

/**
 * Apply V2 post-processing to pipeline cvData.
 * @param {object} cvData
 * @param {object[]} [existingReview]
 */
export function postProcessCvDataV2(cvData = {}, existingReview = []) {
  const guard = applySkillsLanguagesGuard(cvData);
  let next = guard.cvData;

  const mergedReview = mergeReviewQueues(existingReview, guard.reviewItems);
  next.reviewQueue = mergedReview;

  next = applyFieldConfidenceV2(next);

  return {
    cvData: next,
    guard,
    fieldConfidence: next.meta?.fieldConfidenceV2,
    reviewQueue: next.reviewQueue || [],
  };
}

/**
 * Run full Extraction Engine V2 on raw text.
 * @param {string} rawText
 * @param {object} [opts]
 */
export async function runExtractionEngineV2(rawText, opts = {}) {
  const norm = normalizeExtractionTextV2(rawText, {
    ocrDetected: opts.ocrDetected,
    forceOcrRepair: opts.forceOcrRepair,
  });

  const recruiter = runRecruiterExtractionPipeline(norm.text, {
    ocrDetected: norm.ocrDetected,
    extractionMethod: opts.extractionMethod || (norm.ocrDetected ? 'ocr' : 'paste'),
    forceOcrRepair: opts.forceOcrRepair,
  });

  let pipe = null;
  let cvData = recruiter.cvData;
  try {
    pipe = await runProductionExtractionPipeline(norm.text, {
      ...opts,
      extractionMethod: opts.extractionMethod || (norm.ocrDetected ? 'ocr' : 'paste'),
    });
    if (pipe?.validatedCVData && Object.keys(pipe.validatedCVData).length > 2) {
      cvData = pipe.validatedCVData;
    }
  } catch {
    /* recruiter pipeline is the guaranteed baseline */
  }

  const structuredJson = buildStructuredCvJsonV2(pipe || { validatedCVData: cvData });
  const post = postProcessCvDataV2(cvData, pipe?.reviewQueue || []);

  const fieldScores = scoreCvFieldConfidence(post.cvData);
  const v2 = recruiter.cvDataV2;
  const name = v2?.name?.value || post.cvData.name || structuredJson.identity?.name || '';
  const nameOk =
    !!String(name).trim() &&
    !/^(poste à compléter|nom à compléter|non détecté|undetected)$/i.test(String(name).trim());
  const hasCore =
    nameOk &&
    ((structuredJson.experience?.length || 0) > 0 ||
      (structuredJson.education?.length || 0) > 0);

  const flaggedRatio =
    fieldScores.fields.length > 0
      ? fieldScores.flaggedCount / fieldScores.fields.length
      : 1;

  const success = hasCore && fieldScores.overall >= FIELD_REVIEW_THRESHOLD && flaggedRatio < 0.25;
  const partial =
    hasCore &&
    (fieldScores.flaggedCount > 0 || fieldScores.overall < FIELD_REVIEW_THRESHOLD) &&
    fieldScores.overall >= 45;
  const failed = !hasCore || fieldScores.overall < 45;

  return {
    version: EXTRACTION_ENGINE_V2,
    success,
    partial,
    failed,
    cvDataV2: v2,
    cvDataVersion: CVDATA_V2_VERSION,
    stages: {
      ocrDetection: { detected: norm.ocrDetected, method: pipe?.extractionMethod || recruiter.metrics?.extractionMethod },
      textNormalization: norm,
      recruiterExtraction: recruiter.metrics,
      sectionDetection: {
        sectionsFound: structuredJson.sectionsFound,
        count: structuredJson.sectionsFound?.length || 0,
      },
      entityExtraction: { structuredCv: structuredJson, cvDataV2: v2 },
      confidenceScoring: fieldScores,
      structuredCvJson: structuredJson,
    },
    cvData: post.cvData,
    resumeData: recruiter.resumeData,
    templateData: recruiter.templateData,
    structuredCvJson: structuredJson,
    fieldConfidence: post.fieldConfidence,
    reviewQueue: post.reviewQueue,
    skillsLanguagesMoves: post.guard?.moves || [],
    pipeline: pipe,
    recruiter,
    metrics: {
      overallConfidence: Math.max(fieldScores.overall, v2?.meta?.overallConfidence || 0),
      flaggedFields: fieldScores.flaggedCount,
      threshold: FIELD_REVIEW_THRESHOLD,
      sectionConfidence: fieldScores.sections,
      outcome: success ? 'success' : partial ? 'partial' : 'failed',
      cvDataV2Overall: v2?.meta?.overallConfidence ?? 0,
    },
  };
}

/**
 * Summarize batch results for reporting.
 * @param {object[]} results
 */
export function summarizeExtractionBatchV2(results = []) {
  const total = results.length;
  const success = results.filter((r) => r.metrics?.outcome === 'success').length;
  const partial = results.filter((r) => r.metrics?.outcome === 'partial').length;
  const failed = results.filter((r) => r.metrics?.outcome === 'failed').length;

  const sectionAgg = {};
  for (const r of results) {
    const sections = r.metrics?.sectionConfidence || r.fieldConfidence?.sections || {};
    for (const [key, data] of Object.entries(sections)) {
      if (!sectionAgg[key]) sectionAgg[key] = { scores: [], flagged: 0, count: 0 };
      sectionAgg[key].scores.push(data.avg || 0);
      sectionAgg[key].flagged += data.flagged || 0;
      sectionAgg[key].count += data.count || 0;
    }
  }

  const sectionConfidence = {};
  for (const [key, data] of Object.entries(sectionAgg)) {
    sectionConfidence[key] = {
      avg: data.scores.length
        ? Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length)
        : 0,
      flagged: data.flagged,
      samples: data.count,
    };
  }

  return {
    version: EXTRACTION_ENGINE_V2,
    fieldConfidenceVersion: EXTRACTION_FIELD_CONFIDENCE_V2,
    threshold: FIELD_REVIEW_THRESHOLD,
    total,
    success,
    partial,
    failed,
    successRate: total ? Math.round((success / total) * 1000) / 10 : 0,
    partialRate: total ? Math.round((partial / total) * 1000) / 10 : 0,
    failureRate: total ? Math.round((failed / total) * 1000) / 10 : 0,
    sectionConfidence,
  };
}
