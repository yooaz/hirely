/**
 * OCR typo fixes (§9.2) — conservative, no content invention.
 */

export function cleanOcrNoise(text: string): string {
  let s = String(text || '');
  s = s.replace(/\u00a0/g, ' ');
  s = s.replace(/[ \t]+/g, ' ');
  s = s.replace(/(\d)O(\d)/g, '$10$2');
  s = s.replace(/Dével0ppeur/gi, 'Développeur');
  s = s.replace(/Expérlence/gi, 'Expérience');
  s = s.replace(/\brn\b/g, 'm');
  return s.trim();
}

export function normalizeUnicode(text: string): string {
  return String(text || '')
    .normalize('NFKC')
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .replace(/[–—]/g, '-')
    .trim();
}

export function normalizeLineText(text: string): string {
  return cleanOcrNoise(normalizeUnicode(text));
}
