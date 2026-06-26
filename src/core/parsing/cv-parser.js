/**
 * CV parser public API — maps rubriques (nom, expérience, formation, compétences).
 * Implementation: rich-parser.js + section-mapper.js + clean.js.
 */

export {
  parseCV,
  parseCVData,
  parseStructuredCV,
  detectSections,
  headerKeyForLine,
  isSectionHeaderLine as isSectionHeader,
  splitListItems,
  lineLooksLikeTitle,
  normalizeCvData,
  emptyCVData,
  cleanExtraction,
} from './rich-parser.js';

export {
  collectSectionsOrderAgnostic,
  assignOrphanLinesToSections,
  splitBySectionHeaders,
} from './section-mapper.js';

export {
  cleanText,
  normalizeRawExtract,
  stripSpecialCharacters,
  stripHeaderFooterLines,
  normalizeSectionHeaderCasing,
} from './clean.js';
