/**
 * HIRELY H8 — ATS quality scoring (engine · CV quality · ATS readiness).
 * Rewards partial but usable CVs; archetype-aware; no OCR/parser/PDF changes.
 */

import { NAME_UNCERTAIN_LABEL, TITLE_UNCERTAIN_LABEL } from '../parsing/parser-recovery.js';
import { simpleCvDataFromStructured } from '../parsing/simple-cv-mapper.js';
import { validateConsumerDataSource } from './resume-data-contract.js';
import {
  detectDesignerCvMode,
  applyDesignerAtsAdjustments,
  designerCreativeSignalCount,
} from '../parsing/designer-cv-mode.js';
export const ATS_QUALITY_H8 = 'HIRELY_ATS_H8';

export const H8_SCORE_CATEGORIES = Object.freeze({
  identity: { id: 'identity', label: 'Identity', labelKey: 'scoreCatIdentity', max: 15 },
  contact: { id: 'contact', label: 'Contact', labelKey: 'scoreCatContact', max: 10 },
  experience: { id: 'experience', label: 'Experience', labelKey: 'scoreCatExperience', max: 24 },
  education: { id: 'education', label: 'Education', labelKey: 'scoreCatEducation', max: 10 },
  skills: { id: 'skills', label: 'Skills', labelKey: 'scoreCatSkills', max: 12 },
  tools: { id: 'tools', label: 'Tools', labelKey: 'scoreCatTools', max: 8 },
  languages: { id: 'languages', label: 'Languages', labelKey: 'scoreCatLanguages', max: 8 },
  summary: { id: 'summary', label: 'Summary', labelKey: 'scoreCatSummary', max: 8 },
  formatting: { id: 'formatting', label: 'Formatting', labelKey: 'scoreCatFormatting', max: 5 },
});

function getCoreAtsDimensionScores(result) {
  if (!result?.breakdown) return null;
  const dims = ['identity', 'experience', 'education', 'skills', 'languages'];
  const byId = Object.fromEntries(result.breakdown.map((c) => [c.id, c]));
  return dims.reduce((acc, id) => {
    const cat = byId[id];
    acc[id] = cat
      ? { points: cat.points, max: cat.max, pct: cat.max ? Math.round((cat.points / cat.max) * 100) : 0 }
      : { points: 0, max: 0, pct: 0 };
    return acc;
  }, {});
}

const UNCERTAIN_TITLES = new Set([
  TITLE_UNCERTAIN_LABEL,
  'Poste à compléter',
  'Title to confirm',
  '',
]);

const PLACEHOLDER_VALUE_RE =
  /^(candidate\s*name|your\s*name|full\s*name|email@example\.com|john\s+doe|jane\s+doe|company\s*name|xxx+|n\/?a|tbd|\[.*\]|—|-{2,})$/i;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const YEAR_RE = /\b((?:19|20)\d{2})\b/;
const METRIC_RE =
  /\d+\s*%|\d[\d\s.,]*\s*(k|K|M|m|€|\$|£)|[€$£]\s?\d|\b\d{2,}\s*(users|clients|projects|people|personnes|projets)\b/i;
const ACTION_RE =
  /\b(created|built|designed|managed|led|delivered|developed|implemented|launched|optimized|improved|increased|reduced|grew|achieved|collaborated|créé|conçu|dirigé|géré|livré|augmenté|réduit)\b/i;
const PARSER_GARBAGE_RE = /\b(id=|href=|instagram\.com|utm_|gclid=)\b/i;

/** @type {Record<string, { educationOptional: boolean, shortExperienceOk: boolean, portfolioMatters: boolean, experienceTarget: number }>} */
export const ARCHETYPE_PROFILES = Object.freeze({
  designer: { educationOptional: true, shortExperienceOk: false, portfolioMatters: true, experienceTarget: 1 },
  developer: { educationOptional: true, shortExperienceOk: false, portfolioMatters: false, experienceTarget: 1 },
  marketing: { educationOptional: true, shortExperienceOk: false, portfolioMatters: false, experienceTarget: 2 },
  sales: { educationOptional: true, shortExperienceOk: false, portfolioMatters: false, experienceTarget: 2 },
  student: { educationOptional: false, shortExperienceOk: true, portfolioMatters: false, experienceTarget: 1 },
  executive: { educationOptional: true, shortExperienceOk: false, portfolioMatters: false, experienceTarget: 2 },
  academic: { educationOptional: false, shortExperienceOk: false, portfolioMatters: false, experienceTarget: 2 },
  consultant: { educationOptional: true, shortExperienceOk: true, portfolioMatters: false, experienceTarget: 1 },
  recruiter: { educationOptional: true, shortExperienceOk: false, portfolioMatters: false, experienceTarget: 2 },
  layout: { educationOptional: true, shortExperienceOk: true, portfolioMatters: false, experienceTarget: 1 },
  product: { educationOptional: true, shortExperienceOk: false, portfolioMatters: false, experienceTarget: 1 },
  general: { educationOptional: true, shortExperienceOk: false, portfolioMatters: false, experienceTarget: 1 },
});

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function isPlaceholderField(value) {
  const s = String(value || '').trim();
  if (!s) return true;
  return PLACEHOLDER_VALUE_RE.test(s);
}

