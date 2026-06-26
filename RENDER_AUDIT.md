# RENDER AUDIT — Yoaz PDF

Generated: 2026-06-06T11:48:48.240Z
Pipeline: `resumeData` → `sanitizeResumeForDisplay` → `simple-cv-mapper` → `cvData` → `renderCV`

> Audit only — trace render losses. No fixes applied.

## Summary

| Stage | Exp | Edu | Skills | Tools | Lang | Clients | Unsorted | Summary |
|-------|----:|----:|-------:|------:|-----:|--------:|---------:|--------:|
| resumeData (pre-sanitize) | 1 | 2 | 4 | 1 | 2 | 9 | 3 | 0 |
| sanitizeResumeForDisplay | 1 | 2 | 4 | 2 | 2 | 9 | 2 | 0 |
| simple-cv-mapper | 1 | 2 | 4 | 2 | 1 | 9 | 0 | 0 |
| cvData (normalizeCvData) | 1 | 2 | 4 | 2 | 1 | 9 | 0 | 0 |
| renderCV (template input + HTML) | 1 | 2 | 4 | 2 | 1 | 9 | 0 | 0 |

**renderCV HTML:** 1499 chars · 9 sections · 0 experience items · renderable: yes

## Counts by stage

### resumeData (pre-sanitize)

```json
{
  "experiences": 1,
  "education": 2,
  "skills": 4,
  "tools": 1,
  "languages": 2,
  "clients": 9,
  "projects": 0,
  "unsorted": 3,
  "summary": 0,
  "identity_name": 1,
  "identity_title": 1,
  "identity_email": 0,
  "identity_phone": 1
}
```

### sanitizeResumeForDisplay

```json
{
  "experiences": 1,
  "education": 2,
  "skills": 4,
  "tools": 2,
  "languages": 2,
  "clients": 9,
  "projects": 0,
  "unsorted": 2,
  "summary": 0,
  "identity_name": 1,
  "identity_title": 1,
  "identity_email": 0,
  "identity_phone": 1
}
```

### simple-cv-mapper

```json
{
  "experiences": 1,
  "education": 2,
  "skills": 4,
  "tools": 2,
  "languages": 1,
  "clients": 9,
  "projects": 0,
  "unsorted": 0,
  "summary": 0,
  "identity_name": 1,
  "identity_title": 1,
  "identity_email": 0,
  "identity_phone": 1
}
```

### cvData (normalizeCvData)

```json
{
  "experiences": 1,
  "education": 2,
  "skills": 4,
  "tools": 2,
  "languages": 1,
  "clients": 9,
  "projects": 0,
  "unsorted": 0,
  "summary": 0,
  "identity_name": 1,
  "identity_title": 1,
  "identity_email": 0,
  "identity_phone": 1
}
```

### renderCV (template input + HTML)

```json
{
  "experiences": 1,
  "education": 2,
  "skills": 4,
  "tools": 2,
  "languages": 1,
  "clients": 9,
  "projects": 0,
  "unsorted": 0,
  "summary": 0,
  "identity_name": 1,
  "identity_title": 1,
  "identity_email": 0,
  "identity_phone": 1,
  "html_sections": 9,
  "html_list_items": 0,
  "html_experience_items": 0,
  "html_chars": 1499,
  "html_has_education": 1,
  "html_has_skills": 1,
  "html_has_tools": 0,
  "html_has_languages": 0,
  "html_has_clients": 1
}
```

## First object per section

### resumeData (pre-sanitize)

**identity:**
```
{
  "name": "Nom à confirmer",
  "title": "Graphic Designer & Illustrator",
  "email": "",
  "location": "",
  "phone": "+33649434839",
  "website": "",
  "linkedin": ""
}
```

**experiences:**
```
{
  "role": "Freelance Illustrator / Graphic Designer",
  "company": "Independent / Freelance",
  "location": "",
  "startDate": "2011",
  "endDate": "2022",
  "dates": "2011–2022",
  "bullets": [
    "Posters, packaging."
  ],
  "clients": [],
  "sourceLines": [
    "30-year old Illustrator and graphic 2011-2022 : Freelancer Illustrator, Graphic designer : Posters, packaging."
  ],
  "sourceLineId": "src-5"
}
```

**education:**
```
LISAA — Web and motion design (2011–2012)
```

**skills:**
```
packaging. poster
```

**tools:**
```
v3 2 GRADRIC designer & Illustrator
```

**languages:**
```
French: native
```

**clients:**
```
Nike
```

**unsorted:**
```
@ man visual communication
```

**summary:**
```
_empty_
```

### sanitizeResumeForDisplay

**identity:**
```
{
  "name": "Nom à confirmer",
  "title": "Graphic Designer & Illustrator",
  "email": "",
  "location": "",
  "phone": "+33649434839",
  "website": "",
  "linkedin": ""
}
```

