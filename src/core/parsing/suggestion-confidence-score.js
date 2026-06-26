/**
 * Suggestion noise engine — VALID | LOW_CONFIDENCE visible; GARBAGE never shown.
 * Does not alter OCR, parser, or ATS pipelines.
 */

import { ENTITY_REGISTRY } from '../../data/dictionaries/entity-catalog.js';
import { classifyLineByDictionary } from '../../data/dictionaries/json-dictionary-match.js';
import { OCR_JUNK_FRAGMENT_RE } from '../../data/dictionaries/garbagePatterns.js';
import {
  meetsReviewVisibilityThreshold,
  resolveDisplayCategory,
  reviewSuggestionConfidence,
} from './review-queue-quality-filter.js';

const MIN_OCR_CONFIDENCE = 0.65;
const MIN_DICTIONARY_WORDS = 2;
const MAX_VISIBLE = 2;

const GENERIC_REWRITE_RE = [
  /^created visual assets and illustrations/i,
  /^delivered (creative work|branding deliverables|work spanning)/i,
  /^created branding deliverables/i,
  /^designed and delivered creative work/i,
  /^served as .+ at .+/i,
  /initiatives across/i,
  /^delivered .+ initiatives\.?$/i,
  /^created .+ deliverables for client and brand projects/i,
];

const VAGUE_SUGGESTION_RE =
  /^(design|creative|work|visual|brand|illustration|graphic|profile|contact|skills?|tools?|languages?)$/i;

const SKILL_TOKEN_RE =
  /\b(illustration|graphic design|packaging|logo design|visual identity|editorial design|branding|typography|art direction)\b/i;

const GARBAGE_EXACT_RE = [
  /^v\d+\s*\d*\s*[a-z]$/i,
  /^v\d+\s+[a-z]$/i,
  /^lea$/i,
  /^ee\s*à?$/i,
  /^a\s+a\s+tn$/i,
  /^_—\s*pe$/i,
  /^rs\s+phone:?$/i,
  /^s\s+phone:?$/i,
  /^tt\s+lu$/i,
  /^es$/i,
  /^pe$/i,
  /^photograph:?$/i,
  /^contact$/i,
  /^education$/i,
  /^languages$/i,
  /^skills\s+interest$/i,
  /^profile\s+work\s+experience$/i,
  /^phone:?$/i,
  /^@+$/,
  /^@\d/i,
  /^b\s+wma$/i,
  /^v38\s+a$/i,
  /^wma$/i,
];

const GARBAGE_CONTAINS_RE = [
  /\bmustrator\b/i,
  /\bincesion\b/i,
  /\bscowboscc\b/i,
  /\bv3\s*2\s*gradric\b/i,
  /\bgradric\s+designer\b/i,
  /@\s*man\s+visual\s+communication/i,
  /^\[\d+\]\s/,
  /^ign\s+fin\s+hie/i,
  /^ic\)\s*/i,
  /^q\s+voaz\.tumblr/i,
];

const NOISE_TOKEN_RE =
  /\b(incision|wustrator|snoutors|illusthatch|gradric|mustrator)\b/i;

const VALID_ENTITY_TYPES = new Set([
  'school',
  'client',
  'software',
  'language',
  'role',
  'degree',
  'social',
]);

/** @typedef {'VALID'|'LOW_CONFIDENCE'|'GARBAGE'} SuggestionNoiseClass */

/**
 * @param {string} line
 */
