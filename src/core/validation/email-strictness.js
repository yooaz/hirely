/**
 * P0 — Email strictness.
 * Never mutate email local-parts; ground display email in source text only.
 */

import { EMAIL_RE } from '../parsing/field-sanitize.js';
import { EMAIL_CONFIRM_LABEL } from '../display/identity-labels.js';
import { isUncertainIdentityEmail } from '../display/undetected-label.js';

export const EMAIL_STRICTNESS_V1 = 'EMAIL_STRICTNESS_V1';

/** Practical RFC 5322 subset for display acceptance. */
export const RFC_EMAIL_STRICT_RE =
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;

const EMAIL_SRC_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

/**
 * Remove OCR artifacts from email strings.
 * @param {string} raw
 */
export function sanitizeEmailOcrArtifacts(raw) {
  let s = String(raw || '').trim();
  if (!s) return '';
  s = s.replace(/\s+/g, '');
  s = s.replace(/@{2,}/g, '@');
  s = s.replace(/\.{2,}/g, '.');
  s = s.replace(/_{2,}/g, '_');
  s = s.replace(/-{2,}/g, '-');
  s = s.replace(/^[^a-z0-9._%+-]+/i, '');
  s = s.replace(/[^a-z0-9._%+-@]+$/i, '');
  s = s.replace(/,([a-z]{2,})$/i, '.$1');
  s = s.replace(/\.@/g, '@');
  s = s.replace(/@\.+/g, '@');
  return s.toLowerCase();
}

/**
 * @param {string} email
 */
export function validateEmailRfcStrict(email) {
  const s = sanitizeEmailOcrArtifacts(email);
  if (!s || !s.includes('@')) return false;
  if (s.includes('..')) return false;
  if (!RFC_EMAIL_STRICT_RE.test(s)) return false;
  const [local, domain] = s.split('@');
  if (!local || !domain || local.length > 64 || domain.length > 255) return false;
  if (domain.startsWith('.') || domain.endsWith('.')) return false;
  return true;
}

/**
 * @param {string} email
 */
export function splitEmailAddress(email) {
  const e = String(email || '').trim().replace(/\s+/g, '').toLowerCase();
  const at = e.indexOf('@');
  if (at < 1) return null;
  return { local: e.slice(0, at), domain: e.slice(at + 1), full: e };
}

/**
 * Extract emails verbatim from source (whitespace stripped, case lowered for compare).
 * @param {string} sourceText
 */
export function extractEmailsFromSource(sourceText) {
  const src = String(sourceText || '');
  const found = [];
  const seen = new Set();
  for (const m of src.matchAll(EMAIL_SRC_RE)) {
    const exact = String(m[0] || '');
    const normalized = exact.replace(/\s+/g, '').toLowerCase();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    found.push({
      exact,
      normalized,
      index: m.index ?? 0,
      sourceLine: lineContainingIndex(src, m.index ?? 0),
    });
  }

  const looseRe = /\b([A-Z0-9._%+-]+@[A-Z0-9._-]+)\s+([A-Z]{2,})\b/gi;
  for (const m of src.matchAll(looseRe)) {
    const normalized = `${m[1]}.${m[2]}`.replace(/\s+/g, '').toLowerCase();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    found.push({
      exact: m[0],
      normalized,
      index: m.index ?? 0,
      sourceLine: lineContainingIndex(src, m.index ?? 0),
    });
  }

  return found;
}

/**
 * @param {string} text
 * @param {number} index
 */
function lineContainingIndex(text, index) {
  const before = String(text || '').slice(0, Math.max(0, index));
  const lines = before.split(/\r?\n/);
  const line = lines[lines.length - 1] || '';
  const after = String(text || '').slice(index);
  const rest = (after.split(/\r?\n/)[0] || '').trim();
  return `${line}${rest}`.trim().slice(0, 400);
}

/**
 * True when parsed local-part adds characters on top of a source local-part (same domain).
 * @param {string} parsedLocal
 * @param {string} sourceLocal
 */
