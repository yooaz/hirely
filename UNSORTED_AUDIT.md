# UNSORTED AUDIT — Yoaz PDF (Noise Engine)

Generated: 2026-06-06T11:41:26.692Z
Source: `TRACE_YOAZ_PIPELINE.json`

> Audit only — classify unsorted lines. No fixes applied.

## Classification rules

| Class | Criteria |
|-------|----------|
| **VALID** | Real words + real entities (schools, clients, roles, skills, languages) or strong dictionary match |
| **LOW_CONFIDENCE** | Partial OCR — meaningful fragments with corruption, merged fields, or weak match |
| **GARBAGE** | `v38 A`, `LEA`, random fragments, symbol noise, known OCR corruption (`ee à`, `Mustrator`, `incesion`) |

## Counts summary

| Dataset | Total | VALID | LOW_CONFIDENCE | GARBAGE |
|---------|------:|------:|---------------:|--------:|
| STRUCTURED_RESUME.unsorted | 40 | 23 | 7 | 10 |
| RESUME_DATA.unsorted | 2 | 1 | 1 | 0 |
| ALL_UNIQUE (structured + final) | 40 | 23 | 7 | 10 |

## STRUCTURED_RESUME.unsorted (40 items)

VALID **23** · LOW_CONFIDENCE **7** · GARBAGE **10**

| # | Class | Score | Reason | Text |
|--:|-------|------:|--------|------|
| 1 | GARBAGE | 38 | known_fragment | ee à |
| 2 | GARBAGE | 38 | known_fragment | A A TN |
| 3 | LOW_CONFIDENCE | 55 | low_ocr_confidence, known_garbage | v3 2 GRADRIC designer & Illustrator |
| 4 | GARBAGE | 38 | known_fragment | _— pe |
| 5 | VALID | 100 | dictionary_words | 30-year old Illustrator and graphic 2011-2022 : Freelancer Illustrator, Graphic designer : Posters, … |
| 6 | VALID | 79 | rich_vocabulary | designer edition, logos... |
| 7 | VALID | 100 | dictionary_words | (Nike Louis Vuitton, Marvel Cadillec, Fortune, Converse |
| 8 | VALID | 100 | dictionary_words | Pantone, Adobe, Arte and more) |
| 9 | VALID | 79 | rich_vocabulary | 20N : McCann G. Agency (Internship) |
| 10 | GARBAGE | 41 | known_fragment | RS Phone: |
| 11 | VALID | 100 | dictionary_words | +33649434839 2011 2012 : LISAA, web and motion design |
| 12 | VALID | 100 | dictionary_education | 2009 20M : Créapole, creation school management |
| 13 | LOW_CONFIDENCE | 44 | low_ocr_confidence, known_garbage | @ man visual communication |
| 14 | VALID | 100 | dictionary_languages | yoaz@hotmail fr (typography, visuel identity, corporate identity. |
| 15 | VALID | 82 | rich_vocabulary | packaging. poster, logos, web design, illustrations. |
| 16 | VALID | 82 | rich_vocabulary | editions, client analyse, target customer, art history |
| 17 | VALID | 82 | rich_vocabulary | » Be.net/yoaz marketing, technologie, marketing studies |
| 18 | GARBAGE | 70 | junk_fragment | Ic) yoaz27 2008 2009 : Créapole creation school management |
| 19 | GARBAGE | 58 | ocr_corruption | ign fin hie. je |
| 20 | GARBAGE | 82 | ocr_corruption | Q voaz.tumblr com product design (infographie, ergonomie, extern |
| 21 | VALID | 79 | rich_vocabulary | observation, maquette, packaging.) |
| 22 | VALID | 100 | dictionary_education | 2007 2009 : Créapole creation school management |
| 23 | VALID | 82 | rich_vocabulary | multisectoral year {visual communication |
| 24 | VALID | 82 | rich_vocabulary | product design, video game, architecture} |
| 25 | VALID | 100 | dictionary_languages | French: native |
| 26 | GARBAGE | 61 | known_fragment | Photograph: |
| 27 | VALID | 100 | dictionary_words | English: fluent Ps] photoshop EEE CTT |
| 28 | GARBAGE | 44 | ocr_corruption | Mustrator RE scowboscc |
| 29 | GARBAGE | 61 | ocr_corruption | [6] incesion me SE |
| 30 | VALID | 61 | language_or_interest | Drawing |
| 31 | VALID | 82 | rich_vocabulary | Iustration, Graphic design, Movies |
| 32 | VALID | 82 | rich_vocabulary | Print, Logo, Vector, Art... Reading |
| 33 | VALID | 45 | language_or_interest | Music |
| 34 | VALID | 61 | language_or_interest | Nature |
| 35 | LOW_CONFIDENCE | 55 | low_ocr_confidence, known_garbage | ee à A A TN v3 2 GRADRIC designer & Illustrator |
| 36 | VALID | 100 | dictionary_education | 2009 20M : Créapole, creation school management @ man visual communication |
| 37 | LOW_CONFIDENCE | 76 | partial_ocr_or_unclassified | visuel identity |
| 38 | LOW_CONFIDENCE | 76 | partial_ocr_or_unclassified | corporate identity. |
| 39 | LOW_CONFIDENCE | 45 | few_dictionary_words, low_ocr_confidence | logos |
| 40 | LOW_CONFIDENCE | 61 | few_dictionary_words, low_ocr_confidence | illustrations. |

## RESUME_DATA.unsorted (2 items)

VALID **1** · LOW_CONFIDENCE **1** · GARBAGE **0**

