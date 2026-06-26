/**
 * Fuzzy section header detection — OCR typos + multilingual labels.
 */

const OCR_HEADER_FIXES = [
  [/experlence|expérience|expériences/gi, 'experience'],
  [/skllls|skilis|skilis/gi, 'skills'],
  [/compétences|competences/gi, 'skills'],
  [/educatlon|educatíon/gi, 'education'],
  [/formations?/gi, 'education'],
  [/langues/gi, 'languages'],
  [/langue/gi, 'languages'],
  [/profil\b/gi, 'profile'],
  [/werkervaring/gi, 'experience'],
  [/opleiding/gi, 'education'],
  [/vaardigheden/gi, 'skills'],
  [/erfahrung/gi, 'experience'],
  [/ausbildung/gi, 'education'],
  [/kompetenzen/gi, 'skills'],
  [/sprachen/gi, 'languages'],
  [/experiencia/gi, 'experience'],
  [/formación/gi, 'education'],
  [/competencias/gi, 'skills'],
  [/idiomas/gi, 'languages'],
];

/** Normalized header token → canonical section key */
const SECTION_ALIASES = {
  summary: [
    'profile',
    'profil',
    'summary',
    'about',
    'about me',
    'objective',
    'personal statement',
    'über mich',
    'over mij',
    'perfil',
    'profilo',
  ],
  experience: [
    'experience',
    'work experience',
    'professional experience',
    'employment',
    'work history',
    'career',
    'parcours',
    'positions',
    'employment history',
  ],
  education: [
    'education',
    'formation',
    'studies',
    'academic',
    'academic background',
    'scholarship',
    'diploma',
    'qualifications',
  ],
  skills: [
    'skills',
    'technical skills',
    'competences',
    'competencies',
    'expertise',
    'core competencies',
    'key skills',
    'competences cles',
  ],
  tools: ['tools', 'software', 'technologies', 'tech stack', 'stack', 'technical tools', 'applications', 'outils', 'logiciels'],
  languages: ['languages', 'language skills', 'linguistic'],
  clients: ['clients', 'brands', 'selected clients', 'key clients', 'references', 'collaborations'],
  awards: ['awards', 'honors', 'honours', 'distinctions', 'prix', 'reconnaissances'],
  exhibitions: ['exhibitions', 'exhibition', 'shows', 'galleries', 'expositions'],
  publications: ['publications', 'publication', 'press', 'media', 'editorial coverage'],
  portfolioLinks: ['portfolio link', 'portfolio url', 'online portfolio', 'links', 'websites', 'portfolio'],
  achievements: ['achievements', 'accomplishments', 'highlights', 'key achievements'],
  projects: [
    'projects',
    'selected projects',
    'portfolio projects',
    'selected work',
    'portfolio',
    'personal work',
  ],
  interests: ['interests', 'hobbies', 'personal interests', 'centres d interet'],
  certifications: [
    'certifications',
    'certificates',
    'licenses',
    'licences',
    'credentials',
    'professional certifications',
    'certification',
  ],
  volunteer: [
    'volunteer',
    'volunteering',
    'volunteer experience',
    'community service',
    'civic engagement',
  ],
};

/** @readonly */
export const SECTION_DETECTION_V1 = 'HIRELY_SECTION_DETECTION_V1';

const CONFIDENCE = {
  exact: 96,
  prefix: 88,
  inline_exact: 94,
  inline_prefix: 90,
  contact: 92,
  location: 90,
};

export function normalizeHeaderText(line) {
  let t = String(line || '')
    .trim()
    .replace(/^[#*•]+\s*/, '')
    .replace(/[:：|#•]+\s*$/, '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ');
  for (const [re, rep] of OCR_HEADER_FIXES) {
    t = t.replace(re, rep);
  }
  return t.trim();
}

function matchAliasWithType(norm, aliases) {
  if (!norm || norm.length > 48) return null;
  for (const a of aliases) {
    if (norm === a) return { matchType: 'exact' };
    if (norm.length <= a.length + 6 && (norm.startsWith(`${a} `) || norm.endsWith(` ${a}`))) {
      return { matchType: 'prefix' };
    }
  }
  return null;
}

/**
 * Score a line as a section header (generic aliases + OCR-normalized text).
 * @returns {{ key: string, confidence: number, matchType: string, line: string }|null}
 */
export function scoreSectionHeader(line, opts = {}) {
  const raw = String(line || '').trim();
  if (!raw || raw.length < 2 || raw.length > 56) return null;

  const inline = !opts._inlineChecked && raw.match(/^([A-Za-zÀ-ÿ][\w\s&/'-]{1,40})\s*[:：]\s*(.+)$/);
  if (inline) {
    const inner = scoreSectionHeader(inline[1], { ...opts, _inlineChecked: true });
    if (!inner) return null;
    const inlineBoost = inner.matchType === 'exact' ? CONFIDENCE.inline_exact : CONFIDENCE.inline_prefix;
    return {
      ...inner,
      confidence: Math.max(inner.confidence, inlineBoost),
      matchType: `inline_${inner.matchType}`,
      line: raw,
    };
  }

  const norm = normalizeHeaderText(raw);
  if (!norm) return null;
  if (looksLikeSectionContentRow(norm)) return null;

  for (const [key, aliases] of Object.entries(SECTION_ALIASES)) {
    const hit = matchAliasWithType(norm, aliases);
    if (hit) {
      const confidence = hit.matchType === 'exact' ? CONFIDENCE.exact : CONFIDENCE.prefix;
      return { key, confidence, matchType: hit.matchType, line: raw };
    }
  }

  if (/^contact|coordonnées|kontakt|reach me/i.test(norm)) {
    return { key: 'contact', confidence: CONFIDENCE.contact, matchType: 'contact', line: raw };
  }
  if (/^location|localisation|address|based in/i.test(norm)) {
    return { key: 'location', confidence: CONFIDENCE.location, matchType: 'location', line: raw };
  }
  return null;
}

function looksLikeSectionContentRow(norm) {
  if (!norm) return true;
  if (/\b(19|20)\d{2}\b/.test(norm)) return true;
  if (/\s[—–-]\s/.test(norm) && norm.length > 22) return true;
  if (norm.length > 42) return true;
  return false;
}

/**
 * @returns {string|null} canonical section key
 */
export function fuzzySectionKey(line) {
  const scored = scoreSectionHeader(line);
  return scored?.key || null;
}

export function getSectionAliases() {
  return { ...SECTION_ALIASES };
}
