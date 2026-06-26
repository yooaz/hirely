#!/usr/bin/env node
/**
 * P2 Scanned PDF Master report → SCANNED_PDF_MASTER_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'SCANNED_PDF_MASTER_REPORT.md');
const REPORT_JSON = path.join(ROOT, 'tests/output/scanned-pdf-master/report.json');

let qaPass = false;
let report = null;

try {
  execSync('node src/tests/qa-scanned-pdf-master.mjs', { cwd: ROOT, stdio: 'pipe' });
  qaPass = true;
} catch {
  qaPass = false;
}

if (fs.existsSync(REPORT_JSON)) {
  report = JSON.parse(fs.readFileSync(REPORT_JSON, 'utf8'));
}

const checks = report?.checks || [];
const passed = checks.filter((c) => c.pass).length;
const total = checks.length;

const md = `# Scanned PDF Master (P2)

**Status:** ${qaPass ? 'PASS' : 'FAIL'}  
**Generated:** ${new Date().toISOString()}  
**Experience recall goal:** ${(report?.recallGoal || 0.85) * 100}%  
**QA checks:** ${passed}/${total}

## Problem

OCR extracts text from scanned PDFs, but **structure disappears** — jobs, schools, and skills lose their section context when the OCR stream order is wrong or lines are fragmented.

## Solution — OCR_STRUCTURE_RECOVERY

**Module:** \`src/core/parsing/ocr-structure-recovery/\`

| Signal | Purpose |
|--------|---------|
| **Year clustering** | Anchor experience blocks by date ranges; sort by latest year (never trust OCR order) |
| **Spacing** | Blank-line and y-gap breaks between logical records |
| **Line grouping** | Merge company + role + year-only stacks into single experience units |
| **Semantic grouping** | Bucket groups into profile / experience / education / skills / languages / clients |

**Rule:** Never trust OCR order — rebuild canonical sections before classification.

### Pipeline

\`\`\`
OCR text → postProcessOcrText → OCR_STRUCTURE_RECOVERY → SECTION_ENGINE_V2 → structured resume
\`\`\`

**Hook:** \`section-engine-v2.js\` — runs when \`extractionMethod\` is OCR or text looks like OCR.

### Files

| File | Role |
|------|------|
| \`year-cluster.js\` | Extract years, year-only lines, sort experience by cluster |
| \`line-grouper.js\` | Split merged headers, group company/role/year stacks |
| \`semantic-grouper.js\` | Section buckets (order-agnostic) |
| \`section-rebuilder.js\` | Emit canonical section text for parser |
| \`index.js\` | \`runOcrStructureRecovery\` orchestrator |

## Acceptance

| Fixture | Target |
|---------|--------|
| Yoaz OCR fragmented | 9/9 experience labels (100% recall) |
| Scanned PDF (Marie Dupont) | ≥1 experience row |
| Release scanned OCR sim | Freelance illustrator recovered |
| **Overall** | **Experience recall ≥ 85%** |

## Results

| Corpus | Recall | Experience rows |
|--------|--------|-----------------|
| Yoaz OCR | ${Math.round((report?.yoazOcr?.recall || 0) * 100)}% | ${report?.yoazOcr?.count ?? '—'} |
| Scanned fixture | ${Math.round((report?.scannedFixture?.recall || 0) * 100)}% | ${report?.scannedFixture?.count ?? '—'} |
| Release scanned | ${Math.round((report?.releaseScanned?.recall || 0) * 100)}% | ${report?.releaseScanned?.count ?? '—'} |

## QA

\`\`\`bash
npm run qa:scanned-pdf-master
npm run qa:site-extraction-fixes
npm run scanned-pdf-master-report
\`\`\`

## Check results

${checks.length ? checks.map((c) => `- [${c.pass ? 'x' : ' '}] **${c.id}** — ${c.detail || ''}`).join('\n') : '_Run QA to populate checks._'}
`;

fs.writeFileSync(OUT, md);
console.log(`Wrote ${OUT} (${qaPass ? 'PASS' : 'FAIL'})`);
