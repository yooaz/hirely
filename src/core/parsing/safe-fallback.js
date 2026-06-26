/**
 * Safe fallback — uncertain career text → editable « À classer » bucket.
 * Never blocks preview or PDF export when experience is missing or low-confidence.
 */

import { mergeUnsortedLines } from './no-data-loss.js';
import { lineMayBeUnknownExperience } from './parser-enterprise.js';
import { P0_CONFIDENCE_THRESHOLD } from './p0-threshold.js';
import { isValidTitleField } from './field-sanitize.js';
import { passesExperienceGate } from './section-sanity.js';
import { lineLooksLikeRole } from '../../data/dictionaries/roleKeywords.js';
import { detectNameFromLines, isBadTitleCandidate } from './parser-recovery.js';
import { isBadName, isSectionHeaderLine, lineLooksLikeName, titleCaseName } from './rich-parser.js';
import { recordClassificationCorrection } from './classification-learning.js';

/** User-facing destinations from « À classer » (order matches UI). */
export const TO_CLASSIFY_TARGETS = [
  'profile',
  'experience',
  'education',
  'client',
  'project',
  'skill',
  'tool',
  'language',
  'interest',
  'ignore',
];

let _idSeq = 0;
function nextId() {
  _idSeq += 1;
  return `tc-${Date.now()}-${_idSeq}`;
}

/**
 * @param {string|{ id?: string, text?: string, source?: string, confidence?: number }} raw
 */
export function normalizeToClassifyItem(raw) {
  if (raw == null) return null;
  if (typeof raw === 'string') {
    const text = String(raw).trim();
    if (!text) return null;
    return { id: nextId(), text, source: 'import', confidence: 45 };
  }
  const text = String(raw.text || raw.detected || '').trim();
  if (!text) return null;
  return {
    id: String(raw.id || nextId()),
    text,
    source: String(raw.source || 'parser'),
    confidence: Math.round(Number(raw.confidence) || 45),
  };
}

/**
 * @param {Array<string|object>} list
 */
export function normalizeToClassifyList(list = []) {
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const item = normalizeToClassifyItem(raw);
    if (!item) continue;
    const key = item.text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out.slice(0, 48);
}

function isCareerLikeLine(text) {
  const t = String(text || '').trim();
  if (!t || t.length < 4) return false;
  if (lineMayBeUnknownExperience(t)) return true;
  return /\b(19|20)\d{2}\b/.test(t) && t.length < 220;
}

/** Useful text that should stay visible in « À classer », not dropped. */
function isUsefulUnclassifiedLine(text) {
  const t = String(text || '').trim();
  if (!t || t.length < 3 || t.length > 480) return false;
  if (/^[\s•·\-–—|,.;:]+$/.test(t)) return false;
  return true;
}

const RESCUE_EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const RESCUE_PHONE_RE = /(?:\+?\d[\d\s().-]{7,}\d)/;
const RESCUE_URL_RE = /https?:\/\/|www\.|linkedin\.com/i;

function isRescueSectionHeader(line) {
  return /^(experience|expériences?|education|formation|skills?|compétences?|tools?|outils|languages?|langues|profile|profil|summary|résumé|contact|clients?|projects?|projets)\s*:?\s*$/i.test(
    String(line || '').trim()
  );
}

function accountedBlob(d) {
  const parts = [
    d.name,
    d.title,
    d.summary,
    d.email,
    d.phone,
    d.location,
    d.linkedin,
    d.portfolio,
    ...pullStrings(d.experience),
    ...pullStrings(d.education),
    ...pullStrings(d.skills),
    ...pullStrings(d.tools),
    ...pullStrings(d.languages),
    ...pullStrings(d.clients),
    ...pullStrings(d.projects),
    ...pullStrings(d.unsorted),
    ...normalizeToClassifyList(d.toClassify).map((i) => i.text),
  ];
  return new Set(
    parts
      .map((x) => String(x || '').trim().toLowerCase())
      .filter(Boolean)
  );
}