function alphaTokens(line) {
  return String(line || '')
    .split(/[\s,;·|/()+{}]+/)
    .map((w) => w.replace(/^[^a-zàâäéèêëïîôùûüç0-9]+|[^a-zàâäéèêëïîôùûüç0-9'-]+$/gi, ''))
    .filter((t) => t.length >= 2);
}

/**
 * @param {string} line
 */
function countDictionaryWords(line) {
  const hits = ENTITY_REGISTRY.recognizeAll(line) || [];
  const unique = new Set(
    hits.map((h) => String(h.canonical || h.matched || '').trim().toLowerCase()).filter(Boolean)
  );
  return unique.size;
}

function entitySummary(line) {
  const hits = ENTITY_REGISTRY.recognizeAll(line) || [];
  const byType = {};
  for (const h of hits) {
    const t = h.type || h.bucket || 'unknown';
    if (!byType[t]) byType[t] = [];
    byType[t].push(h.canonical || h.matched || h.term);
  }
  return { hits, byType, count: hits.length };
}

function hasRealEntities(entities) {
  return (entities.hits || []).some((h) => VALID_ENTITY_TYPES.has(h.type || h.bucket));
}

function hasSubstantiveVocabulary(s) {
  const longWords = alphaTokens(s).filter((t) => t.length >= 5 && !/^\d+$/.test(t));
  return (
    longWords.length >= 2 ||
    /\b(visual|communication|illustrator|designer|typography|packaging|internship|university|school|bachelor|master)\b/i.test(
      s
    )
  );
}

/**
 * @param {string} line
 */
function isMostlyNumbers(line) {
  const s = String(line || '').trim();
  if (!s) return true;
  const compact = s.replace(/\s/g, '');
  if (!compact.length) return true;
  const digits = (compact.match(/\d/g) || []).length;
  return digits / compact.length > 0.55;
}

/**
 * @param {string} line
 */
function isMostlySymbols(line) {
  const s = String(line || '').trim();
  if (!s) return true;
  const letters = (s.match(/[a-zàâäéèêëïîôùûüç]/gi) || []).length;
  const digits = (s.match(/\d/g) || []).length;
  const core = letters + digits;
  if (core < 3) return true;
  const symbols = s.length - core - (s.match(/\s/g) || []).length;
  return symbols / s.length > 0.38;
}

/**
 * @param {string} line
 */
function hasIsolatedShortWord(line) {
  const tokens = alphaTokens(line);
  if (!tokens.length) return true;
  if (tokens.length === 1 && tokens[0].length < 4) return true;
  if (tokens.every((t) => t.length < 4)) return true;
  return false;
}

/**
 * @param {string} line
 */
function isLegacyKnownGarbage(line) {
  const s = String(line || '').trim();
  if (!s) return true;
  if (NOISE_TOKEN_RE.test(s)) return true;
  if (/^@.{0,24}(market|reviews?)/i.test(s)) return true;
  if (/^@\s*\d/i.test(s) && /market|reviews?/i.test(s)) return true;
  return false;
}

function isGarbageLine(line, scored) {
  const s = String(line || '').trim();
  if (!s || s.length < 2) return { yes: true, reason: 'empty_or_tiny' };
  if (GARBAGE_EXACT_RE.some((re) => re.test(s))) return { yes: true, reason: 'known_fragment' };
  if (isLegacyKnownGarbage(s)) return { yes: true, reason: 'known_garbage' };
  if (GARBAGE_CONTAINS_RE.some((re) => re.test(s))) {
    if (/\bgradric\b/i.test(s) && /\b(illustrator|designer)\b/i.test(s)) {
      return { yes: false, reason: '' };
    }
    return { yes: true, reason: 'ocr_corruption' };
  }
  if (OCR_JUNK_FRAGMENT_RE.some((re) => re.test(s))) return { yes: true, reason: 'junk_fragment' };
  if (scored.reasons.includes('known_garbage') && hasSubstantiveVocabulary(s)) {
    return { yes: false, reason: '' };
  }
  if (scored.reasons.includes('known_garbage')) return { yes: true, reason: 'noise_engine_garbage' };
  if (scored.reasons.includes('mostly_symbols')) return { yes: true, reason: 'mostly_symbols' };
  if (
    scored.reasons.includes('isolated_short_fragment') &&
    scored.dictionaryWords === 0 &&
    !hasRealEntities(entitySummary(s))
  ) {
    return { yes: true, reason: 'random_fragment' };
  }
  const toks = alphaTokens(s);
  if (toks.length <= 2 && toks.every((t) => t.length <= 3) && !hasRealEntities(entitySummary(s))) {
    return { yes: true, reason: 'short_noise_tokens' };
  }
  if (toks.length === 1 && toks[0].length <= 7 && !hasRealEntities(entitySummary(s))) {
    const allow = /^(french|english|drawing|music|nature|movies?|reading)$/i;
    if (!allow.test(toks[0])) return { yes: true, reason: 'single_word_fragment' };
  }
  return { yes: false, reason: '' };
}

function isValidLine(line, scored, entities) {
  const s = String(line || '').trim();
  const dict = classifyLineByDictionary(s);
  const longWords = alphaTokens(s).filter((t) => t.length >= 4 && !/^\d+$/.test(t));

  if (hasRealEntities(entities) && longWords.length >= 1 && scored.ocrConfidence >= 0.6) {
    return { yes: true, reason: 'real_entities' };
  }
  if (scored.dictionaryWords >= 2 && longWords.length >= 2 && scored.ocrConfidence >= 0.65) {
    return { yes: true, reason: 'dictionary_words' };
  }
  if (dict?.bucket && dict.bucket !== 'unsorted' && (dict.confidence || 0) >= 70) {
    return { yes: true, reason: `dictionary_${dict.bucket}` };
  }
  if (
    longWords.length >= 3 &&
    scored.ocrConfidence >= 0.65 &&
    !scored.reasons.includes('low_ocr_confidence')
  ) {
    return { yes: true, reason: 'rich_vocabulary' };
  }
  if (
    /\b(19|20)\d{2}\b/.test(s) &&
    longWords.length >= 2 &&
    (/\b(freelanc|internship|agency|illustrator|designer|university|school|bachelor|master)\b/i.test(s) ||
      hasRealEntities(entities))
  ) {
    return { yes: true, reason: 'dated_career_or_education' };
  }
  if (
    /^(french|english|drawing|music|nature|movies?|reading)$/i.test(s) ||
    /^(french|english):\s*(native|fluent)/i.test(s)
  ) {
    return { yes: true, reason: 'language_or_interest' };
  }
  if (hasRealEntities(entities) && entities.byType?.client?.length && longWords.length >= 1) {
    return { yes: true, reason: 'client_entities' };
  }
  if (
    /\b(packaging|typography|illustration|graphic design|web design|logos?|vector|print)\b/i.test(s) &&
    longWords.length >= 2
  ) {
    return { yes: true, reason: 'skill_phrase' };
  }
  return { yes: false, reason: '' };
}

/**
 * @param {string} line
 * @param {{ confidence?: number, corruptionScore?: number, action?: string }} [meta]
 */
function resolveOcrConfidence(line, meta = {}) {
  if (meta.corruptionScore != null && Number(meta.corruptionScore) >= 55) return 0.4;
  if (meta.action === 'corruption') return 0.42;
  if (meta.confidence != null && Number.isFinite(Number(meta.confidence))) {
    const c = Number(meta.confidence);
    return c > 1 ? c / 100 : c;
  }
  const s = String(line || '').trim();
  if (!s) return 0;
  if (isLegacyKnownGarbage(s) || GARBAGE_EXACT_RE.some((re) => re.test(s))) return 0.38;
  const dict = classifyLineByDictionary(s);
  if (dict?.confidence) return Math.min(0.98, dict.confidence / 100);
  const dictWords = countDictionaryWords(s);
  if (dictWords >= 2) return 0.78;
  const longWords = alphaTokens(s).filter((t) => t.length >= 5).length;
  if (longWords >= 2 && s.length >= 14) return 0.7;
  if (s.length >= 20 && /\b(19|20)\d{2}\b/.test(s)) return 0.68;
  if (s.length < 6) return 0.42;
  return 0.58;
}

/**
 * Three-tier noise classification for suggestions / unsorted audit.
 * @param {string} text
 * @param {{ confidence?: number, corruptionScore?: number, action?: string, category?: string }} [opts]
 */
export function classifySuggestionNoise(text, opts = {}) {
  const line = String(text || '').trim();
  const scored = buildSuggestionScore(line, opts);
  const entities = entitySummary(line);

  if (/^@\s*man\b/i.test(line) || /^visuel\s+identity$/i.test(line)) {
    return {
      classification: 'LOW_CONFIDENCE',
      reason: 'ocr_uncertain_fragment',
      show: true,
      ...scored,
      entities,
    };
  }

  const garbage = isGarbageLine(line, scored);
  if (garbage.yes) {
    return {
      classification: 'GARBAGE',
      reason: garbage.reason,
      show: false,
      ...scored,
      entities,
    };
  }

  const valid = isValidLine(line, scored, entities);
  if (valid.yes) {
    return {
      classification: 'VALID',
      reason: valid.reason,
      show: true,
      ...scored,
      entities,
    };
  }

  return {
    classification: 'LOW_CONFIDENCE',
    reason:
      scored.reasons.length > 0 ? scored.reasons.join(', ') : 'partial_ocr_or_unclassified',
    show: true,
    ...scored,
    entities,
  };
}

/**
 * @param {string} line
 * @param {{ confidence?: number, corruptionScore?: number, action?: string, category?: string }} [opts]
 */
function buildSuggestionScore(line, opts = {}) {
  const reasons = [];

  if (!line) reasons.push('empty');

  const dictionaryWords = countDictionaryWords(line);
  const meaningfulLongWords = alphaTokens(line).filter((t) => t.length >= 4 && !/^\d+$/.test(t))
    .length;
  const ocrConfidence = resolveOcrConfidence(line, opts);
  const dictHit = classifyLineByDictionary(line);

  if (
    dictionaryWords < MIN_DICTIONARY_WORDS &&
    meaningfulLongWords < MIN_DICTIONARY_WORDS &&
    !dictHit
  ) {
    reasons.push('few_dictionary_words');
  }
  if (isMostlyNumbers(line)) reasons.push('mostly_numbers');
  if (isMostlySymbols(line)) reasons.push('mostly_symbols');
  if (ocrConfidence < MIN_OCR_CONFIDENCE) reasons.push('low_ocr_confidence');
  if (hasIsolatedShortWord(line)) reasons.push('isolated_short_fragment');
  if (isLegacyKnownGarbage(line) || GARBAGE_EXACT_RE.some((re) => re.test(line))) {
    reasons.push('known_garbage');
  }

  let score = ocrConfidence;
  score += Math.min(0.22, dictionaryWords * 0.08);
  score += Math.min(0.12, meaningfulLongWords * 0.03);
  if (dictHit) score += 0.12;
  score = Math.max(0, Math.min(1, score));

  return {
    text: line,
    score: Math.round(score * 100),
    ocrConfidence,
    dictionaryWords,
    meaningfulLongWords,
    reasons,
  };
}

/**
 * @param {string} text
 * @param {{ confidence?: number, corruptionScore?: number, action?: string, category?: string }} [opts]
 */
export function suggestionConfidenceScore(text, opts = {}) {
  const noise = classifySuggestionNoise(text, opts);
  return {
    text: noise.text,
    score: noise.score,
    ocrConfidence: noise.ocrConfidence,
    dictionaryWords: noise.dictionaryWords,
    meaningfulLongWords: noise.meaningfulLongWords,
    show: noise.show,
    classification: noise.classification,
    noiseClass: noise.classification,
    reason: noise.reason,
    reasons: noise.reasons,
  };
}

function normalizeSuggestionKey(line) {
  return String(line || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function buildCvUsedIndex(resumeData = {}) {
  const exact = new Set();
  const phrases = [];
  const add = (value) => {
    const t = normalizeSuggestionKey(value);
    if (!t || t.length < 3) return;
    exact.add(t);
    if (t.length >= 8) phrases.push(t);
  };

  const id = resumeData?.identity || resumeData || {};
  add(id.name);
  add(id.title);
  add(id.email);
  add(id.phone);
  add(id.location);
  add(id.linkedin);
  add(id.portfolio);
  add(resumeData?.summary);

  for (const exp of resumeData?.experiences || resumeData?.experience || []) {
    const e = typeof exp === 'string' ? { role: exp } : exp || {};
    add(e.role);
    add(e.company);
    add(e.dates);
    add(e.location);
    add(e.description);
    add(e.originalDescription);
    add(e.rewrittenDescription);
    for (const b of e.bullets || []) add(b);
  }

  for (const edu of resumeData?.education || []) {
    if (edu && typeof edu === 'object') {
      add(edu.degree);
      add(edu.school);
      add(edu.field);
      add(edu.dates);
      add([edu.degree, edu.school].filter(Boolean).join(' — '));
    } else {
      add(edu);
    }
  }

  for (const list of [
    resumeData?.skills,
    resumeData?.tools,
    resumeData?.languages,
    resumeData?.clients,
    resumeData?.projects,
  ]) {
    for (const item of list || []) add(item);
  }

  return { exact, phrases };
}

function isDuplicateOfAcceptedCv(line, cvIndex) {
  const t = normalizeSuggestionKey(line);
  if (!t) return true;
  if (cvIndex.exact.has(t)) return true;
  for (const phrase of cvIndex.phrases) {
    if (phrase.length >= 8 && (t.includes(phrase) || phrase.includes(t))) return true;
  }
  return false;
}

function isSkillAlreadyInCv(line, resumeData = {}) {
  const s = normalizeSuggestionKey(line);
  if (!s || !SKILL_TOKEN_RE.test(s)) return false;
  const skills = (resumeData?.skills || []).map((x) => normalizeSuggestionKey(x));
  for (const skill of skills) {
    if (!skill) continue;
    if (s === skill || s.includes(skill) || skill.includes(s)) return true;
  }
  return false;
}

export function isGenericRewriteSuggestion(line) {
  const s = String(line || '').trim();
  if (!s) return true;
  return GENERIC_REWRITE_RE.some((re) => re.test(s));
}

export function isVagueSuggestionLine(line) {
  const s = String(line || '').trim();
  if (!s || s.length < 4) return true;
  if (VAGUE_SUGGESTION_RE.test(s)) return true;
  const words = alphaTokens(s);
  if (words.length <= 2 && words.every((w) => w.length <= 5)) return true;
  return false;
}

function isActionableUncertainty(item, cvIndex, resumeData) {
  const text = String(item.text || '').trim();
  if (!text) return false;
  if (item.classification !== 'LOW_CONFIDENCE') return false;
  if (isGenericRewriteSuggestion(text)) return false;
  if (isVagueSuggestionLine(text)) return false;
  if (cvIndex && isDuplicateOfAcceptedCv(text, cvIndex)) return false;
  if (resumeData && isSkillAlreadyInCv(text, resumeData)) return false;
  return true;
}

/**
 * @param {object[]} candidates
 * @param {{ maxVisible?: number, resumeData?: object }} [opts]
 */
export function filterProductSuggestions(candidates = [], opts = {}) {
  const maxVisible = opts.maxVisible ?? MAX_VISIBLE;
  const before = candidates.length;
  const cvIndex = opts.resumeData ? buildCvUsedIndex(opts.resumeData) : null;

  const scored = candidates.map((c) => {
    const meta = c.item || c;
    const noise = classifySuggestionNoise(c.text, {
      confidence: meta.confidence ?? c.confidence,
      corruptionScore: meta.corruptionScore,
      action: meta.action,
      category: c.category,
    });
    const merged = {
      ...c,
      confidence: noise.score,
      ocrConfidence: noise.ocrConfidence,
      dictionaryWords: noise.dictionaryWords,
      suggestionScore: noise,
      classification: noise.classification,
      noiseClass: noise.classification,
      noiseReason: noise.reason,
      show: noise.show,
    };
    merged.displayCategory = resolveDisplayCategory(merged, {
      category: c.category,
      predictedCategory: c.predictedCategory,
      confidence: reviewSuggestionConfidence(merged),
      needsReview: c.needsReview,
    });
    return merged;
  });

  const visible = scored.filter((s) => meetsReviewVisibilityThreshold(s));
  const lowConfidenceHidden = scored.filter((s) => !meetsReviewVisibilityThreshold(s));

  const qualified = visible.filter((s) =>
    isActionableUncertainty(s, cvIndex, opts.resumeData)
  );
  qualified.sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return String(b.text || '').length - String(a.text || '').length;
  });

  const items = qualified.slice(0, maxVisible);
  const demoted = qualified.slice(maxVisible);
  const archive = [
    ...lowConfidenceHidden.map((s) => ({
      ...s,
      archiveReason:
        reviewSuggestionConfidence(s) === 0 ? 'zero_confidence' : 'low_confidence',
    })),
    ...visible
      .filter((s) => !isActionableUncertainty(s, cvIndex, opts.resumeData))
      .map((s) => ({
        ...s,
        archiveReason:
          s.classification === 'GARBAGE'
            ? 'garbage'
            : s.classification === 'VALID'
              ? 'already_classifiable'
              : isGenericRewriteSuggestion(s.text)
                ? 'generic_rewrite'
                : isDuplicateOfAcceptedCv(s.text, cvIndex)
                  ? 'duplicate_cv'
                  : isSkillAlreadyInCv(s.text, opts.resumeData)
                    ? 'skill_in_cv'
                    : 'not_actionable',
      })),
    ...demoted.map((s) => ({ ...s, archiveReason: 'over_cap' })),
  ];

  const after = items.length;
  const hidden = before - after;

  return {
    items,
    archive,
    stats: {
      before,
      after,
      hidden,
      garbage: scored.filter((s) => s.classification === 'GARBAGE').length,
      valid: scored.filter((s) => s.classification === 'VALID').length,
      lowConfidence: scored.filter((s) => s.classification === 'LOW_CONFIDENCE').length,
      lowConfidenceHidden: lowConfidenceHidden.length,
      zeroConfidenceHidden: lowConfidenceHidden.filter(
        (s) => reviewSuggestionConfidence(s) === 0
      ).length,
    },
  };
}

/**
 * @param {{ before: number, after: number, hidden: number }} stats
 */
export function logSuggestionFilterStats(stats) {
  if (!stats || typeof console === 'undefined') return;
  console.log('SUGGESTION_FILTER', {
    before: stats.before,
    after: stats.after,
    hidden: stats.hidden,
  });
}

/** @deprecated Use classifySuggestionNoise */
export const classifyUnsortedNoise = classifySuggestionNoise;
