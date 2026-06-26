# SECTION_DETECTION_REPORT

Generated: 2026-06-06
Engine: `HIRELY_SECTION_DETECTION_V1`

## Summary

- Alias matrix: **15/15** headers detected with confidence ≥ 85
- Stress fixtures scanned: **12**
- Canonical sections: experience, education, skills, languages, projects, certifications, volunteer, interests

## Confidence model

| Match type | Score |
| --- | ---: |
| Exact alias | 96 |
| Prefix/suffix alias | 88 |
| Inline header (`Header:`) exact | 94 |
| Inline header prefix | 90 |
| Contact / location specials | 92 / 90 |
| Content row (dates, em-dash, long line) | rejected (0) |

Per-section confidence on a document is the **max** header score for that section.

## Supported aliases (H4)

- **experience**: experience, work experience, professional experience, employment, work history, career, parcours, positions, employment history
- **education**: education, formation, studies, academic, academic background, scholarship, diploma, qualifications
- **skills**: skills, technical skills, competences, competencies, expertise, core competencies, key skills, competences cles
- **languages**: languages, language skills, linguistic
- **projects**: projects, selected projects, portfolio projects, selected work, portfolio, personal work
- **certifications**: certifications, certificates, licenses, licences, credentials, professional certifications, certification
- **volunteer**: volunteer, volunteering, volunteer experience, community service, civic engagement
- **interests**: interests, hobbies, personal interests, centres d interet

## Alias matrix

| Label | Expected | Detected | Confidence | Match | Pass |
| --- | --- | --- | --- | --- | --- |
| Experience | experience | experience | 96 | exact | ✓ |
| Work Experience | experience | experience | 88 | prefix | ✓ |
| Employment | experience | experience | 96 | exact | ✓ |
| Professional Experience | experience | experience | 96 | exact | ✓ |
| Education | education | education | 96 | exact | ✓ |
| Studies | education | education | 96 | exact | ✓ |
| Academic Background | education | education | 96 | exact | ✓ |
| Skills | skills | skills | 96 | exact | ✓ |
| Technical Skills | skills | skills | 96 | exact | ✓ |
| Competencies | skills | skills | 96 | exact | ✓ |
| Languages | languages | languages | 96 | exact | ✓ |
| Projects | projects | projects | 96 | exact | ✓ |
| Certifications | certifications | certifications | 96 | exact | ✓ |
| Volunteer | volunteer | volunteer | 96 | exact | ✓ |
| Interests | interests | interests | 96 | exact | ✓ |

## Negative cases (must not match)

| Line | Result | Confidence |
| --- | --- | --- |
| Software Engineer — Google — 2020–Present | rejected | 0 |
| MBA, Harvard Business School — 2018 | rejected | 0 |
| Python, JavaScript, SQL, Agile methodologies | rejected | 0 |

## Fixture header detection

### creative-cv

- Headers found: 6
- H4 sections with content/confidence: experience, education, skills, languages
- Section confidence: experience:96%, education:96%, skills:96%, languages:96%

| Header line | Key | Confidence | Match |
| --- | --- | --- | --- |
| Profile | summary | 96 | exact |
| Experience | experience | 96 | exact |
| Education | education | 96 | exact |
| Skills | skills | 96 | exact |
| Tools | tools | 96 | exact |
| Languages | languages | 96 | exact |

### yoaz-cv

- Headers found: 8
- H4 sections with content/confidence: experience, education, skills, languages, interests
- Section confidence: experience:96%, education:96%, skills:96%, languages:96%, interests:96%

| Header line | Key | Confidence | Match |
| --- | --- | --- | --- |
| Profile | summary | 96 | exact |
| Experience | experience | 96 | exact |
| Education | education | 96 | exact |
| Skills | skills | 96 | exact |
| Tools | tools | 96 | exact |
| Languages | languages | 96 | exact |
| Clients | clients | 96 | exact |
| Interests | interests | 96 | exact |

### developer-cv

- Headers found: 7
- H4 sections with content/confidence: experience, education, skills, languages, interests
- Section confidence: experience:96%, education:96%, skills:96%, languages:96%, interests:96%

