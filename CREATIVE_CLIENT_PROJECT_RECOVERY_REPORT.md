# CREATIVE_CLIENT_PROJECT_RECOVERY_REPORT

**Engine:** `CREATIVE_CLIENT_PROJECT_RECOVERY`
**Status:** PASS
**Generated:** 2026-06-10T21:05:49.870Z

## Goal

Recover creative CV client brands and project history into `clients[]` and `projects[]` without promoting brands into fake experience entries.

## Rules

- Clients stay in `clients[]` unless a source line contains **role + date + company** (then it is treated as a job row, not a client harvest line).
- Recovery scans unsorted lines, experience bullets, summaries, and full raw text.
- Experience count must not inflate from client recovery.

## Anchor clients

- Nike
- Adobe
- Marvel
- Converse
- PlayStation
- Cadillac
- Fortune
- Visa
- Apple
- Arte
- Asics
- MIT
- Meta
- Louis Vuitton
- Pantone

## Project type keywords

- poster
- campaign
- illustration
- cover
- packaging
- scarf
- animation
- billboard
- album cover
- festival
- book cover

## QA

```
OK client list line is not strict job row
OK role+date+company line detected as job row
OK recovered client Nike
OK recovered client Adobe
OK recovered client Marvel
OK recovered client Converse
OK recovered client PlayStation
OK recovered client Cadillac
OK recovered client Fortune
OK recovered client Visa
OK recovered client Apple
OK recovered client Arte
OK recovered client Asics
OK recovered client MIT
OK recovered client Meta
OK recovered client Louis Vuitton
OK recovered client Pantone
OK recovered project type poster
OK recovered project type campaign
OK recovered project type illustration
OK recovered project type cover
OK recovered project type packaging
OK recovered project type scarf
OK recovered project type animation
OK recovered project type billboard
OK recovered project type album cover
OK recovered project type festival
OK recovered project type book cover
OK audit engine id
OK client recall 100%
OK project type recall 100%
OK section engine wires recovery
OK structured.clients 15
OK structured.projects 18
OK no fake experiences (4 → 4)
OK experienceInflation is 0
NODE_RESUMEDATA_COUNTS {
  path: 'buildResumeData:importResult',
  experiences: 3,
  education: 0,
  skills: 6,
  tools: 3,
  languages: 1,
  clients: 14,
  projects: 15,
  unsorted: 0
}
OK resumeData.clients 14
OK resumeData.projects 15
OK cv data retains major clients
OK cv data retains project history
OK rich fixture recovers clients from experience bullet
OK rich fixture recovery does not inflate experiences (count=18)
OK creative-cv fixture clients 10

CREATIVE_CLIENT_PROJECT_RECOVERY QA PASS

(node:54032) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/src/core/parsing/creative-client-project-recovery.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
(node:54032) ExperimentalWarning: localStorage is not available because --localstorage-file was not provided.
```

## Fixture results

| Fixture | clients | projects | experiences | client recall | project recall |
| --- | ---: | ---: | ---: | ---: | ---: |
| creative-client-project-recovery | 14 | 15 | 3 | 100% | 100% |
| creative-cv | 9 | 0 | 3 | 100% | 100% |
| creative-experience-rich | 9 | 0 | 10 | 100% | 100% |

### Recovery fixture — clients

- Marvel
- PlayStation
- Fortune
- Apple
- Nike
- Converse
- Louis Vuitton
- Cadillac
- Meta
- Arte
- Pantone
- Adobe
- Visa
- Asics

### Recovery fixture — projects

- Air Max poster campaign — Nike
- Max Campaign — Adobe
- Black Panther Poster — Marvel
- Chuck Taylor packaging — Converse
- God of War billboard — PlayStation
- luxury campaign — Cadillac
- 500 cover illustration — Fortune
- FIFA Campaign — Visa
- Music album cover — Apple
- television festival poster — Arte
- silk scarf — Louis Vuitton
- color book cover — Pantone
- Creative illustrator delivering posters, campaigns, packaging, and brand illustration for global clients · illustrator
- Animation
- Horizon billboard — Meta

## Metadata stats (recovery fixture)

```json
{
  "engine": "CREATIVE_CLIENT_PROJECT_RECOVERY",
  "clientsRecovered": 15,
  "projectsRecovered": 18,
  "clientsCount": 15,
  "projectsCount": 18,
  "jobLinesSkipped": 1,
  "fakeExperiencesPrevented": 1,
  "experienceCountBefore": 4,
  "experienceCountAfter": 4,
  "experienceInflation": 0,
  "clientAnchorsFound": [
    "Nike",
    "Adobe",
    "Marvel",
    "Converse",
    "PlayStation",
    "Cadillac",
    "Fortune",
    "Visa",
    "Apple",
    "Arte",
    "Asics",
    "MIT",
    "Meta",
    "Louis Vuitton",
    "Pantone"
  ],
  "clientAnchorRecallPct": 100,
  "projectTypesFound": [
    "poster",
    "campaign",
    "illustration",
    "cover",
    "packaging",
    "scarf",
    "animation",
    "billboard",
    "album cover",
    "festival",
    "book cover"
  ],
  "projectTypeRecallPct": 100
}
```

## QA JSON

`tests/output/creative-client-project-recovery/report.json`
