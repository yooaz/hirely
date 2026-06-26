/**
 * Vercel serverless — Google Cloud Vision OCR (DOCUMENT_TEXT_DETECTION).
 * Env: GOOGLE_CLOUD_VISION_API_KEY or GEMINI_API_KEY unused here.
 * POST multipart field `file` (image/png, jpeg, or application/pdf first page as image from client).
 */

function json(res, body, status = 200) {
  res.status(status);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return req.body;
  }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks);
}

function parseMultipart(buffer, boundary) {
  const parts = [];
  const b = `--${boundary}`;
  const sections = buffer.toString('binary').split(b).slice(1, -1);
  for (const section of sections) {
    const idx = section.indexOf('\r\n\r\n');
    if (idx < 0) continue;
    const head = section.slice(0, idx);
    const body = section.slice(idx + 4).replace(/\r\n--$/, '').replace(/\r\n$/, '');
    const nameMatch = /name="([^"]+)"/.exec(head);
    const fileMatch = /filename="([^"]+)"/.exec(head);
    parts.push({
      name: nameMatch?.[1] || 'file',
      filename: fileMatch?.[1],
      data: Buffer.from(body, 'binary'),
    });
  }
  return parts;
}

async function visionOcr(base64, apiKey) {
  const res = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [
        {
          image: { content: base64 },
          imageContext: { languageHints: ['fr', 'en'] },
          features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
        },
      ],
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || `Vision API ${res.status}`);
  }
  const ann = data?.responses?.[0];
  if (ann?.error) throw new Error(ann.error.message);
  return (
    ann?.fullTextAnnotation?.text ||
    ann?.textAnnotations?.[0]?.description ||
    ''
  ).trim();
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return json(res, {
      ok: true,
      provider: 'google-vision',
      configured: Boolean(process.env.GOOGLE_CLOUD_VISION_API_KEY),
    });
  }

  if (req.method !== 'POST') {
    return json(res, { error: 'Method not allowed' }, 405);
  }

  const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY;
  if (!apiKey) {
    return json(res, { error: 'GOOGLE_CLOUD_VISION_API_KEY not configured', text: null }, 503);
  }

  try {
    const ct = req.headers['content-type'] || '';
    let fileBuf = null;

    if (ct.includes('application/json')) {
      const raw = typeof req.body === 'string' ? req.body : (await readBody(req)).toString('utf8');
      const body = JSON.parse(raw || '{}');
      if (body.imageBase64) {
        fileBuf = Buffer.from(String(body.imageBase64).replace(/^data:[^;]+;base64,/, ''), 'base64');
      }
    } else if (ct.includes('multipart/form-data')) {
      const boundary = /boundary=(.+)$/i.exec(ct)?.[1]?.trim();
      const buf = Buffer.isBuffer(req.body) ? req.body : await readBody(req);
      const parts = parseMultipart(buf, boundary);
      const file = parts.find((p) => p.name === 'file' || p.filename);
      fileBuf = file?.data || null;
    } else {
      fileBuf = Buffer.isBuffer(req.body) ? req.body : await readBody(req);
    }

    if (!fileBuf?.length) {
      return json(res, { error: 'No image data' }, 400);
    }

    const t0 = Date.now();
    const text = await visionOcr(fileBuf.toString('base64'), apiKey);
    const ms = Date.now() - t0;

    return json(res, {
      text,
      provider: 'google-vision',
      timingMs: ms,
      charCount: text.length,
    });
  } catch (e) {
    console.error('api/ocr', e);
    return json(res, { error: e.message || 'OCR failed', text: null }, 500);
  }
}

export const config = {
  api: { bodyParser: false },
};
