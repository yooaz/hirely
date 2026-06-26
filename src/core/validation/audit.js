/**
 * Pipeline loss audit — raw vs clean vs structured.
 */

import { textStats, linesRemoved, structuredCharCount, lossRatio } from '../../debug/stats.js';
import { structuredCompleteness } from '../parsing/field-sanitize.js';

const LOSS_WARN_THRESHOLD = 0.2;

export function auditPipeline(rawText, cleanedText, cvData, finalText = '') {
  const raw = textStats(rawText);
  const clean = textStats(cleanedText);
  const removed = linesRemoved(rawText, cleanedText);
  const jsonChars = structuredCharCount(cvData);
  const finalChars = finalText ? finalText.length : jsonChars;

  const cleanLoss = lossRatio(raw.chars, clean.chars);
  const jsonLoss = lossRatio(clean.chars, jsonChars);
  const totalLoss = lossRatio(clean.chars, Math.max(jsonChars, finalChars));

  const warnings = [];
  if (cleanLoss > LOSS_WARN_THRESHOLD) {
    warnings.push(
      `Clean stage removed ${Math.round(cleanLoss * 100)}% of characters (${removed.count} lines dropped).`
    );
  }
  if (jsonLoss > LOSS_WARN_THRESHOLD) {
    warnings.push(`Parser retained ${Math.round((1 - jsonLoss) * 100)}% of cleaned text in structured fields.`);
  }
  if (totalLoss > LOSS_WARN_THRESHOLD) {
    warnings.push(`Total pipeline loss ${Math.round(totalLoss * 100)}% from raw to structured CV.`);
  }
  if (!(cvData?.experience || []).length && clean.chars > 200) {
    warnings.push('No experience lines detected despite substantial cleaned text.');
  }

  const completeness = structuredCompleteness(cvData);

  return {
    threshold: LOSS_WARN_THRESHOLD,
    structuredCompleteness: completeness,
    stages: {
      raw: { ...raw, label: 'RAW EXTRACTION', removedLines: 0 },
      clean: {
        ...clean,
        label: 'CLEANED TEXT',
        removedLines: removed.count,
        removedSample: removed.sample,
        charLossPct: Math.round(cleanLoss * 100),
      },
      json: {
        chars: jsonChars,
        label: 'PARSED JSON',
        charLossPct: Math.round(jsonLoss * 100),
        experienceLines: (cvData?.experience || []).length,
        skillsCount: (cvData?.skills || []).length,
        educationLines: (cvData?.education || []).length,
        unsortedLines: (cvData?.unsorted || []).length,
      },
      final: {
        chars: finalChars,
        label: 'FINAL CV',
        charLossPct: Math.round(totalLoss * 100),
      },
    },
    warnings,
    extractionMethod: null,
  };
}
