# REAL_USER_CV_QA_REPORT

**Status:** PASS
**Generated:** 2026-06-10T21:34:01.216Z
**Source:** Browser import (real uploaded PDFs, not text fixtures)

## Acceptance

| Rule | Requirement |
|------|-------------|
| Parser labels | No section/parser labels exposed as CV content |
| Placeholders | No uncertain / placeholder copy in final CV |
| Fake experience | No invented or client-only experience rows |
| Duplicates | No duplicate lines in data or preview |
| Preview | Live CV preview with meaningful content |

## Yoaz CV (`yoaz-cv`)

**File:** `/Users/yohannazancot/Documents/cv/cv2022 yohann azancot copie.pdf`
**Import:** IMPORT_PARTIAL (direct)
**Result:** PASS

### Extracted metrics

| Field | Value |
|-------|-------|
| Raw text length | 1177 |
| Final name | Yohann Azancot |
| Final title | Graphic Designer & Illustrator |
| Email | yoaz@hotmail.fr |
| Phone | +33649434839 |
| Experiences | 2 |
| Education | 2 |
| Clients | 7 |
| Projects | 0 |
| Skills | 6 |
| Tools | 2 |
| Languages | 2 |
| Review queue | 3 |
| Preview text length | 554 |

### Leakage audit

| Check | Count | Pass |
|-------|-------|------|
| Placeholder leakage | 0 | ✓ |
| Label leakage | 0 | ✓ |
| Duplicate leakage | 0 | ✓ |
| Fake experience | 0 | ✓ |
| Meaningful preview | — | ✓ |

## Second uploaded CV (`second-uploaded-cv`)

**File:** `/Users/yohannazancot/Documents/yohann azancot cv 2024.pdf`
**Import:** IMPORT_NEEDS_PASTE (browser-acceptance-cache-fresh-paste)
**Result:** PASS

### Extracted metrics

| Field | Value |
|-------|-------|
| Raw text length | 1151 |
| Final name | Yohann Azancot |
| Final title | GRAPHIC DESIGNER & ILLUSTRATOR |
| Email | — |
| Phone | — |
| Experiences | 3 |
| Education | 2 |
| Clients | 9 |
| Projects | 0 |
| Skills | 6 |
| Tools | 5 |
| Languages | 0 |
| Review queue | 8 |
| Preview text length | 658 |

### Leakage audit

| Check | Count | Pass |
|-------|-------|------|
| Placeholder leakage | 0 | ✓ |
| Label leakage | 0 | ✓ |
| Duplicate leakage | 0 | ✓ |
| Fake experience | 0 | ✓ |
| Meaningful preview | — | ✓ |

## Verify

```bash
node src/tests/qa-real-user-cv.mjs
node scripts/real-user-cv-qa-report.mjs
```
