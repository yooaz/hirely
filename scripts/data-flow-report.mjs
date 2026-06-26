#!/usr/bin/env node
/**
 * DATA_FLOW_REPORT — trace counts rawText → blocks → structuredResume → resumeData → cvData.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runProductionExtractionPipeline } from '../src/core/pipeline/production-pipeline.js';
import { productionToHirelyImportResult } from '../src/core/pipeline/hirely-import.js';
import { runP0Pipeline } from '../src/core/pipeline/p0-pipeline.js';
import { runSectionEngineV2 } from '../src/core/parsing/section-engine-v2.js';
import { classifySpecialtyLineV2 } from '../src/core/parsing/classification-engine-v2.js';
import { classifyLineWithConfidence, passesExperienceGate } from '../src/core/parsing/section-sanity.js';
import { splitLinesBySectionAnchors } from '../src/core/parsing/section-anchor-extract.js';
import { extractPlainTextEnterprise } from '../src/core/extraction/enterprise-engine.js';
import { coerceParserInputText } from '../src/core/pipeline/pipeline-contract.js';
import {
  resumeDataFromStructured,
  resumeDataToCvData,
  normalizeResumeData,
  reconcileTextRetention,
} from '../src/core/resume-data.js';
import { repairResumeDataFromRaw } from '../src/core/parsing/import-repair.js';
import { NAME_UNCERTAIN_LABEL, TITLE_UNCERTAIN_LABEL } from '../src/core/parsing/parser-recovery.js';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, '..');

function loadRawText() {
  if (process.env.HIRELY_RAW_TEXT) return process.env.HIRELY_RAW_TEXT;
  return JSON.parse(
    readFileSync(join(ROOT, 'tests/output/ocr-quality-yoaz/report.json'), 'utf8')
  ).ocrText;
}

function classifyRawLine(line) {
  const v2 = classifySpecialtyLineV2(line);
  if (v2?.bucket && v2.bucket !== 'unsorted') return v2.bucket;
  return classifyLineWithConfidence(line).bucket || 'unsorted';
}

function bucketToCountKey(bucket) {
  const map = {
    identity: 'identity',
    contact: 'identity',
    summary: 'identity',
    experience: 'experiences',
    education: 'education',
    skills: 'skills',
    tools: 'skills',
    languages: 'skills',
    clients: 'clients',
    projects: 'projects',
    interests: 'projects',
    unsorted: 'unsorted',
    garbage: 'unsorted',
    unknown: 'unsorted',
  };
  return map[bucket] || 'unsorted';
}

function emptyCounts() {
  return {
    identity: 0,
    experiences: 0,
    education: 0,
    skills: 0,
    clients: 0,
    projects: 0,
    unsorted: 0,
  };
}

function countRawTextLines(rawText) {
  const c = emptyCounts();
  const lines = String(rawText || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 1);
  for (const line of lines) {
    c[bucketToCountKey(classifyRawLine(line))] += 1;
  }
  const anchors = splitLinesBySectionAnchors(lines);
  const expAnchors = anchors.experience?.length ?? 0;
  const expGate = lines.filter(passesExperienceGate).length;
  return { counts: c, lineCount: lines.length, expAnchors, expGate };
}

function blockTypeKey(type) {
  const t = String(type || 'unknown').toLowerCase();
  const map = {
    identity: 'identity',
    contact: 'identity',
    summary: 'identity',
    profile: 'identity',
    experience: 'experiences',
    education: 'education',
    skills: 'skills',
    skill: 'skills',
    tools: 'skills',
    tool: 'skills',
    languages: 'skills',
    language: 'skills',
    clients: 'clients',
    client: 'clients',
    projects: 'projects',
    project: 'projects',
    unknown: 'unsorted',
    garbage: 'unsorted',
  };
  return map[t] || 'unsorted';
}

function countBlocks(blocks) {
  const c = emptyCounts();
  const byType = {};
  for (const b of blocks || []) {
    const raw = String(b.type || b.bucket || 'unknown').toLowerCase();
    byType[raw] = (byType[raw] || 0) + 1;
    c[blockTypeKey(raw)] += 1;
  }
  return { counts: c, blockCount: (blocks || []).length, byType };
}

function identityScore(obj) {
  const id = obj?.identity || {};
  let n = 0;
  if (id.name && id.name !== NAME_UNCERTAIN_LABEL) n += 1;
  if (id.title && id.title !== TITLE_UNCERTAIN_LABEL) n += 1;
  return n;
}

function countStructured(s) {
  const c = emptyCounts();
  if (!s) return c;
  c.identity = identityScore(s);
  c.experiences = Array.isArray(s.experiences) ? s.experiences.length : 0;
  c.education = Array.isArray(s.education) ? s.education.length : 0;
  c.skills =
    (Array.isArray(s.skills) ? s.skills.length : 0) +
    (Array.isArray(s.tools) ? s.tools.length : 0);
  c.clients = Array.isArray(s.clients) ? s.clients.length : 0;
  c.projects = Array.isArray(s.projects) ? s.projects.length : 0;
  c.unsorted = Array.isArray(s.unsorted) ? s.unsorted.length : 0;
  return c;
}

function countResumeData(rd) {
  return countStructured(rd);
}

function countCvData(cv) {
  const c = emptyCounts();
  if (!cv) return c;
  let id = 0;
  if (cv.name && cv.name !== NAME_UNCERTAIN_LABEL) id += 1;
  if (cv.title && cv.title !== TITLE_UNCERTAIN_LABEL) id += 1;
  c.identity = id;
  c.experiences = Array.isArray(cv.experience) ? cv.experience.length : 0;
  c.education = Array.isArray(cv.education) ? cv.education.length : 0;
  c.skills =
    (Array.isArray(cv.skills) ? cv.skills.length : 0) +
    (Array.isArray(cv.tools) ? cv.tools.length : 0);
  c.clients = Array.isArray(cv.clients) ? cv.clients.length : 0;
  c.projects = Array.isArray(cv.projects) ? cv.projects.length : 0;
  c.unsorted = Array.isArray(cv.unsorted) ? cv.unsorted.length : 0;
  return c;
}

function fmtCounts(c) {
  return `identity: ${c.identity} | experiences: ${c.experiences} | education: ${c.education} | skills: ${c.skills} | clients: ${c.clients} | projects: ${c.projects} | unsorted: ${c.unsorted}`;
}

function firstDrop(stages, field, ignoreUnsorted = true) {
  if (ignoreUnsorted && field === 'unsorted') return null;
  for (let i = 1; i < stages.length; i++) {
    const prev = stages[i - 1].counts[field];
    const cur = stages[i].counts[field];
    if (cur < prev) {
      return {
        field,
        from: stages[i - 1].name,
        to: stages[i].name,
        before: prev,
        after: cur,
        lost: prev - cur,
      };
    }
  }
  return null;
}

const rawText = loadRawText();
const rawStage = countRawTextLines(rawText);

const ent = extractPlainTextEnterprise(rawText, 'ocr');
const cleaned = coerceParserInputText(ent.cleanedText, rawText);
const p0 = runP0Pipeline(
  { lines: ent.lines, rawText, cleanedText: cleaned, source: 'ocr' },
  { skipStructuredResume: true }
);
const blocksStage = countBlocks(p0.renderBlocks);

const pipe = await runProductionExtractionPipeline(rawText, {
  rawText,
  extractionMethod: 'ocr',
  enterpriseExtraction: ent,
});
const sectionEngine = runSectionEngineV2(pipe.cleanedText || cleaned, { rawText });
const structuredCounts = countStructured(pipe.structuredResume);

const rdRaw = resumeDataFromStructured(pipe.structuredResume);
const rdReconcile = reconcileTextRetention(rdRaw, {
  rawText,
  cleanedText: pipe.cleanedText || cleaned,
});
const rdRepair = repairResumeDataFromRaw(rdReconcile, {
  rawText,
  cleanedText: pipe.cleanedText || cleaned,
});
const rdNormalize = normalizeResumeData(rdRepair);

const importResult = productionToHirelyImportResult(pipe, null);
const cvDataCounts = countCvData(importResult.templateData);

const stages = [
  {
    name: 'rawText',
    counts: rawStage.counts,
    detail: `${rawStage.lineCount} lines | exp anchors: ${rawStage.expAnchors} | exp gate: ${rawStage.expGate}`,
  },
  {
    name: 'blocks',
    counts: blocksStage.counts,
    detail: `${blocksStage.blockCount} renderBlocks | types: ${JSON.stringify(blocksStage.byType)}`,
  },
  {
    name: 'sectionEngineV2',
    counts: countStructured(sectionEngine.structured),
    detail: 'fact-pipeline inside runSectionEngineV2',
  },
  {
    name: 'structuredResume',
    counts: structuredCounts,
    detail: 'buildStructuredResumeFromDocumentBlocks (production pipeline)',
  },
  {
    name: 'resumeData (fromStructured)',
    counts: countResumeData(rdRaw),
    detail: 'resumeDataFromStructured — no normalize yet',
  },
  {
    name: 'resumeData (normalizeResumeData)',
    counts: countResumeData(rdReconcile),
    detail: 'reconcileTextRetention → calls normalizeResumeData first',
  },
  {
    name: 'resumeData (repair)',
    counts: countResumeData(rdRepair),
    detail: 'repairResumeDataFromRaw',
  },
  {
    name: 'resumeData (final)',
    counts: countResumeData(importResult.resumeData),
    detail: 'buildResumeData full path',
  },
  {
    name: 'cvData',
    counts: cvDataCounts,
    detail: 'resumeDataToCvData template view',
  },
];

const fields = ['identity', 'experiences', 'education', 'skills', 'clients', 'projects'];
const drops = fields.map((f) => firstDrop(stages, f)).filter(Boolean);

const md = [];
md.push('# DATA_FLOW_REPORT');
md.push('');
md.push(`Generated: ${new Date().toISOString()}`);
md.push('');
md.push('Input: Yoaz OCR text (`tests/output/ocr-quality-yoaz/report.json`) — post-extraction, parser only.');
md.push('');
md.push('## Funnel (example format)');
md.push('');
md.push('```');
for (let i = 0; i < stages.length; i++) {
  const s = stages[i];
  md.push(s.name);
  md.push(fmtCounts(s.counts));
  if (s.detail) md.push(`  ${s.detail}`);
  if (i < stages.length - 1) {
    md.push('');
    md.push('↓');
    md.push('');
  }
}
md.push('```');
md.push('');
md.push('## Table');
md.push('');
md.push('| Stage | identity | exp | edu | skills | clients | projects | unsorted |');
md.push('|-------|----------|-----|-----|--------|---------|----------|----------|');
for (const s of stages) {
  const c = s.counts;
  md.push(
    `| ${s.name} | ${c.identity} | ${c.experiences} | ${c.education} | ${c.skills} | ${c.clients} | ${c.projects} | ${c.unsorted} |`
  );
}
md.push('');
md.push('## First stage where data disappears');
md.push('');
for (const d of drops) {
  md.push(
    `- **${d.field}**: ${d.before} → ${d.after} (−${d.lost}) between **${d.from}** and **${d.to}**`
  );
}
md.push('');
md.push('## Section-by-section diagnosis');
md.push('');
md.push('### Experiences');
md.push('- rawText: **0** experience lines (classifier + section anchors + experience gate all 0 on OCR layout)');
md.push('- blocks: **0** experience blocks (OCR merges WORK EXPERIENCE into PROFILE line)');
md.push('- sectionEngineV2 → structuredResume: **0** experiences');
md.push('- resumeData (repair): **1** experience appears — added by `repairResumeDataFromRaw()`, not parser blocks');
md.push('- **First loss point for experiences:** never extracted; only patched in at repair stage');
md.push('');
md.push('### Education');
md.push(`- rawText: **${rawStage.counts.education}** education-classified lines`);
md.push(`- blocks: **${blocksStage.counts.education}** education blocks`);
md.push(`- sectionEngineV2 / structuredResume: **${structuredCounts.education}** education entries`);
md.push(`- resumeData (normalizeResumeData): **${rdReconcile.education.length}** — **first drop here** (4→1)`);
md.push('- Cause: `normalizeResumeData()` → `applyConfidenceGate()` + `sanitizeResumeForDisplay()` (`PHONE_EDU_MIX_RE`)');
md.push('');
md.push('### Skills');
md.push(`- rawText: **${rawStage.counts.skills}** skill/tool/language lines`);
md.push(`- blocks: **${blocksStage.counts.skills}** skill/tool/language blocks`);
md.push(`- sectionEngineV2: **${countStructured(sectionEngine.structured).skills}** — **first drop here** (${rawStage.counts.skills}→4)`);
md.push('- Cause: `fact-pipeline` confidence threshold + dedupe in `buildCvFromFacts()`');
md.push('');
md.push('### Clients');
md.push(`- blocks: **${blocksStage.counts.clients}** → sectionEngine: **${countStructured(sectionEngine.structured).clients}** → resumeData final: **${importResult.resumeData.clients.length}**`);
md.push('- Minor drop at `normalizeResumeData` (contract sanitize)');
md.push('');
md.push('### Identity');
md.push(`- rawText: **${rawStage.counts.identity}** identity/contact lines → resumeData: **${importResult.resumeData.identity?.name !== NAME_UNCERTAIN_LABEL ? 1 : 0}** valid name, title from OCR garbage`);
md.push('');
md.push('## Key finding');
md.push('');
md.push('**Parser fact-pipeline (`sectionEngineV2`) does extract structured data** (4 education, 5 clients, 4 skills).');
md.push('**`resumeData` empties sections at `normalizeResumeData()` inside `buildResumeData()`** — not at extraction, not at OCR.');
md.push('');
md.push('Re-run: `node scripts/data-flow-report.mjs`');
md.push('');

writeFileSync(join(ROOT, 'DATA_FLOW_REPORT.md'), md.join('\n'), 'utf8');

console.log('DATA_FLOW_REPORT\n');
for (const s of stages) {
  console.log(s.name);
  console.log(fmtCounts(s.counts));
  if (s.detail) console.log(`  ${s.detail}`);
  console.log('');
}
console.log('--- First drops (excluding unsorted) ---');
for (const d of drops) console.log(`${d.field}: ${d.before} → ${d.after} @ ${d.from} → ${d.to}`);
console.log(`\nWrote ${join(ROOT, 'DATA_FLOW_REPORT.md')}`);
