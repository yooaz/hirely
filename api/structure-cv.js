/**
 * Structure OCR/noisy CV text into Hirely cvData JSON via Gemini (optional).
 * POST JSON: { "text": "..." }
 */

function json(res, body, status = 200) {
  res.status(status);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

const SCHEMA = `Return ONLY valid JSON:
{
  "name": "",
  "title": "",
  "email": "",
  "phone": "",
  "linkedin": "",
  "portfolio": "",
  "location": "",
  "summary": "",
  "experience": ["role — company — dates — details"],
  "education": [],
  "skills": [],
  "tools": [],
  "languages": [],
  "clients": []
}
Use only facts from the input. No placeholders. Empty strings/arrays if unknown.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return json(res, { ok: true, usage: 'POST { text }' });
  }

  const API_KEY = process.env.GEMINI_API_KEY;
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const text = String(body.text || '').trim();

  if (!text || text.length < 30) {
    return json(res, { error: 'text too short' }, 400);
  }

  if (!API_KEY) {
    return json(res, { error: 'GEMINI_API_KEY not configured', cvData: null }, 503);
  }

  const prompt = `You structure CV text extracted by OCR. Fix obvious OCR errors in your output but do not invent employers, dates, or degrees.

${SCHEMA}

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
          generationConfig: { temperature: 0.15, maxOutputTokens: 8192 },
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
    const cvData = match ? JSON.parse(match[0]) : null;
    if (!cvData) return json(res, { error: 'invalid JSON from model' }, 502);

    return json(res, {
      cvData,
      source: 'gemini-structure',
      timingMs: Date.now() - t0,
    });
  } catch (e) {
    return json(res, { error: e.message || 'structure failed' }, 500);
  }
}
