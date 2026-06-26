/**
 * P1 generic parser stress — six archetypes + yoaz verification fixture.
 */

export const P1_GENERIC_STRESS_V1 = 'hirely-p1-generic-stress-v1';

/** Minimum usable fixtures to pass (of 6 primary archetypes). */
export const P1_USABLE_GOAL = 5;

export const P1_PRIMARY_FIXTURES = [
  { id: 'creative-cv', label: 'Creative / Designer CV', manifestId: 'creative-cv', archetype: 'creative' },
  { id: 'developer-cv', label: 'Developer CV', manifestId: 'developer-cv', archetype: 'developer' },
  { id: 'marketing-cv', label: 'Marketing CV', manifestId: 'marketing-cv', archetype: 'marketing' },
  { id: 'sales-cv', label: 'Sales / Commercial CV', manifestId: 'sales-cv', archetype: 'sales' },
  { id: 'recruiter-cv', label: 'Recruiter / HR CV', manifestId: 'recruiter-cv', archetype: 'recruiter' },
  { id: 'consultant-cv', label: 'Consultant / Manager CV', manifestId: 'consultant-cv', archetype: 'consultant' },
];

/** Yoaz fixture — must parse via generic rules only (not hardcoded). */
export const P1_YOAZ_VERIFY = {
  id: 'yoaz-cv',
  label: 'Yoaz CV (generic rules verification)',
  manifestId: 'yoaz-cv',
  verifyOnly: true,
};
