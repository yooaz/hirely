# EXPERIENCE RECOVERY REPORT

Generated: 2026-06-10T16:17:14.379Z

## Goal

Creative CVs were losing **70%+ of experience** when client brands and stacked roles collapsed into a single freelance line.

Target engagements: **Freelance**, **Agency**, **Illustration**, **Design**, **Creative Director**, **Art Director**.

Anchor clients: **Nike**, **Adobe**, **PlayStation**, **Marvel**, **Converse**, **Cadillac**, **Fortune**, **Visa**, **Arte**.

Each entry keeps separate fields: `company` · `client` · `project` · `role` · `date` — **never collapsed**.

## CREATIVE_EXPERIENCE_RECOVERY_ENGINE

Engine: `CREATIVE_EXPERIENCE_RECOVERY_ENGINE` · wired in `section-engine-v2.js` when creative mode is active.

- Segments merged OCR/freelance blobs via `EXPERIENCE_SEGMENTATION_ENGINE`
- Expands multi-brand freelance bullets into distinct client engagements
- Enriches `engagementType`: freelance | agency | illustration | design | creative_director | art_director

### Creative fixture audit

| Metric | Value |
|--------|------:|
| Source career lines | 11 |
| Recovered experiences | 35 |
| Anchor recall | 100% |
| Pipeline experiences | 48 |
| Expanded client engagements | 100 |

**Anchor brands found:** Nike, Adobe, PlayStation, Marvel, Converse, Cadillac, Fortune, Visa, Arte

| Role | Company | Client | Project | Dates | Type |
|------|---------|--------|---------|-------|------|
| Independent / Freelance | Independent / Freelance |  |  | 2011–Present | freelance |
| Art Director | McCann Paris | McCann |  | 2018–2020 | art_director |
| Creative Director | BETC Agency |  |  | 2020–2023 | creative_director |
| Illustration | Nike projects | Nike | Nike projects | 2016–2020 | illustration |
| Design | 2021 Illustrator / Art Director Creative illustrator and designer with agency and freelance experience for global brands. |  |  | 2019–2021 | art_director |
| Design | Adobe | Adobe |  | 2019–2021 | design |
| Independent / Freelance | Nike | Nike |  | 2011–Present | freelance |
| Independent / Freelance | Converse | Converse |  | 2011–Present | freelance |
| Independent / Freelance | Marvel | Marvel |  | 2011–Present | freelance |
| Independent / Freelance | Cadillac | Cadillac |  | 2011–Present | freelance |
| Independent / Freelance | Fortune | Fortune |  | 2011–Present | freelance |
| Independent / Freelance | PlayStation | PlayStation |  | 2011–Present | freelance |
| Independent / Freelance | McCann | McCann |  | 2011–Present | freelance |
| Independent / Freelance | Arte | Arte |  | 2011–Present | freelance |
| Independent / Freelance | Adobe | Adobe |  | 2011–Present | freelance |
| Independent / Freelance | Visa | Visa |  | 2011–Present | freelance |
| Illustration | Nike | Nike |  | 2016–2020 | illustration |
| Illustration | Converse | Converse |  | 2016–2020 | illustration |
| Illustration | Marvel | Marvel |  | 2016–2020 | illustration |
| Illustration | Cadillac | Cadillac |  | 2016–2020 | illustration |
| Illustration | Fortune | Fortune |  | 2016–2020 | illustration |
| Illustration | PlayStation | PlayStation |  | 2016–2020 | illustration |
| Illustration | McCann | McCann |  | 2016–2020 | illustration |
| Illustration | Arte | Arte |  | 2016–2020 | illustration |

### Creative QA

**PASS**
 · Pipeline experiences: 48 · Segmented: 5

## Recovery policy (legacy safe parsers)

- **Safe recover only:** strict parsers with confidence ≥ 70
- Sources: `parseFreelanceCareerLine`, `parseInternshipLine`, merged `parseStrictExperiencesFromLines`
- Fixes: merge strict experiences even when freelance exists; recover before polish client-drain; `recoverSafeParsedExperiences` in structured + polish + auto-accept

