import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { readBoundedBody, RequestBodyLimitError, MAX_PARSE_REQUEST_BYTES } from '../src/api/bounded-request-body.js';

function request(chunks, contentLength) {
  const req = Readable.from(chunks);
  req.headers = contentLength === undefined ? {} : { 'content-length': contentLength };
  return req;
}

test('accepts small valid UTF-8 payload', async () => {
  const body = await readBoundedBody(request(['hello', ' world']), 12);
  assert.equal(body.toString('utf8'), 'hello world');
});
test('accepts exact byte boundary', async () => {
  assert.equal((await readBoundedBody(request([Buffer.from('abcd'), Buffer.from('efgh')], '8'), 8)).length, 8);
});
test('preserves binary bytes without text normalization', async () => {
  const binary = Buffer.from([0, 255, 13, 10, 0]);
  assert.deepEqual(await readBoundedBody(request([binary]), 5), binary);
});
test('accepts empty request', async () => {
  assert.equal((await readBoundedBody(request([], '0'), 8)).length, 0);
});
test('rejects declared oversized upload before consuming chunks', async () => {
  let reads = 0;
  async function* source() { reads++; yield Buffer.alloc(1); }
  const req = source(); req.headers = {'content-length':'999999999999999999999999'};
  await assert.rejects(readBoundedBody(req, 8), e => e instanceof RequestBodyLimitError && e.status === 413);
  assert.equal(reads, 0);
});
test('rejects oversized streamed upload without Content-Length', async () => {
  await assert.rejects(readBoundedBody(request([Buffer.alloc(7), Buffer.alloc(2)]), 8), e => e.code === 'REQUEST_BODY_TOO_LARGE' && e.status === 413);
});
test('rejects streamed overrun despite small declared Content-Length', async () => {
  await assert.rejects(readBoundedBody(request([Buffer.alloc(9)], '1'), 8), e => e.status === 413);
});
test('rejects malformed or duplicate-looking Content-Length', async () => {
  for (const length of ['2, 2', '-1', 'NaN', ' 2', '2.0', '01', '2e3']) {
    await assert.rejects(readBoundedBody(request(['ok'], length), 8), e => e.code === 'INVALID_CONTENT_LENGTH' && e.status === 400);
  }
});
test('rejects invalid programmatic limit', async () => {
  await assert.rejects(readBoundedBody(request(['a']), 0), TypeError);
});
test('default limit is a finite bounded upload budget', () => {
  assert.ok(Number.isSafeInteger(MAX_PARSE_REQUEST_BYTES));
  assert.ok(MAX_PARSE_REQUEST_BYTES >= 8 * 1024 * 1024);
  assert.ok(MAX_PARSE_REQUEST_BYTES <= 32 * 1024 * 1024);
});
