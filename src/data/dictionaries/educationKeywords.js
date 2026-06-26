import { buildAlternationRe } from './match-utils.js';
import { CREATIVE_SCHOOLS } from './creative/creativeSchools.js';

/** School / degree section headers and inline education cues (general). */
export const EDUCATION_KEYWORDS = [
  'school',
  'university',
  'college',
  'academy',
  'institute',
  'école',
  'ecole',
  'lycée',
  'lycee',
  'formation',
  'bachelor',
  'master',
  'mba',
  'licence',
  'license',
  'bts',
  'dut',
  'phd',
  'doctorate',
  'diploma',
  'degree',
  'certificate',
  'certification',
  'course',
  'undergraduate',
  'graduate',
  'postgraduate',
];

export const EDUCATION_HEADER_RE = buildAlternationRe([
  'education',
  'formation',
  'school',
  'university',
  'école',
  'ecole',
  'université',
  'universite',
  'academic',
  'studies',
  'qualifications',
  'diploma',
  'degree',
]);

/** Institution name often contains these tokens */
export const INSTITUTION_HINT_RE =
  /\b(university|université|college|school|academy|institute|école|ecole|lycée|polytechnic|faculty|campus)\b/i;

/** Creative school names — exact preservation in education lines. */
export { CREATIVE_SCHOOLS };

export function isCreativeSchoolLine(line) {
  const hay = String(line || '');
  return CREATIVE_SCHOOLS.some((s) => new RegExp(`\\b${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(hay));
}

export function isEducationHeaderLine(line) {
  const l = String(line || '')
    .toLowerCase()
    .replace(/[:：|#•]+\s*$/, '')
    .trim();
  if (EDUCATION_HEADER_RE.test(l)) return true;
  return EDUCATION_KEYWORDS.some((k) => l === k.toLowerCase() || l.startsWith(`${k.toLowerCase()} `));
}