## Summary

| Source | structured | resumeData | cvData | Lost at stage |
|--------|----------:|-----------:|-------:|---------------|
| Yoaz OCR | 21 | 12 | 12 | 1 safe candidates not in cvData |
| Yoaz fixture (clean) | 32 | 12 | 12 | 0 safe candidates not in cvData |

## Yoaz OCR

| Stage | Count |
|-------|------:|
| OCR lines | 42 |
| Document blocks | 0 |
| structuredResume.experiences | 21 |
| resumeData.experiences | 12 |
| cvData.experience | 12 |
| Safe recovery candidates (dry-run) | 2 |

### Experience trace

| # | Markers | Source line | Block | structured | resumeData | cvData | Loss point |
|--:|---------|-------------|:-----:|:----------:|:----------:|:------:|------------|
| 1 | Illustrator | v3 2 GRADRIC designer & Illustrator | — | ✗ | ✗ | ✗ | not_parsed_as_experience |
| 2 | Freelancer, Graphic Designer, Illustrator | 30-year old Illustrator and graphic 2011-2022 : Freelanc… | — | ✓ | ✗ | ✓ | no_matching_document_block; dropped_structured_to_resumeData |
| 3 | Internship, McCann | 20N : McCann G. Agency (Internship) | — | ✗ | ✗ | ✓ | no_matching_document_block; internship_not_merged_before_structured_finalize |
| 4 |  | +33649434839 2011 2012 : LISAA, web and motion design | — | ✗ | ✗ | ✗ | not_parsed_as_experience |
| 5 |  | 2009 20M : Créapole, creation school management | — | ✗ | ✗ | ✗ | not_parsed_as_experience |
| 6 |  | Ic) yoaz27 2008 2009 : Créapole creation school manageme… | — | ✗ | ✗ | ✗ | not_parsed_as_experience |
| 7 |  | 2007 2009 : Créapole creation school management | — | ✗ | ✗ | ✗ | not_parsed_as_experience |
| 8 | strict_parser | Freelance Illustrator and graphic @ Independent / Freela… | — | ✗ | ✗ | ✓ | no_matching_document_block; strict_parser_skipped_when_experiences_nonempty |
| 9 | strict_parser | @ Man Visual Communication @  | — | ✗ | ✗ | ✗ | no_matching_document_block; strict_parser_skipped_when_experiences_nonempty |

### Trace detail

#### 1. Illustrator

**Source line**
```
v3 2 GRADRIC designer & Illustrator
```

**Pipeline presence**

| structuredResume | **LOST** |
| resumeData | **LOST** |
| cvData | **LOST** |

**Loss reason:** not_parsed_as_experience

#### 2. Freelancer · Graphic Designer · Illustrator

**Source line**
```
30-year old Illustrator and graphic 2011-2022 : Freelancer Illustrator, Graphic designer : Posters, packaging.
```

| Parsed | Value |
|--------|-------|
| Parser | parseFreelanceCareerLine |
| Role | Freelance 30-year old Illustrator and graphic |
| Company | Independent / Freelance |
| Dates | 2011–2022 |
| Confidence | 100 |
| Safe recover | yes |

**Pipeline presence**

| structuredResume | present |
| resumeData | **LOST** |
| cvData | present |

**Loss reason:** no_matching_document_block; dropped_structured_to_resumeData

#### 3. Internship · McCann

**Source line**
```
20N : McCann G. Agency (Internship)
```

| Parsed | Value |
|--------|-------|
| Parser | parseInternshipLine |
| Role | designer |
| Company | McCann G. Agency |
| Dates | 2011–2014 |
| Confidence | 74 |
| Safe recover | yes |

**Pipeline presence**

| structuredResume | **LOST** |
| resumeData | **LOST** |
| cvData | present |

**Loss reason:** no_matching_document_block; internship_not_merged_before_structured_finalize

#### 4. candidate

**Source line**
```
+33649434839 2011 2012 : LISAA, web and motion design
```

**Pipeline presence**

| structuredResume | **LOST** |
| resumeData | **LOST** |
| cvData | **LOST** |

