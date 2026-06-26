#!/usr/bin/env node
/**
 * Generates TEMPLATE_SYSTEM_V2.md
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import {
  TEMPLATE_SYSTEM_V2_VERSION,
  TEMPLATE_FAMILY_V2_IDS,
  TEMPLATE_FAMILY_V2_NAMES,
  TEMPLATE_FAMILY_V2_ARCHITECTURE,
  TEMPLATE_FAMILY_V2_CSS,
} from '../src/ui/templates/template-families-v2.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'TEMPLATE_SYSTEM_V2.md');

function run(cmd) {
  try {
    return { ok: true, out: execSync(cmd, { cwd: ROOT, encoding: 'utf8' }) };
  } catch (e) {
    return { ok: false, out: (e.stdout || '') + (e.stderr || '') + (e.message || '') };
  }
}

const qa = run('node src/tests/qa-template-system-v2-families.mjs');

function archSection(id) {
  const a = TEMPLATE_FAMILY_V2_ARCHITECTURE[id];
  const name = TEMPLATE_FAMILY_V2_NAMES[id];
  return `### ${name} (\`${id}\`)

| Dimension | Architecture |
|-----------|--------------|
| **Grid** | ${a.grid} |
| **Hierarchy** | ${a.hierarchy} |
| **Typography** | ${a.typography} |
| **Spacing** | ${a.spacing} |
| **Emphasis** | ${a.emphasis} |
| **Layout family** | \`${a.layoutFamily}\` |
| **Section order** | ${a.sectionOrder.join(' → ')} |

\`\`\`
┌─ Identity / masthead
├─ ${a.sectionOrder[0]} (primary)
├─ ${a.sectionOrder[1] || '—'}
└─ ${a.sectionOrder.slice(2, 4).join(' · ') || 'supporting sections'}
\`\`\`
`;
}

const report = `# TEMPLATE_SYSTEM_V2

Generated: ${new Date().toISOString()}

## P2 status

| Item | Value |
|------|-------|
| Version | \`${TEMPLATE_SYSTEM_V2_VERSION}\` |
| Families | **10** distinct template architectures |
| Module | \`src/ui/templates/template-families-v2.mjs\` |
| Render engine | \`src/ui/templates/cv-templates.js\` (V2 layout stacks + \`wrapV2\`) |
| CSS | \`${TEMPLATE_FAMILY_V2_CSS}\` |
| QA | ${qa.ok ? '**PASS**' : '**FAIL**'} |

## Design principle

> Templates must differ in **grid**, **hierarchy**, **typography**, **spacing**, and **information emphasis** — not merely fonts.

V2 families use \`wrapV2()\` to skip the shared \`cvLayout-professional\` baseline. Each family has a bespoke HTML stack and scoped CSS under \`.cv.template-{id}\`.

## Pipeline

\`\`\`
finalResumeData → normalizeCvData → HirelyTemplates.render()
  → layoutFamilyV2(p) → wrapV2 → #cvDoc.template-{id}
\`\`\`

## Family catalog

| # | Family | ID | Layout family |
|---|--------|-----|---------------|
${TEMPLATE_FAMILY_V2_IDS.map((id, i) => {
  const a = TEMPLATE_FAMILY_V2_ARCHITECTURE[id];
  return `| ${i + 1} | ${TEMPLATE_FAMILY_V2_NAMES[id]} | \`${id}\` | ${a.layoutFamily} |`;
}).join('\n')}

## Visual architecture (per family)

${TEMPLATE_FAMILY_V2_IDS.map(archSection).join('\n')}

## Legacy alias map

| V1 id | V2 canonical |
|-------|--------------|
| \`ats-elite\` | \`ats-recruiter\` |
| \`agency-designer\` / \`swiss-editorial\` | \`mckinsey-consulting\` |
| \`visual-timeline\` | \`apple-minimal\` |
| \`editorial-magazine\` | \`kinfolk-editorial\` |
| \`creative-director\` | \`creative-director-portfolio\` |
| \`executive-luxury\` / \`ats-executive\` | \`luxury-executive\` |
| \`startup-builder\` | \`startup-founder\` |
| \`tech-structured\` | \`tech-engineer\` |
| \`art-director-portfolio\` | \`art-director\` |
| \`freelance\` | \`freelance-creative\` |

## Verification

\`\`\`bash
npm run qa:template-system-v2-families
npm run template-system-v2-report
\`\`\`
`;

fs.writeFileSync(OUT, report, 'utf8');
console.log(`Wrote ${OUT}`);
if (qa.out) console.log(qa.out.trim());
