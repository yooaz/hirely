# Production Reality Audit (H17)

**Verdict:** FAIL — production path diverges from QA

## Mission

Audit the **real browser path** only:

```
User uploads PDF → OCR → extraction → classification → review → preview → export
```

Not fixture runners, not mock pipelines, not benchmark harnesses.

## PDF attempts (real upload via handleFileImport)

| PDF | Result | Outcome | Raw chars | Preview chars | First preview line |
|-----|--------|---------|----------:|--------------:|--------------------|
| fixture.pdf | FAIL | IMPORT_NEEDS_PASTE | 0 | 0 |  |
| yoaz-upload.pdf | FAIL | IMPORT_NEEDS_PASTE | 0 | 0 |  |
| cv2022 yohann azancot copie.pdf | FAIL | IMPORT_NEEDS_PASTE | 0 | 0 |  |
| yoaz-scanned-pdf.pdf | FAIL | IMPORT_NEEDS_PASTE | 0 | 0 |  |

**Best attempt:** `/Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/tests/output/final-browser-qa/yoaz-scanned-pdf.pdf`

## Trace artifact

| File | Status |
|------|--------|
| `IMPORT_TRACE.json` | missing or empty raw text |
| Screenshot | `tests/output/h17-production-reality/production-preview.png` |

### Trace sections

| Section | Purpose |
|---------|---------|
| RAW_TEXT_CAPTURE | OCR + extraction output |
| IDENTITY_CANDIDATES | Name/title candidates |
| EXPERIENCE_CANDIDATES | Experience detections |
| EDUCATION_CANDIDATES | Education detections |
| SKILL_CANDIDATES | Skills/tools detections |
| FINAL_RESUME_DATA | Committed structured CV |
| REVIEW_QUEUE | Manual review items |
| FINAL_PREVIEW | Rendered A4 preview fields |

## Preview identity (production)

| Field | Value |
|-------|-------|
| Name |  |
| Title |  |
| Email |  |
| Phone |  |

## Information loss

| Stage | Field | Detail |
|-------|-------|--------|
| upload → OCR/extraction | raw_text | IMPORT_NEEDS_PASTE |
| review gate | pending_review | 5 review item(s), 0 unsorted line(s) |

## Traceability acceptance

Every preview field must trace to **RAW_TEXT** or **USER_ACTION** — no invented values.

| Metric | Value |
|--------|-------|
| Traceability pass | no |
| Traced fields | 0 |
| Untraceable / generated | 5 |

### Traced fields

| Path | Value | Source |
|------|-------|--------|
| — | — | — |

### Violations

| Path | Value | Reason | Source |
|------|-------|--------|--------|
| reviewQueue.summary | Product manager with 8 years in B2B SaaS, focused on roadmap | review_item_not_in_raw_text | GENERATED_OR_PHANTOM |
| reviewQueue.skills | User Research | review_item_not_in_raw_text | GENERATED_OR_PHANTOM |
| reviewQueue.experiences | Product Manager — Acme SaaS — 2019–Present | review_item_not_in_raw_text | GENERATED_OR_PHANTOM |
| reviewQueue.experiences | Product Manager — Beta Corp — 2015–2019 | review_item_not_in_raw_text | GENERATED_OR_PHANTOM |
| reviewQueue.skills | Product Strategy | review_item_not_in_raw_text | GENERATED_OR_PHANTOM |

## Why QA passes but screenshots look wrong

| QA path | Production path | Gap |
|---------|-----------------|-----|
| Fixture text / paste | PDF upload + OCR | OCR timeout or empty raw in headless browser |
| Direct pipeline calls | handleFileImport UI | Different failure handling & paste fallback |
| Bench ground truth | User-visible preview | Name/title not validated against RAW_TEXT |

This audit captures **IMPORT_TRACE.json** so every preview field can be checked against **RAW_TEXT_CAPTURE** and **REVIEW_QUEUE**.

## Re-run

```bash
npm run qa:h17-production-reality-audit
HIRELY_PRODUCTION_PDF=/path/to/cv.pdf npm run production-reality-audit
```
