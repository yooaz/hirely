# HIRELY STRESS REPORT

Generated: 2026-06-06T20:24:47.955Z
Pipeline: production import (`runHirelyImportFromText` / `runHirelyImportFromFile`)
Fixtures run: **12** (0 skipped optional)

## Production goal

**95% successful imports** — import completes with usable structured output (PASS or PARTIAL).

### Goal status: **MET** (100% success)

## Summary

| Verdict | Count |
|---------|------:|
| PASS | 9 |
| PARTIAL | 3 |
| FAIL | 0 |
| SKIP | 0 |

**Import success rate:** 12/12 = **100%** (PASS + PARTIAL, excluding SKIP)

## By archetype / format

| ID | Archetype | Format | Verdict | Import | Name | Email | Phone | Exp | Edu | Skills | Lang |
|----|-----------|--------|---------|--------|------|-------|-------|----:|----:|-------:|-----:|
| creative-cv | designer | TXT | **PASS** | ✓ | ✓ | ✓ | ✓ | 3 | 2 | 7 | 2 |
| yoaz-cv | designer | TXT | **PASS** | ✓ | ✓ | ✓ | ✓ | 11 | 2 | 14 | 2 |
| developer-cv | developer | TXT | **PASS** | ✓ | ✓ | ✓ | ✓ | 1 | 0 | 0 | 1 |
| marketing-cv | marketing | TXT | **PARTIAL** | ✓ | ✓ | ✓ | — | 2 | 0 | 0 | 4 |
| recruiter-cv | recruiter | TXT | **PASS** | ✓ | ✓ | ✓ | ✓ | 2 | 0 | 1 | 3 |
| consultant-cv | consultant | TXT | **PASS** | ✓ | ✓ | ✓ | ✓ | 2 | 1 | 0 | 3 |
| text-pdf | product | PDF-native | **PASS** | ✓ | ✓ | ✓ | ✓ | 2 | 1 | 0 | 0 |
| scanned-pdf | product | PDF-scanned | **PARTIAL** | ✓ | ✓ | ✓ | — | 1 | 0 | 0 | 0 |
| docx | product | DOCX | **PASS** | ✓ | ✓ | ✓ | ✓ | 2 | 1 | 0 | 0 |
| two-column-cv | layout | PDF-native | **PASS** | ✓ | ✓ | ✓ | ✓ | 1 | 1 | 0 | 0 |
| mvp-sample | designer | TXT | **PASS** | ✓ | ✓ | ✓ | ✓ | 1 | 1 | 2 | 0 |
| yoaz-pdf-live | designer | PDF-native | **PARTIAL** | ✓ | — | ✓ | ✓ | 2 | 2 | 4 | 2 |

## Per-fixture detail

### Designer CV (creative paste) (`creative-cv`)

- **Verdict:** ✓ PASS
- **Archetype:** designer
- **Format:** TXT
- **File:** `creative-cv/fixture.txt`
- **Import status:** `IMPORT_SUCCESS`
- **Name:** Yohann Azancot (detected)
- **Email:** yoaz@hotmail.fr (detected)
- **Phone:** +33649434839 (detected)
- **Experience count:** 3
- **Education count:** 2
- **Skills count:** 7
- **Languages count:** 2

### Designer CV (Yoaz clean paste) (`yoaz-cv`)

- **Verdict:** ✓ PASS
- **Archetype:** designer
- **Format:** TXT
- **File:** `yoaz-cv/fixture.txt`
- **Import status:** `IMPORT_SUCCESS`
- **Name:** Yohann Azancot (detected)
- **Email:** yoaz@hotmail.fr (detected)
- **Phone:** +33649434839 (detected)
- **Experience count:** 11
- **Education count:** 2
- **Skills count:** 14
- **Languages count:** 2

### Developer CV (`developer-cv`)

- **Verdict:** ✓ PASS
- **Archetype:** developer
- **Format:** TXT
- **File:** `developer-cv/fixture.txt`
- **Import status:** `IMPORT_SUCCESS`
- **Name:** Alex Chen (detected)
- **Email:** alex.chen@email.com (detected)
- **Phone:** +1 415 555 0192 (detected)
- **Experience count:** 1
- **Education count:** 0
- **Skills count:** 0
- **Languages count:** 1

### Marketing CV (`marketing-cv`)

- **Verdict:** ◐ PARTIAL
- **Archetype:** marketing
- **Format:** TXT
- **File:** `marketing-cv/fixture.txt`
- **Import status:** `IMPORT_SUCCESS`
- **Name:** Laura Bennett (detected)
- **Email:** laura.bennett@agency.com (detected)
- **Phone:** — (missing)
- **Experience count:** 2
- **Education count:** 0
- **Skills count:** 0
- **Languages count:** 4
- **Notes:** 4/7 detection signals

