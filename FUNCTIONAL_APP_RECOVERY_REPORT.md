# Functional App Recovery Report (P0)

**Generated:** 2026-06-13T23:37:05.271Z
**Policy:** Wrong data forbidden · Missing data acceptable · Engine fail → paste fallback · Never render fake preview

## Acceptance summary

| Criterion | Status |
| --- | --- |
| CORE_BOOT_OK | **PASS** |
| IMPORT_UI_READY | **PASS** |
| No Feature unavailable banner on clean boot | **PASS** |
| No fake CV preview | **PASS** |
| Paste fallback works (OCR fail → IMPORT_NEEDS_PASTE) | **PASS** |
| Export disabled when data unsafe | **PASS** |

## Boot assessment

| Field | Value |
| --- | --- |
| Tier | full |
| Import OK | true |
| Degraded | false |
| Unavailable | none |
| Missing optional | none |

## Task coverage

| # | Task | Implementation |
| --- | --- | --- |
| 1 | CORE_BOOT — optional modules cannot break app | Tiered `boot-contract.mjs`; fatal only `import_core`; degraded only when `unavailable.length > 0` |
| 2 | OCR fail → IMPORT_NEEDS_PASTE | `real-cv-import-root.js`, `ocr-parser-gate.js`, `canonical-import.js` |
| 3 | Identity fail — no invented contact | `identity-lock.js`, `yoaz-bias-guard.js`, empty display on low confidence |
| 4 | Block template/export until clean `finalResumeData` | `isWorkspaceReady()`, `isFinalResumeValid()`, `isExportReady()`, `setDocStep` gates |
| 5 | Remove fake experiences/dates/Present | `fake-experience-gate.js` (`FAKE_EXPERIENCE_GATE_V1`), stricter parsers |
| 6 | Remove raw i18n keys | `extractionQuality_emailOk` / `phoneOk` in FR+EN |

## Static UI gates

| Check | Status |
| --- | --- |
| CORE_BOOT_OK marker | PASS |
| IMPORT_UI_READY marker | PASS |
| core-boot-loader tiered gate | PASS |
| paste fallback lock | PASS |
| showImportPasteFallback | PASS |
| ensureImportNeedsPasteVisible | PASS |
| isFinalResumeValid gating | PASS |
| export requires valid contract | PASS |
| downloadPDF blocks unsafe data | PASS |
| setDocStep blocks style/export when invalid | PASS |
| no resumeData fallback in renderCVInner | PASS |
| feature warnings only when unavailable | PASS |
| i18n extractionQuality_emailOk | PASS |
| i18n extractionQuality_phoneOk | PASS |
| boot identity export name | PASS |
| boot ocr export name | PASS |

## Fake data gate

| Case | Expect | Result | Reason | Status |
| --- | --- | --- | --- | --- |
| guessed-present | reject | reject | missing_company | PASS |
| section-label-profil | reject | reject | section_label | PASS |
| real-freelance | keep | keep | — | PASS |

## Identity strictness

| Check | Result |
| --- | --- |
| No review label as name | PASS |
| Low-confidence lock display empty | PASS |
| Placeholder guard | PASS |

## OCR → paste metadata

| Field | Value |
| --- | --- |
| `buildOcrParserBlockedResult.importState` | IMPORT_NEEDS_PASTE |
| `resumeData` after OCR block | null (no fake CV) |
| OCR failure user reason | Le document semble scanné, protégé ou illisible. |
| User lead | Lecture incomplète. Collez le texte du CV pour continuer.… |

## QA scripts

| Script | Result |
| --- | --- |
| `scripts/test-core-boot.mjs` | PASS |
| `src/tests/qa-no-fake-data-policy.mjs` | PASS |
| `src/tests/qa-import-fallback-ux-lock.mjs` | PASS |
| `src/tests/qa-identity-lock.mjs` | PASS |

## Verification

```bash
npm run functional-app-recovery-report
node scripts/test-core-boot.mjs
npm run qa:import-fallback-ux-lock
npm run qa:no-fake-data-policy
npm run stop-fake-cv-report
```

## Recovery principles (locked)

1. **Wrong data is forbidden** — gates reject invented rows, guessed Present, review labels in CV fields.
2. **Missing data is acceptable** — empty name/email/phone beats wrong values.
3. **Engine fail → paste** — `_importFallbackUiLock` hides templates/preview; user pastes text.
4. **Never render fake preview** — `renderCVInner` uses `getFinalCvData()` only when contract valid.
5. **Export last** — `isExportReady()` requires valid contract + no fallback lock + review readiness.
