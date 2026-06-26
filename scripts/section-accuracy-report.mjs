#!/usr/bin/env node
/**
 * Section accuracy — precision / FP / FN per CV section.
 * node scripts/section-accuracy-report.mjs
 * Output: SECTION_ACCURACY_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runHirelyImportFromText } from '../src/core/pipeline/hirely-import.js';
import { sanitizeResumeForDisplay } from '../src/core/validation/sanitize-resume-display.js';
import { STRESS_FIXTURES, resolveFixtureText } from '../tests/lib/stress-catalog.mjs';
import {
  groundTruthForFixture,
  loadFixtureRawText,
} from '../tests/lib/section-ground-truth.mjs';
import {
  SECTION_ACCURACY_GOAL_PCT,
  SECTION_KEYS,
  computeAllSectionMetrics,
  aggregateSectionMetrics,
  extractDetectedSections,
} from '../tests/lib/section-accuracy.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT_PATH = path.join(ROOT, 'SECTION_ACCURACY_REPORT.md');

const OCR_CACHE = path.join(ROOT, 'tests/output/ocr-quality-yoaz/report.json');
const OCR_FRAGMENTED = path.join(ROOT, 'tests/fixtures/yoaz-pdf-live/ocr-fragmented.txt');

function loadOcrCacheText() {
  if (fs.existsSync(OCR_FRAGMENTED)) {
    const fragmented = fs.readFileSync(OCR_FRAGMENTED, 'utf8').trim();
    if (fragmented.length >= 80) return fragmented;
  }
  if (!fs.existsSync(OCR_CACHE)) return '';
  try {
    const t = JSON.parse(fs.readFileSync(OCR_CACHE, 'utf8')).ocrText;
    return t && t.length >= 80 ? t : '';
  } catch {
    return '';
  }
}

async function importFixture(entry) {
  let rawText;
  let fileName;

  if (entry.id === 'yoaz-pdf-live') {
    const cached = loadOcrCacheText();
    if (cached.length >= 80) {
      rawText = cached;
      fileName = 'yoaz.pdf (OCR cache)';
    } else {
      return { error: 'yoaz OCR cache missing', importResult: null, fileName: 'yoaz.pdf' };
    }
  } else {
    const resolved = resolveFixtureText(ROOT, entry);
    rawText = resolved.rawText;
    fileName = resolved.fileName;
  }

  const importResult = await runHirelyImportFromText(rawText, {
    source: entry.id,
    extractionMethod: entry.extractionMethod,
    file: { name: fileName, type: 'text/plain', size: rawText.length },
  });

  return { importResult, fileName, rawText };
}

function sectionLabel(key) {
  return (
    {
      experience: 'Experience',
      education: 'Education',
      skills: 'Skill',
      languages: 'Language',
      tools: 'Tool',
      clients: 'Client',
    }[key] || key
  );
}

function fmtPct(n) {
  return `${n}%`;
}

function renderMarkdown(rows, aggregate) {
  const lines = [];
  const allGoalsMet = SECTION_KEYS.every((k) => aggregate[k].goalMet);
  const goalsMet = SECTION_KEYS.filter((k) => aggregate[k].goalMet).length;

  lines.push('# SECTION ACCURACY REPORT');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('Pipeline: production import + `sanitizeResumeForDisplay`');
  lines.push(`Fixtures evaluated: **${rows.length}**`);
  lines.push('');
  lines.push('## Goal');
  lines.push('');
  lines.push(`**Precision > ${SECTION_ACCURACY_GOAL_PCT}%** for each section (Experience, Education, Skill, Language, Tool, Client).`);
  lines.push('');
  lines.push(
    allGoalsMet
      ? `### Goal status: **MET** (${goalsMet}/${SECTION_KEYS.length} sections ≥ ${SECTION_ACCURACY_GOAL_PCT}% precision)`
      : `### Goal status: **NOT MET** (${goalsMet}/${SECTION_KEYS.length} sections ≥ ${SECTION_ACCURACY_GOAL_PCT}% precision)`
  );
  lines.push('');
  lines.push('## Aggregate precision (all fixtures)');
  lines.push('');
  lines.push('| Section | Expected | Detected | TP | FP | FN | Precision | Recall | Goal |');
  lines.push('|---------|----------:|---------:|---:|---:|---:|----------:|-------:|:----:|');

  for (const key of SECTION_KEYS) {
    const m = aggregate[key];
    lines.push(
      `| ${sectionLabel(key)} | ${m.expected} | ${m.detected} | ${m.tp} | ${m.fp} | ${m.fn} | **${fmtPct(m.precision)}** | ${fmtPct(m.recall)} | ${m.goalMet ? '✓' : '✗'} |`
    );
  }

  lines.push('');
  lines.push('### Definitions');
  lines.push('');
  lines.push('- **TP** — detected item matches a ground-truth item in the same section (fuzzy token match)');
  lines.push('- **FP (false positives)** — detected items with no ground-truth match in that section');
  lines.push('- **FN (false negatives)** — ground-truth items not recovered in that section');
  lines.push('- **Precision** = TP / (TP + FP) = TP / Detected');
  lines.push('- **Recall** = TP / (TP + FN) = TP / Expected');
  lines.push('');
  lines.push('## Per-fixture breakdown');
  lines.push('');
  lines.push('| Fixture | Experience | Education | Skill | Language | Tool | Client |');
  lines.push('|---------|------------|-----------|-------|----------|------|--------|');

  for (const r of rows) {
    if (r.error) {
      lines.push(`| ${r.id} | ERROR | ERROR | ERROR | ERROR | ERROR | ERROR |`);
      continue;
    }
    const cells = SECTION_KEYS.map((k) => {
      const m = r.sections[k];
      return `${fmtPct(m.precision)} (FP ${m.fp}, FN ${m.fn})`;
    });
    lines.push(`| ${r.id} | ${cells.join(' | ')} |`);
  }

  lines.push('');
  lines.push('## Per-fixture detail');
  lines.push('');

  for (const r of rows) {
    lines.push(`### ${r.label} (\`${r.id}\`)`);
    lines.push('');
    if (r.error) {
      lines.push(`- **Error:** ${r.error}`);
      lines.push('');
      continue;
    }
    lines.push(`- **File:** \`${r.fileName}\``);
    for (const key of SECTION_KEYS) {
      const m = r.sections[key];
      lines.push(`- **${sectionLabel(key)}:** precision ${fmtPct(m.precision)}, FP ${m.fp}, FN ${m.fn}, recall ${fmtPct(m.recall)}`);
      if (m.falsePositives.length) {
        lines.push(`  - False positives: ${m.falsePositives.slice(0, 6).map((x) => `\`${x.slice(0, 64)}\``).join(', ')}`);
      }
      if (m.falseNegatives.length) {
        lines.push(`  - False negatives: ${m.falseNegatives.slice(0, 6).map((x) => `\`${x.slice(0, 64)}\``).join(', ')}`);
      }
    }
    lines.push('');
  }

  lines.push('## Run');
  lines.push('');
  lines.push('```bash');
  lines.push('npm run stress:sections');
  lines.push('```');
  lines.push('');

  return { markdown: lines.join('\n'), allGoalsMet };
}

async function main() {
  const rows = [];
  const allSections = [];

  for (const entry of STRESS_FIXTURES) {
    if (entry.optional && entry.pdfCandidates) {
      /* yoaz-pdf-live handled via OCR cache */
    }

    process.stderr.write(`[sections] ${entry.id}…\n`);

    try {
      const { importResult, fileName, rawText, error } = await importFixture(entry);
      if (error || !importResult?.resumeData) {
        rows.push({ id: entry.id, label: entry.label, error: error || 'import failed' });
        continue;
      }

      const groundTruthText = loadFixtureRawText(ROOT, entry);
      const groundTruth = groundTruthForFixture(entry.id, groundTruthText);
      const sanitized = sanitizeResumeForDisplay(importResult.resumeData);
      const detected = extractDetectedSections(sanitized);
      const sections = computeAllSectionMetrics(groundTruth, detected);
      allSections.push(sections);

      rows.push({
        id: entry.id,
        label: entry.label,
        fileName,
        sections,
        groundTruth,
        detected,
      });
    } catch (err) {
      rows.push({ id: entry.id, label: entry.label, error: String(err?.message || err) });
    }
  }

  const aggregate = aggregateSectionMetrics(allSections);
  const { markdown, allGoalsMet } = renderMarkdown(rows, aggregate);
  fs.writeFileSync(OUT_PATH, markdown);

  console.log(`\nSECTION ACCURACY — ${allGoalsMet ? 'GOAL MET' : 'GOAL MISSED'}`);
  for (const key of SECTION_KEYS) {
    const m = aggregate[key];
    console.log(
      `  ${sectionLabel(key).padEnd(12)} precision ${fmtPct(m.precision).padStart(6)}  FP ${String(m.fp).padStart(3)}  FN ${String(m.fn).padStart(3)}  ${m.goalMet ? '✓' : '✗'}`
    );
  }
  console.log(`Report: ${OUT_PATH}`);

  process.exit(allGoalsMet ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
