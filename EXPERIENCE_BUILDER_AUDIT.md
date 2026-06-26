# Experience Builder Audit
Generated: 2026-06-06T07:34:52.570Z
Input: Yoaz OCR (`tests/output/ocr-quality-yoaz/report.json`)
## Executive summary
The input clearly contains companies, job titles, and dates (5 date-bearing lines). **Zero** blocks are classified as `EXPERIENCE`, so `experience-builder-v2` never produces candidates. Recovery finds 2 drafts and rebuilder finds 3 drafts, but both paths are **bypassed or disabled** when `detectExperienceParserFailed` is true. The single experience in final `resumeData` comes from **strict parser + import-repair**, not the builder.
## 1. experience-builder-v2.js
| Metric | Value |
|--------|-------|
| Classified blocks (section engine) | 20 |
| Render blocks (p0 layout) | 20 |
| Block types | tools, clients, education, contact, languages, skills |
| EXPERIENCE blocks | 0 |
| Candidates BEFORE validation | 0 |
| Accepted AFTER validation | 0 |
| Rejected AFTER validation | 0 |

### Blocks with dates but wrong section type
| type | reason | preview |
|------|--------|--------|
| tools | — | 30-year old Illustrator and graphic 2011-2022 : Freelancer Illustrator, Graphic designer : Posters, packaging. |
| education | — | +33649434839 2011 2012 : LISAA, web and motion design \| 2009 20M : Créapole, creation school management |
| education | — | Ic) yoaz27 2008 2009 : Créapole creation school management |
| education | — | 2007 2009 : Créapole creation school management |

**Discard reason:** `filterExperienceBlocksOnly()` only keeps `SECTION_IDS.EXPERIENCE`. OCR merges headers like "PROFILE WORK EXPERIENCE" onto one line; section engine assigns dates to EDUCATION/UNKNOWN blocks instead.

### Candidates BEFORE validation
_None — builder never entered the block loop._

### Candidates AFTER validation
**Accepted:**
_None_
**Rejected:**
_None_

## 2. Date-line simulation (parser path)
Each OCR line containing a year range, run through `buildExperienceEntryFromLineGroup` + `validateExperienceCandidate`:

| # | line | BEFORE | AFTER | discard reason |
|---|------|--------|-------|----------------|
| 1 | 30-year old Illustrator and graphic 2011-2022 : Freelancer I… | {"role":"_","company":"pe","startDate":"2011","endDate":"2022","dates":"2011–202… | ACCEPTED | — |
| 2 | +33649434839 2011 2012 : LISAA, web and motion design… | {"role":"Rs Phone:","company":"","startDate":"2011","endDate":"","dates":"2011–P… | ACCEPTED | — |
| 3 | 2009 20M : Créapole, creation school management… | {"role":"@ Man Visual Communication","company":"","startDate":"2011","endDate":"… | ACCEPTED | — |
| 4 | Ic) yoaz27 2008 2009 : Créapole creation school management… | {"role":"@ 27voaz Market Reviews)","company":"","startDate":"2008","endDate":"",… | ACCEPTED | — |
| 5 | 2007 2009 : Créapole creation school management… | {"role":"Multisectoral Year {Visual Communication","company":"","startDate":"200… | ACCEPTED | — |

## 3. experience-recovery.js
Gate: `parser_failed_career_years` (run=true)

### BEFORE validation (`scanDraftExperiences`)
```json
[
  {
    "role": "Designer Edition, Logos... 30",
    "company": "(Nike Louis Vuitton, Marvel Cadillec, Fortune, Converse",
    "startDate": "2011",
    "endDate": "2022",
    "dates": "2011–2022",
    "confidence": 99,
    "bullets": [
      "(Nike Louis Vuitton, Marvel Cadillec, Fortune, Converse"
    ]
  },
  {
    "role": "Year Old Illustrator And Graphic 2011",
    "company": "",
    "startDate": "2011",
    "endDate": "2022",
    "dates": "2011–2022",
    "confidence": 86,
    "bullets": []
  }
]
```

### AFTER validation (`validateExperienceCandidate`)
```json
[
  {
    "before": {
      "role": "Designer Edition, Logos... 30",
      "company": "(Nike Louis Vuitton, Marvel Cadillec, Fortune, Converse",
      "startDate": "2011",
      "endDate": "2022",
      "dates": "2011–2022",
      "confidence": 99,
      "bullets": [
        "(Nike Louis Vuitton, Marvel Cadillec, Fortune, Converse"
      ]
    },
    "after": {
      "role": "Designer Edition, Logos... 30",
      "company": "(Nike Louis Vuitton, Marvel Cadillec, Fortune, Converse",
      "startDate": "2011",
      "endDate": "2022",
      "dates": "2011–2022",
      "confidence": 99,
      "bullets": [
        "(Nike Louis Vuitton, Marvel Cadillec, Fortune, Converse"
      ]
    },
    "validation": {
      "ok": false,
      "reason": "skill_tag_as_company"
    }
  },
  {
    "before": {
      "role": "Year Old Illustrator And Graphic 2011",
      "company": "",
      "startDate": "2011",
      "endDate": "2022",
      "dates": "2011–2022",
      "confidence": 86,
      "bullets": []
    },
    "after": {
      "role": "Year Old Illustrator And Graphic 2011",
      "company": "",
      "startDate": "2011",
      "endDate": "2022",
      "dates": "2011–2022",
      "confidence": 86,
      "bullets": []
    },
    "validation": {
      "ok": false,
      "reason": "age_as_role"
    }
  }
]
```

### Why recovery drafts were discarded
- **Designer Edition, Logos... 30** @ (Nike Louis Vuitton, Marvel Cadillec, Fortune, Converse (2011–2022): `skill_tag_as_company`
- **Year Old Illustrator And Graphic 2011** @ (no company) (2011–2022): `age_as_role`

**Pipeline discard:** runExperienceRecovery short-circuits to runExperienceRebuilder — scanDraftExperiences never applied
runExperienceRecovery → recovered=false, drafts applied=0

## 4. experience-rebuilder.js
### BEFORE validation (`rebuildExperiencesFromText`)
```json
[
  {
    "role": "v3 2 Gradric Designer & Illustrator",
    "company": "(Nike Louis Vuitton, Marvel Cadillec, Fortune, Converse",
    "startDate": "2011",
    "endDate": "2022",
    "dates": "2011–2022",
    "confidence": 99,
    "bullets": []
  },
  {
    "role": "» be.Net/Yoaz Marketing, Technologie, Marketing Studies",
    "company": "",
    "startDate": "",
    "endDate": "",
    "dates": "",
    "confidence": 73,
    "bullets": [
      "@ 27voaz market reviews)",
      "Ic) yoaz27 2008 2009 : Créapole creation school management"
    ]
  },
  {
    "role": "Product Design, Video Game, Architecture}",
    "company": "",
    "startDate": "",
    "endDate": "",
    "dates": "",
    "confidence": 67,
    "bullets": [
      "multisectoral year {visual communication"
    ]
  }
]
```

### AFTER validation
```json
[
  {
    "before": {
      "role": "v3 2 Gradric Designer & Illustrator",
      "company": "(Nike Louis Vuitton, Marvel Cadillec, Fortune, Converse",
      "startDate": "2011",
      "endDate": "2022",
      "dates": "2011–2022",
      "confidence": 99,
      "bullets": []
    },
    "after": {
      "role": "v3 2 Gradric Designer & Illustrator",
      "company": "(Nike Louis Vuitton, Marvel Cadillec, Fortune, Converse",
      "startDate": "2011",
      "endDate": "2022",
      "dates": "2011–2022",
      "confidence": 99,
      "bullets": []
    },
    "validation": {
      "ok": false,
      "reason": "skill_tag_as_company"
    }
  },
  {
    "before": {
      "role": "» be.Net/Yoaz Marketing, Technologie, Marketing Studies",
      "company": "",
      "startDate": "",
      "endDate": "",
      "dates": "",
      "confidence": 73,
      "bullets": [
        "@ 27voaz market reviews)",
        "Ic) yoaz27 2008 2009 : Créapole creation school management"
      ]
    },
    "after": {
      "role": "» be.Net/Yoaz Marketing, Technologie, Marketing Studies",
      "company": "",
      "startDate": "",
      "endDate": "",
      "dates": "",
      "confidence": 73,
      "bullets": [
        "@ 27voaz market reviews)",
        "Ic) yoaz27 2008 2009 : Créapole creation school management"
      ]
    },
    "validation": {
      "ok": false,
      "reason": "insufficient_signals"
    }
  },
  {
    "before": {
      "role": "Product Design, Video Game, Architecture}",
      "company": "",
      "startDate": "",
      "endDate": "",
      "dates": "",
      "confidence": 67,
      "bullets": [
        "multisectoral year {visual communication"
      ]
    },
    "after": {
      "role": "Product Design, Video Game, Architecture}",
      "company": "",
      "startDate": "",
      "endDate": "",
      "dates": "",
      "confidence": 67,
      "bullets": [
        "multisectoral year {visual communication"
      ]
    },
    "validation": {
      "ok": false,
      "reason": "insufficient_signals"
    }
  }
]
```

### Why rebuilder drafts were discarded
- **v3 2 Gradric Designer & Illustrator** (2011–2022): `skill_tag_as_company`
- **» be.Net/Yoaz Marketing, Technologie, Marketing Studies** (–): `insufficient_signals`
- **Product Design, Video Game, Architecture}** (–): `insufficient_signals`

**Pipeline discard:** runExperienceRebuilder has inventionDisabled:true — rebuildExperiencesFromText drafts are logged-only, never merged
runExperienceRebuilder → rebuilt=false, inventionDisabled=true

## 5. What actually lands in resumeData
### strict parser (`parseStrictExperiencesFromLines`)
```json
[
  {
    "role": "_",
    "company": "pe",
    "startDate": "2011",
    "endDate": "2022",
    "dates": "2011–2022",
    "confidence": null,
    "bullets": []
  }
]
```

### final resumeData.experiences (after import-repair)
```json
[
  {
    "role": "_ — pe — 2011–2022",
    "company": "",
    "startDate": "2011",
    "endDate": "2022",
    "dates": "2011–2022",
    "confidence": null,
    "bullets": []
  }
]
```
Source: import-repair via repairResumeDataFromRaw (not experience-builder-v2)

## Discard reason index
| Stage | Object | Reason |
|-------|--------|--------|
| experience-builder-v2 | all date content | 0 EXPERIENCE blocks → never candidate |
| parser simulation | _ | accepted_outside_builder_no_experience_block |
| parser simulation | Rs Phone: | accepted_outside_builder_no_experience_block |
| parser simulation | @ Man Visual Communication | accepted_outside_builder_no_experience_block |
| parser simulation | @ 27voaz Market Reviews) | accepted_outside_builder_no_experience_block |
| parser simulation | Multisectoral Year {Visual Communication | accepted_outside_builder_no_experience_block |
| experience-recovery | Designer Edition, Logos... 30 | skill_tag_as_company |
| experience-recovery | Year Old Illustrator And Graphic 2011 | age_as_role |
| experience-rebuilder | v3 2 Gradric Designer & Illustrator | skill_tag_as_company |
| experience-rebuilder | » be.Net/Yoaz Marketing, Technologie, Ma | insufficient_signals |
| experience-rebuilder | Product Design, Video Game, Architecture | insufficient_signals |
