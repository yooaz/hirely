/**
 * Experience Semantic Layer — split collapsed OCR experience blobs into
 * ROLE / COMPANY / DATES / SPECIALTIES / DESCRIPTION (never merge specialties into role).
 */

import { extractDateRangeFromText, titleCaseProfessional } from './parser-recovery.js';
import { normalizeExperienceRole } from './experience-parser.js';

export const EXPERIENCE_SEMANTIC_LAYER = 'EXPERIENCE_SEMANTIC_LAYER';

const SPECIALTY_RULES = [
  { pattern: /\bpackag(?:ing)?(?:\s*design(?:er)?)?\b/i, label: 'Packaging Design' },
  { pattern: /\bedition(?:al)?(?:\s*design)?\b/i, label: 'Editorial Design' },
  { pattern: /\blogo(?:s)?(?:\s*design)?\b/i, label: 'Logo Design' },
  { pattern: /\bposter(?:s)?(?:\s*design)?\b/i, label: 'Poster Design' },
  { pattern: /\bvisual\s+identity\b/i, label: 'Visual Identity' },
  { pattern: /\bbranding(?:\s*design)?\b/i, label: 'Branding' },
  { pattern: /\btypography\b/i, label: 'Typography' },
  { pattern: /\bui\s*design\b/i, label: 'UI Design' },
  { pattern: /\bux\s*design\b/i, label: 'UX Design' },
  { pattern: /\bweb\s*design\b/i, label: 'Web Design' },
  { pattern: /\bmotion\s*design\b/i, label: 'Motion Design' },
  { pattern: /\bprint(?:\s*(?:production|design))?\b/i, label: 'Print Design' },
  { pattern: /\bicon(?:\s*design)?\b/i, label: 'Icon Design' },
  { pattern: /\bphoto(?:graphy)?\b/i, label: 'Photography' },
  { pattern: /\bart\s+direction\b/i, label: 'Art Direction' },
  { pattern: /\bproduct\s+design\b/i, label: 'Product Design' },
  { pattern: /\bcopywriting\b/i, label: 'Copywriting' },
  { pattern: /\bsocial\s+media\b/i, label: 'Social Media' },
  { pattern: /\bdigital\s+marketing\b/i, label: 'Digital Marketing' },
  { pattern: /\bcontent\s+creation\b/i, label: 'Content Creation' },
  { pattern: /\bdata\s+analysis\b/i, label: 'Data Analysis' },
  { pattern: /\bsoftware\s+development\b/i, label: 'Software Development' },
  { pattern: /\bproject\s+management\b/i, label: 'Project Management' },
];

const ROLE_CORE_RE =
  /\b(freelanc\w*|illustrator|graphic\s+designer|art\s+director|motion\s+designer|creative\s+director|product\s+designer|web\s+designer|ux\s+designer|ui\s+designer|designer|software\s+engineer|product\s+manager|marketing\s+manager|business\s+analyst|consultant|developer|engineer|manager|analyst|intern(?:ship)?|stagiaire)\b/gi;

const FREELANCE_RE = /\b(freelanc\w*|independent|self[- ]?employed)\b/i;
const SPECIALTY_TOKEN_RE =
  /\b(packaging|edition(?:al)?|logos?|posters?|branding|typography|vector|print\b)\b/i;
const ACTION_VERB_RE =
  /\b(created|built|designed|managed|led|delivered|developed|implemented|launched|optimized|collaborated)\b/i;

