import {
  cleanCvText as cleanInputText,
  buildFallbackFromCv as buildFallback,
  normalizeAiModel as normalizeModel,
} from '../lib/cv-parser.js';

function safeJson(res, payload, status = 200) {
  res.status(status);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.end(JSON.stringify(payload));
}

function mergeJobFields(job = '', jobDescription = '') {
  const parts = [cleanInputText(job), cleanInputText(jobDescription)].filter(Boolean);
  return parts.join('\n\n');
}

const GEMINI_TIMEOUT_MS = 55000;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return safeJson(res, { ok: true, message: 'Hirely API is alive. Use POST with { cv, job, jobDescription }.' });
  }

  let cv = '';
  let job = '';

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    cv = cleanInputText(body.cv || '');
    job = mergeJobFields(body.job || '', body.jobDescription || '');

    if (!cv || cv.length < 40) {
      const fallback = buildFallback(cv, job);
      fallback.notice = 'Not enough CV text was provided. Paste or import more content for a stronger result.';
      return safeJson(res, fallback);
    }

    const API_KEY = process.env.GEMINI_API_KEY;
    if (!API_KEY) {
      const fallback = buildFallback(cv, job);
      fallback.notice = 'Gemini is not connected. Safe expert fallback used.';
      return safeJson(res, fallback);
    }

    const schema = `Return ONLY valid JSON with this exact shape:
{
  "score": 0,
  "atsScore": 0,
  "recruiterScore": 0,
  "linkedinScore": 0,
  "impactScore": 0,
  "readabilityScore": 0,
  "verdict": "",
  "topFixes": [],
  "diagnosis": {
    "positioning": "",
    "recruiterView": "",
    "atsView": "",
    "designView": ""
  },
  "premiumCV": {
    "name": "",
    "title": "",
    "contact": "",
    "summary": "",
    "experience": [{"role":"","company":"","dates":"","bullets":[]}],
    "education": [],
    "skills": [],
    "tools": [],
    "languages": [],
    "clients": [],
    "achievements": [],
    "interests": []
  },
  "linkedin": {"headline":"","about":""},
  "coverLetter": "",
  "cleanedText": ""
}`;

    const prompt = `You are Hirely: a top 1% senior recruiter, ATS specialist, LinkedIn strategist and editorial CV designer.

Mission:
Create a professional, publishable CV output from the user's CV. The input may be OCR-damaged. First reconstruct meaning, remove noise, and structure the information. Use ONLY facts present in the CV text. Never invent employers, degrees, or metrics. If a field is missing, leave it empty or omit that section — do NOT use placeholder text like "Candidate Name", "Company", "Dates", "[add metric]", or "Professional Profile".

Evaluation principles:
- Recruiters scan in 6–8 seconds.
- Top third must communicate role, credibility, proof and keywords.
- ATS-safe means standard headings, readable text, dates, skills and no visual-only information.
- Premium design means spacing, hierarchy and typography, not decorative clutter.

Target role / job description:
${job || 'Not specified'}

CV input:
${cv}

${schema}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

    let r;
    try {
      r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.22, maxOutputTokens: 8192 },
        }),
      });
    } finally {
      clearTimeout(timer);
    }

    const data = await r.json();
    if (!r.ok) {
      const fallback = buildFallback(cv, job);
      fallback.notice = 'Gemini API error. Safe expert fallback used.';
      fallback.apiError = data?.error?.message || 'Unknown API error';
      return safeJson(res, fallback);
    }

    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      const match = cleaned.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : null;
    }

    if (!parsed || typeof parsed !== 'object') {
      const fallback = buildFallback(cv, job);
      fallback.notice = 'AI returned an unreadable response. Safe expert fallback used.';
      return safeJson(res, fallback);
    }

    const normalized = normalizeModel(parsed, cv, job);
    normalized.source = 'gemini';
    if (normalized.cleanedText) normalized.cleanedText = cleanInputText(normalized.cleanedText);
    return safeJson(res, normalized);
  } catch (e) {
    const fallback = buildFallback(cv, job);
    fallback.notice =
      e?.name === 'AbortError'
        ? 'AI request timed out. Safe expert fallback used.'
        : 'Unexpected API failure. Safe fallback used.';
    fallback.error = e?.message || String(e);
    return safeJson(res, fallback);
  }
}
