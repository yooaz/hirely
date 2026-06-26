/**
 * P0 — Contact detection from finalResumeData.identity only (normalized, no URL/social noise).
 */
import {
  normalizeContactPhone,
  stripContactLineNoise,
  validatePhoneStrict,
} from '../parsing/phone-normalize.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

/**
 * @param {string} raw
 */
export function extractIdentityEmail(raw) {
  const rawS = String(raw || '').trim();
  if (!rawS) return '';
  const direct = rawS.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  if (direct) return direct[0].trim().toLowerCase();
  const s = stripContactLineNoise(raw);
  if (!s) return '';
  const match = s.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  if (match) return match[0].trim().toLowerCase();
  return EMAIL_RE.test(s) ? s.trim().toLowerCase() : '';
}

/**
 * @param {string} raw
 */
export function extractIdentityPhone(raw) {
  const cleaned = stripContactLineNoise(raw);
  if (!cleaned) return '';
  const norm = normalizeContactPhone(cleaned);
  if (norm.phone && validatePhoneStrict(norm.phone)) return norm.phone;
  return '';
}

/**
 * Resolve email + phone from identity fields only (with cross-field recovery when one field holds a full contact line).
 * @param {object} [identity]
 */
export function resolveIdentityContact(identity = {}) {
  const id = identity && typeof identity === 'object' ? identity : {};
  const pool = [id.email, id.phone, id.location, id.linkedin, id.website, id.portfolio]
    .map((v) => String(v || '').trim())
    .filter(Boolean);

  let email = extractIdentityEmail(id.email);
  let phone = extractIdentityPhone(id.phone);

  if (!email) {
    for (const part of pool) {
      email = extractIdentityEmail(part);
      if (email) break;
    }
  }
  if (!phone) {
    for (const part of pool) {
      phone = extractIdentityPhone(part);
      if (phone) break;
    }
  }

  return {
    email,
    phone,
    hasEmail: !!email,
    hasPhone: !!phone,
  };
}

/**
 * @param {object} [identity]
 */
export function hasIdentityEmail(identity) {
  return resolveIdentityContact(identity).hasEmail;
}

/**
 * @param {object} [identity]
 */
export function hasIdentityPhone(identity) {
  return resolveIdentityContact(identity).hasPhone;
}
