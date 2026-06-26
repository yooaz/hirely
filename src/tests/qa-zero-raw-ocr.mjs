#!/usr/bin/env node
/**
 * Zero raw OCR — garbage fragments never auto-render in CV; routed to unsorted.
 * node src/tests/qa-zero-raw-ocr.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { startQaStaticServer } from '../../tests/lib/qa-static-server.mjs';
import { normalizeResumeData, resumeDataToCvData } from '../core/resume-data.js';
import {
  CONFIDENCE_THRESHOLDS,
  applyConfidenceGate,
  scoreSkillLine,
  scoreIdentityTitle,
} from '../core/validation/confidence-gate.js';
import { NAME_UNCERTAIN_LABEL } from '../core/parsing/parser-recovery.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');

let failed = 0;
function ok(c, m) {
  if (!c) {
    console.error('FAIL', m);
    failed++;
  } else console.log('OK', m);
}

ok(CONFIDENCE_THRESHOLDS.identity === 95, 'identity threshold 95%');
ok(CONFIDENCE_THRESHOLDS.experience === 85, 'experience threshold 85%');
ok(CONFIDENCE_THRESHOLDS.education === 85, 'education threshold 85%');
ok(CONFIDENCE_THRESHOLDS.skills === 75, 'skills threshold 75%');

for (const g of ['Music', 'Reading', 'Ben']) {
  ok(scoreSkillLine(g) < CONFIDENCE_THRESHOLDS.skills, `low skill score for «${g}» (${scoreSkillLine(g)})`);
}
ok(scoreIdentityTitle('Product design') < CONFIDENCE_THRESHOLDS.identity, 'product design blocked as title');
ok(scoreSkillLine('30-year old illustrator') < CONFIDENCE_THRESHOLDS.skills, 'age fragment blocked as skill');

const poisoned = {
  identity: {
    name: 'Music',
    title: 'Product design',
    email: 'yoaz@hotmail.fr',
    phone: '+33 6 49 43 48 39',
    location: '',
    website: '',
    linkedin: '',
  },
  summary: 'Reading nature music art',
  experiences: [
    {
      role: '30-year old illustrator',
      company: 'Reading',
      startDate: '2011',
      endDate: '',
      dates: '2011',
      bullets: [],
    },
  ],
  education: ['Reading'],
  skills: ['Music', 'Illustration'],
  tools: ['Adobe'],
  unsorted: [],
};

const gated = applyConfidenceGate(poisoned);
ok(gated.identity.name === NAME_UNCERTAIN_LABEL, 'garbage name replaced with uncertain label');
ok(!gated.experiences.length, 'low-confidence experience removed');
ok(!gated.education.length, 'low-confidence education removed');
ok(gated.skills.includes('Illustration'), 'valid skill kept');
ok(!gated.skills.includes('Music'), 'Music skill routed out');
ok(gated.unsorted.some((l) => /music/i.test(l)), 'Music in suggestions bucket');
ok(gated.unsorted.some((l) => /reading/i.test(l)), 'Reading in suggestions bucket');

const normalized = normalizeResumeData(poisoned);
const cv = resumeDataToCvData(normalized);
const cvText = [
  cv.name,
  cv.title,
  cv.summary,
  ...(cv.experience || []),
  ...(cv.education || []),
  ...(cv.skills || []),
]
  .join('\n')
  .toLowerCase();

ok(!/\bmusic\b/.test(cvText) || cvText.includes('illustration'), 'cvData has no standalone Music field');
ok(!(cv.experience || []).some((l) => /30-year old/i.test(l)), 'cvData experience has no age fragment');

async function browserCheck() {
  const fixture = path.join(root, 'tests/fixtures/creative-cv/fixture.txt');
  const text = fs.readFileSync(fixture, 'utf8');
  const port = 3720 + Math.floor(Math.random() * 80);
  const server = startQaStaticServer(root);
  await new Promise((r) => server.listen(port, r));
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(
    () => window.__hirelyCoreReady === true && typeof window.HirelyParse?.ingestCvText === 'function',
    null,
    { timeout: 120000 }
  );
  await page.evaluate(async (t) => {
    await window.HirelyParse.ingestCvText(t, { silent: true, force: true, confirmed: true, trusted: true });
    if (typeof setDocStep === 'function') setDocStep('edit');
    if (typeof refreshResumeStudio === 'function') await refreshResumeStudio();
  }, text);
  await page.waitForTimeout(1500);

  const checks = await page.evaluate(() => {
    const cvEl = document.querySelector('#cvDoc');
    const plain = (cvEl?.innerText || '').toLowerCase();
    const hasToClassify = !!cvEl?.querySelector('.cvSection--toClassify, .cvExpEntry--toClassify');
    const hasUnsorted = !!cvEl?.querySelector('.cvSection--unsorted');
    const name = document.querySelector('#cvDoc .cvName')?.textContent?.trim() || '';
    const badName = /^(ben|music|reading)$/i.test(name);
    const strayMusic =
      /\n\s*music\s*\n/i.test(plain) ||
      (plain.split(/\n/).filter((l) => l.trim().toLowerCase() === 'music').length > 0);
    const unsortedLen = window.state?.resumeData?.unsorted?.length || 0;
    return { hasToClassify, hasUnsorted, badName, strayMusic, name, unsortedLen };
  });

  ok(!checks.hasToClassify, 'no À classer section in CV preview');
  ok(!checks.hasUnsorted, 'no unsorted section in CV preview');
  ok(!checks.badName, `CV name not garbage (${checks.name})`);
  ok(!checks.strayMusic, 'no stray Music line in CV preview');

  await browser.close();
  server.close();
}

await browserCheck();

console.log('\nZero raw OCR:', failed ? 'FAILED' : 'PASSED');
process.exit(failed ? 1 : 0);