| Header line | Key | Confidence | Match |
| --- | --- | --- | --- |
| Summary | summary | 96 | exact |
| Experience | experience | 96 | exact |
| Education | education | 96 | exact |
| Skills | skills | 96 | exact |
| Tools | tools | 96 | exact |
| Languages | languages | 96 | exact |
| Interests | interests | 96 | exact |

### marketing-cv

- Headers found: 6
- H4 sections with content/confidence: experience, education, skills, languages
- Section confidence: experience:96%, education:96%, skills:96%, languages:96%

| Header line | Key | Confidence | Match |
| --- | --- | --- | --- |
| Profile | summary | 96 | exact |
| Experience | experience | 96 | exact |
| Education | education | 96 | exact |
| Skills | skills | 96 | exact |
| Tools | tools | 96 | exact |
| Languages | languages | 96 | exact |

### recruiter-cv

- Headers found: 6
- H4 sections with content/confidence: experience, education, skills, languages
- Section confidence: experience:96%, education:96%, skills:96%, languages:96%

| Header line | Key | Confidence | Match |
| --- | --- | --- | --- |
| Profile | summary | 96 | exact |
| Experience | experience | 96 | exact |
| Education | education | 96 | exact |
| Skills | skills | 96 | exact |
| Tools | tools | 96 | exact |
| Languages | languages | 96 | exact |

### consultant-cv

- Headers found: 6
- H4 sections with content/confidence: experience, education, skills, languages
- Section confidence: experience:96%, education:96%, skills:96%, languages:96%

| Header line | Key | Confidence | Match |
| --- | --- | --- | --- |
| Profile | summary | 96 | exact |
| Experience | experience | 96 | exact |
| Education | education | 96 | exact |
| Skills | skills | 96 | exact |
| Tools | tools | 96 | exact |
| Languages | languages | 96 | exact |

### text-pdf

- Headers found: 4
- H4 sections with content/confidence: experience, education, skills
- Section confidence: experience:96%, education:96%, skills:96%

| Header line | Key | Confidence | Match |
| --- | --- | --- | --- |
| Summary | summary | 96 | exact |
| Experience | experience | 96 | exact |
| Education | education | 96 | exact |
| Skills | skills | 96 | exact |

### scanned-pdf

- Headers found: 3
- H4 sections with content/confidence: experience, education, skills
- Section confidence: experience:96%, education:96%, skills:96%

| Header line | Key | Confidence | Match |
| --- | --- | --- | --- |
| Experience | experience | 96 | exact |
| Education | education | 96 | exact |
| Skills | skills | 96 | exact |

### docx

- Headers found: 4
- H4 sections with content/confidence: experience, education, skills
- Section confidence: experience:96%, education:96%, skills:96%

| Header line | Key | Confidence | Match |
| --- | --- | --- | --- |
| Summary | summary | 96 | exact |
| Experience | experience | 96 | exact |
| Education | education | 96 | exact |
| Skills | skills | 96 | exact |

### two-column-cv

- Headers found: 3
- H4 sections with content/confidence: experience, education, skills
- Section confidence: experience:96%, education:96%, skills:96%

| Header line | Key | Confidence | Match |
| --- | --- | --- | --- |
| Experience | experience | 96 | exact |
| Education | education | 96 | exact |
| Skills | skills | 96 | exact |

### mvp-sample

- Headers found: 3
- H4 sections with content/confidence: experience, education, skills
- Section confidence: experience:96%, education:96%, skills:96%

| Header line | Key | Confidence | Match |
| --- | --- | --- | --- |
| Experience | experience | 96 | exact |
| Education | education | 96 | exact |
| Skills | skills | 96 | exact |

### yoaz-pdf-live-ocr

- Headers found: 3
- H4 sections with content/confidence: education, languages
- Section confidence: education:88%, languages:96%

| Header line | Key | Confidence | Match |
| --- | --- | --- | --- |
| CONTACT | contact | 92 | contact |
| - EDUCATION | education | 88 | prefix |
| LANGUAGES | languages | 96 | exact |

## Integration

- `scoreSectionHeader()` — single-line header scoring
- `detectSectionsWithConfidence()` — full text split + confidence map
- `splitBySectionHeaders()` — attaches `sectionConfidence` and `_sectionHeaders`
- `detectHeaderBasedSectionBlocks()` — V2 blocks use scored `detectedConfidence`

## Verification

```bash
node src/tests/section-detection-test.mjs
npm run stress:sections
```

