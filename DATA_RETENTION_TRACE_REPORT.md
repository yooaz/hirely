# HIRELY P0 — Data Retention Trace

**Generated:** 2026-06-10T20:48:32.172Z

## Pipeline stages

- `RAW_TEXT_COUNT`
- `NORMALIZED_TEXT_COUNT`
- `SECTION_CANDIDATES_COUNT`
- `STRUCTURED_RESUME_COUNT`
- `RESUME_DATA_COUNT`
- `FINAL_RESUME_DATA_COUNT`
- `RENDERED_DOM_COUNT`

## Sections traced

`identity` · `summary` · `experience` · `education` · `skills` · `tools` · `languages` · `clients` · `projects` · `portfolio`

## Import: creative-cv

Raw 1003 chars → normalized 981 chars · review queue 5

### Clients / projects funnel

| Stage | Clients | Projects |
| --- | ---: | ---: |
| RAW_TEXT_COUNT | 0 | 0 |
| NORMALIZED_TEXT_COUNT | 0 | 0 |
| SECTION_CANDIDATES_COUNT | 0 | 0 |
| STRUCTURED_RESUME_COUNT | 9 | 0 |
| RESUME_DATA_COUNT | 7 | 0 |
| FINAL_RESUME_DATA_COUNT | 7 | 0 |
| RENDERED_DOM_COUNT | 7 | 0 |

### Top loss hotspots

| Stage transition | Section | Dropped | Lost examples |
| --- | --- | ---: | --- |
| RAW_TEXT_COUNT → NORMALIZED_TEXT_COUNT | experience | 17 | Graphic Designer; - Created high-impact illustration and graphic design work across posters; packaging |
| SECTION_CANDIDATES_COUNT → STRUCTURED_RESUME_COUNT | summary | 5 | Creative professional specializing in illustration, graphic design and visual storytelling, with experience delivering posters, packaging, identities and visual assets for cultural and commercial projects.; Freelance Illustrator / Graphic Designer; Independent / Freelance · 2011 — Present |
| STRUCTURED_RESUME_COUNT → RESUME_DATA_COUNT | clients | 2 | Adobe; Arte |
| NORMALIZED_TEXT_COUNT → SECTION_CANDIDATES_COUNT | experience | 1 | Independent / Freelance · 2011 — Present |
| STRUCTURED_RESUME_COUNT → RESUME_DATA_COUNT | experience | 1 | — |
| RESUME_DATA_COUNT → FINAL_RESUME_DATA_COUNT | summary | 1 | Graphic Designer and Illustrator specializing in illustration, graphic design and visual storytelling, with experience delivering posters, packaging and brand assets for cultural and commercial projects. |
| RESUME_DATA_COUNT → FINAL_RESUME_DATA_COUNT | experience | 1 | — |
| RESUME_DATA_COUNT → FINAL_RESUME_DATA_COUNT | tools | 1 | — |
| STRUCTURED_RESUME_COUNT → RESUME_DATA_COUNT | skills | 0 | Packaging |

### clients — stage detail

| Stage | Count | Examples (first 5) | Lost from previous |
| --- | ---: | --- | --- |
| RAW_TEXT_COUNT | 0 | — | — |
| NORMALIZED_TEXT_COUNT | 0 | — | — |
| SECTION_CANDIDATES_COUNT | 0 | — | — |
| STRUCTURED_RESUME_COUNT | 9 | Pantone; Adobe; Arte | — |
| RESUME_DATA_COUNT | 7 | Pantone; Nike; Converse | Adobe; Arte |
| FINAL_RESUME_DATA_COUNT | 7 | Pantone; Nike; Converse | — |
| RENDERED_DOM_COUNT | 7 | Pantone; Nike; Converse | — |

### experience — stage detail