/**
 * Rescue mode — name/title/contact + all remaining lines → « À classer » (never blank CV).
 * @param {object} cvData
 * @param {object} [opts]
 */
export function applyRescueMode(cvData = {}, opts = {}) {
  const d = { ...(cvData || {}) };
  const hay = String(opts.cleanedText || opts.rawText || '').trim();
  if (!hay) return d;

  if (!d.email) {
    const em = hay.match(RESCUE_EMAIL_RE);
    if (em) d.email = em[0];
  }
  if (!d.phone) {
    const ph = hay.match(RESCUE_PHONE_RE);
    if (ph) d.phone = ph[0].trim();
  }
  if (!d.linkedin && /linkedin\.com/i.test(hay)) {
    const m = hay.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/[^\s|·]+/i);
    if (m) d.linkedin = m[0];
  }

  const lines = hay
    .split('\n')
    .map((l) => l.replace(/^[\s•\-–—*]+/, '').trim())
    .filter((l) => isUsefulUnclassifiedLine(l));

  const seen = accountedBlob(d);
  const rescueItems = [];
  for (const line of lines) {
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    if (isRescueSectionHeader(line)) continue;
    seen.add(key);
    rescueItems.push({ id: nextId(), text: line, source: 'rescue', confidence: 40 });
  }

  if (rescueItems.length) {
    d.toClassify = normalizeToClassifyList([...normalizeToClassifyList(d.toClassify), ...rescueItems]);
  }

  d._rescueMode = { active: true, lines: rescueItems.length, at: new Date().toISOString() };
  return d;
}

function experienceLineUncertain(text) {
  const t = String(text || '').trim();
  if (!t) return true;
  if (!passesExperienceGate(t)) return true;
  if (!/\b(19|20)\d{2}\b/.test(t) && t.length < 72) return true;
  return false;
}

export function normalizeClassifiedIgnore(cvData = {}) {
  return [
    ...new Set(
      (cvData.classifiedIgnore || []).map((x) => String(x || '').toLowerCase().trim()).filter(Boolean)
    ),
  ];
}

function userPlacedSet(cvData = {}, field) {
  const bucket = cvData._userPlaced?.[field];
  return new Set((bucket || []).map((x) => String(x || '').toLowerCase().trim()).filter(Boolean));
}

function rememberUserPlaced(d, field, text) {
  const key = String(text || '').toLowerCase().trim();
  if (!key || !field) return;
  d._userPlaced = { ...(d._userPlaced || {}) };
  const prev = d._userPlaced[field] || [];
  if (!prev.includes(key)) d._userPlaced[field] = [...prev, key];
}

function pullStrings(arr) {
  return (arr || [])
    .map((x) => (typeof x === 'string' ? x : x?.text || x?.detected || ''))
    .map((t) => String(t).trim())
    .filter(Boolean);
}

/**
 * Collect uncertain career lines into toClassify (deduped).
 * @param {object} cvData
 * @param {object} [opts]
 */
