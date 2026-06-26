# FINAL BROWSER QA REPORT

**Verdict:** FAIL
**Date:** 2026-06-07T15:15:46.472Z
**Pass count:** 1/5

## Global gates

| Gate | Result |
|------|--------|
| 4/5 CVs pass | FAIL (1/5) |
| No fatal console error | PASS (0) |
| No render loop | PASS (SANITIZED_COUNTS=0) |
| Upload always clickable | PASS |
| Core boot OK | PASS |

## Per-CV results

| CV | Result | Blockers |
|----|--------|----------|
| Yoaz scanned PDF | PASS | — |
| Clean text CV | FAIL | skills_tools_langs_clean — skills=4 tools=Adobe Illustrator,Photoshop langs= |
| Developer CV | FAIL | skills_tools_langs_clean — skills=0 tools= langs=English — fluent |
| Marketing CV | FAIL | skills_tools_langs_clean — skills=0 tools= langs=English — fluent,French — fluent |
| Recruiter CV | FAIL | skills_tools_langs_clean — skills=0 tools= langs=English — fluent |

## Check details

### Yoaz scanned PDF

- ✓ **core_boot** — ok
- ✓ **upload_clickable_before** — {"ok":true,"busy":false,"pointerEvents":"auto","hidden":false}
- ✓ **import_works** — live
- ✓ **cv_visible** — cv--live
- ✓ **name_extracted** — Yohann Azancot
- ✓ **email_extracted** — yoaz@hotmail.fr
- ✓ **phone_extracted** — +33649434839
- ✓ **experience_visible** — count=1
- ✓ **education_clean** — LISAA — Web & Motion Design — 2011–2012 | Créapole — Web & Motion Design — 2011–2012
- ✓ **skills_tools_langs_clean** — skills=4 tools=Adobe Illustrator,InDesign langs=French — native,English — fluent
- ✓ **suggestions_lte_2** — count=2 [independent freelance | videogame]
- ✓ **recruiter_score_updates** — score=82
- ✓ **pdf_export** — 48802 bytes pages=2
- ✓ **upload_clickable_after** — {"ok":true,"busy":false,"pointerEvents":"auto","hidden":false}
- ✓ **no_render_loop** — SANITIZED_COUNTS +0

### Clean text CV

- ✓ **core_boot** — ok
- ✓ **upload_clickable_before** — {"ok":true,"busy":false,"pointerEvents":"auto","hidden":false}
- ✓ **import_works** — live
- ✓ **cv_visible** — cv--live
- ✓ **name_extracted** — Yohann Azancot
- ✓ **email_extracted** — yoaz@hotmail.fr
- ✓ **phone_extracted** — +33649434839
- ✓ **experience_visible** — count=1
- ✓ **education_clean** — LISAA — Web & Motion Design
- ✗ **skills_tools_langs_clean** — skills=4 tools=Adobe Illustrator,Photoshop langs=
- ✓ **suggestions_lte_2** — count=1 [independent freelance]
- ✓ **recruiter_score_updates** — score=75
- ✓ **pdf_export** — 24478 bytes pages=2
- ✓ **upload_clickable_after** — {"ok":true,"busy":false,"pointerEvents":"auto","hidden":false}
- ✓ **no_render_loop** — SANITIZED_COUNTS +0

### Developer CV

- ✓ **core_boot** — ok
- ✓ **upload_clickable_before** — {"ok":true,"busy":false,"pointerEvents":"auto","hidden":false}
- ✓ **import_works** — live
- ✓ **cv_visible** — cv--live
- ✓ **name_extracted** — Alex Chen
- ✓ **email_extracted** — alex.chen@email.com
- ✓ **phone_extracted** — +1 415 555 0192
- ✓ **experience_visible** — count=2
- ✓ **education_clean** — MIT — b.s. Computer Science — — 2011–2015
- ✗ **skills_tools_langs_clean** — skills=0 tools= langs=English — fluent
- ✓ **suggestions_lte_2** — count=2 [distributed systems | typescript]
- ✓ **recruiter_score_updates** — score=72
- ✓ **pdf_export** — 26384 bytes pages=2
- ✓ **upload_clickable_after** — {"ok":true,"busy":false,"pointerEvents":"auto","hidden":false}
- ✓ **no_render_loop** — SANITIZED_COUNTS +0

### Marketing CV

- ✓ **core_boot** — ok
- ✓ **upload_clickable_before** — {"ok":true,"busy":false,"pointerEvents":"auto","hidden":false}
- ✓ **import_works** — live
- ✓ **cv_visible** — cv--live
- ✓ **name_extracted** — Laura Bennett
- ✓ **email_extracted** — laura.bennett@agency.com
- ✓ **phone_extracted** — +44 20 7946 0958
- ✓ **experience_visible** — count=2
- ✓ **education_clean** — London School of Economics — Msc Marketing — — 2014–2015 | University of Leeds — ba Communications — — 2011–2014
- ✗ **skills_tools_langs_clean** — skills=0 tools= langs=English — fluent,French — fluent
- ✓ **suggestions_lte_2** — count=1 [growth marketing]
- ✓ **recruiter_score_updates** — score=72
- ✓ **pdf_export** — 35149 bytes pages=2
- ✓ **upload_clickable_after** — {"ok":true,"busy":false,"pointerEvents":"auto","hidden":false}
- ✓ **no_render_loop** — SANITIZED_COUNTS +0

### Recruiter CV

- ✓ **core_boot** — ok
- ✓ **upload_clickable_before** — {"ok":true,"busy":false,"pointerEvents":"auto","hidden":false}
- ✓ **import_works** — live
- ✓ **cv_visible** — cv--live
- ✓ **name_extracted** — David Okonkwo
- ✓ **email_extracted** — david.okonkwo@talent.co
- ✓ **phone_extracted** — +1 646 555 0187
- ✓ **experience_visible** — count=2
- ✓ **education_clean** — NYU — b.a. Human Resources — — 2011–2015
- ✗ **skills_tools_langs_clean** — skills=0 tools= langs=English — fluent
- ✓ **suggestions_lte_2** — count=2 [full-cycle recruiting | ats management]
- ✓ **recruiter_score_updates** — score=72
- ✓ **pdf_export** — 25082 bytes pages=2
- ✓ **upload_clickable_after** — {"ok":true,"busy":false,"pointerEvents":"auto","hidden":false}
- ✓ **no_render_loop** — SANITIZED_COUNTS +0

## Remaining blockers

- Only 1/5 CVs passed (need 4)
- Clean text CV: skills_tools_langs_clean — skills=4 tools=Adobe Illustrator,Photoshop langs=
- Developer CV: skills_tools_langs_clean — skills=0 tools= langs=English — fluent
- Marketing CV: skills_tools_langs_clean — skills=0 tools= langs=English — fluent,French — fluent
- Recruiter CV: skills_tools_langs_clean — skills=0 tools= langs=English — fluent

Screenshots: `tests/output/final-browser-qa/`
