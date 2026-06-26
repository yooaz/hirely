/**
 * Template System V2 — public API.
 */

export {
  TEMPLATE_SYSTEM_V2,
  TEMPLATE_SYSTEM_P5_LOCK,
  TEMPLATE_V2_IDS,
  TEMPLATE_V2_PAGE_POLICY,
  TEMPLATE_V2_RULES,
  isTemplateV2Id,
  assertTemplateViewContract,
} from './contract.js';

export {
  TEMPLATE_V2_REGISTRY,
  TEMPLATE_V2_ALIASES,
  TEMPLATE_V2_COUNT,
  TEMPLATE_V2_ENGINE,
  resolveTemplateV2,
  resolveTemplateV2RenderLayer,
} from './registry.js';

export { resumeDataToTemplateView } from './view-model.js';

export {
  evaluateTemplatePagePolicy,
  TEMPLATE_V2_A4,
  templateV2ShellClasses,
} from './page-policy.js';