| Stage | Count | Examples (first 5) | Lost from previous |
| --- | ---: | --- | --- |
| RAW_TEXT_COUNT | 18 | Freelance Illustrator; Graphic Designer; Independent | — |
| NORMALIZED_TEXT_COUNT | 1 | Independent / Freelance · 2011 — Present | Graphic Designer; - Created high-impact illustration and graphic design work across posters; packaging |
| SECTION_CANDIDATES_COUNT | 0 | — | Independent / Freelance · 2011 — Present |
| STRUCTURED_RESUME_COUNT | 4 | 2011 — Present — 2011–Present; 2011 — Present Graphic Designer & Illustrator — 2011–Present; Independent / Freelance — Independent / Freelance — 2011–Present | — |
| RESUME_DATA_COUNT | 3 | Graphic Designer & Illustrator — 2011 — 2011–2011; Graphic Designer — Independent / Freelance — 2011–2022; Freelance Professional — Freelance Professional — 2011–Present | — |
| FINAL_RESUME_DATA_COUNT | 2 | Freelance Illustrator / Graphic Designer — Independent / Freelance — 2011–2022; Graphic Designer & Illustrator — 2011 — 2011–2011 | — |
| RENDERED_DOM_COUNT | 2 | Freelance Illustrator / Graphic Designer - Independent / Freelance - 2011-2022; Graphic Designer & Illustrator - 2011 - 2011-2011 | — |

### skills — stage detail

| Stage | Count | Examples (first 5) | Lost from previous |
| --- | ---: | --- | --- |
| RAW_TEXT_COUNT | 8 | Illustration; Graphic Design; Visual Identity | — |
| NORMALIZED_TEXT_COUNT | 8 | Illustration; Graphic Design; Visual Identity | — |
| SECTION_CANDIDATES_COUNT | 8 | Illustration; Graphic Design; Visual Identity | — |
| STRUCTURED_RESUME_COUNT | 8 | Illustration; Graphic Design; Visual Identity | — |
| RESUME_DATA_COUNT | 10 | Illustration; Graphic Design; Editorial Design | Packaging |
| FINAL_RESUME_DATA_COUNT | 11 | Illustration; Graphic Design; Packaging | — |
| RENDERED_DOM_COUNT | 14 | Illustration; Graphic Design; Packaging | — |

## Import: yoaz-cv

Raw 2511 chars → normalized 2471 chars · review queue 47

### Clients / projects funnel

| Stage | Clients | Projects |
| --- | ---: | ---: |
| RAW_TEXT_COUNT | 9 | 0 |
| NORMALIZED_TEXT_COUNT | 0 | 0 |
| SECTION_CANDIDATES_COUNT | 0 | 0 |
| STRUCTURED_RESUME_COUNT | 16 | 0 |
| RESUME_DATA_COUNT | 7 | 2 |
| FINAL_RESUME_DATA_COUNT | 7 | 2 |
| RENDERED_DOM_COUNT | 7 | 2 |

### Top loss hotspots

| Stage transition | Section | Dropped | Lost examples |
| --- | --- | ---: | --- |
| RAW_TEXT_COUNT → NORMALIZED_TEXT_COUNT | experience | 58 | packaging; logos and brand assets.; - Collaborated with recognized brands including Nike |
| SECTION_CANDIDATES_COUNT → STRUCTURED_RESUME_COUNT | summary | 29 | Freelance Illustrator / Graphic Designer; Independent / Freelance · 2011 — Present; Lead Illustrator · 2011 — 2014 |
| STRUCTURED_RESUME_COUNT → RESUME_DATA_COUNT | experience | 19 | — |
| RAW_TEXT_COUNT → NORMALIZED_TEXT_COUNT | clients | 9 | Nike; Adobe; Louis Vuitton |
| NORMALIZED_TEXT_COUNT → SECTION_CANDIDATES_COUNT | experience | 9 | Independent / Freelance · 2011 — Present; Lead Illustrator · 2011 — 2014; Art Director — Illustration · 2014 — 2016 |
| SECTION_CANDIDATES_COUNT → STRUCTURED_RESUME_COUNT | languages | 9 | Nike; Adobe; Louis Vuitton |
| STRUCTURED_RESUME_COUNT → RESUME_DATA_COUNT | clients | 9 | Adobe; Arte; McCann |
| RESUME_DATA_COUNT → FINAL_RESUME_DATA_COUNT | experience | 9 | — |
| SECTION_CANDIDATES_COUNT → STRUCTURED_RESUME_COUNT | education | 2 | — |
| STRUCTURED_RESUME_COUNT → RESUME_DATA_COUNT | tools | 2 | Affinity Designer |
| RESUME_DATA_COUNT → FINAL_RESUME_DATA_COUNT | summary | 1 | - Directed visual campaigns for luxury and lifestyle brands.
- Led art direction for print and digital campaigns.
- Delivered key visuals for FMCG and automotive clients.
- Built reusable asset libraries for agency studios.
- Brand identity and packaging for beauty and fashion labels.
- Storyboard and style frames for motion pitches.
- Campaign illustration for entertainment and tech launches.
- Iconography and editorial illustration for social formats.
- Mentoring junior designers on craft and presentation. |
| RESUME_DATA_COUNT → FINAL_RESUME_DATA_COUNT | tools | 1 | — |

