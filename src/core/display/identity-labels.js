/**
 * Leaf constants for identity confirm labels — zero imports (safe for circular boot graphs).
 */

export const UNDETECTED_INFORMATION_LABEL = 'Information non détectée';

export const NAME_CONFIRM_LABEL = 'Nom à confirmer';
export const EMAIL_CONFIRM_LABEL = 'Email à confirmer';
export const PHONE_CONFIRM_LABEL = 'Téléphone à confirmer';
export const TITLE_CONFIRM_LABEL = 'Poste à compléter';

/** P0 identity lock — shown when confidence < 90% instead of guessed values. */
export const IDENTITY_NEEDS_REVIEW_LABEL = 'Identity needs review';

/** @deprecated use EMAIL_CONFIRM_LABEL */
export const EMAIL_UNCERTAIN_LABEL = EMAIL_CONFIRM_LABEL;
