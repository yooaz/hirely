/**
 * Shared fact pipeline constants (acyclic leaf — no imports).
 */

/** Minimum confidence (0–1) for a fact to enter CV sections. Matches CLASSIFICATION_CONFIDENCE_MIN / 100. */
export const FACT_CONFIDENCE_THRESHOLD = 0.8;

export const FACT_PIPELINE_VERSION = 'fact-pipeline-v2';

/** Singular/plural fact type → cvData field (acyclic; imported by review-queue). */
export const FACT_TYPE_TO_CV_FIELD = Object.freeze({
  identity: 'identity',
  contact: 'identity',
  summary: 'summary',
  experience: 'experiences',
  education: 'education',
  skill: 'skills',
  skills: 'skills',
  tool: 'tools',
  tools: 'tools',
  language: 'languages',
  languages: 'languages',
  client: 'clients',
  clients: 'clients',
  project: 'projects',
  projects: 'projects',
  award: 'awards',
  awards: 'awards',
  publication: 'publications',
  publications: 'publications',
  interest: 'interests',
  interests: 'interests',
  unknown: 'unsorted',
});
