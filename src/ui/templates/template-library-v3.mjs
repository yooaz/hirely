/**
 * HIRELY Template Library V3 — production catalog.
 */
export const TEMPLATE_LIBRARY_V3_VERSION = 'TEMPLATE_LIBRARY_V3';

export {
  TEMPLATE_LIBRARY_V3_VERSION as TEN_PREMIUM_TEMPLATES_VERSION,
  TEMPLATE_FAMILY_V3_IDS as TEN_PREMIUM_TEMPLATE_IDS,
  TEMPLATE_FAMILY_V3_NAMES as TEN_PREMIUM_TEMPLATE_NAMES,
  TEMPLATE_FAMILY_V3_ALIASES as TEN_PREMIUM_TEMPLATE_ALIASES,
  TEMPLATE_FAMILY_V3_ARCHITECTURE,
  TEMPLATE_FAMILY_V3_CSS as TEN_PREMIUM_DEDICATED_CSS,
  resolveTemplateFamilyV3Id as resolveTenPremiumTemplateId,
  templateFamilyV3DisplayName as tenPremiumDisplayName,
} from './template-families-v3.mjs';

import {
  TEMPLATE_FAMILY_V3_IDS,
  TEMPLATE_FAMILY_V3_ARCHITECTURE,
} from './template-families-v3.mjs';

export const TEN_PREMIUM_TEMPLATE_REBUILD_VERSION = 'TEMPLATE_LIBRARY_V3_REBUILD';

export const TEN_PREMIUM_LAYOUT_BRIEFS = Object.freeze(
  Object.fromEntries(
    TEMPLATE_FAMILY_V3_IDS.map((id) => {
      const arch = TEMPLATE_FAMILY_V3_ARCHITECTURE[id];
      const brief = arch ? `${arch.grid} · ${arch.emphasis}` : '';
      return [id, brief];
    })
  )
);

export const TEN_PREMIUM_LAYOUT_MARKERS = Object.freeze(
  Object.fromEntries(
    TEMPLATE_FAMILY_V3_IDS.map((id) => [
      id,
      [`cvLayout-v2`, `cvLayout-v3`, `cvLayout-${id}`, `cvTpl-v3-${id}`],
    ])
  )
);

export const TEN_PREMIUM_COUNT = TEMPLATE_FAMILY_V3_IDS.length;

export const TEN_PREMIUM_DEDICATED_CSS_MAP = Object.freeze(
  Object.fromEntries(TEMPLATE_FAMILY_V3_IDS.map((id) => [id, 'cv-templates-v3-families.css']))
);
