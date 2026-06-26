# Hirely PDF Stress Report

Generated: 2026-06-06T21:48:19.844Z
Pipeline: `p0-layout-production` · Fixtures: **50** synthetic resumes

## Goal

Measure **real parsing accuracy** across document styles before production PDF uploads.

## Metrics

| Metric | Meaning |
|--------|---------|
| **Extraction %** | Structured content retained vs raw input (`retentionPct`) |
| **Classification %** | 60% anchor placement + 40% block typing (non-unknown, accepted) |
| **Confidence** | Parser confidence report + block averages |
| **Text loss %** | Characters not represented in structured CV output |

## Overall summary

| Metric | Average | Grade |
|--------|---------|-------|
| Extraction % | 100% | A |
| Classification % | 37.5% | F |
| Confidence | 69.2 | — |
| Text loss % | 0% | OK |
| Extraction score (7-stage) | 81.2 | — |

## By category

| Category | N | Extraction % | Classification % | Confidence | Text loss % | Errors |
|----------|---|--------------|------------------|------------|-------------|--------|
| ATS resumes | 10/10 | 100% | 36% | 64.7 | 0% | 0 |
| Modern resumes | 10/10 | 100% | 30% | 80 | 0% | 0 |
| Canva resumes | 10/10 | 100% | 54% | 54.8 | 0% | 0 |
| Creative resumes | 10/10 | 100% | 30% | 82.7 | 0% | 0 |
| Scanned resumes | 10/10 | 100% | 37.5% | 63.8 | 0% | 0 |

### ATS resumes

Single-column, standard section headers

| ID | Extraction % | Class % | Confidence | Text loss % | Review |
|----|--------------|---------|------------|-------------|--------|
| ats-01 | 100% | 45% | 71 | 0% | 13 |
| ats-02 | 100% | 30% | 62 | 0% | 16 |
| ats-03 | 100% | 45% | 62 | 0% | 16 |
| ats-04 | 100% | 30% | 62 | 0% | 14 |
| ats-05 | 100% | 15% | 71 | 0% | 14 |
| ats-06 | 100% | 45% | 71 | 0% | 13 |
| ats-07 | 100% | 45% | 62 | 0% | 13 |
| ats-08 | 100% | 45% | 62 | 0% | 13 |
| ats-09 | 100% | 30% | 62 | 0% | 16 |
| ats-10 | 100% | 30% | 62 | 0% | 16 |

**Low classification samples:**
- `ats-01` (45%) — missed: System design→skills
- `ats-02` (30%) — missed: Google→experience, System design→skills
- `ats-03` (45%) — missed: System design→skills
- `ats-04` (30%) — missed: Nike→experience, System design→skills
- `ats-05` (15%) — missed: Spotify→experience, Python→tools, System design→skills

### Modern resumes

Profile / competencies / experience blocks

| ID | Extraction % | Class % | Confidence | Text loss % | Review |
|----|--------------|---------|------------|-------------|--------|
| modern-01 | 100% | 30% | 80 | 0% | 10 |
| modern-02 | 100% | 30% | 80 | 0% | 12 |
| modern-03 | 100% | 30% | 80 | 0% | 11 |
| modern-04 | 100% | 30% | 80 | 0% | 11 |
| modern-05 | 100% | 30% | 80 | 0% | 11 |
| modern-06 | 100% | 30% | 80 | 0% | 11 |
| modern-07 | 100% | 30% | 80 | 0% | 11 |
| modern-08 | 100% | 30% | 80 | 0% | 11 |
| modern-09 | 100% | 30% | 80 | 0% | 12 |
| modern-10 | 100% | 30% | 80 | 0% | 11 |

**Low classification samples:**
- `modern-01` (30%) — missed: Figma→tools, Design systems→skills
- `modern-02` (30%) — missed: Figma→tools, Design systems→skills
- `modern-03` (30%) — missed: Figma→tools, Design systems→skills
- `modern-04` (30%) — missed: Figma→tools, Design systems→skills
- `modern-05` (30%) — missed: Figma→tools, Design systems→skills

### Canva resumes

Decorative headers and informal sections

