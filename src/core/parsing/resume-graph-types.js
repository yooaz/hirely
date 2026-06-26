/**
 * Resume graph — node and edge vocabulary.
 */

export const RESUME_GRAPH_ENGINE = 'RESUME_GRAPH_ENGINE';
export const RESUME_GRAPH_VERSION = '1';

export const GRAPH_NODE = {
  PERSON: 'person',
  EXPERIENCE: 'experience',
  EDUCATION: 'education',
  SKILL: 'skill',
  LANGUAGE: 'language',
  TOOL: 'tool',
  PROJECT: 'project',
  CLIENT: 'client',
};

export const GRAPH_EDGE = {
  WORKED_AT: 'worked_at',
  USED: 'used',
  STUDIED: 'studied',
  SPEAKS: 'speaks',
  CREATED: 'created',
};
