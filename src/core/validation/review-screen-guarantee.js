/**
 * REVIEW GUARANTEE — if a resume object exists, Review always opens.
 * Missing skills/education/parser gaps → warnings only, never block.
 */
import { hasIdentityEmail, hasIdentityPhone } from './identity-contact.js';

/**
 * @param {unknown} rd
 * @returns {boolean}
 */
export function resumeObjectExists(rd) {
  return !!(
    rd &&
    typeof rd === 'object' &&
    !Array.isArray(rd) &&
    rd.identity &&
    typeof rd.identity === 'object'
  );
}

/**
 * @param {object|null|undefined} frd finalResumeData or resumeData-shaped object
 * @returns {boolean}
 */
export function finalResumeDataMeetsReviewGuarantee(frd) {
  return resumeObjectExists(frd);
}

/**
 * Weak-data warnings only — never blocks review.
 * @param {object|null|undefined} frd
 * @returns {string[]}
 */
export function buildReviewGuaranteeWarnings(frd) {
  if (!resumeObjectExists(frd)) return ['Aucune donnée CV — importez ou collez votre texte.'];
  const id = frd.identity && typeof frd.identity === 'object' ? frd.identity : {};
  /** @type {string[]} */
  const warnings = [];
  if (!String(id.name || '').trim() || /à vérifier|confirmer/i.test(String(id.name || ''))) {
    warnings.push('Nom non détecté — à compléter.');
  }
  if (!hasIdentityEmail(id)) warnings.push('Email non détecté — à compléter.');
  if (!hasIdentityPhone(id)) warnings.push('Téléphone non détecté — à compléter.');
  if (!(frd.experiences || []).length) warnings.push('Expérience incomplète — à vérifier.');
  if (!(frd.education || []).length) warnings.push('Formation incomplète — à vérifier.');
  if (!(frd.skills || []).length) warnings.push('Compétences incomplètes — à vérifier.');
  if (String(frd.summary || '').trim().length > 20 && !(frd.experiences || []).length) {
    warnings.push('Contenu importé — structurez les sections.');
  }
  if (frd.meta?.textFirstEngine || frd.meta?.source === 'createResumeFromText') {
    warnings.push('CV généré depuis le texte — relisez les sections.');
  }
  if (frd.meta?.parseError || (Array.isArray(frd.meta?.warnings) && frd.meta.warnings.length)) {
    warnings.push('Analyse incomplète — vérifiez les champs.');
  }
  if ((frd.unsorted || []).length > 0) {
    warnings.push('Éléments non classés — à placer.');
  }
  return warnings;
}

/**
 * @param {object|null|undefined} frd
 */
export function isReviewGuaranteeWeak(frd) {
  if (!finalResumeDataMeetsReviewGuarantee(frd)) return false;
  return buildReviewGuaranteeWarnings(frd).length > 0;
}

/**
 * CV protection must never block Review when a resume object exists.
 * @param {ReturnType<typeof import('./cv-data-protection.js').validateCvData>} validation
 * @param {object|null|undefined} resumeData
 */
export function applyReviewGuaranteeToValidation(validation, resumeData) {
  if (!resumeObjectExists(resumeData)) return validation;
  const guaranteeWarnings = buildReviewGuaranteeWarnings(resumeData);
  const reasons = [...new Set([...(validation?.reasons || []), ...guaranteeWarnings])];
  const partial = validation?.status !== 'VALID' || guaranteeWarnings.length > 0;
  return {
    ...validation,
    status: partial ? 'PARTIAL' : validation?.status || 'VALID',
    reasons,
    blockReview: false,
    reviewGuarantee: true,
    guaranteeWarnings,
  };
}
