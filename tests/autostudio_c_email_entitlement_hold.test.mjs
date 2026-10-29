import { test } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/send-cv-email.js';

const syntheticPdf = Buffer.from('%PDF-1.4\n' + 'X'.repeat(180)).toString('base64');
const payload = {
  to: 'synthetic-recipient@example.test',
  pdfBase64: syntheticPdf,
  filename: 'synthetic-cv.pdf',
  candidateName: 'Synthetic Candidate',
  exportId: 'synthetic-export',
};

function response() {
  return {
    statusCode: 200,
    headers: {},
    body: '',
    status(code) { this.statusCode = code; return this; },
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; return this; },
    end(value = '') { this.body = String(value); return this; },
    json() { return this.body ? JSON.parse(this.body) : null; },
  };
}

async function invoke(req, { configured = true } = {}) {
  const oldKey = process.env.RESEND_API_KEY;
  const oldFetch = globalThis.fetch;
  let calls = 0;
  if (configured) process.env.RESEND_API_KEY = 'synthetic-not-real';
  else delete process.env.RESEND_API_KEY;
  globalThis.fetch = async () => {
    calls++;
    return { ok: true, status: 200, json: async () => ({ id: 'mock-only' }) };
  };
  const res = response();
  try { await handler(req, res); }
  finally {
    if (oldKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = oldKey;
    globalThis.fetch = oldFetch;
  }
  return { res, calls };
}

function expectHold({ res, calls }) {
  assert.equal(res.statusCode, 403);
  assert.equal(res.json()?.code, 'PREMIUM_VERIFICATION_REQUIRED');
  assert.equal(calls, 0, 'no paid provider transport');
  assert.doesNotMatch(res.body, /synthetic-recipient|synthetic-export|synthetic-cv/i);
}

test('configured provider key is not premium authorization', async () => {
  expectHold(await invoke({ method: 'POST', body: payload }));
});

test('client-side premium and local-test flags cannot authorize send', async () => {
  expectHold(await invoke({ method: 'POST', body: { ...payload, premium: true, pro: true, test: 'yoaz' } }));
});

test('forged origin, referer and bearer headers cannot authorize send', async () => {
  expectHold(await invoke({ method: 'POST', headers: {
    origin: 'https://hirely.example', referer: 'https://hirely.example/?pro=true',
    authorization: 'Bearer forged-client-assertion',
  }, body: payload }));
});

test('untrusted body is not read before authorization', async () => {
  let read = 0;
  const req = { method: 'POST', get body() { read++; throw new Error('must not read'); } };
  expectHold(await invoke(req));
  assert.equal(read, 0);
});

test('absent provider key still returns entitlement HOLD without reading private data', async () => {
  expectHold(await invoke({ method: 'POST', body: payload }, { configured: false }));
});

test('oversized streamed private body is not consumed without entitlement', async () => {
  let reads = 0;
  const req = { method: 'POST', async *[Symbol.asyncIterator]() {
    reads++;
    throw new Error('stream should not be consumed');
  } };
  expectHold(await invoke(req));
  assert.equal(reads, 0);
});

test('GET remains rejected without provider transport', async () => {
  const { res, calls } = await invoke({ method: 'GET', body: payload });
  assert.equal(res.statusCode, 405);
  assert.equal(calls, 0);
});

test('OPTIONS preflight stays side-effect free', async () => {
  const { res, calls } = await invoke({ method: 'OPTIONS', body: payload });
  assert.equal(res.statusCode, 204);
  assert.equal(calls, 0);
});
