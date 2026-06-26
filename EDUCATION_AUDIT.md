# EDUCATION ENGINE AUDIT — Yoaz PDF

Generated: 2026-06-06T15:26:25.751Z
Source OCR: 42 lines · harvested: 6 · structured: 7 · final resumeData: 4

> Audit only — no fixes applied.

## Summary

| Metric | Count |
|--------|------:|
| Detected (parser + final) | 7 |
| In STRUCTURED_RESUME | 7 |
| In RESUME_DATA (final) | 4 |
| Rejected / not promoted | 5 |

## Detected education

| # | Source line | School | Program | Dates | Confidence | Parser | In structured | In resumeData |
|--:|-------------|--------|---------|-------|------------|--------|:-------------:|:-------------:|
| 1 | +33649434839 2011 2012 : LISAA, web and motion design | LISAA | Web and motion design | 2011–2012 | 90 | parseEducationLineWithContact | ✓ | ✓ |
| 2 | Ic) yoaz27 2008 2009 : Créapole creation school management | Créapole | Ic) yoaz : creation school management | 2008–2009 | 85 | parseEducationLineWithContact | ✓ | ✓ |
| 3 | 2007 2009 : Créapole creation school management | Créapole | Creation school management | 2007–2009 | 85 | parseEducationLineWithContact | ✓ | ✓ |
| 4 | Ic) yoaz27 2008 2009 : Créapole creation school management ign fin hie. … | Créapole | Creation school management | 2008–2009 | 0 | structured_resume | ✓ | ✓ |
| 5 | 2007 2009 : Créapole creation school management multisectoral year {visu… | Créapole | Product design | 2007–2009 | 90 | structured_resume | ✓ | ✗ |
| 6 | Créapole — M : , creation school management | Créapole | M : , creation school management | — | 40 | structured_resume | ✓ | ✗ |
| 7 | Créapole — Creation school management — 2009–2010 | Créapole | Creation school management | 2009–2010 | — | resumeData_only | ✓ | ✓ |

### Detected — detail

#### Education 1

**Source line:**
```
+33649434839 2011 2012 : LISAA, web and motion design
```

| Field | Value |
|-------|-------|
| School | LISAA |
| Program | Web and motion design |
| Dates | 2011–2012 |
| Confidence | 90 |
| Parser | parseEducationLineWithContact |
| In STRUCTURED_RESUME | yes |
| In RESUME_DATA | yes |

#### Education 2

**Source line:**
```
Ic) yoaz27 2008 2009 : Créapole creation school management
```

| Field | Value |
|-------|-------|
| School | Créapole |
| Program | Ic) yoaz : creation school management |
| Dates | 2008–2009 |
| Confidence | 85 |
| Parser | parseEducationLineWithContact |
| In STRUCTURED_RESUME | yes |
| In RESUME_DATA | yes |

#### Education 3

**Source line:**
```
2007 2009 : Créapole creation school management
```

| Field | Value |
|-------|-------|
| School | Créapole |
| Program | Creation school management |
| Dates | 2007–2009 |
| Confidence | 85 |
| Parser | parseEducationLineWithContact |
| In STRUCTURED_RESUME | yes |
| In RESUME_DATA | yes |

#### Education 4

**Source line:**
```
Ic) yoaz27 2008 2009 : Créapole creation school management ign fin hie. je
```

| Field | Value |
|-------|-------|
| School | Créapole |
| Program | Creation school management |
| Dates | 2008–2009 |
| Confidence | 0 |
| Parser | structured_resume |
| In STRUCTURED_RESUME | yes |
| In RESUME_DATA | yes |

#### Education 5

**Source line:**
```
2007 2009 : Créapole creation school management multisectoral year {visual communication product design, video game, architecture}
```

| Field | Value |
|-------|-------|
| School | Créapole |
| Program | Product design |
| Dates | 2007–2009 |
| Confidence | 90 |
| Parser | structured_resume |
| In STRUCTURED_RESUME | yes |
| In RESUME_DATA | no |

#### Education 6

**Source line:**
```
Créapole — M : , creation school management
```

| Field | Value |
|-------|-------|
| School | Créapole |
| Program | M : , creation school management |
| Dates | — |
| Confidence | 40 |
| Parser | structured_resume |
| In STRUCTURED_RESUME | yes |
| In RESUME_DATA | no |

#### Education 7

**Source line:**
```
Créapole — Creation school management — 2009–2010
```

| Field | Value |
|-------|-------|
| School | Créapole |
| Program | Creation school management |
| Dates | 2009–2010 |
| Confidence | — |
| Parser | resumeData_only |
| In STRUCTURED_RESUME | yes |
| In RESUME_DATA | yes |

## Rejected education

| # | Source line | Reason | School | Program | Dates | Conf |
|--:|-------------|--------|--------|---------|-------|-----:|
| 1 | 2007 2009 : Créapole creation school management multisectoral year {… | fails_isValidEducationItem; not_promoted_to_final_resumeData | Créapole | Product design | 2007–2009 | 90 |
| 2 | Créapole — M : , creation school management | deduped_by_school; not_promoted_to_final_resumeData | Créapole | M : , creation school management | — | 40 |
| 3 | Créapole — Ic) yoaz : creation school management (2008–2009) | deduped_by_school; not_promoted_to_final_resumeData | Créapole | Ic) yoaz : creation school management | 2008–2009 | 60 |
| 4 | ign fin hie. je | ocr_corrupt; no_school_or_degree_match; confidence_below_60 (0); no_school_markers | — | — | — | 0 |
| 5 | @ man visual communication | ocr_corrupt; no_school_or_degree_match; confidence_below_60 (0); no_school_markers | — | — | — | 0 |

### Rejected — detail

#### Rejected 1

**Source line:**
```
2007 2009 : Créapole creation school management multisectoral year {visual communication product design, video game, architecture}
```

**Reason:** fails_isValidEducationItem; not_promoted_to_final_resumeData
**Would have parsed as:** Créapole — Product design (2007–2009) — confidence 90

#### Rejected 2

**Source line:**
```
Créapole — M : , creation school management
```

**Reason:** deduped_by_school; not_promoted_to_final_resumeData
**Would have parsed as:** Créapole — M : , creation school management (—) — confidence 40

#### Rejected 3

**Source line:**
```
Créapole — Ic) yoaz : creation school management (2008–2009)
```

**Reason:** deduped_by_school; not_promoted_to_final_resumeData
**Would have parsed as:** Créapole — Ic) yoaz : creation school management (2008–2009) — confidence 60

#### Rejected 4

**Source line:**
```
ign fin hie. je
```

**Reason:** ocr_corrupt; no_school_or_degree_match; confidence_below_60 (0); no_school_markers

#### Rejected 5

**Source line:**
```
@ man visual communication
```

**Reason:** ocr_corrupt; no_school_or_degree_match; confidence_below_60 (0); no_school_markers

## Pipeline notes

- **parseEducationLineWithContact** requires school markers (`LISAA`, `Créapole`, `school`, `university`, etc.).
- **Phone+education merge** on LISAA line (`+33649434839 2011 2012 : LISAA…`) parses correctly but raw OCR also lands in structured before polish.
- **Créapole OCR corruption** (`20M`, `@ man`, `ign fin hie`) triggers `isCorruptEducationLine` — demoted to unsorted or recovered via `tryRecoverCreapoleEducation`.
- **dedupeEducationEntries** keeps one row per school key — 7 structured entries collapse to 2 final (`LISAA`, `Créapole`).
- **2008–2009 Créapole** row is lost in dedup because **2007–2009** entry wins the earlier start year for the same school key.