**Loss reason:** not_parsed_as_experience

#### 5. candidate

**Source line**
```
2009 20M : Créapole, creation school management
```

**Pipeline presence**

| structuredResume | **LOST** |
| resumeData | **LOST** |
| cvData | **LOST** |

**Loss reason:** not_parsed_as_experience

#### 6. candidate

**Source line**
```
Ic) yoaz27 2008 2009 : Créapole creation school management
```

**Pipeline presence**

| structuredResume | **LOST** |
| resumeData | **LOST** |
| cvData | **LOST** |

**Loss reason:** not_parsed_as_experience

#### 7. candidate

**Source line**
```
2007 2009 : Créapole creation school management
```

**Pipeline presence**

| structuredResume | **LOST** |
| resumeData | **LOST** |
| cvData | **LOST** |

**Loss reason:** not_parsed_as_experience

#### 8. strict_parser

**Source line**
```
Freelance Illustrator and graphic @ Independent / Freelance
```

| Parsed | Value |
|--------|-------|
| Parser | parseStrictExperiencesFromLines |
| Role | Freelance Illustrator and graphic |
| Company | Independent / Freelance |
| Dates | 2011–2022 |
| Confidence | 100 |
| Safe recover | yes |

**Pipeline presence**

| structuredResume | **LOST** |
| resumeData | **LOST** |
| cvData | present |

**Loss reason:** no_matching_document_block; strict_parser_skipped_when_experiences_nonempty

#### 9. strict_parser

**Source line**
```
@ Man Visual Communication @ 
```

| Parsed | Value |
|--------|-------|
| Parser | parseStrictExperiencesFromLines |
| Role | @ Man Visual Communication |
| Company | — |
| Dates | 2009–Present |
| Confidence | 88 |
| Safe recover | yes |

**Pipeline presence**

| structuredResume | **LOST** |
| resumeData | **LOST** |
| cvData | **LOST** |

**Loss reason:** no_matching_document_block; strict_parser_skipped_when_experiences_nonempty

### Safe recovery (applied in pipeline)

- **Freelance 30-year old Illustrator and graphic** @ Independent / Freelance (2011–2022) — conf 100 — `parseFreelanceCareerLine`
- **designer** @ McCann G. Agency (2011–2014) — conf 74 — `parseInternshipLine`

### Final experiences in resumeData

1. **Freelance Illustrator / Graphic Designer** @ Independent / Freelance (2011–2022)
   - source: `30-year old Illustrator and graphic 2011-2022 : Freelancer Illustrator, Graphic designer : Posters, `
2. **Internship** @ McCann G. Agency (Internship) (2011–Present)
   - source: `30-year old Illustrator and graphic 2011-2022 : Freelancer Illustrator, Graphic designer : Posters, `
3. **2011** @ Company à confirmer (2011–Present)
   - source: `30-year old Illustrator and graphic 2011-2022 : Freelancer Illustrator, Graphic designer : Posters, `
4. **2011** @ 2022 (2011–2022)
   - source: `30-year old Illustrator and graphic 2011-2022 : Freelancer Illustrator, Graphic designer : Posters, `
5. **Graphic Designer** @ Nike (2011–2022)
   - source: `30-year old Illustrator and graphic 2011-2022 : Freelancer Illustrator, Graphic designer : Posters, `
6. **Graphic Designer** @ Converse (2011–2022)
   - source: `30-year old Illustrator and graphic 2011-2022 : Freelancer Illustrator, Graphic designer : Posters, `
7. **Graphic Designer** @ Louis Vuitton (2011–2022)
   - source: `30-year old Illustrator and graphic 2011-2022 : Freelancer Illustrator, Graphic designer : Posters, `
8. **Graphic Designer** @ Marvel (2011–2022)
   - source: `30-year old Illustrator and graphic 2011-2022 : Freelancer Illustrator, Graphic designer : Posters, `
9. **Graphic Designer** @ Fortune (2011–2022)
   - source: `30-year old Illustrator and graphic 2011-2022 : Freelancer Illustrator, Graphic designer : Posters, `
