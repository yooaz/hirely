/**
 * P0 — Free users can preview every template; Pro tier gates export only.
 */

export const FREE_TEMPLATE_PREVIEW_MODE_V1 = 'FREE_TEMPLATE_PREVIEW_MODE_V1';

/** Visual preview is never paywalled. */
export function isTemplatePreviewAllowedForFreeUser() {
  return true;
}

/**
 * @param {{ tier?: string }} templateMeta
 */
export function isTemplateExportProLocked(templateMeta) {
  return String(templateMeta?.tier || 'pro').toLowerCase() === 'pro';
}

/**
 * @param {string} html
 */
export function indexHtmlEnablesFreeTemplatePreview(html) {
  const src = String(html || '');
  if (!src.includes('FREE_TEMPLATE_PREVIEW_MODE_V1')) return false;
  if (!src.includes('function canPreviewTemplate(')) return false;
  if (/if\s*\(\s*!isPro\(\)\s*&&\s*isPremiumTemplate\(tpl\)\)\s*tpl\s*=\s*FREE_TEMPLATE_ID/.test(src)) {
    return false;
  }
  if (/if\s*\(\s*\(cardEl\?\.dataset\?\.tier==='pro'/.test(src)) return false;
  if (!src.includes('tplCard--locked')) return false;
  if (!/async function downloadPDF\(\)[\s\S]{0,120}if\s*\(\s*!requirePro\(\)\s*\)\s*return/.test(src)) {
    return false;
  }
  return true;
}
