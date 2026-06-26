/**
 * OCR rotation + preprocess selection — pick best of 0/90/180/270° by quality score.
 */

import { runOcrOnCanvasWithLines } from './ocr-pipeline.js';
import { preprocessCanvasForOcr, rotateCanvasByDegrees } from './ocr-preprocess.js';
import { scoreOcrQuality, isOcrQualityAcceptable } from './ocr-quality-score.js';
import { postProcessOcrText } from '../parsing/ocr-postprocess.js';
import { coerceOcrExtractedLine } from './extracted-line.js';
import { hirelyDebugLog } from '../runtime/hirely-debug.js';
import { logExtractionStep } from './file-buffer.js';
import { setLastOcrRotationDecision } from './extraction-session.js';
import {
  OCR_ROTATION_MAX,
  OCR_ROTATION_TRIAL_MAX_MS,
  remainingMs,
  withRotationTrialTimeout,
} from './pdf-extraction-timeout.js';

export const ROTATION_ANGLES = [0, 90, 180, 270];

function polishText(rawText, rawLines) {
  const polished = (rawLines || [])
    .map((ln, i) => {
      const raw = String(ln.text ?? ln.rawExtraction ?? '').trim();
      const cleaned = postProcessOcrText(raw) || raw;
      return cleaned ? coerceOcrExtractedLine(ln, { text: cleaned, line: i }) : null;
    })
    .filter(Boolean);
  let text = polished.map((l) => l.text).join('\n').trim();
  if (!text && rawText) {
    text = postProcessOcrText(rawText) || String(rawText).trim();
  }
  const lines =
    polished.length ?
      polished
    : text.split('\n').map((t, i) => coerceOcrExtractedLine({ text: t }, { text: t, line: i }));
  return { text, lines };
}

/**
 * Lightweight OCR for rotation trial (single pass, no auto-rotate).
 * @param {HTMLCanvasElement} sourceCanvas
 * @param {{ rotation?: number, variant?: string, lang?: string, page?: number, viewportWidth?: number, viewportHeight?: number }} trialOpts
 */
export async function runRotationTrialOcr(sourceCanvas, trialOpts = {}) {
  const rotation = trialOpts.rotation ?? 0;
  const variant = trialOpts.variant || 'standard';
  const rotated =
    rotation === 0 ? sourceCanvas : rotateCanvasByDegrees(sourceCanvas, rotation);

  const prep = preprocessCanvasForOcr(rotated, {
    viewportWidth: trialOpts.viewportWidth || rotated.width,
    viewportHeight: trialOpts.viewportHeight || rotated.height,
    targetDpi: trialOpts.targetDpi,
    variant,
    skipAutoRotate: true,
    page: trialOpts.page,
  });

  const result = await runOcrOnCanvasWithLines(prep.canvas, {
    lang: trialOpts.lang || 'fra+eng',
    preprocessed: true,
    tessPsm: prep.meta.suggestedPsm,
    preprocessMeta: { ...prep.meta, rotationTrial: rotation, variant },
  });

  const { text, lines } = polishText(result.text, result.lines);
  const scored = scoreOcrQuality({ text, lines });
  return {
    rotation,
    variant,
    charCount: scored.charCount,
    qualityScore: scored.qualityScore,
    topWords: scored.topWords,
    garbageRatio: scored.garbageRatio,
    text,
    lines,
    reasons: scored.reasons,
  };
}

function logRotationTrial(trial, chosen = false) {
  hirelyDebugLog('OCR_ROTATION_TEST', {
    rotation: trial.rotation,
    variant: trial.variant || 'standard',
    charCount: trial.charCount,
    qualityScore: trial.qualityScore,
    topWords: trial.topWords,
    garbageRatio: trial.garbageRatio,
    chosenRotation: chosen ? trial.rotation : undefined,
  });
}

