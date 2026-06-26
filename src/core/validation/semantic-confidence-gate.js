/**
 * H14 — Semantic classification confidence gate.
 * Before finalResumeData: uncertain lines never auto-place in CV; they go to review.
 */

import {
  classifySemanticBlockV2,
  SEMANTIC_CLASS,
  semanticV2ToBucket,
  SEMANTIC_V2_CONFIDENCE_MIN,
} from '../parsing/semantic-classifier-v2.js';
import { buildRecruiterReviewItem } from '../parsing/recruiter-review-mode.js';
import { mergeReviewQueues } from '../parsing/review-queue-merge.js';
import { hasUrlOrDomainSignal } from '../parsing/ocr-classification-rules.js';

export const SEMANTIC_CONFIDENCE_GATE = 'SEMANTIC_CONFIDENCE_GATE_V1';
export const SEMANTIC_CONFIDENCE_GATE_MIN = SEMANTIC_V2_CONFIDENCE_MIN;

const IDENTITY_CONTACT_FIELDS = new Set(['email', 'phone', 'linkedin', 'website']);

const STRUCTURED_EXPERIENCE_RE =
  /\b(19|20)\d{2}\b.*\b(present|présent|current|now|aujourd'?hui|freelance|independent)\b/i;

const SKILL_LIKE_RE =
  /\b(design|illustration|branding|typography|packaging|direction|production|identity|logo|poster|motion|ui|ux|photoshop|illustrator|indesign|figma|creative|visual|art|print|editorial|campaign)\b/i;

const PROJECT_LIKE_RE =
  /\b(campaign|poster|packaging|rebrand|identity|illustration|visuals?|key\s*art|max|fifa|god\s+of\s+war|black\s+panther|playstation|marvel|visa|nike|adobe|spotify|airbnb)\b/i;

const TOOL_LIKE_RE =
  /\b(photoshop|illustrator|indesign|figma|premiere|after\s+effects|creative\s+suite|xd|sketch|blender|maya|lightroom)\b/i;

/** Allowed semantic buckets per resumeData placement key. */
const PLACED_TO_BUCKETS = Object.freeze({
  skills: ['skills'],
  tools: ['tools'],
  languages: ['languages'],
  clients: ['clients', 'experience'],
  education: ['education'],
  projects: ['projects'],
  summary: ['summary'],
  'identity.name': ['identity'],
  'identity.title': ['identity'],
  experiences: ['experience', 'clients'],
});

function norm(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

function effectiveConfidence(classification) {
  const raw = classification?.rawConfidence ?? classification?.confidence ?? 0;
  return Math.round(Number(raw) || 0);
}

/**
 * @param {string} placedKey
 * @param {ReturnType<classifySemanticBlockV2>} classification
 */
function placementMatchesClassification(placedKey, classification) {
  const semanticType = classification?.semanticType || SEMANTIC_CLASS.UNKNOWN;
  if (semanticType === SEMANTIC_CLASS.UNKNOWN) return false;
  const bucket = semanticV2ToBucket(semanticType);
  const allowed = PLACED_TO_BUCKETS[placedKey];
  if (!allowed) return true;
  if (bucket === 'contact' && placedKey.startsWith('identity.')) return true;
  return allowed.includes(bucket);
}

/**
 * @param {string} text
 * @param {string} placedKey
 * @param {ReturnType<classifySemanticBlockV2>} classification
 */
function gateReason(text, placedKey, classification) {
  const conf = effectiveConfidence(classification);
  const rawConf = Math.round(classification?.rawConfidence ?? classification?.confidence ?? 0);
  if (hasUrlOrDomainSignal(text) && !IDENTITY_CONTACT_FIELDS.has(placedKey.split('.')[1] || '')) {
    return 'URL/domain line must not auto-place in CV sections';
  }
  if ((classification?.alternatives?.length ?? 0) >= 2) {
    const alt = (classification.alternatives || [])
      .slice(0, 3)
      .map((a) => `${a.type} ${Math.round(a.confidence || 0)}%`)
      .join(' · ');
    return alt ? `Ambiguous placement — ${alt}` : `Confidence ${conf}% — below ${SEMANTIC_CONFIDENCE_GATE_MIN}%`;
  }
  if (rawConf < SEMANTIC_CONFIDENCE_GATE_MIN) {
    return `Confidence ${rawConf}% — below ${SEMANTIC_CONFIDENCE_GATE_MIN}% threshold`;
  }
  if (!placementMatchesClassification(placedKey, classification)) {
    return `Detected as ${classification.rawType || classification.semanticType} (${rawConf}%) — not valid for ${placedKey}`;
  }
  return classification?.reason || 'Requires recruiter validation';
}

/**
 * Precision gate — blocks ambiguous / mistyped / URL lines, not isolated UNKNOWN tokens.
 * @param {string} text
 * @param {string} placedKey
 * @param {ReturnType<classifySemanticBlockV2>} classification
 */
function shouldGatePlacement(text, placedKey, classification) {
  const identityField = placedKey.split('.')[1] || '';
  const rawType = classification?.rawType || classification?.semanticType || SEMANTIC_CLASS.UNKNOWN;
  const rawConf = Math.round(classification?.rawConfidence ?? classification?.confidence ?? 0);
  const alternatives = classification?.alternatives || [];

  if (placedKey === 'experiences' && STRUCTURED_EXPERIENCE_RE.test(text)) {
    return false;
  }
  if (placedKey === 'skills' && SKILL_LIKE_RE.test(text) && text.length <= 56) {
    return false;
  }
  if (placedKey === 'projects' && PROJECT_LIKE_RE.test(text) && text.length <= 120) {
    return false;
  }
  if (placedKey === 'tools' && TOOL_LIKE_RE.test(text) && text.length <= 48) {
    return false;
  }

  if (hasUrlOrDomainSignal(text) && !IDENTITY_CONTACT_FIELDS.has(identityField)) {
    return true;
  }
  if (alternatives.length >= 2) return true;
  if (rawType !== SEMANTIC_CLASS.UNKNOWN && !placementMatchesClassification(placedKey, classification)) {
    return true;
  }
  if (rawType !== SEMANTIC_CLASS.UNKNOWN && rawConf < SEMANTIC_CONFIDENCE_GATE_MIN) {
    return true;
  }
  return false;
}

/**
 * @param {string} text
 * @param {string} placedKey
 * @param {object} [ctx]
 */
export function assessSemanticPlacement(text, placedKey, ctx = {}) {
  const line = norm(text);
  if (!line || line.length < 2) {
    return { gate: false, line, classification: null };
  }

  const classification = classifySemanticBlockV2(line, ctx);
  const conf = effectiveConfidence(classification);
  const gate = shouldGatePlacement(line, placedKey, classification);

  return {
    gate,
    line,
    classification,
    confidence: conf,
    reason: gate ? gateReason(line, placedKey, classification) : null,
  };
}

/**
 * @param {string} text
 * @param {string} placedKey
 * @param {object} [ctx]
 */
function buildGateReviewItem(text, placedKey, ctx = {}) {
  const assessed = assessSemanticPlacement(text, placedKey, ctx);
  if (!assessed.gate || !assessed.line) return null;

  const item = buildRecruiterReviewItem({
    line: assessed.line,
    classification: {
      ...assessed.classification,
      needsReview: true,
      reason: assessed.reason,
    },
  });
  if (!item) return null;

  return {
    ...item,
    field: placedKey.includes('.') ? placedKey.split('.')[0] : placedKey,
    detectedType: item.detectedType || 'unknown',
    sourceText: assessed.line,
    confidence: assessed.confidence,
    reason: assessed.reason,
    semanticConfidenceGate: true,
    placedIn: placedKey,
  };
}

function pushUnsorted(list, line) {
  const t = norm(line);
  if (!t) return list;
  const k = t.toLowerCase();
  if (list.some((x) => norm(x).toLowerCase() === k)) return list;
  return [...list, t];
}

function gateStringList(items, placedKey, reviewItems, unsorted, ctx) {
  const kept = [];
  for (const raw of items || []) {
    const line = norm(raw);
    if (!line) continue;
    const assessed = assessSemanticPlacement(line, placedKey, ctx);
    if (assessed.gate) {
      const item = buildGateReviewItem(line, placedKey, ctx);
      if (item) reviewItems.push(item);
      unsorted = pushUnsorted(unsorted, line);
    } else {
      kept.push(line);
    }
  }
  return { kept, unsorted };
}

function gateExperienceEntry(exp, reviewItems, unsortedIn, ctx) {
  if (!exp || typeof exp !== 'object') return { entry: null, unsorted: unsortedIn };

  const out = { ...exp };
  let unsorted = unsortedIn;

  const composite = [out.role, out.company, out.dates].filter(Boolean).join(' — ');
  const hasStructuredAnchor = Boolean(out.role && out.company);
  if (composite) {
    const assessed = assessSemanticPlacement(composite, 'experiences', ctx);
    if (assessed.gate) {
      const item = buildGateReviewItem(composite, 'experiences', ctx);
      if (item) reviewItems.push(item);
      if (!hasStructuredAnchor) {
        unsorted = pushUnsorted(unsorted, composite);
        return { entry: null, unsorted };
      }
    }
  }

  const company = norm(out.company);
  if (company) {
    const companyAssessed = assessSemanticPlacement(company, 'experiences', ctx);
    if (companyAssessed.gate) {
      const item = buildGateReviewItem(company, 'experiences', ctx);
      if (item) reviewItems.push(item);
      unsorted = pushUnsorted(unsorted, company);
      delete out.company;
    }
  }

  const bullets = [];
  for (const raw of out.bullets || []) {
    const line = norm(raw);
    if (!line) continue;
    const assessed = assessSemanticPlacement(line, 'experiences', ctx);
    if (assessed.gate) {
      const item = buildGateReviewItem(line, 'experiences', ctx);
      if (item) reviewItems.push(item);
      unsorted = pushUnsorted(unsorted, line);
    } else {
      bullets.push(line);
    }
  }
  out.bullets = bullets;

  for (const field of ['description', 'rewrittenDescription']) {
    const val = norm(out[field]);
    if (!val) continue;
    const assessed = assessSemanticPlacement(val, 'experiences', ctx);
    if (assessed.gate) {
      const item = buildGateReviewItem(val, 'experiences', ctx);
      if (item) reviewItems.push(item);
      unsorted = pushUnsorted(unsorted, val);
      delete out[field];
    }
  }

  if (!out.role && !out.company && !out.bullets.length && !out.description && !out.rewrittenDescription) {
    return { entry: null, unsorted };
  }
  return { entry: out, unsorted };
}

function gateIdentity(identity, reviewItems, unsortedIn, ctx) {
  const out = { ...(identity || {}) };
  let unsorted = unsortedIn;
  const contactReview = Array.isArray(ctx?.contactReviewItems) ? ctx.contactReviewItems : [];
  for (const item of contactReview) {
    if (item) reviewItems.push(item);
  }
  const phone = norm(out.phone);
  if (phone) {
    const hasContactReview = contactReview.some((item) => item?.field === 'identity.phone');
    if (hasContactReview) {
      unsorted = pushUnsorted(unsorted, phone);
      delete out.phone;
    }
  }
  for (const field of ['name', 'title']) {
    const val = norm(out[field]);
    if (!val) continue;
    const assessed = assessSemanticPlacement(val, `identity.${field}`, ctx);
    if (assessed.gate) {
      const item = buildGateReviewItem(val, `identity.${field}`, ctx);
      if (item) reviewItems.push(item);
      unsorted = pushUnsorted(unsorted, val);
      delete out[field];
    }
  }
  return { identity: out, unsorted };
}

/**
 * Strip uncertain placements from resumeData; return review items for "À valider".
 * @param {object|null} resumeData
 * @param {{ existingReview?: object[] }} [opts]
 */
export function applySemanticConfidenceGate(resumeData, opts = {}) {
  if (!resumeData || typeof resumeData !== 'object') {
    return { resumeData, reviewItems: [], stats: { gated: 0, kept: 0 } };
  }

  const rd = { ...resumeData };
  /** @type {object[]} */
  const reviewItems = [];
  let unsorted = Array.isArray(rd.unsorted) ? [...rd.unsorted] : [];
  let gated = 0;

  const idResult = gateIdentity(rd.identity, reviewItems, unsorted, opts);
  rd.identity = idResult.identity;
  unsorted = idResult.unsorted;

  const summary = norm(rd.summary);
  if (summary) {
    const assessed = assessSemanticPlacement(summary, 'summary', opts);
    if (assessed.gate) {
      gated += 1;
      const item = buildGateReviewItem(summary, 'summary', opts);
      if (item) reviewItems.push(item);
      unsorted = pushUnsorted(unsorted, summary);
      rd.summary = '';
    }
  }

  const expOut = [];
  for (const exp of rd.experiences || []) {
    const before = reviewItems.length;
    const result = gateExperienceEntry(exp, reviewItems, unsorted, opts);
    gated += reviewItems.length - before;
    unsorted = result.unsorted;
    if (result.entry) expOut.push(result.entry);
  }
  rd.experiences = expOut;

  for (const [key, placedKey] of [
    ['education', 'education'],
    ['skills', 'skills'],
    ['tools', 'tools'],
    ['languages', 'languages'],
    ['clients', 'clients'],
    ['projects', 'projects'],
  ]) {
    const before = reviewItems.length;
    const result = gateStringList(rd[key], placedKey, reviewItems, unsorted, opts);
    gated += reviewItems.length - before;
    unsorted = result.unsorted;
    rd[key] = result.kept;
  }

  rd.unsorted = unsorted;

  const merged = mergeReviewQueues(opts.existingReview || [], reviewItems);

  const stats = {
    gated,
    reviewCount: merged.length,
    threshold: SEMANTIC_CONFIDENCE_GATE_MIN,
    engine: SEMANTIC_CONFIDENCE_GATE,
  };

  rd.meta = {
    ...(rd.meta || {}),
    semanticConfidenceGate: stats,
  };

  return { resumeData: rd, reviewItems: merged, stats };
}

/**
 * Audit final display — no pending-gate text in product sections.
 * @param {object} display
 * @param {object[]} reviewItems
 */
export function auditSemanticConfidenceGate(display, reviewItems = []) {
  const issues = [];
  const pendingTexts = new Set(
    (reviewItems || [])
      .filter((i) => i.status === 'pending')
      .map((i) => norm(i.sourceText || i.detected).toLowerCase())
      .filter(Boolean)
  );

  const checkList = (section, items) => {
    for (const raw of items || []) {
      const text = norm(raw);
      if (!text) continue;
      const assessed = assessSemanticPlacement(text, section);
      if (assessed.gate) {
        issues.push({ section, text, reason: assessed.reason, confidence: assessed.confidence });
      }
      if (pendingTexts.has(text.toLowerCase())) {
        issues.push({ section, text, reason: 'still_in_cv_while_pending_review' });
      }
    }
  };

  checkList('skills', display?.skills);
  checkList('education', display?.education);
  checkList('tools', display?.tools);
  checkList('clients', display?.clients);

  const name = norm(display?.identity?.name);
  if (name) {
    const a = assessSemanticPlacement(name, 'identity.name');
    if (a.gate) issues.push({ section: 'identity.name', text: name, reason: a.reason });
  }

  return { pass: issues.length === 0, issues, threshold: SEMANTIC_CONFIDENCE_GATE_MIN };
}
