/**
 * HIRELY production template catalog — V1 quality reset (6 templates).
 * Re-exports template-v1-catalog for backward-compatible import paths.
 */
export {
  TEMPLATE_V1_VERSION as TEMPLATE_LIBRARY_V3_VERSION,
  TEMPLATE_V1_IDS as TEMPLATE_FAMILY_V3_IDS,
  TEMPLATE_V1_NAMES as TEMPLATE_FAMILY_V3_NAMES,
  TEMPLATE_V1_CATEGORIES as TEMPLATE_FAMILY_V3_CATEGORIES,
  TEMPLATE_V1_ARCHITECTURE as TEMPLATE_FAMILY_V3_ARCHITECTURE,
  TEMPLATE_V1_ALIASES as TEMPLATE_FAMILY_V3_ALIASES,
  resolveTemplateV1Id as resolveTemplateFamilyV3Id,
  templateV1DisplayName as templateFamilyV3DisplayName,
} from './template-v1-catalog.mjs';

export const TEMPLATE_FAMILY_V3_CSS = 'cv-templates-v3-families.css';
