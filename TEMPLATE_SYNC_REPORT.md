# TEMPLATE SYNC REPORT

Generated: 2026-06-06T15:28:27.687Z
Data source: **Yoaz OCR**
Templates audited: **6** (ats, executive, swiss, creativedirector, productdesigner, agencyportfolio)

## Goal

Verify **Experiences**, **Education**, **Clients**, **Skills**, **Tools**, and **Languages** across:

1. `resumeData` (canonical)
2. `cvData` (template input)
3. Rendered HTML (`HirelyTemplates.render`)

## Global resumeData → cvData

| Section | resumeData | cvData | Lost |
|---------|----------:|-------:|-----:|
| Languages | 2 | 1 | 1 |

## Summary by template

| Template | HTML chars | Sections | Missing | Hidden | Truncated | Pass |
|----------|----------:|---------:|--------:|-------:|----------:|:----:|
| ATS Elite (`ats`) | 2122 | 6 | 0 | 0 | 2 | ✗ |
| Executive (`executive`) | 2136 | 6 | 0 | 0 | 2 | ✗ |
| Swiss Editorial (`swiss`) | 2218 | 6 | 0 | 0 | 2 | ✗ |
| Creative Director (`creativedirector`) | 2196 | 6 | 0 | 0 | 2 | ✗ |
| Product Designer (`productdesigner`) | 2125 | 6 | 0 | 0 | 2 | ✗ |
| Agency Portfolio (`agencyportfolio`) | 2123 | 6 | 0 | 0 | 2 | ✗ |

## Section matrix (Yoaz data)

| Template | Section | resumeData | cvData | HTML visible | Status |
|----------|---------|----------:|-------:|-------------:|--------|
| ats | Experiences | 2 | 2 | 2 | ok |
| ats | Education | 4 | 4 | 4 | ok |
| ats | Clients | 8 | 8 | 8 | ok |
| ats | Skills | 4 | 4 | 4 | ok |
| ats | Tools | 2 | 2 | 1 | truncated |
| ats | Languages | 2 | 1 | 1 | partial_cv_loss |
| executive | Experiences | 2 | 2 | 2 | ok |
| executive | Education | 4 | 4 | 4 | ok |
| executive | Clients | 8 | 8 | 8 | ok |
| executive | Skills | 4 | 4 | 4 | ok |
| executive | Tools | 2 | 2 | 1 | truncated |
| executive | Languages | 2 | 1 | 1 | partial_cv_loss |
| swiss | Experiences | 2 | 2 | 2 | ok |
| swiss | Education | 4 | 4 | 4 | ok |
| swiss | Clients | 8 | 8 | 8 | ok |
| swiss | Skills | 4 | 4 | 4 | ok |
| swiss | Tools | 2 | 2 | 1 | truncated |
| swiss | Languages | 2 | 1 | 1 | partial_cv_loss |
| creativedirector | Experiences | 2 | 2 | 2 | ok |
| creativedirector | Education | 4 | 4 | 4 | ok |
| creativedirector | Clients | 8 | 8 | 8 | ok |
| creativedirector | Skills | 4 | 4 | 4 | ok |
| creativedirector | Tools | 2 | 2 | 1 | truncated |
| creativedirector | Languages | 2 | 1 | 1 | partial_cv_loss |
| productdesigner | Experiences | 2 | 2 | 2 | ok |
| productdesigner | Education | 4 | 4 | 4 | ok |
| productdesigner | Clients | 8 | 8 | 8 | ok |
| productdesigner | Skills | 4 | 4 | 4 | ok |
| productdesigner | Tools | 2 | 2 | 1 | truncated |
| productdesigner | Languages | 2 | 1 | 1 | partial_cv_loss |
| agencyportfolio | Experiences | 2 | 2 | 2 | ok |
| agencyportfolio | Education | 4 | 4 | 4 | ok |
| agencyportfolio | Clients | 8 | 8 | 8 | ok |
| agencyportfolio | Skills | 4 | 4 | 4 | ok |
| agencyportfolio | Tools | 2 | 2 | 1 | truncated |
| agencyportfolio | Languages | 2 | 1 | 1 | partial_cv_loss |

## Missing sections (resumeData → cvData)

_None._

## Hidden sections (cvData → HTML)

_None._

## Truncated sections

### ats — Tools

- fewer items visible in HTML than cvData
- cvData: 2
- HTML visible: 1
- Not found in HTML:
  - `Adobe`

### ats — Languages

- resumeData → cvData partial loss
- resumeData: 2
- cvData: 1

### executive — Tools

- fewer items visible in HTML than cvData
- cvData: 2
- HTML visible: 1
- Not found in HTML:
  - `Adobe`

### executive — Languages

- resumeData → cvData partial loss
- resumeData: 2
- cvData: 1

### swiss — Tools

- fewer items visible in HTML than cvData
- cvData: 2
- HTML visible: 1
- Not found in HTML:
  - `Adobe`

### swiss — Languages

- resumeData → cvData partial loss
- resumeData: 2
- cvData: 1

### creativedirector — Tools

