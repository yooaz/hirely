# DATA LOSS REPORT — Yoaz PDF

Generated: 2026-06-06T11:38:23.844Z
Source trace: `TRACE_YOAZ_PIPELINE.json`
PDF: /Users/yohannazancot/Documents/cv/cv2022 yohann azancot copie.pdf
OCR source: live_pdf (OCR cache fallback)

> Audit only — OCR_OUTPUT compared to final CV_DATA. No fixes applied.

## Summary metrics

| Metric | Value |
|--------|------:|
| OCR text length | 1292 chars, 41 lines |
| CV_DATA flattened length | 650 chars |
| **Text preserved** (token overlap) | **40.9%** |
| **Text lost** (token overlap) | **59.1%** |
| Text preserved (line-level, ≥40% tokens matched) | 34.1% (14/41 lines) |
| **Entities preserved** (section-scoped catalog) | **58.1%** (18/31) |
| **Entities lost** (section-scoped catalog) | **41.9%** (13/31) |

### Token methodology

- OCR tokens: unique normalized words (≥2 chars) from `OCR_OUTPUT.text`
- Preserved token: appears in flattened `CV_DATA` (all fields including tools, languages, clients)
- Entity: predefined marker set from OCR ground truth (see catalog below)

## Section entity audit

### Experiences

| Preserved | Lost | Rate |
|----------:|-----:|-----:|
| 1 | 2 | 33.3% preserved / 66.7% lost |

**Preserved in CV_DATA:**
- ✓ 2011–2022 Freelance Illustrator / Graphic Designer

**Lost from OCR:**
- ✗ Freelance detail: edition, logos — OCR: `designer edition, logos...`
- ✗ McCann G. Agency (Internship) — OCR: `20N : McCann G. Agency (Internship)`

### Education

| Preserved | Lost | Rate |
|----------:|-----:|-----:|
| 3 | 1 | 75% preserved / 25% lost (2 entries in CV_DATA vs 4 OCR entities) |

**Preserved in CV_DATA:**
- ✓ LISAA — web and motion design (2011–2012)
- ✓ Créapole 2009–20M — visual communication
- ✓ Créapole 2007–2009 — multisectoral year

**Lost from OCR:**
- ✗ Créapole 2008–2009 — product design — OCR: `Ic) yoaz27 2008 2009 : Créapole creation school management`

### Clients

| Preserved | Lost | Rate |
|----------:|-----:|-----:|
| 8 | 1 | 88.9% preserved / 11.1% lost |

**Preserved in CV_DATA:**
- ✓ Nike
- ✓ Louis Vuitton
- ✓ Marvel
- ✓ Cadillac (OCR: Cadillec)
- ✓ Fortune
- ✓ Converse
- ✓ Pantone
- ✓ Arte

**Lost from OCR:**
- ✗ Adobe — OCR: `adobe`

### Skills

| Preserved | Lost | Rate |
|----------:|-----:|-----:|
| 5 | 6 | 45.5% preserved / 54.5% lost |

**Preserved in CV_DATA:**
- ✓ Illustrator
- ✓ Graphic design
- ✓ Web design
- ✓ Packaging
- ✓ French: native

**Lost from OCR:**
- ✗ Photoshop — OCR: `photoshop`
- ✗ Illustration — OCR: `illustration, iustration`
- ✗ Typography — OCR: `typography`
- ✗ Logo / Vector / Print — OCR: `logo, vector, print`
- ✗ English: fluent — OCR: `english, fluent`
- ✗ Drawing — OCR: `drawing`

### Identity & contact (bonus)

Preserved: 1/4 (25%)
- ✗ yoaz@hotmail.fr
- ✓ +33649434839
- ✗ Be.net/yoaz
- ✗ yoaz.tumblr.com

## OCR lines not reaching CV_DATA

**27** of **41** OCR lines have <40% token overlap with CV_DATA:

