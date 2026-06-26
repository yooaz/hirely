#!/usr/bin/env node
/**
 * H17 — Production reality audit entry (browser path).
 */
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const r = spawnSync('node', ['scripts/production-reality-audit.mjs'], {
  cwd: root,
  encoding: 'utf8',
  stdio: 'inherit',
});
process.exit(r.status ?? 1);