| ID | Extraction % | Class % | Confidence | Text loss % | Review |
|----|--------------|---------|------------|-------------|--------|
| canva-01 | 100% | 60% | 53 | 0% | 10 |
| canva-02 | 100% | 40% | 62 | 0% | 8 |
| canva-03 | 100% | 60% | 53 | 0% | 9 |
| canva-04 | 100% | 60% | 53 | 0% | 10 |
| canva-05 | 100% | 40% | 53 | 0% | 11 |
| canva-06 | 100% | 60% | 53 | 0% | 9 |
| canva-07 | 100% | 40% | 62 | 0% | 8 |
| canva-08 | 100% | 60% | 53 | 0% | 9 |
| canva-09 | 100% | 60% | 53 | 0% | 9 |
| canva-10 | 100% | 60% | 53 | 0% | 9 |

**Low classification samples:**
- `canva-01` (60%)
- `canva-02` (40%) — missed: McKinsey→experience
- `canva-03` (60%)
- `canva-04` (60%)
- `canva-05` (40%) — missed: Stanford→education

### Creative resumes

Clients, projects, awards, exhibitions

| ID | Extraction % | Class % | Confidence | Text loss % | Review |
|----|--------------|---------|------------|-------------|--------|
| creative-01 | 100% | 30% | 89 | 0% | 8 |
| creative-02 | 100% | 30% | 80 | 0% | 7 |
| creative-03 | 100% | 30% | 80 | 0% | 7 |
| creative-04 | 100% | 30% | 80 | 0% | 7 |
| creative-05 | 100% | 30% | 89 | 0% | 8 |
| creative-06 | 100% | 30% | 80 | 0% | 8 |
| creative-07 | 100% | 30% | 80 | 0% | 7 |
| creative-08 | 100% | 30% | 80 | 0% | 7 |
| creative-09 | 100% | 30% | 80 | 0% | 7 |
| creative-10 | 100% | 30% | 89 | 0% | 8 |

**Low classification samples:**
- `creative-01` (30%) — missed: D&AD→awards, Saatchi→exhibitions, Creative Review→publications
- `creative-02` (30%) — missed: D&AD→awards, Saatchi→exhibitions, Creative Review→publications
- `creative-03` (30%) — missed: D&AD→awards, Saatchi→exhibitions, Creative Review→publications
- `creative-04` (30%) — missed: D&AD→awards, Saatchi→exhibitions, Creative Review→publications
- `creative-05` (30%) — missed: D&AD→awards, Saatchi→exhibitions, Creative Review→publications

### Scanned resumes

ATS content with OCR-like noise

| ID | Extraction % | Class % | Confidence | Text loss % | Review |
|----|--------------|---------|------------|-------------|--------|
| scanned-01 | 100% | 45% | 71 | 0% | 12 |
| scanned-02 | 100% | 45% | 62 | 0% | 13 |
| scanned-03 | 100% | 45% | 53 | 0% | 15 |
| scanned-04 | 100% | 30% | 62 | 0% | 11 |
| scanned-05 | 100% | 15% | 71 | 0% | 12 |
| scanned-06 | 100% | 45% | 71 | 0% | 12 |
| scanned-07 | 100% | 45% | 62 | 0% | 10 |
| scanned-08 | 100% | 45% | 62 | 0% | 9 |
| scanned-09 | 100% | 30% | 62 | 0% | 15 |
| scanned-10 | 100% | 30% | 62 | 0% | 15 |

**Low classification samples:**
- `scanned-01` (45%) — missed: System design→skills
- `scanned-02` (45%) — missed: System design→skills
- `scanned-03` (45%) — missed: System design→skills
- `scanned-04` (30%) — missed: Nike→experience, System design→skills
- `scanned-05` (15%) — missed: Spotify→experience, Python→tools, System design→skills

## Interpretation

- **ATS / Modern**: Expect extraction ≥85%, classification ≥80%.
- **Canva**: Decorative headers stress section detection; classification may dip.
- **Creative**: Clients and awards must not leak into experience.
- **Scanned**: OCR noise increases text loss and lowers confidence.

## Reproduce

```bash
npm run stress:pdf
```

Raw JSON: `tests/output/pdf-stress/report.json`
