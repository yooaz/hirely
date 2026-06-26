# Phone OCR / Image Fix Report (P0)

**Generated:** 2026-06-13T23:07:19.310Z
**Acceptance:** phone accuracy **≥ 95%**
**Suite:** 50 real-world CVs (HIRELY_REAL_WORLD_STRESS_P0)

## Result

| Metric | Before fix | After fix | Goal | Status |
| --- | --- | --- | --- | --- |
| **Phone accuracy** | 88% | **100%** | ≥ 95% | **PASS** |
| OCR/image formats (PDF-text/scan/PNG/JPG) | — | **100%** | ≥ 95% | **PASS** |
| Student role (all formats) | — | **100%** | ≥ 95% | **PASS** |
| Engineer role (Nigeria +234) | — | **100%** | ≥ 95% | **PASS** |
| OCR/image cases passing | — | 30/30 | — | — |
| Overall extraction | — | 95% | — | — |

Stress QA gate (phone ≥ 95%): **PASS**

## Root cause (pre-fix)

1. **Missing international patterns** — `STRICT_PHONE_PATTERNS` had UK landline grouping (`+44 XX XXXX XXXX`) but not UK mobile (`+44 7xxx xxxxxx`) or Nigeria (`+234`).
2. **Contact-line false pollution** — email · phone · city lines flagged trailing city as junk → confidence dropped below 95%.
3. **No OCR char repair in phone spans** — `O`/`l`/`I`/`S` confusion inside numbers was not recovered before strict match.

## Fix applied

| Module | Change |
| --- | --- |
| `phone-normalize.js` | UK mobile `+44 7…`, flexible `+44` 10-digit spacing, Nigeria `+234`; `repairOcrPhoneChars()` (O→0, l/I→1, S→5 in phone spans only); trailing city labels no longer treated as pollution; OCR repair scoring −1 (keeps ≥95 when digits recover) |
| `classification-fixes.js` | `extractInlinePhone` delegates to shared `extractPhoneCandidate` / `normalizeContactPhone` |
| `resume-data.js` | (unchanged) confidence < 95% → `reviewQueue` via `buildPhoneReviewItem` |

## Rules enforced

- Recover spaced international formats (`+44 7700 900123`, `+234 803 456 7890`)
- OCR char fixes **only inside phone context** — never global prose
- Never merge with years (standalone ranges, trailing `20xx`, page fractions)
- Never merge with postal codes when no strict phone match
- Confidence < **95%** → phone cleared from display + `reviewQueue`

## Unit checks

| Case | Input | Expected | Got | Conf | Status |
| --- | --- | --- | --- | --- | --- |
| uk-mobile-spaced | `+44 7700 900123` | +447700900123 | +447700900123 | 96 | PASS |
| nigeria-spaced | `+234 803 456 7890` | +2348034567890 | +2348034567890 | 96 | PASS |
| contact-line-uk | `emma.johnson@university.edu · +44 7700 900…` | +447700900123 | +447700900123 | 96 | PASS |
| ocr-uk | `+44 77OO 9OO123` | +447700900123 | +447700900123 | 95 | PASS |
| ocr-nigeria | `+234 8O3 456 789O` | +2348034567890 | +2348034567890 | 95 | PASS |
| reject-year-glue | `+33649434839 2011-2020` | (reject) | +33649434839 | 34 | PASS |
| reject-postal-only | `75011 Paris` | (reject) | (empty) | 0 | PASS |

Unit checks: **7/7** pass

## Remaining phone failures (stress suite)

| ID | Role | Format | Expected | Detected |
| --- | --- | --- | --- | --- |
| — | — | — | — | — |

## Previously failing cases (now fixed)

| ID | Role | Format | Expected |
| --- | --- | --- | --- |
| rw-07-engineer-pdftext | engineer | PDF-text | +234 803 456 7890 |
| rw-09-engineer-docx | engineer | DOCX | +234 803 456 7890 |
| rw-21-student-txt | student | TXT | +44 7700 900123 |
| rw-23-student-pdfscan | student | PDF-scan | +44 7700 900123 |
| rw-24-student-docx | student | DOCX | +44 7700 900123 |
| rw-25-student-png | student | PNG | +44 7700 900123 |

## Verification

```bash
npm run phone-ocr-image-report
npm run qa:phone-strict-extraction
npm run qa:real-world-stress
```

## Sample repair

```
+44 7700 900123
→ +447700900123
```
