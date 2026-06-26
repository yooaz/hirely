/**
 * HIRELY Template Showcase V8 — 8 recruiter-grade templates.
 * Brand-inspired redesign: Apple · McKinsey · Airbnb · Linear · Google · Tesla · Notion · Stripe
 */

export const TEMPLATE_SHOWCASE_VERSION = 'TEMPLATE_SHOWCASE_V8';

/** Production gallery — exactly 8 templates. */
export const TEMPLATE_FAMILY_V2_IDS = Object.freeze([
  'luxury-executive',
  'mckinsey-consulting',
  'creative-director-portfolio',
  'startup-founder',
  'tech-engineer',
  'classic-corporate',
  'apple-minimal',
  'ats-recruiter',
]);

export const TEMPLATE_FAMILY_V2_NAMES = Object.freeze({
  'luxury-executive': '01 Executive',
  'mckinsey-consulting': '02 Consulting',
  'creative-director-portfolio': '03 Creative',
  'startup-founder': '04 Startup',
  'tech-engineer': '05 Tech',
  'classic-corporate': '06 Corporate',
  'apple-minimal': '07 Minimal',
  'ats-recruiter': '08 Premium ATS',
});

/** Brand design inspiration per template (showcase metadata). */
export const TEMPLATE_BRAND_INSPIRATION = Object.freeze({
  'luxury-executive': 'Apple',
  'mckinsey-consulting': 'McKinsey',
  'creative-director-portfolio': 'Airbnb',
  'startup-founder': 'Linear',
  'tech-engineer': 'Google',
  'classic-corporate': 'Tesla',
  'apple-minimal': 'Notion',
  'ats-recruiter': 'Stripe',
});

/** Legacy V1 ids → V2 canonical id. */
export const TEMPLATE_FAMILY_V2_ALIASES = Object.freeze({
  executive: 'luxury-executive',
  '01-executive': 'luxury-executive',
  'executive-luxury': 'luxury-executive',
  'executive-minimal': 'luxury-executive',
  'ats-executive': 'luxury-executive',
  consulting: 'mckinsey-consulting',
  '02-consulting': 'mckinsey-consulting',
  'consulting-elite': 'mckinsey-consulting',
  'agency-designer': 'mckinsey-consulting',
  creative: 'creative-director-portfolio',
  '03-creative': 'creative-director-portfolio',
  'creative-director': 'creative-director-portfolio',
  'creative-portfolio': 'creative-director-portfolio',
  'kinfolk-editorial': 'creative-director-portfolio',
  'editorial-magazine': 'creative-director-portfolio',
  editorial: 'creative-director-portfolio',
  'art-director': 'creative-director-portfolio',
  'art-director-portfolio': 'creative-director-portfolio',
  startup: 'startup-founder',
  '04-startup': 'startup-founder',
  'startup-builder': 'startup-founder',
  founder: 'startup-founder',
  tech: 'tech-engineer',
  '05-tech': 'tech-engineer',
  'tech-structured': 'tech-engineer',
  'modern-two-column': 'tech-engineer',
  corporate: 'classic-corporate',
  '06-corporate': 'classic-corporate',
  'swiss-editorial': 'classic-corporate',
  'classic-corporate': 'classic-corporate',
  minimal: 'apple-minimal',
  '07-minimal': 'apple-minimal',
  'visual-timeline': 'apple-minimal',
  timeline: 'apple-minimal',
  apple: 'apple-minimal',
  'premium-ats': 'ats-recruiter',
  '08-premium-ats': 'ats-recruiter',
  'ats-elite': 'ats-recruiter',
  'ats-clean': 'ats-recruiter',
  'ats-recruiter': 'ats-recruiter',
  freelance: 'classic-corporate',
  'freelance-creative': 'classic-corporate',
});

export const TEMPLATE_FAMILY_V2_CSS = 'cv-templates-v2-families.css';
export const TEMPLATE_SHOWCASE_CSS = 'cv-templates-showcase-v8.css';

export const TEMPLATE_SYSTEM_V2_VERSION = TEMPLATE_SHOWCASE_VERSION;