/**
 * Try 4 rotations; optionally retry best rotation with preprocess variants if score is low.
 * @param {HTMLCanvasElement} sourceCanvas
 * @param {object} [opts]
 * @returns {Promise<{
 *   canvas: HTMLCanvasElement,
 *   rotationDeg: number,
 *   variant: string,
 *   qualityScore: number,
 *   text: string,
 *   lines: Array<{ text: string }>,
 *   trials: object[],
 *   beforeSample: string,
 *   afterSample: string,
 * }>}
 */
export async function selectBestOcrRotation(sourceCanvas, opts = {}) {
  const trials = [];
  let beforeSample = '';
  let best = null;
  let earlyStop = false;

  const maxRot =
    Number.isFinite(opts.maxRotations) && opts.maxRotations > 0
      ? Math.min(opts.maxRotations, OCR_ROTATION_MAX)
      : OCR_ROTATION_MAX;
  const angles = ROTATION_ANGLES.slice(0, maxRot);
  for (const rotation of angles) {
    if (opts.deadlineAt && Date.now() >= opts.deadlineAt) break;

    const trialBudget = Math.min(
      OCR_ROTATION_TRIAL_MAX_MS,
      remainingMs(opts.deadlineAt)
    );
    if (trialBudget <= 0) break;

    let trial;
    try {
      trial = await withRotationTrialTimeout(
        runRotationTrialOcr(sourceCanvas, {
          rotation,
          variant: 'standard',
          lang: opts.lang,
          page: opts.page,
          viewportWidth: opts.viewportWidth,
          viewportHeight: opts.viewportHeight,
          targetDpi: opts.targetDpi,
        }),
        trialBudget
      );
    } catch {
      logExtractionStep('OCR_ROTATION_TRIAL_TIMEOUT', `${rotation}°`);
      continue;
    }

    trials.push(trial);
    logRotationTrial(trial, false);
    if (!beforeSample && trial.text) beforeSample = trial.text.slice(0, 200);

    if (!best || trial.qualityScore > best.qualityScore) best = trial;
    if (isOcrQualityAcceptable(trial.text, trial.lines)) {
      best = trial;
      earlyStop = true;
      logRotationTrial(trial, true);
      logExtractionStep('OCR_ROTATION_EARLY_STOP', `${rotation}° score=${trial.qualityScore}`);
      break;
    }
  }

  if (!best && trials.length) {
    trials.sort((a, b) => {
      if (b.qualityScore !== a.qualityScore) return b.qualityScore - a.qualityScore;
      return b.charCount - a.charCount;
    });
    best = trials[0];
  }

  const chosenRotation = best?.rotation ?? 0;
  const chosenVariant = best?.variant || 'standard';
  if (!earlyStop) {
    logRotationTrial(
      best || { rotation: 0, charCount: 0, qualityScore: 0, topWords: [], garbageRatio: 1 },
      true
    );
  }
  logExtractionStep(
    'OCR_ROTATION_CHOSEN',
    `${chosenRotation}° score=${best?.qualityScore ?? 0} variant=${chosenVariant}`
  );

  const decision = {
    chosenRotation,
    chosenVariant,
    qualityScore: best?.qualityScore ?? 0,
    trials: trials.map((t) => ({
      rotation: t.rotation,
      variant: t.variant || 'standard',
      charCount: t.charCount,
      qualityScore: t.qualityScore,
      topWords: t.topWords,
      garbageRatio: t.garbageRatio,
    })),
    beforeSample,
    afterSample: String(best?.text || '').slice(0, 200),
  };
  setLastOcrRotationDecision(decision);

  const canvas =
    chosenRotation === 0
      ? sourceCanvas
      : rotateCanvasByDegrees(sourceCanvas, chosenRotation);

  return {
    canvas,
    rotationDeg: chosenRotation,
    variant: chosenVariant,
    qualityScore: best?.qualityScore ?? 0,
    text: best?.text || '',
    lines: best?.lines || [],
    trials: decision.trials,
    beforeSample,
    afterSample: decision.afterSample,
  };
}