10. **Graphic Designer** @ McCann (2011–2022)
   - source: `30-year old Illustrator and graphic 2011-2022 : Freelancer Illustrator, Graphic designer : Posters, `
11. **Graphic Designer** @ Arte (2011–2022)
   - source: `30-year old Illustrator and graphic 2011-2022 : Freelancer Illustrator, Graphic designer : Posters, `
12. **Graphic Designer** @ Pantone (2011–2022)
   - source: `30-year old Illustrator and graphic 2011-2022 : Freelancer Illustrator, Graphic designer : Posters, `

## Yoaz fixture (clean)

| Stage | Count |
|-------|------:|
| OCR lines | 57 |
| Document blocks | 0 |
| structuredResume.experiences | 32 |
| resumeData.experiences | 12 |
| cvData.experience | 12 |
| Safe recovery candidates (dry-run) | 2 |

### Experience trace

| # | Markers | Source line | Block | structured | resumeData | cvData | Loss point |
|--:|---------|-------------|:-----:|:----------:|:----------:|:------:|------------|
| 1 | Graphic Designer, Illustrator | Graphic Designer & Illustrator | — | ✗ | ✗ | ✗ | not_parsed_as_experience |
| 2 | Freelancer, Graphic Designer, Illustrator | Freelance Illustrator / Graphic Designer | — | ✗ | ✗ | ✗ | not_parsed_as_experience |
| 3 | Freelancer | Independent / Freelance · 2011 — Present | — | ✗ | ✗ | ✓ | no_matching_document_block; strict_parser_skipped_when_experiences_nonempty |
| 4 | McCann | - Collaborated with recognized brands including Nike, Lo… | — | ✗ | ✗ | ✗ | not_parsed_as_experience |
| 5 | McCann | McCann Paris | — | ✗ | ✗ | ✗ | not_parsed_as_experience |
| 6 | Illustrator | Lead Illustrator · 2011 — 2014 | — | ✗ | ✗ | ✗ | not_parsed_as_experience |
| 7 | Art Director | Art Director — Illustration · 2014 — 2016 | — | ✗ | ✗ | ✗ | not_parsed_as_experience |
| 8 | Freelancer | - Managed freelance illustrators on seasonal brand pushe… | — | ✗ | ✗ | ✗ | not_parsed_as_experience |
| 9 | Illustrator | Senior Illustrator · 2016 — 2018 | — | ✗ | ✗ | ✗ | not_parsed_as_experience |
| 10 | Freelancer, Art Director | Freelance — Senior Art Director | — | ✗ | ✗ | ✗ | not_parsed_as_experience |
| 11 |  | Independent · 2018 — 2020 | — | ✗ | ✗ | ✗ | not_parsed_as_experience |
| 12 | Illustrator | Illustrator / Designer · 2020 — 2021 | — | ✓ | ✗ | ✓ | no_matching_document_block; dropped_structured_to_resumeData |
| 13 |  | Visual Designer · 2021 — 2022 | — | ✗ | ✗ | ✗ | not_parsed_as_experience |
| 14 |  | Lead Visual Designer · 2022 — 2023 | — | ✗ | ✗ | ✗ | not_parsed_as_experience |
| 15 |  | Creative Director · 2023 — Present | — | ✗ | ✗ | ✗ | not_parsed_as_experience |
| 16 | Illustrator | Photoshop, Illustrator, InDesign, Affinity Designer, Ado… | — | ✗ | ✗ | ✗ | not_parsed_as_experience |
| 17 | strict_parser | Freelance · @ Independent / Freelance | — | ✗ | ✗ | ✓ | no_matching_document_block; strict_parser_skipped_when_experiences_nonempty |
| 18 | strict_parser | Illustrator @ McCann Paris | — | ✗ | ✗ | ✓ | no_matching_document_block; internship_not_merged_before_structured_finalize |
| 19 | strict_parser | Art Director @ Publicis Conseil | — | ✗ | ✗ | ✓ | no_matching_document_block; strict_parser_skipped_when_experiences_nonempty |
| 20 | strict_parser | Illustrator @ Havas Paris | — | ✗ | ✗ | ✓ | no_matching_document_block; strict_parser_skipped_when_experiences_nonempty |
| 21 | strict_parser | Freelance @ Independent / Freelance | — | ✗ | ✗ | ✓ | no_matching_document_block; strict_parser_skipped_when_experiences_nonempty |
| 22 | strict_parser | Designer @ DDB Paris | — | ✗ | ✗ | ✓ | no_matching_document_block; strict_parser_skipped_when_experiences_nonempty |
| 23 | strict_parser | Designer @ AKQA Paris | — | ✗ | ✗ | ✓ | no_matching_document_block; strict_parser_skipped_when_experiences_nonempty |
| 24 | strict_parser | Creative Director @ Studio Yoaz | — | ✗ | ✗ | ✓ | no_matching_document_block; strict_parser_skipped_when_experiences_nonempty |

