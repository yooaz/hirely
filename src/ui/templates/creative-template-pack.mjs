/**
 * P1 — Graphic template pack (8 distinct visual skins, zero content loss).
 */
import {
  PRODUCTION_TEMPLATE_IDS,
  PRODUCTION_TEMPLATE_DISPLAY_NAMES,
} from './production-template-ids.mjs';

export const CREATIVE_TEMPLATE_PACK = 'GRAPHIC_TEMPLATE_PACK_P1';

export const GRAPHIC_PACK_BRIEFS = Object.freeze({
  ats: {
    name: 'ATS Clean',
    grid: 'single-column',
    hierarchy: 'classic-recruiter',
    typography: 'Inter + system',
    sections: 'experience-first-meta-footer',
  },
  'creative-portfolio': {
    name: 'Creative Portfolio',
    grid: 'hero-split-portfolio',
    hierarchy: 'clients-projects-first',
    typography: 'Instrument Serif + DM Sans',
    sections: 'portfolio-forward',
  },
  'editorial-magazine': {
    name: 'Editorial Magazine',
    grid: 'masthead-3col',
    hierarchy: 'magazine-columns',
    typography: 'Playfair Display + Source Serif',
    sections: 'meta-exp-portfolio-right',
  },
  'luxury-minimal': {
    name: 'Luxury Minimal',
    grid: 'narrow-centered-grid',
    hierarchy: 'elegant-sparse',
    typography: 'Cormorant Garamond + Helvetica',
    sections: 'clients-projects-balanced',
  },
  'agency-designer': {
    name: 'Agency Designer',
    grid: 'dark-header-28-72',
    hierarchy: 'agency-band-rail',
    typography: 'Helvetica Neue + Inter',
    sections: 'skills-rail-work-main',
  },
  'visual-timeline': {
    name: 'Visual Timeline',
    grid: 'timeline-rail',
    hierarchy: 'chrono-left-rail',
    typography: 'JetBrains Mono + Inter',
    sections: 'timeline-experience',
  },
  'tech-structured': {
    name: 'Tech Structured',
    grid: 'two-column-structured',
    hierarchy: 'skills-rail-dense',
    typography: 'IBM Plex Sans + Mono',
    sections: 'tech-meta-work-stack',
  },
  'art-director-portfolio': {
    name: 'Art Director Portfolio',
    grid: 'split-meta-dominant',
    hierarchy: 'grid-head-creative-stack',
    typography: 'Archivo + Inter',
    sections: 'creative-first-split',
  },
});

/** @deprecated Use GRAPHIC_PACK_BRIEFS */
export const CREATIVE_PACK_BRIEFS = GRAPHIC_PACK_BRIEFS;

export const GRAPHIC_PACK_NAMES = [
  'ATS Clean',
  ...PRODUCTION_TEMPLATE_IDS.map(
    (id) => GRAPHIC_PACK_BRIEFS[id]?.name || PRODUCTION_TEMPLATE_DISPLAY_NAMES[id] || id
  ),
];

export const CREATIVE_PACK_NAMES = PRODUCTION_TEMPLATE_IDS.map(
  (id) => GRAPHIC_PACK_BRIEFS[id]?.name || PRODUCTION_TEMPLATE_DISPLAY_NAMES[id] || id
);

export function listCreativePackTemplates() {
  return PRODUCTION_TEMPLATE_IDS.map((id) => ({
    id,
    ...GRAPHIC_PACK_BRIEFS[id],
    displayName: PRODUCTION_TEMPLATE_DISPLAY_NAMES[id],
  }));
}
