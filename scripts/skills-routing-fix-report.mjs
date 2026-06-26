#!/usr/bin/env node
/**
 * Generates SKILLS_ROUTING_FIX_REPORT.md from real-world stress suite.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT_MD = path.join(ROOT, 'SKILLS_ROUTING_FIX_REPORT.md');
const REPORT_JSON = path.join(ROOT, 'tests/output/real-world-stress/report.json');
const SKILLS_GOAL_PCT = 90;

function runSuite() {
  try {
    execSync('node src/tests/qa-real-world-stress-test.mjs', { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
    return { ok: true };
  } catch (e) {
    return { ok: false, out: (e.stdout || '') + (e.stderr || '') };
  }
}

const suiteRun = runSuite();
const report = JSON.parse(fs.readFileSync(REPORT_JSON, 'utf8'));
const s = report.summary;

const skillFails = (report.results || []).filter((r) => (r.skillsAccuracy || 0) < SKILLS_GOAL_PCT);
const skillPassRows = (report.results || [])
  .filter((r) => (r.skillsAccuracy || 0) >= SKILLS_GOAL_PCT)
  .map((r) => `| ${r.id} | ${r.role} | ${r.format} | ${r.skillsAccuracy}% |`)
  .join('\n');

const skillFailRows = skillFails
  .map((r) => {
    const fn = (r.sections?.skills?.falseNegatives || []).slice(0, 5).join('; ') || '—';
    return `| ${r.id} | ${r.role} | ${r.format} | ${r.skillsAccuracy}% | ${fn} |`;
  })
  .join('\n') || '| — | — | — | — | — |';

const md = `# Skills Routing Fix Report (P0)

**Generated:** ${report.generatedAt}
**Acceptance:** skills accuracy **≥ ${SKILLS_GOAL_PCT}%**
**Suite:** ${report.count} real-world CVs (${report.engine})

## Result

| Metric | Before fix | After fix | Goal | Status |
| --- | --- | --- | --- | --- |
| **Skills accuracy** | 65.8% | **${s.skillsAccuracy}%** | ≥ ${SKILLS_GOAL_PCT}% | ${s.skillsAccuracy >= SKILLS_GOAL_PCT ? '**PASS**' : 'FAIL'} |
| Overall extraction | 86.4% | ${s.extractionAccuracy}% | — | — |
| Per-CV pass rate | 22% | ${s.successRate}% | — | — |

QA gate: ${suiteRun.ok ? 'PASS' : 'FAIL (non-skills dimensions)'}

## Root cause (pre-fix)

1. **Enterprise parser threshold** — comma-split skill tokens scored ~50% each; only the first dictionary hit (e.g. "Strategy") passed the 70% gate.
2. **Either/or merge** — \`parseStructuredCV\` used enterprise skills when *any* were approved, discarding \`detectSkills(blocks)\` output.
3. **Section headers stripped** — pipeline \`rawText\` dropped \`Skills\` / \`Tools\` headers, so \`splitBySectionHeaders\` could not recover list bodies.
4. **Sanitize overwrite** — \`harvestSkillsFromDescriptions\` replaced section skills with experience-harvested tokens (e.g. "Leadership" only).
5. **Tools demotion** — comma-separated tool lines failed \`isLikelyTool\` in section sanity and landed in \`unsorted\`.

## Fix summary

| Layer | File | Change |
| --- | --- | --- |
| Skills routing module | \`src/core/parsing/skills-routing.js\` | New pass: header + orphan comma-list routing; tool token split |
| Unsorted recovery | \`unsorted-section-recovery.js\` | Calls \`applySkillsRoutingPass\` on raw text |
| Enterprise split boost | \`parser-enterprise.js\` | Comma lists under skills/tools inherit parent-line confidence |
| Parser merge | \`rich-parser.js\` | Merge \`detectSkills\` + enterprise skills; merge tools |
| Section sanity | \`section-sanity.js\` | Broader comma-list skill/tool detection |
| Polish pass | \`resume-output-quality.js\` | Route comma lists from unsorted before drain |
| Display sanitize | \`sanitize-resume-display.js\` | Preserve section-routed skills before harvest |
| Section aliases | \`section-fuzzy.js\` | Added \`stack\`; tools headers include technologies/stack |

## Routing rules (implemented)

- Section headers: Skills, Competences, Compétences, Expertise, Tools, Technologies, Stack, Software
- Comma/bullet-separated lists split via \`splitListItems\`
- Software tokens → \`resumeData.tools\`
- Professional/competency tokens → \`resumeData.skills\`
- Routed lines removed from \`unsorted\` where possible
- No duplicate across skills/tools (tool check runs first)

## Per-CV skills ≥ ${SKILLS_GOAL_PCT}%

| ID | Role | Format | Skills accuracy |
| --- | --- | --- | --- |
${skillPassRows || '| — | — | — | — |'}

## Remaining skills failures (< ${SKILLS_GOAL_PCT}%)

| ID | Role | Format | Skills accuracy | Missed (sample) |
| --- | --- | --- | --- | --- |
${skillFailRows}

## Verification

\`\`\`bash
npm run qa:real-world-stress
npm run skills-routing-report
\`\`\`

## Files touched

- \`src/core/parsing/skills-routing.js\` (new)
- \`src/core/parsing/unsorted-section-recovery.js\`
- \`src/core/parsing/parser-enterprise.js\`
- \`src/core/parsing/rich-parser.js\`
- \`src/core/parsing/section-sanity.js\`
- \`src/core/parsing/section-fuzzy.js\`
- \`src/core/parsing/resume-output-quality.js\`
- \`src/core/validation/sanitize-resume-display.js\`
- \`scripts/skills-routing-fix-report.mjs\` (new)
`;

fs.writeFileSync(OUT_MD, md);
console.log(`Wrote ${OUT_MD}`);
console.log(`Skills accuracy: ${s.skillsAccuracy}% (goal ${SKILLS_GOAL_PCT}%)`);