### Trace detail

#### 1. Graphic Designer · Illustrator

**Source line**
```
Graphic Designer & Illustrator
```

**Pipeline presence**

| structuredResume | **LOST** |
| resumeData | **LOST** |
| cvData | **LOST** |

**Loss reason:** not_parsed_as_experience

#### 2. Freelancer · Graphic Designer · Illustrator

**Source line**
```
Freelance Illustrator / Graphic Designer
```

**Pipeline presence**

| structuredResume | **LOST** |
| resumeData | **LOST** |
| cvData | **LOST** |

**Loss reason:** not_parsed_as_experience

#### 3. Freelancer

**Source line**
```
Independent / Freelance · 2011 — Present
```

| Parsed | Value |
|--------|-------|
| Parser | parseFreelanceCareerLine |
| Role | Independent / Freelance · |
| Company | Independent / Freelance |
| Dates | 2011–Present |
| Confidence | 100 |
| Safe recover | yes |

**Pipeline presence**

| structuredResume | **LOST** |
| resumeData | **LOST** |
| cvData | present |

**Loss reason:** no_matching_document_block; strict_parser_skipped_when_experiences_nonempty

#### 4. McCann

**Source line**
```
- Collaborated with recognized brands including Nike, Louis Vuitton, Marvel, Cadillac, Fortune, Converse, Pantone, Adobe, Arte and McCann.
```

**Pipeline presence**

| structuredResume | **LOST** |
| resumeData | **LOST** |
| cvData | **LOST** |

**Loss reason:** not_parsed_as_experience

#### 5. McCann

**Source line**
```
McCann Paris
```

**Pipeline presence**

| structuredResume | **LOST** |
| resumeData | **LOST** |
| cvData | **LOST** |

**Loss reason:** not_parsed_as_experience

#### 6. Illustrator

**Source line**
```
Lead Illustrator · 2011 — 2014
```

**Pipeline presence**

| structuredResume | **LOST** |
| resumeData | **LOST** |
| cvData | **LOST** |

**Loss reason:** not_parsed_as_experience

#### 7. Art Director

**Source line**
```
Art Director — Illustration · 2014 — 2016
```

**Pipeline presence**

| structuredResume | **LOST** |
| resumeData | **LOST** |
| cvData | **LOST** |

**Loss reason:** not_parsed_as_experience

#### 8. Freelancer

**Source line**
```
- Managed freelance illustrators on seasonal brand pushes.
```

**Pipeline presence**

| structuredResume | **LOST** |
| resumeData | **LOST** |
| cvData | **LOST** |

**Loss reason:** not_parsed_as_experience

#### 9. Illustrator

**Source line**
```
Senior Illustrator · 2016 — 2018
```

**Pipeline presence**

| structuredResume | **LOST** |
| resumeData | **LOST** |
| cvData | **LOST** |

**Loss reason:** not_parsed_as_experience

#### 10. Freelancer · Art Director

**Source line**
```
Freelance — Senior Art Director
```

**Pipeline presence**

| structuredResume | **LOST** |
| resumeData | **LOST** |
| cvData | **LOST** |

**Loss reason:** not_parsed_as_experience

#### 11. candidate

**Source line**
```
Independent · 2018 — 2020
```