### Recruiter CV (`recruiter-cv`)

- **Verdict:** ✓ PASS
- **Archetype:** recruiter
- **Format:** TXT
- **File:** `recruiter-cv/fixture.txt`
- **Import status:** `IMPORT_SUCCESS`
- **Name:** David Okonkwo (detected)
- **Email:** david.okonkwo@talent.co (detected)
- **Phone:** +1 646 555 0187 (detected)
- **Experience count:** 2
- **Education count:** 0
- **Skills count:** 1
- **Languages count:** 3

### Consultant CV (`consultant-cv`)

- **Verdict:** ✓ PASS
- **Archetype:** consultant
- **Format:** TXT
- **File:** `consultant-cv/fixture.txt`
- **Import status:** `IMPORT_SUCCESS`
- **Name:** Sophie Martin (detected)
- **Email:** sophie.martin@consult.fr (detected)
- **Phone:** +33611223344 (detected)
- **Experience count:** 2
- **Education count:** 1
- **Skills count:** 0
- **Languages count:** 3

### Native PDF (selectable text) (`text-pdf`)

- **Verdict:** ✓ PASS
- **Archetype:** product
- **Format:** PDF-native
- **File:** `text-pdf/fixture.txt`
- **Import status:** `IMPORT_SUCCESS`
- **Name:** Marie Dupont (detected)
- **Email:** marie.dupont@email.com (detected)
- **Phone:** +33612345678 (detected)
- **Experience count:** 2
- **Education count:** 1
- **Skills count:** 0
- **Languages count:** 0

### Scanned PDF (OCR text) (`scanned-pdf`)

- **Verdict:** ◐ PARTIAL
- **Archetype:** product
- **Format:** PDF-scanned
- **File:** `scanned-pdf/fixture.txt`
- **Import status:** `IMPORT_SUCCESS`
- **Name:** Marie Dupont (detected)
- **Email:** marie@email.com (detected)
- **Phone:** — (missing)
- **Experience count:** 1
- **Education count:** 0
- **Skills count:** 0
- **Languages count:** 0
- **Notes:** 3/7 detection signals

### DOCX export (`docx`)

- **Verdict:** ✓ PASS
- **Archetype:** product
- **Format:** DOCX
- **File:** `docx/fixture.txt`
- **Import status:** `IMPORT_SUCCESS`
- **Name:** Marie Dupont (detected)
- **Email:** marie.dupont@email.com (detected)
- **Phone:** +33612345678 (detected)
- **Experience count:** 2
- **Education count:** 1
- **Skills count:** 0
- **Languages count:** 0

### Two-column PDF layout (`two-column-cv`)

- **Verdict:** ✓ PASS
- **Archetype:** layout
- **Format:** PDF-native
- **File:** `two-column-cv/fixture.txt`
- **Import status:** `IMPORT_SUCCESS`
- **Name:** Marie Dupont (detected)
- **Email:** marie.dupont@email.com (detected)
- **Phone:** +33612345678 (detected)
- **Experience count:** 1
- **Education count:** 1
- **Skills count:** 0
- **Languages count:** 0

### Plain TXT (MVP sample) (`mvp-sample`)

- **Verdict:** ✓ PASS
- **Archetype:** designer
- **Format:** TXT
- **File:** `mvp-sample.txt`
- **Import status:** `IMPORT_SUCCESS`
- **Name:** Yohann Azancot (detected)
- **Email:** yoaz@hotmail.fr (detected)
- **Phone:** +33649434839 (detected)
- **Experience count:** 1
- **Education count:** 1
- **Skills count:** 2
- **Languages count:** 0

### Yoaz PDF (live binary) (`yoaz-pdf-live`)

- **Verdict:** ◐ PARTIAL
- **Archetype:** designer
- **Format:** PDF-native
- **File:** `cv2022 yohann azancot copie.pdf (OCR cache fallback)`
- **Import status:** `IMPORT_SUCCESS`
- **Name:** Nom à confirmer (missing)
- **Email:** yoaz@hotmail.fr (detected)
- **Phone:** +33649434839 (detected)
- **Experience count:** 2
- **Education count:** 2
- **Skills count:** 4
- **Languages count:** 2
- **Notes:** 6/7 detection signals; name missing or uncertain

## Coverage matrix

| Requirement | Fixtures |
|-------------|----------|
| Designer CV | creative-cv, yoaz-cv, mvp-sample, yoaz-pdf-live |
| Developer CV | developer-cv |
| Marketing CV | marketing-cv |
| Recruiter CV | recruiter-cv |
| Consultant CV | consultant-cv |
| Scanned PDF | scanned-pdf |
| Native PDF | text-pdf, two-column-cv, yoaz-pdf-live |
| DOCX | docx |
| TXT | all paste fixtures + mvp-sample |

## Run

```bash
npm run stress:hirely
```
