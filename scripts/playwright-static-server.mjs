#!/usr/bin/env node
/**
 * Static file server for Playwright e2e (index.html + src/).
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PLAYWRIGHT_PORT || process.env.PORT || 4321);

function mime(fp) {
  const ext = path.extname(fp).toLowerCase();
  return (
    {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.mjs': 'text/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.woff2': 'font/woff2',
      '.wasm': 'application/wasm',
    }[ext] || 'application/octet-stream'
  );
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);
  let fp = path.join(root, decodeURIComponent(url.pathname.split('?')[0]));
  if (fp.endsWith('/')) fp = path.join(fp, 'index.html');
  if (!fp.startsWith(root)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  fs.readFile(fp, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': mime(fp) });
    res.end(data);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  process.stdout.write(`playwright-static-server http://127.0.0.1:${PORT}/\n`);
});
