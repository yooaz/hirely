import fs from 'fs';
import http from 'http';
import path from 'path';

export function qaMime(fp) {
  const ext = path.extname(fp).toLowerCase();
  return (
    {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.mjs': 'text/javascript',
      '.css': 'text/css',
      '.txt': 'text/plain',
      '.json': 'application/json',
      '.svg': 'image/svg+xml',
      '.woff2': 'font/woff2',
      '.png': 'image/png',
    }[ext] || 'application/octet-stream'
  );
}

/** @param {string} root @param {number} [port] */
export function startQaStaticServer(root, port = 0) {
  const server = http.createServer((req, res) => {
    const u = req.url.split('?')[0];
    let p = u === '/' ? '/index.html' : u;
    const fp = path.join(root, decodeURIComponent(p));
    if (!fp.startsWith(root) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, { 'Content-Type': qaMime(fp) });
    fs.createReadStream(fp).pipe(res);
  });
  return server;
}
