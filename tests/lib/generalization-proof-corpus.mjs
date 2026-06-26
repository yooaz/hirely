/**
 * P0 — Non-Yoaz CV corpus for generalization proof (all tests/cv-corpus/*.txt).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const GENERALIZATION_PROOF_ENGINE = 'GENERALIZATION_PROOF_V1';
export const CORPUS_DIR = path.join(__dirname, '../cv-corpus');

export const GENERALIZATION_CORPUS_IDS = [
  'developer',
  'designer',
  'consultant',
  'executive',
  'marketing',
  'teacher',
  'student',
  'engineer',
  'nurse',
  'freelancer',
  'sales',
  'finance',
  'lawyer',
  'hr',
  'architect',
  'artist',
  'photographer',
  'creative-director',
  'data-analyst',
  'project-manager',
  'customer-support',
  'restaurant-manager',
  'retail',
];

const YOAZ_MARKERS_RE = /\b(yohann|yoaz|azancot)\b/i;

/**
 * @param {string} text
 */
export function parseCorpusExpectations(text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const name = lines[0] || '';
  const contactLine =
    lines.find((l) => /@/.test(l) || /\+?\d[\d\s().-]{7,}/.test(l)) || lines[2] || '';
  const email = (contactLine.match(/[\w.+-]+@[\w.-]+\.\w+/) || [])[0]?.toLowerCase() || '';
  const phoneDigits = (contactLine.match(/\+?[\d\s().-]{8,}/)?.[0] || '').replace(/\D/g, '');
  return { name, email, phoneDigits };
}

/**
 * @param {string} root
 */
export function loadGeneralizationCorpus(root) {
  const corpusRoot = path.join(root, 'tests/cv-corpus');
  return GENERALIZATION_CORPUS_IDS.map((id) => {
    const filePath = path.join(corpusRoot, `${id}.txt`);
    const text = fs.readFileSync(filePath, 'utf8');
    if (YOAZ_MARKERS_RE.test(text)) {
      throw new Error(`Corpus ${id} contains Yoaz identity markers`);
    }
    return {
      id,
      label: id.replace(/-/g, ' '),
      filePath,
      fileName: `${id}.txt`,
      text,
      expected: parseCorpusExpectations(text),
      templateId: id === 'designer' || id === 'freelancer' ? 'creative' : 'ats',
    };
  });
}
