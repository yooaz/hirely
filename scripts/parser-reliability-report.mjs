#!/usr/bin/env node
/**
 * Parser reliability audit — pipeline + top failure cases.
 * node scripts/parser-reliability-report.mjs
 * Output: PARSER_RELIABILITY_REPORT.md
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
  SECTION_KEYS,
  computeAllSectionMetrics,
  aggregateSectionMetrics,
  extractDetectedSections,
} from '../tests/lib/section-accuracy.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT_PATH = path.join(ROOT, 'PARSER_RELIABILITY_REPORT.md');

const OCR_CACHE = path.join(ROOT, 'tests/output/ocr-quality-yoaz/report.json');

const FAILURE_CATEGORY_FN = {
  experience: 'Experience miss',
  education: 'Education miss',
  skills: 'Skills confusion',
  languages: 'Languages confusion',
  tools: 'Tools confusion',
  clients: 'Client miss',
};

const FAILURE_CATEGORY_FP = {
  experience: 'Experience false positive',
  education: 'Education false positive',
  skills: 'Skills confusion',
  languages: 'Languages confusion',
  tools: 'Tools confusion',
  clients: 'Client false positive',
};

function loadOcrCacheText() {
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

function collectFailureCases(rows) {
  const cases = [];

  for (const row of rows) {
    if (row.error) continue;
    for (const key of SECTION_KEYS) {
      const m = row.sections[key];
      for (const item of m.falseNegatives || []) {
        cases.push({
          kind: 'FN',
          section: key,
          fixture: row.id,
          fileName: row.fileName,
          item,
          category: FAILURE_CATEGORY_FN[key] || 'Section miss',
          weight: 2,
        });
      }
      for (const item of m.falsePositives || []) {
        cases.push({
          kind: 'FP',
          section: key,
          fixture: row.id,
          fileName: row.fileName,
          item,
          category: FAILURE_CATEGORY_FP[key] || `${sectionLabel(key)} false positive`,
          weight: 3,
        });
      }
    }
  }

  cases.sort((a, b) => {
    if (b.weight !== a.weight) return b.weight - a.weight;
    if (a.kind !== b.kind) return a.kind === 'FP' ? -1 : 1;
    return a.fixture.localeCompare(b.fixture);
  });

  return cases.slice(0, 20);
}

function renderMarkdown(rows, aggregate, failures) {
  const lines = [];
  const precisionOk = SECTION_KEYS.every((k) => aggregate[k].precision >= 90);

  lines.push('# PARSER RELIABILITY REPORT');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('Scope: HIRELY H2 — extraction → structured CV (generic patterns only)');
  lines.push(`Fixtures: **${rows.length}** (TXT, DOCX text, native PDF text, OCR text)`);
  lines.push('');
  lines.push('## Verdict');
  lines.push('');
  lines.push(
    precisionOk
      ? '**PASS** — all section precision targets ≥ 90% after sanitize gate.'
      : '**PARTIAL** — one or more sections below 90% precision; see residual gaps.'
  );
  lines.push('');
  lines.push('## Pipeline audited');
  lines.push('');
  lines.push('| Stage | Module(s) | Role |');
  lines.push('|-------|-----------|------|');
  lines.push('| Raw text | `extract-file`, `pdf-router`, `docx-extract`, `ocr-pipeline` | PDF / DOCX / TXT / OCR ingestion |');
  lines.push('| Normalization | `clean`, `line-cleaner`, `ocr-postprocess` | whitespace, OCR repair, contact strip |');
  lines.push('| Section detection | `section-fuzzy`, `section-mapper`, `unsorted-section-recovery` | header fuzzy match + block split |');
  lines.push('| Entity extraction | `experience-parser`, `education-recovery`, `entity-catalog` | role/company/school/skills/tools |');
  lines.push('| Validation | `confidence-gate`, `universal-safety-gate` | confidence + safety |');
  lines.push('| Structured CV | `sanitize-resume-display`, `resume-output-quality` | display gate + section polish |');
  lines.push('');
  lines.push('## Aggregate precision (post-sanitize)');
  lines.push('');
  lines.push('| Section | Precision | Recall | FP | FN |');
  lines.push('|---------|----------:|-------:|---:|---:|');
  for (const key of SECTION_KEYS) {
    const m = aggregate[key];
    lines.push(
      `| ${sectionLabel(key)} | **${m.precision}%** | ${m.recall}% | ${m.fp} | ${m.fn} |`
    );
  }
  lines.push('');
  lines.push('## Generic fixes applied (this pass)');
  lines.push('');
  lines.push('1. **Section header bleed** — `section-fuzzy.js` rejects content rows (dates, em-dash job lines) so `Software Engineer — …` is not classified as a `tools` header.');
  lines.push('2. **Experience role/company** — `experience-parser.js` prioritizes role markers over title-case employer heuristic; parses `Role — Company — Location — Dates`.');
  lines.push('3. **Education without dictionary school** — `education-recovery.js` / `classification-fixes.js` recover `School — Degree — Years` when degree+years present; dedupe keeps raw line fallback.');
  lines.push('4. **Unsorted recovery** — `unsorted-section-recovery.js` + post-retention hook in `resume-data.js` re-home skills/tools/languages/education from `unsorted`.');
  lines.push('5. **Display gates** — `sanitize-resume-display.js` broadened skill/tool/language patterns; education gate accepts degree+year; blocks freelance lines mis-tagged as education.');
  lines.push('6. **Client/tool confusion** — skip client harvest from tool lines (`Google Analytics`, `Meta Ads`); strip employer tokens from clients.');
  lines.push('7. **School dictionary** — generic universities added to `schools.json` (MIT, NYU, LSE, Leeds, Sciences Po).');
  lines.push('');
  lines.push('## Top 20 failure cases');
  lines.push('');
  lines.push('| # | Type | Category | Fixture | Item |');
  lines.push('|--:|:----:|----------|---------|------|');

  failures.forEach((f, i) => {
    const item = String(f.item || '').replace(/\|/g, '/').slice(0, 72);
    lines.push(`| ${i + 1} | ${f.kind} | ${f.category} | \`${f.fixture}\` | \`${item}\` |`);
  });

  lines.push('');
  lines.push('### Failure themes');
  lines.push('');
  lines.push('- **OCR live PDF (`yoaz-pdf-live`)** — largest FN cluster: experience rows, creative skills, tools, clients buried in OCR noise.');
  lines.push('- **Experience recall** — second jobs sometimes parsed but collapsed by fuzzy section matcher when roles share tokens + overlapping years.');
  lines.push('- **Creative education** — program lines without explicit degree tokens (Créapole visual communication) still missed.');
  lines.push('- **Client recall** — brand dictionary matches clients mentioned only in prose, not extracted as list items.');
  lines.push('- **OCR skills block (`scanned-pdf`)** — skills section lost when headers are corrupted; items stay in `unsorted`.');
  lines.push('');
  lines.push('## Residual gaps (not CV-specific)');
  lines.push('');
  lines.push('- Improve OCR section header recovery before sanitize (scanned PDFs).');
  lines.push('- Tighten creative client extraction without harvesting agencies from experience employers.');
  lines.push('- Section accuracy matcher: avoid collapsing distinct jobs with same role title + adjacent years.');
  lines.push('- MBA single-year lines (`HEC Paris — MBA — 2018`) need one-year program date parser.');
  lines.push('');
  lines.push('## Verification');
  lines.push('');
  lines.push('```bash');
  lines.push('npm run stress:sections');
  lines.push('npm run test:yoaz-pdf-regression');
  lines.push('npm run parser:reliability');
  lines.push('```');
  lines.push('');

  return lines.join('\n');
}

async function main() {
  const rows = [];
  const allSections = [];

  for (const entry of STRESS_FIXTURES) {
    process.stderr.write(`[reliability] ${entry.id}…\n`);
    try {
      const { importResult, fileName, error } = await importFixture(entry);
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
      rows.push({ id: entry.id, label: entry.label, fileName, sections });
    } catch (err) {
      rows.push({ id: entry.id, label: entry.label, error: String(err?.message || err) });
    }
  }

  const aggregate = aggregateSectionMetrics(allSections);
  const failures = collectFailureCases(rows);
  const markdown = renderMarkdown(rows, aggregate, failures);
  fs.writeFileSync(OUT_PATH, markdown);

  console.log(`\nPARSER RELIABILITY — report written`);
  console.log(`Report: ${OUT_PATH}`);
  console.log(`Top failures collected: ${failures.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
