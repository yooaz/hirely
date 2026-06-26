/**
 * AI_RECONSTRUCTION_ENGINE — LLM extraction from cleaned OCR text → grounded Resume JSON.
 * Never invent data: ungrounded fields are dropped; low confidence → archive.
 */

import {
  AI_RECONSTRUCTION_ENGINE,
  AI_RECONSTRUCTION_CONFIDENCE_MIN,
  emptyAiResumeJson,
} from './ai-reconstruction-schema.js';
import { groundAiResumeJson, normalizeGroundingText } from './ai-reconstruction-grounding.js';
import { mergeUnsortedLines } from './no-data-loss.js';

const LLM_SCHEMA_PROMPT = `Return ONLY valid JSON matching this schema (no markdown):
{
  "identity": {
    "name": "",
    "title": "",
    "email": "",
    "phone": "",
    "location": "",
    "linkedin": "",
    "website": ""
  },
  "experience": [
    { "role": "", "company": "", "startDate": "", "endDate": "", "bullets": [] }
  ],
  "education": [],
  "skills": [],
  "tools": [],
  "languages": [],
  "projects": [],
  "clients": [],
  "awards": [],
  "publications": []
}

Rules:
- Use ONLY facts explicitly present in the CV text below.
- Do NOT invent employers, schools, dates, skills, or clients.
- Do NOT use placeholders (unknown, N/A, example).
- Empty strings and empty arrays when information is missing.
- Fix obvious OCR typos only when the correct word appears in the source context.
- experience.bullets: short lines copied or paraphrased from the CV text only.`;

function reconstructionUrl() {
  if (globalThis.HIRELY_AI_RECONSTRUCT_URL) return globalThis.HIRELY_AI_RECONSTRUCT_URL;
  if (typeof location !== 'undefined' && location.origin && location.origin !== 'null') {
    const base = location.pathname.replace(/\/[^/]*$/, '/');
    return `${location.origin}${base}api/ai-reconstruct`;
  }
  return '';
}

export function aiReconstructionConfigured() {
  return Boolean(reconstructionUrl()) && typeof fetch === 'function';
}

/**
 * @param {string} cleanedText
 * @returns {Promise<object|null>}
 */
export async function fetchAiReconstructionRaw(cleanedText) {
  const url = reconstructionUrl();
  if (!url) return null;
  const text = String(cleanedText || '').trim();
  if (text.length < 40) return null;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    const data = await res.json();
    if (!res.ok || !data?.resume) return null;
    return data;
  } catch (err) {
    console.warn('AI_RECONSTRUCTION_ENGINE fetch failed', err);
    return null;
  }
}

/**
 * @param {import('./ai-reconstruction-schema.js').AiResumeJson} resume
 */
export function aiResumeJsonToCvData(resume) {
  const r = resume || emptyAiResumeJson();
  const id = r.identity || {};
  return {
    name: id.name || '',
    title: id.title || '',
    email: id.email || '',
    phone: id.phone || '',
    linkedin: id.linkedin || '',
    portfolio: id.website || '',
    location: id.location || '',
    summary: '',
    experience: (r.experience || []).map((e) => {
      if (typeof e === 'string') return e;
      const head = [e.role, e.company, [e.startDate, e.endDate].filter(Boolean).join('–')]
        .filter(Boolean)
        .join(' — ');
      if (e.bullets?.length) return `${head}: ${e.bullets.join(' · ')}`;
      return head;
    }),
    education: [...(r.education || [])],
    skills: [...(r.skills || [])],
    tools: [...(r.tools || [])],
    languages: [...(r.languages || [])],
    projects: [...(r.projects || [])],
    clients: [...(r.clients || [])],
    awards: [...(r.awards || [])],
    publications: [...(r.publications || [])],
    exhibitions: [],
    portfolioLinks: id.website ? [id.website] : [],
    interests: [],
    unsorted: [],
    meta: {
      aiReconstruction: r.metadata || {},
    },
  };
}

/**
 * @param {object} parserCv
 * @param {import('./ai-reconstruction-schema.js').AiResumeJson} aiResume
 */