**Pipeline presence**

| structuredResume | **LOST** |
| resumeData | **LOST** |
| cvData | **LOST** |

**Loss reason:** not_parsed_as_experience

#### 12. Illustrator

**Source line**
```
Illustrator / Designer · 2020 — 2021
```

| Parsed | Value |
|--------|-------|
| Parser | parseFreelanceCareerLine |
| Role | Illustrator / Designer · |
| Company | Independent / Freelance |
| Dates | 2020–2021 |
| Confidence | 100 |
| Safe recover | yes |

**Pipeline presence**

| structuredResume | present |
| resumeData | **LOST** |
| cvData | present |

**Loss reason:** no_matching_document_block; dropped_structured_to_resumeData

#### 13. candidate

**Source line**
```
Visual Designer · 2021 — 2022
```

**Pipeline presence**

| structuredResume | **LOST** |
| resumeData | **LOST** |
| cvData | **LOST** |

**Loss reason:** not_parsed_as_experience

#### 14. candidate

**Source line**
```
Lead Visual Designer · 2022 — 2023
```

**Pipeline presence**

| structuredResume | **LOST** |
| resumeData | **LOST** |
| cvData | **LOST** |

**Loss reason:** not_parsed_as_experience

#### 15. candidate

**Source line**
```
Creative Director · 2023 — Present
```

**Pipeline presence**

| structuredResume | **LOST** |
| resumeData | **LOST** |
| cvData | **LOST** |

**Loss reason:** not_parsed_as_experience

#### 16. Illustrator

**Source line**
```
Photoshop, Illustrator, InDesign, Affinity Designer, Adobe Creative Suite
```

**Pipeline presence**

| structuredResume | **LOST** |
| resumeData | **LOST** |
| cvData | **LOST** |

**Loss reason:** not_parsed_as_experience

#### 17. strict_parser

**Source line**
```
Freelance · @ Independent / Freelance
```

| Parsed | Value |
|--------|-------|
| Parser | parseStrictExperiencesFromLines |
| Role | Freelance · |
| Company | Independent / Freelance |
| Dates | 2011–Present |
| Confidence | 100 |
| Safe recover | yes |

**Pipeline presence**

| structuredResume | **LOST** |
| resumeData | **LOST** |
| cvData | present |

**Loss reason:** no_matching_document_block; strict_parser_skipped_when_experiences_nonempty

#### 18. strict_parser

**Source line**
```
Illustrator @ McCann Paris
```

| Parsed | Value |
|--------|-------|
| Parser | parseStrictExperiencesFromLines |
| Role | Illustrator |
| Company | McCann Paris |
| Dates | 2011–2014 |
| Confidence | 100 |
| Safe recover | yes |

**Pipeline presence**

| structuredResume | **LOST** |
| resumeData | **LOST** |
| cvData | present |

**Loss reason:** no_matching_document_block; internship_not_merged_before_structured_finalize

#### 19. strict_parser

**Source line**
```
Art Director @ Publicis Conseil
```

| Parsed | Value |
|--------|-------|
| Parser | parseStrictExperiencesFromLines |
| Role | Art Director |
| Company | Publicis Conseil |
| Dates | 2014–2016 |
| Confidence | 100 |
| Safe recover | yes |

**Pipeline presence**

| structuredResume | **LOST** |
| resumeData | **LOST** |
| cvData | present |

**Loss reason:** no_matching_document_block; strict_parser_skipped_when_experiences_nonempty

#### 20. strict_parser

**Source line**
```
Illustrator @ Havas Paris
```

| Parsed | Value |
|--------|-------|
| Parser | parseStrictExperiencesFromLines |
| Role | Illustrator |
| Company | Havas Paris |
| Dates | 2016–2018 |
| Confidence | 100 |
| Safe recover | yes |

**Pipeline presence**

| structuredResume | **LOST** |
| resumeData | **LOST** |
| cvData | present |

**Loss reason:** no_matching_document_block; strict_parser_skipped_when_experiences_nonempty

#### 21. strict_parser

**Source line**
```
Freelance @ Independent / Freelance
```

