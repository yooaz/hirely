#!/usr/bin/env node
/**
 * ATS Elite PDF export report → ATS_ELITE_PDF_EXPORT.md
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'ATS_ELITE_PDF_EXPORT.md');
const PDF_PATH = path.join(ROOT, 'tests/output/ats-elite/ats-elite.pdf');
const REPORT_JSON = path.join(ROOT, 'tests/output/ats-elite/report.json');

let qaPass = false;
let report = null;

try {
  execSync('node src/tests/qa-ats-elite-template.mjs', { cwd: ROOT, stdio: 'pipe' });
  qaPass = true;
} catch {
  qaPass = false;
}

if (fs.existsSync(REPORT_JSON)) {
  report = JSON.parse(fs.readFileSync(REPORT_JSON, 'utf8'));
}

const pdfExists = fs.existsSync(PDF_PATH);
const pdfBytes = pdfExists ? fs.statSync(PDF_PATH).size : 0;

const md = `# ATS Elite PDF Export

**Status:** ${qaPass && pdfExists ? 'PASS' : 'FAIL'}  
**Generated:** ${new Date().toISOString()}  
**Template:** \`ats-elite\`

## Export path

Playwright print-to-PDF via \`src/tests/lib/pdf-export-playwright.mjs\`:

- A4 width (210mm / 794px)
- Stylesheets include \`cv-templates-ats-elite.css\`
- A4 page layout via \`cv-a4-pages.js\`

## Output artifact

| File | Size |
|------|------|
| \`tests/output/ats-elite/ats-elite.pdf\` | ${pdfBytes} bytes |

## Verification

\`\`\`bash
npm run qa:ats-elite-template
npm run ats-elite-pdf-export-report
\`\`\`

## Checks

- PDF generated (${pdfExists ? 'yes' : 'no'})
- PDF size > 2KB (${pdfBytes > 2000 ? 'yes' : 'no'})
- No horizontal crop in preview
- Black & white typography preserved in export CSS stack

**QA overall:** ${report?.pass ? 'PASS' : 'FAIL'}
`;

fs.writeFileSync(OUT, md);
console.log(`Wrote ${OUT} (${qaPass && pdfExists ? 'PASS' : 'FAIL'})`);
process.exitCode = qaPass && pdfExists ? 0 : 1;