export function buildToClassifyFromCv(cvData = {}, opts = {}) {
  const items = [];
  const seen = new Set();
  const ignored = new Set(normalizeClassifiedIgnore(cvData));
  const userExp = userPlacedSet(cvData, 'experience');

  const pushText = (text, source, confidence = 45) => {
    const t = String(text || '').trim();
    if (!t || seen.has(t.toLowerCase()) || ignored.has(t.toLowerCase()) || userExp.has(t.toLowerCase()))
      return;
    if (!isUsefulUnclassifiedLine(t)) return;
    const broadSource =
      source === 'unsorted_useful' ||
      source === 'unsorted' ||
      source === 'review' ||
      source === 'low_conf_bucket' ||
      source === 'unknownExperience' ||
      source === 'experience_uncertain' ||
      isCareerLikeLine(t);
    if (!broadSource) return;
    seen.add(t.toLowerCase());
    items.push({ id: nextId(), text: t, source, confidence });
  };

  for (const t of pullStrings(cvData.unknownExperience)) {
    pushText(t, 'unknownExperience', 50);
  }

  const exp = pullStrings(cvData.experience);
  const expConf = Number(cvData.sectionConfidence?.experience);
  const lowConfExp =
    opts.lowConfidenceExperience === true ||
    !exp.length ||
    (Number.isFinite(expConf) && expConf < P0_CONFIDENCE_THRESHOLD);

  for (const t of exp) {
    if (lowConfExp || experienceLineUncertain(t)) {
      pushText(t, 'experience_uncertain', 52);
    }
  }

  const sweepBuckets = [
    ['skills', 'skill', 48],
    ['tools', 'tool', 48],
    ['education', 'education', 46],
    ['clients', 'client', 46],
    ['projects', 'project', 46],
    ['languages', 'language', 46],
  ];
  for (const [field, source, conf] of sweepBuckets) {
    const secConf = Number(cvData.sectionConfidence?.[field]);
    if (Number.isFinite(secConf) && secConf >= P0_CONFIDENCE_THRESHOLD) continue;
    for (const t of pullStrings(cvData[field])) {
      pushText(t, 'low_conf_bucket', conf);
    }
  }

  for (const line of pullStrings(cvData.unsorted)) {
    pushText(line, 'unsorted_useful', 42);
  }

  for (const item of opts.reviewQueue || cvData.reviewQueue || cvData.needsReview || []) {
    if (item?.status && item.status !== 'pending') continue;
    pushText(item.sourceText || item.detected || item.line, 'review', Number(item.confidence) || 40);
  }

  return normalizeToClassifyList([...normalizeToClassifyList(cvData.toClassify), ...items]);
}

/**
 * Apply safe fallback — always keeps CV exportable; surfaces « À classer » instead of silent loss.
 * @param {object} cvData
 * @param {object} [opts]
 */
export function applySafeFallback(cvData = {}, opts = {}) {
  let d = { ...(cvData || {}) };
  const hasStructuredExp = pullStrings(d.experience).length > 0;
  const expConfidence = Number(d.sectionConfidence?.experience);
  const lowConfExp =
    opts.lowConfidenceExperience === true ||
    (!hasStructuredExp && pullStrings(d.unknownExperience).length > 0) ||
    (Number.isFinite(expConfidence) && expConfidence < P0_CONFIDENCE_THRESHOLD);

  let toClassify = buildToClassifyFromCv(d, {
    ...opts,
    lowConfidenceExperience: lowConfExp,
  });

  const tcTexts = new Set(toClassify.map((i) => i.text.toLowerCase()));
  if (tcTexts.size) {
    d.experience = pullStrings(d.experience).filter((t) => !tcTexts.has(t.toLowerCase()));
    if (lowConfExp && !pullStrings(d.experience).length) {
      d.experience = [];
    }
  }

  d.toClassify = toClassify;
  d = applyRescueMode(d, opts);
  toClassify = normalizeToClassifyList(d.toClassify);
  d.toClassify = toClassify;
  d._experienceFallback = !hasStructuredExp && toClassify.length > 0;
  d._safeFallback = {
    active: toClassify.length > 0,
    experienceUncertain: lowConfExp,
    itemCount: toClassify.length,
    at: new Date().toISOString(),
  };

  if (toClassify.length) {
    const moved = toClassify.map((i) => i.text);
    const drop = new Set(moved.map((t) => t.toLowerCase()));
    d.unknownExperience = pullStrings(d.unknownExperience).filter(
      (t) => !drop.has(t.toLowerCase())
    );
    d.unsorted = pullStrings(d.unsorted).filter((t) => !drop.has(t.toLowerCase()));
  }

  return ensureExportableCv(d, opts);
}

