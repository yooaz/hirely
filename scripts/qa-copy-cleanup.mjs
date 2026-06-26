#!/usr/bin/env node
/**
 * QA: visible UI copy — no leaked i18n keys, debug strings, or broken labels.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const blockStart = indexHtml.indexOf('const I18N=');
const blockEnd = indexHtml.indexOf('function looksLikeLeakedI18nKey');
let I18N = {};
// eslint-disable-next-line no-eval
eval(indexHtml.slice(blockStart, blockEnd).replace('const I18N=', 'I18N='));

const dataIKeys = [...indexHtml.matchAll(/data-i="([^"]+)"/g)].map((m) => m[1]);
const uniqueDataI = [...new Set(dataIKeys)];

const leakedKeyPattern = /^[a-z][a-zA-Z0-9_]*$/;
const forbiddenVisible = [
  /\bliImportDropHint\b/,
  /\bCORE_BOOT_FAILED\b/,
  /\bundefined\b/,
  /\bnull\b/,
  /\[object Object\]/,
  /\bTEST\b/,
  /\bDEBUG\b/,
  /\bTODO\b/,
  /\bFIXME\b/,
  /\bCORE_BOOT\b/,
];

function looksLikeLeakedKey(s) {
  return typeof s === 'string' && s.length > 2 && leakedKeyPattern.test(s) && /[A-Z_]/.test(s);
}

function t(k, lang) {
  const pack = I18N[lang] || {};
  const v = pack[k] ?? I18N.en?.[k] ?? I18N.fr?.[k];
  if (v != null && v !== '' && v !== k) return v;
  if (looksLikeLeakedKey(k)) return '';
  return k;
}

const missingFr = uniqueDataI.filter((k) => !I18N.fr[k]);
const missingEn = uniqueDataI.filter((k) => !I18N.en[k]);

const fixedStrings = [
  { key: 'dropTitle', fr: 'Déposez votre CV', en: 'Drop your CV' },
  { key: 'dropHint', fr: 'PDF, DOCX, TXT ou image', en: 'PDF, DOCX, TXT or image' },
  { key: 'dropActionHint', fr: 'Glissez votre fichier ici, ou cliquez pour choisir un fichier.', en: 'Drag your file here, or click to choose a file.' },
  { key: 'liImportDropHint', fr: '(removed from main dropzone)', en: '(LinkedIn block only)' },
  { key: 'importPasteFallbackTitle', fr: 'Nous avons besoin d\'un peu plus de texte', en: 'We need a little more text' },
  { key: 'importPasteFallbackLead', fr: 'Collez le texte de votre CV ci-dessous pour continuer.', en: 'Paste your CV text below so we can continue.' },
  { key: 'exportStepLead', fr: 'Aperçu A4 — exactement ce qui sera dans votre PDF.', en: 'A4 preview — exactly what will be in your PDF.' },
  { key: 'modeEdit', fr: 'Mode édition', en: 'Edit mode' },
  { key: 'modeRecruiter', fr: 'Mode recruteur', en: 'Recruiter preview' },
  { key: 'reviewSlimTitle', fr: 'Relecture', en: 'Review' },
  { key: 'spacingSpacious', fr: 'Aéré', en: 'Spacious' },
  { key: 'liImportTitle', fr: 'Import LinkedIn', en: 'LinkedIn import' },
  { key: 'liImportSub', fr: 'Combinez export LinkedIn…', en: 'Combine LinkedIn PDF…' },
  { key: 'liImportPickBtn', fr: 'Ajouter LinkedIn et CV', en: 'Add LinkedIn + resume files' },
  { key: 'coreLoadFail', fr: 'Le moteur Hirely n\'a pas chargé.', en: 'Hirely engine failed to load.' },
];

const screenshotDir = path.join(root, 'docs', 'screenshots', 'copy-cleanup');
fs.mkdirSync(screenshotDir, { recursive: true });

const port = 3099;
const baseUrl = `http://127.0.0.1:${port}/index.html`;

let browserVisible = { fr: {}, en: {} };
let pass = true;
const failures = [];

async function captureScreenshots() {
  const { spawn } = await import('node:child_process');
  const server = spawn('python3', ['-m', 'http.server', String(port)], { cwd: root, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 800));
  const browser = await chromium.launch();
  try {
    for (const lang of ['fr', 'en']) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
      await page.selectOption('#uiLang', lang);
      await page.waitForTimeout(400);
      const drop = page.locator('#drop');
      await drop.scrollIntoViewIfNeeded();
      const shotPath = path.join(screenshotDir, `import-dropzone-${lang}-after.png`);
      await page.screenshot({ path: shotPath, fullPage: false });
      browserVisible[lang] = {
        dropTitle: (await page.locator('#drop .dropLabel').textContent())?.trim(),
        dropHint: (await page.locator('#drop .dropHint').first().textContent())?.trim(),
        dropActionHint: (await page.locator('#drop .dropActionHint').textContent())?.trim(),
        screenshot: path.relative(root, shotPath),
      };
      for (const [label, text] of Object.entries(browserVisible[lang])) {
        if (label === 'screenshot' || !text) continue;
        for (const re of forbiddenVisible) {
          if (re.test(text)) {
            pass = false;
            failures.push(`${lang} ${label}: forbidden pattern ${re} in "${text}"`);
          }
        }
        if (looksLikeLeakedKey(text)) {
          pass = false;
          failures.push(`${lang} ${label}: leaked key "${text}"`);
        }
      }
      await page.close();
    }
  } finally {
    await browser.close();
    server.kill('SIGTERM');
  }
}

await captureScreenshots();

if (missingFr.length) {
  pass = false;
  failures.push(`Missing FR keys for data-i: ${missingFr.join(', ')}`);
}
if (missingEn.length) {
  pass = false;
  failures.push(`Missing EN keys for data-i: ${missingEn.join(', ')}`);
}

// Dropzone contract
const expectedFr = {
  dropTitle: 'Déposez votre CV',
  dropHint: 'PDF, DOCX, TXT ou image',
  dropActionHint: 'Glissez votre fichier ici, ou cliquez pour choisir un fichier.',
};
for (const [k, exp] of Object.entries(expectedFr)) {
  if (browserVisible.fr?.[k] !== exp) {
    pass = false;
    failures.push(`FR ${k}: expected "${exp}", got "${browserVisible.fr?.[k]}"`);
  }
}

const reportPath = path.join(root, 'COPY_CLEANUP_REPORT.md');
const lines = [
  '# COPY_CLEANUP_REPORT',
  '',
  `**Status:** ${pass ? 'PASS' : 'FAIL'}`,
  `**Generated:** ${new Date().toISOString()}`,
  '',
  '## Root cause',
  '',
  'Missing i18n keys caused `applyI18n()` to render raw key names (e.g. `liImportDropHint`) via `t(k) ?? k`.',
  '',
  '## Dropzone copy (FR)',
  '',
  '| Line | Key | Text |',
  '|------|-----|------|',
  `| Title | dropTitle | ${expectedFr.dropTitle} |`,
  `| Subtitle | dropHint | ${expectedFr.dropHint} |`,
  `| Hint | dropActionHint | ${expectedFr.dropActionHint} |`,
  '',
  '## Fixed strings',
  '',
  ...fixedStrings.map((s) => `- **${s.key}** — FR: ${s.fr} · EN: ${s.en}`),
  '',
  '## Browser verification',
  '',
  '### French',
  '```json',
  JSON.stringify(browserVisible.fr, null, 2),
  '```',
  '',
  '### English',
  '```json',
  JSON.stringify(browserVisible.en, null, 2),
  '```',
  '',
  '## Screenshots',
  '',
  '- Before: raw key `liImportDropHint` visible in dropzone (pre-fix; see git history)',
  `- After FR: \`${browserVisible.fr?.screenshot}\``,
  `- After EN: \`${browserVisible.en?.screenshot}\``,
  '',
  '## Missing keys audit (data-i)',
  '',
  `- FR missing (${missingFr.length}): ${missingFr.length ? missingFr.join(', ') : 'none'}`,
  `- EN missing (${missingEn.length}): ${missingEn.length ? missingEn.join(', ') : 'none'}`,
  '',
];

if (failures.length) {
  lines.push('## Failures', '', ...failures.map((f) => `- ${f}`), '');
}

fs.writeFileSync(reportPath, lines.join('\n'));
console.log(pass ? 'COPY QA PASS' : 'COPY QA FAIL');
if (failures.length) failures.forEach((f) => console.error(' -', f));
process.exit(pass ? 0 : 1);