### clients — stage detail

| Stage | Count | Examples (first 5) | Lost from previous |
| --- | ---: | --- | --- |
| RAW_TEXT_COUNT | 9 | Nike; Adobe; Louis Vuitton | — |
| NORMALIZED_TEXT_COUNT | 0 | — | Nike; Adobe; Louis Vuitton |
| SECTION_CANDIDATES_COUNT | 0 | — | — |
| STRUCTURED_RESUME_COUNT | 16 | Pantone; Adobe; Arte | — |
| RESUME_DATA_COUNT | 7 | Pantone; Nike; Converse | Adobe; Arte; McCann |
| FINAL_RESUME_DATA_COUNT | 7 | Pantone; Nike; Converse | — |
| RENDERED_DOM_COUNT | 7 | Pantone; Nike; Converse | — |

### projects — stage detail

| Stage | Count | Examples (first 5) | Lost from previous |
| --- | ---: | --- | --- |
| RAW_TEXT_COUNT | 0 | — | — |
| NORMALIZED_TEXT_COUNT | 0 | — | — |
| SECTION_CANDIDATES_COUNT | 0 | — | — |
| STRUCTURED_RESUME_COUNT | 0 | — | — |
| RESUME_DATA_COUNT | 2 | Brand identity and packaging for beauty and fashion labels; Campaign illustration for entertainment and tech launches | — |
| FINAL_RESUME_DATA_COUNT | 2 | Brand identity and packaging for beauty and fashion labels; Campaign illustration for entertainment and tech launches | — |
| RENDERED_DOM_COUNT | 2 | Brand identity and packaging for beauty and fashion labels; Campaign illustration for entertainment and tech launches | — |

### experience — stage detail

| Stage | Count | Examples (first 5) | Lost from previous |
| --- | ---: | --- | --- |
| RAW_TEXT_COUNT | 67 | Freelance Illustrator; Graphic Designer; Independent | — |
| NORMALIZED_TEXT_COUNT | 9 | Independent / Freelance · 2011 — Present; Lead Illustrator · 2011 — 2014; Art Director — Illustration · 2014 — 2016 | packaging; logos and brand assets.; - Collaborated with recognized brands including Nike |
| SECTION_CANDIDATES_COUNT | 0 | — | Independent / Freelance · 2011 — Present; Lead Illustrator · 2011 — 2014; Art Director — Illustration · 2014 — 2016 |
| STRUCTURED_RESUME_COUNT | 31 | Art Director Independent · — Independent / Freelance — 2018–2020; illustrators on seasonal brand pushes. Havas Paris Senior Illustrator · — Independent / Freelance — 2016–2018; Illustrator / Designer · — Independent / Freelance — 2020–2021 | — |
| RESUME_DATA_COUNT | 12 | Art Director Independent — Art Director Independent — 2018–2020; Illustrators on Seasonal Brand Pushes. Havas Paris Senior Illustrator — Illustrators on Seasonal Brand Pushes. Havas Paris Senior Illustrator — 2016–2018; Illustrator / Designer — Independent / Freelance — 2020–2021 | — |
| FINAL_RESUME_DATA_COUNT | 3 | Freelance Illustrator / Graphic Designer — Independent / Freelance — 2018–2020; 2011 — 2014 — 2011–2014; 2014 — 2016 — 2014–2016 | — |
| RENDERED_DOM_COUNT | 3 | Freelance Illustrator / Graphic Designer - Independent / Freelance - 2018-2020; 2011 - 2014 - 2011-2014; 2014 - 2016 - 2014-2016 | — |

### skills — stage detail

| Stage | Count | Examples (first 5) | Lost from previous |
| --- | ---: | --- | --- |
| RAW_TEXT_COUNT | 12 | Illustration; Graphic Design; Visual Identity | — |
| NORMALIZED_TEXT_COUNT | 12 | Illustration; Graphic Design; Visual Identity | — |
| SECTION_CANDIDATES_COUNT | 12 | Illustration; Graphic Design; Visual Identity | — |
| STRUCTURED_RESUME_COUNT | 13 | - Produced illustration systems for multi-market advertising.; - Illustration for product storytelling pages.; Illustration | — |
| RESUME_DATA_COUNT | 13 | Illustration; Graphic Design; Editorial Design | Packaging |
| FINAL_RESUME_DATA_COUNT | 14 | Illustration; Graphic Design; Packaging | — |
| RENDERED_DOM_COUNT | 17 | Illustration; Graphic Design; Packaging | — |

