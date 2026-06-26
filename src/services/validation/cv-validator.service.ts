import type { CVCanonical } from '../../types/cv.types.js';
import type { ConfidenceReport } from '../../types/confidence.types.js';
import type { ValidationIssue, ValidationReport } from '../../types/review.types.js';
import { EMAIL_PATTERN } from '../_internal/block-signals.js';

function isValidIsoYearOrMonth(v: string): boolean {
  return /^\d{4}$/.test(v) || /^\d{4}-\d{2}$/.test(v) || v === 'present' || v === '';
}

function yearPart(date: string): number | null {
  if (/^\d{4}$/.test(date)) return Number(date.slice(0, 4));
  if (/^\d{4}-\d{2}$/.test(date)) return Number(date.slice(0, 4));
  return null;
}

export class CvValidatorService {
  validate(params: { cv: CVCanonical; confidence: ConfidenceReport; other_content_ratio: number }): ValidationReport {
    const { cv, other_content_ratio } = params;

    const blocking_issues: ValidationIssue[] = [];
    const non_blocking_issues: ValidationIssue[] = [];

    // Email validation (blocking only if we actually have a malformed email-like string).
    for (const e of cv.contact.emails || []) {
      if (!EMAIL_PATTERN.test(e)) {
        blocking_issues.push({
          code: 'invalid_email',
          blocking: true,
          message: `Email invalide détecté: ${e}`,
          field_path: 'contact.emails',
        });
      }
    }

    // Date validation for experiences
    for (const [idx, exp] of (cv.experiences || []).entries()) {
      const sY = exp.start_date ? yearPart(exp.start_date) : null;
      const eY = exp.end_date ? yearPart(exp.end_date) : null;
      if (exp.start_date && !isValidIsoYearOrMonth(exp.start_date)) {
        blocking_issues.push({
          code: 'invalid_date_range',
          blocking: true,
          message: `Date début invalide pour expérience #${idx}`,
          field_path: `experiences[${idx}].start_date`,
        });
      }
      if (exp.end_date && exp.end_date !== 'present' && !isValidIsoYearOrMonth(exp.end_date)) {
        blocking_issues.push({
          code: 'invalid_date_range',
          blocking: true,
          message: `Date fin invalide pour expérience #${idx}`,
          field_path: `experiences[${idx}].end_date`,
        });
      }
      if (sY != null && eY != null && eY < sY) {
        blocking_issues.push({
          code: 'invalid_date_range',
          blocking: true,
          message: `Fin < début pour expériences[${idx}]`,
          field_path: `experiences[${idx}].end_date`,
        });
      }
    }

    // Non-blocking validations
    for (const [idx, exp] of (cv.experiences || []).entries()) {
      const hasAnyDate = Boolean(exp.start_date) || Boolean(exp.end_date);
      if (!hasAnyDate) {
        non_blocking_issues.push({
          code: 'experience_incomplete',
          blocking: false,
          message: `Expérience #${idx} sans dates.`,
          field_path: `experiences[${idx}]`,
        });
      }
    }

    const ok = blocking_issues.length === 0 && String(cv.summary || '').trim().length > 0
      ? true
      : blocking_issues.length === 0; // summary peut être vide sur CV courts.

    return {
      ok,
      blocking_issues,
      non_blocking_issues,
      other_content_ratio,
    };
  }
}

