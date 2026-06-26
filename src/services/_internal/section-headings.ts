/**
 * Multilingual section heading dictionary (§11.4).
 */

import type { SectionId } from '../../types/blocks.types.js';

export const SECTION_HEADINGS: Record<SectionId, string[]> = {
  contact: ['contact', 'coordonnées', 'coordonnees', 'personal information'],
  summary: [
    'summary', 'profil', 'profile', 'about', 'à propos', 'a propos',
    'professional summary', 'résumé', 'resume', 'objectif',
  ],
  experience: [
    'expérience', 'experiences', 'expérience professionnelle', 'experience professionnelle',
    'professional experience', 'work experience', 'employment history', 'missions',
    'career history', 'parcours professionnel', 'expériences professionnelles',
  ],
  education: [
    'formation', 'éducation', 'education', 'études', 'etudes', 'academic background',
    'diplômes', 'diplomes', 'scolarité', 'scolarite',
  ],
  skills: [
    'compétences', 'competences', 'skills', 'technical skills', 'expertises',
    'technologies', 'stack', 'outils', 'tools',
  ],
  languages: ['langues', 'languages', 'idiomas'],
  certifications: ['certifications', 'certificats', 'licenses', 'licences'],
  projects: ['projets', 'projects', 'portfolio'],
  awards: ['awards', 'honors', 'honours', 'distinctions', 'prix'],
  publications: ['publications', 'articles', 'research'],
  interests: ['intérêts', 'interets', 'intérêt', 'interet', 'interests', 'interest', 'hobbies', 'loisirs'],
  other: [],
};

export function matchSectionHeading(text: string): SectionId | null {
  const norm = String(text || '')
    .trim()
    .toLowerCase()
    .replace(/[:\-–—|•]+$/g, '')
    .replace(/\s+/g, ' ');
  if (!norm || norm.length > 64) return null;

  for (const [section, headings] of Object.entries(SECTION_HEADINGS) as [SectionId, string[]][]) {
    if (section === 'other') continue;
    for (const h of headings) {
      if (norm === h || norm.startsWith(`${h} `)) return section;
    }
  }
  return null;
}
