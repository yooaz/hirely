/**
 * H6 multi-CV stress catalog — seven archetypes.
 */

export const H6_STRESS_V1 = 'HIRELY_H6_STRESS_V1';

export const H6_CV_FIXTURES = [
  { id: 'creative-cv', label: 'Creative CV', archetype: 'creative', manifestId: 'creative-cv' },
  { id: 'developer-cv', label: 'Developer CV', archetype: 'developer', manifestId: 'developer-cv' },
  { id: 'marketing-cv', label: 'Marketing CV', archetype: 'marketing', manifestId: 'marketing-cv' },
  { id: 'sales-cv', label: 'Sales CV', archetype: 'sales', manifestId: 'sales-cv' },
  { id: 'student-cv', label: 'Student CV', archetype: 'student', manifestId: 'student-cv' },
  { id: 'academic-cv', label: 'Academic CV', archetype: 'academic', manifestId: 'academic-cv' },
  { id: 'executive-cv', label: 'Executive CV', archetype: 'executive', manifestId: 'executive-cv' },
];

/** Minimum recall (%) per dimension to pass H6 */
export const H6_RECALL_GOAL_PCT = 80;

export const H6_DIMENSIONS = [
  'identity',
  'experience',
  'education',
  'skills',
  'languages',
  'completeness',
];
