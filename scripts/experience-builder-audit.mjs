#!/usr/bin/env node
/**
 * EXPERIENCE_BUILDER_AUDIT — trace experience-builder-v2, recovery, rebuilder on OCR input.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runProductionExtractionPipeline } from '../src/core/pipeline/production-pipeline.js';
import { runP0Pipeline } from '../src/core/pipeline/p0-pipeline.js';
import { runSectionEngineV2 } from '../src/core/parsing/section-engine-v2.js';
import { extractPlainTextEnterprise } from '../src/core/extraction/enterprise-engine.js';
import { coerceParserInputText } from '../src/core/pipeline/pipeline-contract.js';
import {
  buildExperiencesFromClassifiedBlocks,
  filterExperienceBlocksOnly,
  validateExperienceCandidate,
  normalizeExperienceFields,
} from '../src/core/parsing/experience-builder-v2.js';
import {
  buildExperienceEntryFromLineGroup,
  qualifiesStrictExperience,
  scoreStrictExperienceEntry,
  parseStrictExperiencesFromLines,
  EXPERIENCE_PARSER_CONFIDENCE_MIN,
} from '../src/core/parsing/experience-parser.js';
import {
  scanDraftExperiences,
  runExperienceRecovery,
  shouldRunExperienceRecovery,
} from '../src/core/parsing/experience-recovery.js';
import {
  rebuildExperiencesFromText,
  runExperienceRebuilder,
  detectExperienceParserFailed,
} from '../src/core/parsing/experience-rebuilder.js';
import { repairResumeDataFromRaw } from '../src/core/parsing/import-repair.js';
import { resumeDataFromStructured } from '../src/core/resume-data.js';
import { SECTION_IDS } from '../src/core/parsing/section-types-v2.js';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, '..');

function loadOcrText() {
  if (process.env.HIRELY_RAW_TEXT) return process.env.HIRELY_RAW_TEXT;
  return JSON.parse(
    readFileSync(join(ROOT, 'tests/output/ocr-quality-yoaz/report.json'), 'utf8')
  ).ocrText;
}

const DATE_RANGE_RE =
  /\b((?:19|20)\d{2})\s*[-–—]\s*(present|présent|current|now|aujourd'?hui|actuel|\d{4})\b/i;
const YEAR_PAIR_RE = /\b((?:19|20)\d{2})\s+(?:20M|(?:19|20)\d{2})\b/i;
const YEAR_IN_LINE_RE = /\b(19|20)\d{2}\b/;

function lineHasCareerDate(line) {
  const l = String(line || '');
  return DATE_RANGE_RE.test(l) || YEAR_PAIR_RE.test(l) || YEAR_IN_LINE_RE.test(l);
}

function linesFrom(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

function validateDraft(draft, ctx = {}) {
  const entry = normalizeExperienceFields({ ...draft });
  const validation = validateExperienceCandidate(entry, {
    inExperienceSection: ctx.inExperienceSection ?? false,
    minConfidence: ctx.minConfidence,
  });
  return { entry, validation };
}

function explainParserNull(group, lines, idx) {
  const entry = buildExperienceEntryFromLineGroup(group);
  if (entry) {
    return {
      built: true,
      entry,
      qualifies: qualifiesStrictExperience(entry),
      score: scoreStrictExperienceEntry(entry),
      minConf: EXPERIENCE_PARSER_CONFIDENCE_MIN,
    };
  }

  const blob = group.join('\n');
  const dates = blob.match(DATE_RANGE_RE);
  let role = '';
  let company = '';
  const reasons = [];

  for (const line of group) {
    const withoutDates = line.replace(DATE_RANGE_RE, '').replace(/\b(19|20)\d{2}\b/g, '').trim();
    if (/\bfreelanc/i.test(withoutDates)) {
      role = withoutDates;
      company = 'Independent / Freelance';
    }
  }

  const probe = {
    role: role || '(empty)',
    company: company || '(empty)',
    startDate: dates ? dates[1] : '',
    endDate: dates ? dates[2] : '',
  };

  if (!probe.startDate) reasons.push('no_start_date_extracted');
  if (!probe.role && !probe.company) reasons.push('missing_role_and_company');
  if (probe.role && /\b\d{1,2}[-\s]?year\s*old\b/i.test(probe.role)) reasons.push('age_as_role');
  if (!qualifiesStrictExperience(probe)) reasons.push('qualifiesStrictExperience_false');
  const score = scoreStrictExperienceEntry(probe);
  if (score < EXPERIENCE_PARSER_CONFIDENCE_MIN) reasons.push(`confidence_${score}_below_${EXPERIENCE_PARSER_CONFIDENCE_MIN}`);

  return {
    built: false,
    group,
    lineIndex: idx,
    probe,
    reasons: reasons.length ? reasons : ['buildExperienceEntryFromLineGroup_returned_null'],
  };
}

function formatEntry(e) {
  return {
    role: e.role || '',
    company: e.company || '',
    startDate: e.startDate || '',
    endDate: e.endDate || '',
    dates: e.dates || '',
    confidence: e.confidence ?? null,
    bullets: (e.bullets || []).slice(0, 2),
  };
}

async function main() {
  const ocrText = loadOcrText();
  const lines = linesFrom(ocrText);

  const ent = extractPlainTextEnterprise(ocrText, 'ocr');
  const cleaned = coerceParserInputText(ent.cleanedText, ocrText);
  const p0 = runP0Pipeline(
    { lines: ent.lines, rawText: ocrText, cleanedText: cleaned, source: 'ocr' },
    { skipStructuredResume: true }
  );
  const pipe = await runProductionExtractionPipeline(ocrText, {
    rawText: ocrText,
    extractionMethod: 'ocr',
    enterpriseExtraction: ent,
  });
  const sectionEngine = runSectionEngineV2(pipe.cleanedText || cleaned, { rawText: ocrText });
  const classifiedBlocks =
    sectionEngine.classified ||
    sectionEngine.blocks ||
    p0?.classifiedBlocks?.blocks ||
    p0?.renderBlocks ||
    [];

  const experienceBlocks = filterExperienceBlocksOnly(classifiedBlocks);
  const builderResult = buildExperiencesFromClassifiedBlocks(classifiedBlocks);

  const dateLineIndices = [];
  lines.forEach((line, i) => {
    if (lineHasCareerDate(line)) dateLineIndices.push(i);
  });

  const simulatedCandidates = dateLineIndices.map((idx) => {
    const line = lines[idx];
    const group = [lines[idx - 1], line, lines[idx + 1]].filter(Boolean);
    const built = explainParserNull([line], lines, idx);
    const builtWithCtx = explainParserNull(group, lines, idx);
    const rawEntry = built.built
      ? built.entry
      : builtWithCtx.built
        ? builtWithCtx.entry
        : null;
    let afterValidation = null;
    if (rawEntry) {
      const { entry, validation } = validateDraft(rawEntry, { inExperienceSection: false });
      afterValidation = { entry: formatEntry(entry), validation };
    }
    return {
      lineIndex: idx,
      line,
      context: group,
      beforeValidation: rawEntry
        ? formatEntry(rawEntry)
        : builtWithCtx.probe || built.probe,
      parserBuilt: !!rawEntry,
      parserNullReason: rawEntry
        ? null
        : (builtWithCtx.reasons || built.reasons || ['buildExperienceEntryFromLineGroup_returned_null']).join(', '),
      afterValidation,
    };
  });

  const recoveryDrafts = scanDraftExperiences(ocrText);
  const recoveryBefore = recoveryDrafts.map((d) => formatEntry(d));
  const recoveryAfter = recoveryDrafts.map((d) => {
    const { entry, validation } = validateDraft(d, { inExperienceSection: false });
    return { before: formatEntry(d), after: formatEntry(entry), validation };
  });

  const rebuilderDrafts = rebuildExperiencesFromText(ocrText);
  const rebuilderAfter = rebuilderDrafts.map((d) => {
    const { entry, validation } = validateDraft(d, { inExperienceSection: false });
    return { before: formatEntry(d), after: formatEntry(entry), validation };
  });

  const structured = { ...pipe.structuredResume, experiences: pipe.structuredResume?.experiences || [] };
  const recoveryGate = shouldRunExperienceRecovery(structured.experiences.length, ocrText);
  const parserFailed = detectExperienceParserFailed(structured.experiences.length, ocrText);
  const recoveryRun = runExperienceRecovery(structured, ocrText);
  const rebuilderRun = runExperienceRebuilder(structured, ocrText);

  const strict = parseStrictExperiencesFromLines(lines);
  let rd = resumeDataFromStructured(pipe.structuredResume);
  rd = repairResumeDataFromRaw(rd, { rawText: ocrText, cleanedText: ocrText });

  const blocksWithDates = classifiedBlocks
    .filter((b) => {
      const bl = (b.lines || []).map((l) => (typeof l === 'string' ? l : l?.text || '')).join(' ');
      return DATE_RANGE_RE.test(bl) || /\b(19|20)\d{2}\b/.test(bl);
    })
    .map((b) => ({
      id: b.id,
      type: b.type,
      classifyReason: b.classifyReason,
      preview: (b.lines || [])
        .map((l) => (typeof l === 'string' ? l : l?.text || ''))
        .join(' | ')
        .slice(0, 120),
    }));

  const report = {
    generatedAt: new Date().toISOString(),
    input: {
      source: 'tests/output/ocr-quality-yoaz/report.json',
      charCount: ocrText.length,
      lineCount: lines.length,
      dateLineCount: dateLineIndices.length,
      dateLines: dateLineIndices.map((i) => ({ index: i, line: lines[i] })),
    },
    classifiedBlocks: {
      total: classifiedBlocks.length,
      renderBlocks: p0.renderBlocks?.length ?? 0,
      sectionEngineTypes: [...new Set(classifiedBlocks.map((b) => b.type))],
      experienceBlocks: experienceBlocks.length,
      blocksWithDatesButNotExperience: blocksWithDates.filter((b) => b.type !== SECTION_IDS.EXPERIENCE),
      experienceBlockPreviews: experienceBlocks.map((b) => ({
        id: b.id,
        type: b.type,
        preview: (b.lines || []).map((l) => (typeof l === 'string' ? l : l?.text || '')).join(' | ').slice(0, 120),
      })),
    },
    experienceBuilderV2: {
      candidatesBeforeValidation: builderResult.audit.candidates.map((c) => ({
        blockId: c.blockId,
        lines: c.lines,
      })),
      acceptedAfterValidation: builderResult.audit.accepted.map((a) => ({
        entry: formatEntry(a.entry),
        confidence: a.confidence,
        reason: 'accepted',
      })),
      rejectedAfterValidation: builderResult.audit.rejected.map((r) => ({
        reason: r.reason,
        confidence: r.confidence,
        preview: r.preview,
        lines: r.lines,
      })),
      experiences: builderResult.experiences.map(formatEntry),
    },
    simulatedDateLineCandidates: simulatedCandidates,
    experienceRecovery: {
      gate: recoveryGate,
      parserFailed,
      scanDraftCount: recoveryDrafts.length,
      beforeValidation: recoveryBefore,
      afterValidation: recoveryAfter,
      runResult: {
        recovered: recoveryRun.recovered,
        draftCount: recoveryRun.drafts?.length ?? 0,
        experienceCount: recoveryRun.experienceCount,
        note:
          recoveryGate.reason === 'parser_failed_career_years'
            ? 'runExperienceRecovery short-circuits to runExperienceRebuilder — scanDraftExperiences never applied'
            : null,
      },
    },
    experienceRebuilder: {
      rebuildDraftCount: rebuilderDrafts.length,
      beforeValidation: rebuilderDrafts.map(formatEntry),
      afterValidation: rebuilderAfter,
      runResult: {
        rebuilt: rebuilderRun.rebuilt,
        parserFailed: rebuilderRun.parserFailed,
        inventionDisabled: rebuilderRun.structured?.metadata?.experienceRebuilder?.inventionDisabled,
        draftCount: rebuilderRun.drafts?.length ?? 0,
        note: 'runExperienceRebuilder has inventionDisabled:true — rebuildExperiencesFromText drafts are logged-only, never merged',
      },
    },
    strictParser: {
      experiences: strict.experiences.map(formatEntry),
      unclassifiedCount: strict.unclassified?.length ?? 0,
    },
    finalResumeData: {
      experiences: (rd.experiences || []).map(formatEntry),
      source: 'import-repair via repairResumeDataFromRaw (not experience-builder-v2)',
    },
  };

  const md = renderMarkdown(report);
  writeFileSync(join(ROOT, 'EXPERIENCE_BUILDER_AUDIT.md'), md, 'utf8');
  console.log('Wrote EXPERIENCE_BUILDER_AUDIT.md');
  console.log(JSON.stringify(report.summary || {
    experienceBlocks: report.classifiedBlocks.experienceBlocks,
    builderAccepted: report.experienceBuilderV2.acceptedAfterValidation.length,
    recoveryDrafts: report.experienceRecovery.scanDraftCount,
    rebuilderDrafts: report.experienceRebuilder.rebuildDraftCount,
    finalExperiences: report.finalResumeData.experiences.length,
  }, null, 2));
}

function renderMarkdown(r) {
  const sections = [];

  sections.push('# Experience Builder Audit\n');
  sections.push(`Generated: ${r.generatedAt}\n`);
  sections.push('Input: Yoaz OCR (`tests/output/ocr-quality-yoaz/report.json`)\n');

  sections.push('## Executive summary\n');
  sections.push(
    `The input clearly contains companies, job titles, and dates (${r.input.dateLineCount} date-bearing lines). ` +
      `**Zero** blocks are classified as \`EXPERIENCE\`, so \`experience-builder-v2\` never produces candidates. ` +
      `Recovery finds ${r.experienceRecovery.scanDraftCount} drafts and rebuilder finds ${r.experienceRebuilder.rebuildDraftCount} drafts, ` +
      `but both paths are **bypassed or disabled** when \`detectExperienceParserFailed\` is true. ` +
      `The single experience in final \`resumeData\` comes from **strict parser + import-repair**, not the builder.\n`
  );

  sections.push('## 1. experience-builder-v2.js\n');
  sections.push(`| Metric | Value |\n|--------|-------|\n`);
  sections.push(`| Classified blocks (section engine) | ${r.classifiedBlocks.total} |\n`);
  sections.push(`| Render blocks (p0 layout) | ${r.classifiedBlocks.renderBlocks} |\n`);
  sections.push(`| Block types | ${(r.classifiedBlocks.sectionEngineTypes || []).join(', ') || '—'} |\n`);
  sections.push(`| EXPERIENCE blocks | ${r.classifiedBlocks.experienceBlocks} |\n`);
  sections.push(`| Candidates BEFORE validation | ${r.experienceBuilderV2.candidatesBeforeValidation.length} |\n`);
  sections.push(`| Accepted AFTER validation | ${r.experienceBuilderV2.acceptedAfterValidation.length} |\n`);
  sections.push(`| Rejected AFTER validation | ${r.experienceBuilderV2.rejectedAfterValidation.length} |\n`);

  if (r.classifiedBlocks.blocksWithDatesButNotExperience.length) {
    sections.push('\n### Blocks with dates but wrong section type\n');
    sections.push('| type | reason | preview |\n|------|--------|--------|\n');
    for (const b of r.classifiedBlocks.blocksWithDatesButNotExperience) {
      sections.push(`| ${b.type} | ${b.classifyReason || '—'} | ${b.preview.replace(/\|/g, '\\|')} |\n`);
    }
    sections.push(
      '\n**Discard reason:** `filterExperienceBlocksOnly()` only keeps `SECTION_IDS.EXPERIENCE`. ' +
        'OCR merges headers like "PROFILE WORK EXPERIENCE" onto one line; section engine assigns dates to EDUCATION/UNKNOWN blocks instead.\n'
    );
  }

  sections.push('\n### Candidates BEFORE validation\n');
  if (!r.experienceBuilderV2.candidatesBeforeValidation.length) {
    sections.push('_None — builder never entered the block loop._\n');
  } else {
    sections.push('```json\n' + JSON.stringify(r.experienceBuilderV2.candidatesBeforeValidation, null, 2) + '\n```\n');
  }

  sections.push('\n### Candidates AFTER validation\n');
  sections.push('**Accepted:**\n');
  sections.push(
    r.experienceBuilderV2.acceptedAfterValidation.length
      ? '```json\n' + JSON.stringify(r.experienceBuilderV2.acceptedAfterValidation, null, 2) + '\n```\n'
      : '_None_\n'
  );
  sections.push('**Rejected:**\n');
  sections.push(
    r.experienceBuilderV2.rejectedAfterValidation.length
      ? '```json\n' + JSON.stringify(r.experienceBuilderV2.rejectedAfterValidation, null, 2) + '\n```\n'
      : '_None_\n'
  );

  sections.push('\n## 2. Date-line simulation (parser path)\n');
  sections.push('Each OCR line containing a year range, run through `buildExperienceEntryFromLineGroup` + `validateExperienceCandidate`:\n\n');
  sections.push('| # | line | BEFORE | AFTER | discard reason |\n|---|------|--------|-------|----------------|\n');
  r.simulatedDateLineCandidates.forEach((c, i) => {
    const before = JSON.stringify(c.beforeValidation).slice(0, 80);
    const after = !c.parserBuilt
      ? 'NULL (parser)'
      : c.afterValidation?.validation.ok
        ? 'ACCEPTED'
        : c.afterValidation?.validation.reason || 'rejected';
    const reason = !c.parserBuilt
      ? c.parserNullReason
      : c.afterValidation?.validation.ok
        ? '—'
        : c.afterValidation?.validation.reason;
    sections.push(`| ${i + 1} | ${c.line.slice(0, 60).replace(/\|/g, '\\|')}… | ${before}… | ${after} | ${reason} |\n`);
  });

  sections.push('\n## 3. experience-recovery.js\n');
  sections.push(`Gate: \`${r.experienceRecovery.gate.reason}\` (run=${r.experienceRecovery.gate.run})\n\n`);
  sections.push('### BEFORE validation (`scanDraftExperiences`)\n');
  sections.push('```json\n' + JSON.stringify(r.experienceRecovery.beforeValidation, null, 2) + '\n```\n');
  sections.push('\n### AFTER validation (`validateExperienceCandidate`)\n');
  sections.push('```json\n' + JSON.stringify(r.experienceRecovery.afterValidation, null, 2) + '\n```\n');
  sections.push('\n### Why recovery drafts were discarded\n');
  for (const row of r.experienceRecovery.afterValidation) {
    const reason = row.validation.ok ? 'would_accept_if_applied' : row.validation.reason;
    sections.push(`- **${row.before.role || '(no role)'}** @ ${row.before.company || '(no company)'} (${row.before.startDate}–${row.before.endDate}): \`${reason}\`\n`);
  }
  sections.push(`\n**Pipeline discard:** ${r.experienceRecovery.runResult.note}\n`);
  sections.push(`runExperienceRecovery → recovered=${r.experienceRecovery.runResult.recovered}, drafts applied=${r.experienceRecovery.runResult.draftCount}\n`);

  sections.push('\n## 4. experience-rebuilder.js\n');
  sections.push('### BEFORE validation (`rebuildExperiencesFromText`)\n');
  sections.push('```json\n' + JSON.stringify(r.experienceRebuilder.beforeValidation, null, 2) + '\n```\n');
  sections.push('\n### AFTER validation\n');
  sections.push('```json\n' + JSON.stringify(r.experienceRebuilder.afterValidation, null, 2) + '\n```\n');
  sections.push('\n### Why rebuilder drafts were discarded\n');
  for (const row of r.experienceRebuilder.afterValidation) {
    const reason = row.validation.ok ? 'would_accept_if_applied' : row.validation.reason;
    sections.push(`- **${row.before.role}** (${row.before.startDate}–${row.before.endDate}): \`${reason}\`\n`);
  }
  sections.push(`\n**Pipeline discard:** ${r.experienceRebuilder.runResult.note}\n`);
  sections.push(`runExperienceRebuilder → rebuilt=${r.experienceRebuilder.runResult.rebuilt}, inventionDisabled=${r.experienceRebuilder.runResult.inventionDisabled}\n`);

  sections.push('\n## 5. What actually lands in resumeData\n');
  sections.push('### strict parser (`parseStrictExperiencesFromLines`)\n');
  sections.push('```json\n' + JSON.stringify(r.strictParser.experiences, null, 2) + '\n```\n');
  sections.push('\n### final resumeData.experiences (after import-repair)\n');
  sections.push('```json\n' + JSON.stringify(r.finalResumeData.experiences, null, 2) + '\n```\n');
  sections.push(`Source: ${r.finalResumeData.source}\n`);

  sections.push('\n## Discard reason index\n');
  sections.push('| Stage | Object | Reason |\n|-------|--------|--------|\n');
  sections.push('| experience-builder-v2 | all date content | 0 EXPERIENCE blocks → never candidate |\n');
  for (const c of r.simulatedDateLineCandidates) {
    const role = c.beforeValidation?.role || c.line.slice(0, 40);
    const reason = !c.parserBuilt
      ? c.parserNullReason
      : c.afterValidation?.validation?.ok
        ? 'accepted_outside_builder_no_experience_block'
        : c.afterValidation?.validation?.reason;
    sections.push(`| parser simulation | ${String(role).slice(0, 40)} | ${reason} |\n`);
  }
  for (const row of r.experienceRecovery.afterValidation) {
    const reason = row.validation.ok
      ? 'not_applied_parser_failed_short_circuit'
      : row.validation.reason;
    sections.push(`| experience-recovery | ${row.before.role.slice(0, 40)} | ${reason} |\n`);
  }
  for (const row of r.experienceRebuilder.afterValidation) {
    const reason = row.validation.ok ? 'not_applied_invention_disabled' : row.validation.reason;
    sections.push(`| experience-rebuilder | ${row.before.role.slice(0, 40)} | ${reason} |\n`);
  }

  return sections.join('');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