## Import: creative-experience-rich

Raw 714 chars → normalized 696 chars · review queue 8

### Clients / projects funnel

| Stage | Clients | Projects |
| --- | ---: | ---: |
| RAW_TEXT_COUNT | 0 | 0 |
| NORMALIZED_TEXT_COUNT | 0 | 0 |
| SECTION_CANDIDATES_COUNT | 0 | 0 |
| STRUCTURED_RESUME_COUNT | 9 | 0 |
| RESUME_DATA_COUNT | 6 | 0 |
| FINAL_RESUME_DATA_COUNT | 6 | 0 |
| RENDERED_DOM_COUNT | 6 | 0 |

### Top loss hotspots

| Stage transition | Section | Dropped | Lost examples |
| --- | --- | ---: | --- |
| RAW_TEXT_COUNT → NORMALIZED_TEXT_COUNT | experience | 16 | Graphic Designer; PlayStation; Marvel |
| SECTION_CANDIDATES_COUNT → STRUCTURED_RESUME_COUNT | summary | 9 | Creative illustrator and designer with agency and freelance experience for global brands.; Freelance Illustrator / Graphic Designer; Independent / Freelance · 2011 — Present |
| STRUCTURED_RESUME_COUNT → RESUME_DATA_COUNT | experience | 6 | Illustration — Nike projects — 2016–2020 |
| NORMALIZED_TEXT_COUNT → SECTION_CANDIDATES_COUNT | experience | 5 | Independent / Freelance · 2011 — Present; Art Director — McCann Paris — 2018 — 2020; Creative Director — BETC Agency — 2020 — 2023 |
| STRUCTURED_RESUME_COUNT → RESUME_DATA_COUNT | clients | 3 | Arte; Adobe; Visa |
| RESUME_DATA_COUNT → FINAL_RESUME_DATA_COUNT | experience | 2 | — |
| RESUME_DATA_COUNT → FINAL_RESUME_DATA_COUNT | tools | 1 | — |

### clients — stage detail

| Stage | Count | Examples (first 5) | Lost from previous |
| --- | ---: | --- | --- |
| RAW_TEXT_COUNT | 0 | — | — |
| NORMALIZED_TEXT_COUNT | 0 | — | — |
| SECTION_CANDIDATES_COUNT | 0 | — | — |
| STRUCTURED_RESUME_COUNT | 9 | Nike; Converse; Marvel | — |
| RESUME_DATA_COUNT | 6 | Nike; Converse; Marvel | Arte; Adobe; Visa |
| FINAL_RESUME_DATA_COUNT | 6 | Nike; Converse; Marvel | — |
| RENDERED_DOM_COUNT | 6 | Nike; Converse; Marvel | — |

### experience — stage detail

| Stage | Count | Examples (first 5) | Lost from previous |
| --- | ---: | --- | --- |
| RAW_TEXT_COUNT | 21 | Freelance Illustrator; Graphic Designer; Independent | — |
| NORMALIZED_TEXT_COUNT | 5 | Independent / Freelance · 2011 — Present; Art Director — McCann Paris — 2018 — 2020; Creative Director — BETC Agency — 2020 — 2023 | Graphic Designer; PlayStation; Marvel |
| SECTION_CANDIDATES_COUNT | 0 | — | Independent / Freelance · 2011 — Present; Art Director — McCann Paris — 2018 — 2020; Creative Director — BETC Agency — 2020 — 2023 |
| STRUCTURED_RESUME_COUNT | 16 | Art Director — McCann Paris — 2018–2020; Creative Director — BETC Agency — 2020–2023; Illustrator — Creative illustrator and designer with agency and freelance experience for globa — Date à confirmer | — |
| RESUME_DATA_COUNT | 10 | Designer — McCann G. Agency — 2018–2020; Creative Director — BETC Agency — 2020–2023; 2018 — 2020 — 2018–2020 | Illustration — Nike projects — 2016–2020 |
| FINAL_RESUME_DATA_COUNT | 8 | Freelance Illustrator / Graphic Designer — Independent / Freelance — 2011–2022; Designer — McCann G. Agency — 2018–2020; Creative Director — BETC Agency — 2020–2023 | — |
| RENDERED_DOM_COUNT | 8 | Freelance Illustrator / Graphic Designer - Independent / Freelance - 2011-2022; Designer - McCann G. Agency - 2018-2020; Creative Director - BETC Agency - 2020-2023 | — |

