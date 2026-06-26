/**
 * P0 — Block parser section headers from leaking into CV body content.
 * Section words may appear as UI section titles only, never as list items or paragraphs.
 */

export const SECTION_LABEL_LEAKAGE_GUARD = 'SECTION_LABEL_LEAKAGE_GUARD_V2';

/** P0 acceptance — these strings must never appear as CV content lines. */
export const FORBIDDEN_CV_CONTENT_LABELS = Object.freeze([
  'clients',
  'client',
  'experiences',
  'experience',
  'education',
  'formation',
  'summary',
  'tools',
  'skills',
  'languages',
  'identity',
  'projects',
  'project',
]);

const FORBIDDEN_SECTION_CONTENT_LABELS = new Set([
  ...FORBIDDEN_CV_CONTENT_LABELS,
  'experiences',
  'experience',
  'expérience',
  'expériences',
  'experience professionnelle',
  'expérience professionnelle',
  'work experience',
  'professional experience',
  'employment',
  'clients',
  'client',
  'summary',
  'profile',
  'profil',
  'about',
  'tools',
  'tool',
  'outils',
  'skills',
  'skill',
  'compétences',
  'competences',
  'competencies',
  'education',
  'formation',
  'formations',
  'languages',
  'language',
  'langues',
  'langue',
  'projects',
  'project',
  'projets',
  'projet',
  'identité',
  'identite',
  'contact',
  'references',
  'portfolio',
  'awards',
  'exhibitions',
]);

/** OCR / parser metadata that must never render as CV content. */
const PARSER_METADATA_LABELS = new Set([
  'market reviews',
  'à classer',
  'a classer',
  'unsorted',
  'unknown',
  'parser review',
  'extraction review',
  'to classify',
  'à valider',
  'a valider',
]);

const PARSER_LABEL_HEADER_RE =
  /^(skills?|tools?|clients?|experiences?|experience|education|formation|languages?|langues?|projects?|projets?|identity|identité|summary|profile|profil|contact)\s*[:：]\s*$/i;

