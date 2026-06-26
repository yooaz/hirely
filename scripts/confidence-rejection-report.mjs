#!/usr/bin/env node
/**
 * CONFIDENCE_REJECTION_REPORT — audit fact-pipeline + confidence-gate rejections.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runProductionExtractionPipeline } from '../src/core/pipeline/production-pipeline.js';
import { runSectionEngineV2 } from '../src/core/parsing/section-engine-v2.js';
import { extractPlainTextEnterprise } from '../src/core/extraction/enterprise-engine.js';
import { coerceParserInputText } from '../src/core/pipeline/pipeline-contract.js';
import { runFactPipeline } from '../src/core/parsing/fact-pipeline.js';
import { partitionFactsByConfidence } from '../src/core/parsing/cv-from-facts.js';
import { FACT_CONFIDENCE_THRESHOLD } from '../src/core/parsing/fact-types.js';
import { CLASSIFICATION_CONFIDENCE_MIN } from '../src/core/parsing/classification-engine-v2.js';
import { classifySpecialtyLineV2 } from '../src/core/parsing/classification-engine-v2.js';
import { classifyLineWithConfidence, passesExperienceGate } from '../src/core/parsing/section-sanity.js';
import { resumeDataFromStructured } from '../src/core/resume-data.js';
import {
  CONFIDENCE_THRESHOLDS,
  scoreIdentityName,
  scoreIdentityTitle,
  scoreIdentityEmail,
  scoreIdentityPhone,
  scoreExperienceConfidence,
  scoreEducationLine,
  scoreSkillLine,
  scoreSummaryLine,
} from '../src/core/validation/confidence-gate.js';
import { validateCvSectionItem } from '../src/core/parsing/cv-section-contract.js';
import { NAME_UNCERTAIN_LABEL, TITLE_UNCERTAIN_LABEL } from '../src/core/parsing/parser-recovery.js';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, '..');

function loadRawText() {
  if (process.env.HIRELY_RAW_TEXT) return process.env.HIRELY_RAW_TEXT;
  return JSON.parse(
    readFileSync(join(ROOT, 'tests/output/ocr-quality-yoaz/report.json'), 'utf8')
  ).ocrText;
}

function pct(n, scale = 100) {
  if (scale === 1) return `${Math.round(n * 1000) / 10}%`;
  return `${Math.round(n)}%`;
}

function classifyLineForAudit(line) {
  const v2 = classifySpecialtyLineV2(line);
  if (v2 && v2.bucket !== 'unsorted') {
    return { bucket: v2.bucket, confidence: v2.confidence, engine: 'classification-engine-v2' };
  }
  const hit = classifyLineWithConfidence(line);
  return { bucket: hit.bucket, confidence: hit.confidence, engine: 'section-sanity' };
}

function factRejectionReason(fact, threshold) {
  const reasons = [];
  if (fact.type === 'unknown') reasons.push('fact_type_unknown');
  if (fact.confidence < threshold) {
    reasons.push(`fact_confidence_${pct(fact.confidence, 1)}_below_${pct(threshold, 1)}`);
  }
  if (fact.classifierReason && fact.classifierReason !== 'passthrough') {
    reasons.push(`classifier:${fact.classifierReason}`);
  }
  if (fact.lineConfidence != null && fact.lineConfidence < threshold) {
    reasons.push(`line_confidence_${pct(fact.lineConfidence, 1)}`);
  }
  return reasons.length ? reasons.join('; ') : 'partition_pending';
}

function auditFactPipeline(blocks, rawText) {
  const pipeline = runFactPipeline(blocks, { rawText });
  const facts = pipeline.facts || [];
  const threshold = pipeline.structured?.metadata?.factConfidenceThreshold ?? FACT_CONFIDENCE_THRESHOLD;
  const { accepted, pending } = partitionFactsByConfidence(facts, threshold);

  const acceptedKeys = new Set(
    accepted.map((f) => `${f.type}|${f.value}|${f.sourceLine}`)
  );

  const rejections = [];
  const lineAudit = [];

  for (const block of blocks || []) {
    for (const line of block.lines || []) {
      const text = String(line).trim();
      if (!text) continue;
      const hit = classifyLineForAudit(text);
      const lineConfident =
        hit.bucket !== 'unsorted' &&
        hit.confidence >= CLASSIFICATION_CONFIDENCE_MIN;
      let notes = [];
      if (!lineConfident) notes.push(`line_classification_below_${CLASSIFICATION_CONFIDENCE_MIN}`);
      if (hit.bucket === 'unsorted') notes.push('bucket_unsorted');
      const expGate =
        hit.bucket === 'experience' || block.type === 'experience'
          ? passesExperienceGate(text)
          : null;
      if (expGate === false) notes.push('failed_passesExperienceGate');

      const blockFacts = facts.filter((f) => (f.sourceLine || f.value) === text);
      const factSummary = blockFacts.map((f) => ({
        type: f.type,
        value: f.value?.slice(0, 80),
        confidence: pct(f.confidence, 1),
        accepted: acceptedKeys.has(`${f.type}|${f.value}|${f.sourceLine}`),
        classifierReason: f.classifierReason || null,
      }));

      lineAudit.push({
        text,
        blockType: block.type,
        blockHint: block.classifyReason || null,
        predictedSection: hit.bucket,
        classificationConfidence: hit.confidence,
        classificationEngine: hit.engine,
        factThreshold: pct(threshold, 1),
        classificationThreshold: CLASSIFICATION_CONFIDENCE_MIN,
        notes: notes.join('; ') || null,
        facts: factSummary,
      });
    }
  }

  for (const fact of pending) {
    const hit = classifyLineForAudit(fact.sourceLine || fact.value);
    rejections.push({
      stage: 'fact-pipeline',
      module: 'cv-from-facts.js → partitionFactsByConfidence',
      text: fact.sourceLine || fact.value,
      predictedSection: fact.type,
      linePredictedSection: hit.bucket,
      confidence: pct(fact.confidence, 1),
      requiredThreshold: pct(threshold, 1),
      reasonRejected: factRejectionReason(fact, threshold),
      classifierReason: fact.classifierReason || null,
      sectionHint: fact.sectionHint || null,
      blockClassifyReason: fact.classifyReason || null,
    });
  }

  for (const fact of accepted) {
    const check = validateCvSectionItem(fact.type, fact.value);
    if (!check.valid) {
      rejections.push({
        stage: 'fact-pipeline',
        module: 'cv-section-contract.js → assignFactWithContract',
        text: fact.sourceLine || fact.value,
        predictedSection: fact.type,
        linePredictedSection: classifyLineForAudit(fact.sourceLine || fact.value).bucket,
        confidence: pct(fact.confidence, 1),
        requiredThreshold: 'contract_valid',
        reasonRejected: `section_contract_violation: ${check.reason}`,
      });
    }
  }

  return {
    threshold,
    factsTotal: facts.length,
    acceptedCount: accepted.length,
    pendingCount: pending.length,
    rejections,
    lineAudit,
    structured: pipeline.structured,
  };
}

function auditConfidenceGate(resumeDataBefore) {
  const rd = resumeDataBefore;
  const t = CONFIDENCE_THRESHOLDS;
  const rejections = [];

  const push = (row) => rejections.push({ stage: 'confidence-gate', module: 'confidence-gate.js → applyConfidenceGate', ...row });

  const name = String(rd.identity?.name || '').trim();
  if (name) {
    const score = scoreIdentityName(name);
    if (score < t.identity) {
      push({
        text: name,
        predictedSection: 'identity.name',
        confidence: score,
        requiredThreshold: t.identity,
        reasonRejected:
          score === 0
            ? 'empty_or_placeholder_name'
            : score <= 20
              ? 'ocr_fragment_or_partial_role'
              : score < 70
                ? 'invalid_identity_name'
                : 'below_identity_threshold',
      });
    }
  }

  const title = String(rd.identity?.title || '').trim();
  if (title) {
    const score = scoreIdentityTitle(title);
    if (score < t.identity) {
      push({
        text: title,
        predictedSection: 'identity.title',
        confidence: score,
        requiredThreshold: t.identity,
        reasonRejected:
          score <= 38
            ? 'skill_fragment_as_title'
            : score < 72
              ? 'invalid_identity_title'
              : 'below_identity_threshold',
      });
    }
  }

  const email = String(rd.identity?.email || '').trim();
  if (email) {
    const score = scoreIdentityEmail(email);
    if (score < t.identity) {
      push({
        text: email,
        predictedSection: 'identity.email',
        confidence: score,
        requiredThreshold: t.identity,
        reasonRejected: 'invalid_email_format',
      });
    }
  }

  const phone = String(rd.identity?.phone || '').trim();
  if (phone) {
    const score = scoreIdentityPhone(phone);
    if (score < t.identity) {
      push({
        text: phone,
        predictedSection: 'identity.phone',
        confidence: score,
        requiredThreshold: t.identity,
        reasonRejected:
          score <= 8
            ? 'phone_contains_year_range'
            : score <= 30
              ? 'invalid_phone_format_or_length'
              : 'below_identity_threshold',
      });
    }
  }

  if (rd.summary) {
    const score = scoreSummaryLine(rd.summary);
    if (score < t.education) {
      push({
        text: rd.summary,
        predictedSection: 'summary',
        confidence: score,
        requiredThreshold: t.education,
        reasonRejected: score <= 40 ? 'partial_sentence_or_ocr_fragment' : 'summary_too_short',
      });
    }
  }

  for (const exp of rd.experiences || []) {
    const score = scoreExperienceConfidence(exp);
    if (score < t.experience) {
      const text = [exp.role, exp.company, exp.dates || `${exp.startDate || ''}–${exp.endDate || ''}`]
        .filter(Boolean)
        .join(' — ');
      push({
        text: text || JSON.stringify(exp),
        predictedSection: 'experience',
        confidence: score,
        requiredThreshold: t.experience,
        reasonRejected: score === 0 ? 'qualifiesStrictExperience_failed' : 'below_experience_threshold',
      });
    }
  }

  for (const item of rd.education || []) {
    const score = scoreEducationLine(item);
    if (score < t.education) {
      push({
        text: item,
        predictedSection: 'education',
        confidence: score,
        requiredThreshold: t.education,
        reasonRejected: 'below_education_threshold',
      });
    }
  }

  for (const item of rd.skills || []) {
    const score = scoreSkillLine(item);
    if (score < t.skills) {
      push({
        text: item,
        predictedSection: 'skills',
        confidence: score,
        requiredThreshold: t.skills,
        reasonRejected:
          score <= 20 ? 'ocr_fragment_or_garbage' : score <= 48 ? 'single_token_low_confidence' : 'below_skills_threshold',
      });
    }
  }

  for (const item of rd.tools || []) {
    const score = scoreSkillLine(item);
    if (score < t.skills) {
      push({
        text: item,
        predictedSection: 'tools',
        confidence: score,
        requiredThreshold: t.skills,
        reasonRejected: 'below_tools_threshold_same_scorer_as_skills',
      });
    }
  }

  return rejections;
}

function renderMarkdown(report) {
  const lines = [];
  lines.push('# Confidence Rejection Report\n');
  lines.push(`Generated: ${report.generatedAt}\n`);
  lines.push(`Input: Yoaz OCR (\`tests/output/ocr-quality-yoaz/report.json\`)\n`);

  lines.push('## Thresholds\n');
  lines.push('| Gate | Threshold | Source |\n|------|-----------|--------|\n');
  lines.push(`| Fact pipeline (partition) | ${pct(report.factThreshold, 1)} | \`fact-types.js\` FACT_CONFIDENCE_THRESHOLD |\n`);
  lines.push(`| Line classification | ${CLASSIFICATION_CONFIDENCE_MIN}% | \`classification-engine-v2.js\` CLASSIFICATION_CONFIDENCE_MIN |\n`);
  lines.push(`| Identity (resumeData) | ${CONFIDENCE_THRESHOLDS.identity}% | \`confidence-gate.js\` |\n`);
  lines.push(`| Experience | ${CONFIDENCE_THRESHOLDS.experience}% | \`confidence-gate.js\` |\n`);
  lines.push(`| Education | ${CONFIDENCE_THRESHOLDS.education}% | \`confidence-gate.js\` |\n`);
  lines.push(`| Skills / tools | ${CONFIDENCE_THRESHOLDS.skills}% | \`confidence-gate.js\` |\n`);

  lines.push('\n## Summary\n');
  lines.push(`| Stage | Rejections |\n|-------|------------|\n`);
  lines.push(`| fact-pipeline (\`partitionFactsByConfidence\`) | ${report.factRejections.length} |\n`);
  lines.push(`| confidence-gate (\`applyConfidenceGate\`) | ${report.gateRejections.length} |\n`);
  lines.push(`| **Total** | **${report.allRejections.length}** |\n`);

  lines.push('\nStruct after section-engine: ');
  lines.push(
    `experiences=${report.structuredCounts.exp}, education=${report.structuredCounts.edu}, skills=${report.structuredCounts.skills}, unsorted=${report.structuredCounts.unsorted}\n`
  );

  lines.push('\n## 1. Fact pipeline rejections\n');
  lines.push('Trace: `section-engine-v2.js` → `extractFieldsFromSectionBlocks` → `runFactPipeline` → `partitionFactsByConfidence`\n\n');
  if (!report.factRejections.length) {
    lines.push('_No fact-pipeline rejections._\n');
  } else {
    lines.push('| text | predicted section | confidence | required | reason |\n|------|-------------------|------------|----------|--------|\n');
    for (const r of report.factRejections) {
      const text = String(r.text).slice(0, 72).replace(/\|/g, '\\|');
      lines.push(`| ${text} | ${r.predictedSection} | ${r.confidence} | ${r.requiredThreshold} | ${r.reasonRejected} |\n`);
    }
  }

  lines.push('\n### Fact pipeline detail (JSON)\n');
  lines.push('```json\n' + JSON.stringify(report.factRejections, null, 2) + '\n```\n');

  lines.push('\n## 2. Confidence gate rejections (resumeData)\n');
  lines.push('Trace: `resumeDataFromStructured` → `normalizeResumeData` → `applyConfidenceGate`\n\n');
  if (!report.gateRejections.length) {
    lines.push('_No confidence-gate rejections on pre-normalize resumeData._\n');
  } else {
    lines.push('| text | predicted section | confidence | required | reason |\n|------|-------------------|------------|----------|--------|\n');
    for (const r of report.gateRejections) {
      const text = String(r.text).slice(0, 72).replace(/\|/g, '\\|');
      lines.push(`| ${text} | ${r.predictedSection} | ${r.confidence} | ${r.requiredThreshold} | ${r.reasonRejected} |\n`);
    }
  }

  lines.push('\n### Confidence gate detail (JSON)\n');
  lines.push('```json\n' + JSON.stringify(report.gateRejections, null, 2) + '\n```\n');

  lines.push('\n## 3. Per-line classification audit (section-engine input)\n');
  lines.push('| text | block type | predicted section | class conf | fact threshold | notes |\n|------|------------|-------------------|------------|----------------|-------|\n');
  for (const row of report.lineAudit) {
    const text = String(row.text).slice(0, 60).replace(/\|/g, '\\|');
    const pendingFacts = (row.facts || []).filter((f) => !f.accepted);
    const note = [row.notes, pendingFacts.length ? `${pendingFacts.length} fact(s) pending` : null]
      .filter(Boolean)
      .join('; ');
    lines.push(
      `| ${text} | ${row.blockType} | ${row.predictedSection} | ${row.classificationConfidence}% | ${row.factThreshold} | ${note || '—'} |\n`
    );
  }

  lines.push('\n## 4. Likely false rejections (valid content flagged)\n');
  const suspicious = report.allRejections.filter((r) => {
    const text = String(r.text || '').toLowerCase();
    return (
      /\b(freelanc|illustrator|graphic designer|lisaa|créapole|creapole|nike|adobe|2011|2022)\b/i.test(text) ||
      /\b(design|illustration|branding|packaging)\b/i.test(text)
    );
  });
  if (!suspicious.length) {
    lines.push('_None flagged by heuristics._\n');
  } else {
    for (const r of suspicious) {
      lines.push(`- **${String(r.text).slice(0, 80)}** — ${r.stage}: ${r.reasonRejected} (conf ${r.confidence} < ${r.requiredThreshold})\n`);
    }
  }

  lines.push('\n## 5. All rejections (combined)\n');
  lines.push('```json\n' + JSON.stringify(report.allRejections, null, 2) + '\n```\n');

  return lines.join('');
}

async function main() {
  const rawText = loadRawText();
  const ent = extractPlainTextEnterprise(rawText, 'ocr');
  const cleaned = coerceParserInputText(ent.cleanedText, rawText);
  const pipe = await runProductionExtractionPipeline(rawText, {
    rawText,
    extractionMethod: 'ocr',
    enterpriseExtraction: ent,
  });
  const se = runSectionEngineV2(pipe.cleanedText || cleaned, { rawText });
  const blocks = se.sectionBlocks || [];

  const factAudit = auditFactPipeline(blocks, rawText);
  const rdBefore = resumeDataFromStructured(se.structured);
  const gateRejections = auditConfidenceGate(rdBefore);

  const factRejections = factAudit.rejections;
  const allRejections = [...factRejections, ...gateRejections];

  const report = {
    generatedAt: new Date().toISOString(),
    factThreshold: factAudit.threshold,
    structuredCounts: {
      exp: se.structured.experiences?.length ?? 0,
      edu: se.structured.education?.length ?? 0,
      skills: se.structured.skills?.length ?? 0,
      unsorted: se.structured.unsorted?.length ?? 0,
    },
    factRejections,
    gateRejections,
    allRejections,
    lineAudit: factAudit.lineAudit,
  };

  const md = renderMarkdown(report);
  writeFileSync(join(ROOT, 'CONFIDENCE_REJECTION_REPORT.md'), md, 'utf8');
  console.log('Wrote CONFIDENCE_REJECTION_REPORT.md');
  console.log({
    factRejections: factRejections.length,
    gateRejections: gateRejections.length,
    total: allRejections.length,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
