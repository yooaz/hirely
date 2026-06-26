#!/usr/bin/env node
/** @deprecated Use `npm run qa:smoke` → src/tests/qa-smoke.mjs */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const runner = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/tests/qa-smoke.mjs');
const child = spawn(process.execPath, [runner], { stdio: 'inherit' });
child.on('exit', (code) => process.exit(code ?? 1));