| # | Class | Score | Reason | Text |
|--:|-------|------:|--------|------|
| 1 | LOW_CONFIDENCE | 44 | low_ocr_confidence, known_garbage | @ man visual communication |
| 2 | VALID | 61 | language_or_interest | Drawing |

## ALL_UNIQUE — full classification

### VALID (23)

- **30-year old Illustrator and graphic 2011-2022 : Freelancer Illustrator, Graphic designer : Posters, packaging.**
  - reason: dictionary_words; score: 100; entities: unknown:Illustrator,Graphic Designer
- **designer edition, logos...**
  - reason: rich_vocabulary; score: 79; entities: none
- **(Nike Louis Vuitton, Marvel Cadillec, Fortune, Converse**
  - reason: dictionary_words; score: 100; entities: unknown:Nike,Louis Vuitton,Marvel
- **Pantone, Adobe, Arte and more)**
  - reason: dictionary_words; score: 100; entities: unknown:Pantone,Adobe
- **20N : McCann G. Agency (Internship)**
  - reason: rich_vocabulary; score: 79; entities: none
- **+33649434839 2011 2012 : LISAA, web and motion design**
  - reason: dictionary_words; score: 100; entities: unknown:LISAA,Motion Designer
- **2009 20M : Créapole, creation school management**
  - reason: dictionary_education; score: 100; entities: unknown:Créapole
- **yoaz@hotmail fr (typography, visuel identity, corporate identity.**
  - reason: dictionary_languages; score: 100; entities: unknown:French
- **packaging. poster, logos, web design, illustrations.**
  - reason: rich_vocabulary; score: 82; entities: none
- **editions, client analyse, target customer, art history**
  - reason: rich_vocabulary; score: 82; entities: none
- **» Be.net/yoaz marketing, technologie, marketing studies**
  - reason: rich_vocabulary; score: 82; entities: none
- **observation, maquette, packaging.)**
  - reason: rich_vocabulary; score: 79; entities: none
- **2007 2009 : Créapole creation school management**
  - reason: dictionary_education; score: 100; entities: unknown:Créapole
- **multisectoral year {visual communication**
  - reason: rich_vocabulary; score: 82; entities: none
- **product design, video game, architecture}**
  - reason: rich_vocabulary; score: 82; entities: none
- **French: native**
  - reason: dictionary_languages; score: 100; entities: unknown:French
- **English: fluent Ps] photoshop EEE CTT**
  - reason: dictionary_words; score: 100; entities: unknown:Photoshop,English
- **Drawing**
  - reason: language_or_interest; score: 61; entities: none
- **Iustration, Graphic design, Movies**
  - reason: rich_vocabulary; score: 82; entities: none
- **Print, Logo, Vector, Art... Reading**
  - reason: rich_vocabulary; score: 82; entities: none
- **Music**
  - reason: language_or_interest; score: 45; entities: none
- **Nature**
  - reason: language_or_interest; score: 61; entities: none
- **2009 20M : Créapole, creation school management @ man visual communication**
  - reason: dictionary_education; score: 100; entities: unknown:Créapole

### LOW_CONFIDENCE (7)

- **v3 2 GRADRIC designer & Illustrator**
  - reason: low_ocr_confidence, known_garbage; score: 55; entities: unknown:Illustrator
- **@ man visual communication**
  - reason: low_ocr_confidence, known_garbage; score: 44; entities: none
- **ee à A A TN v3 2 GRADRIC designer & Illustrator**
  - reason: low_ocr_confidence, known_garbage; score: 55; entities: unknown:Illustrator
- **visuel identity**
  - reason: partial_ocr_or_unclassified; score: 76; entities: none
- **corporate identity.**
  - reason: partial_ocr_or_unclassified; score: 76; entities: none
- **logos**
  - reason: few_dictionary_words, low_ocr_confidence; score: 45; entities: none
- **illustrations.**
  - reason: few_dictionary_words, low_ocr_confidence; score: 61; entities: none

### GARBAGE (10)

- **ee à**
  - reason: known_fragment; score: 38; entities: none
- **A A TN**
  - reason: known_fragment; score: 38; entities: none
- **_— pe**
  - reason: known_fragment; score: 38; entities: none
- **RS Phone:**
  - reason: known_fragment; score: 41; entities: none
- **Ic) yoaz27 2008 2009 : Créapole creation school management**
  - reason: junk_fragment; score: 70; entities: unknown:Créapole
- **ign fin hie. je**
  - reason: ocr_corruption; score: 58; entities: none
- **Q voaz.tumblr com product design (infographie, ergonomie, extern**
  - reason: ocr_corruption; score: 82; entities: none
- **Photograph:**
  - reason: known_fragment; score: 61; entities: none
- **Mustrator RE scowboscc**
  - reason: ocr_corruption; score: 44; entities: none
- **[6] incesion me SE**
  - reason: ocr_corruption; score: 61; entities: none

## Noise engine notes

- **STRUCTURED_RESUME** holds pre-`normalizeResumeData` overflow (40 lines for Yoaz).
- **RESUME_DATA** final unsorted after dedupe/confidence gate: **2 lines** — `Drawing` (VALID), `@ man visual communication` (LOW_CONFIDENCE).
- **GARBAGE** cluster: header junk (`ee à`, `A A TN`, `_— pe`, `RS Phone:`), tool OCR (`Mustrator`, `incesion`), merged review blobs.
- **VALID** cluster: client lists, education/career lines, languages, interests, skill phrases.
- **LOW_CONFIDENCE** cluster: corrupted dates (`20N`, `20M`), merged contact+education, partial identity/social lines.