export function mergeAiResumeIntoCvData(parserCv, aiResume) {
  const ai = aiResumeJsonToCvData(aiResume);
  const out = { ...(parserCv || {}) };
  for (const key of ['name', 'title', 'email', 'phone', 'linkedin', 'portfolio', 'location']) {
    const v = String(ai[key] || '').trim();
    if (v && (!out[key] || String(out[key]).length < 2)) out[key] = v;
  }
  for (const key of [
    'experience',
    'education',
    'skills',
    'tools',
    'languages',
    'projects',
    'clients',
    'awards',
    'publications',
  ]) {
    const arr = Array.isArray(ai[key]) ? ai[key].filter(Boolean) : [];
    if (arr.length && (!out[key] || !out[key].length)) out[key] = arr;
  }
  out.meta = { ...(out.meta || {}), aiReconstruction: aiResume?.metadata || {} };
  return out;
}

/**
 * @param {string} cleanedText
 * @param {object} [opts]
 */
export async function runAiReconstructionEngine(cleanedText, opts = {}) {
  const text = String(cleanedText || '').trim();
  const empty = emptyAiResumeJson();

  if (text.length < 40) {
    return {
      engine: AI_RECONSTRUCTION_ENGINE,
      resume: empty,
      confidence: 0,
      archive: [{ text, reason: 'AI_RECONSTRUCTION_INPUT_TOO_SHORT' }],
      usedLlm: false,
      lowConfidence: true,
    };
  }

  if (opts.skipLlm === true || (!opts.forceLlm && !aiReconstructionConfigured())) {
    return {
      engine: AI_RECONSTRUCTION_ENGINE,
      resume: empty,
      confidence: 0,
      archive: [{ text, reason: 'AI_RECONSTRUCTION_NOT_CONFIGURED' }],
      usedLlm: false,
      lowConfidence: true,
    };
  }

  const api = await fetchAiReconstructionRaw(text);
  const rawResume = api?.resume || api?.resumeJson || null;
  if (!rawResume) {
    return {
      engine: AI_RECONSTRUCTION_ENGINE,
      resume: empty,
      confidence: 0,
      archive: [{ text, reason: 'AI_RECONSTRUCTION_LLM_FAILED' }],
      usedLlm: true,
      lowConfidence: true,
    };
  }

  const grounded = groundAiResumeJson(rawResume, text);
  const resume = {
    ...grounded.resume,
    metadata: {
      engine: AI_RECONSTRUCTION_ENGINE,
      confidence: grounded.confidence,
      fieldScores: grounded.fieldScores,
      archive: [],
      lowConfidence: grounded.confidence < AI_RECONSTRUCTION_CONFIDENCE_MIN,
      source: api?.source || 'llm',
      droppedCount: grounded.dropped?.length ?? 0,
      neverHallucinate: true,
    },
  };

  let archive = [];
  if (grounded.confidence < AI_RECONSTRUCTION_CONFIDENCE_MIN) {
    archive = [
      {
        text,
        reason: 'AI_RECONSTRUCTION_LOW_CONFIDENCE',
        confidence: grounded.confidence,
      },
    ];
    resume.metadata.archive = archive;
    resume.metadata.lowConfidence = true;
  }

  console.log('AI_RECONSTRUCTION_ENGINE', {
    confidence: grounded.confidence,
    lowConfidence: resume.metadata.lowConfidence,
    dropped: grounded.dropped?.length ?? 0,
    experience: resume.experience?.length ?? 0,
  });

  return {
    engine: AI_RECONSTRUCTION_ENGINE,
    resume,
    confidence: grounded.confidence,
    archive,
    fieldScores: grounded.fieldScores,
    dropped: grounded.dropped,
    usedLlm: true,
    lowConfidence: grounded.confidence < AI_RECONSTRUCTION_CONFIDENCE_MIN,
    sourceNormLength: normalizeGroundingText(text).length,
  };
}

/**
 * Apply archive lines to structured resume when AI confidence is low.
 * @param {object} structured
 * @param {object} aiResult
 */
export function applyAiReconstructionArchive(structured, aiResult) {
  if (!structured || !aiResult?.archive?.length) return structured;
  const texts = aiResult.archive.map((a) => a.text).filter(Boolean);
  structured.unsorted = mergeUnsortedLines(structured.unsorted, texts);
  structured.unsortedArchive = [
    ...(structured.unsortedArchive || []),
    ...aiResult.archive,
  ];
  structured.metadata = {
    ...(structured.metadata || {}),
    aiReconstruction: aiResult,
    aiReconstructionArchive: aiResult.archive,
  };
  return structured;
}

export {
  AI_RECONSTRUCTION_ENGINE,
  AI_RECONSTRUCTION_CONFIDENCE_MIN,
  emptyAiResumeJson,
} from './ai-reconstruction-schema.js';
