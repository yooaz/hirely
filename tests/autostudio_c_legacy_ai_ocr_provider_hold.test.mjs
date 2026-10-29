import { test } from 'node:test';
import assert from 'node:assert/strict';
import reconstruct from '../api/ai-reconstruct.js';
import structure from '../api/structure-cv.js';
import ocr from '../api/ocr.js';
import analyze from '../api/analyze.js';
import { canCallBillableCvProvider, PREMIUM_PROVIDER_HOLD_CODE } from '../lib/premium-provider-gate.js';

function response() {
  return {
    statusCode: 200,
    body: undefined,
    headers: {},
    status(code) { this.statusCode = code; return this; },
    setHeader(name, value) { this.headers[name] = value; return this; },
    end(raw) { if (raw !== undefined) this.body = JSON.parse(raw); return this; },
  };
}

test('legacy provider gate ignores client-supplied claims', () => {
  for (const req of [
    undefined,
    {},
    { premium: true, verified: true, consent: true, exportId: 'fake' },
    { headers: { authorization: 'Bearer fake', 'x-premium': 'true' } },
    { cookies: { premium: 'true' }, query: { pro: 'true', test: 'yoaz' } },
  ]) assert.equal(canCallBillableCvProvider(req), false);
  assert.equal(PREMIUM_PROVIDER_HOLD_CODE, 'PREMIUM_ENTITLEMENT_REQUIRED');
});

test('legacy AI reconstruction, structure and OCR HOLD before reading CV or calling provider', async () => {
  const originalFetch = globalThis.fetch;
  const oldGemini = process.env.GEMINI_API_KEY;
  const oldVision = process.env.GOOGLE_CLOUD_VISION_API_KEY;
  let providerCalls = 0;
  try {
    process.env.GEMINI_API_KEY = 'synthetic-never-used';
    process.env.GOOGLE_CLOUD_VISION_API_KEY = 'synthetic-never-used';
    globalThis.fetch = async () => { providerCalls++; throw new Error('PROVIDER_MUST_NOT_BE_CALLED'); };
    for (const handler of [reconstruct, structure, ocr]) {
      const req = { method: 'POST', headers: { 'content-type': 'application/json' }, premium: true };
      Object.defineProperty(req, 'body', { get() { throw new Error('BODY_MUST_NOT_BE_READ'); } });
      const res = response();
      await handler(req, res);
      assert.equal(res.statusCode, 403);
      assert.equal(res.body.code, PREMIUM_PROVIDER_HOLD_CODE);
      assert.equal(providerCalls, 0);
    }
  } finally {
    globalThis.fetch = originalFetch;
    if (oldGemini === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = oldGemini;
    if (oldVision === undefined) delete process.env.GOOGLE_CLOUD_VISION_API_KEY;
    else process.env.GOOGLE_CLOUD_VISION_API_KEY = oldVision;
  }
});

test('legacy analyze preserves local fallback with a configured Gemini key', async () => {
  const originalFetch = globalThis.fetch;
  const oldGemini = process.env.GEMINI_API_KEY;
  let providerCalls = 0;
  try {
    process.env.GEMINI_API_KEY = 'synthetic-never-used';
    globalThis.fetch = async () => { providerCalls++; throw new Error('PROVIDER_MUST_NOT_BE_CALLED'); };
    const res = response();
    await analyze({ method: 'POST', body: {
      cv: 'Test Candidate\\nExperience\\nIllustrator at Example Studio 2021-2025. '.repeat(3),
      job: 'Designer',
      premium: true,
    } }, res);
    assert.equal(res.statusCode, 200);
    assert.match(String(res.body.notice), /server-side entitlement and consent/i);
    assert.equal(providerCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
    if (oldGemini === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = oldGemini;
  }
});

test('non-POST informational routes remain non-billable', async () => {
  const originalFetch = globalThis.fetch;
  let providerCalls = 0;
  try {
    globalThis.fetch = async () => { providerCalls++; throw new Error('PROVIDER_MUST_NOT_BE_CALLED'); };
    for (const handler of [reconstruct, structure, ocr, analyze]) {
      const res = response();
      await handler({ method: 'GET', headers: {} }, res);
      assert.equal(res.statusCode, 200);
    }
    assert.equal(providerCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
