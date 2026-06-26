# HIRELY P0 — No Placeholder Content in Final CV

**Result:** PASS
**Generated:** 2026-06-10T20:46:12.938Z
**Guard:** FINAL_CV_PLACEHOLDER_GUARD_V1

## Problem

Final CV preview and PDF were rendering uncertain parser placeholders as real content, e.g.:

- `Company à confirmer - 2011-2014`
- `Information non détectée`
- `Nom à confirmer`

## Rules (locked)

If company (or role/date) is unknown:

1. **Do not** render the experience in final CV
2. **Move** it to `reviewQueue` / review panel
3. Show `Entreprise à confirmer` **only** in the review panel
4. **Never** in CV preview or PDF

## Forbidden placeholder strings

- `Information non détectée`
- `Nom à confirmer`
- `Nom à compléter`
- `Poste à compléter`
- `Company à confirmer`
- `Entreprise à confirmer`
- `Role à confirmer`
- `Rôle à confirmer`
- `Date à confirmer`
- `Title to confirm`
- `Name to confirm`

## Fix

1. **`sanitizeFinalCvPlaceholdersBeforeCommit()`** — final gate in `buildFinalResumeData()`
2. Unknown-company experiences → review items with reason `Entreprise à confirmer`
3. **`stripPlaceholderContentFromCvData()`** on template/PDF cvData path
4. Source fix: `experience-reconstruction-engine-v2.js` no longer injects `Company à confirmer`
5. Template defense: block `à confirmer` lines; no identity placeholders on final-resume render

## Fixture audit

| Fixture | finalResumeData hits | cvData hits | template HTML hits | review items |
| --- | --- | --- | --- | --- |
| creative-cv | — | — | ✓ | 5 |
| yoaz-cv | — | — | ✓ | 17 |
| creative-experience-rich | — | — | ✓ | 2 |
| designer-cv-rich | — | — | ✓ | 1 |

## Verification

```bash
npm run qa:no-placeholder-content
npm run test:no-placeholder-content
```

## Files

- `src/core/validation/final-cv-placeholder-guard.js`
- `src/core/validation/final-resume-contract.js`
- `src/core/resume-data.js`
- `src/core/parsing/experience-reconstruction-engine-v2.js`
- `src/ui/templates/cv-templates.js`
- `src/tests/qa-no-placeholder-content.mjs`

