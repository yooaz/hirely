#!/usr/bin/env node
/**
 * UNSORTED audit — trace parser pipeline; no fixes.
 * Input: OCR text from tests/output/ocr-quality-yoaz/report.json (or HIRELY_OCR_TEXT).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runSectionEngineV2 } from '../src/core/parsing/section-engine-v2.js';
import { detectSectionBlocks } from '../src/core/parsing/section-detect-v2.js';
import { classifySectionBlocks } from '../src/core/parsing/section-classify-v2.js';
import { extractFactsFromSectionBlocks } from '../src/core/parsing/fact-extraction.js';
import { runFactPipeline } from '../src/core/parsing/fact-pipeline.js';
import {
  buildCvFromFacts,
  partitionFactsByConfidence,
} from '../src/core/parsing/cv-from-facts.js';
import { buildExperiencesFromClassifiedBlocks } from '../src/core/parsing/experience-builder-v2.js';
import {
  applyZeroTextLossMode,
  recoverOrphansToUnsortedArchive,
} from '../src/core/parsing/zero-text-loss.js';
import { classifySpecialtyLineV2 } from '../src/core/parsing/classification-engine-v2.js';
import { classifyLineWithConfidence } from '../src/core/parsing/section-sanity.js';
import { FACT_CONFIDENCE_THRESHOLD } from '../src/core/parsing/fact-types.js';
import { buildResumeData } from '../src/core/resume-data.js';
import { runHirelyImportFromText } from '../src/core/pipeline/hirely-import.js';
import { SECTION_IDS } from '../src/core/parsing/section-types-v2.js';
import { splitListItems } from '../src/core/parsing/rich-parser.js';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, '..');

function normLine(s) {
  return String(s || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function loadOcrText() {
  if (process.env.HIRELY_OCR_TEXT) return process.env.HIRELY_OCR_TEXT;
  const reportPath = join(ROOT, 'tests/output/ocr-quality-yoaz/report.json');
  const report = JSON.parse(readFileSync(reportPath, 'utf8'));
  return report.ocrText;
}

function predictSection(line) {
  const v2 = classifySpecialtyLineV2(line);
  if (v2 && v2.bucket && v2.bucket !== 'unsorted') {
    return {
      section: v2.bucket,
      confidence: v2.confidence,
      signals: v2.signals || [],
      engine: 'classification-engine-v2',
    };
  }
  const legacy = classifyLineWithConfidence(line);
  return {
    section: legacy.bucket || 'unsorted',
    confidence: legacy.confidence || 0,
    signals: legacy.signals || [],
    engine: 'section-sanity',
  };
}

function sectionToCounterKey(section) {
  const map = {
    experience: 'experiences',
    experiences: 'experiences',
    education: 'education',
    skills: 'skills',
    skill: 'skills',
    tools: 'tools',
    tool: 'tools',
    languages: 'languages',
    language: 'languages',
    clients: 'clients',
    client: 'clients',
    projects: 'projects',
    project: 'projects',
  };
  return map[section] || null;
}

function countSectionItems(lines, section) {
  const key = sectionToCounterKey(section);
  if (!key) return 0;
  let count = 0;
  for (const line of lines) {
    if (key === 'experiences') {
      count += 1;
      continue;
    }
    const parts = splitListItems(line);
    count += parts.length >= 2 ? parts.length : 1;
  }
  return count;
}

function classifyBlockSection(block) {
  return block.type || block.sectionHint || SECTION_IDS.UNKNOWN;
}

const ocrText = loadOcrText();
const rawLines = ocrText
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter((l) => l.length > 0);

const importResult = await runHirelyImportFromText(ocrText);
const resumeData = importResult.resumeData || {};
const unsortedFinal = resumeData.unsorted || [];

// ── Stage traces ──────────────────────────────────────────────────────────
const detection = detectSectionBlocks(ocrText, {});
const classified = classifySectionBlocks(detection.blocks);
const facts = extractFactsFromSectionBlocks(classified, { rawText: ocrText });
const { accepted, pending } = partitionFactsByConfidence(facts, FACT_CONFIDENCE_THRESHOLD);

const factPipeline = runFactPipeline(classified, { rawText: ocrText });
const afterFacts = { ...factPipeline.structured };
const beforeZeroLoss = JSON.parse(JSON.stringify(afterFacts));

const zeroLoss = applyZeroTextLossMode(ocrText, afterFacts, { throwOnPipelineLoss: false });
const afterZeroLoss = zeroLoss.structured;

const expBuild = buildExperiencesFromClassifiedBlocks(classified);

// Map facts by source line
const factsByLine = new Map();
for (const fact of facts) {
  const key = normLine(fact.sourceLine || fact.value);
  if (!factsByLine.has(key)) factsByLine.set(key, []);
  factsByLine.get(key).push(fact);
}

const pendingLines = new Set(
  pending.map((f) => normLine(f.sourceLine || f.value)).filter(Boolean)
);
const acceptedLines = new Set(
  accepted.map((f) => normLine(f.sourceLine || f.value)).filter(Boolean)
);

const expRejectedLines = new Map();
for (const r of expBuild.audit?.rejected || []) {
  for (const line of r.lines || []) {
    expRejectedLines.set(normLine(line), r.reason || 'experience_rejected');
  }
}

// Zero-loss orphans: lines added by recoverOrphansToUnsortedArchive
const beforeUnsorted = new Set((beforeZeroLoss.unsorted || []).map(normLine));
const afterOrphan = recoverOrphansToUnsortedArchive(ocrText, JSON.parse(JSON.stringify(beforeZeroLoss)));
const orphanOnly = (afterOrphan.unsorted || []).filter(
  (l) => !beforeUnsorted.has(normLine(l))
);
const orphanSet = new Set(orphanOnly.map(normLine));

// Block assignment trace
const blockByLine = new Map();
for (const block of classified) {
  for (const line of block.lines || []) {
    blockByLine.set(normLine(line), {
      blockType: classifyBlockSection(block),
      blockConfidence: block.classifiedConfidence ?? block.confidence ?? null,
      classifyReason: block.classifyReason || null,
    });
  }
}

function resolveRejection(line) {
  const k = normLine(line);
  const pred = predictSection(line);
  const block = blockByLine.get(k);
  const lineFacts = factsByLine.get(k) || [];

  if (orphanSet.has(k)) {
    return {
      predictedSection: pred.section,
      confidence: pred.confidence,
      reason: 'ZERO_TEXT_LOSS_ORPHAN — recoverOrphansToUnsortedArchive() in zero-text-loss.js',
      sourceFunction: 'recoverOrphansToUnsortedArchive',
      sourceFile: 'zero-text-loss.js',
    };
  }

  if (expRejectedLines.has(k)) {
    return {
      predictedSection: pred.section,
      confidence: pred.confidence,
      reason: `EXPERIENCE_BUILDER_REJECTED — ${expRejectedLines.get(k)} (experience-builder-v2.js)`,
      sourceFunction: 'buildExperiencesFromClassifiedBlocks',
      sourceFile: 'experience-builder-v2.js',
    };
  }

  const pendingFact = lineFacts.find((f) => f.confidence < FACT_CONFIDENCE_THRESHOLD);
  if (pendingFact || pendingLines.has(k)) {
    const fact = pendingFact || lineFacts[0];
    const conf = fact ? Math.round((fact.confidence || 0) * 100) : pred.confidence;
    const type = fact?.type || pred.section;
    return {
      predictedSection: type,
      confidence: conf,
      reason: `FACT_BELOW_THRESHOLD — confidence ${conf}% < ${FACT_CONFIDENCE_THRESHOLD * 100}% → buildCvFromFacts() pending → mergeUnsortedLines() (cv-from-facts.js:217)`,
      sourceFunction: 'buildCvFromFacts',
      sourceFile: 'cv-from-facts.js',
    };
  }

  if (lineFacts.length && !acceptedLines.has(k)) {
    const fact = lineFacts[0];
    return {
      predictedSection: fact.type,
      confidence: Math.round((fact.confidence || 0) * 100),
      reason: `FACT_NOT_ACCEPTED — type=${fact.type} confidence=${Math.round((fact.confidence || 0) * 100)}% (fact-pipeline / fact-classifier)`,
      sourceFunction: 'extractFactsFromSectionBlocks',
      sourceFile: 'fact-extraction.js',
    };
  }

  if (pred.section === 'unsorted' || pred.confidence < 80) {
    return {
      predictedSection: pred.section,
      confidence: pred.confidence,
      reason: `LOW_CLASSIFICATION — ${pred.engine} bucket=${pred.section} confidence=${pred.confidence}%`,
      sourceFunction: 'classifyLineForFacts',
      sourceFile: 'fact-extraction.js',
    };
  }

  if (block && block.blockType === SECTION_IDS.UNKNOWN) {
    return {
      predictedSection: pred.section,
      confidence: pred.confidence,
      reason: `UNKNOWN_SECTION_BLOCK — section-engine-v2 classified block as UNKNOWN`,
      sourceFunction: 'classifySectionBlocks',
      sourceFile: 'section-classify-v2.js',
    };
  }

  return {
    predictedSection: pred.section,
    confidence: pred.confidence,
    reason: `UNMAPPED_TO_SECTION — predicted ${pred.section} but not placed in structured resume (section-field-extract-v2 → fact-pipeline)`,
    sourceFunction: 'extractFieldsFromSectionBlocks',
    sourceFile: 'section-field-extract-v2.js',
  };
}

const auditRows = unsortedFinal.map((line) => {
  const rejection = resolveRejection(line);
  return {
    line,
    predictedSection: rejection.predictedSection,
    confidence: rejection.confidence,
    reason: rejection.reason,
    sourceFunction: rejection.sourceFunction,
    sourceFile: rejection.sourceFile,
  };
});

// Counterfactual: if all unsorted accepted into predicted sections
const counterfactual = {
  experiences: resumeData.experiences?.length || 0,
  education: resumeData.education?.length || 0,
  skills: resumeData.skills?.length || 0,
  clients: resumeData.clients?.length || 0,
  projects: resumeData.projects?.length || 0,
  languages: resumeData.languages?.length || 0,
};

for (const row of auditRows) {
  const key = sectionToCounterKey(row.predictedSection);
  if (!key) continue;
  counterfactual[key] += countSectionItems([row.line], row.predictedSection);
}

// Source function histogram
const sourceHist = {};
for (const row of auditRows) {
  const k = `${row.sourceFile} → ${row.sourceFunction}`;
  sourceHist[k] = (sourceHist[k] || 0) + 1;
}

const sectionEngine = runSectionEngineV2(ocrText, { rawText: ocrText });

// ── Console output ──────────────────────────────────────────────────────────
console.log('\n=== UNSORTED LINE AUDIT ===\n');
for (const row of auditRows) {
  console.log(`LINE: ${row.line}`);
  console.log(`PREDICTED: ${row.predictedSection}`);
  console.log(`CONFIDENCE: ${row.confidence}`);
  console.log(`REASON: ${row.reason}`);
  console.log(`SOURCE: ${row.sourceFile} → ${row.sourceFunction}`);
  console.log('---');
}

console.log('\n=== RESUME DATA STATE ===');
console.log(
  JSON.stringify(
    {
      identity: resumeData.identity,
      clients: resumeData.clients?.length,
      experiences: resumeData.experiences?.length,
      education: resumeData.education?.length,
      skills: resumeData.skills?.length,
      languages: resumeData.languages?.length,
      projects: resumeData.projects?.length,
      unsorted: unsortedFinal.length,
    },
    null,
    2
  )
);

console.log('\n=== COUNTERFACTUAL (all unsorted accepted) ===');
console.log(JSON.stringify(counterfactual, null, 2));

// ── Markdown report ───────────────────────────────────────────────────────
const md = [];
md.push('# UNSORTED_AUDIT');
md.push('');
md.push(`Generated: ${new Date().toISOString()}`);
md.push('');
md.push('## Pipeline trace');
md.push('');
md.push('| Stage | File | Role |');
md.push('|-------|------|------|');
md.push('| 1 | `section-engine-v2.js` | `runSectionEngineV2()` — detect → classify → extract |');
md.push('| 2 | `section-field-extract-v2.js` | delegates to `runFactPipeline()` |');
md.push('| 3 | `fact-pipeline.js` | `extractFactsFromSectionBlocks()` → `buildCvFromFacts()` |');
md.push('| 4 | `experience-builder-v2.js` | `buildExperiencesFromClassifiedBlocks()` — rejected → unsorted |');
md.push('| 5 | `zero-text-loss.js` | `recoverOrphansToUnsortedArchive()` — orphan lines → unsorted |');
md.push('| 6 | `buildResumeData()` | `resumeDataFromStructured()` — copies `structured.unsorted` |');
md.push('');
md.push('## Exact functions that write to `unsorted`');
md.push('');
md.push('1. **`buildCvFromFacts()`** — `cv-from-facts.js:217-221`');
md.push('   ```js');
md.push('   structured.unsorted = mergeUnsortedLines(structured.unsorted, pendingValues)');
md.push('   ```');
md.push('   Pending facts (confidence < 80%) are pushed here.');
md.push('');
md.push('2. **`buildExperiencesFromClassifiedBlocks()`** — `experience-builder-v2.js:315,326,343,382`');
md.push('   Rejected experience candidates push lines to local `unsorted[]`, then `applyExperienceV2Unsorted()` merges.');
md.push('');
md.push('3. **`recoverOrphansToUnsortedArchive()`** — `zero-text-loss.js:178`');
md.push('   ```js');
md.push('   s.unsorted = mergeUnsortedLines(s.unsorted, archiveTexts)');
md.push('   ```');
md.push('   Called by `applyZeroTextLossMode()` inside `runSectionEngineV2()`.');
md.push('');
md.push('4. **`enforceStructuredSectionContract()`** — `cv-section-contract.js:277-280`');
md.push('   Contract violations merged into `structured.unsorted`.');
md.push('');
md.push('5. **`buildStructuredResumeFromBlocks()`** — `structured-resume-from-blocks.js` (flow-lock / block path)');
md.push('   Low-confidence blocks, default bucket, `strict.unclassified`, `ingestExperienceBlock` orphans.');
md.push('');
md.push('## Current resumeData');
md.push('');
md.push('```json');
md.push(
  JSON.stringify(
    {
      identity: resumeData.identity,
      clients: resumeData.clients?.length,
      experiences: resumeData.experiences?.length,
      education: resumeData.education?.length,
      skills: resumeData.skills?.length,
      languages: resumeData.languages?.length,
      projects: resumeData.projects?.length,
      unsorted: unsortedFinal.length,
    },
    null,
    2
  )
);
md.push('```');
md.push('');
md.push('## Source histogram (where unsorted lines originate)');
md.push('');
for (const [src, n] of Object.entries(sourceHist).sort((a, b) => b[1] - a[1])) {
  md.push(`- **${src}**: ${n} lines`);
}
md.push('');
md.push(`## All ${unsortedFinal.length} unsorted lines`);
md.push('');
md.push('| # | Line | Predicted section | Confidence | Why rejected | Source |');
md.push('|---|------|-------------------|------------|--------------|--------|');
auditRows.forEach((row, i) => {
  const esc = (s) => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
  md.push(
    `| ${i + 1} | ${esc(row.line)} | ${esc(row.predictedSection)} | ${row.confidence} | ${esc(row.reason)} | ${esc(row.sourceFile)} → ${esc(row.sourceFunction)} |`
  );
});
md.push('');
md.push('## Counterfactual — if all rejected lines were accepted');
md.push('');
md.push('| Section | Current count | If unsorted accepted | Delta |');
md.push('|---------|---------------|----------------------|-------|');
for (const key of ['experiences', 'education', 'skills', 'clients', 'projects', 'languages']) {
  const cur = {
    experiences: resumeData.experiences?.length || 0,
    education: resumeData.education?.length || 0,
    skills: resumeData.skills?.length || 0,
    clients: resumeData.clients?.length || 0,
    projects: resumeData.projects?.length || 0,
    languages: resumeData.languages?.length || 0,
  }[key];
  const cf = counterfactual[key];
  md.push(`| ${key} | ${cur} | ${cf} | +${cf - cur} |`);
}
md.push('');
md.push('## Parser stage counts');
md.push('');
md.push(`- Raw OCR lines: ${rawLines.length}`);
md.push(`- Section blocks detected: ${detection.blocks?.length ?? 0}`);
md.push(`- Classified blocks: ${classified.length}`);
md.push(`- Facts extracted: ${facts.length}`);
md.push(`- Facts accepted (≥80%): ${accepted.length}`);
md.push(`- Facts pending (<80%): ${pending.length}`);
md.push(`- Experience builder rejected groups: ${expBuild.audit?.rejected?.length ?? 0}`);
md.push(`- Zero-loss orphan lines added: ${orphanOnly.length}`);
md.push(`- Section engine unsorted: ${sectionEngine.structured?.unsorted?.length ?? 0}`);
md.push('');

const outPath = join(ROOT, 'UNSORTED_AUDIT.md');
writeFileSync(outPath, md.join('\n'), 'utf8');
console.log(`\nWrote ${outPath}`);