function normSpace(s) {
  return String(s || '')
    .replace(/[,;·/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * @param {string} text
 * @returns {string[]}
 */
export function extractSpecialtiesFromText(text) {
  const specialties = [];
  const seen = new Set();
  const blob = normSpace(text);
  for (const rule of SPECIALTY_RULES) {
    if (rule.pattern.test(blob) && !seen.has(rule.label)) {
      seen.add(rule.label);
      specialties.push(rule.label);
    }
  }
  return specialties;
}

function stripMatchedSpecialties(text) {
  let s = normSpace(text);
  for (const rule of SPECIALTY_RULES) {
    s = s.replace(rule.pattern, ' ');
  }
  return normSpace(s);
}

function combineDualCreativeRole(roleCore) {
  const r = normSpace(roleCore);
  if (/\billustrator\b/i.test(r) && /\bgraphic\s+designer\b/i.test(r)) {
    return FREELANCE_RE.test(r)
      ? 'Freelance Illustrator / Graphic Designer'
      : 'Illustrator / Graphic Designer';
  }
  return r;
}

const SPECIALTY_NOUN_MAP = {
  'Poster Design': 'posters',
  'Packaging Design': 'packaging',
  'Logo Design': 'logos',
  'Editorial Design': 'editorial illustration',
  'Visual Identity': 'visual identity',
  'Illustration': 'illustration',
  'Typography': 'typography',
  'Icon Design': 'icon design',
  'Print Design': 'print design',
};

const PREFERRED_NOUN_ORDER = [
  'posters',
  'packaging',
  'logos',
  'editorial illustration',
  'visual identity',
  'illustration',
  'typography',
  'icon design',
  'print design',
];

function formatVisualSpecialtyBullet(specialties = []) {
  const nouns = [];
  const seen = new Set();
  for (const spec of specialties) {
    const noun = SPECIALTY_NOUN_MAP[spec];
    if (!noun || seen.has(noun)) continue;
    seen.add(noun);
    nouns.push(noun);
  }
  if (nouns.length < 2) return '';
  nouns.sort(
    (a, b) =>
      (PREFERRED_NOUN_ORDER.indexOf(a) === -1 ? 99 : PREFERRED_NOUN_ORDER.indexOf(a)) -
      (PREFERRED_NOUN_ORDER.indexOf(b) === -1 ? 99 : PREFERRED_NOUN_ORDER.indexOf(b))
  );
  const text = `${nouns.join(', ')}.`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function extractRoleCore(text) {
  const remainder = stripMatchedSpecialties(text);

  const matches = [...remainder.matchAll(ROLE_CORE_RE)];
  if (!matches.length) {
    return normalizeExperienceRole(remainder, remainder);
  }

  const parts = [];
  const seen = new Set();
  for (const m of matches) {
    const token = m[0].toLowerCase().replace(/\s+/g, ' ');
    if (seen.has(token)) continue;
    seen.add(token);
    parts.push(m[0]);
  }

  const rawRole = parts.join(' ');
  const combined = combineDualCreativeRole(rawRole);
  if (/\billustrator\b/i.test(combined) && /\bgraphic\s+designer\b/i.test(combined)) {
    const slashRole = FREELANCE_RE.test(combined)
      ? 'Freelance Illustrator / Graphic Designer'
      : 'Illustrator / Graphic Designer';
    return titleCaseProfessional(slashRole);
  }
  if (combined.includes('&') || combined.includes('/')) {
    return titleCaseProfessional(combined);
  }
  return normalizeExperienceRole(combined, remainder);
}

function inferCompany(role, company, text) {
  const c = normSpace(company);
  if (c && !SPECIALTY_TOKEN_RE.test(c) && c.length < 48) return c;
  if (FREELANCE_RE.test(`${role} ${text}`)) return 'Independent / Freelance';
  return c || '';
}

function buildSemanticDescription(specialties, exp) {
  const existing = String(exp.rewrittenDescription || exp.description || '').trim();
  const bullets = (exp.bullets || []).map((b) => String(b || '').trim()).filter(Boolean);
  const bulletText = bullets.join(' ');

  const substantiveBullet = bullets.find(
    (b) =>
      b.length >= 20 &&
      /\b(campaigns?|creative work|collaborat|deliver|directed|produced|managed|led)\b/i.test(b) &&
      !SPECIALTY_TOKEN_RE.test(b)
  );
  if (substantiveBullet) return substantiveBullet;

  const specialtyBullet = formatVisualSpecialtyBullet(specialties);
  if (specialtyBullet) return specialtyBullet;

  if (ACTION_VERB_RE.test(existing) && existing.length >= 24 && !SPECIALTY_TOKEN_RE.test(existing)) {
    return existing;
  }

  const visualSpecs = specialties.filter((s) =>
    /packaging|logo|editorial|poster|illustration|branding|visual|print|typography|icon/i.test(s)
  );
  const techSpecs = specialties.filter((s) =>
    /software|data|project|digital marketing|content|ui|ux|web/i.test(s)
  );

  if (visualSpecs.length >= 2 || (visualSpecs.length && FREELANCE_RE.test(exp.role || ''))) {
    return 'Created visual assets and illustrations for brands and publications.';
  }
  if (techSpecs.length >= 2) {
    return `Delivered initiatives across ${techSpecs.slice(0, 4).join(', ').toLowerCase()}.`;
  }
  if (visualSpecs.length === 1) {
    return `Created ${visualSpecs[0].toLowerCase()} deliverables for client and brand projects.`;
  }

  const nouny = bulletText || existing;
  if (nouny && SPECIALTY_TOKEN_RE.test(nouny)) {
    return 'Created visual assets and illustrations for brands and publications.';
  }

  return existing || '';
}

function isSpecialtyOnlyBullet(b) {
  const specs = extractSpecialtiesFromText(b);
  return specs.length > 0 && b.split(/\s+/).length <= 8 && !ACTION_VERB_RE.test(b);
}

/**
 * @param {object} exp
 * @returns {boolean}
 */
export function needsSemanticReconstruction(exp) {
  if (!exp || typeof exp !== 'object') return false;
  if (exp.semanticReconstruction) return false;
  const role = normSpace(exp.role);
  const company = normSpace(exp.company);
  const blob = normSpace(
    [
      role,
      company,
      ...(exp.bullets || []),
      exp.description,
      exp.rewrittenDescription,
      exp.originalDescription,
      ...(exp.sourceLines || []),
    ]
      .filter(Boolean)
      .join(' ')
  );
  if (!blob) return false;

  const specCount = extractSpecialtiesFromText(blob).length;
  if (!specCount) return false;

  if (SPECIALTY_TOKEN_RE.test(role)) return true;
  if (role.split(/\s+/).length > 8) return true;
  if (company && SPECIALTY_TOKEN_RE.test(company)) return true;

  const bulletsOnlyNouns =
    (exp.bullets || []).length > 0 &&
    (exp.bullets || []).every((b) => isSpecialtyOnlyBullet(String(b || '')));
  if (bulletsOnlyNouns) return true;

  return false;
}

/**
 * @param {object} exp
 * @returns {object}
 */
export function reconstructExperienceSemantics(exp) {
  const base = { ...(exp || {}) };
  if (!needsSemanticReconstruction(base)) return base;

  const blob = normSpace(
    [
      base.role,
      base.company,
      ...(base.bullets || []),
      base.description,
      base.rewrittenDescription,
      base.originalDescription,
      ...(base.sourceLines || []),
    ]
      .filter(Boolean)
      .join(' ')
  );

  const dr = extractDateRangeFromText(blob);
  const specialties = extractSpecialtiesFromText(blob);
  let role = extractRoleCore(blob);
  const company = inferCompany(role, base.company, blob);

  if (!role && FREELANCE_RE.test(blob)) role = 'Freelance Creative';

  const description = buildSemanticDescription(specialties, base);

  let bullets = (base.bullets || [])
    .map((b) => String(b || '').trim())
    .filter(Boolean)
    .filter((b) => !isSpecialtyOnlyBullet(b));

  if (!bullets.length && description) bullets = [description];

  const out = {
    ...base,
    role: role || base.role,
    company: company || base.company,
    dates:
      String(base.dates || '').trim() ||
      (dr.startDate ? `${dr.startDate}–${dr.endDate || 'Present'}` : ''),
    specialties,
    description,
    rewrittenDescription: description,
    bullets,
    semanticReconstruction: EXPERIENCE_SEMANTIC_LAYER,
  };

  if (dr.startDate && !out.startDate) out.startDate = dr.startDate;
  if (dr.endDate && !out.endDate) out.endDate = dr.endDate;

  return out;
}

/**
 * @param {object[]} experiences
 * @returns {object[]}
 */
export function reconstructAllExperienceSemantics(experiences = []) {
  return (experiences || []).map((e) => reconstructExperienceSemantics(e));
}
