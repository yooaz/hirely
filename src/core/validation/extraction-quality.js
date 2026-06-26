/**
 * Import quality gate — detect poor OCR / parsing before showing a professional CV.
 */

import { isBadName } from '../parsing/rich-parser.js';
import { isObviousStrictGarbage, isImpossibleOcrTokenString } from '../parsing/clean.js';

const CORRUPTED_LINE_RE = /^[\W\d\s]+$|^[A-Za-zÀ-ÿ](\s+[A-Za-zÀ-ÿ0-9]){6,}$/;

function letterRatio(line) {
  const l = String(line || '');
  const letters = (l.match(/[A-Za-zÀ-ÿ]/g) || []).length;
  return l.length ? letters / l.length : 0;
}

function lineLooksCorrupted(line) {
  const l = String(line || '').trim();
  if (!l || l.length < 3) return false;
  if (isObviousStrictGarbage(l) || isImpossibleOcrTokenString(l)) return true;
  if (CORRUPTED_LINE_RE.test(l)) return true;
  if (letterRatio(l) < 0.28) return true;
  return false;
}

function countCorruptedTokens(lines) {
  let corrupted = 0;
  let total = 0;
  for (const line of lines) {
    const words = line.split(/\s+/).filter(Boolean);
    total += words.length;
    if (lineLooksCorrupted(line)) corrupted += Math.max(1, words.length);
    else {
      for (const w of words) {
        if (w.length >= 8 && /[^A-Za-zÀ-ÿ0-9@.'-]/.test(w) && (w.match(/[A-Za-zÀ-ÿ]/g) || []).length / w.length < 0.5) {
          corrupted++;
        }
      }
    }
  }
  return { corrupted, total };
}

/**
 * @param {{
 *   rawText?: string,
 *   cleanedText?: string,
 *   cvData?: object,
 *   structuredResume?: object,
 *   audit?: object,
 *   extractionMethod?: string,
 * }} input
 */
export function assessImportQuality(input = {}) {
  const rawText = String(input.rawText || '');
  const cleanedText = String(input.cleanedText || rawText);
  const cvData = input.cvData || {};
  const structured = input.structuredResume || null;
  const audit = input.audit || {};

  const lines = cleanedText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const totalLines = Math.max(1, lines.length);

  const identity = structured?.identity || {};
  const name = String(cvData.name || identity.name || '').trim();
  const nameMissing = !name || isBadName(name);

  const { corrupted, total: wordTotal } = countCorruptedTokens(lines);
  const corruptedTokenRatio = wordTotal > 0 ? corrupted / wordTotal : 0;
  const tooManyCorruptedTokens = corruptedTokenRatio > 0.12;

  const readableLines = lines.filter((l) => letterRatio(l) >= 0.45).length;
  const readableLineRatio = readableLines / totalLines;
  const lowReadableLineRatio = readableLineRatio < 0.55;

  const unsortedN = (cvData.unsorted || structured?.unsorted || []).length;
  const rejectedN = (audit.rejectedLines || []).length;
  const uncertainN = (audit.uncertainLines || []).length;
  const suspiciousLineRatio = (unsortedN + rejectedN + uncertainN + lines.filter(lineLooksCorrupted).length) / totalLines;
  const tooManySuspiciousLines = suspiciousLineRatio > 0.2;

  const sectionConf = cvData.sectionConfidence || structured?.sectionConfidence || {};
  const experienceConfidence = Number(sectionConf.experience ?? 0);
  const experienceCount = (cvData.experience || []).length;
  const experienceConfidenceLow =
    experienceConfidence < 50 || (experienceCount === 0 && lines.length >= 5);

  const isOcrPath = /ocr|scan|vision|tesseract/i.test(String(input.extractionMethod || audit.extractionMethod || ''));

  const flags = {
    nameMissing,
    tooManyCorruptedTokens,
    experienceConfidenceLow,
    tooManySuspiciousLines,
    lowReadableLineRatio,
  };

  const flagCount = Object.values(flags).filter(Boolean).length;
  let score = 100;
  if (nameMissing) score -= 28;
  if (tooManyCorruptedTokens) score -= 22;
  if (experienceConfidenceLow) score -= 20;
  if (tooManySuspiciousLines) score -= 18;
  if (lowReadableLineRatio) score -= 16;
  score = Math.max(0, Math.min(100, score));

  const method = String(input.extractionMethod || audit.extractionMethod || '');
  const isDocx = /docx/i.test(method);
  const isNativePdf = /native_pdf|pdf-text|pdf_text/i.test(method);
  const hasStructuredBody =
    !nameMissing &&
    (experienceCount > 0 || (cvData.skills || []).length >= 3 || String(cvData.summary || '').length >= 40);

  const critical = nameMissing && experienceConfidenceLow && experienceCount === 0;
  let isPoor =
    critical ||
    flagCount >= 3 ||
    score < 40 ||
    (isOcrPath && flagCount >= 2 && score < 52);

  if ((isDocx || isNativePdf) && hasStructuredBody) {
    isPoor = critical;
  } else if (isOcrPath && hasStructuredBody && score >= 52) {
    isPoor = false;
  }

  let quality = 'good';
  if (isPoor) quality = 'poor';
  else if (flagCount >= 1 || score < 72) quality = 'medium';

  const reasons = [];
  if (nameMissing) reasons.push('Nom non détecté');
  if (tooManyCorruptedTokens) reasons.push('Nombreux fragments illisibles');
  if (experienceConfidenceLow) reasons.push('Parcours professionnel peu fiable');
  if (tooManySuspiciousLines) reasons.push('Trop de lignes douteuses');
  if (lowReadableLineRatio) reasons.push('Texte difficile à lire');

  return {
    quality,
    isPoor,
    score,
    flags,
    flagCount,
    reasons,
    metrics: {
      totalLines,
      readableLineRatio: Math.round(readableLineRatio * 100),
      suspiciousLineRatio: Math.round(suspiciousLineRatio * 100),
      corruptedTokenRatio: Math.round(corruptedTokenRatio * 100),
      experienceConfidence,
      experienceCount,
      isOcrPath,
    },
  };
}
