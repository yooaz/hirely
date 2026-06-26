/**
 * Recruiter checklist / ATS score data source.
 * Reads sanitized resumeData (canonical) — not review-gated display cvData.
 */

import { normalizeResumeData, normalizeCvDataForTemplate, resumeDataToCvData } from '../resume-data.js';
import { FORBIDDEN_TEMPLATE_CV_KEYS } from '../pipeline/hirely-flow-lock.js';

const ACTION_LINE_RE =
  /\b(created|built|designed|managed|led|delivered|developed|implemented|launched|optimized|improved|increased|reduced|grew|achieved|collaborated|créé|conçu|dirigé|géré|livré|augmenté|réduit)\b/i;

function experienceLinesForScoring(experiences = []) {
  return (experiences || [])
    .filter((e) => e && (e.role || e.company || (e.bullets || []).length))
    .map((e) => {
      const dates = String(e.dates || [e.startDate, e.endDate].filter(Boolean).join('–') || '').trim();
      const head = [e.role, e.company, dates].map((x) => String(x || '').trim()).filter(Boolean).join(' — ');
      const bullets = (e.bullets || []).map((b) => String(b || '').trim()).filter(Boolean);
      const desc = String(e.rewrittenDescription || e.description || '').trim();
      const body = bullets.length ? bullets.join(' · ') : desc;
      if (!body) return head;
      if (ACTION_LINE_RE.test(body)) return `${head}: ${body}`;
      return `${head}: Delivered ${body.charAt(0).toLowerCase()}${body.slice(1)}`;
    })
    .filter(Boolean);
}

export function resumeDataSectionCounts(rd) {
  if (!rd || typeof rd !== 'object') {
    return { experiences: 0, education: 0, skills: 0, tools: 0, languages: 0 };
  }
  const experiences = (rd.experiences || []).filter((e) => {
    if (!e) return false;
    if (typeof e === 'string') return e.trim().length > 0;
    return !!(e.role || e.company || (e.bullets || []).filter(Boolean).length);
  }).length;
  const education = (rd.education || []).filter((e) => {
    if (!e) return false;
    if (typeof e === 'string') return e.trim().length > 0;
    return !!(e.school || e.degree || e.field || e.dates || e.startDate || e.endDate);
  }).length;
  const skills = (rd.skills || []).filter((s) => String(s || '').trim()).length;
  const tools = (rd.tools || []).filter((s) => String(s || '').trim()).length;
  const languages = (rd.languages || []).filter((s) => String(s || '').trim()).length;
  return { experiences, education, skills, tools, languages };
}

function isLockedFinalResumeDisplay(data) {
  return !!(
    data &&
    typeof data === 'object' &&
    (data.quality || data.metaSafe || data.suggestions)
  );
}

function finalResumeDisplayToResumeData(frd) {
  return {
    identity: { ...(frd.identity || {}) },
    summary: String(frd.summary || '').trim(),
    experiences: Array.isArray(frd.experiences) ? frd.experiences : [],
    education: Array.isArray(frd.education) ? frd.education : [],
    skills: Array.isArray(frd.skills) ? frd.skills : [],
    tools: Array.isArray(frd.tools) ? frd.tools : [],
    languages: Array.isArray(frd.languages) ? frd.languages : [],
    clients: Array.isArray(frd.clients) ? frd.clients : [],
    projects: Array.isArray(frd.projects) ? frd.projects : [],
    unsorted: Array.isArray(frd.suggestions) ? frd.suggestions : [],
    meta: frd.metaSafe || frd.meta || {},
  };
}

/**
 * Flat cvData profile for recruiter checklist and ATS scoring.
 * Prefers finalResumeData (sanitized lock); falls back to resumeData then cvData.
 *
 * @param {{ finalResumeData?: object|null, resumeData?: object|null, cvData?: object|null }} [sources]
 * @returns {object|null}
 */
