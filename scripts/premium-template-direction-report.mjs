#!/usr/bin/env node
/**
 * HIRELY P1 — Generate PREMIUM_TEMPLATE_DIRECTION_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import {
  PRODUCTION_TEMPLATE_DISPLAY_NAMES,
} from '../src/ui/templates/production-template-ids.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'PREMIUM_TEMPLATE_DIRECTION_REPORT.md');

const PREMIUM_P1_IDS = ['ats', 'creative', 'executive-minimal'];

function run(cmd, args) {
  const res = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  return { pass: res.status === 0, out: `${res.stdout || ''}\n${res.stderr || ''}`.trim() };
}

const qaDirection = run('node', ['src/tests/qa-premium-template-direction.mjs']);
const pass = qaDirection.pass;

const lines = [
  '# HIRELY P1 — Premium Template Direction Report',
  '',
  `**Result:** ${pass ? 'PASS' : 'FAIL'}`,
  `**Generated:** ${new Date().toISOString()}`,
  '',
  '## Mission',
  '',
  'Research seven designer-grade document references and ship three premium CV templates that read like documents made by designers — not SaaS widgets. A4-first, print-readable, text-only.',
  '',
  '## Research synthesis',
  '',
  '| Reference | What we borrowed | What we rejected |',
  '|-----------|------------------|------------------|',
  '| **Apple** | System sans stack, extreme clarity, generous margins, restrained weight | Product marketing chrome, colorful badges |',
  '| **Notion** | Block hierarchy, subtle dividers, scannable section labels | Database views, icons, property chips |',
  '| **Linear** | Micro uppercase labels, tight typographic rhythm, monochrome discipline | Issue IDs, status pills, sidebar chrome |',
  '| **Pitch** | Confident display type, presentation-grade header tension | Slides UI, gradients, decorative frames |',
  '| **Arc Browser** | Distinctive but functional personality in headers only | Browser chrome, tabs, UI ornaments |',
  '| **Canva Resume** | Executive serif authority, stone neutrals, centered senior layout | Template marketplace badges, star ratings |',
  '| **Read.cv** | Text-first portfolio pages, clients/projects prominence, no widgets | Hosted profile chrome, social embeds |',
  '',
  '## Design rules (non-negotiable)',
  '',
  '| Rule | Implementation |',
  '|------|----------------|',
  '| Designer-made documents | Typography-led hierarchy; no illustration widgets |',
  '| No ATS badges | `tplAts` / `tplCat` only rendered in `?debug=true` picker |',
  '| No fake scores | No score markup in template HTML (`cvScore`, bars, ribbons) |',
  '| No decorative widgets | Skill bars, timeline dots, chips hidden globally |',
  '| A4 first | `794×1123` canvas · `max-width: 794px` · `210mm` PDF |',
  '| Readable when printed | `@media print` color-adjust + pure black section labels |',
  '',
  '## Premium trio',
  '',
  '| Template | ID | Direction | Typography | Palette |',
  '|----------|-----|-----------|------------|---------|',
  `| ${PRODUCTION_TEMPLATE_DISPLAY_NAMES.ats} | \`ats\` | Single-column recruiter scan · Apple/Notion clarity | Inter / system-ui | Pure black \`#000\` on white |`,
  `| ${PRODUCTION_TEMPLATE_DISPLAY_NAMES.creative} | \`creative\` | Magazine split header · Pitch confidence · Read.cv portfolio order | Cormorant Garamond + DM Sans | Zinc ink \`#0a0a0a\` |`,
  `| ${PRODUCTION_TEMPLATE_DISPLAY_NAMES['executive-minimal']} | \`executive-minimal\` | Centered senior profile · Apple restraint · Canva executive stone | Cormorant Garamond + Source Serif 4 | Stone \`#fafaf9\` header |`,
  '',
  '### ATS Clean',
  '',
  '- **Layout:** Single column, summary in head, 3-column meta grid for contact/skills/tools',
  '- **Hierarchy:** Muted micro-labels (Notion/Linear), body-forward experience blocks',
  '- **Print:** 1.5px ink rule under header; section rules light gray for toner-friendly output',
  '',
  '### Creative Portfolio',
  '',
  '- **Layout:** Split header (name left, contact right), clients/projects before experience',
  '- **Hierarchy:** Display serif name + uppercase role track; left-border project entries',
  '- **Print:** 3px headline rule (down from decorative 4px) for crisp PDF',
  '',
  '### Executive Minimal',
  '',
  '- **Layout:** Centered narrow column (`52em`), compact vertical rhythm',
  '- **Hierarchy:** Serif display name, sans uppercase title, centered section labels',
  '- **Print:** Stone header flattens to white in `@media print` for reliable grayscale',
  '',
  '## Files touched',
  '',
  '| File | Change |',
  '|------|--------|',
  '| `src/ui/templates/cv-templates-professional.css` | P1 typography + print rules for premium trio |',
  '| `src/ui/templates/cv-templates.js` | Display names + category copy |',
  '| `src/ui/templates/production-template-ids.mjs` | Canonical display names |',
  '| `src/ui/templates/v2/registry.js` | V2 registry display names + taglines |',
  '| `src/ui/templates/template-system-h20.mjs` | H20 fingerprint names |',
  '| `index.html` | Picker labels, default state, debug-only ATS meta |',
  '',
  '## QA gates',
  '',
  '```',
  qaDirection.out || '(no output)',
  '```',
  '',
  '## Verification',
  '',
  '```bash',
  'npm run test:premium-template-direction',
  '```',
  '',
  `**Premium template IDs:** ${PREMIUM_P1_IDS.map((id) => `\`${id}\``).join(', ')}`,
  '',
];

fs.writeFileSync(OUT, `${lines.join('\n')}\n`);
console.log(`Wrote ${OUT}`);
console.log(pass ? 'PREMIUM_TEMPLATE_DIRECTION_REPORT: PASS' : 'PREMIUM_TEMPLATE_DIRECTION_REPORT: FAIL');
process.exit(pass ? 0 : 1);
