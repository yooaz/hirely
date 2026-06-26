/**
 * AI_RECONSTRUCTION_ENGINE — Gemini structuring with server-side grounding.
 * POST JSON: { "text": "<cleaned OCR text>" }
 */

import { groundAiResumeJson } from '../src/core/parsing/ai-reconstruction-grounding.js';

const LLM_SCHEMA = `Return ONLY valid JSON matching this schema:
{
  "identity": { "name": "", "title": "", "email": "", "phone": "", "location": "", "linkedin": "", "website": "" },
  "experience": [{ "role": "", "company": "", "startDate": "", "endDate": "", "bullets": [] }],
  "education": [],
  "skills": [],
  "tools": [],
  "languages": [],
  "projects": [],
  "clients": [],
  "awards": [],
  "publications": []
}
Rules: ONLY facts from the CV text. No invented data. No placeholders.`;

function json(res, body, status = 200) {
  res.status(status);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return json(res, { ok: true, engine: 'AI_RECONSTRUCTION_ENGINE', usage: 'POST { text }' });
  }

  const API_KEY = process.env.GEMINI_API_KEY;
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const text = String(body.text || '').trim();

  if (!text || text.length < 30) {
    return json(res, { error: 'text too short' }, 400);
  }

  if (!API_KEY) {
    return json(res, { error: 'GEMINI_API_KEY not configured', resume: null }, 503);
  }

  const prompt = `You are the AI_RECONSTRUCTION_ENGINE for Hirely. Reconstruct a CV into JSON using ONLY the source text.

${LLM_SCHEMA}

CV text:
${text.slice(0, 120000)}`;

  try {
    const t0 = Date.now();
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 8192 },
        }),
      }
    );
    const data = await r.json();
    if (!r.ok) {
      return json(res, { error: data?.error?.message || 'Gemini error' }, 502);
    }
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return json(res, { error: 'invalid JSON from model' }, 502);

    const parsed = JSON.parse(match[0]);
    const grounded = groundAiResumeJson(parsed, text);

    return json(res, {
      engine: 'AI_RECONSTRUCTION_ENGINE',
      resume: {
        ...grounded.resume,
        metadata: {
          engine: 'AI_RECONSTRUCTION_ENGINE',
          confidence: grounded.confidence,
          fieldScores: grounded.fieldScores,
          droppedCount: grounded.dropped?.length ?? 0,
          neverHallucinate: true,
          source: 'gemini-ai-reconstruct',
        },
      },
      confidence: grounded.confidence,
      dropped: grounded.dropped,
      timingMs: Date.now() - t0,
    });
  } catch (e) {
    return json(res, { error: e.message || 'ai reconstruct failed' }, 500);
  }
}
