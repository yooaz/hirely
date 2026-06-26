/**
 * PORTFOLIO_EXTRACTION_ENGINE — harvest creative portfolio / social URLs → resume.portfolioLinks[].
 */

import { normalizeUrl, validateLinkedIn, validatePortfolio, LINKEDIN_RE } from './rich-parser.js';
import { detectCreativeParsingMode } from './creative-parsing-mode.js';
import { hirelyDebugLog } from '../runtime/hirely-debug.js';

export const PORTFOLIO_EXTRACTION_ENGINE = 'PORTFOLIO_EXTRACTION_ENGINE';

/** P0 acceptance platforms. */
export const PORTFOLIO_ANCHOR_TARGETS = Object.freeze([
  'Behance',
  'Dribbble',
  'Portfolio',
  'Website',
  'Instagram',
  'ArtStation',
  'Foundation',
  'LinkedIn',
]);

export const PORTFOLIO_PLATFORMS = Object.freeze([
  { id: 'behance', label: 'Behance', hostRe: /behance\.net/i, labelRe: /\bbehance\b/i },
  { id: 'dribbble', label: 'Dribbble', hostRe: /dribbble\.com/i, labelRe: /\bdribbble\b/i },
  { id: 'instagram', label: 'Instagram', hostRe: /instagram\.com/i, labelRe: /\binstagram\b|\binsta\b/i },
  { id: 'artstation', label: 'ArtStation', hostRe: /artstation\.com/i, labelRe: /\bart\s*station\b/i },
  { id: 'foundation', label: 'Foundation', hostRe: /foundation\.app/i, labelRe: /\bfoundation\b/i },
  { id: 'linkedin', label: 'LinkedIn', hostRe: /linkedin\.com/i, labelRe: /\blinkedin\b/i },
  { id: 'website', label: 'Website', hostRe: null, labelRe: /\bwebsite\b/i },
  { id: 'portfolio', label: 'Portfolio', hostRe: null, labelRe: /\bportfolio\b/i },
]);

const SCHEMED_URL_RE = /https?:\/\/[^\s)·,;]+/gi;
const WWW_URL_RE = /www\.[^\s)·,;]+/gi;
const BARE_HOST_RE =
  /(?:behance\.net|dribbble\.com|instagram\.com|artstation\.com|foundation\.app|linkedin\.com\/in\/[\w%-]+)(?:\/[\w.@_%-]*)?/gi;

const LABELED_LINE_RE =
  /^(Portfolio|Website|Behance|Dribbble|Instagram|Art\s*Station|Foundation|LinkedIn)\s*[:·\-—]\s*(.+)$/i;

const CONTACT_SPLIT_RE = /\s*·\s*|\s*,\s*|\s+and\s+|\s+&\s+/i;

const EMAIL_IN_TOKEN_RE = /@[\w.-]+\.\w{2,}/;
const PHONE_IN_TOKEN_RE = /\+?\d[\d\s().-]{7,}/;

