#!/usr/bin/env node
/**
 * Generate TEMPLATE_LIBRARY_V3.md
 */
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  TEMPLATE_LIBRARY_V3_VERSION,
  TEMPLATE_FAMILY_V3_IDS,
  TEMPLATE_FAMILY_V3_NAMES,
  TEMPLATE_FAMILY_V3_ARCHITECTURE,
  TEMPLATE_FAMILY_V3_CSS,
} from '../src/ui/templates/template-families-v3.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const gate = spawnSync('node', ['src/tests/qa-template-library-v3.mjs'], { cwd: root, encoding: 'utf8' });
const gateOk = gate.status === 0;

function archSection(id) {
  const a = TEMPLATE_FAMILY_V3_ARCHITECTURE[id];
  const name = TEMPLATE_FAMILY_V3_NAMES[id];
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

const lines = [];
lines.push('# Template Library V3');
lines.push('');
lines.push(`**Generated:** ${new Date().toISOString().slice(0, 10)}`);
lines.push(`**Version:** \`${TEMPLATE_LIBRARY_V3_VERSION}\``);
lines.push(`**QA gate:** ${gateOk ? 'PASS' : 'FAIL'}`);
lines.push('');
lines.push('## Design principle');
lines.push('');
lines.push('> Every template must differ in **hierarchy**, **typography**, **spacing**, and **structure** — not merely color or font swaps.');
lines.push('');
lines.push('V3 families use `wrapV3()` with scoped CSS under `.cv.template-{id}` in `cv-templates-v3-families.css`.');
lines.push('');
lines.push('## Catalog');
lines.push('');
lines.push('| # | Template | ID | Layout family |');
lines.push('|---|----------|-----|---------------|');
TEMPLATE_FAMILY_V3_IDS.forEach((id, i) => {
  const a = TEMPLATE_FAMILY_V3_ARCHITECTURE[id];
  lines.push(`| ${i + 1} | ${TEMPLATE_FAMILY_V3_NAMES[id]} | \`${id}\` | ${a.layoutFamily} |`);
});
lines.push('');
lines.push('## Architecture (per template)');
lines.push('');
lines.push(TEMPLATE_FAMILY_V3_IDS.map(archSection).join('\n'));
lines.push('## Files');
lines.push('');
lines.push('| File | Role |');
lines.push('|------|------|');
lines.push('| `src/ui/templates/template-families-v3.mjs` | Catalog, aliases, architecture specs |');
lines.push('| `src/ui/templates/template-library-v3.mjs` | Production re-exports |');
lines.push('| `src/ui/templates/cv-templates-v3-families.css` | Structural CSS per template |');
lines.push('| `src/ui/templates/cv-templates.js` | V3 layout functions + `wrapV3()` |');
lines.push('| `src/ui/templates/ten-premium-templates.mjs` | Gallery production bridge |');
lines.push('');
lines.push('## Legacy alias map (V2 → V3)');
lines.push('');
lines.push('| Legacy ID | V3 canonical |');
lines.push('|-----------|--------------|');
lines.push('| `mckinsey-consulting` | `consulting-elite` |');
lines.push('| `apple-minimal` | `apple-style` |');
lines.push('| `tech-engineer` | `google-style` |');
lines.push('| `creative-director-portfolio` | `creative-director` |');
lines.push('| `luxury-executive` | `executive-board` |');
lines.push('| `ats-recruiter` | `minimal-ats` |');
lines.push('| `kinfolk-editorial` | `luxury-editorial` |');
lines.push('');
lines.push('## Verification');
lines.push('');
lines.push('```bash');
lines.push('npm run qa:template-library-v3');
lines.push('npm run template-library-v3-report');
lines.push('```');
lines.push('');
lines.push(`**CSS bundle:** \`${TEMPLATE_FAMILY_V3_CSS}\``);

if (!gateOk && gate.stderr) {
  lines.push('');
  lines.push('### QA stderr');
  lines.push('');
  lines.push('```');
  lines.push(gate.stderr.trim().slice(0, 2000));
  lines.push('```');
}

writeFileSync(join(root, 'TEMPLATE_LIBRARY_V3.md'), lines.join('\n') + '\n', 'utf8');
console.log('Wrote TEMPLATE_LIBRARY_V3.md');
process.exit(gateOk ? 0 : 1);
