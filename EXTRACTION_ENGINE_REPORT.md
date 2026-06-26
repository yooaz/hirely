# Extraction Engine Report (P0 recruiter-grade)

**Status:** PASS
**Generated:** 2026-06-15T23:01:18.664Z

## cvData v2 contract

Every field exposes `{ value, confidence }` (0–100). List fields use arrays of `{ value, confidence }`.
Unknown / unclassified lines are preserved in `additionalSections[]` — **never lost**.

### Detected entities

| Field | Type |
|-------|------|
| Name | scalar + confidence |
| Title | scalar + confidence |
| Email | scalar + confidence |
| Phone | scalar + confidence |
| Location | scalar + confidence |
| Summary | scalar + confidence |
| Experience | list of `{ value: { role, company, dates, bullets }, confidence }` |
| Education | list + confidence |
| Skills | list + confidence |
| Languages | list + confidence |
| Certifications | list + confidence |
| Links | list of `{ value: { type, url, label }, confidence }` |
| Additional sections | `{ title, confidence, lines[] }` for orphan content |

## Pipeline

```
Raw text → OCR normalize (if needed)
    → section detection
    → identity lock (name/title)
    → contact extract (email/phone/links/location)
    → entity parse (experience/education/skills/…)
    → confidence scoring (per field)
    → additionalSections (no data loss)
    → cvData v2 + legacy cvData
```

Review threshold: **70%** confidence

## Fixture results

| Fixture | Pass | Fields | Overall conf | Additional sections |
|---------|------|--------|--------------|---------------------|
| lab_txt | PASS | 10/12 | 74% | 1 |
| lab_docx_text | PASS | 10/12 | 75% | 1 |
| mvp_sample | PASS | 9/12 | 74% | 1 |
| creative_cv | PASS | 10/12 | 73% | 1 |
| developer_cv | PASS | 10/12 | 74% | 1 |
| recruiter_cv | PASS | 10/12 | 79% | 1 |

## Field detection matrix

| Fixture | name | title | email | phone | location | summary | experience | education | skills | languages | certifications | links |
|---------|---|---|---|---|---|---|---|---|---|---|---|---|
| lab_txt | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | · | · | ✓ |
| lab_docx_text | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | · | · | ✓ |
| mvp_sample | ✓ | ✓ | ✓ | ✓ | · | ✓ | ✓ | ✓ | ✓ | · | · | ✓ |
| creative_cv | ✓ | ✓ | ✓ | ✓ | · | ✓ | ✓ | ✓ | ✓ | ✓ | · | ✓ |
| developer_cv | ✓ | ✓ | ✓ | ✓ | · | ✓ | ✓ | ✓ | ✓ | ✓ | · | ✓ |
| recruiter_cv | ✓ | ✓ | ✓ | ✓ | · | ✓ | ✓ | ✓ | ✓ | ✓ | · | ✓ |

## Failure modes (never silent)

| Case | Behavior |
|------|----------|
| Empty document | additionalSections with empty marker, confidence 0 |
| Low-confidence field | value kept with low confidence (< 70 → review) |
| Unclassified lines | routed to additionalSections |
| OCR garble | postProcessOcrText + reduced confidence |
| Parser unavailable | recruiter pipeline still produces cvData v2 |

## Commands

```bash
npm run extraction-engine-report
npm run qa:extraction-engine-v2
```

JSON: `tests/output/extraction-engine-report/report.json`