/**
 * Guarantee minimum renderable CV (preview + PDF never blocked).
 * @param {object} cvData
 * @param {object} [opts]
 */
export function ensureExportableCv(cvData = {}, opts = {}) {
  let d = { ...(cvData || {}) };
  d.toClassify = normalizeToClassifyList(d.toClassify);
  d.unknownExperience = pullStrings(d.unknownExperience);
  d.unsorted = pullStrings(d.unsorted);

  const hasBody =
    d.name ||
    d.title ||
    d.email ||
    d.phone ||
    (d.summary && d.summary.length > 5) ||
    pullStrings(d.experience).length ||
    pullStrings(d.education).length ||
    pullStrings(d.skills).length ||
    pullStrings(d.tools).length ||
    d.toClassify.length ||
    pullStrings(d.unsorted).length;

  if (hasBody) {
    d._exportBlocked = false;
    return d;
  }

  d = applyRescueMode(d, opts);
  const raw = String(opts.cleanedText || opts.rawText || '').trim();
  if (raw.length >= 20 && !normalizeToClassifyList(d.toClassify).length) {
    const first = raw.split('\n').map((l) => l.trim()).find((l) => l.length > 2) || '';
    if (first && !d.name) d.name = first.slice(0, 80);
    d.toClassify = normalizeToClassifyList(
      raw
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => isUsefulUnclassifiedLine(l))
        .slice(0, 48)
        .map((text) => ({ id: nextId(), text, source: 'exportable_fallback', confidence: 35 }))
    );
  }

  d._exportBlocked = false;
  return d;
}

const TARGET_FIELD = {
  profile: 'summary',
  profil: 'summary',
  summary: 'summary',
  experience: 'experience',
  education: 'education',
  project: 'projects',
  projects: 'projects',
  client: 'clients',
  clients: 'clients',
  skill: 'skills',
  skills: 'skills',
  tool: 'tools',
  tools: 'tools',
  language: 'languages',
  languages: 'languages',
  interest: 'interests',
  interests: 'interests',
  ignore: null,
};

/**
 * User classification from « À classer ».
 * @param {object} cvData
 * @param {string} itemId
 * @param {string} target — profile | experience | education | client | project | skill | tool | language | ignore
 */
export function applyClassifyTarget(cvData = {}, itemId, target) {
  const d = { ...(cvData || {}) };
  const key = String(target || '').toLowerCase();
  if (!TO_CLASSIFY_TARGETS.includes(key)) return d;

  d.toClassify = normalizeToClassifyList(d.toClassify);
  const idx = d.toClassify.findIndex((i) => i.id === itemId);
  if (idx < 0) return d;

  const [item] = d.toClassify.splice(idx, 1);
  const text = String(item.text || '').trim();
  if (!text) return applySafeFallback(d);

  if (key === 'ignore') {
    const ignore = normalizeClassifiedIgnore(d);
    if (!ignore.includes(text.toLowerCase())) {
      d.classifiedIgnore = [...ignore, text.toLowerCase()];
    }
    d.unsorted = mergeUnsortedLines(d.unsorted, [text]);
    return applySafeFallback(d);
  }

  const field = TARGET_FIELD[key];
  if (field === 'summary') {
    const prev = String(d.summary || '').trim();
    d.summary = prev ? `${prev}\n${text}` : text;
  } else if (field) {
    if (!Array.isArray(d[field])) d[field] = [];
    d[field] = [...d[field], text];
    rememberUserPlaced(d, field, text);
    recordClassificationCorrection({
      value: text,
      chosenType: key === 'profile' ? 'summary' : key,
      sourceLine: text,
    });
  }

  d._experienceFallback = !pullStrings(d.experience).length && d.toClassify.length > 0;
  return applySafeFallback(d);
}

export function cvDataHasToClassify(cvData) {
  return normalizeToClassifyList(cvData?.toClassify).length > 0;
}
