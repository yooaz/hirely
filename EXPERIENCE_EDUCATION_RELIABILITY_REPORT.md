# Experience Education Reliability Report (P0)

**Status:** PASS
**Policy:** `EXPERIENCE_EDUCATION_RELIABILITY_V1`
**Generated:** 2026-06-13T23:48:14.823Z

## Goal

Stop fake experience generation. Wrong rows forbidden; low confidence → reviewQueue, not preview.

## Acceptance

| Criterion | Status |
| --- | --- |
| No fake "Designer — Internship — 2010-Present" | **PASS** |
| No "Profil!" in preview | **PASS** |
| No "{Internship}" rows | **PASS** |
| No random company promoted to job | **PASS** |
| Real jobs + education kept | **PASS** |

## Experience rules

| Requirement | Enforcement |
| --- | --- |
| Role OR activity | `experienceHasRoleOrActivity` |
| Company / project OR context | `experienceHasCompanyOrContext` |
| Explicit date OR current marker in source | `experienceHasExplicitDateOrCurrent` |
| No invented Present | `experienceHasGuessedPresent` + source grounding |
| No duplicated date ranges | `experienceDateDedupeKey` |
| No section/profile lines as jobs | `auditFakeExperience` + `PROFILE_SUMMARY_AS_JOB_RE` |
| No company-only rows | `company_only_row` + `invented-experience-guard` |

## Education rules

| Requirement | Enforcement |
| --- | --- |
| School or degree signal | `validatesEducationLine` |
| Date optional | `scoreEducationConfidence` year match |
| Low confidence → reviewQueue | `enforceEducationReliability` strips from preview |

## QA suites

| Suite | Result |
| --- | --- |
| `qa-experience-education-reliability` | PASS |
| `qa-no-fake-data-policy` | PASS |
| `stop-fake-cv-report` | PASS |

## Unit checks

| Check | Status |
| --- | --- |
| version | PASS |
| fake_internship_present | PASS |
| fake_profil | PASS |
| fake_brace_internship | PASS |
| fake_company_only | PASS |
| valid_freelance | PASS |
| parse_internship_no_guessed_present | PASS |
| parse_internship_requires_real_company | PASS |
| reject_duplicate_dates | PASS |
| education_requires_school_or_degree | PASS |
| education_accepts_school | PASS |
| explicit_date_requires_source | PASS |
| pipeline_no_profil_job | PASS |
| pipeline_no_client_only_job | PASS |
| pipeline_keeps_real_job | PASS |
| pipeline_keeps_education | PASS |
| render_no_fake_internship | PASS |
| render_no_profil_experience | PASS |

## Implementation

| Module | Role |
| --- | --- |
| `experience-education-reliability.js` | Contract audit + enforce + review emission |
| `fake-experience-gate.js` | Section labels, guessed Present, generic roles |
| `invented-experience-guard.js` | Client-only / invented bullet rows |
| `classification-fixes.js` | `parseInternshipLine` — no guessed dates |
| `final-resume-contract.js` | Dual gate before preview commit |

## Verify

```bash
npm run qa:experience-education-reliability
npm run experience-education-reliability-report
npm run stop-fake-cv-report
```
