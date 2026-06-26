/**
 * HIRELY P1 — Trusted CV Quality Engine.
 * Human-readable review: strengths, weaknesses, missing information.
 * No arbitrary percentage scores in consumer output.
 */

import { NAME_UNCERTAIN_LABEL, TITLE_UNCERTAIN_LABEL } from '../parsing/parser-recovery.js';
import { resolveChecklistProfile } from './recruiter-checklist-source.js';
import {
  ARCHETYPE_PROFILES,
  detectCvArchetype,
  normalizeCvForAtsScoring,
} from './ats-quality-h8.js';
import { resolveIdentityContact } from './identity-contact.js';

export const TRUSTED_CV_REVIEW_V1 = 'TRUSTED_CV_REVIEW_V1';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const YEAR_RE = /\b((?:19|20)\d{2})\b/g;
const PRESENT_RE = /\b(present|présent|current|now|aujourd'hui|actuel)\b/i;

const STRENGTH_LABELS = {
  contact_complete: { labelKey: 'cvReviewContactComplete', label: 'Contact information complete' },
  experience_years: { labelKey: 'cvReviewExperienceYears', label: '{n} years experience' },
  experience_section: { labelKey: 'cvReviewExperienceSection', label: 'Experience section present' },
  experience_dates: { labelKey: 'cvReviewExperienceDates', label: 'Experience dates included' },
  education_listed: { labelKey: 'cvReviewEducationListed', label: 'Education listed' },
  skills_rich: { labelKey: 'cvReviewSkillsRich', label: 'Strong skills section ({n} skills)' },
  skills_listed: { labelKey: 'cvReviewSkillsListed', label: 'Skills listed' },
  summary_present: { labelKey: 'cvReviewSummaryPresent', label: 'Professional summary present' },
  portfolio_link: { labelKey: 'cvReviewPortfolioLink', label: 'Portfolio or LinkedIn link present' },
  languages_listed: { labelKey: 'cvReviewLanguagesListed', label: 'Languages listed' },
  clients_projects: { labelKey: 'cvReviewClientsProjects', label: 'Clients or projects highlighted' },
  identity_clear: { labelKey: 'cvReviewIdentityClear', label: 'Name and job title clear' },
};

const WEAKNESS_LABELS = {
  summary_missing: { labelKey: 'cvReviewSummaryMissing', label: 'Summary missing' },
  summary_thin: { labelKey: 'cvReviewSummaryThin', label: 'Summary too short' },
  portfolio_missing: { labelKey: 'cvReviewPortfolioMissing', label: 'No portfolio link' },
  linkedin_missing: { labelKey: 'cvReviewLinkedinMissing', label: 'No LinkedIn profile' },
  dates_unclear: { labelKey: 'cvReviewDatesUnclear', label: 'Experience dates unclear' },
  skills_thin: { labelKey: 'cvReviewSkillsThin', label: 'Skills list is thin' },
  title_missing: { labelKey: 'cvReviewTitleMissing', label: 'Job title missing' },
  experience_thin: { labelKey: 'cvReviewExperienceThin', label: 'Only one experience entry' },
  languages_missing: { labelKey: 'cvReviewLanguagesMissing', label: 'Languages not listed' },
  tools_missing: { labelKey: 'cvReviewToolsMissing', label: 'Software tools not listed' },
  impact_thin: { labelKey: 'cvReviewImpactThin', label: 'Experience lacks measurable results' },
};

const MISSING_LABELS = {
  name: { labelKey: 'cvReviewMissingName', label: 'Full name' },
  email: { labelKey: 'cvReviewMissingEmail', label: 'Email address' },
  phone: { labelKey: 'cvReviewMissingPhone', label: 'Phone number' },
  experience: { labelKey: 'cvReviewMissingExperience', label: 'Work experience' },
  education: { labelKey: 'cvReviewMissingEducation', label: 'Education' },
  skills: { labelKey: 'cvReviewMissingSkills', label: 'Skills' },
  summary: { labelKey: 'cvReviewMissingSummary', label: 'Professional summary' },
  title: { labelKey: 'cvReviewMissingTitle', label: 'Job title' },
  portfolio: { labelKey: 'cvReviewMissingPortfolio', label: 'Portfolio link' },
  languages: { labelKey: 'cvReviewMissingLanguages', label: 'Languages' },
};

function item(id, dict, vars = {}, kind = 'strength') {
  const meta = dict[id] || { label: id, labelKey: id };
  let label = meta.label;
  for (const [k, v] of Object.entries(vars)) {
    label = label.replace(`{${k}}`, String(v));
  }
  return { id, kind, mark: kind === 'strength' ? 'ok' : kind === 'weakness' ? 'warn' : 'missing', labelKey: meta.labelKey, label };
}

function hasName(p) {
  const n = String(p?.name || '').trim();
  if (!n || n === NAME_UNCERTAIN_LABEL || n === 'Nom à compléter' || n === 'Nom à confirmer') return false;
  return n.length >= 2;
}

function hasTitle(p) {
  const t = String(p?.title || '').trim();
  if (!t || t === TITLE_UNCERTAIN_LABEL || t === 'Poste à compléter' || t === 'Title to confirm') return false;
  return t.length >= 3;
}

function hasEmail(p) {
  return EMAIL_RE.test(String(p?.email || '').trim());
}

function hasPhone(p) {
  const digits = String(p?.phone || '').replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 15;
}

function hasLinkedIn(p) {
  const v = String(p?.linkedin || '').trim();
  return v && (/linkedin\.com/i.test(v) || /^https?:\/\//i.test(v));
}

function hasPortfolio(p) {
  const v = String(p?.portfolio || p?.website || '').trim();
  return !!v && /^https?:\/\//i.test(v);
}

function hasSummary(p) {
  return String(p?.summary || '').trim().length >= 40;
}

function experienceLines(p) {
  return Array.isArray(p?.experience) ? p.experience.filter(Boolean) : [];
}

function resumeSectionCount(p, key) {
  const n = p?._resumeCounts?.[key];
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function hasExperience(p) {
  if (resumeSectionCount(p, 'experiences') > 0) return true;
  if (experienceLines(p).length > 0) return true;
  return (p?.experiences || []).length > 0;
}

function educationCount(p) {
  const n = resumeSectionCount(p, 'education');
  if (n > 0) return n;
  return Array.isArray(p?.education) ? p.education.filter(Boolean).length : 0;
}

function skillCount(p) {
  const n = p?._resumeCounts?.skills;
  if (Number.isFinite(n) && n > 0) return n;
  return (p?.skills || []).filter(Boolean).length;
}

function toolCount(p) {
  const n = p?._resumeCounts?.tools;
  if (Number.isFinite(n) && n > 0) return n;
  return (p?.tools || []).filter(Boolean).length;
}

function languageCount(p) {
  const n = p?._resumeCounts?.languages;
  if (Number.isFinite(n) && n > 0) return n;
  return (p?.languages || []).filter(Boolean).length;
}

function portfolioSignal(p) {
  return (p?.clients || []).filter(Boolean).length + (p?.projects || []).filter(Boolean).length;
}

function experienceHasDates(p) {
  const lines = experienceLines(p);
  if (lines.some((l) => YEAR_RE.test(String(l)))) return true;
  return (p?.experiences || []).some(
    (e) => e?.startDate || e?.dates || YEAR_RE.test(String(e?.endDate || ''))
  );
}

function estimateCareerYears(p) {
  const years = new Set();
  const now = new Date().getFullYear();

  for (const line of experienceLines(p)) {
    const s = String(line);
    const nums = [...s.matchAll(YEAR_RE)].map((m) => Number(m[1]));
    for (const y of nums) years.add(y);
    if (PRESENT_RE.test(s) && nums.length) years.add(now);
  }

  for (const e of p?.experiences || []) {
    if (!e || typeof e !== 'object') continue;
    for (const key of ['startDate', 'endDate', 'dates']) {
      const raw = String(e[key] || '');
      for (const m of raw.matchAll(YEAR_RE)) years.add(Number(m[1]));
      if (PRESENT_RE.test(raw)) years.add(now);
    }
  }

  if (years.size < 2) return 0;
  const sorted = [...years].sort((a, b) => a - b);
  return Math.max(1, sorted[sorted.length - 1] - sorted[0]);
}

function hasMeasurableImpact(p) {
  const metricRe =
    /\d+\s*%|\d[\d\s.,]*\s*(k|K|M|m|€|\$|£)|[€$£]\s?\d|\b\d{2,}\s*(users|clients|projects|people|personnes|projets)\b/i;
  return experienceLines(p).some((l) => metricRe.test(String(l)));
}

function buildHeadline(strengths, weaknesses, missing) {
  if (missing.length >= 3) {
    return {
      headlineKey: 'cvReviewHeadlineIncomplete',
      headline: 'Incomplete profile',
      summaryKey: 'cvReviewSummaryIncomplete',
      summary: 'Add the missing sections below before sending your CV.',
      tier: 'incomplete',
    };
  }
  if (weaknesses.length >= 3 || missing.length >= 1) {
    return {
      headlineKey: 'cvReviewHeadlineNeedsWork',
      headline: 'Needs attention',
      summaryKey: 'cvReviewSummaryNeedsWork',
      summary: 'Solid base — address the items below to strengthen your application.',
      tier: 'needs_work',
    };
  }
  if (strengths.length >= 4 && weaknesses.length <= 1) {
    return {
      headlineKey: 'cvReviewHeadlineReady',
      headline: 'Ready to send',
      summaryKey: 'cvReviewSummaryReady',
      summary: 'Your CV covers the essentials recruiters look for first.',
      tier: 'ready',
    };
  }
  return {
    headlineKey: 'cvReviewHeadlineGood',
    headline: 'Good foundation',
    summaryKey: 'cvReviewSummaryGood',
    summary: 'Key sections are present — refine the warnings below if you can.',
    tier: 'good',
  };
}

/**
 * @param {object|null} cvData
 * @param {{ finalResumeData?: object|null, resumeData?: object|null }} [opts]
 */
export function computeTrustedCvReview(cvData, opts = {}) {
  const profile = resolveChecklistProfile({
    finalResumeData: opts.finalResumeData ?? null,
    resumeData: opts.resumeData ?? null,
    cvData,
  });

  if (!profile) {
    return {
      version: TRUSTED_CV_REVIEW_V1,
      headline: 'Import your CV',
      headlineKey: 'cvReviewHeadlineImport',
      summary: 'Upload or paste your CV to get a trusted review.',
      summaryKey: 'cvReviewSummaryImport',
      tier: 'empty',
      strengths: [],
      weaknesses: [],
      missing: [item('experience', MISSING_LABELS, {}, 'missing')],
      counts: { strengths: 0, weaknesses: 0, missing: 1 },
    };
  }

  const p = normalizeCvForAtsScoring(profile);
  const identityContact = opts.finalResumeData?.identity
    ? resolveIdentityContact(opts.finalResumeData.identity)
    : null;
  if (identityContact) {
    p.email = identityContact.email || p.email;
    p.phone = identityContact.phone || p.phone;
  }
  const archetype = detectCvArchetype(p);
  const archProfile = ARCHETYPE_PROFILES[archetype] || ARCHETYPE_PROFILES.general;

  /** @type {ReturnType<typeof item>[]} */
  const strengths = [];
  /** @type {ReturnType<typeof item>[]} */
  const weaknesses = [];
  /** @type {ReturnType<typeof item>[]} */
  const missing = [];

  if (hasName(p) && hasTitle(p)) strengths.push(item('identity_clear', STRENGTH_LABELS));
  else if (!hasTitle(p)) missing.push(item('title', MISSING_LABELS, {}, 'missing'));

  if (!hasName(p)) missing.push(item('name', MISSING_LABELS, {}, 'missing'));

  const contactOk = identityContact
    ? identityContact.hasEmail && identityContact.hasPhone
    : hasEmail(p) && hasPhone(p);
  const emailOk = identityContact ? identityContact.hasEmail : hasEmail(p);
  const phoneOk = identityContact ? identityContact.hasPhone : hasPhone(p);
  if (contactOk) strengths.push(item('contact_complete', STRENGTH_LABELS));
  else {
    if (!emailOk) missing.push(item('email', MISSING_LABELS, {}, 'missing'));
    if (!phoneOk) {
      weaknesses.push({
        id: 'phone',
        kind: 'weakness',
        mark: 'warn',
        labelKey: 'cvReviewPhoneMissing',
        label: 'Phone number missing',
      });
    }
  }

  if (hasExperience(p)) {
    strengths.push(item('experience_section', STRENGTH_LABELS));
    const years = estimateCareerYears(p);
    if (years >= 2) strengths.push(item('experience_years', STRENGTH_LABELS, { n: years }));
    if (experienceHasDates(p)) strengths.push(item('experience_dates', STRENGTH_LABELS));
    else weaknesses.push(item('dates_unclear', WEAKNESS_LABELS));

    const expN = Math.max(experienceLines(p).length, (p?.experiences || []).length);
    if (expN === 1) weaknesses.push(item('experience_thin', WEAKNESS_LABELS));
    if (!hasMeasurableImpact(p) && expN >= 1) weaknesses.push(item('impact_thin', WEAKNESS_LABELS));
  } else {
    missing.push(item('experience', MISSING_LABELS, {}, 'missing'));
  }

  if (educationCount(p) > 0) strengths.push(item('education_listed', STRENGTH_LABELS));
  else if (!archProfile.educationOptional && educationCount(p) === 0) {
    missing.push(item('education', MISSING_LABELS, {}, 'missing'));
  }

  const skills = skillCount(p);
  if (skills >= 6) strengths.push(item('skills_rich', STRENGTH_LABELS, { n: skills }));
  else if (skills >= 1) {
    strengths.push(item('skills_listed', STRENGTH_LABELS));
    if (skills < 4) weaknesses.push(item('skills_thin', WEAKNESS_LABELS));
  } else {
    missing.push(item('skills', MISSING_LABELS, {}, 'missing'));
  }

  if (toolCount(p) === 0 && skills < 4) weaknesses.push(item('tools_missing', WEAKNESS_LABELS));

  const summaryLen = String(p?.summary || '').trim().length;
  if (summaryLen >= 40) strengths.push(item('summary_present', STRENGTH_LABELS));
  else if (summaryLen > 0) weaknesses.push(item('summary_thin', WEAKNESS_LABELS));
  else {
    weaknesses.push(item('summary_missing', WEAKNESS_LABELS));
    missing.push(item('summary', MISSING_LABELS, {}, 'missing'));
  }

  if (hasPortfolio(p) || hasLinkedIn(p)) strengths.push(item('portfolio_link', STRENGTH_LABELS));
  else if (archProfile.portfolioMatters) {
    weaknesses.push(item('portfolio_missing', WEAKNESS_LABELS));
    missing.push(item('portfolio', MISSING_LABELS, {}, 'missing'));
  } else {
    weaknesses.push(item('linkedin_missing', WEAKNESS_LABELS));
  }

  if (languageCount(p) >= 1) strengths.push(item('languages_listed', STRENGTH_LABELS));
  else if (!archProfile.educationOptional) weaknesses.push(item('languages_missing', WEAKNESS_LABELS));

  if (portfolioSignal(p) >= 2) strengths.push(item('clients_projects', STRENGTH_LABELS));

  if (!hasTitle(p)) weaknesses.push(item('title_missing', WEAKNESS_LABELS));

  const headline = buildHeadline(strengths, weaknesses, missing);

  const dedupe = (arr) => {
    const seen = new Set();
    return arr.filter((x) => {
      if (seen.has(x.id)) return false;
      seen.add(x.id);
      return true;
    });
  };

  return {
    version: TRUSTED_CV_REVIEW_V1,
    archetype,
    ...headline,
    strengths: dedupe(strengths).slice(0, 8),
    weaknesses: dedupe(weaknesses).slice(0, 8),
    missing: dedupe(missing).slice(0, 8),
    counts: {
      strengths: dedupe(strengths).length,
      weaknesses: dedupe(weaknesses).length,
      missing: dedupe(missing).length,
    },
  };
}

/**
 * Attach trusted review to an existing score report (keeps internal total for gates).
 * @param {object|null} report
 * @param {object|null} cvData
 * @param {object} [opts]
 */
export function enrichReportWithTrustedReview(report, cvData, opts = {}) {
  if (!report) return report;
  const cvReview = computeTrustedCvReview(cvData, opts);
  return { ...report, cvReview, trustedReview: cvReview };
}
