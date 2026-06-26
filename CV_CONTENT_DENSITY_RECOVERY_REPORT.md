# CV_CONTENT_DENSITY_RECOVERY_REPORT

**Status:** PASS
**Engine:** `CV_CONTENT_DENSITY_RECOVERY_V1`
**Generated:** 2026-06-12T09:42:27.214Z

## Problem

Final CV preview looked empty while raw extraction still contained experience, clients, tools, education, and project lines.

## Rules enforced

- Compare `rawText` against `finalResumeData` + `reviewQueue`
- Section lines (experience, education, clients, tools, projects, portfolio) must not disappear
- Missing content is recovered into the correct section or queued for review
- Preview density target: **55%** minimum (`previewChars / rawChars`)
- Experience, clients, and education render when detected in source text

## Code changes

| Module | Change |
|--------|--------|
| `content-density-recovery.js` | Section parser, density audit, recovery + review queue |
| `final-resume-contract.js` | Run recovery before completeness audit |
| `final-resume-data-cleanup.js` | Raise suggestions cap 4 → 12 for retained orphans |

## QA summary

| Checks | Pass | Fail |
|--------|------|------|
| Total | 23 | 0 |

## Recovery case (sparse final → rich raw)

- Preview density: **65.3%**
- Recovered fields: 11
- Queued for review: 1
- Experiences: 3
- Clients: 6
- Education: 2
- Tools: 4

## Pipeline case

- Preview density: **100%**
- Experiences: 3
- Clients: 6
- Education: 2
- Review items: 4

## Checklist

- ✓ `density_min_55`
- ✓ `parse_experience_lines` — count=4
- ✓ `parse_clients_section`
- ✓ `parse_tools_section`
- ✓ `parse_education_section`
- ✓ `recovery_adds_experience`
- ✓ `recovery_adds_clients`
- ✓ `recovery_adds_education`
- ✓ `recovery_adds_tools`
- ✓ `recovery_density_target` — 65.3%
- ✓ `clients_brands_present`
- ✓ `tools_present`
- ✓ `accounted:LISAA Paris — Bachelor Desig`
- ✓ `accounted:École Estienne — Graphic Des`
- ✓ `accounted:McCann Paris — Art Director `
- ✓ `accounted:Led campaigns for Chanel and`
- ✓ `accounted:Publicis — Illustrator — 201`
- ✓ `accounted:Havas — Illustrator — 2015–2`
- ✓ `pipeline_final_resume`
- ✓ `pipeline_has_experience`
- ✓ `pipeline_has_education_or_clients`
- ✓ `pipeline_density` — 100%
- ✓ `render_multiple_sections` — sections=5

## Run

```bash
npm run qa:cv-content-density-recovery
npm run cv-content-density-recovery-report
```


## QA log (tail)

```
  experiences: 4,
  education: 2,
  skills: 6,
  tools: 4,
  languages: 0,
  clients: 5,
  projects: 0,
  unsorted: 2
}
PASS pipeline_final_resume
PASS pipeline_has_experience
PASS pipeline_has_education_or_clients
PASS pipeline_density
CV_TEMPLATE_BOOT_OK
PASS render_multiple_sections

═══ CV Content Density Recovery: 23/23 PASS ═══

(node:81615) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/src/core/validation/content-density-recovery.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
```
