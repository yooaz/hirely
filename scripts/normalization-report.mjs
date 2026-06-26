#!/usr/bin/env node
/**
 * Generates NORMALIZATION_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import {
  normalizeCvDocument,
  CV_NORMALIZER_V1,
} from '../src/core/parsing/cv-normalizer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'NORMALIZATION_REPORT.md');

function runSuite(cmd) {
  try {
    const out = execSync(cmd, { cwd: ROOT, encoding: 'utf8' });
    return { ok: true, out };
  } catch (e) {
    return { ok: false, out: (e.stdout || '') + (e.stderr || '') + (e.message || '') };
  }
}

const qa = runSuite('node src/tests/qa-cv-normalizer.mjs');
const ocrNorm = runSuite('node src/tests/ocr-normalization-test.mjs');

const fixture = `
Page 1 of 2
MARIE MARTIN
marie . martin @ company . ch
+41 78 555 12 34
EXPERIENCE
2018 - Present
Art Director — Art Director
Page 2 of 2
||| OCR noise |||
2018 - Present
`;

const demo = normalizeCvDocument(fixture, { ocr: true, extractionMethod: 'pdf_ocr' });

const report = `# NORMALIZATION_REPORT

Generated: ${new Date().toISOString()}

## P1 status

| Item | Value |
|------|-------|
| Version | \`${CV_NORMALIZER_V1}\` |
| Pipeline position | OCR → RAW TEXT → **NORMALIZER** → ENTITY EXTRACTION → VALIDATION → STRUCTURED CV → TEMPLATE |
| Module | \`src/core/parsing/cv-normalizer.js\` |
| Integration | \`normalizePipelineTexts()\` + \`production-pipeline.js\` (pre-sanitize) |
| QA | ${qa.ok ? '**PASS**' : '**FAIL**'} |

## Responsibilities

| Duty | Implementation |
|------|----------------|
| Remove OCR garbage | \`normalizeOcrDocument()\` + line rejection |
| Remove duplicate lines | \`removeDuplicateLines()\` |
| Remove page numbers | \`removePageNumberLines()\` + \`stripHeaderFooterLines()\` |
| Remove repeated headers | \`stripHeaderFooterLines()\` (≥3 occurrences) |
| Repair common OCR mistakes | \`repairCommonOCRMistakes()\` + OCR char repairs |
| Normalize dates | \`normalizeReconstructedDates()\` per line |
| Normalize phone formats | \`extractPhoneCandidate()\` inline |
| Normalize email formats | \`sanitizeEmailOcrArtifacts()\` + RFC validation |

## QA snapshot

| Suite | Result |
|-------|--------|
| \`qa-cv-normalizer\` | ${qa.ok ? '**PASS**' : '**FAIL**'} |
| \`ocr-normalization-test\` | ${ocrNorm.ok ? '**PASS**' : '**FAIL**'} |

## Fixture demo

**Input (excerpt):**

\`\`\`
${fixture.trim().split('\n').slice(0, 8).join('\n')}
...
\`\`\`

**Output:**

\`\`\`
${demo.text.trim()}
\`\`\`

**Stats:**

| Metric | Value |
|--------|-------|
| Input lines | ${demo.stats.inputLines} |
| Output lines | ${demo.stats.outputLines} |
| Page numbers removed | ${demo.stats.pageNumbersRemoved} |
| Duplicates removed | ${demo.stats.duplicatesRemoved} |
| Headers removed | ${demo.stats.headersRemoved} |
| OCR engine used | ${demo.stats.usedOcrEngine} |
| Contacts normalized | ${demo.stats.contactsNormalized} |
| Dates normalized | ${demo.stats.datesNormalized} |

## Pipeline wiring

\`\`\`
OCR
  ↓
RAW TEXT (archive preserved in \`rawText\`)
  ↓
NORMALIZER (\`normalizeCvDocument\` / \`normalizePipelineTexts\`)
  ↓
ENTITY EXTRACTION (\`sanitizeParserInput\` → \`runP0Pipeline\`)
  ↓
VALIDATION
  ↓
STRUCTURED CV
  ↓
TEMPLATE
\`\`\`

## Verification

\`\`\`bash
npm run qa:cv-normalizer
npm run normalization-report
\`\`\`
`;

fs.writeFileSync(OUT, report, 'utf8');
console.log(`Wrote ${OUT}`);
console.log(qa.out.trim());
