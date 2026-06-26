#!/usr/bin/env node
/**
 * HIRELY P0 — Review panel consistency (finalResumeData vs preview).
 */
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import {
  buildReviewChecklistFromFinalResume,
  detectReviewPreviewContradictions,
  filterSuggestionsNotInCv,
  getFinalResumeSectionCounts,
  isSuggestionAlreadyRendered,
} from '../core/validation/review-consistency.js';
import { computeTrustedCvReview } from '../core/validation/trusted-cv-review-engine.js';
import { resolveChecklistProfile } from '../core/validation/recruiter-checklist-source.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT = path.join(ROOT, 'tests/output/review-consistency/report.json');
const FIXTURE = path.join(ROOT, 'tests/fixtures/review-consistency-rich.txt');

const RICH_FINAL = {
  identity: {
    name: 'Yohann Azancot',
    title: 'Lead Illustrator',
    email: 'yohann@example.com',
    phone: '+33 6 12 34 56 78',
  },
  summary:
    'Senior illustrator and art director with fifteen years across luxury, entertainment, and technology clients worldwide.',
  experiences: [
    { role: 'Lead Illustrator', company: 'McCann Paris', dates: '2018–Present' },
    { role: 'Freelance', company: 'Nike, Apple', dates: '2012–2018' },
  ],
  education: [{ degree: 'MA Illustration', school: 'ENSAD', dates: '2010' }],
  skills: ['Illustration', 'Branding', 'Art direction'],
  tools: ['Photoshop', 'Illustrator'],
  languages: ['French — native', 'English — fluent'],
  clients: ['Nike'],
  projects: ['Brand campaign — 2024'],
  metaSafe: {},
  suggestions: [],
};

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

function mime(fp) {
  const ext = path.extname(fp).toLowerCase();
  return (
    {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.mjs': 'text/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.txt': 'text/plain',
    }[ext] || 'application/octet-stream'
  );
}

function startServer(port) {
  return http.createServer((req, res) => {
    const rel = (req.url || '/').split('?')[0];
    const fp = path.join(ROOT, decodeURIComponent(rel === '/' ? '/index.html' : rel));
    if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
      res.writeHead(404);
      res.end('not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': mime(fp) });
    fs.createReadStream(fp).pipe(res);
  });
}

function runUnitTests() {
  const counts = getFinalResumeSectionCounts(RICH_FINAL);
  ok(counts.education === 1, 'unit education count');
  ok(counts.experiences === 2, 'unit experiences count');

  const checklist = buildReviewChecklistFromFinalResume(RICH_FINAL);
  const byId = Object.fromEntries(checklist.map((c) => [c.id, c]));
  ok(byId.education?.ok, 'unit checklist education OK');
  ok(byId.experience?.ok, 'unit checklist experience OK');
  ok(byId.skills?.ok, 'unit checklist skills OK');
  ok(byId.languages?.ok, 'unit checklist languages OK');

  const profile = resolveChecklistProfile({ finalResumeData: RICH_FINAL, resumeData: RICH_FINAL });
  const review = computeTrustedCvReview(profile, { finalResumeData: RICH_FINAL, resumeData: RICH_FINAL });
  const missingIds = (review.missing || []).map((m) => m.id);
  ok(!missingIds.includes('education'), 'trusted review no false education missing');
  ok(!missingIds.includes('experience'), 'trusted review no false experience missing');
  ok(review.strengths.some((s) => s.id === 'education_listed'), 'trusted review education strength');

  const dup = filterSuggestionsNotInCv(
    [{ text: 'Illustration' }, { text: 'Totally new skill XYZ' }],
    RICH_FINAL,
    null
  );
  ok(dup.items.length === 1 && dup.items[0].text.includes('XYZ'), 'suggestions drop rendered skills');

  ok(
    isSuggestionAlreadyRendered('ENSAD', RICH_FINAL, null),
    'education school detected as rendered'
  );

  const audit = detectReviewPreviewContradictions({
    finalResumeData: RICH_FINAL,
    checklist,
    missingReviewIds: missingIds,
    suggestions: ['Orphan line not in CV'],
  });
  ok(audit.pass, 'unit contradiction audit');
}