function normSpace(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

/**
 * Normalize a candidate line before label comparison.
 * @param {string} text
 */
export function normalizeSectionLabelCandidate(text) {
  return normSpace(text)
    .replace(/^[-•*#]+\s*/, '')
    .replace(/[:：|]+\s*$/, '')
    .replace(/\s*[-–—]\s*$/, '')
    .replace(/[.!]+$/g, '')
    .trim();
}

/**
 * @param {string} text
 * @returns {boolean}
 */
export function isParserMetadataLine(text) {
  const s = normalizeSectionLabelCandidate(text);
  if (!s) return false;
  const low = s.toLowerCase();
  if (PARSER_METADATA_LABELS.has(low)) return true;
  if (PARSER_LABEL_HEADER_RE.test(s)) return true;
  if (FORBIDDEN_SECTION_CONTENT_LABELS.has(low)) return true;
  return false;
}

/**
 * @param {string} text
 * @returns {boolean}
 */
export function isSectionLabelLeakage(text) {
  return isParserMetadataLine(text);
}

/**
 * @param {string} text
 * @returns {string}
 */
export function stripSectionLabelFromText(text) {
  const raw = normSpace(text);
  if (!raw) return '';
  if (isSectionLabelLeakage(raw)) return '';
  return raw;
}

function filterStringList(list = []) {
  const kept = [];
  const rejected = [];
  for (const item of list || []) {
    const cleaned = stripSectionLabelFromText(item);
    if (!cleaned) {
      if (normSpace(item)) rejected.push(normSpace(item));
      continue;
    }
    kept.push(cleaned);
  }
  return { kept, rejected };
}

export function sanitizeExperience(exp) {
  if (!exp || typeof exp !== 'object') return { exp: null, rejected: [] };
  const rejected = [];
  const out = { ...exp };

  for (const field of ['role', 'company', 'dates', 'location', 'description', 'rewrittenDescription']) {
    const raw = String(out[field] || '').trim();
    if (!raw) continue;
    const cleaned = stripSectionLabelFromText(raw);
    if (!cleaned) {
      rejected.push(raw);
      delete out[field];
    } else {
      out[field] = cleaned;
    }
  }

  const bullets = [];
  for (const bullet of out.bullets || []) {
    const cleaned = stripSectionLabelFromText(bullet);
    if (!cleaned) {
      if (normSpace(bullet)) rejected.push(normSpace(bullet));
      continue;
    }
    bullets.push(cleaned);
  }
  out.bullets = bullets;

  const hasContent =
    String(out.role || '').trim() ||
    String(out.company || '').trim() ||
    bullets.length ||
    String(out.description || '').trim();
  return { exp: hasContent ? out : null, rejected };
}

/**
 * @param {object} finalResumeData
 * @returns {{ violations: { section: string, text: string }[] }}
 */
export function auditSectionLabelLeakage(finalResumeData = {}) {
  const violations = [];
  const push = (section, text) => {
    const s = normSpace(text);
    if (s && isSectionLabelLeakage(s)) violations.push({ section, text: s });
  };

  push('summary', finalResumeData.summary);
  for (const field of ['education', 'skills', 'tools', 'languages', 'clients', 'projects', 'suggestions']) {
    for (const item of finalResumeData[field] || []) push(field, item);
  }
  for (const exp of finalResumeData.experiences || []) {
    push('experiences', exp?.role);
    push('experiences', exp?.company);
    push('experiences', exp?.dates);
    push('experiences', exp?.description);
    for (const bullet of exp?.bullets || []) push('experiences', bullet);
  }
  for (const field of ['name', 'title', 'location']) {
    push(`identity.${field}`, finalResumeData.identity?.[field]);
  }

  return { violations };
}

/**
 * Strip section-label leakage from finalResumeData before commit.
 * @param {object|null} finalResumeData
 * @returns {object|null}
 */
export function stripSectionLabelLeakage(finalResumeData) {
  if (!finalResumeData || typeof finalResumeData !== 'object') return finalResumeData;

  const out = { ...finalResumeData };
  const rejected = [];

  out.summary = stripSectionLabelFromText(out.summary);

  for (const field of ['education', 'skills', 'tools', 'languages', 'clients', 'projects', 'suggestions']) {
    const result = filterStringList(out[field]);
    out[field] = result.kept;
    rejected.push(...result.rejected);
  }

  const experiences = [];
  for (const exp of out.experiences || []) {
    const result = sanitizeExperience(exp);
    rejected.push(...result.rejected);
    if (result.exp) experiences.push(result.exp);
  }
  out.experiences = experiences;

  if (out.identity && typeof out.identity === 'object') {
    const identity = { ...out.identity };
    for (const field of ['name', 'title', 'location']) {
      if (!(field in identity)) continue;
      const cleaned = stripSectionLabelFromText(identity[field]);
      if (!cleaned && normSpace(identity[field])) rejected.push(normSpace(identity[field]));
      if (cleaned) identity[field] = cleaned;
      else delete identity[field];
    }
    out.identity = identity;
  }

  const rejectedUnique = [...new Set(rejected.map((x) => normSpace(x)).filter(Boolean))].slice(0, 32);
  out.metaSafe = {
    ...(out.metaSafe || {}),
    sectionLabelLeakageGuard: SECTION_LABEL_LEAKAGE_GUARD,
    sectionLabelLeakageRejected: rejectedUnique,
    debug: {
      ...(out.metaSafe?.debug || {}),
      sectionLabelLeakage: {
        guard: SECTION_LABEL_LEAKAGE_GUARD,
        rejected: rejectedUnique,
        at: new Date().toISOString(),
      },
    },
  };

  return out;
}

/**
 * Final P0 sanitizer — run immediately before finalResumeData commit.
 * Parser labels stay in metaSafe.debug only; never in preview/PDF content.
 * @param {object|null} finalResumeData
 * @returns {object|null}
 */
export function sanitizeFinalCvLabelsBeforeCommit(finalResumeData) {
  if (!finalResumeData || typeof finalResumeData !== 'object') return finalResumeData;

  let out = stripSectionLabelLeakage({ ...finalResumeData });
  let audit = auditSectionLabelLeakage(out);

  if (audit.violations.length) {
    for (const v of audit.violations) {
      if (v.section === 'summary') out.summary = '';
      else if (v.section.startsWith('identity.')) {
        const field = v.section.slice('identity.'.length);
        if (out.identity && field in out.identity) {
          const cleaned = stripSectionLabelFromText(out.identity[field]);
          if (cleaned) out.identity[field] = cleaned;
          else delete out.identity[field];
        }
      } else if (Array.isArray(out[v.section])) {
        out[v.section] = out[v.section].filter((item) => !isSectionLabelLeakage(item));
      } else if (v.section === 'experiences') {
        out.experiences = (out.experiences || [])
          .map((exp) => sanitizeExperience(exp).exp)
          .filter(Boolean);
      }
    }
    out = stripSectionLabelLeakage(out);
    audit = auditSectionLabelLeakage(out);
  }

  const rejected = [...(out.metaSafe?.sectionLabelLeakageRejected || [])];
  out.metaSafe = {
    ...(out.metaSafe || {}),
    sectionLabelLeakageGuard: SECTION_LABEL_LEAKAGE_GUARD,
    sectionLabelLeakageRejected: rejected,
    debug: {
      ...(out.metaSafe?.debug || {}),
      sectionLabelLeakage: {
        guard: SECTION_LABEL_LEAKAGE_GUARD,
        rejected,
        violationsAtCommit: audit.violations,
        committedAt: new Date().toISOString(),
      },
    },
  };

  return out;
}

/**
 * @param {object} frd
 * @returns {boolean}
 */
export function finalCvHasForbiddenLabelLines(frd = {}) {
  return auditSectionLabelLeakage(frd).violations.length > 0;
}

/**
 * Flat cvData sanitizer for template / PDF path.
 * @param {object} cvData
 */
export function stripSectionLabelLeakageFromCvData(cvData) {
  if (!cvData || typeof cvData !== 'object') return cvData;
  const out = { ...cvData };

  out.summary = stripSectionLabelFromText(out.summary);

  for (const field of ['education', 'skills', 'tools', 'languages', 'clients', 'projects']) {
    const result = filterStringList(out[field]);
    out[field] = result.kept;
  }

  if (Array.isArray(out.experience)) {
    const experience = [];
    for (const item of out.experience) {
      if (typeof item === 'string') {
        const cleaned = stripSectionLabelFromText(item);
        if (cleaned) experience.push(cleaned);
        continue;
      }
      if (item && typeof item === 'object') {
        const result = sanitizeExperience(item);
        if (result.exp) experience.push(result.exp);
      }
    }
    out.experience = experience;
  }

  return out;
}