function flattenExperienceEntry(e) {
  if (!e || typeof e !== 'object') return String(e || '').trim();
  const dates = e.dates || [e.startDate, e.endDate].filter(Boolean).join('–');
  const head = [e.role, e.company, e.location, dates].filter(Boolean).join(' — ');
  const bullets = (e.bullets || []).filter(Boolean);
  const desc = String(e.rewrittenDescription || e.description || '').trim();
  const body = bullets.length ? bullets.join(' · ') : desc;
  return body ? `${head}: ${body}` : head;
}

/**
 * Recover scoring fields stripped by template sanitization (ATS-only read path).
 * @param {object|null} raw
 */
export function enrichCvDataForAts(raw) {
  const p = raw && typeof raw === 'object' ? { ...raw } : {};
  const rd = p._sourceResumeData || p._resumeData || null;
  if (!rd || typeof rd !== 'object') return p;

  const recovered = simpleCvDataFromStructured({
    identity: rd.identity || {},
    summary: rd.summary || p.summary,
    experiences: rd.experiences || [],
    education: rd.education || p.education || [],
    skills: rd.skills || p.skills || [],
    tools: rd.tools || p.tools || [],
    languages: rd.languages || p.languages || [],
    clients: rd.clients || p.clients || [],
    projects: rd.projects || p.projects || [],
    portfolioLinks: rd.portfolioLinks || p.portfolioLinks || [],
    awards: rd.awards || p.awards || [],
    exhibitions: rd.exhibitions || p.exhibitions || [],
  });

  const out = { ...p };
  if (!(out.experience || []).filter(Boolean).length && (recovered.experience || []).length) {
    out.experience = recovered.experience;
  }
  if (!(out.skills || []).length && (recovered.skills || []).length) out.skills = recovered.skills;
  if (!(out.tools || []).length && (recovered.tools || []).length) out.tools = recovered.tools;
  if (!(out.education || []).length && (recovered.education || []).length) out.education = recovered.education;
  if (!(out.languages || []).length && (recovered.languages || []).length) out.languages = recovered.languages;
  if (!(out.clients || []).length && (recovered.clients || []).length) out.clients = recovered.clients;
  if (!(out.projects || []).length && (recovered.projects || []).length) out.projects = recovered.projects;
  if (!(out.portfolioLinks || []).length && (recovered.portfolioLinks || []).length) {
    out.portfolioLinks = recovered.portfolioLinks;
  }
  if (!(out.awards || []).length && (recovered.awards || []).length) out.awards = recovered.awards;
  if (!(out.exhibitions || []).length && (recovered.exhibitions || []).length) {
    out.exhibitions = recovered.exhibitions;
  }
  if (rd.experiences?.length) out.experiences = rd.experiences;
  if (!out.summary && recovered.summary) out.summary = recovered.summary;
  if ((!out.title || UNCERTAIN_TITLES.has(String(out.title).trim())) && recovered.title && !UNCERTAIN_TITLES.has(recovered.title)) {
    out.title = recovered.title;
  }
  return out;
}

/**
 * Normalize cvData for scoring — reads structured experiences, infers title, merges skills.
 * @param {object|null} raw
 */
export function normalizeCvForAtsScoring(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const p = enrichCvDataForAts({ ...source });
  const structured = Array.isArray(p.experiences) ? p.experiences : [];
  let experience = Array.isArray(p.experience) ? p.experience.filter(Boolean) : [];

  if (!experience.length && structured.length) {
    experience = structured.map(flattenExperienceEntry).filter(Boolean);
  }

  p.experience = experience;
  p.experiences = structured;

  const originalTitle = String(source?.title || '').trim();
  const title = String(p.title || '').trim();
  const mayInferTitle =
    originalTitle !== NAME_UNCERTAIN_LABEL &&
    !(originalTitle === TITLE_UNCERTAIN_LABEL && !hasName({ name: source?.name }));
  if (mayInferTitle && (UNCERTAIN_TITLES.has(title) || isPlaceholderField(title))) {
    if (structured[0]?.role) {
      p.title = String(structured[0].role).trim();
      p._titleInferred = true;
    } else if (experience[0]) {
      const role = String(experience[0]).split(/[—–\-|·]/)[0].trim();
      if (role.length >= 3 && role.length <= 72) {
        p.title = role;
        p._titleInferred = true;
      }
    }
  }
  if (originalTitle === TITLE_UNCERTAIN_LABEL) p._titleExplicitUncertain = true;

  const skills = [...(p.skills || []), ...(p.tools || [])]
    .map((s) => String(s || '').trim())
    .filter(Boolean);
  p._skillsCombined = [...new Set(skills)];
  return p;
}

