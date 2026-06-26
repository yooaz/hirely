#!/usr/bin/env node
/**
 * Universal Extraction Engine report → UNIVERSAL_EXTRACTION_ENGINE_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'UNIVERSAL_EXTRACTION_ENGINE_REPORT.md');
const REPORT_JSON = path.join(ROOT, 'tests/output/universal-extraction-engine/report.json');

let qaPass = false;
let report = null;

try {
  execSync('node src/tests/qa-universal-extraction-engine.mjs', { cwd: ROOT, stdio: 'pipe' });
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

const md = `# Universal CV Extraction Engine

**Status:** ${qaPass ? 'PASS' : 'FAIL'}  
**Generated:** ${new Date().toISOString()}  
**Experience recall goal:** ${(report?.recallGoal || 0.9) * 100}%  
**QA checks:** ${passed}/${total}

## Problem

Text extraction works, but structure recovery was weak — experiences, dates, companies, skills, tools, languages, and projects were lost before classification.

## Solution — 5 phases

### Phase 1 — CV_BLOCK_ENGINE (before classification)

Detects structural blocks using **position, spacing, capitalization, bullet density, date density** — not keywords only.

| Block type |
|------------|
| IDENTITY · SUMMARY · EXPERIENCE · EDUCATION · SKILLS · TOOLS · LANGUAGES · CLIENTS · PROJECTS · CERTIFICATIONS |

**Module:** \`src/core/parsing/universal-extraction/cv-block-engine.js\`  
**Hook:** \`section-detect-v2.js\` — runs after \`BLOCK_BUILDER_V1\`, before semantic classification.

### Phase 2 — Date detector

Formats: \`2018-2020\`, \`2018 → Present\`, \`Jan 2020\`, \`06/2019\`, standalone years, OCR repair (\`2O18\`).

**Module:** \`universal-extraction/date-detector.js\`

### Phase 3 — Company detector

Context-based proper-noun detection — **no hardcoded brand lists**. Handles Nike, Adobe, Google, Meta, Freelance, agency suffixes.

**Module:** \`universal-extraction/company-detector.js\`

### Phase 4 — Role detector

Recovers titles from noisy OCR (Graphic Designer, Art Director, Frontend Developer, etc.).

**Module:** \`universal-extraction/role-detector.js\`

### Phase 5 — Reconstruction

When **role + company + date** (any 2 of 3) → create experience. **Never discard** — low confidence → review queue.

**Module:** \`universal-extraction/experience-reconstructor.js\`  
**Hook:** \`section-engine-v2.js\` — after experience reconstruction V2.

## Pipeline isolation

| Layer | Touched? |
|-------|----------|
| Import / OCR | No |
| \`finalResumeData\` contract | No |
| \`buildResumeData\` | No |
| Section detect + engine | Yes (render path only) |

## Metrics

| Fixture | Expected | Recovered | Recall |
|---------|----------|-----------|--------|
| Labeled creative CV | ${report?.labeled?.expected ?? '—'} | ${report?.labeled?.hits ?? '—'} hits | ${report?.labeled?.recallPct ?? '—'}% |
| Yoaz OCR fragmented | 9 | ${report?.yoazOcr?.recovered ?? '—'} | ${report?.yoazOcr?.recallPct ?? '—'}% |

## Acceptance checklist

${checks.map((c) => `- [${c.pass ? 'x' : ' '}] ${c.id}${c.detail ? ` — ${c.detail}` : ''}`).join('\n')}

## Commands

\`\`\`bash
npm run qa:universal-extraction-engine
npm run universal-extraction-engine-report
\`\`\`
`;

fs.writeFileSync(OUT, md);
console.log(qaPass ? 'PASS — wrote UNIVERSAL_EXTRACTION_ENGINE_REPORT.md' : 'FAIL — see UNIVERSAL_EXTRACTION_ENGINE_REPORT.md');
process.exit(qaPass ? 0 : 1);
