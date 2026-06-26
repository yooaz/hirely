/**
 * HIRELY Template V1 — six differentiated templates (quality reset).
 * Single production gallery surface; legacy ids alias here.
 */

export const TEMPLATE_V1_VERSION = 'TEMPLATE_V1_QUALITY_RESET';

/** @type {readonly string[]} */
export const TEMPLATE_V1_IDS = Object.freeze([
  'ats',
  'minimal-ats',
  'creative-portfolio',
  'editorial-magazine',
  'classic-corporate',
  'tech-structured',
]);

export const TEMPLATE_V1_NAMES = Object.freeze({
  ats: 'ATS Clean',
  'minimal-ats': 'Minimal ATS',
  'creative-portfolio': 'Creative Portfolio',
  'editorial-magazine': 'Designer Editorial',
  'classic-corporate': 'Executive Classic',
  'tech-structured': 'Tech Structured',
});

export const TEMPLATE_V1_CATEGORIES = Object.freeze({
  ats: 'ATS',
  'minimal-ats': 'ATS',
  'creative-portfolio': 'Creative',
  'editorial-magazine': 'Editorial',
  'classic-corporate': 'Executive',
  'tech-structured': 'Tech',
});

/** Unique layout / typography fingerprint per V1 template. */
export const TEMPLATE_V1_ARCHITECTURE = Object.freeze({
  ats: {
    grid: 'Single column · utility contact band · date-role grid',
    hierarchy: 'Identity → Experience → Education → Skills',
    typography: 'System sans · 11px labels · pure black on white',
    spacing: 'Normal rhythm · recruiter scan · no ornament',
    emphasis: 'ATS parse · free default',
    layoutFamily: 'ats-clean',
    layoutMarkers: ['cvLayout-h20-ats', 'cvHead--ats'],
    sectionOrder: ['summary', 'experience', 'education', 'skills', 'tools', 'languages'],
  },
  'minimal-ats': {
    grid: 'Single column · 68ch · dense date grid',
    hierarchy: 'Experience first → Education → Skills',
    typography: 'Inter · tabular nums · 8pt section labels',
    spacing: 'Ultra-dense 8px · zero decorative rules',
    emphasis: 'Maximum parse density',
    layoutFamily: 'minimal-ats-v3',
    layoutMarkers: ['cvLayout-minimal-ats', 'cvMain--v3-ats'],
    sectionOrder: ['experience', 'education', 'skills', 'tools', 'languages', 'summary'],
  },
  'creative-portfolio': {
    grid: 'Portfolio hero · client proof grid · case stack',
    hierarchy: 'Identity → Clients → Projects → Experience',
    typography: 'Display serif + humanist sans · coral accent',
    spacing: 'Generous hero · 24px case rhythm',
    emphasis: 'Visual portfolio · creative proof',
    layoutFamily: 'creative-portfolio',
    layoutMarkers: ['cvLayout-h20-creative-portfolio', 'cvLayout-portfolio'],
    sectionOrder: ['clients', 'projects', 'experience', 'skills', 'education'],
  },
  'editorial-magazine': {
    grid: 'Magazine cover · asymmetric columns · feature spread',
    hierarchy: 'Cover identity → Feature column → Credentials',
    typography: 'Playfair display · editorial small caps · warm ink',
    spacing: 'Editorial gutters · float-friendly sections',
    emphasis: 'Designer editorial · culture-forward',
    layoutFamily: 'editorial-magazine',
    layoutMarkers: ['cvLayout-editorial-magazine', 'cvHead--editorial-magazine'],
    sectionOrder: ['summary', 'experience', 'clients', 'projects', 'education', 'skills'],
  },
  'classic-corporate': {
    grid: 'Institutional masthead · red accent rule · single narrative',
    hierarchy: 'Corporate identity → Leadership → Education',
    typography: 'Tesla-precision sans · institutional caps',
    spacing: 'Boardroom margins · structured bands',
    emphasis: 'Executive classic · corporate credibility',
    layoutFamily: 'classic-corporate',
    layoutMarkers: ['cvLayout-classic-corporate', 'cvHead--classic-corporate'],
    sectionOrder: ['summary', 'experience', 'education', 'skills', 'languages'],
  },
  'tech-structured': {
    grid: 'Dark skills rail · mono stack · systems column',
    hierarchy: 'Engineering identity → Stack rail → Shipped systems',
    typography: 'Mono accents · structured hierarchy · GitHub density',
    spacing: 'Compact rail · 11px body in sidebar',
    emphasis: 'Technical depth · staff engineer scan',
    layoutFamily: 'tech-structured',
    layoutMarkers: ['cvLayout-tech-structured', 'cvSide--tech-structured'],
    sectionOrder: ['skills', 'tools', 'experience', 'projects', 'education'],
  },
});

