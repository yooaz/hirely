#!/usr/bin/env node
/**
 * Generate DOM_CONTRACT_REPORT.md from dom-contract.js + live index.html.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const CONTRACT_PATH = path.join(root, 'src/ui/runtime/dom-contract.js');
const INDEX_PATH = path.join(root, 'index.html');
const REPORT_PATH = path.join(root, 'DOM_CONTRACT_REPORT.md');
const PORT = Number(process.env.HIRELY_DOM_CONTRACT_PORT || 3116);
const BASE = `http://127.0.0.1:${PORT}/index.html`;

function parseIdList(source, varName) {
  const re = new RegExp(`const\\s+${varName}\\s*=\\s*Object\\.freeze\\(\\[([\\s\\S]*?)\\]\\)`);
  const m = source.match(re);
  if (!m) return [];
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
}

function extractHtmlIds(html) {
  const ids = new Set();
  const re = /\bid=["']([a-zA-Z][\w-]*)["']/g;
  let m;
  while ((m = re.exec(html))) ids.add(m[1]);
  return ids;
}

function resolveExists(id, htmlIds) {
  if (id === 'cvPreview') return htmlIds.has('cvDoc');
  return htmlIds.has(id);
}

async function startServer() {
  const proc = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: root, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 900));
  return proc;
}

async function main() {
  const contractSrc = fs.readFileSync(CONTRACT_PATH, 'utf8');
  const indexHtml = fs.readFileSync(INDEX_PATH, 'utf8');
  const requiredIds = parseIdList(contractSrc, 'requiredIds');
  const optionalIds = parseIdList(contractSrc, 'optionalIds');
  const htmlIds = extractHtmlIds(indexHtml);

  const server = await startServer();
  const browser = await chromium.launch({ headless: true });
  let runtime = null;

  try {
    const page = await browser.newPage();
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
    runtime = await page.evaluate(() => {
      const c = window.HirelyDomContract?.validateDomContract?.();
      return c || null;
    });
  } finally {
    await browser.close();
    server.kill('SIGTERM');
  }

  const staticRequiredMissing = requiredIds.filter((id) => !resolveExists(id, htmlIds));
  const staticOptionalMissing = optionalIds.filter((id) => !resolveExists(id, htmlIds));
  const valid = staticRequiredMissing.length === 0;
  const status = valid && runtime?.valid !== false ? 'PASS' : 'FAIL';

  const lines = [
    '# DOM_CONTRACT_REPORT',
    '',
    `**Status:** ${status}`,
    `**Generated:** ${new Date().toISOString()}`,
    `**Source:** \`src/ui/runtime/dom-contract.js\``,
    '',
    '## Policy',
    '',
    '- **Boot stops** only when `validateDomContract().valid === false` (missing **required** IDs).',
    '- Missing **optional** IDs are traced (`MISSING_OPTIONAL_DOM`) and recorded in `__HIRELY_MISSING_DOM__` — boot continues.',
    '',
    '## validateDomContract()',
    '',
    '```javascript',
    '{',
    '  valid: boolean,           // true when missingRequired.length === 0',
    '  missingRequired: string[],',
    '  missingOptional: string[]',
    '}',
    '```',
    '',
    '### Runtime result (browser)',
    '',
    '```json',
    JSON.stringify(runtime, null, 2),
    '```',
    '',
    '## requiredIds',
    '',
    '| ID | HTML element | Boot |',
    '|----|--------------|------|',
    ...requiredIds.map((id) => {
      const exists = resolveExists(id, htmlIds);
      const note = id === 'cvPreview' ? '`#cvDoc`' : '';
      return `| \`${id}\` | ${exists ? 'yes' : '**MISSING**'} | ${exists ? 'required — boot OK' : '**BLOCKS BOOT**'} | ${note ? note : ''}`.trimEnd();
    }),
    '',
    `**missingRequired (static):** ${staticRequiredMissing.length ? staticRequiredMissing.join(', ') : 'none'}`,
    '',
    '## optionalIds',
    '',
    '| ID | HTML element | Boot impact |',
    '|----|--------------|-------------|',
    ...optionalIds.map((id) => {
      const exists = resolveExists(id, htmlIds);
      return `| \`${id}\` | ${exists ? 'yes' : 'no (subtracted)'} | warn only |`;
    }),
    '',
    `**missingOptional (static):** ${staticOptionalMissing.length} — expected after P0 subtraction`,
    '',
    '## API surface (`window.HirelyDomContract`)',
    '',
    '| Export | Role |',
    '|--------|------|',
    '| `requiredIds` | Canonical required list |',
    '| `optionalIds` | Canonical optional list |',
    '| `validateDomContract()` | Full validation result |',
    '| `validateRequiredDom()` | Legacy — returns `missingRequired` only |',
    '| `setHTML` / `setText` / `setElHTML` | Null-safe DOM writes |',
    '| `byId` / `$` | Lookup with `cvPreview` → `cvDoc` alias |',
    '',
    '## Boot integration',
    '',
    '1. `dom-contract.js` loads after `boot-trace.js` + `dom-safe.js`.',
    '2. On load: `validateDomContract()` → `DOM_CONTRACT_READY` trace.',
    '3. If `!valid`: `HirelyBootTrace.fail` — boot stops.',
    '4. `index.html` calls `validateDomContract()` at DOM_VALIDATED (via `validateRequiredDom` shim).',
    '5. `HirelyEngineHealth` uses `missingRequired` only for `FAILED` state.',
    '',
  ];

  fs.writeFileSync(REPORT_PATH, lines.join('\n'));
  console.log(`Wrote ${REPORT_PATH}`);
  console.log(`Status: ${status} | required missing: ${staticRequiredMissing.length} | optional missing: ${staticOptionalMissing.length}`);
  if (!valid) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