### skills — stage detail

| Stage | Count | Examples (first 5) | Lost from previous |
| --- | ---: | --- | --- |
| RAW_TEXT_COUNT | 3 | Illustration; Graphic Design; Art Direction | — |
| NORMALIZED_TEXT_COUNT | 3 | Illustration; Graphic Design; Art Direction | — |
| SECTION_CANDIDATES_COUNT | 3 | Illustration; Graphic Design; Art Direction | — |
| STRUCTURED_RESUME_COUNT | 3 | Illustration; Graphic Design; Art Direction | — |
| RESUME_DATA_COUNT | 4 | Illustration; Graphic Design; Art Direction | — |
| FINAL_RESUME_DATA_COUNT | 4 | Illustration; Graphic Design; Art Direction | — |
| RENDERED_DOM_COUNT | 5 | Illustration; Graphic Design; Art Direction | — |

## Import: designer-cv-rich

Raw 910 chars → normalized 855 chars · review queue 11

### Clients / projects funnel

| Stage | Clients | Projects |
| --- | ---: | ---: |
| RAW_TEXT_COUNT | 4 | 2 |
| NORMALIZED_TEXT_COUNT | 0 | 2 |
| SECTION_CANDIDATES_COUNT | 0 | 2 |
| STRUCTURED_RESUME_COUNT | 6 | 3 |
| RESUME_DATA_COUNT | 4 | 3 |
| FINAL_RESUME_DATA_COUNT | 4 | 3 |
| RENDERED_DOM_COUNT | 4 | 3 |

### Top loss hotspots

| Stage transition | Section | Dropped | Lost examples |
| --- | --- | ---: | --- |
| STRUCTURED_RESUME_COUNT → RESUME_DATA_COUNT | experience | 7 | Solo Show — Galerie Perrotin, Paris — 2023–Present; Designer — 2019–Present |
| NORMALIZED_TEXT_COUNT → SECTION_CANDIDATES_COUNT | experience | 6 | Solo show — Galerie Perrotin, Paris · 2023 |
| RAW_TEXT_COUNT → NORMALIZED_TEXT_COUNT | clients | 4 | Nike; Adobe; Spotify |
| RESUME_DATA_COUNT → FINAL_RESUME_DATA_COUNT | portfolio | 4 | Behance — https://behance.net/alexbrand; Dribbble — https://dribbble.com/alexbrand; Portfolio — https://alexbrand.design |
| SECTION_CANDIDATES_COUNT → STRUCTURED_RESUME_COUNT | tools | 2 | Figma; Illustrator; Photoshop |
| STRUCTURED_RESUME_COUNT → RESUME_DATA_COUNT | clients | 2 | Brand; Paris |
| NORMALIZED_TEXT_COUNT → SECTION_CANDIDATES_COUNT | portfolio | 1 | https://alexbrand.design |
| SECTION_CANDIDATES_COUNT → STRUCTURED_RESUME_COUNT | summary | 1 | Nike · Adobe · Spotify · Airbnb |
| SECTION_CANDIDATES_COUNT → STRUCTURED_RESUME_COUNT | education | 1 | — |
| SECTION_CANDIDATES_COUNT → STRUCTURED_RESUME_COUNT | languages | 1 | French — conversational |
| STRUCTURED_RESUME_COUNT → RESUME_DATA_COUNT | identity | 1 | — |
| RESUME_DATA_COUNT → FINAL_RESUME_DATA_COUNT | summary | 1 | Brand and interface designer crafting visual systems for global clients. Nike · Adobe · Spotify · Airbnb Nike Air Max campaign — packaging and retail visuals Adobe Creative Cloud rebrand — UI design system D&AD Pencil — Brand identity · 2022 |

### clients — stage detail

