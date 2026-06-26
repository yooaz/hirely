#!/usr/bin/env node
/**
 * Typography System QA — tokens, font loading, hierarchy bindings
 */
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

const typoCss = readFileSync(path.join(root, 'src/ui/typography-system.css'), 'utf8');
const ds3 = readFileSync(path.join(root, 'src/ui/design-system-v3.css'), 'utf8');
const tokens = readFileSync(path.join(root, 'src/ui/templates/cv-design-tokens.css'), 'utf8');
const density = readFileSync(path.join(root, 'src/ui/templates/cv-template-density.css'), 'utf8');
const index = readFileSync(path.join(root, 'index.html'), 'utf8');
const v3 = readFileSync(path.join(root, 'src/ui/templates/cv-templates-v3-families.css'), 'utf8');

const REQUIRED_TOKENS = [
  '--typo-font-ui',
  '--typo-font-display-serif',
  '--typo-leading-body',
  '--typo-leading-relaxed',
  '--typo-tracking-display',
  '--typo-tracking-kicker',
  '--typo-weight-semibold',
  '--typo-preset-apple-body',
  '--typo-preset-ft-display',
  '--typo-preset-airbnb-body',
  '--typo-preset-stripe-mono',
];

for (const token of REQUIRED_TOKENS) {
  ok(typoCss.includes(token), `token defined: ${token}`);
}

ok(existsSync(path.join(root, 'src/ui/typography-system.css')), 'typography-system.css exists');
ok(index.includes('typography-system.css'), 'index.html loads typography-system.css');
ok(index.includes('family=Fraunces'), 'fonts: Fraunces loaded');
ok(index.includes('family=Roboto'), 'fonts: Roboto loaded');
ok(index.includes('family=EB+Garamond'), 'fonts: EB Garamond loaded');
ok(index.includes('family=Crimson+Pro'), 'fonts: Crimson Pro loaded');
ok(index.includes('family=Lora'), 'fonts: Lora loaded');
ok(index.includes('wght@300'), 'fonts: Inter 300 (Apple light) loaded');

ok(ds3.includes('var(--typo-leading-body'), 'design-system-v3 uses typo leading');
ok(ds3.includes('--ds3-weight-semibold'), 'design-system-v3 named weight scale');
ok(tokens.includes('var(--typo-font-display-serif'), 'cv-design-tokens serif display');
ok(density.includes('var(--typo-leading-body'), 'cv-template-density uses typo leading');
ok(v3.includes('var(--typo-preset-apple-body)'), 'v3 apple preset binding');
ok(v3.includes('var(--typo-leading-body)'), 'v3 academic leading token');
ok(typoCss.includes('font-variant-numeric: tabular-nums'), 'tabular nums for dates');

console.log(failed ? `\nqa:typography-system FAILED (${failed})` : '\nqa:typography-system PASSED');
process.exit(failed ? 1 : 0);
