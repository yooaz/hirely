# BOOT_FAILURE_ROOT_CAUSE

Generated: 2026-06-12T19:53:35.062Z

## Summary

**Root cause:** Degraded boot: optional features unavailable (identity_extraction, ocr_pipeline)

## Why users saw `core_modules_incomplete`

The legacy `reportHirelyCoreStatus()` treated the core bundle as **all-or-nothing**:

- Required `runHirelyImportFromText`, `canonicalImportFromFile`, and `resumeDataMeetsImportMinimum` simultaneously
- Any missing optional export → `loaded: false` → banner `Le moteur Hirely n'a pas chargé (core_modules_incomplete)`
- Entire import UI blocked even when paste import could work

## Fix applied

| Change | File |
|--------|------|
| Tiered boot contract (required vs optional) | `src/core/boot/boot-contract.mjs` |
| Boot loader with trace + minimal fallback | `src/core/boot/core-boot-loader.mjs` |
| Emergency import-only core | `src/core/boot/minimal-import-core.mjs` |
| Browser uses loader; per-feature warnings | `index.html` |

## Failure modes

### Fatal (blocks import)

- `import_core` missing: no `runHirelyImportFromText` or `resumeDataMeetsImportMinimum`
- Full barrel and minimal fallback both fail to load

### Degraded (import works, feature warnings)

- Optional module missing → `Feature unavailable: <name> failed`
- Examples: identity extraction, OCR, review queue, section engine

## Dynamic import failures (Node audit)

_None detected in Node audit._

## Init throws

_None._

## Circular imports detected

- src/core/pipeline/hirely-import.js → src/core/parsing/parser-recovery.js → src/core/parsing/experience-parser.js → src/core/parsing/parser-recovery.js
- src/core/pipeline/hirely-import.js → src/core/resume-data.js → src/core/parsing/suggestion-auto-accept.js → src/core/resume-data.js
- src/core/pipeline/hirely-import.js → src/core/pipeline/production-pipeline.js → src/core/parsing/block-classifier.js → src/core/parsing/section-validation.js → src/core/parsing/block-classifier.js
- src/core/pipeline/hirely-import.js → src/core/parsing/rich-parser.js → src/core/parsing/strict-language-extraction.js → src/core/validation/ocr-micro-garbage-cleanup.js → src/core/parsing/strict-language-extraction.js
- src/core/pipeline/hirely-import.js → src/core/parsing/rich-parser.js → src/core/parsing/experience-reconstruction-engine.js → src/core/parsing/experience-split-parser.js → src/core/parsing/rich-parser.js
- src/core/pipeline/hirely-import.js → src/core/parsing/rich-parser.js → src/core/parsing/experience-reconstruction-engine.js → src/core/parsing/experience-segmentation-engine.js → src/core/parsing/rich-parser.js
- src/core/pipeline/hirely-import.js → src/core/resume-data.js → src/core/parsing/resume-output-quality.js → src/core/parsing/client-detection-engine.js → src/core/parsing/resume-output-quality.js
- src/core/import/canonical-import.js → src/core/resume-data.js → src/core/parsing/suggestion-auto-accept.js → src/core/resume-data.js
- src/core/import/canonical-import.js → src/core/pipeline/hirely-import.js → src/core/parsing/parser-recovery.js → src/core/parsing/experience-parser.js → src/core/parsing/parser-recovery.js
- src/core/import/canonical-import.js → src/core/pipeline/pipeline-contract.js → src/core/parsing/experience-rebuilder.js → src/core/parsing/ocr-experience-merge.js → src/core/parsing/experience-rebuilder.js
- src/core/import/canonical-import.js → src/core/resume-data.js → src/core/parsing/resume-output-quality.js → src/core/parsing/client-detection-engine.js → src/core/parsing/resume-output-quality.js

## Grep: `CORE_BOOT_FAILED` (43 hits)

- `index.html:2258` showHirelyCoreLoadError('CORE_BOOT_FAILED');
- `index.html:4042` console.error('CORE_BOOT_FAILED',msg);
- `index.html:4155` if(!status.loaded){lastErr=new Error('CORE_BOOT_FAILED');lastDiag=result;continue}
- `index.html:5110` showHirelyCoreLoadError('CORE_BOOT_FAILED');
- `index.html:5116` showHirelyCoreLoadError('CORE_BOOT_FAILED');
- `index.html:5125` console.error('CORE_BOOT_FAILED',err);
- `index.html:7754` importFile:async(f,o)=>{const c=await getHirelyCore();if(!c?.canonicalImportFromFile)return{file:f?{
- `scripts/audit-core-engine-boot.mjs:18` grep: { CORE_BOOT_FAILED: [], core_modules_incomplete: [] },
- `scripts/audit-core-engine-boot.mjs:138` CORE_BOOT_FAILED: 'CORE_BOOT_FAILED',
- `scripts/audit-core-engine-boot.mjs:227` console.log('grep CORE_BOOT_FAILED:', audit.grep.CORE_BOOT_FAILED.length);
- `scripts/audit-core-engine-boot.mjs:232` console.error('CORE_BOOT_FAILED audit');
- `scripts/beta-readiness-report.mjs:53` coreBootFailed: /CORE_BOOT_FAILED|Duplicate export of/i.test(output),
- `scripts/beta-readiness-report.mjs:100` if (signals.coreBootFailed) blockers.push('CORE_BOOT_FAILED');
- `scripts/beta-readiness-report.mjs:149` lines.push(`| CORE_BOOT_FAILED | ${allSignals.coreBootFailed ? 'FAIL' : 'PASS'} |`);
- `scripts/core-boot-export-fix-report.mjs:66` ['CORE_BOOT_FAILED', /CORE_BOOT_FAILED/i.test(bootOut) && boot.status !== 0],

## Grep: `core_modules_incomplete` (12 hits)

- `index.html:4094` showHirelyCoreLoadError(diag?.rootError||'core_modules_incomplete',diag);
- `index.html:4107` const missing=(diag?.assessment?.missingRequired||[]).join(',')||'core_modules_incomplete';
- `scripts/audit-core-engine-boot.mjs:18` grep: { CORE_BOOT_FAILED: [], core_modules_incomplete: [] },
- `scripts/audit-core-engine-boot.mjs:139` core_modules_incomplete: 'core_modules_incomplete',
- `scripts/audit-core-engine-boot.mjs:203` 'Historical all-or-nothing gate: reportHirelyCoreStatus required canonicalImportFromFile + all expor
- `scripts/audit-core-engine-boot.mjs:214` 'Never show core_modules_incomplete when paste import is available.',
- `scripts/audit-core-engine-boot.mjs:228` console.log('grep core_modules_incomplete:', audit.grep.core_modules_incomplete.length);
- `scripts/generate-core-engine-recovery-reports.mjs:104` ## Why users saw \`core_modules_incomplete\`
- `scripts/generate-core-engine-recovery-reports.mjs:109` - Any missing optional export → \`loaded: false\` → banner \`Le moteur Hirely n'a pas chargé (core_m
- `scripts/generate-core-engine-recovery-reports.mjs:152` ## Grep: \`core_modules_incomplete\` (${audit.grep?.core_modules_incomplete?.length || 0} hits)
- `scripts/generate-core-engine-recovery-reports.mjs:154` ${(audit.grep?.core_modules_incomplete || [])
- `src/core/boot/core-boot-loader.mjs:47` : 'core_modules_incomplete'