export function emailLocalPartAddsLetters(parsedLocal, sourceLocal) {
  const p = String(parsedLocal || '').toLowerCase();
  const s = String(sourceLocal || '').toLowerCase();
  if (!p || !s || p === s) return false;
  if (p.startsWith(s) && p.length > s.length) return true;
  return false;
}

/**
 * Obvious reversible OCR: same local-part, domain missing dot before TLD (`@host fr` → `@host.fr`).
 * @param {string} parsedEmail
 * @param {{ normalized: string, exact: string }} sourceEntry
 */
export function isObviousReversibleOcrEmailFix(parsedEmail, sourceEntry) {
  const parsed = splitEmailAddress(parsedEmail);
  const source = splitEmailAddress(sourceEntry?.normalized || sourceEntry?.exact || '');
  if (!parsed || !source) return false;
  if (parsed.local !== source.local) return false;
  if (parsed.domain === source.domain) return true;
  const hostTld = source.domain.match(/^(.+)\.([a-z]{2,})$/i);
  if (!hostTld) return false;
  const collapsed = `${hostTld[1]}${hostTld[2]}`.toLowerCase();
  return parsed.domain.replace(/\./g, '') === collapsed;
}

/**
 * @param {string} parsedEmail
 * @param {string} sourceText
 */
export function assessEmailStrictness(parsedEmail, sourceText) {
  const rawInput = String(parsedEmail || '').trim();
  const raw = rawInput && isUncertainIdentityEmail(rawInput) ? '' : sanitizeEmailOcrArtifacts(rawInput);
  const sourceBlob = String(sourceText || '').trim();
  const sourceEmails = extractEmailsFromSource(sourceBlob);

  if (!sourceBlob) {
    if (raw && validateEmailRfcStrict(raw)) {
      return {
        accept: true,
        display: raw,
        reviewRequired: false,
        reason: 'source_not_provided',
        confidence: 70,
        sourceLine: '',
        mutation: '',
      };
    }
    return {
      accept: false,
      display: '',
      reviewRequired: false,
      reason: 'empty',
      confidence: 0,
      sourceLine: '',
      mutation: '',
    };
  }

  if (!raw) {
    if (sourceEmails.length) {
      return {
        accept: true,
        display: sourceEmails[0].normalized,
        reviewRequired: false,
        reason: 'extracted_from_source',
        confidence: 95,
        sourceLine: sourceEmails[0].sourceLine,
        mutation: '',
      };
    }
    return {
      accept: false,
      display: '',
      reviewRequired: false,
      reason: 'empty',
      confidence: 0,
      sourceLine: '',
      mutation: '',
    };
  }

  const parsedNorm = raw;
  const parsedParts = splitEmailAddress(parsedNorm);

  if (!parsedParts || !validateEmailRfcStrict(parsedNorm)) {
    return {
      accept: false,
      display: '',
      reviewRequired: true,
      reason: 'invalid_format',
      confidence: 20,
      sourceLine: lineContainingIndex(sourceText, 0),
      mutation: parsedNorm,
    };
  }

  const exact = sourceEmails.find((s) => s.normalized === parsedNorm);
  if (exact) {
    return {
      accept: true,
      display: exact.normalized,
      reviewRequired: false,
      reason: 'exact_source_match',
      confidence: 98,
      sourceLine: exact.sourceLine,
      mutation: '',
    };
  }

  for (const source of sourceEmails) {
    if (isObviousReversibleOcrEmailFix(parsedNorm, source)) {
      return {
        accept: true,
        display: source.normalized,
        reviewRequired: false,
        reason: 'reversible_ocr_domain_fix',
        confidence: 92,
        sourceLine: source.sourceLine,
        mutation: '',
      };
    }
  }

  for (const source of sourceEmails) {
    const sourceParts = splitEmailAddress(source.normalized);
    if (!sourceParts || sourceParts.domain !== parsedParts.domain) continue;

    if (emailLocalPartAddsLetters(parsedParts.local, sourceParts.local)) {
      return {
        accept: true,
        display: source.normalized,
        reviewRequired: true,
        reason: 'local_part_mutation_recovered',
        confidence: 88,
        sourceLine: source.sourceLine,
        mutation: parsedNorm,
        recovered: source.normalized,
      };
    }
  }

  if (!sourceEmails.length) {
    return {
      accept: false,
      display: '',
      reviewRequired: true,
      reason: 'no_source_email',
      confidence: 35,
      sourceLine: raw.slice(0, 400),
      mutation: parsedNorm,
    };
  }

  const domainMatch = sourceEmails.find((s) => splitEmailAddress(s.normalized)?.domain === parsedParts.domain);
  if (domainMatch) {
    return {
      accept: false,
      display: '',
      reviewRequired: true,
      reason: 'local_part_not_in_source',
      confidence: 40,
      sourceLine: domainMatch.sourceLine,
      mutation: parsedNorm,
    };
  }

  return {
    accept: false,
    display: '',
    reviewRequired: true,
    reason: 'email_not_in_source',
    confidence: 30,
    sourceLine: sourceEmails[0]?.sourceLine || raw.slice(0, 400),
    mutation: parsedNorm,
  };
}

