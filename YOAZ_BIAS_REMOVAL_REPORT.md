# Yoaz Bias Removal Report (P0)

**Verdict:** PASS

**Engine:** `YOAZ_BIAS_GUARD_V1`

**Generated:** 2026-06-12T18:32:46.926Z

## Mission

Remove Yoaz-specific production bias so Hirely generalizes to any CV.

Forbidden in production code (allowed only in fixtures/tests/samples):

- Yoaz / Yohann / Azancot / yoaz@
- LISAA / Créapole / McCann / Nike / Marvel / Pantone / Adobe / Converse / 38 Impressions as **hardcoded fallbacks**
- Dictionary entries remain valid — they must not inject when extraction is uncertain

## Uncertain extraction labels

| Field | Label |
|-------|-------|
| Name | **Nom à confirmer** |
| Email | **Email à confirmer** |
| Phone | **Téléphone à confirmer** |

Never invent identity or contact data.

## Production code scan

| Literal | Files |
|---------|-------|
| — | No forbidden literals in `src/core`, `src/ui`, `index.html` |

## QA checks

| Check | Result | Detail |
|-------|--------|--------|
| guard_version | PASS | — |
| name_confirm_label | PASS | — |
| email_confirm_label | PASS | — |
| phone_confirm_label | PASS | — |
| guard_strips_yoaz_without_source | PASS | — |
| guard_keeps_yoaz_when_in_source | PASS | — |
| production_code_clean | PASS | [] |
| generic_cv_no_yoaz_leak | PASS | {"identity":{"name":"Sophie Martin","email":"sophie.martin@example.com","phone":"Téléphone à confirmer"},"summary":"","experiences":[{"role":"Product Manager","company":"SaaS Co","location":"","startD |
| generic_cv_confirm_labels_when_missing | PASS | — |
| corpus_no_yoaz_leak | PASS | 5/5 |

## Generalization corpus (no Yoaz leak)

| Corpus ID | Result | Notes |
|-----------|--------|-------|
| developer | PASS | clean |
| designer | PASS | clean |
| consultant | PASS | clean |
| executive | PASS | clean |
| marketing | PASS | clean |

## Changes

- `src/core/validation/yoaz-bias-guard.js` — strips Yoaz demo markers unless present in source text
- `src/core/display/undetected-label.js` — field-specific confirm labels
- `src/core/parsing/parser-recovery.js` — `NAME_UNCERTAIN_LABEL` → Nom à confirmer
- `src/core/parsing/ocr-classification-rules.js` — blocks yoaz/yohann email local-part name hints
- `src/core/validation/sanitize-resume-display.js` — Yoaz bias guard at final sanitize
- `src/core/validation/final-resume-contract.js` — confirm labels on `finalResumeData` identity
- `src/ui/templates/cv-templates.js` — template placeholders for name/email/phone

## Run

```bash
npm run qa:yoaz-bias-removal
npm run yoaz-bias-removal-report
```

## Bench output

```
PASS guard_version
PASS name_confirm_label
PASS email_confirm_label
PASS phone_confirm_label
PASS guard_strips_yoaz_without_source
PASS guard_keeps_yoaz_when_in_source
PASS production_code_clean
NODE_RESUMEDATA_COUNTS {
  path: 'buildResumeData:importResult',
  experiences: 2,
  education: 1,
  skills: 0,
  tools: 0,
  languages: 0,
  clients: 0,
  projects: 0,
  unsorted: 0
}
PASS generic_cv_no_yoaz_leak
PASS generic_cv_confirm_labels_when_missing
NODE_RESUMEDATA_COUNTS {
  path: 'buildResumeData:importResult',
  experiences: 1,
  education: 1,
  skills: 5,
  tools: 0,
  languages: 2,
  clients: 0,
  projects: 0,
  unsorted: 0
}
NODE_RESUMEDATA_COUNTS {
  path: 'buildResumeData:importResult',
  experiences: 4,
  education: 1,
  skills: 6,
  tools: 0,
  languages: 2,
  clients: 1,
  projects: 2,
  unsorted: 1
}
NODE_RESUMEDATA_COUNTS {
  path: 'buildResumeData:importResult',
  experiences: 7,
  education: 2,
  skills: 0,
  tools: 0,
  languages: 3,
  clients: 0,
  projects: 0,
  unsorted: 0
}
NODE_RESUMEDATA_COUNTS {
  path: 'buildResumeData:importResult',
  experiences: 6,
  education: 1,
  skills: 0,
  tools: 0,
  languages: 1,
  clients: 0,
  projects: 0,
  unsorted: 0
}
NODE_RESUMEDATA_COUNTS {
  path: 'buildResumeData:importResult',
  experiences: 3,
  education: 2,
  skills: 4,
  tools: 0,
  languages: 2,
  clients: 3,
  projects: 1,
  unsorted: 0
}
PASS corpus_no_yoaz_leak

═══ Yoaz Bias Removal: PASS (10/10) ═══
(node:11950) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/src/core/validation/yoaz-bias-guard.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
```