/**
 * @param {object} p normalized cv
 */
export function detectCvArchetype(p) {
  const blob = [
    p.title,
    p.name,
    ...(p.experience || []),
    ...(p._skillsCombined || []),
    p.summary,
    ...(p.clients || []),
    ...(p.projects || []),
  ]
    .join(' ')
    .toLowerCase();

  const titleName = `${p.title || ''} ${p.name || ''}`.toLowerCase();
  if (/\b(intern|internship|student|university|campus|b\.?s\.?c|bachelor|master candidate)\b/.test(blob)) {
    return 'student';
  }
  if (
    /\b(illustrator|graphic designer|art director|creative director|visual designer|motion designer|brand designer|ui designer)\b/.test(
      titleName
    ) ||
    (/\b(illustrat|graphic design|brand design|ui design)\b/.test(blob) && (p.clients || []).length >= 2)
  ) {
    return 'designer';
  }
  if (/\b(software engineer|developer|backend|frontend|full.?stack|devops|sre)\b/.test(blob)) return 'developer';
  if (/\b(marketing|growth|brand manager|content strateg|seo|campaign)\b/.test(blob)) return 'marketing';
  if (/\b(sales|account executive|business development|revenue|bdr|sdr|quota|pipeline)\b/.test(blob)) {
    return 'sales';
  }
  if (
    /\b(illustrat|graphic design|art director|creative director|motion design|visual designer|portfolio)\b/.test(
      blob
    ) ||
    ((p.clients || []).length >= 3 && !/\b(sales|account executive)\b/.test(blob))
  ) {
    return 'designer';
  }
  if (/\b(ceo|cfo|cto|chief|vice president|\bvp\b|managing director)\b/.test(blob)) return 'executive';
  if (/\b(phd|professor|research fellow|academic|publication|postdoc)\b/.test(blob)) return 'academic';
  if (/\b(consultant|advisory|strategy consultant)\b/.test(blob)) return 'consultant';
  if (/\b(recruiter|talent acquisition|headhunter|hiring manager)\b/.test(blob)) return 'recruiter';
  return 'general';
}

function hasName(p) {
  const n = String(p?.name || '').trim();
  if (!n || n === NAME_UNCERTAIN_LABEL || n === 'Nom à compléter' || n === 'Nom à confirmer') return false;
  return !isPlaceholderField(n) && n.length >= 2;
}

function hasTitle(p) {
  if (p._titleExplicitUncertain) return false;
  const t = String(p?.title || '').trim();
  if (!t || UNCERTAIN_TITLES.has(t) || isPlaceholderField(t)) return false;
  return t.length >= 3;
}

function hasEmail(p) {
  return EMAIL_RE.test(String(p?.email || '').trim());
}

function hasPhone(p) {
  const digits = String(p?.phone || '').replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 15;
}

