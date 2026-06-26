/**
 * Pre-render field completeness — detect parser loss vs raw text.
 */

import { lineLooksLikeRole } from '../../data/dictionaries/roleKeywords.js';
import { measureCleanLoss } from './clean.js';
import { structuredCharCount } from '../../debug/stats.js';
import { flattenCvDataPreservedText } from '../../debug/cv-preserved-text.js';

const CAREER_SIGNAL_RE =
  /\b(freelance|illustrator|graphic\s+designer|designer|art\s+director|creative\s+director|graphiste|illustrateur|directeur\s+artistique|consultant|manager|developer|engineer)\b/i;

const DATE_SIGNAL_RE = /\b(19|20)\d{2}\s*[-–—]\s*(?:present|présent|current|now|\d{4})\b/i;

export const PARSER_REBUILD_MSG_FR =
  'Le CV a été lu mais certaines sections doivent être reconstruites.';

import { UNDETECTED_INFORMATION_LABEL } from '../display/undetected-label.js';

export const NAME_CONFIRM_FR = UNDETECTED_INFORMATION_LABEL;

/**
 * @param {object} cvData
 * @param {string} rawText
 * @param {string} cleanedText
 */
export function assessFieldCompleteness(cvData, rawText, cleanedText) {
  const raw = String(rawText || '').trim();
  const clean = String(cleanedText || raw).trim();
  const d = cvData || {};

  const rawLen = Math.max(1, raw.length);
  const cleanLen = Math.max(1, clean.length || rawLen);
  const used = Math.max(structuredCharCount(d), flattenCvDataPreservedText(d).length);
  const finalLen = used;
  const utilizationPct = Math.min(100, Math.round((finalLen / cleanLen) * 100));
  const contentLossPct = Math.max(0, 100 - utilizationPct);

  const cleanLoss = measureCleanLoss(raw, clean);
  const hasCareerSignals = CAREER_SIGNAL_RE.test(raw) || CAREER_SIGNAL_RE.test(clean);
  const hasDates = DATE_SIGNAL_RE.test(raw) || DATE_SIGNAL_RE.test(clean);

  const experienceEmpty = !(d.experience || []).length && !(d.experiences || []).length;
  const nameMissing = !String(d.name || '').trim() || d.name === NAME_CONFIRM_FR;
  const educationEmpty = !(d.education || []).length;
  const hasEducationSignal = /\b(formation|education|school|university|école|créapole|lisaa|bachelor|master|diploma)\b/i.test(
    raw + clean
  );

  const parserFail =
    rawLen >= 120 &&
    experienceEmpty &&
    (hasCareerSignals || hasDates) &&
    (hasCareerSignals || clean.length >= 80);

  const severeContentLoss = cleanLen >= 400 && contentLossPct >= 80 && finalLen < 200;

  const warnings = [];
  if (parserFail) warnings.push(PARSER_REBUILD_MSG_FR);
  if (severeContentLoss) {
    warnings.push(
      `Perte de contenu: ${contentLossPct}% du texte source n'apparaît pas dans le CV structuré (${rawLen} → ${finalLen} caractères).`
    );
  }
  if (nameMissing && rawLen >= 40) {
    warnings.push('Nom non détecté — vérifiez en haut du CV.');
  }
  if (educationEmpty && hasEducationSignal) {
    warnings.push('Formation détectée dans le texte mais mal structurée.');
  }

  return {
    ok: !parserFail && !severeContentLoss,
    parserFail,
    severeContentLoss,
    contentLossPct,
    utilizationPct,
    rawChars: rawLen,
    finalChars: finalLen,
    cleanLossPct: cleanLoss.lossPct,
    warnings,
    fields: {
      name: !nameMissing,
      title: !!String(d.title || '').trim(),
      experience: !experienceEmpty,
      education: !educationEmpty || !hasEducationSignal,
      skillsOrTools: (d.skills || []).length + (d.tools || []).length > 0,
    },
  };
}

export function rawHasCareerSignals(text) {
  return CAREER_SIGNAL_RE.test(String(text || '')) || DATE_SIGNAL_RE.test(String(text || ''));
}
