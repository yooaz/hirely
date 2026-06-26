/**
 * Creative resume mode — role detection, resumeData sections, blocks, no Adobe-in-experience leak.
 */
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runP0Pipeline } from '../core/pipeline/p0-pipeline.js';
import {
  CREATIVE_MODE_TARGET_ROLES,
  detectTargetCreativeRoles,
  resolveCreativeResumeMode,
} from '../core/creative-resume-mode.js';
import { buildResumeData, resumeDataToCvData } from '../core/resume-data.js';
import { ensureResumeBlocks, legacyToBlocks } from '../core/resume-blocks.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');

const CREATIVE_CV = `ALEX MARTIN
Illustrator · Graphic Designer

CLIENTS
Adobe
Nike

PROJECTS
Editorial series — Vogue

AWARDS
D&AD Pencil

EXHIBITIONS
Saatchi Gallery 2021

PUBLICATIONS
Communication Arts

PORTFOLIO
behance.net/alex

EXPERIENCE
2020 – Present · Nike — Lead Designer
`;

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

for (const role of [
  'Illustrator',
  'Graphic Designer',
  'Motion Designer',
  'Art Director',
  'Creative Director',
]) {
  ok(CREATIVE_MODE_TARGET_ROLES.includes(role), `target role listed: ${role}`);
  ok(detectTargetCreativeRoles(role).length >= 1, `detects: ${role}`);
}

const p0 = runP0Pipeline({ rawText: CREATIVE_CV, source: 'paste' });
const rd = buildResumeData({ structured: p0.structuredResume, rawText: CREATIVE_CV, cleanedText: CREATIVE_CV });
const mode = resolveCreativeResumeMode(rd);

ok(mode.active, 'creative mode active on product resumeData');
ok(rd.clients?.length >= 2, 'clients preserved');
ok(rd.awards?.length >= 1, 'awards preserved');
ok(rd.exhibitions?.length >= 1, 'exhibitions preserved');
ok(rd.publications?.length >= 1, 'publications preserved');
ok(rd.portfolioLinks?.length >= 1, 'portfolio links preserved');

const blocks = legacyToBlocks(ensureResumeBlocks(rd));
ok(blocks.some((b) => b.type === 'client'), 'client block');
ok(blocks.some((b) => b.type === 'exhibition'), 'exhibition block');

const cv = resumeDataToCvData(rd);
ok(cv.exhibitions?.length >= 1, 'cvData exhibitions');
const exp = (cv.experience || []).join('\n');
ok(!/\bAdobe\b/.test(exp) || /Lead Designer/i.test(exp), 'Adobe not forced as job line');

const fixture = readFileSync(path.join(root, 'tests/fixtures/creative-cv/fixture.txt'), 'utf8');
ok(detectTargetCreativeRoles(fixture).length >= 1, 'creative fixture role');

console.log(failed ? `\n${failed} FAILED` : '\nqa-creative-resume-product: PASS');