- fewer items visible in HTML than cvData
- cvData: 2
- HTML visible: 1
- Not found in HTML:
  - `Adobe`

### creativedirector — Languages

- resumeData → cvData partial loss
- resumeData: 2
- cvData: 1

### productdesigner — Tools

- fewer items visible in HTML than cvData
- cvData: 2
- HTML visible: 1
- Not found in HTML:
  - `Adobe`

### productdesigner — Languages

- resumeData → cvData partial loss
- resumeData: 2
- cvData: 1

### agencyportfolio — Tools

- fewer items visible in HTML than cvData
- cvData: 2
- HTML visible: 1
- Not found in HTML:
  - `Adobe`

### agencyportfolio — Languages

- resumeData → cvData partial loss
- resumeData: 2
- cvData: 1


## Per-template detail

### ATS Elite (`ats`)

- HTML: 2122 chars · 6 `<section>` nodes

- **Experiences:** resumeData=2 · cvData=2 · html=2 · status=ok · cvExpItem=0
- **Education:** resumeData=4 · cvData=4 · html=4 · status=ok
- **Clients:** resumeData=8 · cvData=8 · html=8 · status=ok
- **Skills:** resumeData=4 · cvData=4 · html=4 · status=ok
- **Tools:** resumeData=2 · cvData=2 · html=1 · status=truncated
- **Languages:** resumeData=2 · cvData=1 · html=1 · status=partial_cv_loss

### Executive (`executive`)

- HTML: 2136 chars · 6 `<section>` nodes

- **Experiences:** resumeData=2 · cvData=2 · html=2 · status=ok · cvExpItem=0
- **Education:** resumeData=4 · cvData=4 · html=4 · status=ok
- **Clients:** resumeData=8 · cvData=8 · html=8 · status=ok
- **Skills:** resumeData=4 · cvData=4 · html=4 · status=ok
- **Tools:** resumeData=2 · cvData=2 · html=1 · status=truncated
- **Languages:** resumeData=2 · cvData=1 · html=1 · status=partial_cv_loss

### Swiss Editorial (`swiss`)

- HTML: 2218 chars · 6 `<section>` nodes

- **Experiences:** resumeData=2 · cvData=2 · html=2 · status=ok · cvExpItem=0
- **Education:** resumeData=4 · cvData=4 · html=4 · status=ok
- **Clients:** resumeData=8 · cvData=8 · html=8 · status=ok
- **Skills:** resumeData=4 · cvData=4 · html=4 · status=ok
- **Tools:** resumeData=2 · cvData=2 · html=1 · status=truncated
- **Languages:** resumeData=2 · cvData=1 · html=1 · status=partial_cv_loss

### Creative Director (`creativedirector`)

- HTML: 2196 chars · 6 `<section>` nodes

- **Experiences:** resumeData=2 · cvData=2 · html=2 · status=ok · cvExpItem=0
- **Education:** resumeData=4 · cvData=4 · html=4 · status=ok
- **Clients:** resumeData=8 · cvData=8 · html=8 · status=ok
- **Skills:** resumeData=4 · cvData=4 · html=4 · status=ok
- **Tools:** resumeData=2 · cvData=2 · html=1 · status=truncated
- **Languages:** resumeData=2 · cvData=1 · html=1 · status=partial_cv_loss

### Product Designer (`productdesigner`)

- HTML: 2125 chars · 6 `<section>` nodes

- **Experiences:** resumeData=2 · cvData=2 · html=2 · status=ok · cvExpItem=0
- **Education:** resumeData=4 · cvData=4 · html=4 · status=ok
- **Clients:** resumeData=8 · cvData=8 · html=8 · status=ok
- **Skills:** resumeData=4 · cvData=4 · html=4 · status=ok
- **Tools:** resumeData=2 · cvData=2 · html=1 · status=truncated
- **Languages:** resumeData=2 · cvData=1 · html=1 · status=partial_cv_loss

### Agency Portfolio (`agencyportfolio`)

- HTML: 2123 chars · 6 `<section>` nodes

- **Experiences:** resumeData=2 · cvData=2 · html=2 · status=ok · cvExpItem=0
- **Education:** resumeData=4 · cvData=4 · html=4 · status=ok
- **Clients:** resumeData=8 · cvData=8 · html=8 · status=ok
- **Skills:** resumeData=4 · cvData=4 · html=4 · status=ok
- **Tools:** resumeData=2 · cvData=2 · html=1 · status=truncated
- **Languages:** resumeData=2 · cvData=1 · html=1 · status=partial_cv_loss

## Pipeline notes

- **Education compact mode:** ATS/Executive/Product join multiple schools on one `cvEduLine` — counts as visible if all entries appear in plain text.
- **Swiss sidebar:** Skills/Tools/Languages render in `<aside>` via `cvBlock` — may lack `cvSection--skills` class but content should still be in HTML.
- **Template filters:** `normalizeProfile` drops lines via `fieldRenderable`, `filterSectionByConfidence`, and `TOOL_OK_RE` (tools with OCR noise).
- **cvData.unsorted** is always cleared before templates — never rendered.
