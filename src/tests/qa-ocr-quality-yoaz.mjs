#!/usr/bin/env node
/** @deprecated Use npm run test:ocr-quality */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), 'test-ocr-quality.mjs');
const r = spawnSync(process.execPath, [script], { stdio: 'inherit' });
process.exit(r.status ?? 1);
