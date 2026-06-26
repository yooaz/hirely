/**
 * Template import gate — no new template work until import stability lock passes.
 */
import path from 'path';
import { fileURLToPath } from 'url';
import {
  IMPORT_STABILITY_LOCK_VERSION,
  REQUIRED_IMPORT_STABILITY_REPORTS,
  assessImportStabilityLock,
  assertImportStabilityForTemplateWork,
} from '../../core/import/import-stability-lock.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../../..');

export {
  IMPORT_STABILITY_LOCK_VERSION,
  REQUIRED_IMPORT_STABILITY_REPORTS,
  assessImportStabilityLock,
  assertImportStabilityForTemplateWork,
};

/** @returns {ReturnType<typeof assessImportStabilityLock>} */
export function checkTemplateImportGate(root = ROOT) {
  return assessImportStabilityLock(root);
}

/** Throws when template work must remain blocked. */
export function requireImportStabilityForTemplates(root = ROOT) {
  return assertImportStabilityForTemplateWork(root);
}