| Parsed | Value |
|--------|-------|
| Parser | parseStrictExperiencesFromLines |
| Role | Freelance |
| Company | Independent / Freelance |
| Dates | 2018–2020 |
| Confidence | 100 |
| Safe recover | yes |

**Pipeline presence**

| structuredResume | **LOST** |
| resumeData | **LOST** |
| cvData | present |

**Loss reason:** no_matching_document_block; strict_parser_skipped_when_experiences_nonempty

#### 22. strict_parser

**Source line**
```
Designer @ DDB Paris
```

| Parsed | Value |
|--------|-------|
| Parser | parseStrictExperiencesFromLines |
| Role | Designer |
| Company | DDB Paris |
| Dates | 2021–2022 |
| Confidence | 100 |
| Safe recover | yes |

**Pipeline presence**

| structuredResume | **LOST** |
| resumeData | **LOST** |
| cvData | present |

**Loss reason:** no_matching_document_block; strict_parser_skipped_when_experiences_nonempty

#### 23. strict_parser

**Source line**
```
Designer @ AKQA Paris
```

| Parsed | Value |
|--------|-------|
| Parser | parseStrictExperiencesFromLines |
| Role | Designer |
| Company | AKQA Paris |
| Dates | 2022–2023 |
| Confidence | 100 |
| Safe recover | yes |

**Pipeline presence**

| structuredResume | **LOST** |
| resumeData | **LOST** |
| cvData | present |

**Loss reason:** no_matching_document_block; strict_parser_skipped_when_experiences_nonempty

#### 24. strict_parser

**Source line**
```
Creative Director @ Studio Yoaz
```

| Parsed | Value |
|--------|-------|
| Parser | parseStrictExperiencesFromLines |
| Role | Creative Director |
| Company | Studio Yoaz |
| Dates | 2023–Present |
| Confidence | 100 |
| Safe recover | yes |

**Pipeline presence**

| structuredResume | **LOST** |
| resumeData | **LOST** |
| cvData | present |

**Loss reason:** no_matching_document_block; strict_parser_skipped_when_experiences_nonempty

### Safe recovery (applied in pipeline)

- **Independent / Freelance ·** @ Independent / Freelance (2011–Present) — conf 100 — `parseFreelanceCareerLine`
- **Illustrator / Designer ·** @ Independent / Freelance (2020–2021) — conf 100 — `parseFreelanceCareerLine`

### Final experiences in resumeData

1. **Art Director Independent** @ Art Director Independent (2018–2020)
2. **Freelance Illustrator Freelance** @ Freelance Illustrator Freelance (2016–2018)
   - source: `Senior Illustrator · 2016 — 2018`
3. **Illustrator / Designer** @ Independent / Freelance (2020–2021)
   - source: `Illustrator / Designer · 2020 — 2021`
4. **Designer** @ Independent / Freelance (2022–2023)
   - source: `Lead Visual Designer · 2022 — 2023`
5. **2011** @ Present (2011–Present)
   - source: `Independent / Freelance · 2011 — Present`
6. **2011** @ 2014 (2011–2014)
   - source: `Independent / Freelance · 2011 — Present`
7. **2014** @ market advertising. Publicis Conseil Art Director (2014–2016)
8. **2014** @ 2016 (2014–2016)
9. **2016** @ 2018 (2016–2018)
   - source: `Senior Illustrator · 2016 — 2018`
10. **Designer** @ 2021 (2021–2022)
   - source: `Visual Designer · 2021 — 2022`
11. **Creative Director** @ 2023 (2023–Present)
12. **Freelance Professional** @ Freelance Professional (2011–Present)
   - source: `Independent / Freelance · 2011 — Present`

## Known OCR limits (Yoaz PDF)

- OCR text collapses multiple jobs into one freelance line (`2011-2022 : Freelancer Illustrator, Graphic designer`).
- McCann internship line (`20N : McCann G. Agency (Internship)`) is recoverable via `parseInternshipLine` (date repaired → 2010).
- Art Director / Motion Designer rows exist only in clean fixture — not in OCR output.