/** Legacy / duplicate gallery ids → V1 canonical id. */
export const TEMPLATE_V1_ALIASES = Object.freeze({
  ats: 'ats',
  'modern-clean': 'ats',
  'ats-clean': 'ats',
  'minimal-ats': 'minimal-ats',
  compactrecruiter: 'minimal-ats',
  'ats-recruiter': 'minimal-ats',
  'premium-ats': 'minimal-ats',
  'ats-elite': 'minimal-ats',
  academic: 'minimal-ats',
  'creative-portfolio': 'creative-portfolio',
  creative: 'creative-portfolio',
  'portfolio-artist': 'creative-portfolio',
  'creative-director': 'creative-portfolio',
  'creative-director-portfolio': 'creative-portfolio',
  'behance-showcase': 'creative-portfolio',
  'art-director': 'creative-portfolio',
  'art-director-portfolio': 'creative-portfolio',
  'illustrator-portfolio': 'creative-portfolio',
  pentagram: 'creative-portfolio',
  'editorial-magazine': 'editorial-magazine',
  'magazine-editorial': 'editorial-magazine',
  'kinfolk-editorial': 'editorial-magazine',
  editorial: 'editorial-magazine',
  'luxury-editorial': 'editorial-magazine',
  'swiss-editorial': 'editorial-magazine',
  designer: 'editorial-magazine',
  marketing: 'editorial-magazine',
  'classic-corporate': 'classic-corporate',
  corporate: 'classic-corporate',
  '06-corporate': 'classic-corporate',
  executive: 'classic-corporate',
  'executive-board': 'classic-corporate',
  'luxury-executive': 'classic-corporate',
  'executive-luxury': 'classic-corporate',
  'ats-executive': 'classic-corporate',
  'executive-minimal': 'classic-corporate',
  minimaliste: 'classic-corporate',
  compact: 'classic-corporate',
  freelance: 'classic-corporate',
  'tech-structured': 'tech-structured',
  tech: 'tech-structured',
  'tech-engineer': 'tech-structured',
  'senior-engineer': 'tech-structured',
  'staff-engineer': 'tech-structured',
  engineer: 'tech-structured',
  'google-style': 'tech-structured',
  'product-manager': 'tech-structured',
  'modern-two-column': 'tech-structured',
  'consulting-elite': 'classic-corporate',
  'mckinsey-consulting': 'classic-corporate',
  consulting: 'classic-corporate',
  'agency-designer': 'classic-corporate',
  'apple-style': 'editorial-magazine',
  'apple-minimal': 'editorial-magazine',
  apple: 'editorial-magazine',
  'visual-timeline': 'editorial-magazine',
  timeline: 'editorial-magazine',
  'startup-founder': 'tech-structured',
  'startup-builder': 'tech-structured',
  startup: 'tech-structured',
  founder: 'tech-structured',
});

/**
 * @param {string} templateId
 */
export function resolveTemplateV1Id(templateId) {
  const key = String(templateId || 'ats').trim();
  return TEMPLATE_V1_ALIASES[key] || key;
}

/**
 * @param {string} templateId
 */
export function templateV1DisplayName(templateId) {
  const id = resolveTemplateV1Id(templateId);
  return TEMPLATE_V1_NAMES[id] || id;
}
