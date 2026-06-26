/**
 * Premium Template Gallery — V1 six-template catalog.
 */

/** @typedef {'all'|'ats'|'creative'|'executive'|'portfolio'|'tech'|'consulting'|'editorial'} GalleryUseCase */

export const PREMIUM_GALLERY_USE_CASES = Object.freeze([
  { id: 'all', label: 'All', labelFr: 'Tous' },
  { id: 'ats', label: 'ATS', labelFr: 'ATS' },
  { id: 'creative', label: 'Creative', labelFr: 'Créatif' },
  { id: 'editorial', label: 'Editorial', labelFr: 'Éditorial' },
  { id: 'executive', label: 'Executive', labelFr: 'Executive' },
  { id: 'portfolio', label: 'Portfolio', labelFr: 'Portfolio' },
  { id: 'tech', label: 'Tech', labelFr: 'Tech' },
]);

/**
 * Per-template gallery card metadata — V1 production surface only.
 * @type {Record<string, { useCases: GalleryUseCase[], hiringSuccess: string, visualStyle: string }>}
 */
export const PREMIUM_TEMPLATE_GALLERY_META = Object.freeze({
  ats: {
    useCases: ['ats', 'tech'],
    hiringSuccess: '98% ATS readability · free default',
    visualStyle: 'System sans · pure black & white · recruiter scan',
  },
  'minimal-ats': {
    useCases: ['ats', 'tech'],
    hiringSuccess: '97% recruiter parse · ultra-dense',
    visualStyle: 'Inter tabular · 68ch · date-role grid',
  },
  'creative-portfolio': {
    useCases: ['creative', 'portfolio'],
    hiringSuccess: 'Creative portfolio shortlist',
    visualStyle: 'Display serif hero · coral accent · client grid',
  },
  'editorial-magazine': {
    useCases: ['creative', 'portfolio', 'editorial'],
    hiringSuccess: 'Designer editorial · culture-forward',
    visualStyle: 'Playfair cover · asymmetric spread · warm ink',
  },
  'classic-corporate': {
    useCases: ['executive', 'ats'],
    hiringSuccess: 'Executive credibility · board-ready',
    visualStyle: 'Institutional sans · red accent rule · masthead',
  },
  'tech-structured': {
    useCases: ['tech', 'ats'],
    hiringSuccess: '92% engineering screen pass',
    visualStyle: 'Dark skills rail · mono stack · systems column',
  },
});

/**
 * @param {string} templateId
 * @param {GalleryUseCase} [filter]
 */
export function templateMatchesGalleryFilter(templateId, filter = 'all') {
  if (!filter || filter === 'all') return true;
  const meta = PREMIUM_TEMPLATE_GALLERY_META[templateId];
  if (!meta) return false;
  return meta.useCases.includes(filter);
}

/**
 * @param {string} templateId
 * @param {object} [tpl] Hirely template record
 */
export function galleryCardMeta(templateId, tpl = {}) {
  const custom = PREMIUM_TEMPLATE_GALLERY_META[templateId] || {};
  return {
    useCases: custom.useCases || ['creative'],
    hiringSuccess: custom.hiringSuccess || 'Premium hire-ready layout',
    visualStyle: custom.visualStyle || tpl.tagline || tpl.bestFor || tpl.category || 'Premium layout',
    bestFor: tpl.bestFor || tpl.category || 'Professional roles',
  };
}
