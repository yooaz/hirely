#!/usr/bin/env node
/**
 * Generate file hashes for HIRELY_RUNTIME_VERSION (browser + Node).
 */
import { createHash } from 'crypto';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const WATCHED = [
  'src/core/parsing/experience-parser.js',
  'src/core/parsing/import-repair.js',
  'src/core/parsing/resume-output-quality.js',
  'src/core/pipeline/production-pipeline.js',
  'src/core/resume-data.js',
];

const files = {};
for (const rel of WATCHED) {
  const abs = join(root, rel);
  const buf = readFileSync(abs);
  files[rel] = createHash('sha256').update(buf).digest('hex').slice(0, 12);
}

const generatedAt = new Date().toISOString();
const out = `/** Auto-generated — do not edit. Run: npm run generate:runtime-stamps */
export const HIRELY_RUNTIME_STAMPS = ${JSON.stringify({ generatedAt, files }, null, 2)};
`;

writeFileSync(join(root, 'src/core/runtime/runtime-stamps.js'), out, 'utf8');
console.log('HIRELY_RUNTIME_STAMPS', { generatedAt, files });
