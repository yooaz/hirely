/**
 * AI_RECONSTRUCTION_ENGINE — normalized Resume JSON schema.
 */

export const AI_RECONSTRUCTION_ENGINE = 'AI_RECONSTRUCTION_ENGINE';
export const AI_RECONSTRUCTION_CONFIDENCE_MIN = 80;

export const AI_RESUME_SCHEMA_KEYS = [
  'identity',
  'experience',
  'education',
  'skills',
  'tools',
  'languages',
  'projects',
  'clients',
  'awards',
  'publications',
];

export function emptyAiResumeJson() {
  return {
    identity: {
      name: '',
      title: '',
      email: '',
      phone: '',
      location: '',
      linkedin: '',
      website: '',
    },
    experience: [],
    education: [],
    skills: [],
    tools: [],
    languages: [],
    projects: [],
    clients: [],
    awards: [],
    publications: [],
    metadata: {
      engine: AI_RECONSTRUCTION_ENGINE,
      confidence: 0,
      fieldScores: {},
      archive: [],
      lowConfidence: false,
      source: 'none',
    },
  };
}