export const TEMPLATE_FAMILY_V2_ARCHITECTURE = Object.freeze({
  'luxury-executive': {
    grid: 'Centered monument · single narrative column · 44px margins',
    hierarchy: 'Identity → Executive summary → Leadership experience',
    typography: 'SF Pro–style Inter · 32pt name · hairline gold rule',
    spacing: 'Apple keynote rhythm · 36px section gaps',
    emphasis: 'C-suite gravitas · achievement ribbon · serif display',
    layoutFamily: 'executive-centered',
    brand: 'Apple',
    sectionOrder: ['summary', 'experience', 'education', 'skills', 'languages'],
  },
  'mckinsey-consulting': {
    grid: '4/8 asymmetric split · impact matrix footer',
    hierarchy: 'Engagement summary → Case experience → Credentials rail',
    typography: 'Libre Baskerville · IBM Plex Sans · McKinsey navy',
    spacing: 'Consulting 24px gaps · matrix cells 16px',
    emphasis: 'Quantified outcomes · board credibility',
    layoutFamily: 'consulting-split',
    brand: 'McKinsey',
    sectionOrder: ['summary', 'experience', 'education', 'skills', 'languages'],
  },
  'creative-director-portfolio': {
    grid: 'Hero band · 3-col client grid · case studies',
    hierarchy: 'Identity hero → Clients → Projects → Career',
    typography: 'Instrument Serif · DM Sans · Airbnb warmth',
    spacing: 'Portfolio 32px hero · 18px grid gaps',
    emphasis: 'Brand proof · hospitality warmth · coral accent',
    layoutFamily: 'portfolio-hero',
    brand: 'Airbnb',
    sectionOrder: ['clients', 'projects', 'experience', 'skills', 'education'],
  },
  'startup-founder': {
    grid: 'Venture hero · traction strip · 22/78 operator split',
    hierarchy: 'Founder thesis → Traction → Roles & impact',
    typography: 'Inter 800 · Linear purple accent · mono metrics',
    spacing: 'Operator 16px body · 24px hero',
    emphasis: 'Product velocity · sharp UI rhythm',
    layoutFamily: 'founder-split',
    brand: 'Linear',
    sectionOrder: ['summary', 'experience', 'clients', 'projects', 'education', 'skills'],
  },
  'tech-engineer': {
    grid: '28/72 skills rail · systems experience column',
    hierarchy: 'Stack rail → Experience → Projects',
    typography: 'Google Product Sans feel · multi-color bar · Inter body',
    spacing: 'Engineering 14px tight · rail compact',
    emphasis: 'Stack clarity · systems shipped',
    layoutFamily: 'tech-rail',
    brand: 'Google',
    sectionOrder: ['skills', 'tools', 'experience', 'projects', 'education'],
  },
  'classic-corporate': {
    grid: 'Masthead · 65/35 credentials split · ruled summary',
    hierarchy: 'Identity → Summary → Experience → Sidebar',
    typography: 'Tesla minimal · uppercase tracked labels · red accent',
    spacing: 'Institutional 40px margins · 22px rhythm',
    emphasis: 'Precision engineering · corporate discipline',
    layoutFamily: 'corporate-split',
    brand: 'Tesla',
    sectionOrder: ['summary', 'experience', 'education', 'skills', 'tools', 'languages'],
  },
  'apple-minimal': {
    grid: 'Single column · 52px margins · timeline spine',
    hierarchy: 'Identity → Career spine → Skills whisper',
    typography: 'Notion warm gray · 11pt body · subtle borders',
    spacing: 'Editorial whitespace · 40px between sections',
    emphasis: 'Clarity · document-first · no decoration',
    layoutFamily: 'timeline-minimal',
    brand: 'Notion',
    sectionOrder: ['experience', 'education', 'skills', 'tools', 'languages'],
  },
  'ats-recruiter': {
    grid: 'Single column · 72ch · contact utility band',
    hierarchy: 'Experience → Education → Skills (recruiter scan)',
    typography: 'Stripe indigo accents · Inter · tabular dates',
    spacing: 'Dense 10px rhythm · precise grid',
    emphasis: 'Parse density · zero overlap · export fidelity',
    layoutFamily: 'dense-single',
    brand: 'Stripe',
    sectionOrder: ['experience', 'education', 'skills', 'tools', 'languages', 'summary'],
  },
});

/**
 * @param {string} templateId
 */
export function resolveTemplateFamilyV2Id(templateId) {
  const id = String(templateId || '').trim();
  if (TEMPLATE_FAMILY_V2_IDS.includes(id)) return id;
  return TEMPLATE_FAMILY_V2_ALIASES[id] || id;
}

/**
 * @param {string} templateId
 */
export function templateFamilyV2DisplayName(templateId) {
  const id = resolveTemplateFamilyV2Id(templateId);
  return TEMPLATE_FAMILY_V2_NAMES[id] || id;
}

/**
 * @param {string} templateId
 */
export function templateBrandInspiration(templateId) {
  const id = resolveTemplateFamilyV2Id(templateId);
  return TEMPLATE_BRAND_INSPIRATION[id] || '';
}
