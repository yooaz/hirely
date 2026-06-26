#!/usr/bin/env node
/**
 * Core flow — sample, paste, parse, score, export text (core/extraction.js).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadHirelyParse } from './load-hirely-parse.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');

const PASTE_CV = `Marie Dupont
Product Manager
marie.dupont@email.com
+33 6 12 34 56 78
Paris, France

Summary
Product manager with 8 years in B2B SaaS.

Experience
Senior Product Manager — Acme — 2019 – Present
- Shipped billing module used by 120k users.

Skills
Product strategy, Agile, SQL`;

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function formatCvAsText(p) {
  const lines = [];
  if (p.name) lines.push(p.name);
  if (p.title) lines.push(p.title);
  const contact = [p.location, p.email, p.phone, p.portfolio, p.linkedin].filter(Boolean);
  if (contact.length) lines.push(contact.join(' · '));
  if (p.summary) {
    lines.push('');
    lines.push(p.summary);
  }
  if (p.experience?.length) {
    lines.push('');
    p.experience.forEach((x) => lines.push('- ' + x));
  }
  if (p.skills?.length) {
    lines.push('');
    lines.push(p.skills.join(', '));
  }
  return lines.join('\n').trim();
}

function hasValidInput(state) {
  return String(state.text || '').trim().length >= 20 && !!state.cvData;
}

function cvDataIsRenderable(d) {
  if (!d) return false;
  return !!(d.name || d.summary || d.experience?.length || d.skills?.length);
}

async function main() {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const Parse = await loadHirelyParse();
  const sampleText = html.slice(html.indexOf('const sample=`') + 14, html.indexOf('`;', html.indexOf('const sample=`')));

  const state = { text: '', cvData: null, score: null };

  assert(!hasValidInput(state), 'score blocked before input');

  state.text = sampleText;
  state.cvData = Parse.parseCV(sampleText);
  state.score = Parse.scoreCV(state.cvData);
  assert(hasValidInput(state), 'score after sample');
  assert(state.cvData.name === 'Yohann Azancot', `sample name: ${state.cvData.name}`);
  assert(state.cvData.experience.length >= 1, 'sample experience');
  assert(state.score.overall >= 35 && state.score.overall <= 92, 'sample score range');
  console.log('OK use sample');

  state.cvData = null;
  state.score = null;
  state.text = '';
  assert(!hasValidInput(state), 'score reset after clear');

  state.text = PASTE_CV;
  state.cvData = Parse.parseCV(PASTE_CV);
  state.score = Parse.scoreCV(state.cvData);
  assert(state.cvData.name.includes('Marie'), 'paste name');
  console.log('OK paste text');

  const txtPipe = await Parse.runExtractionPipeline(PASTE_CV);
  assert(Parse.buildCvDataFromPipeline(txtPipe).email, 'TXT parse email');
  console.log('OK TXT content parse');

  const pdfFail = await Parse.runExtractionPipeline('   ');
  assert(!pdfFail.canGenerate, 'empty PDF text must not commit');
  console.log('OK PDF empty rejection');

  const norm = Parse.parseCV(PASTE_CV);
  assert(norm.experience.length >= 1, 'experience kept');
  console.log('OK normalizeCvData');

  const report = state.score;
  assert(report && report.overall > 0, 'recruiter score after input');
  assert(report.overall >= 35 && report.overall <= 92, `score clamp 35–92: ${report.overall}`);
  assert(report.ats && report.readability && report.impact && report.completeness, 'score dimensions');
  console.log('OK recruiter score');

  const txt = formatCvAsText(state.cvData);
  assert(txt.includes('Marie Dupont'), 'export text has name');
  assert(!/Candidate Name|email@example/i.test(txt), 'no placeholders in export');
  assert(txt.includes('Product strategy') || txt.includes('Agile'), 'export has skills');
  console.log('OK TXT export format');

  const partial = `Alex Martin
Designer

I am a creative professional with ten years of experience across branding and digital.

Led visual systems for retail and culture clients.
Built campaign assets end to end.

Skills: branding, typography, layout`;
  const partialData = Parse.parseCV(partial);
  const partialScore = Parse.scoreCV(partialData);
  assert(cvDataIsRenderable(partialData), 'partial cvData renderable');
  assert(partialScore.overall >= 35 && partialScore.overall <= 92, 'partial score in range');
  console.log('OK partial CV fallback');

  process.exit(0);
}

try {
  await main();
} catch (e) {
  console.error('FAIL core-flow:', e.message);
  process.exit(1);
}
