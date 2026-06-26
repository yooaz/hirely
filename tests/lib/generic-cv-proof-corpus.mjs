/**
 * P0 — 20 non-Yoaz generic CV corpus for import → parse → preview proof.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const GENERIC_CV_PROOF_ENGINE = 'GENERIC_CV_PROOF_V1';
export const CORPUS_DIR = path.join(__dirname, '../cv-corpus');

export const GENERIC_CV_PROFILES = Object.freeze([
  'developer',
  'teacher',
  'nurse',
  'sales',
  'marketing',
  'student',
  'executive',
  'consultant',
  'designer',
  'engineer',
  'restaurant-manager',
  'retail',
  'finance',
  'hr',
  'project-manager',
  'data-analyst',
  'architect',
  'photographer',
  'lawyer',
  'customer-support',
]);

const YOAZ_MARKERS_RE = /\b(yohann|yoaz|azancot|yoazg@hotmail|yoaz@hotmail)\b/i;

/**
 * @param {string} text
 */
export function parseGenericCvExpectations(text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const name = lines[0] || '';
  const title = lines[1] || '';
  const contactLine =
    lines.find((l) => /@/.test(l) || /\+?\d[\d\s().-]{7,}/.test(l)) || lines[2] || '';
  const email = (contactLine.match(/[\w.+-]+@[\w.-]+\.\w+/) || [])[0]?.toLowerCase() || '';
  const phoneRaw = (contactLine.match(/\+?[\d\s().-]{8,}/)?.[0] || '').trim();
  const phoneDigits = phoneRaw.replace(/\D/g, '');
  const companies = [];
  const schools = [];
  const skills = [];

  for (const line of lines) {
    if (/^experience$/i.test(line) || /^education$/i.test(line) || /^skills$/i.test(line)) continue;
    const expMatch = line.match(/^(.+?)\s+—\s+([^—]+)\s+—/);
    if (expMatch) companies.push(expMatch[2].trim());
    if (/\b(university|college|school|institut|academy|mba|b\.?s\.?|m\.?s\.?c?\.?|b\.?a\.?|diploma|j\.?d\.?)\b/i.test(line)) {
      schools.push(line);
    }
    if (/^skills$/i.test(line)) continue;
  }

  const skillsIdx = lines.findIndex((l) => /^skills$/i.test(l));
  if (skillsIdx >= 0) {
    for (let i = skillsIdx + 1; i < lines.length; i++) {
      const l = lines[i];
      if (/^(tools|languages|experience|education)$/i.test(l)) break;
      if (l && !/^-/.test(l)) skills.push(...l.split(/,\s*/).map((s) => s.trim()).filter(Boolean));
    }
  }

  return {
    name,
    title,
    email,
    phoneRaw,
    phoneDigits,
    companies,
    schools,
    skills,
  };
}

/**
 * @param {string} id
 */
export function templateIdForProfile(id) {
  if (id === 'designer' || id === 'photographer') return 'creative';
  return 'ats';
}

/**
 * @param {string} root
 */
export function loadGenericCvCorpus(root) {
  const corpusRoot = path.join(root, 'tests/cv-corpus');
  return GENERIC_CV_PROFILES.map((id) => {
    const filePath = path.join(corpusRoot, `${id}.txt`);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Missing generic CV corpus file: ${filePath}`);
    }
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
      expected: parseGenericCvExpectations(text),
      templateId: templateIdForProfile(id),
    };
  });
}

/**
 * @param {object[]} fixtures
 */
export function assertCorpusUniqueness(fixtures) {
  const names = new Set();
  const emails = new Set();
  const phones = new Set();
  const issues = [];
  for (const f of fixtures) {
    const e = f.expected || {};
    if (names.has(e.name)) issues.push(`duplicate name: ${e.name}`);
    if (emails.has(e.email)) issues.push(`duplicate email: ${e.email}`);
    if (phones.has(e.phoneDigits)) issues.push(`duplicate phone: ${e.phoneDigits}`);
    names.add(e.name);
    emails.add(e.email);
    phones.add(e.phoneDigits);
  }
  return issues;
}
