/** Canonical language labels + text patterns that map to them. */
export const LANGUAGES = [
  'French',
  'English',
  'Dutch',
  'German',
  'Spanish',
  'Italian',
  'Portuguese',
];

export const LANGUAGE_ALIASES = [
  { re: /\b(french|français|francais|langue\s*maternelle)\b/i, label: 'French' },
  { re: /\b(english|anglais)\b/i, label: 'English' },
  { re: /dutch|nederlands|néerlandais|neerlandais/i, label: 'Dutch' },
  { re: /german|deutsch|allemand/i, label: 'German' },
  { re: /spanish|español|espagnol|castellano/i, label: 'Spanish' },
  { re: /italian|italiano|italien/i, label: 'Italian' },
  { re: /portuguese|português|portugais/i, label: 'Portuguese' },
];

export function detectLanguagesFromText(text) {
  const found = new Set();
  const hay = String(text || '');
  for (const { re, label } of LANGUAGE_ALIASES) {
    if (re.test(hay)) found.add(label);
  }
  for (const lang of LANGUAGES) {
    if (new RegExp(`\\b${lang}\\b`, 'i').test(hay)) found.add(lang);
  }
  return [...found];
}
