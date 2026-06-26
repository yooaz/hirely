# EDUCATION RECOVERY REPORT

Generated: 2026-06-06T15:26:20.594Z

## Goal

Recover **LISAA**, **Créapole**, schools, universities, and courses. Phone numbers mixed with education lines must not destroy education records.

## Recovery policy

- **Safe recover only:** education confidence ≥ 85
- **Phone stripping:** `parseEducationLineWithContact` extracts phone/email, keeps education string
- **OCR date repair:** `20M` / `20N` → `2010` before parse
- **Dedupe:** by school + date span (distinct years at same school are kept)
- **Engines:** `recoverSafeParsedEducation` in structured build, auto-accept, and polish

## Summary

| Source | structured | resumeData | cvData | Safe lost from cvData |
|--------|----------:|-----------:|-------:|----------------------:|
| Yoaz OCR | 7 | 4 | 4 | 0 |
| Yoaz fixture (clean) | 2 | 2 | 2 | 0 |

## Yoaz OCR

| Stage | Count |
|-------|------:|
| OCR lines | 42 |
| Document blocks | 0 |
| structuredResume.education | 7 |
| resumeData.education | 4 |
| cvData.education | 4 |
| After school+date dedupe (preview) | 7 |

### Education trace

| # | Markers | Source | Block | structured | resumeData | cvData | Loss point |
|--:|---------|--------|:-----:|:----------:|:----------:|:------:|------------|
| 1 | LISAA | +33649434839 2011 2012 : LISAA, web and motion desig… | — | ✓ | ✓ | ✓ | no_matching_document_block; phone_stripped_education_retained |
| 2 | Créapole, School | 2009 20M : Créapole, creation school management | — | ✓ | ✓ | ✓ | no_matching_document_block |
| 3 | Créapole, School | Ic) yoaz27 2008 2009 : Créapole creation school mana… | — | ✓ | ✓ | ✓ | no_matching_document_block |
| 4 | Créapole, School | 2007 2009 : Créapole creation school management | — | ✓ | ✓ | ✓ | no_matching_document_block |

### Trace detail

#### 1. LISAA

**Source**
```
+33649434839 2011 2012 : LISAA, web and motion design
```

| Parsed | Value |
|--------|-------|
| School | LISAA |
| Program | Web and motion design |
| Dates | 2011–2012 |
| Formatted | LISAA — Web and motion design (2011–2012) |
| Parser | parseEducationLineWithContact |
| Confidence | 90 |
| Phone mixed | yes |
| Safe recover | yes |

**Pipeline presence**

| structuredResume | present |
| resumeData | present |
| cvData | present |

**Loss reason:** no_matching_document_block; phone_stripped_education_retained

#### 2. Créapole · School

**Source**
```
2009 20M : Créapole, creation school management
```

| Parsed | Value |
|--------|-------|
| School | Créapole |
| Program | Creation school management |
| Dates | 2009–2010 |
| Formatted | Créapole — Creation school management (2009–2010) |
| Parser | parseEducationLineWithContact |
| Confidence | 85 |
| Phone mixed | no |
| Safe recover | yes |

**Pipeline presence**

| structuredResume | present |
| resumeData | present |
| cvData | present |

**Loss reason:** no_matching_document_block

#### 3. Créapole · School

**Source**
```
Ic) yoaz27 2008 2009 : Créapole creation school management
```

| Parsed | Value |
|--------|-------|
| School | Créapole |
| Program | Ic) yoaz : creation school management |
| Dates | 2008–2009 |
| Formatted | Créapole — Ic) yoaz : creation school management (2008–2009) |
| Parser | parseEducationLineWithContact |
| Confidence | 85 |
| Phone mixed | no |
| Safe recover | yes |

**Pipeline presence**

| structuredResume | present |
| resumeData | present |
| cvData | present |

**Loss reason:** no_matching_document_block

#### 4. Créapole · School

**Source**
```
2007 2009 : Créapole creation school management
```

| Parsed | Value |
|--------|-------|
| School | Créapole |
| Program | Creation school management |
| Dates | 2007–2009 |
| Formatted | Créapole — Creation school management (2007–2009) |
| Parser | parseEducationLineWithContact |
| Confidence | 85 |
| Phone mixed | no |
| Safe recover | yes |

**Pipeline presence**

| structuredResume | present |
| resumeData | present |
| cvData | present |

**Loss reason:** no_matching_document_block

### Final education in resumeData

1. LISAA — Web and motion design (2011–2012)
2. Créapole — Creation school management — 2008–2009
3. Créapole — Creation school management — 2007–2009
4. Créapole — Creation school management — 2009–2010

## Yoaz fixture (clean)

| Stage | Count |
|-------|------:|
| OCR lines | 57 |
| Document blocks | 0 |
| structuredResume.education | 2 |
| resumeData.education | 2 |
| cvData.education | 2 |
| After school+date dedupe (preview) | 2 |

### Education trace

| # | Markers | Source | Block | structured | resumeData | cvData | Loss point |
|--:|---------|--------|:-----:|:----------:|:----------:|:------:|------------|
| 1 | LISAA | LISAA — Web & Motion Design | — | ✓ | ✓ | ✓ | no_matching_document_block |
| 2 | Créapole | Créapole — Visual Communication / Product Design | — | ✓ | ✓ | ✓ | no_matching_document_block |

### Trace detail

#### 1. LISAA

**Source**
```
LISAA — Web & Motion Design
```

| Parsed | Value |
|--------|-------|
| School | lisaa  |
| Program | — |
| Dates | — |
| Formatted | LISAA — Web & Motion Design |
| Parser | parseEducationLineWithContact |
| Confidence | 85 |
| Phone mixed | no |
| Safe recover | yes |

**Pipeline presence**

| structuredResume | present |
| resumeData | present |
| cvData | present |

**Loss reason:** no_matching_document_block

#### 2. Créapole

**Source**
```
Créapole — Visual Communication / Product Design
```

| Parsed | Value |
|--------|-------|
| School | créapole  |
| Program | — |
| Dates | — |
| Formatted | Créapole — Visual Communication / Product Design |
| Parser | parseEducationLineWithContact |
| Confidence | 85 |
| Phone mixed | no |
| Safe recover | yes |

**Pipeline presence**

| structuredResume | present |
| resumeData | present |
| cvData | present |

**Loss reason:** no_matching_document_block

### Final education in resumeData

1. LISAA — Web & Motion Design
2. Créapole — Visual Communication / Product Design

## Pipeline notes

- Phone+education lines (e.g. `+33649434839 2011 2012 : LISAA…`) parse to clean `LISAA — Web and motion design (2011–2012)`; phone routes to `identity.phone`.
- Créapole OCR corruption (`20M`, `@ man`, `ign fin hie`) is repaired before corrupt-line rejection.
- Multiple Créapole year spans (2007–2009, 2008–2009, 2009–2010) are kept as separate entries when dates differ.
