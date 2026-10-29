import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer, request} from 'node:http';
import {once} from 'node:events';
import {readBoundedBody} from '../src/api/bounded-request-body.js';

async function withServer(run) {
  const server = createServer(async (req, res) => {
    try {
      const body = await readBoundedBody(req, 8);
      res.writeHead(200, {'Content-Type':'text/plain'});
      res.end(String(body.length));
    } catch (err) {
      res.writeHead(err.status || 500, {'Content-Type':'text/plain'});
      res.end(err.code || 'UNKNOWN');
    }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try { await run(server.address().port); } finally { await new Promise(resolve => server.close(resolve)); }
}

async function post(port, chunks, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = request({host:'127.0.0.1',port,path:'/',method:'POST',headers}, res => {
      let s = '';
      res.on('data', c => s += c.toString());
      res.on('end', () => resolve({status:res.statusCode,body:s}));
    });
    req.on('error', reject);
    for (const chunk of chunks) req.write(chunk);
    req.end();
  });
}

test('real loopback HTTP accepts a bounded request', async () => {
  await withServer(async port => assert.deepEqual(await post(port,['1234'],{'Content-Length':'4'}), {status:200,body:'4'}));
});
test('real loopback HTTP returns 413 for oversized declared request', async () => {
  await withServer(async port => assert.deepEqual(await post(port,['123456789'],{'Content-Length':'9'}), {status:413,body:'REQUEST_BODY_TOO_LARGE'}));
});
test('real loopback HTTP returns 413 for oversized chunked request', async () => {
  await withServer(async port => assert.deepEqual(await post(port,['12345','6789']), {status:413,body:'REQUEST_BODY_TOO_LARGE'}));
});