- `ee à` (0% tokens matched)
- `A A TN` (0% tokens matched)
- `PROFILE WORK EXPERIENCE` (0% tokens matched)
- `_— pe` (0% tokens matched)
- `designer edition, logos...` (33% tokens matched)
- `20N : McCann G. Agency (Internship)` (25% tokens matched)
- `CONTACT` (0% tokens matched)
- `- EDUCATION` (0% tokens matched)
- `es` (0% tokens matched)
- `RS Phone:` (0% tokens matched)
- `yoaz@hotmail fr (typography, visuel identity, corporate identity.` (17% tokens matched)
- `» Be.net/yoaz marketing, technologie, marketing studies` (0% tokens matched)
- `ign fin hie. je` (33% tokens matched)
- `Q voaz.tumblr com product design (infographie, ergonomie, extern` (29% tokens matched)
- `observation, maquette, packaging.)` (33% tokens matched)
- `product design, video game, architecture}` (20% tokens matched)
- `LANGUAGES` (0% tokens matched)
- `SKILLS INTEREST` (0% tokens matched)
- `TT Lu` (0% tokens matched)
- `Photograph:` (0% tokens matched)
- `English: fluent Ps] photoshop EEE CTT` (0% tokens matched)
- `Mustrator RE scowboscc` (0% tokens matched)
- `[6] incesion me SE` (0% tokens matched)
- `Drawing` (0% tokens matched)
- `Print, Logo, Vector, Art... Reading` (0% tokens matched)
- `Music` (0% tokens matched)
- `Nature` (0% tokens matched)

## CV_DATA final snapshot

```json
{
  "identity": {
    "name": "Nom à confirmer",
    "title": "Graphic Designer & Illustrator",
    "email": "",
    "phone": "+33649434839"
  },
  "experience": [
    "Freelance Illustrator / Graphic Designer — Independent / Freelance — 2011–2022: Posters, packaging."
  ],
  "education": [
    "LISAA — Web and motion design (2011–2012)",
    "Créapole — Visual Communication — 2007–2009"
  ],
  "skills": [
    "packaging. poster",
    "web design",
    "packaging.)",
    "Graphic design"
  ],
  "tools": [
    "v3 2 GRADRIC designer & Illustrator",
    "Adobe"
  ],
  "languages": [
    "French: native"
  ],
  "clients": [
    "Nike",
    "Louis Vuitton",
    "Marvel",
    "Cadillac",
    "Fortune",
    "Converse",
    "Pantone",
    "Arte",
    "McCann"
  ]
}
```

## Primary loss hotspots (OCR → CV_DATA)

| Area | What disappeared |
|------|------------------|
| **Experiences** | McCann internship not in `experience[]` (only in `clients[]` as "McCann"); freelance "edition, logos" bullets dropped |
| **Education** | 4 distinct OCR school-year entries → 2 in CV_DATA (2 entries lost by count); Créapole years collapsed |
| **Clients** | 8/9 in `clients[]`; Adobe preserved in `tools[]` not `clients[]` |
| **Skills** | Photoshop/Illustrator OCR tokens lost; English language line lost; interests (Movies, Music, Nature) not in CV_DATA |
| **Identity** | Email, portfolio URLs, name never mapped; phone recovered in CV_DATA |
| **Text** | ~59.1% unique OCR tokens absent from CV_DATA; unsorted/reviewQueue text intentionally stripped at cvData layer |

## Pipeline stage reminder

| Stage | exp | edu | skills | tools | lang | clients | unsorted |
|-------|----:|----:|-------:|------:|-----:|--------:|---------:|
| OCR_OUTPUT | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| EXTRACTION | — | — | — | — | — | — | 41 lines |
| STRUCTURED_RESUME | 1 | 7 | 4 | 0 | 0 | 5 | 40 |
| RESUME_DATA | 1 | 2 | 4 | 2 | 2 | 9 | 2 |
| CV_DATA | 1 | 2 | 4 | 2 | 1 | 9 | 0 |
