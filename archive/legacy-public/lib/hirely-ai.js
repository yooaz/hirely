/**
 * Block 10 — Analyze envelope, Gemini parse, fallback orchestration, client coercion.
 */
import CVE from './cv-engine.js';
import { buildGeminiPrompt } from './hirely-prompts.js';
import { sanitizeApiWarnings } from './hirely-security.js';

const {
  cleanText,
  scoreCV,
  buildFullScoreReport,
  buildStructuredFromFallback,
  premiumCVFromModel,
  normalizeCVModel,
  applyCreativeOptimization,
  modelFromPremiumCV,
  isCreativeProfile,
  FALLBACK_NOTICE,
  extractJobKeywords,
  analyzeJobFit,
  applyJobFitToModel,
  buildLocalLinkedIn,
  buildLocalCoverLetter
} = CVE;

export { buildGeminiPrompt, FALLBACK_NOTICE };

export function mergeJobFields(job = '', jobDescription = '') {
  return [cleanText(job), cleanText(jobDescription)].filter(Boolean).join('\n\n');
}

export function parseGeminiJson(raw = '') {
  const text = String(raw || '').replace(/```json/gi, '').replace(/```/g, '').trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function cvModelToApiCv(model = {}) {
  const m = normalizeCVModel(model);
  return {
    name: m.name,
    title: m.title,
    contact: { ...m.contact },
    profile: m.profile,
    experience: m.experience.map(e => ({
      role: e.role || e.title,
      company: e.company,
      dates: e.dates || e.date,
      bullets: [...(e.bullets || [])]
    })),
    education: [...(m.education || [])],
    skills: [...(m.skills || [])],
    tools: [...(m.tools || [])],
    achievements: [...(m.achievements || [])],
    languages: [...(m.languages || [])],
    clients: [...(m.clients || [])]
  };
}

function scoresFromReport(report = {}, geminiScores = null) {
  const g = geminiScores || {};
  const pick = (key, legacy) => {
    const n = Number(g[key] ?? legacy);
    return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : legacy;
  };
  return {
    global: pick('global', report.score),
    ats: pick('ats', report.atsScore),
    recruiter: pick('recruiter', report.recruiterScore),
    linkedin: pick('linkedin', report.linkedinScore),
    impact: pick('impact', report.impactScore),
    readability: pick('readability', report.readabilityScore),
    visualHierarchy: pick('visualHierarchy', report.visualScore ?? report.visualHierarchyScore)
  };
}

function auditFromReport(report = {}, geminiAudit = null) {
  const a = geminiAudit || {};
  const arr = (v, fallback) =>
    Array.isArray(v) && v.length ? v.map(String) : fallback;
  return {
    recruiterImpression:
      String(a.recruiterImpression || report.whatRecruitersSeeFirst || report.verdict || '').trim(),
    atsCompatibility:
      String(a.atsCompatibility || report.diagnosis?.atsView || '').trim(),
    strengths: arr(a.strengths, report.strengths || []),
    weaknesses: arr(a.weaknesses, report.weaknesses || []),
    priorityFixes: arr(a.priorityFixes, report.topFixes || []),
    whatRecruitersSeeFirst:
      String(a.whatRecruitersSeeFirst || report.whatRecruitersSeeFirst || '').trim(),
    whatHurtsInterviewChances: arr(
      a.whatHurtsInterviewChances,
      report.hurtsInterview || []
    )
  };
}

function mergeGeminiCvModel(gemini = {}, cv = '', job = '') {
  const legacy = gemini?.cvModel
    ? gemini.cvModel
    : gemini?.premiumCV
      ? modelFromPremiumCV(gemini.premiumCV)
      : modelFromPremiumCV(gemini);

  let model = normalizeCVModel(legacy, cv, job);
  model = applyCreativeOptimization(model, cv, job);
  return model;
}

/**
 * Build full API response envelope (+ legacy flat fields for existing UI).
 */
export function buildAnalyzeEnvelope({
  mode = 'fallback',
  cv = '',
  job = '',
  jobDescription = '',
  gemini = null,
  warnings = [],
  notice = null
} = {}) {
  const text = cleanText(gemini?.cleanedText || cv);
  const mergedJob = mergeJobFields(job, jobDescription);
  const report = buildFullScoreReport(text, mergedJob);

  let model = gemini ? mergeGeminiCvModel(gemini, text, mergedJob) : buildStructuredFromFallback(text, mergedJob);
  model = applyCreativeOptimization(model, text, mergedJob);

  if (jobDescription) {
    const keywords = extractJobKeywords(jobDescription, job);
    const fit = analyzeJobFit(text, keywords);
    model = applyJobFitToModel(model, fit, job);
    if (fit.missing.length) {
      warnings.push(
        `Keyword gap vs job description: consider adding ${fit.missing.slice(0, 5).join(', ')} where truthful.`
      );
    }
  }

  const scores = scoresFromReport(report, gemini?.scores);
  const audit = auditFromReport(report, gemini?.audit);
  const linkedin = Object.assign(
    {},
    buildLocalLinkedIn(model, mergedJob),
    gemini?.linkedin || {}
  );
  const letter =
    String(gemini?.coverLetter || '').trim() ||
    buildLocalCoverLetter(model, mergedJob, jobDescription);

  const cvApi = cvModelToApiCv(model);
  const premiumCV = premiumCVFromModel(model);
  const finalNotice =
    notice ||
    (mode === 'fallback' ? FALLBACK_NOTICE : warnings[0] || '');

  const envelope = {
    success: true,
    mode: mode === 'gemini' ? 'gemini' : 'fallback',
    scores,
    audit,
    cv: cvApi,
    linkedin: {
      headline: String(linkedin.headline || '').trim(),
      about: String(linkedin.about || '').trim()
    },
    letter,
    warnings: sanitizeApiWarnings(warnings),
    cleanedText: text,
    notice: finalNotice,
    jobFit: jobDescription
      ? analyzeJobFit(text, extractJobKeywords(jobDescription, job))
      : null,
    // —— legacy flat fields (UI + smoke tests) ——
    ok: true,
    score: scores.global,
    atsScore: scores.ats,
    recruiterScore: scores.recruiter,
    linkedinScore: scores.linkedin,
    impactScore: scores.impact,
    readabilityScore: scores.readability,
    visualScore: scores.visualHierarchy,
    visualHierarchyScore: scores.visualHierarchy,
    recruiterConfidence: report.recruiterConfidence,
    interviewReadiness: report.interviewReadiness,
    credibilityLevel: report.credibilityLevel,
    credibilityLabel: report.credibilityLabel,
    visualHierarchy: report.visualHierarchy,
    strengths: audit.strengths,
    weaknesses: audit.weaknesses,
    firstImpression: report.firstImpression,
    hurtsInterview: audit.whatHurtsInterviewChances,
    whatRecruitersSeeFirst: audit.whatRecruitersSeeFirst,
    extractionNote: report.extractionNote,
    verdict: audit.recruiterImpression || report.verdict,
    topFixes: audit.priorityFixes,
    diagnosis: {
      positioning: report.diagnosis?.positioning || '',
      recruiterView: audit.recruiterImpression || report.diagnosis?.recruiterView || '',
      atsView: audit.atsCompatibility || report.diagnosis?.atsView || '',
      designView: report.diagnosis?.designView || ''
    },
    premiumCV,
    cvModel: model,
    coverLetter: letter,
    source: mode === 'gemini' ? 'gemini' : 'fallback'
  };

  return envelope;
}

export function buildFallbackEnvelope(cv = '', job = '', jobDescription = '', extraWarnings = []) {
  const warnings = [...extraWarnings];
  if (!cleanText(cv) || cleanText(cv).length < 40) {
    warnings.push('Add more CV content for a fuller professional draft.');
  }
  return buildAnalyzeEnvelope({
    mode: 'fallback',
    cv,
    job,
    jobDescription,
    warnings,
    notice: FALLBACK_NOTICE
  });
}

/**
 * Safe client-side normalization: handles new envelope, legacy body, partial/malformed data.
 */
export function coerceAnalyzeResponse(raw, cv = '', job = '', jobDescription = '') {
  if (raw == null) {
    return buildFallbackEnvelope(cv, job, jobDescription, ['Empty API response — local draft used.']);
  }

  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      return buildFallbackEnvelope(cv, job, jobDescription, ['Non-JSON API response — local draft used.']);
    }
  }

  if (typeof raw !== 'object') {
    return buildFallbackEnvelope(cv, job, jobDescription, ['Invalid API response — local draft used.']);
  }

  // Already new envelope
  if (raw.success === true && raw.mode && raw.cv && raw.scores) {
    if (!raw.premiumCV && raw.cv) {
      const model = normalizeCVModel(
        {
          name: raw.cv.name,
          title: raw.cv.title,
          contact: raw.cv.contact,
          profile: raw.cv.profile,
          experience: raw.cv.experience,
          education: raw.cv.education,
          skills: raw.cv.skills,
          tools: raw.cv.tools,
          achievements: raw.cv.achievements,
          languages: raw.cv.languages,
          clients: raw.cv.clients
        },
        cv,
        mergeJobFields(job, jobDescription)
      );
      raw.premiumCV = premiumCVFromModel(model);
      raw.cvModel = model;
    }
    raw.coverLetter = raw.letter || raw.coverLetter;
    return raw;
  }

  // Legacy API body → re-wrap
  if (raw.premiumCV || raw.cvModel || raw.score != null) {
    const mergedJob = mergeJobFields(job, jobDescription);
    const text = cleanText(raw.cleanedText || cv);
    const model = raw.cvModel
      ? normalizeCVModel(raw.cvModel, text, mergedJob)
      : modelFromPremiumCV(raw.premiumCV);
    const geminiShaped = {
      cleanedText: text,
      cvModel: model,
      scores: {
        global: raw.score,
        ats: raw.atsScore,
        recruiter: raw.recruiterScore,
        linkedin: raw.linkedinScore,
        impact: raw.impactScore,
        readability: raw.readabilityScore,
        visualHierarchy: raw.visualScore
      },
      audit: {
        recruiterImpression: raw.verdict,
        atsCompatibility: raw.diagnosis?.atsView,
        strengths: raw.strengths,
        weaknesses: raw.weaknesses,
        priorityFixes: raw.topFixes,
        whatRecruitersSeeFirst: raw.whatRecruitersSeeFirst,
        whatHurtsInterviewChances: raw.hurtsInterview
      },
      linkedin: raw.linkedin,
      coverLetter: raw.coverLetter
    };
    return buildAnalyzeEnvelope({
      mode: raw.source === 'gemini' ? 'gemini' : 'fallback',
      cv: text,
      job,
      jobDescription,
      gemini: geminiShaped,
      warnings: raw.warnings || [],
      notice: raw.notice
    });
  }

  return buildFallbackEnvelope(cv, job, jobDescription, ['Unrecognized API shape — local draft used.']);
}

export default {
  buildGeminiPrompt,
  parseGeminiJson,
  mergeJobFields,
  buildAnalyzeEnvelope,
  buildFallbackEnvelope,
  coerceAnalyzeResponse,
  FALLBACK_NOTICE
};
