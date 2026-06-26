/**
 * P1 — Real premium templates (five distinct production skins).
 * Render-only · same finalResumeData · A4 + PDF safe.
 */
import {
  PRODUCTION_TEMPLATE_IDS,
  PRODUCTION_TEMPLATE_DISPLAY_NAMES,
} from './production-template-ids.mjs';
import { H20_TEMPLATE_FINGERPRINTS } from './template-system-h20.mjs';

export const TEMPLATE_SYSTEM_PREMIUM = 'TEMPLATE_SYSTEM_PREMIUM_P1';

/** User-facing premium lineup with positioning. */
export const PREMIUM_TEMPLATE_BRIEFS = Object.freeze({
  ats: {
    id: 'ats',
    name: 'ATS Clean',
    tagline: 'Classic recruiter CV',
    bestFor: 'Corporate applications · ATS scan',
    feel: 'Single column · dense · tabular dates',
  },
  creative: {
    id: 'creative',
    name: 'Creative Portfolio',
    tagline: 'Big name · clients & projects first',
    bestFor: 'Designers · art direction · illustration',
    feel: 'Magazine head · client chips · project rail',
  },
  'executive-minimal': {
    id: 'executive-minimal',
    name: 'Executive Minimal',
    tagline: 'Senior · elegant · compact',
    bestFor: 'Leadership · consulting · board-ready',
    feel: 'Centered serif · stone surface · tight rhythm',
  },
  'modern-two-column': {
    id: 'modern-two-column',
    name: 'Tech Resume',
    tagline: 'Skills + tools rail · clear experience',
    bestFor: 'Product · engineering · tech leads',
    feel: 'Dark skills sidebar · mono identity · teal accent',
  },
  editorial: {
    id: 'editorial',
    name: 'Editorial Modern',
    tagline: 'Magazine grid · still readable',
    bestFor: 'Luxury · culture · senior creative',
    feel: '34/66 Swiss grid · Helvetica + Georgia',
  },
});

export const PREMIUM_TEMPLATE_NAMES = PRODUCTION_TEMPLATE_IDS.map(
  (id) => PREMIUM_TEMPLATE_BRIEFS[id]?.name || PRODUCTION_TEMPLATE_DISPLAY_NAMES[id] || id
);

export function listPremiumTemplates() {
  return PRODUCTION_TEMPLATE_IDS.map((id) => ({
    id,
    ...PREMIUM_TEMPLATE_BRIEFS[id],
    ...H20_TEMPLATE_FINGERPRINTS[id],
    displayName: PRODUCTION_TEMPLATE_DISPLAY_NAMES[id],
  }));
}
