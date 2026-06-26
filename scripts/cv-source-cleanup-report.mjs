#!/usr/bin/env node
/**
 * CV Source Cleanup Report — single resumeData source for review, templates, export.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'CV_SOURCE_CLEANUP_REPORT.md');
const INDEX = path.join(ROOT, 'index.html');

const indexHtml = fs.readFileSync(INDEX, 'utf8');
const sourceMod = fs.readFileSync(path.join(ROOT, 'src/core/resume/resume-data-source.js'), 'utf8');
const coreIndex = fs.readFileSync(path.join(ROOT, 'src/core/index.js'), 'utf8');

const checks = [];
function add(id, ok, detail = '') {
  checks.push({ id, ok, detail });
}

add('file:resume-data-source-js', fs.existsSync(path.join(ROOT, 'src/core/resume/resume-data-source.js')));
add('core:exports-resume-data-source', coreIndex.includes("from './resume/resume-data-source.js'"));
add('flag:HIRELY_ONE_CV_SOURCE', /HIRELY_ONE_CV_SOURCE\s*=\s*true/.test(indexHtml));
add('fn:oneCvSourceActive', /function oneCvSourceActive\(\)/.test(indexHtml));
add('fn:getResumeData', /function getResumeData\(\)/.test(indexHtml));
add('read:getFinalResumeData-aliases-resumeData', /oneCvSourceActive\(\)\)return getResumeData\(\)/.test(indexHtml));
add('valid:isFinalResumeValid-resumeData', indexHtml.includes('resumeDataIsRenderable(rd,{skipNormalize:true})'));
add('adapter:mapFinalResumeToCvData-one-source', /oneCvSourceActive\(\)[\s\S]{0,400}resumeDataToCvData/.test(indexHtml));
add('cache:syncDerivedCvFromResumeData', /function syncDerivedCvDataFromFinal\(\)[\s\S]{0,500}oneCvSourceActive\(\)[\s\S]{0,300}resumeDataToCvData/.test(indexHtml));
add('commit:skips-buildFinalResumeData', /ONE_CV_SOURCE_COMMITTED/.test(indexHtml) && /oneCvSourceActive\(\)[\s\S]{0,80}finalResumeData=null/.test(indexHtml));
add('counts:getFinalSectionCounts-resumeData', /oneCvSourceActive\(\)\)return sectionCountsFromFinalResume\(getResumeData\(\)\)/.test(indexHtml));
add('module:isOneCvSourceEnabled', sourceMod.includes('isOneCvSourceEnabled'));
add('module:templateCvFromResumeData', sourceMod.includes('templateCvFromResumeData'));
add('module:ONE_CV_SOURCE_VERSION', sourceMod.includes('cv-source-v1'));

// renderCV must use getFinalCvData / resumeData — not structuredResume
const renderCvBlock = indexHtml.match(/function renderCVInner[\s\S]{0,8000}/)?.[0] || '';
add('product:renderCV-no-structuredResume', !renderCvBlock.includes('structuredResume'), renderCvBlock.includes('structuredResume') ? 'renderCVInner references structuredResume' : '—');
add('product:renderCV-uses-getFinalCvData', renderCvBlock.includes('getFinalCvData'), '—');
add('gates:v1-ats-bypass', fs.readFileSync(path.join(ROOT, 'src/core/validation/review-before-template-lock.js'), 'utf8').includes('isV1AtsBlockersDisabled'));

const pass = checks.filter((c) => c.ok).length;
const total = checks.length;
const status = pass === total ? 'PASS' : 'FAIL';

const md = `# CV Source Cleanup

**Generated:** ${new Date().toISOString()}
**Status:** **${status}** (${pass}/${total} checks)
**Version:** \`ONE_CV_SOURCE_V1\` (\`cv-source-v1\`)

## Goal

All product screens use **one canonical source**:

\`\`\`
import → resumeData → review | templates | export
\`\`\`

Derived **template cvData** is an adapter only (\`resumeDataToCvData\` / \`buildTemplateInputFromResume\`). It is not stored as a parallel truth on the product path.

## Removed / bypassed on product path

| Competing source | Status |
| --- | --- |
| \`finalResumeData\` | Not built when \`HIRELY_ONE_CV_SOURCE=true\`; \`getFinalResumeData()\` aliases \`resumeData\` |
| \`state.cvData\` | Cache only via \`syncDerivedCvDataFromFinal()\` from \`resumeData\` adapter |
| \`structuredResume\` | Pipeline/debug only — not read by review/template/export |
| Parser confidence gates | Skipped in one-source commit (no \`buildFinalResumeData\` semantic gate) |
| ATS / review-before-template blockers | Bypassed via \`HIRELY_V1_NO_ATS_BLOCKERS\` + V1 gates |

## Runtime flag

\`\`\`javascript
HIRELY_ONE_CV_SOURCE = true  // also enabled when HIRELY_V1_SCOPE_LOCK = true
\`\`\`

## Read API (index.html)

| Function | One-source behavior |
| --- | --- |
| \`getResumeData()\` | Returns \`state.resumeData\` |
| \`getFinalResumeData()\` | Alias → \`getResumeData()\` |
| \`isFinalResumeValid()\` | \`resumeDataIsRenderable(resumeData)\` |
| \`mapFinalResumeToCvData()\` | \`resumeDataToCvData(resumeData)\` only |
| \`getFinalSectionCounts()\` | Counts from \`resumeData\` |
| \`commitResumeData()\` | Writes \`resumeData\`; skips \`buildFinalResumeData\` |

## Module map

| File | Role |
| --- | --- |
| \`src/core/resume/resume-data-source.js\` | \`isOneCvSourceEnabled\`, \`templateCvFromResumeData\`, section counts |
| \`src/core/resume-data.js\` | Normalize + \`resumeDataToCvData\` adapter |
| \`index.html\` | \`oneCvSourceActive()\`, unified getters, commit path |

## Adapters kept (derived only)

- \`resumeDataToCvData(resumeData)\` — template / PDF export flat shape
- \`buildTemplateInputFromResume(resumeData)\` — optional richer template input
- \`normalizeCvDataForTemplate(cv)\` — strips parser leak keys

## Static checks

| Check | Status | Detail |
| --- | --- | --- |
${checks.map((c) => `| ${c.id} | ${c.ok ? 'PASS' : 'FAIL'} | ${c.detail || '—'} |`).join('\n')}

## Verification

\`\`\`bash
npm run cv-source-cleanup-report
npm run v1-release-test
\`\`\`

## Debug-only (allowed)

\`structuredResume\`, \`confidenceReport\`, and \`finalResumeData\` may still appear in DEBUG panels or legacy tests. Product UI must not branch on them when \`oneCvSourceActive()\` is true.

## Pipeline note

Import still produces \`structuredResume\` internally during extraction; it is folded into \`resumeData\` at commit. UI never reads \`structuredResume\` for review, templates, or export in one-source mode.
`;

fs.writeFileSync(OUT, md, 'utf8');
console.log(`Wrote ${OUT} — ${status} (${pass}/${total})`);
process.exit(status === 'PASS' ? 0 : 1);
