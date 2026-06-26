import { CREATIVE_SOFTWARE } from './creative/creativeSoftware.js';

/** Software / productivity tools detected in CV text. */
export const TOOLS = [
  ...new Set([
    ...CREATIVE_SOFTWARE,
    'HTML',
    'CSS',
    'JavaScript',
    'TypeScript',
    'Python',
    'Word',
    'Excel',
    'PowerPoint',
    'SQL',
    'Git',
    'Jira',
    'Slack',
    'AutoCAD',
    'Rhino',
    'SolidWorks',
    'Google Analytics',
    'Tableau',
  ]),
];

/** @deprecated Use TOOLS */
export const KNOWN_TOOLS = TOOLS;
