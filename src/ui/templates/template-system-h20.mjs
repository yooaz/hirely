/**
 * H20 — Real template system contract (metadata for QA + docs).
 */
import { PRODUCTION_TEMPLATE_IDS, PRODUCTION_TEMPLATE_DISPLAY_NAMES } from './production-template-ids.mjs';

export const TEMPLATE_SYSTEM_H20 = 'TEMPLATE_SYSTEM_H20';

/** Instant recognition targets — recruiter identifies in < 2s. */
export const H20_TEMPLATE_FINGERPRINTS = Object.freeze({
  ats: {
    id: 'ats',
    name: 'ATS Clean',
    grid: 'single-column',
    hierarchy: 'dense-recruiter-scan',
    typography: 'IBM Plex Sans',
    sectionLayout: 'linear-all-sections',
    spacing: 'tight-14px',
    pdfSignature: 'h20-ats-main-padding',
  },
  creative: {
    id: 'creative',
    name: 'Creative Portfolio',
    grid: 'magazine-split-head',
    hierarchy: 'clients-projects-first',
    typography: 'Playfair Display + DM Sans',
    sectionLayout: 'magazine-stack',
    spacing: 'airy-20px',
    pdfSignature: 'h20-creative-split-head',
  },
  'executive-minimal': {
    id: 'executive-minimal',
    name: 'Executive Minimal',
    grid: 'centered-single',
    hierarchy: 'serif-authority',
    typography: 'Cormorant Garamond + Source Serif',
    sectionLayout: 'centered-narrow-column',
    spacing: 'executive-22px',
    pdfSignature: 'h20-executive-stone-bg',
  },
  'modern-two-column': {
    id: 'modern-two-column',
    name: 'Tech Resume',
    grid: '30-70-dark-rail',
    hierarchy: 'skills-sidebar-mono-name',
    typography: 'JetBrains Mono + DM Sans',
    sectionLayout: 'skills-rail-experience-main',
    spacing: 'tech-16px',
    pdfSignature: 'h20-tech-dark-rail',
  },
  editorial: {
    id: 'editorial',
    name: 'Editorial Modern',
    grid: '34-66-asymmetric',
    hierarchy: 'swiss-editorial',
    typography: 'Helvetica Neue + Georgia',
    sectionLayout: 'meta-rail-experience-main',
    spacing: 'editorial-24px',
    pdfSignature: 'h20-editorial-asymmetric',
  },
});

export const H20_PRODUCTION_NAMES = PRODUCTION_TEMPLATE_IDS.map(
  (id) => PRODUCTION_TEMPLATE_DISPLAY_NAMES[id] || id
);

export function listH20Templates() {
  return PRODUCTION_TEMPLATE_IDS.map((id) => ({
    id,
    ...H20_TEMPLATE_FINGERPRINTS[id],
    displayName: PRODUCTION_TEMPLATE_DISPLAY_NAMES[id],
  }));
}
