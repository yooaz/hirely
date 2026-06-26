/**
 * HIRELY Template Library V1 — six differentiated production templates.
 * Re-exports template-families-v3 as production catalog.
 */
export const TEN_PREMIUM_TEMPLATE_REBUILD_VERSION = 'TEMPLATE_LIBRARY_V3_REBUILD';

export {
  TEMPLATE_LIBRARY_V3_VERSION as TEN_PREMIUM_TEMPLATES_VERSION,
  TEMPLATE_FAMILY_V3_IDS as TEN_PREMIUM_TEMPLATE_IDS,
  TEMPLATE_FAMILY_V3_NAMES as TEN_PREMIUM_TEMPLATE_NAMES,
  TEMPLATE_FAMILY_V3_ALIASES as TEN_PREMIUM_TEMPLATE_ALIASES,
  TEMPLATE_FAMILY_V3_ARCHITECTURE as TEMPLATE_FAMILY_V2_ARCHITECTURE,
  TEMPLATE_FAMILY_V3_CSS as TEMPLATE_FAMILY_V2_CSS,
  resolveTemplateFamilyV3Id as resolveTemplateFamilyV2Id,
  resolveTemplateFamilyV3Id as resolveTenPremiumTemplateId,
  templateFamilyV3DisplayName as templateFamilyV2DisplayName,
  templateFamilyV3DisplayName as tenPremiumDisplayName,
  TEMPLATE_FAMILY_V3_IDS as TEMPLATE_FAMILY_V2_IDS,
  TEMPLATE_FAMILY_V3_NAMES as TEMPLATE_FAMILY_V2_NAMES,
  TEMPLATE_FAMILY_V3_ALIASES as TEMPLATE_FAMILY_V2_ALIASES,
} from './template-families-v3.mjs';

export {
  TEN_PREMIUM_LAYOUT_BRIEFS,
  TEN_PREMIUM_LAYOUT_MARKERS,
  TEN_PREMIUM_COUNT,
  TEN_PREMIUM_DEDICATED_CSS_MAP,
} from './template-library-v3.mjs';

import {
  TEMPLATE_FAMILY_V3_IDS,
  TEMPLATE_FAMILY_V3_ARCHITECTURE,
  resolveTemplateFamilyV3Id,
} from './template-families-v3.mjs';

export const TEMPLATE_SYSTEM_V2_VERSION = 'TEMPLATE_LIBRARY_V3';
export const TEMPLATE_SHOWCASE_VERSION = 'TEMPLATE_LIBRARY_V3';

export const TEMPLATE_BRAND_INSPIRATION = Object.freeze(
  Object.fromEntries(
    TEMPLATE_FAMILY_V3_IDS.map((id) => {
      const arch = TEMPLATE_FAMILY_V3_ARCHITECTURE[id];
      return [id, arch?.layoutFamily || id];
    })
  )
);

/**
 * @param {string} templateId
 */
export function templateBrandInspiration(templateId) {
  const id = resolveTemplateFamilyV3Id(templateId);
  return TEMPLATE_BRAND_INSPIRATION[id] || '';
}
