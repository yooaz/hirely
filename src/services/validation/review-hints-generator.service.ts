import type { CVCanonical } from '../../types/cv.types.js';
import type { ConfidenceReport } from '../../types/cv.types.js';
import type { ValidationReport } from '../../types/review.types.js';
import type { ReviewHint } from '../../types/cv.types.js';
import { newId } from '../_internal/utils.js';

function pickSeverity(conf: number): ReviewHint['severity'] {
  if (conf < 0.4) return 'high';
  if (conf < 0.7) return 'medium';
  return 'low';
}

function buildHint(params: Omit<ReviewHint, 'id'>): ReviewHint {
  return { ...params, id: newId('hint') };
}

export class ReviewHintsGeneratorService {
  generate(params: { cv: CVCanonical; confidence: ConfidenceReport; validation: ValidationReport }): { hints: ReviewHint[] } {
    const { cv, confidence, validation } = params;
    const hints: ReviewHint[] = [];

    for (const issue of validation.blocking_issues || []) {
      if (issue.code === 'invalid_email') {
        hints.push(
          buildHint({
            type: 'low_confidence_contact',
            severity: 'high',
            message: issue.message,
            target_ids: [],
            suggested_action: 'edit_field',
          })
        );
      }
      if (issue.code === 'invalid_date_range') {
        hints.push(
          buildHint({
            type: 'invalid_date_range',
            severity: 'high',
            message: issue.message,
            target_ids: [],
            suggested_action: 'ask_user_confirmation',
          })
        );
      }
    }

    const contactConf = confidence.sections.contact ?? 0;
    if (!cv.contact.emails.length || contactConf < 0.55) {
      hints.push(
        buildHint({
          type: 'low_confidence_contact',
          severity: pickSeverity(contactConf),
          message: 'Nous n’avons pas pu confirmer de manière fiable l’email (ou le contact principal).',
          target_ids: [],
          suggested_action: 'ask_user_confirmation',
          source_block_ids: cv.contact.source_block_ids,
        })
      );
    }

    for (const [idx, exp] of (cv.experiences || []).entries()) {
      const incomplete = !exp.start_date && !exp.end_date;
      const lowConf = exp.confidence < 0.55;
      if (incomplete) {
        hints.push(
          buildHint({
            type: 'missing_dates',
            severity: 'medium',
            message: `Cette expérience #${idx + 1} semble manquer de dates.`,
            target_ids: [exp.id],
            suggested_action: 'ask_user_confirmation',
            source_block_ids: exp.source_block_ids,
          })
        );
      } else if (lowConf) {
        hints.push(
          buildHint({
            type: 'ambiguous_job_title',
            severity: pickSeverity(exp.confidence),
            message: `Nous avons une confiance limitée sur le découpage de l’expérience #${idx + 1}.`,
            target_ids: [exp.id],
            suggested_action: 'ask_user_confirmation',
            source_block_ids: exp.source_block_ids,
          })
        );
      }
    }

    for (const edu of cv.education || []) {
      if (!edu.school || edu.confidence < 0.55) {
        hints.push(
          buildHint({
            type: 'needs_user_confirmation',
            severity: pickSeverity(edu.confidence),
            message: `Nous avons une confiance limitée sur une formation/diplôme.`,
            target_ids: [edu.id],
            suggested_action: 'ask_user_confirmation',
            source_block_ids: edu.source_block_ids,
          })
        );
      }
    }

    const skillsTotal =
      cv.skills.technical.length +
      cv.skills.tools.length +
      cv.skills.languages.length +
      cv.skills.soft.length;
    if (skillsTotal < 3 || cv.skills.technical.length > 40) {
      hints.push(
        buildHint({
          type: 'unclassified_block',
          severity: 'low',
          message: 'Certaines compétences n’ont pas pu être catégorisées avec certitude.',
          target_ids: [],
          suggested_action: 'ask_user_confirmation',
          source_block_ids: cv.skills.source_block_ids,
        })
      );
    }

    if (validation.other_content_ratio > 0.1) {
      hints.push(
        buildHint({
          type: 'unclassified_block',
          severity: 'medium',
          message: 'Une partie du contenu n’a pas pu être classée dans les sections principales.',
          target_ids: [],
          suggested_action: 'move_block',
        })
      );
    }

    const seen = new Set<string>();
    return {
      hints: hints.filter((h) => {
        const k = `${h.type}|${h.message}`.toLowerCase();
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      }),
    };
  }
}
