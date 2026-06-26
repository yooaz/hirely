/**
 * Boot contract entry — canonical import surface without pulling the full barrel.
 */
export {
  canonicalImportFromFile,
  canonicalImportFromText,
  detectFileType,
} from './import/canonical-import.js';
