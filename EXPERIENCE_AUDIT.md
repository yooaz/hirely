# EXPERIENCE ENGINE AUDIT — Yoaz PDF

Generated: 2026-06-06T15:23:25.565Z
Source OCR: 42 lines · strict parser: 2 · final resumeData: 2

> Audit only — no fixes applied.

## Summary

| Metric | Count |
|--------|------:|
| Detected (parser + final) | 2 |
| In STRUCTURED_RESUME | 1 |
| In RESUME_DATA (final) | 2 |
| Rejected / not promoted | 3 |

## Detected experiences

| # | Source line | Role | Company | Dates | Confidence | Parser | In structured | In resumeData |
|--:|-------------|------|---------|-------|------------|--------|:-------------:|:-------------:|
| 1 | 30-year old Illustrator and graphic 2011-2022 : Freelancer Illustrator, Graphic … | Freelance Illustrator / Graphic Designer | Independent / Freelance | 2011–2022 | 100 | parseStrictExperiencesFromLines | ✓ | ✓ |
| 2 | 20N : McCann G. Agency (Internship) | Internship | McCann G. Agency | 2011–Present | 100 | parseStrictExperiencesFromLines | ✗ | ✓ |

### Detected — detail

#### Experience 1

**Source line:**
```
30-year old Illustrator and graphic 2011-2022 : Freelancer Illustrator, Graphic designer : Posters, packaging.
```

| Field | Value |
|-------|-------|
| Role | Freelance Illustrator / Graphic Designer |
| Company | Independent / Freelance |
| Dates | 2011–2022 |
| Confidence | 100 |
| Parser | parseStrictExperiencesFromLines |
| In STRUCTURED_RESUME | yes |
| In RESUME_DATA | yes |

#### Experience 2

**Source line:**
```
20N : McCann G. Agency (Internship)
```

| Field | Value |
|-------|-------|
| Role | Internship |
| Company | McCann G. Agency |
| Dates | 2011–Present |
| Confidence | 100 |
| Parser | parseStrictExperiencesFromLines |
| In STRUCTURED_RESUME | no |
| In RESUME_DATA | yes |

## Rejected experiences

| # | Source line | Reason | Parsed role | Parsed company | Dates | Conf |
|--:|-------------|--------|-------------|----------------|-------|-----:|
| 1 | v3 2 GRADRIC designer & Illustrator | no_date_or_career_markers | — | — | — | — |
| 2 | designer edition, logos... | review_queue_pending (experience_candidate) | — | — | — | 50 |
| 3 | 2009 20M : Créapole, creation school management @ man visual communica… | review_queue_pending (experience_candidate) | — | — | — | 50 |

### Rejected — detail

#### Rejected 1

**Source line:**
```
v3 2 GRADRIC designer & Illustrator
```

**Reason:** no_date_or_career_markers

#### Rejected 2

**Source line:**
```
designer edition, logos...
```

**Reason:** review_queue_pending (experience_candidate)

#### Rejected 3

**Source line:**
```
2009 20M : Créapole, creation school management @ man visual communication
```

**Reason:** review_queue_pending (experience_candidate)

## Pipeline notes

- **Strict parser** accepts role+company+date groups with confidence ≥ 70.
- **McCann internship** often parses (`Internship` @ `McCann G. Agency`) but is demoted to `clients[]` / `reviewQueue` during output polish — not kept as `experiences[]`.
- **`designer edition, logos...`** is a freelance bullet fragment — not a standalone experience row.
- **Freelance 2011–2022** survives end-to-end with `sourceLineId: src-5`.
