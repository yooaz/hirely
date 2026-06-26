/**
 * Parser dictionary pack — import from here in core/parsing only.
 */

export { TOOLS, KNOWN_TOOLS } from './tools.js';
export { SKILLS, SKILL_TERM_RE, SKILL_HINT_RE } from './skills.js';
export { LANGUAGES, LANGUAGE_ALIASES, detectLanguagesFromText } from './languages.js';
export {
  EDUCATION_KEYWORDS,
  EDUCATION_HEADER_RE,
  isEducationHeaderLine,
} from './educationKeywords.js';
export { ROLE_KEYWORDS, ROLE_TITLE_RE, lineLooksLikeRole } from './roleKeywords.js';
export {
  CLIENT_COMPANY_KEYWORDS,
  KNOWN_CLIENTS,
  detectClientsInText,
  lineLooksLikeClientList,
} from './clientCompanyKeywords.js';
export {
  isGarbageLine,
  structuredTextHasGarbage,
  isMixedPhoneEducation,
  PLACEHOLDER_TOKENS,
} from './garbagePatterns.js';
export { SCHOOL_NAMES, SCHOOL_NAME_RE, lineMatchesSchool } from './schools.js';