function listLines(arr) {
  const out = [];
  for (const x of Array.isArray(arr) ? arr : []) {
    if (x && typeof x === 'object') {
      const degree = String(x.degree || x.field || '').trim();
      const school = String(x.school || x.institution || '').trim();
      const dates = String(
        x.dates || [x.startDate, x.endDate].filter(Boolean).join('–') || ''
      ).trim();
      const line = [degree, school, dates].filter(Boolean).join(' — ');
      if (line) out.push(line);
    } else {
      const t = String(x || '').trim();
      if (t) out.push(t);
    }
  }
  return out;
}

export function resolveChecklistProfile(sources = {}) {
  try {
    return resolveChecklistProfileInner(sources);
  } catch {
    return null;
  }
}

function resolveChecklistProfileInner({ finalResumeData, resumeData, cvData } = {}) {
  let profile = null;
  let scoreExperienceLines = null;
  let scoreEducationLines = null;
  let resumeCounts = null;
  const canonical = finalResumeData || resumeData;

  if (canonical && typeof canonical === 'object') {
    if (finalResumeData && isLockedFinalResumeDisplay(finalResumeData)) {
      const shaped = finalResumeDisplayToResumeData(finalResumeData);
      profile = resumeDataToCvData(shaped, { skipNormalize: true });
      scoreExperienceLines = experienceLinesForScoring(shaped.experiences);
      scoreEducationLines = listLines(shaped.education);
      resumeCounts = resumeDataSectionCounts(shaped);
    } else {
      const normalized = normalizeResumeData(canonical);
      profile = resumeDataToCvData(normalized);
      scoreExperienceLines = experienceLinesForScoring(normalized.experiences);
      scoreEducationLines = listLines(normalized.education);
      resumeCounts = resumeDataSectionCounts(normalized);
    }
  }

  if (!profile && cvData && typeof cvData === 'object') {
    profile = { ...cvData };
    scoreExperienceLines = listLines(cvData.experience);
    scoreEducationLines = listLines(cvData.education);
    resumeCounts = {
      experiences: scoreExperienceLines.length,
      education: scoreEducationLines.length,
      skills: listLines(cvData.skills).length,
      tools: listLines(cvData.tools).length,
      languages: listLines(cvData.languages).length,
    };
  }

  if (!profile) return null;

  if (cvData && typeof cvData === 'object' && !finalResumeData) {
    profile.name = profile.name || cvData.name;
    profile.title = profile.title || cvData.title;
    profile.email = profile.email || cvData.email;
    profile.phone = profile.phone || cvData.phone;
    profile.location = profile.location || cvData.location;
    profile.linkedin = profile.linkedin || cvData.linkedin;
    profile.portfolio = profile.portfolio || cvData.portfolio;
    profile.summary = profile.summary || cvData.summary;

    if (!(profile.experience || []).filter(Boolean).length && (cvData.experience || []).filter(Boolean).length) {
      profile.experience = cvData.experience;
    }
    if (!(profile.education || []).filter(Boolean).length && (cvData.education || []).filter(Boolean).length) {
      profile.education = cvData.education;
    }
    if (!(profile.skills || []).filter(Boolean).length && (cvData.skills || []).filter(Boolean).length) {
      profile.skills = cvData.skills;
    }
    if (!(profile.tools || []).filter(Boolean).length && (cvData.tools || []).filter(Boolean).length) {
      profile.tools = cvData.tools;
    }
    if (!(profile.languages || []).filter(Boolean).length && (cvData.languages || []).filter(Boolean).length) {
      profile.languages = cvData.languages;
    }
  }

  const clean = profile._fromResumeData
    ? { ...profile }
    : normalizeCvDataForTemplate(profile);
  for (const key of FORBIDDEN_TEMPLATE_CV_KEYS) {
    delete clean[key];
  }
  if (scoreExperienceLines?.length) clean.experience = scoreExperienceLines;
  if (scoreEducationLines?.length) clean.education = scoreEducationLines;
  if (resumeCounts) clean._resumeCounts = resumeCounts;
  return clean;
}
