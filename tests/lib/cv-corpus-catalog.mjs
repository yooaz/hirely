/**
 * P1 — Real-world CV corpus (10 archetypes).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { EMAIL_RE, PHONE_RE } from '../../src/core/parsing/field-sanitize.js';
import { parseGroundTruthFromFixture } from './section-ground-truth.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CORPUS_DIR = path.join(__dirname, '..', 'cv-corpus');

export const CV_CORPUS_ARCHETYPES = [
  'designer',
  'developer',
  'marketing',
  'teacher',
  'nurse',
  'engineer',
  'freelancer',
  'student',
  'executive',
  'consultant',
];

/** Manual overrides when auto-parsed ground truth differs from intended anchors. */
export const CV_CORPUS_OVERRIDES = {
  student: {
    experience: [
      'Software Engineering Intern — Monzo — Summer 2025',
      'Teaching Assistant — University College London — 2024 – Present',
    ],
    education: [
      'University College London — BSc Computer Science — 2022 – 2026',
      'Westminster School — A-Levels — 2020 – 2022',
    ],
  },
  marketing: {
    experience: [
      'Digital Marketing Manager — GrowthLab — 2020 – Present',
      'Marketing Executive — Unilever — 2016 – 2020',
    ],
    education: [
      'London School of Economics — MSc Marketing — 2014 – 2015',
      'University of Leeds — BA Communications — 2011 – 2014',
    ],
  },
  consultant: {
    experience: [
      'Senior Consultant — Strategy firm — 2018 – Present',
      'Business Analyst — Deloitte — 2014 – 2018',
    ],
  },
  teacher: {
    experience: [
      'Instructor — University of Oregon — Portland — 2018 – Present',
      'Teaching Assistant — Oregon State University — Portland — 2017 – 2018',
    ],
  },
  nurse: {
    experience: ['Clinical Research Coordinator — Mayo Clinic — Chicago — 2019 – Present'],
  },
  engineer: {
    education: ['MIT — MEng Mechanical Engineering — 2009 – 2013'],
  },
  student: {
    experience: [
      'Software Engineering Intern — Monzo — London — 2024 – 2025',
      'Teaching Assistant — University College London — London — 2024 – Present',
    ],
  },
};

function parseIdentityFromText(rawText) {
  const lines = String(rawText || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const name = lines[0] || '';
  const contactLine = lines.find((l) => EMAIL_RE.test(l) || PHONE_RE.test(l)) || lines[2] || '';
  const email = (contactLine.match(EMAIL_RE) || [])[0] || '';
  const phone = (contactLine.match(PHONE_RE) || [])[0]?.trim() || '';
  return { name, email, phone };
}

function groundTruthForCorpus(id, rawText) {
  const parsed = parseGroundTruthFromFixture(rawText);
  const override = CV_CORPUS_OVERRIDES[id] || {};
  const merged = { ...parsed };
  for (const key of ['experience', 'education', 'skills', 'tools', 'languages', 'clients']) {
    if (Array.isArray(override[key])) merged[key] = [...override[key]];
  }
  const identity = parseIdentityFromText(rawText);
  return {
    ...identity,
    experience: merged.experience || [],
    education: merged.education || [],
    skills: merged.skills || [],
    tools: merged.tools || [],
    languages: merged.languages || [],
    clients: merged.clients || [],
  };
}

function loadCorpusFile(archetype) {
  const fp = path.join(CORPUS_DIR, `${archetype}.txt`);
  return fs.readFileSync(fp, 'utf8');
}

/**
 * @returns {Array<{ id: string, archetype: string, label: string, text: string, groundTruth: object }>}
 */
export function loadCvCorpusFixtures() {
  return CV_CORPUS_ARCHETYPES.map((archetype) => {
    const text = loadCorpusFile(archetype);
    return {
      id: archetype,
      archetype,
      label: `${archetype.charAt(0).toUpperCase()}${archetype.slice(1)} CV`,
      text,
      groundTruth: groundTruthForCorpus(archetype, text),
    };
  });
}

export { CORPUS_DIR };
