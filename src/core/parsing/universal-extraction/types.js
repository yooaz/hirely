/**
 * Universal CV extraction — block taxonomy (pre-classification).
 */
export const CV_BLOCK_ENGINE = 'CV_BLOCK_ENGINE_V1';
export const UNIVERSAL_DATE_DETECTOR = 'UNIVERSAL_DATE_DETECTOR_V1';
export const UNIVERSAL_COMPANY_DETECTOR = 'UNIVERSAL_COMPANY_DETECTOR_V1';
export const UNIVERSAL_ROLE_DETECTOR = 'UNIVERSAL_ROLE_DETECTOR_V1';
export const UNIVERSAL_EXPERIENCE_RECONSTRUCTOR = 'UNIVERSAL_EXPERIENCE_RECONSTRUCTOR_V1';

export const UNIVERSAL_EXPERIENCE_RECALL_GOAL = 0.9;

/** @readonly */
export const CV_BLOCK_TYPES = Object.freeze({
  IDENTITY: 'identity',
  SUMMARY: 'summary',
  EXPERIENCE: 'experience',
  EDUCATION: 'education',
  SKILLS: 'skills',
  TOOLS: 'tools',
  LANGUAGES: 'languages',
  CLIENTS: 'clients',
  PROJECTS: 'projects',
  CERTIFICATIONS: 'certifications',
  CONTACT: 'contact',
  UNKNOWN: 'unknown',
});
