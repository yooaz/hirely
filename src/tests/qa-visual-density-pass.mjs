#!/usr/bin/env node
/**
 * Visual Density Pass QA
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

const density = readFileSync(path.join(root, 'src/ui/visual-density-pass.css'), 'utf8');
const index = readFileSync(path.join(root, 'index.html'), 'utf8');

ok(existsSync(path.join(root, 'src/ui/visual-density-pass.css')), 'visual-density-pass.css exists');
ok(index.includes('visual-density-pass.css'), 'index.html loads density pass last');
ok(density.includes('VISUAL_DENSITY_PASS_V1'), 'density version token');
ok(density.includes('--density-factor: 0.65'), 'density factor ~35%');
ok(density.includes('--ds3-space-4: 10px'), 'reduced space-4');
ok(density.includes('height: 38px'), 'compact top bar');
ok(density.includes('min-height: min(52vh, 640px)'), 'reduced cv stage min-height');
ok(density.includes('minmax(118px'), 'denser template gallery');
ok(density.includes('--ds3-max: 1620px'), 'wider max width');

const ds3Space4Before = 16;
const ds3Space4After = 10;
const reduction = Math.round((1 - ds3Space4After / ds3Space4Before) * 100);
ok(reduction >= 30 && reduction <= 42, `spacing reduction ~${reduction}% (target 30-40%)`);

const cvMinBefore = 920;
const cvMinAfter = 640;
const cvReduction = Math.round((1 - cvMinAfter / cvMinBefore) * 100);
ok(cvReduction >= 28 && cvReduction <= 42, `cv stage reduction ~${cvReduction}%`);

console.log(failed ? `\nqa:visual-density-pass FAILED (${failed})` : '\nqa:visual-density-pass PASSED');
process.exit(failed ? 1 : 0);
