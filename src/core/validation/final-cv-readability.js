/**
 * FINAL_CV_READABILITY — last human-readable polish on locked finalResumeData.
 * No OCR. No parser. Display contract only.
 */

import { applyHeaderCleaner } from '../parsing/header-cleaner.js';
import {
  extractCleanClientBrands,
  normalizeFreelanceExperienceRole,
} from '../parsing/resume-output-quality.js';
import { sanitizeLanguageLine } from './ocr-micro-garbage-cleanup.js';
import { normalizeAllEducation, normalizeEducationEntry } from '../parsing/education-normalization-layer.js';
import { dedupeEducationStrings, dedupeStringList } from '../parsing/dedupe-engine.js';
import { scoreEducationLine } from './confidence-gate.js';
import { isCorruptEducationLine } from '../parsing/education-confidence.js';
import {
  INVENTED_EXPERIENCE_BULLET_RE,
  stripInventedExperiences,
} from '../parsing/invented-experience-guard.js';

export const FINAL_CV_READABILITY = 'FINAL_CV_READABILITY_V1';

const OCR_CORRUPT_RE =
  /\b(incision|wustrator|snoutors|illusthatch|gradric|mustrator|graphic designer\s*\d+\s*illustrator|v3\s*2|m[eE]\]|^\[\d+\])\b/i;

const DUPLICATE_DATE_RE =
  /(\b(?:19|20)\d{2}\s*[-–—]\s*(?:present|présent|current|\d{4}))\s*[-–—]\s*\1/gi;

const DEGREE_MARKERS_RE =
  /\b(b\.?\s*s\.?|b\.?\s*a\.?|m\.?\s*s\.?c?\.?|m\.?\s*b\.?\s*a\.?|mba|ph\.?\s*d\.?|bachelor|master|diploma|licence|degree)\b/i;

const EDUCATION_SIGNAL_RE =
  /\b(university|école|ecole|school|bachelor|master|mba|diploma|licence|degree|web\s*&?\s*motion|visual\s+communication)\b/i;

const FREELANCE_ILLUSTRATOR_GRAPHIC_RE =
  /\b(?:freelance\s+)?illustrator\s+(?:and\s+|\/?\s*)?graphic\b/i;

const CORE_CREATIVE_SKILLS = [
  'Illustration',
  'Graphic Design',
  'Packaging',
  'Logo Design',
  'Visual Identity',
  'Editorial Design',
];

const DISPLAY_TOOLS_ORDER = [
  ['Adobe Illustrator', /\b(?:adobe\s+)?illustrator\b/i],
  ['Photoshop', /\bphotoshop\b/i],
  ['InDesign', /\bindesign\b/i],
];

