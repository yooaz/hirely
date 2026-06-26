#!/usr/bin/env node
/**
 * Design System V3 QA — tokens, load order, premium chrome rules.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');

const CSS_PATH = path.join(ROOT, 'src/ui/design-system-v3.css');
const INDEX_PATH = path.join(ROOT, 'index.html');
const SCALE_PATH = path.join(ROOT, 'src/ui/hirely-ui-scale.css');
const POLISH_PATH = path.join(ROOT, 'src/ui/hirely-premium-polish.css');

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else {
    console.log('OK', msg);
  }
}

function read(p) {
  return fs.readFileSync(p, 'utf8');
}

function main() {
  ok(fs.existsSync(CSS_PATH), 'design-system-v3.css exists');

  const css = read(CSS_PATH);
  const index = read(INDEX_PATH);

  ok(index.includes('src/ui/design-system-v3.css'), 'index.html links design-system-v3.css');

  const scaleIdx = index.indexOf('hirely-ui-scale.css');
  const v3Idx = index.indexOf('design-system-v3.css');
  ok(scaleIdx > -1 && v3Idx > scaleIdx, 'V3 loads after hirely-ui-scale.css');

  const requiredTokens = [
    '--ds3-bg',
    '--ds3-surface',
    '--ds3-canvas',
    '--ds3-ink',
    '--ds3-shadow-cv',
    '--ds3-text-display',
    '--ds3-text-body',
    '--ds3-radius-lg',
    '--ds3-rail-width',
    '--ds3-max',
  ];
  for (const t of requiredTokens) ok(css.includes(t), `token ${t}`);

  const rules = [
    ['border: 0', 'borderless panels'],
    ['backdrop-filter', 'glass top bar'],
    ['--ds3-shadow-cv', 'premium CV shadow'],
    ['minmax(0, 1fr)', 'preview-first grid'],
    ['--cv-preview-scale', 'larger preview scale'],
    ['font-feature-settings', 'Inter typography features'],
    ['--ds3-ink', 'monochrome accent mapping'],
  ];
  for (const [needle, label] of rules) ok(css.includes(needle), label);

  ok(css.includes('--bg: var(--ds3-bg)'), 'legacy --bg mapped');
  ok(css.includes('--shadow-cv: var(--ds3-shadow-cv)'), 'legacy --shadow-cv mapped');

  const legacyMapped = ['--paper', '--ink', '--line', '--hirely-max', '--hirely-aside-max'];
  for (const t of legacyMapped) ok(css.includes(t), `legacy var ${t} remapped`);

  ok(fs.existsSync(SCALE_PATH), 'hirely-ui-scale.css still present');
  ok(fs.existsSync(POLISH_PATH), 'hirely-premium-polish.css still present');

  ok(css.includes('@container cv-canvas'), 'container query preview scaling');
  ok(css.includes('.btn.primary'), 'compact primary button override');
  ok(css.includes('.top'), 'top chrome override');
  ok(css.includes('.cvStage'), 'CV stage override');
  ok(css.includes('.hirelyProgressBtn'), 'progress nav override');

  if (failed) {
    console.error(`\n${failed} check(s) failed`);
    process.exit(1);
  }
  console.log('\nDESIGN_SYSTEM_V3 QA: PASS');
}

main();
