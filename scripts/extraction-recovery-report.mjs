#!/usr/bin/env node
/**
 * Generate EXTRACTION_RECOVERY_REPORT.md
 */
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  EXTRACTION_RECOVERY_V1,
  RECOVERY_LOW_CONFIDENCE_MIN,
  runExtractionRecovery,
  isCvOutputSafe,
} from '../src/core/validation/extraction-recovery.js';
import { UNDETECTED_INFORMATION_LABEL } from '../src/core/display/undetected-label.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const gate = spawnSync('node', ['src/tests/qa-extraction-recovery.mjs'], { cwd: root, encoding: 'utf8' });
const gateOk = gate.status === 0;

const fixtures = {
  strong: {
    finalResumeData: {
      identity: { name: 'Yohann Azancot', title: 'Designer', email: 'yoaz@hotmail.fr' },
      experiences: [{ role: 'Designer', company: 'McCann', dates: '2011–2014' }],
      education: ['Créapole — 2008–2011'],
      skills: ['Illustration'],
    },
    contract: { renderable: true },
    importQualityScore: 90,
  },
  weak: {
    finalResumeData: { identity: { name: '', email: '' }, experiences: [], education: [], skills: [] },
    contract: { renderable: true },
    importQualityScore: 28,
  },
  placeholder: {
    finalResumeData: {
      identity: { name: 'Alex', email: 'a@b.com' },
      experiences: [{ role: 'Dev', company: UNDETECTED_INFORMATION_LABEL, dates: '2020' }],
      skills: ['JS'],
    },
    contract: { renderable: true },
  },
};

const rows = Object.entries(fixtures).map(([tier, input]) => ({
  tier,
  result: runExtractionRecovery(input),
}));

const lines = [];
lines.push('# Extraction Recovery Report');
lines.push('');
lines.push(`**Generated:** ${new Date().toISOString().slice(0, 10)}`);
lines.push(`**Engine:** \`${EXTRACTION_RECOVERY_V1}\``);
lines.push(`**Low-confidence threshold:** ${RECOVERY_LOW_CONFIDENCE_MIN}%`);
lines.push(`**QA gate:** ${gateOk ? 'PASS' : 'FAIL'}`);
lines.push('');
lines.push('## Policy');
lines.push('');
lines.push('- When extraction confidence is low, **never fail silently**.');
lines.push('- Surface **Detected Issues**, **Missing Sections**, and **Low Confidence Fields**.');
lines.push('- Allow user correction via Fix / Add actions in the inspector panel.');
lines.push('- **Never output broken CVs** — placeholder or critical-missing content blocks preview and export.');
lines.push('');
lines.push('## Architecture');
lines.push('');
lines.push('| Layer | Path | Role |');
lines.push('|-------|------|------|');
lines.push('| Engine | `src/core/validation/extraction-recovery.js` | Aggregates readiness, placeholders, field confidence |');
lines.push('| UI | `src/ui/product/extraction-recovery-panel.js` | Three-section recovery inspector |');
lines.push('| Styles | `src/ui/product/extraction-recovery.css` | Editorial panel styling |');
lines.push('| Gate | `index.html` | `renderCVInner` blocks `blockRender`; `isExportReady` checks `outputSafe` |');
lines.push('');
lines.push('## Fixture matrix');
lines.push('');
lines.push('| Fixture | Show recovery | Output safe | Block render | Issues | Missing | Low conf |');
lines.push('|---------|---------------|-------------|--------------|--------|---------|----------|');
for (const { tier, result } of rows) {
  lines.push(
    `| ${tier} | ${result.showRecovery} | ${result.outputSafe} | ${result.blockRender} | ${result.counts.issues} | ${result.counts.missing} | ${result.counts.lowConfidence} |`
  );
}
lines.push('');
lines.push('## UI sections');
lines.push('');
lines.push('1. **Detected Issues** — pending review-queue items + placeholder violations');
lines.push('2. **Missing Sections** — name, email, experience, education, skills gaps');
lines.push('3. **Low Confidence Fields** — fields below field-confidence V2 threshold');
lines.push('');
lines.push('## Verification');
lines.push('');
lines.push('```bash');
lines.push('npm run qa:extraction-recovery');
lines.push('npm run extraction-recovery-report');
lines.push('```');
lines.push('');
if (!gateOk && gate.stderr) {
  lines.push('### QA stderr');
  lines.push('');
  lines.push('```');
  lines.push(gate.stderr.trim().slice(0, 2000));
  lines.push('```');
}

writeFileSync(join(root, 'EXTRACTION_RECOVERY_REPORT.md'), lines.join('\n') + '\n', 'utf8');
console.log('Wrote EXTRACTION_RECOVERY_REPORT.md');
process.exit(gateOk ? 0 : 1);
