# Dedupe Final Resume Report

**Generated:** 2026-06-08T16:53:57.263Z
**Engine:** DEDUPE_FINAL_RESUME_V1
**Result:** PASS

## Scope

Last-pass dedupe on **finalResumeData** only (after contract lock).

## Normalize rules

- Lowercase
- Remove punctuation
- Collapse extra spaces
- Accent-fold
- Normalize date separators (`–`, `—`, `/` → `to`)

## Acceptance

| Check | Result |
|-------|--------|
| Créapole ×2 | 1 (expected 1) |
| Creative School Management ×2 | 1 (expected 1) |
| Freelance / Independent ×2 | 1 (expected 1) |
| Skills case dupes | 8 (expected 1) |
| Tools case dupes | 3 (expected 1) |
| Languages case dupes | 1 (expected 1) |
| CV renders | yes |

## Pipeline hook

- `src/core/validation/dedupe-final-resume.js` — `dedupeFinalResumeData()`
- `src/core/validation/final-resume-contract.js` — `buildFinalResumeData()` final pass

## QA

```bash
npm run qa:dedupe-final-resume
npm run dedupe-final-resume-report
```

