/**
 * Line-level type classification — strict priority prevents section leaks.
 */

import {
  CLASSIFICATION_CONFIDENCE_THRESHOLD,
  findLongestEntityTerm,
  ENTITY_CATALOG,
} from './entity-dictionaries.js';
import { resolveLineEntities, ENTITY_CLASSIFY_THRESHOLD } from './entity-engine.js';
import {
  scoreEducationConfidence,
  mustNeverBeExperience,
  hasEducationSchool,
  hasEducationDegree,
} from './education-confidence.js';
import {
  passesExperienceGate,
  hasExperienceDate,
  isLikelySkillLine,
  isLikelyPortfolioProject,
} from './section-sanity.js';
import {
  blocksExperienceClassification,
  lineIsCreativeRoleHeadline,
  findLongestDictionaryTerm,
  classifyLineByDictionary,
  applyDictionaryBoostToClassification,
  DICTIONARY_BOOST,
  CLIENT_TERMS,
  TOOL_TERMS,
  SCHOOL_TERMS,
} from '../../data/dictionaries/json-dictionary-match.js';
import { lineLooksLikeName, lineLooksLikeTitle, isSectionHeaderLine } from './rich-parser.js';
import { fuzzySectionKey } from './section-fuzzy.js';
import {
  classifyCreativeLine,
  CREATIVE_BUCKET_TO_BLOCK_TYPE,
  isCreativeJobLine,
  isCreativeNonExperienceLine,
} from './creative-parsing-mode.js';
import {
  isLikelyFreelanceCareerLine,
  isStrictSoftwareLine,
  isCreativeSkillPhrase,
  isClientListLine,
  parseEducationLineWithContact,
} from './classification-fixes.js';

export { CLASSIFICATION_CONFIDENCE_THRESHOLD };

const LOCKED_SECTIONS = new Set([
  'experience',
  'education',
  'skills',
  'tools',
  'languages',
  'summary',
  'clients',
  'projects',
  'exhibitions',
  'awards',
  'publications',
  'contact',
  'portfolio',
  'portfolioLinks',
  'interests',
  'profile',
]);

const SECTION_TO_TYPE = {
  experience: 'experience',
  education: 'education',
  clients: 'clients',
  skills: 'skills',
  tools: 'tools',
  languages: 'languages',
  summary: 'summary',
  profile: 'summary',
  contact: 'contact',
  projects: 'projects',
  portfolioLinks: 'contact',
  portfolio: 'contact',
  header: 'identity',
  interests: 'interests',
  profile: 'summary',
  awards: 'awards',
  award: 'awards',
  exhibitions: 'exhibitions',
  exhibition: 'exhibitions',
  publications: 'publications',
  publication: 'publications',
};

const BUCKET_TO_TYPE = {
  education: 'education',
  clients: 'clients',
  tools: 'tools',
  languages: 'languages',
  contact: 'contact',
  portfolio: 'contact',
};

function lineFitsLockedSection(line, section) {
  const l = String(line || '').trim();
  if (!l) return false;
  switch (section) {
    case 'experience':
      return passesExperienceGate(l);
    case 'education':
      return mustNeverBeExperience(l) || hasEducationSchool(l) || hasEducationDegree(l);
    case 'tools':
      return !!findLongestDictionaryTerm(l, TOOL_TERMS) || isLikelySkillLine(l);
    case 'skills':
      return isLikelySkillLine(l) && !findLongestDictionaryTerm(l, TOOL_TERMS);
    case 'clients':
      return (
        !!findLongestDictionaryTerm(l, CLIENT_TERMS) ||
        (l.includes(',') && l.split(/[,;]/).length >= 2 && l.length < 120)
      );
    case 'languages':
      return /\b(french|english|spanish|german|italian|arabic|mandarin|bilingual)\b/i.test(l);
    case 'projects':
      return isLikelyPortfolioProject(l);
    case 'interests':
      return l.length < 80 && (l.includes(',') || /\b(travel|sport|music|reading|cinema)\b/i.test(l));
    case 'contact':
      return /@|https?:\/\//i.test(l) || /\+\d/.test(l);
    case 'summary':
      return l.length > 40 && /\b(years?|experience|profile|passion)\b/i.test(l);
    case 'identity':
      return lineLooksLikeName(l) || lineLooksLikeTitle(l);
    default:
      return true;
  }
}