function normSpace(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

function stripOcrFragments(text) {
  let s = normSpace(text);
  if (!s || OCR_CORRUPT_RE.test(s)) return '';
  s = s.replace(DUPLICATE_DATE_RE, '$1');
  s = s.replace(/\s*[-–—]\s*[-–—]\s*/g, ' — ');
  return normSpace(s);
}

function polishIdentity(identity = {}) {
  const cleaned = applyHeaderCleaner({
    name: identity.name,
    title: identity.title,
    email: identity.email,
    phone: identity.phone,
    location: identity.location,
  });
  const out = { ...identity };
  for (const field of ['name', 'title', 'email', 'phone', 'location']) {
    const v = stripOcrFragments(cleaned[field]);
    if (v) out[field] = v;
    else if (field in out) delete out[field];
  }
  return out;
}

function isSchoolOnlyEducationLine(line) {
  const s = normSpace(line);
  return s.length > 0 && s.length < 48 && !/\b(19|20)\d{2}\b/.test(s) && !/[—–-]/.test(s);
}

function rejectCreativeSchoolWithoutDegree(line) {
  const s = normSpace(line);
  if (!/creative\s+school\s+management/i.test(s)) return false;
  return !DEGREE_MARKERS_RE.test(s);
}

function formatKnownEducationLine(line) {
  const s = stripOcrFragments(line);
  if (!s) return '';
  const norm = normalizeEducationEntry(s, {});
  return stripOcrFragments(norm?.display || s);
}

function extractYears(text) {
  const m = String(text || '').match(
    /(\b(?:19|20)\d{2}\s*[-–—/]\s*(?:\d{4}|present|présent|current)\b)/i
  );
  return m ? m[1].replace(/\//g, '–') : '';
}

function cleanEducationInputLine(line) {
  let s = stripOcrFragments(line);
  if (!s) return '';
  if (/creative\s+school\s+management/i.test(s) && !DEGREE_MARKERS_RE.test(s)) {
    if (/cr[ée]apole/i.test(s)) {
      s = s
        .replace(/creative\s+school\s+management/gi, '')
        .replace(/\s*[-–—]\s*[-–—]\s*/g, ' — ')
        .replace(/\s*[-–—]\s*$/g, '')
        .trim();
    } else {
      return '';
    }
  }
  return s;
}

function polishEducation(education = [], ctx = {}) {
  const filtered = (education || [])
    .map((line) => cleanEducationInputLine(line))
    .map((line) => stripOcrFragments(line))
    .filter(Boolean)
    .filter((line) => !rejectCreativeSchoolWithoutDegree(line))
    .filter(
      (line) =>
        !isSchoolOnlyEducationLine(line) ||
        DEGREE_MARKERS_RE.test(line) ||
        EDUCATION_SIGNAL_RE.test(line)
    )
    .map(formatKnownEducationLine)
    .filter(Boolean);

  let normalized = normalizeAllEducation(filtered, { identity: ctx.identity });
  normalized = dedupeEducationStrings(normalized, { identity: ctx.identity });

  const bySchool = new Map();
  for (const line of normalized) {
    const s = stripOcrFragments(line);
    if (!s || rejectCreativeSchoolWithoutDegree(s)) continue;
    if (isCorruptEducationLine(s) && !DEGREE_MARKERS_RE.test(s)) continue;
    if (scoreEducationLine(s) < 0.35 && !DEGREE_MARKERS_RE.test(s) && !EDUCATION_SIGNAL_RE.test(s)) continue;

    const norm = normalizeEducationEntry(s, { identity: ctx.identity });
    const schoolKey = String(norm?.school || s.split(/\s*[—–-]\s*/)[0] || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{M}/gu, '');
    if (!schoolKey || schoolKey.length < 3) continue;

    const conf = scoreEducationLine(norm?.display || s);
    const prev = bySchool.get(schoolKey);
    if (!prev || conf > prev.conf) {
      bySchool.set(schoolKey, { line: formatKnownEducationLine(norm?.display || s), conf });
    }
  }

  return [...bySchool.values()]
    .sort((a, b) => b.conf - a.conf)
    .map((v) => v.line)
    .slice(0, 6);
}

function isCanonicalFreelanceHero(exp) {
  return (
    String(exp?.role || '').trim() === 'Freelance Illustrator / Graphic Designer' &&
    String(exp?.company || '').trim() === 'Independent / Freelance'
  );
}

function isRepeatedFreelanceBlob(text) {
  const s = String(text || '').toLowerCase();
  if (
    /^freelance illustrator\s*\/\s*graphic designer\s+independent\s*\/\s*freelance$/i.test(
      s.replace(/\s+/g, ' ').trim()
    )
  ) {
    return false;
  }
  if (/independent\s*\/\s*freelance.*independent\s*\/\s*freelance/i.test(s)) return true;
  if (/(?:freelance|independent)\s*[-–—/]\s*(?:independent\s*\/\s*freelance|freelance)/i.test(s)) return true;
  const freelanceHits = (s.match(/\bfreelance\b/g) || []).length;
  const independentHits = (s.match(/\bindependent\b/g) || []).length;
  return freelanceHits >= 2 || independentHits >= 2;
}

function isFreelanceExperience(exp) {
  const blob = `${exp?.role || ''} ${exp?.company || ''}`;
  if (isRepeatedFreelanceBlob(blob)) return true;
  return /\b(independent|freelance|self[- ]?employed)\b/i.test(blob);
}

function preserveSourceBullets(exp, max = 4) {
  const bullets = (exp?.bullets || [])
    .map((b) => stripOcrFragments(b))
    .filter((b) => b && !INVENTED_EXPERIENCE_BULLET_RE.test(b));
  if (!bullets.length && exp?.description) {
    const desc = stripOcrFragments(exp.description);
    if (desc && !INVENTED_EXPERIENCE_BULLET_RE.test(desc)) bullets.push(desc);
  }
  return [...new Set(bullets)].slice(0, max);
}

function normalizeFreelanceHero(exp) {
  const out = { ...(exp || {}) };
  if (!out.role) out.role = 'Freelance Illustrator / Graphic Designer';
  if (!out.company) out.company = 'Independent / Freelance';
  out.dates = stripOcrFragments(out.dates);
  out.bullets = preserveSourceBullets(out);
  out.description = out.bullets[0] || '';
  return out;
}

function isGarbledExperience(exp) {
  if (isCanonicalFreelanceHero(exp)) return false;
  const role = String(exp?.role || '');
  const company = String(exp?.company || '');
  const blob = `${role} ${company}`;
  if (isRepeatedFreelanceBlob(blob)) return true;
  if ((blob.match(/independent\s*\/\s*freelance/gi) || []).length > 1) return true;
  if (/—\s*—/.test(role) || /—\s*—/.test(company)) return true;
  if (OCR_CORRUPT_RE.test(blob)) return true;
  if (DUPLICATE_DATE_RE.test(String(exp?.dates || ''))) return true;
  return false;
}

function precleanExperience(exp) {
  const out = { ...(exp || {}) };
  const rawBlob = `${out.role || ''} ${out.company || ''}`;
  if (isRepeatedFreelanceBlob(rawBlob)) {
    return normalizeFreelanceHero(out);
  }
  if (out.company) {
    out.company = stripOcrFragments(out.company)
      .replace(/(independent\s*\/\s*freelance)\s*[—–-]\s*\1/gi, '$1')
      .replace(/(?:freelance|independent)\s*[-–—/]\s*(?:independent\s*\/\s*freelance|freelance)/gi, 'Independent / Freelance')
      .replace(/^independent\s+freelance$/i, 'Independent / Freelance');
  }
  if (out.dates) out.dates = stripOcrFragments(out.dates);
  if (out.role) {
    let role = stripOcrFragments(out.role)
      .replace(/(?:freelance|independent)\s*[-–—/]\s*(?:independent\s*\/\s*freelance|freelance)/gi, 'Freelance')
      .replace(/\s*[-–—/]\s*freelance\s*$/i, '')
      .trim();
    const embedded =
      role.match(
        /^(.+?)\s*[—–-]\s*([A-Za-z][\w\s.&']+?)\s*[—–-]\s*((?:19|20)\d{2}(?:\s*[-–—]\s*(?:\d{4}|present|présent|current))?)\s*$/i
      ) || role.match(/^(.+?)\s*[—–-]\s*(.+?)\s*[—–-]\s*((?:19|20)\d{2}.*)$/i);
    if (embedded) {
      role = embedded[1].trim();
      if (!out.company) out.company = embedded[2].trim();
      if (!out.dates) out.dates = stripOcrFragments(embedded[3].trim());
    }
    out.role = role;
  }
  return out;
}

function polishExperienceEntry(exp) {
  if (!exp || typeof exp !== 'object') return null;
  let out = precleanExperience(exp);
  if (isGarbledExperience(out)) return null;

  if (out.role) out.role = normalizeFreelanceExperienceRole(stripOcrFragments(out.role));
  if (out.company) {
    out.company = stripOcrFragments(out.company).replace(/^independent\s+freelance$/i, 'Independent / Freelance');
  }
  if (out.dates) out.dates = stripOcrFragments(out.dates);

  if (isFreelanceExperience(out) || FREELANCE_ILLUSTRATOR_GRAPHIC_RE.test(out.role || '')) {
    return normalizeFreelanceHero(out);
  }

  out.bullets = (out.bullets || [])
    .map((b) => stripOcrFragments(b))
    .filter(Boolean)
    .slice(0, 4);
  if (!out.bullets.length && out.description) {
    const desc = stripOcrFragments(out.description);
    if (desc) out.bullets = [desc];
  }
  return out;
}

function polishExperiences(experiences = []) {
  const polished = (experiences || []).map(polishExperienceEntry).filter(Boolean);
  const seen = new Set();
  const out = [];
  for (const exp of polished) {
    const key = `${normSpace(exp.role)}|${normSpace(exp.company)}|${normSpace(exp.dates)}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(exp);
  }
  return out.slice(0, 8);
}

function polishSkills(skills = [], frd = {}) {
  const blob = [
    frd.summary,
    ...(skills || []),
    ...(frd.experiences || []).flatMap((e) => [e.description, ...(e.bullets || [])]),
  ]
    .filter(Boolean)
    .join(' ');

  const filtered = (skills || []).map((s) => stripOcrFragments(s)).filter(Boolean);
  const ordered = [];
  for (const canon of CORE_CREATIVE_SKILLS) {
    const listed = filtered.some((s) => s.toLowerCase() === canon.toLowerCase());
    const re = new RegExp(`\\b${canon.replace(/\s+/g, '\\s+')}\\b`, 'i');
    const inferred =
      (canon === 'Logo Design' && /\blogos?\b/i.test(blob)) ||
      (canon === 'Editorial Design' && /\beditorial\b/i.test(blob)) ||
      (canon === 'Packaging' && /\bpackaging\b/i.test(blob)) ||
      (canon === 'Illustration' && /\billustration\b/i.test(blob));
    if (listed || re.test(blob) || inferred) ordered.push(canon);
  }
  const merged = [];
  const seen = new Set();
  for (const skill of [...ordered, ...filtered]) {
    const key = String(skill || '').trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(String(skill).trim());
  }
  return dedupeStringList(merged).slice(0, 14);
}

function polishTools(tools = []) {
  const blob = (tools || []).join(' ').toLowerCase();
  const out = [];
  for (const [label, re] of DISPLAY_TOOLS_ORDER) {
    if (re.test(blob) || (tools || []).some((t) => re.test(String(t)))) {
      out.push(label);
    }
  }
  const fromInput = dedupeStringList(
    (tools || []).map((t) => stripOcrFragments(t)).filter((t) => t && !OCR_CORRUPT_RE.test(t))
  );
  if (!out.length) return fromInput.slice(0, 8);
  return dedupeStringList([...out, ...fromInput]).slice(0, 8);
}

function polishLanguages(languages = []) {
  const out = [];
  const seen = new Set();
  for (const line of languages || []) {
    const cleaned = stripOcrFragments(line);
    const result = sanitizeLanguageLine(cleaned);
    if (!result.ok || !result.display || OCR_CORRUPT_RE.test(result.display)) continue;
    const key = result.display.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(result.display);
  }
  return out.slice(0, 6);
}

function polishClients(clients = [], experiences = [], suggestions = []) {
  const cleaned = extractCleanClientBrands(
    (clients || []).map((c) => stripOcrFragments(c)).filter(Boolean),
    (suggestions || []).map((s) => stripOcrFragments(s)).filter(Boolean)
  );
  const employers = new Set(
    (experiences || [])
      .flatMap((e) => [e.company, e.role])
      .map((x) => normSpace(x).toLowerCase())
      .filter((x) => x.length >= 3)
  );
  return dedupeStringList(
    cleaned.filter((c) => {
      const low = c.toLowerCase();
      for (const emp of employers) {
        if (low === emp || low.includes(emp) || emp.includes(low)) return false;
      }
      return true;
    })
  );
}

function polishSuggestions(suggestions = []) {
  return dedupeStringList(
    (suggestions || []).map((s) => stripOcrFragments(s)).filter((s) => s && s.length >= 3 && !OCR_CORRUPT_RE.test(s))
  ).slice(0, 4);
}

/**
 * @param {object|null} finalResumeData
 * @returns {object|null}
 */
export function applyFinalCvReadabilityPass(finalResumeData) {
  if (!finalResumeData || typeof finalResumeData !== 'object') return finalResumeData;

  const out = { ...finalResumeData };
  out.identity = polishIdentity(out.identity || {});
  out.education = polishEducation(out.education, { identity: out.identity });
  out.experiences = polishExperiences(out.experiences, out);
  const stripped = stripInventedExperiences(out.experiences);
  out.experiences = stripped.kept;
  if (stripped.clients.length) {
    out.clients = dedupeStringList([...(out.clients || []), ...stripped.clients]);
  }
  out.skills = polishSkills(out.skills, out);
  out.tools = polishTools(out.tools);
  out.languages = polishLanguages(out.languages);
  out.clients = polishClients(out.clients, out.experiences, out.suggestions);
  out.suggestions = polishSuggestions(out.suggestions);
  out.summary = stripOcrFragments(out.summary);

  out.metaSafe = {
    ...(out.metaSafe || {}),
    finalCvReadability: FINAL_CV_READABILITY,
    finalCvReadabilityAt: new Date().toISOString(),
  };

  return out;
}