function hasLinkedInOrPortfolio(p) {
  const linkedin = String(p?.linkedin || '').trim();
  const portfolio = String(p?.portfolio || '').trim();
  if (linkedin && (/linkedin\.com/i.test(linkedin) || /^https?:\/\//i.test(linkedin))) return true;
  return !!portfolio && /^https?:\/\//i.test(portfolio);
}

function hasLocation(p) {
  return String(p?.location || '').trim().length >= 2;
}

function hasSummary(p) {
  const s = String(p?.summary || '').trim();
  return s.length >= 40 && !PARSER_GARBAGE_RE.test(s);
}

function experienceLines(p) {
  return Array.isArray(p?.experience) ? p.experience.filter(Boolean) : [];
}

function hasPortfolioSubstitute(p, profile) {
  return profile.portfolioMatters && portfolioSignal(p) >= 3 && skillCount(p) >= 3;
}

function hasExperience(p, profile = ARCHETYPE_PROFILES.general) {
  if (experienceLines(p).length > 0 || (p.experiences || []).length > 0) return true;
  return hasPortfolioSubstitute(p, profile);
}

function educationLines(p) {
  return Array.isArray(p?.education) ? p.education.filter(Boolean) : [];
}

function hasEducation(p) {
  return educationLines(p).length > 0;
}

function skillCount(p) {
  return (p._skillsCombined || []).length;
}

function languageCount(p) {
  return (p.languages || []).filter(Boolean).length;
}

function portfolioSignal(p) {
  const clients = (p.clients || []).filter(Boolean).length;
  const projects = (p.projects || []).filter(Boolean).length;
  return clients + projects;
}

function categoryEntry(meta, points, reasons = []) {
  return { ...meta, points: clamp(Math.round(points), 0, meta.max), max: meta.max, reasons };
}

function bandFromScore(score) {
  if (score >= 80) return { label: 'Excellent', labelKey: 'bandExcellent', tier: 'good' };
  if (score >= 60) return { label: 'Good', labelKey: 'bandGood', tier: 'average' };
  return { label: 'Needs improvement', labelKey: 'bandNeedsImprovement', tier: 'weak' };
}

function scoreIdentityH8(p) {
  let pts = 0;
  const reasons = [];
  if (hasName(p)) {
    pts += 8;
    reasons.push({ t: 'Name present', ok: 1 });
  } else reasons.push({ t: 'Name missing', ok: 0 });
  if (hasTitle(p)) {
    pts += 7;
    reasons.push({ t: p._titleInferred ? 'Title inferred from experience' : 'Job title present', ok: 1 });
  } else reasons.push({ t: 'Job title missing', ok: 0 });
  return { points: pts, reasons };
}

function scoreContactH8(p) {
  let pts = 0;
  const reasons = [];
  if (hasEmail(p)) {
    pts += 5;
    reasons.push({ t: 'Email present', ok: 1 });
  } else reasons.push({ t: 'Email missing', ok: 0 });
  if (hasPhone(p)) {
    pts += 3;
    reasons.push({ t: 'Phone present', ok: 1 });
  } else reasons.push({ t: 'Phone missing', ok: 0 });
  if (hasLinkedInOrPortfolio(p)) {
    pts += 2;
    reasons.push({ t: 'LinkedIn or portfolio', ok: 1 });
  }
  if (hasLocation(p)) {
    pts += 2;
    reasons.push({ t: 'Location present', ok: 1 });
  }
  return { points: pts, reasons };
}

function scoreExperienceH8(p, profile) {
  const exp = experienceLines(p);
  const expN = exp.length;
  const target = profile.experienceTarget || 1;
  const dated = exp.filter((l) => YEAR_RE.test(String(l))).length;
  const actionLines = exp.filter((l) => ACTION_RE.test(String(l))).length;
  const metricLines = exp.filter((l) => METRIC_RE.test(String(l))).length;

  let pts = 0;
  const reasons = [];
  if (!expN && hasPortfolioSubstitute(p, profile)) {
    return {
      points: 18,
      reasons: [
        { t: 'Portfolio-heavy profile — client/project work counts as experience signal', ok: 1 },
        { t: `${portfolioSignal(p)} portfolio signals`, ok: 1 },
      ],
    };
  }
  if (hasExperience(p, profile)) {
    pts += 10;
    reasons.push({ t: 'Experience section present', ok: 1 });
  } else {
    reasons.push({ t: 'No experience entries', ok: 0 });
    return { points: 0, reasons };
  }

  if (expN >= target || (profile.shortExperienceOk && expN >= 1)) {
    pts += 6;
    reasons.push({ t: `${expN} experience ${expN === 1 ? 'entry' : 'entries'}`, ok: 1 });
  } else {
    reasons.push({ t: 'Add more experience entries', ok: 0 });
  }

  if (dated >= Math.min(expN, 1)) {
    pts += 5;
    reasons.push({ t: 'Experience dates present', ok: 1 });
  } else if (structuredDatesPresent(p)) {
    pts += 4;
    reasons.push({ t: 'Structured experience dates', ok: 1 });
  } else {
    reasons.push({ t: 'Experience dates missing', ok: 0 });
  }

  if (actionLines >= 1 || metricLines >= 1) {
    pts += 3;
    reasons.push({ t: 'Impact or action detail in experience', ok: 1 });
  }

  return { points: pts, reasons };
}

function structuredDatesPresent(p) {
  return (p.experiences || []).some((e) => e?.startDate || e?.dates || YEAR_RE.test(String(e?.endDate || '')));
}

function scorePortfolioH8(p, profile) {
  const signal = portfolioSignal(p);
  if (!profile.portfolioMatters) {
    return { points: 0, reasons: [{ t: 'Portfolio section N/A for profile', ok: 1 }], skip: true };
  }
  let pts = 0;
  const reasons = [];
  const clients = (p.clients || []).filter(Boolean).length;
  const projects = (p.projects || []).filter(Boolean).length;
  if (signal >= 1) {
    pts += 4;
    reasons.push({ t: 'Portfolio / client work listed', ok: 1 });
  } else reasons.push({ t: 'No client or project highlights', ok: 0 });
  if (clients >= 3) {
    pts += 4;
    reasons.push({ t: `${clients} client references`, ok: 1 });
  } else if (clients >= 1) {
    pts += 2;
    reasons.push({ t: 'Some client references', ok: 0 });
  }
  if (projects >= 1) {
    pts += 2;
    reasons.push({ t: 'Project highlights present', ok: 1 });
  }
  return { points: pts, reasons, skip: false };
}

function hasStudentEducationSignal(p) {
  return (
    hasEducation(p) ||
    /\b(university|college|b\.?s\.?c|bachelor|master|école|school|campus)\b/i.test(
      `${p.email || ''} ${p.summary || ''} ${(p.experience || []).join(' ')}`
    )
  );
}

function scoreEducationH8(p, profile) {
  const edu = educationLines(p);
  if (!hasEducation(p)) {
    if (profile.archetype === 'student' && hasStudentEducationSignal(p)) {
      return {
        points: 7,
        reasons: [{ t: 'Student education signal (school / university context)', ok: 1 }],
      };
    }
    if (profile.educationOptional) {
      return {
        points: 6,
        reasons: [{ t: 'Education optional for this profile', ok: 1 }],
        neutral: true,
      };
    }
    return { points: 0, reasons: [{ t: 'Education missing', ok: 0 }] };
  }
  let pts = 6;
  const reasons = [{ t: 'Education listed', ok: 1 }];
  if (edu.length >= 2) {
    pts += 2;
    reasons.push({ t: `${edu.length} education entries`, ok: 1 });
  }
  if (edu.some((line) => YEAR_RE.test(String(line)))) {
    pts += 2;
    reasons.push({ t: 'Education years present', ok: 1 });
  }
  return { points: pts, reasons };
}

function inferSkillsFromExperience(p) {
  const blob = (p.experience || []).join(' ').toLowerCase();
  const hits = [];
  const hints = [
    'python',
    'javascript',
    'react',
    'node',
    'sql',
    'aws',
    'figma',
    'photoshop',
    'excel',
    'salesforce',
    'hubspot',
    'seo',
    'analytics',
    'leadership',
    'strategy',
    'negotiation',
  ];
  for (const h of hints) {
    if (blob.includes(h)) hits.push(h);
  }
  return hits;
}

function scoreSkillsH8(p) {
  const inferred = inferSkillsFromExperience(p);
  const n = skillCount(p) + inferred.length;
  let pts = 0;
  const reasons = [];
  if (n >= 1) {
    pts += 4;
    reasons.push({
      t: skillCount(p) ? 'Skills listed' : 'Skills inferred from experience keywords',
      ok: 1,
    });
  } else reasons.push({ t: 'No skills listed', ok: 0 });
  if (n >= 3) {
    pts += 4;
    reasons.push({ t: `${n} skills`, ok: 1 });
  }
  if (n >= 6) {
    pts += 4;
    reasons.push({ t: 'Rich skills coverage', ok: 1 });
  }
  return { points: pts, reasons };
}

function scoreLanguagesH8(p, profile) {
  const n = languageCount(p);
  if (n === 0 && profile.educationOptional) {
    return { points: 4, reasons: [{ t: 'Languages optional', ok: 1 }], neutral: true };
  }
  let pts = 0;
  const reasons = [];
  if (n >= 1) {
    pts += 5;
    reasons.push({ t: 'Languages listed', ok: 1 });
  } else reasons.push({ t: 'No languages listed', ok: 0 });
  if (n >= 2) {
    pts += 3;
    reasons.push({ t: `${n} languages`, ok: 1 });
  }
  return { points: pts, reasons };
}

function scoreSummaryH8(p) {
  const s = String(p?.summary || '').trim();
  if (!s) return { points: 0, reasons: [{ t: 'Summary missing', ok: 0 }] };
  let pts = 0;
  const reasons = [];
  if (s.length >= 40 && s.length <= 500) {
    pts += 5;
    reasons.push({ t: 'Summary present', ok: 1 });
  }
  if (s.length >= 70) {
    pts += 2;
    reasons.push({ t: 'Summary has depth', ok: 1 });
  }
  if (!PARSER_GARBAGE_RE.test(s)) {
    pts += 1;
    reasons.push({ t: 'Summary is clean', ok: 1 });
  }
  return { points: pts, reasons };
}

function scoreFormattingH8(p) {
  let pts = 5;
  const reasons = [{ t: 'Readable structure', ok: 1 }];
  for (const line of experienceLines(p)) {
    if (String(line).length > 320) {
      pts -= 2;
      reasons.push({ t: 'Overlong experience line', ok: 0 });
      break;
    }
    if (PARSER_GARBAGE_RE.test(String(line))) {
      pts -= 3;
      reasons.push({ t: 'Parser noise in text', ok: 0 });
      break;
    }
  }
  return { points: clamp(pts, 0, 5), reasons };
}

function computeSoftPenalties(p, profile, designerMode = null) {
  const items = [];
  let total = 0;
  if (!hasExperience(p, profile)) {
    const creativeSignals = designerMode?.active ? designerCreativeSignalCount(p) : 0;
    const pts = designerMode?.active && creativeSignals >= 3 ? 4 : 12;
    items.push({ id: 'emptyExperience', label: 'Empty experience section', points: pts });
    total += pts;
  } else if (!experienceLines(p).some((l) => YEAR_RE.test(String(l))) && !structuredDatesPresent(p)) {
    items.push({ id: 'missingDates', label: 'Experience dates unclear', points: 3 });
    total += 3;
  }
  if (!hasTitle(p) && !p._titleInferred) {
    const pts = hasExperience(p, profile) ? 2 : 4;
    items.push({ id: 'missingTitle', label: 'Missing job title', points: pts });
    total += pts;
  }
  if (profile.archetype === 'student' && !hasStudentEducationSignal(p)) {
    items.push({ id: 'missingEducation', label: 'Education expected for student profile', points: 3 });
    total += 3;
  }
  return { items, total: clamp(total, 0, 18) };
}

function collectMissingFields(p, profile, checks) {
  /** @type {string[]} */
  const missing = [];
  if (!checks.name) missing.push('name');
  if (!checks.title) missing.push('title');
  if (!checks.email) missing.push('email');
  if (!checks.phone) missing.push('phone');
  if (!checks.experience) missing.push('experience');
  if (!checks.education && !profile.educationOptional) missing.push('education');
  if (!checks.skills) missing.push('skills');
  if (!checks.languages && !profile.educationOptional) missing.push('languages');
  if (!checks.summary) missing.push('summary');
  if (profile.portfolioMatters && portfolioSignal(p) < 1) missing.push('portfolio');
  return missing;
}

function buildNextActions(breakdown, penalties, missingFields, archetype) {
  const ACTION_MAP = {
    name: 'Add your full name at the top of the CV.',
    title: 'Add a clear job title or headline matching your target role.',
    email: 'Add a professional email address.',
    phone: 'Add a phone number recruiters can reach.',
    experience: 'Add at least one role with company, dates, and impact bullets.',
    education: archetype === 'student' ? 'List your degree, school, and expected graduation.' : 'Add your main degree and school.',
    skills: 'List 5–8 role-relevant skills or tools.',
    languages: 'Add languages with proficiency level.',
    summary: 'Write a 2–3 sentence professional summary.',
    portfolio: 'Highlight 3–6 client or project names to show creative reach.',
  };

  /** @type {{ action: string, priority: string, field: string }[]} */
  const actions = [];

  for (const field of missingFields) {
    if (ACTION_MAP[field]) {
      actions.push({ field, action: ACTION_MAP[field], priority: 'high' });
    }
  }

  for (const pen of penalties) {
    if (actions.length >= 6) break;
    if (pen.id === 'missingDates') {
      actions.push({
        field: 'experience',
        action: 'Add years or date ranges to each role (e.g. 2020–Present).',
        priority: 'medium',
      });
    }
  }

  for (const cat of breakdown) {
    if (actions.length >= 6) break;
    const pct = cat.max ? cat.points / cat.max : 0;
    if (pct < 0.45 && cat.id === 'skills') {
      actions.push({
        field: 'skills',
        action: 'Expand skills and software tools relevant to your target role.',
        priority: 'medium',
      });
    }
  }

  const order = { high: 0, medium: 1, low: 2 };
  actions.sort((a, b) => (order[a.priority] ?? 9) - (order[b.priority] ?? 9));

  const seen = new Set();
  const unique = [];
  for (const a of actions) {
    if (seen.has(a.field)) continue;
    seen.add(a.field);
    unique.push(a);
  }

  return unique.slice(0, 3).map((a) => a.action);
}

function buildStrengthsH8(breakdown, p, profile) {
  const strengths = [];
  for (const cat of breakdown) {
    const pct = cat.max ? cat.points / cat.max : 0;
    if (pct >= 0.75) strengths.push(`${cat.label}: ${cat.points}/${cat.max}`);
  }
  if (profile.portfolioMatters && portfolioSignal(p) >= 3) {
    strengths.push(`Portfolio reach: ${portfolioSignal(p)} clients/projects listed`);
  }
  if (p._titleInferred && hasTitle(p)) {
    strengths.push('Title inferred from experience — profile is still usable');
  }
  if (!strengths.length && hasName(p) && hasExperience(p)) {
    strengths.push('Core identity and experience present — good foundation');
  }
  return strengths.slice(0, 5);
}

function computeLayerScores(breakdown, checks) {
  const byId = Object.fromEntries(breakdown.map((c) => [c.id, c]));
  const pct = (id) => {
    const c = byId[id];
    return c?.max ? (c.points / c.max) * 100 : 0;
  };

  const cvQualityParts = ['experience', 'education', 'skills', 'tools', 'languages', 'summary', 'portfolio'];
  const cvQuality = Math.round(
    cvQualityParts.reduce((s, id) => s + pct(id), 0) / cvQualityParts.length
  );

  const atsReadinessParts = ['identity', 'contact', 'formatting'];
  let atsReadiness = Math.round(
    atsReadinessParts.reduce((s, id) => s + pct(id), 0) / atsReadinessParts.length
  );
  if (!checks.email) atsReadiness = clamp(atsReadiness - 8, 0, 100);
  if (!checks.name) atsReadiness = clamp(atsReadiness - 15, 0, 100);

  return { cvQuality: clamp(cvQuality, 0, 100), atsReadiness: clamp(atsReadiness, 0, 100) };
}

/**
 * @param {object|null} cvData
 * @param {{ resumeData?: object|null }} [opts]
 */
export function computeAtsQualityH8(cvData, opts = {}) {
  const engine = {
    ran: true,
    version: ATS_QUALITY_H8,
    valid: !!(cvData && typeof cvData === 'object'),
  };

  if (!engine.valid) {
    return {
      version: ATS_QUALITY_H8,
      engine,
      score: 0,
      total: 0,
      cvQuality: { score: 0, band: bandFromScore(0) },
      atsReadiness: { score: 0, band: bandFromScore(0) },
      strengths: [],
      missingFields: ['name', 'contact', 'experience'],
      nextActions: [
        'Import or paste your CV to generate a score.',
        'Add your name and email.',
        'Add at least one experience entry.',
      ],
      band: bandFromScore(0),
      breakdown: [],
      penalties: [],
      checklist: [],
      checks: {},
    };
  }

  const input =
    opts.resumeData && typeof opts.resumeData === 'object'
      ? { ...cvData, _sourceResumeData: opts.resumeData }
      : cvData;
  validateConsumerDataSource(input, 'ATS', { silent: true });
  const p = normalizeCvForAtsScoring(input);
  const designerMode =
    opts.resumeData?.meta?.designerMode ||
    opts.resumeData?.metadata?.designerCvMode ||
    p._designerMode ||
    detectDesignerCvMode(
      [p.title, p.summary, ...(p.experience || []), ...(p.clients || [])].filter(Boolean).join('\n')
    );
  if (designerMode?.active) p._designerMode = designerMode;
  const archetype = designerMode?.active ? 'designer' : detectCvArchetype(p);
  const profile = { ...ARCHETYPE_PROFILES[archetype] || ARCHETYPE_PROFILES.general, archetype };

  const identity = scoreIdentityH8(p);
  const contact = scoreContactH8(p);
  const experience = scoreExperienceH8(p, profile);
  const portfolio = scorePortfolioH8(p, profile);
  const education = scoreEducationH8(p, profile);
  const skills = scoreSkillsH8(p);
  const languages = scoreLanguagesH8(p, profile);
  const summary = scoreSummaryH8(p);
  const formatting = scoreFormattingH8(p);

  const breakdown = [
    categoryEntry(H8_SCORE_CATEGORIES.identity, identity.points, identity.reasons),
    categoryEntry(H8_SCORE_CATEGORIES.contact, contact.points, contact.reasons),
    categoryEntry(H8_SCORE_CATEGORIES.experience, experience.points, experience.reasons),
    categoryEntry(H8_SCORE_CATEGORIES.education, education.points, education.reasons),
    categoryEntry(H8_SCORE_CATEGORIES.skills, skills.points, skills.reasons),
    categoryEntry(H8_SCORE_CATEGORIES.tools, 0, [{ t: 'Merged into skills for H8', ok: 1 }]),
    categoryEntry(H8_SCORE_CATEGORIES.languages, languages.points, languages.reasons),
    categoryEntry(H8_SCORE_CATEGORIES.summary, summary.points, summary.reasons),
    categoryEntry(H8_SCORE_CATEGORIES.formatting, formatting.points, formatting.reasons),
  ];

  if (!portfolio.skip) {
    const portPts = clamp(portfolio.points, 0, 8);
    breakdown.find((c) => c.id === 'skills').points = clamp(
      breakdown.find((c) => c.id === 'skills').points + Math.round(portPts * 0.5),
      0,
      H8_SCORE_CATEGORIES.skills.max
    );
    breakdown.find((c) => c.id === 'summary').points = clamp(
      breakdown.find((c) => c.id === 'summary').points + Math.round(portPts * 0.25),
      0,
      H8_SCORE_CATEGORIES.summary.max
    );
    breakdown.find((c) => c.id === 'experience').points = clamp(
      breakdown.find((c) => c.id === 'experience').points + Math.round(portPts * 0.25),
      0,
      H8_SCORE_CATEGORIES.experience.max
    );
  }

  const baseScore = breakdown.reduce((sum, c) => sum + c.points, 0);
  const penalties = computeSoftPenalties(p, profile, designerMode);
  let score = clamp(baseScore - penalties.total, 0, 100);

  const checks = {
    name: hasName(p),
    title: hasTitle(p),
    email: hasEmail(p),
    phone: hasPhone(p),
    linkedin: hasLinkedInOrPortfolio(p),
    summary: hasSummary(p),
    experience: hasExperience(p, profile),
    education: hasEducation(p),
    skills: skillCount(p) >= 1 || inferSkillsFromExperience(p).length >= 1,
    tools: skillCount(p) >= 1,
    languages: languageCount(p) >= 1,
  };

  const layers = computeLayerScores(breakdown, checks);
  const missingFields = collectMissingFields(p, profile, checks);
  const strengths = buildStrengthsH8(breakdown, p, profile);
  const nextActions = buildNextActions(breakdown, penalties.items, missingFields, archetype);

  const checklist = [
    { id: 'name', ok: checks.name },
    { id: 'title', ok: checks.title },
    { id: 'email', ok: checks.email },
    { id: 'phone', ok: checks.phone },
    { id: 'linkedin', ok: checks.linkedin },
    { id: 'summary', ok: checks.summary },
    { id: 'experience', ok: checks.experience },
    { id: 'education', ok: checks.education },
    { id: 'skills', ok: checks.skills },
    { id: 'tools', ok: checks.tools },
    { id: 'languages', ok: checks.languages },
  ];

  const band = bandFromScore(score);

  let result = {
    version: ATS_QUALITY_H8,
    engine,
    archetype,
    profile: profile.archetype,
    score,
    total: score,
    band,
    cvQuality: { score: layers.cvQuality, band: bandFromScore(layers.cvQuality) },
    atsReadiness: { score: layers.atsReadiness, band: bandFromScore(layers.atsReadiness) },
    strengths,
    missingFields,
    nextActions,
    breakdown,
    penalties: penalties.items,
    scores: {
      overall: score,
      content: layers.cvQuality,
      experience: breakdown.find((c) => c.id === 'experience')?.points || 0,
      readability: layers.atsReadiness,
      ats: layers.atsReadiness,
      completeness: layers.cvQuality,
    },
    checklist,
    checks,
    recommendations: nextActions.map((action, i) => ({
      id: `action-${i}`,
      category: 'Action',
      issue: missingFields[i] || 'improve',
      fix: action,
      priority: i === 0 ? 'high' : 'medium',
    })),
    panel: {
      overall: score,
      content: layers.cvQuality,
      experience: breakdown.find((c) => c.id === 'experience')?.max
        ? Math.round(
            ((breakdown.find((c) => c.id === 'experience')?.points || 0) /
              breakdown.find((c) => c.id === 'experience')?.max) *
              100
          )
        : 0,
      readability: layers.atsReadiness,
      ats: layers.atsReadiness,
      completeness: layers.cvQuality,
      recruiterReady: score,
    },
    quality: band.tier === 'good' ? 'good' : band.tier === 'average' ? 'medium' : 'bad',
    coreDimensions: getCoreAtsDimensionScores({ breakdown }),
    weaknesses: missingFields.map((f) => `Missing: ${f}`).slice(0, 5),
  };

  if (designerMode?.active) {
    result = applyDesignerAtsAdjustments(result, designerMode, p);
    result.band = bandFromScore(result.score);
    if (result.cvQuality) {
      result.cvQuality.band = bandFromScore(result.cvQuality.score);
    }
    if (result.atsReadiness) {
      result.atsReadiness.band = bandFromScore(result.atsReadiness.score);
    }
    if (result.scores) {
      result.scores.overall = result.score;
    }
    if (result.panel) {
      result.panel.overall = result.score;
      result.panel.ats = result.atsReadiness?.score ?? result.panel.ats;
      result.panel.readability = result.atsReadiness?.score ?? result.panel.readability;
    }
  }

  return result;
}
