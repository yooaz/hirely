/**
 * Block 10 — Staged prompt architecture for Gemini (single-call, multi-stage instructions).
 */

export const ANTI_HALLUCINATION_RULES = `
ANTI-HALLUCINATION (mandatory):
- Do NOT invent companies, employers, schools, degrees, dates, job titles, or metrics.
- Only use facts present in the CV input; fix obvious OCR typos carefully.
- If impact is missing, use "[add metric]" in a bullet — never fabricate numbers.
- Preserve real client names, tools, and skills from the source text.
- If a section is missing in source, write a minimal honest placeholder — do not fake employers.
`.trim();

export const CREATIVE_RECRUITER_RULES = `
CREATIVE PROFILE (designers, illustrators, art directors, branding):
- Prioritize: clients, campaigns, visual identity, branding, editorial, posters, packaging, art direction, print, portfolio, tools.
- Use recruiter language for creative industries (scope, clients, deliverables, production-ready).
- Shorter profile; stronger achievements and client proof in the first screen.
- Lead experience bullets with deliverable type + client/brand when known.
`.trim();

export const JOB_DESCRIPTION_RULES = `
JOB DESCRIPTION (when provided):
- Extract target keywords and mirror them naturally in summary and skills (only where truthful).
- Compare CV vs role; note keyword gaps in weaknesses / priorityFixes — do not invent experience to match.
- Reorder skills to surface role-relevant terms first.
- Tailor cover letter opening to the role and 2–3 real CV proof points.
`.trim();

export const RESPONSE_SCHEMA_HINT = `
Return ONLY valid JSON (no markdown fences) with this shape:
{
  "cleanedText": "string — Stage 1 OCR cleanup",
  "cvModel": {
    "name": "", "title": "",
    "contact": {"email":"","phone":"","portfolio":"","linkedin":"","location":""},
    "profile": "",
    "experience": [{"role":"","company":"","dates":"","bullets":[]}],
    "education": [], "skills": [], "tools": [], "achievements": [], "languages": [], "clients": []
  },
  "scores": {
    "global": 0, "ats": 0, "recruiter": 0, "linkedin": 0, "impact": 0, "readability": 0, "visualHierarchy": 0
  },
  "audit": {
    "recruiterImpression": "",
    "atsCompatibility": "",
    "strengths": [],
    "weaknesses": [],
    "priorityFixes": [],
    "whatRecruitersSeeFirst": "",
    "whatHurtsInterviewChances": []
  },
  "linkedin": {"headline": "", "about": ""},
  "coverLetter": ""
}
`.trim();

/**
 * Build one Gemini prompt with explicit stages (1–5).
 */
export function buildGeminiPrompt({ cv = '', job = '', jobDescription = '' } = {}) {
  const roleBlock = jobDescription
    ? `TARGET ROLE:\n${job}\n\nJOB DESCRIPTION:\n${jobDescription}`
    : job
      ? `TARGET ROLE:\n${job}`
      : 'TARGET ROLE: Not specified — infer best positioning from CV only.';

  return `You are Hirely: senior recruiter, ATS specialist, LinkedIn strategist, and editorial CV designer.

Work through these stages IN ORDER inside your reasoning, then output ONE JSON object.

STAGE 1 — CLEAN OCR TEXT
- Fix broken line breaks, duplicate headers, and obvious OCR errors.
- Preserve all factual content; do not add employers or credentials.

STAGE 2 — EXTRACT STRUCTURED CV DATA
- Map to cvModel: name, title, contact, profile, experience, education, skills, tools, achievements, languages, clients.
- Dates and companies must come from source only.

STAGE 3 — SCORE LIKE A SENIOR RECRUITER
- Fill scores (0–100): global, ats, recruiter, linkedin, impact, readability, visualHierarchy.
- Fill audit: recruiterImpression, atsCompatibility, strengths, weaknesses, priorityFixes, whatRecruitersSeeFirst, whatHurtsInterviewChances (array).

STAGE 4 — REWRITE PREMIUM CV
- Polish profile and bullets for recruiter scan; keep facts; use [add metric] where needed.

STAGE 5 — LINKEDIN + LETTER
- linkedin.headline (≤ 120 chars), linkedin.about (2 short paragraphs).
- coverLetter: professional, role-specific, grounded in CV facts only.

${ANTI_HALLUCINATION_RULES}

${CREATIVE_RECRUITER_RULES}

${jobDescription ? JOB_DESCRIPTION_RULES : ''}

${roleBlock}

CV INPUT (may be OCR-damaged):
${cv}

${RESPONSE_SCHEMA_HINT}`;
}

export default {
  ANTI_HALLUCINATION_RULES,
  CREATIVE_RECRUITER_RULES,
  JOB_DESCRIPTION_RULES,
  RESPONSE_SCHEMA_HINT,
  buildGeminiPrompt
};
