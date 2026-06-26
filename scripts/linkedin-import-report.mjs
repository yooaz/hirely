#!/usr/bin/env node
/**
 * Generate LINKEDIN_IMPORT_REPORT.md
 */
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  LINKEDIN_IMPORT_ENGINE,
  runLinkedInImportMerge,
} from '../src/core/import/linkedin-import-engine.js';
import {
  parseLinkedInExportText,
  resumeDataFromLinkedInExport,
} from '../src/core/import/linkedin-export-parser.js';
import { runHirelyImportFromText } from '../src/core/pipeline/hirely-import.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const gate = spawnSync('node', ['src/tests/qa-linkedin-import.mjs'], { cwd: root, encoding: 'utf8' });
const gateOk = gate.status === 0;

const PROFILE = `[{"First Name":"Marie","Last Name":"Dupont","Headline":"Senior Product Designer","Email Address":"marie@example.com","Profile Url":"https://linkedin.com/in/mariedupont","Location":"Paris"}]`;
const POSITIONS = `[{"Company Name":"Acme SaaS","Title":"Senior Product Designer","Started On":"Jan 2020","Finished On":"Present","Description":"Led design system"}]`;
const RESUME = `Marie Dupont\nSenior Product Designer\nmarie@example.com\n+33 612345678\nParis\n\nExperience\nSenior Product Designer — Acme SaaS — 2020–Present\n- Led design system for 40 engineers\n\nSkills\nFigma, Design Systems, User Research`;

const exportRd = resumeDataFromLinkedInExport({
  ...parseLinkedInExportText(PROFILE, 'Profile.json'),
  positions: parseLinkedInExportText(POSITIONS, 'Positions.json')?.positions || [],
});

const resumeImp = await runHirelyImportFromText(RESUME, { source: 'report', extractionMethod: 'paste' });

const merged = runLinkedInImportMerge([
  { fileName: 'Profile.json', rawText: PROFILE, resumeData: exportRd },
  { fileName: 'resume.pdf', rawText: RESUME, resumeData: resumeImp.resumeData },
]);

const lines = [];
lines.push('# LinkedIn Import Report');
lines.push('');
lines.push(`**Generated:** ${new Date().toISOString().slice(0, 10)}`);
lines.push(`**Engine:** \`${LINKEDIN_IMPORT_ENGINE}\``);
lines.push(`**QA gate:** ${gateOk ? 'PASS' : 'FAIL'}`);
lines.push('');
lines.push('## Supported sources');
lines.push('');
lines.push('| Source | Detection | Parser |');
lines.push('|--------|-----------|--------|');
lines.push('| LinkedIn PDF | Filename + `linkedin.com/in`, Top Skills markers | Standard PDF extraction |');
lines.push('| LinkedIn profile export | `.json` / `.csv` with Profile, Positions, Skills keys | `linkedin-export-parser.js` |');
lines.push('| Resume PDF | Generic CV markers, default PDF path | Production import pipeline |');
lines.push('');
lines.push('## Merge strategy');
lines.push('');
lines.push('1. **Score each source** — field completeness × source-type weight');
lines.push('2. **Pick best scalar** — name, title, email, phone, LinkedIn URL, summary');
lines.push('3. **Merge lists** — skills, tools, education, languages with fuzzy dedupe');
lines.push('4. **Experience merge** — `dedupeExperienceEntries` keeps richest role block');
lines.push('5. **Duplicate report** — logs merged pairs and field winners');
lines.push('');
lines.push('## Source quality weights');
lines.push('');
lines.push('| Field | LinkedIn export | LinkedIn PDF | Resume PDF |');
lines.push('|-------|-----------------|--------------|------------|');
lines.push('| Identity / LinkedIn URL | High | High URL | Medium |');
lines.push('| Experience bullets | High structured | Medium | Highest |');
lines.push('| Skills | Highest | High | Medium |');
lines.push('| Summary | Medium | Medium | Highest |');
lines.push('');
lines.push('## Sample merge (fixture)');
lines.push('');
lines.push('| Metric | Value |');
lines.push('|--------|-------|');
lines.push(`| Sources | ${merged.sources?.length ?? 0} |`);
lines.push(`| Confidence | ${merged.confidence} |`);
lines.push(`| Experiences | ${merged.resumeData?.experiences?.length ?? 0} |`);
lines.push(`| Skills | ${merged.resumeData?.skills?.length ?? 0} |`);
lines.push(`| Duplicates resolved | ${merged.report?.duplicates?.length ?? 0} |`);
lines.push('');
if (merged.report?.winners && Object.keys(merged.report.winners).length) {
  lines.push('### Field winners');
  lines.push('');
  for (const [k, v] of Object.entries(merged.report.winners)) {
    lines.push(`- **${k}** ← ${v}`);
  }
  lines.push('');
}
lines.push('## Files');
lines.push('');
lines.push('| File | Role |');
lines.push('|------|------|');
lines.push('| `src/core/import/linkedin-source-detect.js` | Source detection |');
lines.push('| `src/core/import/linkedin-export-parser.js` | JSON/CSV export parser |');
lines.push('| `src/core/import/linkedin-import-engine.js` | Merge + quality scoring |');
lines.push('| `src/ui/product/linkedin-import-panel.js` | Import UI summary |');
lines.push('| `index.html` | Multi-file drop + merge hook |');
lines.push('');
lines.push('## Commands');
lines.push('');
lines.push('```bash');
lines.push('npm run qa:linkedin-import');
lines.push('npm run linkedin-import-report');
lines.push('```');

writeFileSync(join(root, 'LINKEDIN_IMPORT_REPORT.md'), `${lines.join('\n')}\n`);
console.log('Wrote LINKEDIN_IMPORT_REPORT.md');
process.exit(gateOk ? 0 : 1);
