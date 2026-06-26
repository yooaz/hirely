#!/usr/bin/env node
/** Keep shared + 6 active template style blocks. */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');
const src = path.join(root, 'archive/cv-templates-premium-20-pack.css');
const out = path.join(root, 'src/ui/templates/cv-templates-premium.css');
const KEEP = new Set(['ats', 'executive', 'swiss', 'artdirector', 'tech', 'compact']);

const lines = fs.readFileSync(src, 'utf8').split('\n');
const outLines = [];
let inBlock = false;
let keepBlock = false;

for (const line of lines) {
  const m = line.match(/^\.cv\.template-([a-z0-9-]+)/);
  if (m) {
    inBlock = true;
    keepBlock = KEEP.has(m[1]);
  } else if (inBlock && line.trim() === '' && !line.startsWith('.cv.template-')) {
    inBlock = false;
    keepBlock = false;
  }
  if (!inBlock && !line.match(/^\.cv\.template-/)) {
    if (!line.match(/^\/\* \d+ —/) || KEEP.has(line.match(/\/\* \d+ — (.+)/)?.[1]?.toLowerCase().replace(/\s+.*/, ''))) {
      if (!line.startsWith('/* 1 —') && !line.match(/^\/\* \d+ —/)) {
        outLines.push(line);
      } else if (line.startsWith('/* 1 —') || line.includes('ATS')) {
        outLines.push('/* 1 — Minimal ATS */');
      }
    }
    continue;
  }
  if (keepBlock) outLines.push(line);
}

const header = `/* Hirely — 6 curated CV templates (print/PDF safe) */\n`;
fs.writeFileSync(out, header + outLines.join('\n').replace(/\n{3,}/g, '\n\n'));
console.log('Wrote', out, fs.statSync(out).size, 'bytes');
