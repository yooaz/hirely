/**
 * Hirely QA / report console filtering.
 * Strips browser-extension noise only — never hides real app errors.
 */

/** @type {RegExp[]} */
export const EXTENSION_CONSOLE_PATTERNS = [
  /tabs:outgoing\.message\.ready/i,
  /no\s+listener:\s*tabs:/i,
  /unchecked\s+runtime\.lasterror/i,
  /chrome-extension:\/\//i,
  /moz-extension:\/\//i,
  /safari-extension:\/\//i,
  /extensions::/i,
  /content\.js:\d+/i,
  /vendor\.js:\d+/i,
];

/**
 * Browser extension / DevTools noise (not Hirely).
 * @param {unknown} text
 * @returns {boolean}
 */
export function isExtensionConsoleNoise(text) {
  if (text == null || text === '') return false;
  const t = String(text);
  return EXTENSION_CONSOLE_PATTERNS.some((re) => re.test(t));
}

/**
 * @param {unknown} text
 * @returns {string|null}
 */
export function filterExtensionConsoleNoise(text) {
  return isExtensionConsoleNoise(text) ? null : String(text);
}

/**
 * Fatal Hirely failures for product-lock style QA gates.
 * @param {unknown} text
 * @returns {boolean}
 */
export function isHirelyAppFatal(text) {
  if (!text || isExtensionConsoleNoise(text)) return false;
  const t = String(text);
  return (
    /STRUCTURED_RESUME_TOO_LARGE/i.test(t) ||
    /HIRELY_IMPORT_FAILED|CORE_BOOT_FAILED|HIRELY_ENGINE_FAILED/i.test(t) ||
    /white screen|uncaught.*index\.html/i.test(t) ||
    (/TypeError|ReferenceError|RangeError/i.test(t) &&
      /hirely|Hirely|index\.html|src\/core/i.test(t))
  );
}

/**
 * Any non-extension console/page error worth surfacing in QA reports.
 * @param {unknown} text
 * @returns {boolean}
 */
export function isQaReportableConsoleError(text) {
  return !isExtensionConsoleNoise(text);
}

/**
 * @param {Array<string|{ text?: string }>} lines
 * @returns {string[]}
 */
export function filterQaConsoleLines(lines) {
  return lines
    .map((l) => (typeof l === 'string' ? l : l?.text || ''))
    .filter((t) => t && isQaReportableConsoleError(t));
}