async function runBrowserTests() {
  if (!fs.existsSync(FIXTURE)) {
    fs.writeFileSync(
      FIXTURE,
      `${RICH_FINAL.identity.name}\n${RICH_FINAL.identity.title}\n${RICH_FINAL.identity.email}\n${RICH_FINAL.identity.phone}\n\n${RICH_FINAL.summary}\n\nExperience\nLead Illustrator — McCann Paris — 2018–Present\nFreelance — Nike, Apple — 2012–2018\n\nEducation\nMA Illustration — ENSAD — 2010\n\nSkills\nIllustration · Branding · Art direction\n\nTools\nPhotoshop · Illustrator\n\nLanguages\nFrench — native · English — fluent\n`
    );
  }

  const port = 3090 + Math.floor(Math.random() * 40);
  const server = startServer(port);
  await new Promise((r) => server.listen(port, r));

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  try {
    await page.goto(`http://127.0.0.1:${port}/?pro=true`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(
      () => typeof window.HirelyParse?.importText === 'function',
      undefined,
      { timeout: 120000 }
    );

    const paste = fs.readFileSync(FIXTURE, 'utf8');
    await page.evaluate(async (text) => {
      await window.HirelyParse.importText(text, {
        source: 'paste-text',
        trusted: true,
        forceContinue: true,
      });
    }, paste);

    await page.waitForFunction(
      () => document.getElementById('cvDoc')?.classList.contains('cv--live'),
      undefined,
      { timeout: 120000 }
    );

    const snap = await page.evaluate(() => {
      const counts =
        typeof getFinalSectionCounts === 'function' ? getFinalSectionCounts() : null;
      const checklistItems = [...document.querySelectorAll('#reviewV2Checklist .atsCheckItem')].map(
        (li) => ({
          label: li.querySelector('.atsCheckLabel')?.textContent?.trim() || '',
          ok: li.classList.contains('is-ok'),
        })
      );
      const missingRows = [...document.querySelectorAll('#cvReviewMissing .cvReviewItem')].map(
        (li) => li.textContent?.trim() || ''
      );
      const suggestionTexts = [
        ...document.querySelectorAll('#suggestionsList .suggestionText'),
      ].map((el) => el.textContent?.trim() || '');
      const cvText = document.getElementById('cvDoc')?.innerText || '';
      return { counts, checklistItems, missingRows, suggestionTexts, cvTextLen: cvText.length };
    });

    ok(snap.cvTextLen > 120, `preview live (${snap.cvTextLen} chars)`);

    if ((snap.counts?.education || 0) > 0) {
      const eduRow = snap.checklistItems.find((r) => /formation|education/i.test(r.label));
      ok(!!eduRow?.ok, 'UI checklist Formation OK when education present');
      const eduMissing = snap.missingRows.some((r) => /education|formation/i.test(r));
      ok(!eduMissing, 'no education in review missing list');
    }

    if ((snap.counts?.experiences || 0) > 0) {
      const expRow = snap.checklistItems.find((r) => /expérience|experience/i.test(r.label));
      ok(!!expRow?.ok, 'UI checklist Expérience OK when experiences present');
    }

    const cvHay = await page.evaluate(() =>
      (document.getElementById('cvDoc')?.innerText || '').toLowerCase()
    );
    for (const text of snap.suggestionTexts) {
      const needle = text.toLowerCase().trim();
      if (needle.length >= 6 && cvHay.includes(needle)) {
        ok(false, `suggestion duplicates CV text: ${text.slice(0, 40)}`);
      }
    }
    if (!snap.suggestionTexts.length) ok(true, 'no duplicate suggestions in panel');

    return snap;
  } finally {
    await browser.close();
    server.close();
  }
}

async function main() {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  runUnitTests();
  const browserSnap = await runBrowserTests();

  const report = {
    feature: 'REVIEW_CONSISTENCY',
    generatedAt: new Date().toISOString(),
    browser: browserSnap,
    pass: failed === 0,
  };
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(failed ? '\nFAIL review-consistency' : '\nPASS review-consistency');
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
