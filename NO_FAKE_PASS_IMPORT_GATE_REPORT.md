# NO_FAKE_PASS_IMPORT_GATE_REPORT

**Gate policy:** `NO_FAKE_PASS_IMPORT_GATE_V2`
**Policy unit tests:** PASS
**Generated:** 2026-06-12T10:12:36.587Z
**Unit checks:** 21/21
**Browser reality QA:** skipped (`HIRELY_SKIP_BROWSER_QA=1`)
**Product PASS (browser):** 7/7 cases

## Problem

QA reports showed **PASS** while users saw broken imports: thin text marked ready, paste fallback counted as success, placeholder CV shells, fake identity fields.

## Principle

| Concept | Meaning |
|---------|---------|
| **Terminal safe** | No crash, no stuck loader |
| **Acceptable outcome** | Honest status incl. `IMPORT_NEEDS_PASTE` |
| **Product PASS** | Real editable CV — all criteria below |

`IMPORT_NEEDS_PASTE` is **acceptable** but **never** a successful import.

## Product PASS requires (all)

| # | Criterion | Code check |
|---|-----------|------------|
| 1 | `selectedTextLength >= 300` | `hasMeaningfulExtractedText()` |
| 2 | Identity **or** experience **or** education | `hasIdentityExperienceOrEducation()` |
| 3 | Preview has meaningful CV content (≥100 chars + structure) | `previewHasMeaningfulContent()` |
| 4 | No fake name | `isAcceptableDisplayName()` |
| 5 | No fake phone | `isAcceptableDisplayPhone()` |
| 6 | No empty CV shell | `isEmptyCv()` |
| 7 | No stuck loader | `evaluateTerminalSafety()` |

## Status matrix

| Status | Terminal safe | Acceptable | Product PASS |
|--------|---------------|------------|--------------|
| `IMPORT_READY` | ✓ | ✓ | Only if all 7 criteria |
| `IMPORT_PARTIAL` | ✓ | ✓ | Only if all 7 criteria |
| `IMPORT_NEEDS_PASTE` | ✓ | ✓ | **Never** |
| `IMPORT_UNSUPPORTED` | ✓ | ✓ | **Never** |
| `IMPORT_FAILED` | ✓ | ✓ | **Never** |
| `IMPORT_STUCK` | ✗ | ✗ | **Never** |

## Forbidden fake passes (fixed)

| Pattern | Gate reason |
|---------|-------------|
| `IMPORT_READY` + 45 chars selected text | `selected_text_under_300` |
| Live preview + `>= 20` chars inferred as READY | removed — needs 300 for READY |
| Scanned PDF paste fallback marked PASS | `paste_fallback_not_success` |
| Company name as identity | `fake_name` |
| Corrupted phone on preview | `fake_phone` |
| Header-only shell, 0 sections | `empty_cv` / `placeholder_only_cv` |

## Implementation

| Artifact | Role |
|----------|------|
| `tests/lib/no-fake-pass-import-policy.mjs` | Canonical `evaluateImportProductPass()` V2 |
| `tests/lib/real-world-import-truth-eval.mjs` | Truth status + thin-text wrong-status guard |
| `src/tests/qa-no-fake-pass-import-gate.mjs` | Policy unit regression (29 checks) |
| `src/tests/qa-import-reality-check.mjs` | Browser smoke — separates acceptable vs product PASS |

## Sample policy outcomes

- **Good import:** pass=true reasons=[]
- **NEEDS_PASTE:** pass=false acceptable=true
- **Fake name:** pass=false reasons=["fake_name"]

## Verification

```bash
npm run qa:no-fake-pass-import-gate
npm run no-fake-pass-import-gate-report
npm run qa:import-reality-check   # browser — optional
```

## Related

- `NO_FAKE_PASS_IMPORT_POLICY.md` — full policy reference
- `REAL_CV_IMPORT_ROOT_FIX_REPORT.md` — extraction 300-char gate
- `NO_FAKE_DATA_POLICY_REPORT.md` — fake identity field rules