function normSpace(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

function urlDedupeKey(url) {
  const u = normalizeUrl(url).toLowerCase();
  if (!u) return '';
  try {
    const parsed = new URL(u);
    return `${parsed.hostname}${parsed.pathname}`.replace(/\/$/, '');
  } catch {
    return u.replace(/^https?:\/\//, '').replace(/\/$/, '');
  }
}

function isValidExtractedUrl(url) {
  const u = normSpace(url);
  if (!u || u.length < 8) return false;
  if (/ · /.test(u)) return false;
  if (/^https:\/\/[^/]*@/i.test(u)) return false;
  if (/^https:\/\/[a-z]+:/i.test(u)) return false;
  if (EMAIL_IN_TOKEN_RE.test(u) && !/^https?:\/\/(www\.)?(behance|dribbble|instagram|artstation|foundation|linkedin)/i.test(u)) {
    return false;
  }
  return validateLinkedIn(u) || validatePortfolio(u);
}

/**
 * @param {string} url
 * @param {string} [hintLabel]
 */
export function detectPlatformFromUrl(url, hintLabel = '') {
  const raw = normSpace(url);
  const hint = normSpace(hintLabel);
  if (hint) {
    const byHint = PORTFOLIO_PLATFORMS.find((p) => p.labelRe?.test(hint) || p.label.toLowerCase() === hint.toLowerCase());
    if (byHint) return byHint.label;
  }
  for (const p of PORTFOLIO_PLATFORMS) {
    if (p.hostRe?.test(raw)) return p.label;
  }
  if (LINKEDIN_RE.test(raw)) return 'LinkedIn';
  return hint || 'Portfolio';
}

/**
 * @param {string} label
 * @param {string} url
 */
export function formatPortfolioEntry(label, url) {
  const u = normalizeUrl(url);
  if (!isValidExtractedUrl(u)) return null;
  const platform = detectPlatformFromUrl(u, label);
  return `${platform} — ${u}`;
}

/**
 * @param {string} token
 * @returns {{ label: string, url: string } | null}
 */
export function parsePortfolioToken(token) {
  const t = normSpace(token);
  if (!t || t.length < 4) return null;
  if (EMAIL_IN_TOKEN_RE.test(t) && !/https?:\/\//i.test(t) && !/\.\w{2,}\//.test(t)) return null;
  if (PHONE_IN_TOKEN_RE.test(t) && !/https?:\/\//i.test(t) && !/\.\w{2,}/.test(t)) return null;

  const labeled = t.match(LABELED_LINE_RE);
  if (labeled) {
    const label = labeled[1].replace(/\s+/g, ' ').trim();
    const payload = normSpace(labeled[2]);
    if (!payload) return null;
    const url = payload.match(SCHEMED_URL_RE)?.[0] || payload.match(WWW_URL_RE)?.[0] || payload.match(BARE_HOST_RE)?.[0] || payload;
    return { label, url };
  }

  for (const p of PORTFOLIO_PLATFORMS) {
    if (p.labelRe?.test(t) && !p.hostRe?.test(t) && !SCHEMED_URL_RE.test(t) && !WWW_URL_RE.test(t)) {
      return null;
    }
  }

  const url =
    t.match(SCHEMED_URL_RE)?.[0] ||
    t.match(WWW_URL_RE)?.[0] ||
    t.match(BARE_HOST_RE)?.[0] ||
    null;
  if (!url) return null;
  return { label: detectPlatformFromUrl(url), url };
}

/**
 * @param {string} line
 * @returns {string[]}
 */
export function parsePortfolioLine(line) {
  const raw = normSpace(line);
  if (!raw) return [];

  const labeled = raw.match(LABELED_LINE_RE);
  if (labeled) {
    const entry = parsePortfolioToken(raw);
    if (!entry) return [];
    const formatted = formatPortfolioEntry(entry.label, entry.url);
    return formatted ? [formatted] : [];
  }

  const out = [];
  const seen = new Set();
  const parts = raw.split(CONTACT_SPLIT_RE).map(normSpace).filter(Boolean);
  for (const part of parts.length ? parts : [raw]) {
    const entry = parsePortfolioToken(part);
    if (!entry) continue;
    const formatted = formatPortfolioEntry(entry.label, entry.url);
    if (!formatted) continue;
    const key = urlDedupeKey(entry.url);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(formatted);
  }
  return out;
}

/**
 * @param {string} blob
 * @returns {string[]}
 */
export function detectPortfolioLinksFromText(blob) {
  const text = String(blob || '');
  if (!text.trim()) return [];

  const out = [];
  const seen = new Set();

  for (const line of text.split(/\n/)) {
    for (const entry of parsePortfolioLine(line)) {
      const url = entry.split(' — ').slice(1).join(' — ');
      const key = urlDedupeKey(url);
      if (!key || seen.has(key) || !isValidExtractedUrl(url)) continue;
      seen.add(key);
      out.push(entry);
    }
  }

  return out.slice(0, 24);
}

/**
 * @param {object} structured
 * @param {string} rawText
 */
export function harvestPortfolioSourceBlob(structured, rawText = '') {
  const chunks = [String(rawText || '').trim()];

  if (structured?.identity) {
    const id = structured.identity;
    if (id.linkedin) chunks.push(String(id.linkedin));
    if (id.website) chunks.push(String(id.website));
    if (id.portfolio) chunks.push(String(id.portfolio));
    if (id.email) chunks.push(String(id.email));
    if (id.phone) chunks.push(String(id.phone));
  }

  for (const key of ['summary', 'unsorted', 'portfolioLinks', 'projects']) {
    const val = structured?.[key];
    if (Array.isArray(val)) chunks.push(val.join('\n'));
    else if (val) chunks.push(String(val));
  }

  const headLines = String(rawText || '')
    .split(/\n/)
    .slice(0, 8)
    .join('\n');
  chunks.push(headLines);

  return chunks.filter(Boolean).join('\n');
}

function syncIdentityFromLinks(structured, links) {
  if (!structured.identity || typeof structured.identity !== 'object') {
    structured.identity = {};
  }
  const id = structured.identity;

  for (const entry of links) {
    const parts = String(entry || '').split(' — ');
    const url = normalizeUrl(parts.slice(1).join(' — ') || parts[0]);
    if (!url) continue;
    if (LINKEDIN_RE.test(url) && validateLinkedIn(url) && !id.linkedin) {
      id.linkedin = url;
    } else if (validatePortfolio(url) && !id.website && !LINKEDIN_RE.test(url)) {
      id.website = url;
    }
  }
}

/**
 * @param {object} structured
 * @param {string} [rawText]
 * @param {object} [opts]
 */
export function runPortfolioExtraction(structured, rawText = '', opts = {}) {
  if (!structured || typeof structured !== 'object') {
    return { structured, portfolioLinks: [], detected: [], stats: { skipped: true } };
  }

  const clean = String(rawText || structured?.metadata?.cleanedText || '').trim();
  const creativeMode = opts.creativeMode || detectCreativeParsingMode(clean, { force: opts.forceCreative });
  const hasSignals = /\b(behance|dribbble|artstation|instagram|foundation\.app|portfolio|website|linkedin\.com)\b/i.test(
    harvestPortfolioSourceBlob(structured, clean)
  );

  if (!creativeMode.active && !opts.force && !hasSignals) {
    return { structured, portfolioLinks: structured.portfolioLinks || [], detected: [], stats: { skipped: true } };
  }

  const blob = harvestPortfolioSourceBlob(structured, clean);
  const fromText = detectPortfolioLinksFromText(blob);

  const merged = [];
  const seen = new Set();

  const absorb = (entry) => {
    const s = normSpace(entry);
    if (!s) return;
    if (!s.includes(' — ')) {
      for (const parsed of parsePortfolioLine(s)) absorb(parsed);
      return;
    }
    const urlPart = s.split(' — ').slice(1).join(' — ');
    if (!isValidExtractedUrl(urlPart)) return;
    const key = urlDedupeKey(urlPart);
    if (!key || seen.has(key)) return;
    seen.add(key);
    merged.push(s);
  };

  for (const existing of structured.portfolioLinks || []) absorb(existing);
  for (const link of fromText) absorb(link);

  structured.portfolioLinks = merged.slice(0, opts.maxLinks || 24);
  syncIdentityFromLinks(structured, structured.portfolioLinks);

  const platformsFound = PORTFOLIO_ANCHOR_TARGETS.filter((label) =>
    structured.portfolioLinks.some((e) => new RegExp(`^${label}\\b`, 'i').test(e) || new RegExp(label, 'i').test(e))
  );

  const expectedInSource = PORTFOLIO_ANCHOR_TARGETS.filter((label) => {
    const p = PORTFOLIO_PLATFORMS.find((x) => x.label === label);
    if (p?.hostRe?.test(blob)) return true;
    if (p?.labelRe?.test(blob)) return true;
    return false;
  });

  const stats = {
    engine: PORTFOLIO_EXTRACTION_ENGINE,
    count: structured.portfolioLinks.length,
    detected: fromText.length,
    platformsFound,
    platformRecallPct: expectedInSource.length
      ? Math.round((platformsFound.filter((p) => expectedInSource.includes(p)).length / expectedInSource.length) * 100)
      : structured.portfolioLinks.length > 0
        ? 100
        : 0,
  };

  structured.metadata = {
    ...(structured.metadata || {}),
    portfolioExtraction: stats,
  };

  hirelyDebugLog('PORTFOLIO_EXTRACTION_ENGINE', stats);

  return { structured, portfolioLinks: structured.portfolioLinks, detected: fromText, stats };
}

/**
 * @param {string} rawText
 * @param {object} [structured]
 */
export function auditPortfolioExtraction(rawText, structured = null) {
  const clean = String(rawText || '').trim();
  const blob = structured ? harvestPortfolioSourceBlob(structured, clean) : clean;
  const detected = detectPortfolioLinksFromText(blob);

  const expected = PORTFOLIO_ANCHOR_TARGETS.filter((label) => {
    const p = PORTFOLIO_PLATFORMS.find((x) => x.label === label);
    if (p?.hostRe?.test(clean)) return true;
    if (p?.labelRe?.test(clean)) return true;
    return false;
  });

  const found = expected.filter((label) =>
    detected.some((d) => new RegExp(`^${label}\\b`, 'i').test(d) || new RegExp(label, 'i').test(d))
  );

  const recallPct = expected.length ? Math.round((found.length / expected.length) * 100) : detected.length > 0 ? 100 : 0;

  return {
    engine: PORTFOLIO_EXTRACTION_ENGINE,
    detected,
    expected,
    found,
    recallPct,
    count: detected.length,
  };
}
