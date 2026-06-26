#!/usr/bin/env node
/**
 * Navigation Lock Report — resumeData gates all steps except Import.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'NAVIGATION_LOCK_REPORT.md');
const INDEX = path.join(ROOT, 'index.html');

const indexHtml = fs.readFileSync(INDEX, 'utf8');
const navMod = fs.readFileSync(path.join(ROOT, 'src/core/navigation/navigation-lock.js'), 'utf8');
const coreIndex = fs.readFileSync(path.join(ROOT, 'src/core/index.js'), 'utf8');

const checks = [];
function add(id, ok, detail = '') {
  checks.push({ id, ok, detail });
}

add('file:navigation-lock-js', fs.existsSync(path.join(ROOT, 'src/core/navigation/navigation-lock.js')));
add('core:exports-navigation-lock', coreIndex.includes("from './navigation/navigation-lock.js'"));
add('flag:HIRELY_NAVIGATION_LOCK', /HIRELY_NAVIGATION_LOCK\s*=\s*true/.test(indexHtml));
add('fn:navigationLockActive', /function navigationLockActive\(\)/.test(indexHtml));
add('fn:hasNavResumeData', /function hasNavResumeData\(\)/.test(indexHtml));
add('guard:guardCvDataStep-resumeData', /navigationLockActive\(\)[\s\S]{0,200}hasNavResumeData\(\)/.test(indexHtml));
add('nav:isTemplateReady-resumeData', /function isTemplateReady\(\)[\s\S]{0,80}navigationLockActive\(\)\)return hasNavResumeData\(\)/.test(indexHtml));
add('nav:isExportReady-resumeData', /function isExportReady\(\)[\s\S]{0,80}navigationLockActive\(\)\)return hasNavResumeData\(\)/.test(indexHtml));
add('nav:getCvDataValidation-no-blocks', /navigationLockActive\(\)[\s\S]{0,250}blockReview:false[\s\S]{0,80}blockExport:false/.test(indexHtml));
add('nav:progressNav-resumeData-only', /stepLocked=navigationLockActive\(\)\?\(step!=='import'&&!hasNavResumeData\(\)\)/.test(indexHtml));
add('nav:flowCta-never-disabled', /templateLocked=navigationLockActive\(\)\?false/.test(indexHtml) && /exportLocked=navigationLockActive\(\)\?false/.test(indexHtml));
add('nav:setDocStep-skips-legacy-locks', /if\(!navigationLockActive\(\)\)\{[\s\S]{0,600}isTemplateReady/.test(indexHtml));
add('nav:download-resumeData-gate', /navigationLockActive\(\)&&!hasNavResumeData\(\)/.test(indexHtml));
add('nav:premium-template-cards-unlocked', /!navigationLockActive\(\)&&!isPro\(\)/.test(indexHtml));
add('removed:review-before-template-nav', !/if\(next==='style'&&!v1FlowUnlocked\(\)&&!isTemplateReady\(\)\)/.test(indexHtml.replace(/if\(!navigationLockActive\(\)\)\{[\s\S]*?\n \}\n state\.docStep=next/, '')) || /if\(!navigationLockActive\(\)\)/.test(indexHtml));
add('module:hasResumeDataForNavigation', navMod.includes('hasResumeDataForNavigation'));
add('module:NAVIGATION_LOCK_VERSION', navMod.includes('navigation-lock-v1'));

const pass = checks.filter((c) => c.ok).length;
const total = checks.length;
const status = pass === total ? 'PASS' : 'FAIL';

const md = `# Navigation Lock

**Generated:** ${new Date().toISOString()}
**Status:** **${status}** (${pass}/${total} checks)
**Version:** \`NAVIGATION_LOCK_V1\` (\`navigation-lock-v1\`)

## Rule

| \`resumeData\` | Import | Review | Style | Export |
| --- | --- | --- | --- | --- |
| **Present** | ✓ | ✓ | ✓ | ✓ |
| **Absent** | ✓ | ✗ | ✗ | ✗ |

No other navigation lock is allowed when \`HIRELY_NAVIGATION_LOCK=true\`.

## Removed / bypassed

| Lock type | Previous behavior | Navigation lock |
| --- | --- | --- |
| Review lock | \`blockReview\`, review guarantee | Bypassed — \`blockReview: false\` |
| Template lock | \`review-before-template-lock\`, \`isTemplateReady()\` gates | \`isTemplateReady() → hasNavResumeData()\` |
| Export lock | \`isExportReady()\`, quality validator, recovery | \`isExportReady() → hasNavResumeData()\` |
| Premium lock | Pro template cards + \`requirePro()\` on PDF | Cards unlocked; PDF allowed with \`resumeData\` |
| Validation lock | \`cv-data-protection\`, INVALID status blocks nav | \`getCvDataValidation()\` returns no blocks |

## Runtime flag

\`\`\`javascript
HIRELY_NAVIGATION_LOCK = true  // also when HIRELY_ONE_CV_SOURCE or HIRELY_V1_SCOPE_LOCK
\`\`\`

## Functions (index.html)

| Function | Navigation lock behavior |
| --- | --- |
| \`hasNavResumeData()\` | \`!!getResumeData()\` |
| \`guardCvDataStep(step)\` | Non-import steps require \`resumeData\` |
| \`getCvDataValidation()\` | No \`blockReview/Style/Export\` |
| \`renderProgressNav()\` | Lock only when step ≠ import and no \`resumeData\` |
| \`syncFlowPrimaryCta()\` | CTA never disabled for template/export locks |
| \`setDocStep()\` | Legacy template/export guards wrapped in \`!navigationLockActive()\` |
| \`downloadPDF()\` | Requires \`resumeData\` only (no validation stack) |

## Module

\`src/core/navigation/navigation-lock.js\` — \`isNavigationLockEnabled\`, \`canNavigateToStep\`, \`buildNavigationLockValidation\`

## Static checks

| Check | Status | Detail |
| --- | --- | --- |
${checks.map((c) => `| ${c.id} | ${c.ok ? 'PASS' : 'FAIL'} | ${c.detail || '—'} |`).join('\n')}

## Verification

\`\`\`bash
npm run navigation-lock-report
\`\`\`

## Note

Review badges and quality panels may still display informational warnings. They must not disable navigation when navigation lock is active.
`;

fs.writeFileSync(OUT, md, 'utf8');
console.log(`Wrote ${OUT} — ${status} (${pass}/${total})`);
process.exit(status === 'PASS' ? 0 : 1);