function fromDictionaryBoost(line) {
  const hit = classifyLineByDictionary(line);
  if (!hit) return null;
  const boosted = applyDictionaryBoostToClassification(hit);
  const type = BUCKET_TO_TYPE[boosted.bucket] || boosted.bucket;
  if (!type || type === 'unknown') return null;
  return {
    type,
    confidence: boosted.confidence,
    signals: boosted.signals || [`dict:${boosted.parserDebug?.matchedDictionary}`],
    needsReview: boosted.confidence < CLASSIFICATION_CONFIDENCE_THRESHOLD,
    parserDebug: boosted.parserDebug,
  };
}

/**
 * @param {string} line
 * @param {string|null} activeSection — from preceding section header
 * @param {object} [opts]
 * @param {boolean} [opts.creativeMode]
 * @returns {{ type: string, confidence: number, signals: string[], needsReview: boolean }}
 */
export function classifyLineType(line, activeSection = null, opts = {}) {
  const l = String(line || '').trim();
  const signals = [];
  const creativeMode = opts.creativeMode === true;

  if (!l || l.length < 2) {
    return { type: 'unknown', confidence: 0, signals: ['empty'], needsReview: true };
  }

  if (activeSection && LOCKED_SECTIONS.has(activeSection) && lineFitsLockedSection(l, activeSection)) {
    const type = SECTION_TO_TYPE[activeSection] || activeSection;
    return {
      type: type === 'portfolioLinks' || type === 'portfolio' ? 'contact' : type,
      confidence: 85,
      signals: [`locked_section:${activeSection}`],
      needsReview: false,
    };
  }

  if (creativeMode) {
    const creativeHit = classifyCreativeLine(l);
    if (creativeHit?.bucket && CREATIVE_BUCKET_TO_BLOCK_TYPE[creativeHit.bucket]) {
      const type = CREATIVE_BUCKET_TO_BLOCK_TYPE[creativeHit.bucket];
      return {
        type,
        confidence: creativeHit.confidence,
        signals: [...(creativeHit.signals || []), 'creative_mode'],
        needsReview: creativeHit.confidence < CLASSIFICATION_CONFIDENCE_THRESHOLD,
      };
    }
    if (isCreativeNonExperienceLine(l) && !isCreativeJobLine(l)) {
      return {
        type: 'unknown',
        confidence: 52,
        signals: ['creative_non_experience'],
        needsReview: true,
      };
    }
  }

  if (isSectionHeaderLine(l)) {
    const key = fuzzySectionKey(l) || 'header';
    const type = SECTION_TO_TYPE[key] || 'unknown';
    return { type, confidence: 92, signals: ['section_header'], needsReview: false };
  }

  if (isLikelyFreelanceCareerLine(l)) {
    return {
      type: 'experience',
      confidence: 90,
      signals: ['freelance_career_line'],
      needsReview: false,
    };
  }

  const eduWithContact = parseEducationLineWithContact(l);
  if (eduWithContact?.education) {
    return {
      type: 'education',
      confidence: 92,
      signals: ['education_with_contact_split'],
      needsReview: false,
    };
  }

  if (isCreativeSkillPhrase(l) && !isClientListLine(l)) {
    return {
      type: 'skills',
      confidence: 86,
      signals: ['creative_skill_phrase'],
      needsReview: false,
    };
  }

  const entityResolved = resolveLineEntities(l, {
    threshold: opts.entityThreshold ?? ENTITY_CLASSIFY_THRESHOLD,
    activeSection,
  });
  if (entityResolved?.shouldClassify && entityResolved.blockType !== 'unknown') {
    if (!(activeSection === 'experience' && entityResolved.blockType === 'clients')) {
      const primary = entityResolved.primary;
      return {
        type: entityResolved.blockType,
        confidence: entityResolved.confidence,
        signals: [...entityResolved.signals, 'entity_before_section'],
        needsReview: entityResolved.confidence < CLASSIFICATION_CONFIDENCE_THRESHOLD,
        entityMatch: primary,
        parserDebug: {
          classificationReason: `${primary?.entity || 'entity'}_entity_match`,
          matchedDictionary: primary?.dictionaryId || primary?.entity,
          matchedTerm: primary?.matched || primary?.term,
          matchedEntityId: primary?.entityId,
          dictionaryBoost: primary?.boost,
          confidenceScore: entityResolved.confidence,
          entityType: primary?.entity,
        },
      };
    }
  }

  const edu = scoreEducationConfidence(l);
  if (edu.unknown) {
    return {
      type: 'unknown',
      confidence: 0,
      signals: ['unknown_cycle'],
      needsReview: true,
    };
  }
  if (mustNeverBeExperience(l) || edu.forceEducation) {
    return {
      type: 'education',
      confidence: Math.max(88, edu.confidence),
      signals: ['education_guard', ...edu.signals],
      needsReview: false,
    };
  }

  if (hasEducationSchool(l) || (hasEducationDegree(l) && !passesExperienceGate(l))) {
    const schoolTerm = findLongestDictionaryTerm(l, SCHOOL_TERMS);
    const boost = schoolTerm ? DICTIONARY_BOOST.schools : 0;
    return {
      type: 'education',
      confidence: Math.max(88, edu.confidence, boost ? 68 + boost : 0),
      signals: [
        'education_line',
        ...(schoolTerm ? [`school:+${DICTIONARY_BOOST.schools}`, `term:${schoolTerm}`] : []),
        ...edu.signals,
      ],
      needsReview: false,
    };
  }

  const dictHit = fromDictionaryBoost(l);
  if (dictHit && dictHit.type !== 'experience') {
    return dictHit;
  }

  if (/@/.test(l) || /linkedin\.com/i.test(l) || /\+\d[\d\s().-]{7,}\d/.test(l)) {
    return { type: 'contact', confidence: 82, signals: ['contact_pattern'], needsReview: false };
  }

  if (/https?:\/\//i.test(l) || /\b(behance|dribbble|artstation)\./i.test(l)) {
    return { type: 'contact', confidence: 80, signals: ['portfolio_url→contact'], needsReview: false };
  }

  if (isClientListLine(l) && !passesExperienceGate(l) && !lineIsCreativeRoleHeadline(l)) {
    return {
      type: 'clients',
      confidence: 86,
      signals: ['client_list'],
      needsReview: false,
    };
  }

  if (isStrictSoftwareLine(l) && !lineIsCreativeRoleHeadline(l) && !passesExperienceGate(l)) {
    return {
      type: 'tools',
      confidence: 88,
      signals: ['strict_software_line'],
      needsReview: false,
    };
  }

  if (
    passesExperienceGate(l) &&
    !blocksExperienceClassification(l) &&
    !mustNeverBeExperience(l) &&
    !(creativeMode && isCreativeNonExperienceLine(l))
  ) {
    return {
      type: 'experience',
      confidence: 80,
      signals: ['experience_gate'],
      needsReview: false,
    };
  }

  if (isLikelySkillLine(l) && !isStrictSoftwareLine(l) && !findLongestEntityTerm(l, ENTITY_CATALOG.software)) {
    return {
      type: 'skills',
      confidence: 72,
      signals: ['skill_line'],
      needsReview: false,
    };
  }

  if (lineLooksLikeName(l) && !/@/.test(l)) {
    return { type: 'identity', confidence: 75, signals: ['name_line'], needsReview: false };
  }
  if (lineLooksLikeTitle(l) && l.length < 100) {
    return { type: 'identity', confidence: 70, signals: ['title_line'], needsReview: true };
  }

  return {
    type: 'unknown',
    confidence: 40,
    signals: ['unclassified'],
    needsReview: true,
  };
}
