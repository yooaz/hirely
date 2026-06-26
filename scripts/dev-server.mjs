#!/usr/bin/env node
/**
 * Local dev server — correct MIME for .mjs (required for Hirely core boot).
 * Usage: npm run dev:ui  →  http://127.0.0.1:4321
 */
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.PORT || process.env.HIRELY_DEV_PORT || 4321);
const HOST = process.env.HIRELY_DEV_HOST || '127.0.0.1';

function mime(fp) {
  const ext = path.extname(fp).toLowerCase();
  return (
    {
      '.html': 'text/html; charset=utf-8',
      '.js': 'text/javascript; charset=utf-8',
      '.mjs': 'text/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.json': 'application/json',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
      '.woff2': 'font/woff2',
      '.pdf': 'application/pdf',
      '.wasm': 'application/wasm',
      '.gz': 'application/gzip',
      '.txt': 'text/plain; charset=utf-8',
    }[ext] || 'application/octet-stream'
  );
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://${HOST}:${PORT}`);
  let pathname = decodeURIComponent(url.pathname);

  // Emergency compatibility aliases:
  // older Hirely import code and pdf.js package builds may still request /node_modules/... paths.
  // The functional build serves browser assets from /vendor/... so these aliases prevent 404s.
  if (/\/node_modules\/.*pdfjs-dist\/.*pdf(\.min)?\.mjs$/.test(pathname)) pathname = '/vendor/pdf.min.mjs';
  if (/\/node_modules\/.*pdfjs-dist\/.*pdf\.worker(\.min)?\.mjs$/.test(pathname)) pathname = '/vendor/pdf.worker.min.mjs';
  if (/\/node_modules\/.*jszip\/.*jszip(\.min)?\.js$/.test(pathname)) pathname = '/vendor/jszip.min.js';
  if (/\/node_modules\/.*html2pdf\.js\/.*html2pdf.*\.js$/.test(pathname)) pathname = '/vendor/html2pdf.bundle.min.js';
  if (/\/node_modules\/.*pdf-lib\/.*pdf-lib.*\.js$/.test(pathname)) pathname = '/vendor/pdf-lib.esm.min.js';
  if (/\/node_modules\/.*jspdf\/.*jspdf.*\.js$/.test(pathname)) pathname = '/vendor/jspdf.umd.min.js';

  let fp = path.join(ROOT, pathname);
  if (fp.endsWith(path.sep)) fp = path.join(fp, 'index.html');
  if (!fp.startsWith(ROOT)) {
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
    res.writeHead(200, { 'Content-Type': mime(fp), 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Hirely UI → http://${HOST}:${PORT}/`);
  console.log('Press Ctrl+C to stop.');
});