**experiences:**
```
{
  "role": "Freelance Illustrator / Graphic Designer",
  "company": "Independent / Freelance",
  "location": "",
  "startDate": "2011",
  "endDate": "2022",
  "dates": "2011–2022",
  "bullets": [
    "Posters, packaging."
  ],
  "clients": [],
  "sourceLines": [
    "30-year old Illustrator and graphic 2011-2022 : Freelancer Illustrator, Graphic designer : Posters, packaging."
  ],
  "sourceLineId": "src-5"
}
```

**education:**
```
LISAA — Web and motion design (2011–2012)
```

**skills:**
```
packaging. poster
```

**tools:**
```
v3 2 GRADRIC designer & Illustrator
```

**languages:**
```
French: native
```

**clients:**
```
Nike
```

**unsorted:**
```
@ man visual communication
```

**summary:**
```
_empty_
```

### simple-cv-mapper

**identity:**
```
{
  "name": "Nom à confirmer",
  "title": "Graphic Designer & Illustrator",
  "email": "",
  "phone": "+33649434839",
  "location": "",
  "website": "",
  "linkedin": ""
}
```

**experiences:**
```
Freelance Illustrator / Graphic Designer — Independent / Freelance — 2011–2022: Posters, packaging.
```

**education:**
```
LISAA — Web and motion design (2011–2012)
```

**skills:**
```
packaging. poster
```

**tools:**
```
v3 2 GRADRIC designer & Illustrator
```

**languages:**
```
French: native
```

**clients:**
```
Nike
```

**unsorted:**
```
_empty_
```

**summary:**
```
_empty_
```

### cvData (normalizeCvData)

**identity:**
```
{
  "name": "Nom à confirmer",
  "title": "Graphic Designer & Illustrator",
  "email": "",
  "phone": "+33649434839",
  "location": "",
  "website": "",
  "linkedin": ""
}
```

**experiences:**
```
Freelance Illustrator / Graphic Designer — Independent / Freelance — 2011–2022: Posters, packaging.
```

**education:**
```
LISAA — Web and motion design (2011–2012)
```

**skills:**
```
packaging. poster
```

**tools:**
```
v3 2 GRADRIC designer & Illustrator
```

**languages:**
```
French: native
```

**clients:**
```
Nike
```

**unsorted:**
```
_empty_
```

**summary:**
```
_empty_
```

### renderCV (template input + HTML)

**identity:**
```
{
  "name": "Nom à confirmer",
  "title": "Graphic Designer & Illustrator",
  "email": "",
  "phone": "+33649434839",
  "location": "",
  "website": "",
  "linkedin": ""
}
```

**experiences:**
```
Freelance Illustrator / Graphic Designer — Independent / Freelance — 2011–2022: Posters, packaging.
```

**education:**
```
LISAA — Web and motion design (2011–2012)
```

**skills:**
```
packaging. poster
```

**tools:**
```
v3 2 GRADRIC designer & Illustrator
```

**languages:**
```
French: native
```

**clients:**
```
Nike
```

**unsorted:**
```
_empty_
```

**summary:**
```
_empty_
```

## Render losses (stage → stage)

### resumeData → sanitizeResumeForDisplay

| Field | Before | After | Lost | Gained |
|-------|-------:|------:|-----:|-------:|
| tools | 1 | 2 | 0 | 1 |
| unsorted | 3 | 2 | 1 | 0 |

### sanitizeResumeForDisplay → simple-cv-mapper

| Field | Before | After | Lost | Gained |
|-------|-------:|------:|-----:|-------:|
| languages | 2 | 1 | 1 | 0 |
| unsorted | 2 | 0 | 2 | 0 |

### cvData → renderCV

| Field | Before | After | Lost | Gained |
|-------|-------:|------:|-----:|-------:|
| html_sections | 0 | 9 | 0 | 9 |
| html_chars | 0 | 1499 | 0 | 1499 |
| html_has_education | 0 | 1 | 0 | 1 |
| html_has_skills | 0 | 1 | 0 | 1 |
| html_has_clients | 0 | 1 | 0 | 1 |

## Key render loss findings

- **Languages:** 2 → 1 — OCR-noise language line dropped by `LANGUAGE_OK_RE` / `INVALID_LANGUAGE_RE`.
- **Unsorted cleared:** `resumeDataToCvData` / mapper sets `cv.unsorted = []` — unsorted never reaches template.
- **Template render loss:** 2 tool(s) in cvData but **0** in HTML — blocked by `normalizeProfile` / `fieldRenderable` (OCR tool line fails `TOOL_OK_RE` at template layer).
- **Template render loss:** 1 language(s) in cvData but **0** in HTML — `filterSectionByConfidence` or `fieldRenderable` at template layer.
- **Template:** experience string present in cvData but rendered as compact section (no `cvExpItem` nodes) — ATS template joins education on one line.

## Canonical path check

`resumeDataToCvData(import.resumeData)` (production shortcut):

```json
{
  "experiences": 1,
  "education": 2,
  "skills": 4,
  "tools": 2,
  "languages": 1,
  "clients": 9,
  "projects": 0,
  "unsorted": 0,
  "summary": 0,
  "identity_name": 1,
  "identity_title": 1,
  "identity_email": 0,
  "identity_phone": 1
}
```
