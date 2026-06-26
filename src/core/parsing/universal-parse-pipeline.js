/**
 * Universal parse pipeline — document structure first, optional AI after deterministic parse.
 *
 * Stages:
 * 1. OCR / text extraction (caller supplies rawText + optional layout)
 * 2. Layout-aware line grouping (parser-layout-input + section detect v2)
 * 3. Section detection + classification (section-engine-v2)
 * 4. Fact extraction → CV build (fact-pipeline: facts then sections)
 * 5. Uncertainty → unsorted / review queue
 * 6. Editable review (structured resume + unsorted preserved)
 *
 * Optional: AI reconstruction (grounded, never sole parser).
 */

import { cleanupOcrText } from './ocr-cleanup.js';
import { normalizeOcrDocument } from './ocr-normalization.js';
import { looksLikeOcrText } from './ocr-postprocess.js';
import { runSectionEngineV2 } from './section-engine-v2.js';
import {
  runAiReconstructionEngine,
  applyAiReconstructionArchive,
  aiReconstructionConfigured,
} from './ai-reconstruction-engine.js';
import { buildZeroTextLossAudit } from './zero-text-loss.js';
import { guardStructuredResumeSize } from '../pipeline/pipeline-contract.js';
import { isHirelyFlowLocked } from '../pipeline/hirely-flow-lock.js';
import { isHirelyDebug } from '../runtime/hirely-debug.js';

export const UNIVERSAL_PARSE_PIPELINE = 'universal-parse-v1';

/**
 * @param {string} rawText
 * @param {object} [opts]
 */
export async function runUniversalParsePipeline(rawText, opts = {}) {
  if (isHirelyFlowLocked() && !isHirelyDebug()) {
    throw new Error('UNIVERSAL_PARSE_PIPELINE_DISABLED');
  }
  const raw = String(rawText || '').trim();
  const isOcr =
    looksLikeOcrText(raw) || opts.extractionMethod === 'pdf' || opts.extractionMethod === 'ocr';
  let text = raw;
  let uncertainFromOcr = [];
  if (isOcr) {
    const normalized = normalizeOcrDocument(raw, opts);
    text = normalized.text || raw;
    uncertainFromOcr = (normalized.lines || [])
      .filter((l) => !l.accepted && l.normalizedLine)
      .map((l) => l.normalizedLine);
  } else {
    const cleaned = cleanupOcrText(raw);
    text = cleaned.text || raw;
    uncertainFromOcr = cleaned.uncertainLines || [];
  }

  const engineResult = runSectionEngineV2(text, {
    rawText: raw,
    extractionMethod: opts.extractionMethod || 'paste',
    throwOnPipelineLoss: opts.throwOnPipelineLoss !== false,
    extractionLines: opts.extractionLines,
    layoutMemory: opts.layoutMemory,
    layout: opts.layout,
    headerLines: opts.headerLines,
  });

  let structured = engineResult.structured;
  let resumeJson = engineResult.resumeJson;
  let aiUsed = false;

  let aiResult = null;
  if (opts.useAi === true && aiReconstructionConfigured()) {
    aiResult = await runAiReconstructionEngine(text);
    if (aiResult?.usedLlm) {
      structured = applyAiReconstructionArchive(structured, aiResult);
      aiUsed = true;
    }
  }

  if (uncertainFromOcr.length) {
    structured.unsorted = [
      ...new Set([...(structured.unsorted || []), ...uncertainFromOcr]),
    ].slice(0, 96);
  }

  const zeroAudit =
    structured.metadata?.zeroTextLossAudit || buildZeroTextLossAudit(raw, structured);

  const sizeGuard = guardStructuredResumeSize(structured, text);
  structured = sizeGuard.resume;

  return {
    pipeline: UNIVERSAL_PARSE_PIPELINE,
    structured,
    resumeJson,
    report: engineResult.report,
    sectionBlocks: engineResult.sectionBlocks,
    zeroTextLossAudit: zeroAudit,
    aiUsed,
    aiResult,
    aiAvailable: aiReconstructionConfigured(),
    cleanedText: text,
    uncertainLines: uncertainFromOcr,
  };
}
