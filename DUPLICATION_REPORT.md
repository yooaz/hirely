# DUPLICATION REPORT — Yoaz PDF

Generated: 2026-06-06T11:39:43.429Z
Source: `TRACE_YOAZ_PIPELINE.json`
OCR source lines: 42

> Audit only — same OCR source line mapped to multiple sections. No fixes applied.

## Summary

| Dataset | Multi-section source lines | Within-section dupes | Cross-section exact dupes |
|---------|---------------------------:|---------------------:|--------------------------:|
| RESUME_DATA | 3 | 1 | 0 |
| STRUCTURED_RESUME | 15 | 7 | 1 |
| CV_DATA | 2 | — | — |

## Multi-section source lines (RESUME_DATA)

OCR lines whose content appears in **2+ sections** of final `RESUME_DATA`.

| ID | Source line | Destination sections |
|----|-------------|----------------------|
| src-2 | v3 2 GRADRIC designer & Illustrator | experience, tools |
| src-5 | 30-year old Illustrator and graphic 2011-2022 : Freelancer Illustrator, Graphic designer : Posters, packaging. | experience, skills |
| src-16 | @ man visual communication | education, unsorted |

### Detail — RESUME_DATA

#### src-2

**Source line:**
```
v3 2 GRADRIC designer & Illustrator
```

**Destination sections:** experience, tools

- `experience`: `Freelance Illustrator / Graphic Designer`, `30-year old Illustrator and graphic 2011-2022 : Freelancer Illustrator, Graphic `
- `tools`: `v3 2 GRADRIC designer & Illustrator`

#### src-5

**Source line:**
```
30-year old Illustrator and graphic 2011-2022 : Freelancer Illustrator, Graphic designer : Posters, packaging.
```

**Destination sections:** experience, skills

- `experience`: `Posters, packaging.`, `30-year old Illustrator and graphic 2011-2022 : Freelancer Illustrator, Graphic `
- `skills`: `Graphic design`

#### src-16

**Source line:**
```
@ man visual communication
```

**Destination sections:** education, unsorted

- `education`: `Créapole — Visual Communication — 2007–2009`
- `unsorted`: `@ man visual communication`

## Multi-section source lines (STRUCTURED_RESUME)

**15** OCR lines hit multiple sections before `normalizeResumeData` / confidence gate.

| ID | Source line | Destination sections |
|----|-------------|----------------------|
| src-2 | v3 2 GRADRIC designer & Illustrator | experience, unsorted |
| src-5 | 30-year old Illustrator and graphic 2011-2022 : Freelancer Illustrator, Graphic designer : Posters, … | experience, skills, unsorted |
| src-7 | (Nike Louis Vuitton, Marvel Cadillec, Fortune, Converse | clients, unsorted |
| src-8 | Pantone, Adobe, Arte and more) | clients, unsorted |
| src-14 | +33649434839 2011 2012 : LISAA, web and motion design | education, unsorted |
| src-15 | 2009 20M : Créapole, creation school management | education, unsorted |
| src-16 | @ man visual communication | education, unsorted |
| src-18 | packaging. poster, logos, web design, illustrations. | skills, unsorted |
| src-22 | Ic) yoaz27 2008 2009 : Créapole creation school management | education, unsorted |
| src-23 | ign fin hie. je | education, unsorted |
| src-25 | observation, maquette, packaging.) | skills, unsorted |
| src-26 | 2007 2009 : Créapole creation school management | education, unsorted |
| src-27 | multisectoral year {visual communication | education, unsorted |
| src-28 | product design, video game, architecture} | education, unsorted |
| src-38 | Iustration, Graphic design, Movies | skills, unsorted |

## Multi-section source lines (CV_DATA)

| ID | Source line | Destination sections |
|----|-------------|----------------------|
| src-2 | v3 2 GRADRIC designer & Illustrator | experience, tools |
| src-5 | 30-year old Illustrator and graphic 2011-2022 : Freelancer Illustrator, Graphic designer : Posters, packaging. | experience, skills |

## Within-section duplicates (RESUME_DATA)

### experience (1)
- `Posters, packaging.` ≈ `30-year old Illustrator and graphic 2011-2022 : Freelancer Illustrator, Graphic designer :`

## Cross-section exact text duplicates (RESUME_DATA)

_No identical normalized strings across sections._

## Notable duplication patterns

| Pattern | Example | Sections |
|---------|---------|----------|
| Client brand in clients + tools | Adobe | clients, tools |
| McCann internship line → client name | McCann G. Agency | clients (not experience) |
| Title OCR garbage in tools | v3 2 GRADRIC designer & Illustrator | tools (+ identity title cleaned) |
| Packaging fragments repeated | packaging. poster / packaging.) | skills (within-section) |
| Créapole/LISAA lines in education + unsorted (structured stage) | LISAA / Créapole OCR lines | education, unsorted |
| Freelance line in experience + unsorted (structured stage) | src-5 career line | experience, unsorted |

## Section item counts (RESUME_DATA)

| Section | Items |
|---------|------:|
| experience | 5 |
| education | 2 |
| skills | 4 |
| tools | 2 |
| clients | 9 |
| languages | 2 |
| unsorted | 2 |