| Stage | Count | Examples (first 5) | Lost from previous |
| --- | ---: | --- | --- |
| RAW_TEXT_COUNT | 4 | Nike; Adobe; Spotify | — |
| NORMALIZED_TEXT_COUNT | 0 | — | Nike; Adobe; Spotify |
| SECTION_CANDIDATES_COUNT | 0 | — | — |
| STRUCTURED_RESUME_COUNT | 6 | Adobe; Nike; Spotify | — |
| RESUME_DATA_COUNT | 4 | Nike; Spotify; Adobe | Brand; Paris |
| FINAL_RESUME_DATA_COUNT | 4 | Nike; Spotify; Adobe | — |
| RENDERED_DOM_COUNT | 4 | Nike; Spotify; Adobe | — |

### projects — stage detail

| Stage | Count | Examples (first 5) | Lost from previous |
| --- | ---: | --- | --- |
| RAW_TEXT_COUNT | 2 | Nike Air Max campaign — packaging and retail visuals; Adobe Creative Cloud rebrand — UI design system | — |
| NORMALIZED_TEXT_COUNT | 2 | Nike Air Max campaign — packaging and retail visuals; Adobe Creative Cloud rebrand — UI design system | — |
| SECTION_CANDIDATES_COUNT | 2 | Nike Air Max campaign — packaging and retail visuals; Adobe Creative Cloud rebrand — UI design system | — |
| STRUCTURED_RESUME_COUNT | 3 | packaging and retail visuals — Nike; UI design system — Adobe; D&AD Pencil — Brand identity · 2022 | — |
| RESUME_DATA_COUNT | 3 | packaging and retail visuals — Nike; UI design system — Adobe; D&AD Pencil — Brand identity · 2022 | — |
| FINAL_RESUME_DATA_COUNT | 3 | packaging and retail visuals — Nike; UI design system — Adobe; D&AD Pencil — Brand identity · 2022 | — |
| RENDERED_DOM_COUNT | 3 | packaging and retail visuals — Nike; UI design system — Adobe; D&AD Pencil — Brand identity · 2022 | — |

### experience — stage detail

| Stage | Count | Examples (first 5) | Lost from previous |
| --- | ---: | --- | --- |
| RAW_TEXT_COUNT | 10 | Senior Brand Designer; Studio North; 2019 — Present | — |
| NORMALIZED_TEXT_COUNT | 10 | Senior Brand Designer; Studio North; 2019 — Present | — |
| SECTION_CANDIDATES_COUNT | 4 | Senior Brand Designer; Studio North; 2019 — Present | Solo show — Galerie Perrotin, Paris · 2023 |
| STRUCTURED_RESUME_COUNT | 10 | Digital Design — ADC Young Guns — 2021–Present; d&ad Pencil — Brand identity — 2022–Present; Adc Young Guns — Digital design — 2021–Present | — |
| RESUME_DATA_COUNT | 3 | Digital Design — ADC Young Guns — 2021–Present; d&ad Pencil — Brand identity — 2022–Present; Studio North — 2019 — 2019–2019 | Solo Show — Galerie Perrotin, Paris — 2023–Present; Designer — 2019–Present |
| FINAL_RESUME_DATA_COUNT | 3 | Digital Design — ADC Young Guns — 2021–Present; d&ad Pencil — Brand identity — 2022–Present; Studio North — 2019 — 2019–2019 | — |
| RENDERED_DOM_COUNT | 3 | Digital Design - ADC Young Guns - 2021-Present; d&ad Pencil - Brand identity - 2022-Present; Studio North - 2019 - 2019-2019 | — |

### skills — stage detail

| Stage | Count | Examples (first 5) | Lost from previous |
| --- | ---: | --- | --- |
| RAW_TEXT_COUNT | 4 | Branding; UI Design; Typography | — |
| NORMALIZED_TEXT_COUNT | 4 | Branding; UI Design; Typography | — |
| SECTION_CANDIDATES_COUNT | 4 | Branding; UI Design; Typography | — |
| STRUCTURED_RESUME_COUNT | 4 | Branding; UI Design; Typography | — |
| RESUME_DATA_COUNT | 5 | Graphic Design; Brand Identity; Typography | Packaging |
| FINAL_RESUME_DATA_COUNT | 6 | Graphic Design; Packaging; Brand Identity | — |
| RENDERED_DOM_COUNT | 9 | Graphic Design; Packaging; Brand Identity | — |

## How to read

- **lostExamples** on a stage = items present in the previous stage but missing here.
- The stage with the largest drop for a section is where content disappears.

```bash
npm run test:data-retention-trace
```