/**
 * @param {string} detected
 * @param {string} sourceText
 * @param {string} [reason]
 * @param {number} [confidence]
 */
export function buildEmailReviewItem(detected, sourceText, reason = '', confidence = 42) {
  const det = String(detected || '').trim();
  const src = String(sourceText || '').trim();
  if (!det && !src) return null;
  const slug = (det || src).slice(0, 24).replace(/\W/g, '') || 'unknown';
  return {
    id: `contact-email-${slug}`,
    field: 'identity.email',
    section: 'contact',
    sourceText: src.slice(0, 400) || det,
    detected: det || src,
    status: 'pending',
    confidence: Math.round(Number(confidence) || 42),
    category: 'contact',
    reason:
      reason ||
      'Email could not be verified against source text — confirm exact address',
  };
}

/**
 * Ground parsed email in source; never emit a mutated local-part.
 * @param {object} [identity]
 * @param {{ sourceText?: string, existingReviewItems?: object[] }} [opts]
 */
export function enforceEmailStrictness(identity = {}, opts = {}) {
  const id = { ...(identity || {}) };
  const reviewItems = [...(opts.existingReviewItems || [])];
  const sourceText = [
    opts.sourceText,
    opts.rawText,
    opts.cleanedText,
  ]
    .filter(Boolean)
    .join('\n');

  const rawEmail = String(id.email || '').trim();
  const assessment = assessEmailStrictness(rawEmail, sourceText);

  if (assessment.accept) {
    id.email = assessment.display;
    if (assessment.reviewRequired && assessment.mutation) {
      const item = buildEmailReviewItem(
        assessment.mutation,
        assessment.sourceLine || rawEmail,
        'Parsed email local-part was mutated — recovered exact address from source',
        assessment.confidence
      );
      if (item) reviewItems.push(item);
    }
  } else if (rawEmail) {
    const item = buildEmailReviewItem(
      assessment.mutation || rawEmail,
      assessment.sourceLine || rawEmail,
      assessment.reason === 'local_part_not_in_source'
        ? 'Email local-part not found in source — confirm exact address'
        : assessment.reason === 'no_source_email'
          ? 'No email found in source text — confirm address'
          : 'Uncertain OCR email — confirm exact address from document',
      assessment.confidence
    );
    if (item) reviewItems.push(item);
    id.email = '';
  } else {
    id.email = '';
  }

  return {
    identity: id,
    reviewItems,
    stripped: { email: rawEmail && !assessment.accept ? rawEmail : '' },
    assessment,
  };
}

export { EMAIL_CONFIRM_LABEL };
