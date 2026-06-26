#!/usr/bin/env node
/** @deprecated Use `npm run test:extract` → tests/run-extract.mjs */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const runner = path.join(path.dirname(fileURLToPath(import.meta.url)), '../tests/run-extract.mjs');
const child = spawn(process.execPath, [runner], { stdio: 'inherit' });
child.on('exit', (code) => process.exit(code ?? 1));
