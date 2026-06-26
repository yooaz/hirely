# HIRELY P0 — Template Completeness Lock

**Result:** PASS
**Generated:** 2026-06-10T13:31:44.329Z

## Rule

Templates are **visual skins only**. They must never remove data.

- If a section has data → render it (100% of items visible in DOM)
- If a section is empty → hide the section cleanly (no empty blocks)

## Lock sections

- identity
- summary
- experiences
- education
- skills
- tools
- languages
- clients
- projects

## QA method

For each production template, compare **finalResumeData section counts** vs **DOM rendered counts**:

| Metric | Meaning |
|--------|---------|
| `sourceCount` | Items in finalResumeData |
| `domCount` | Items found in rendered HTML |
| `domBlocks` | Section blocks in DOM (0 when empty) |

**Acceptance gate: 100%** — every populated section must match exactly.

## Template results

| Template | Score | Status |
|----------|-------|--------|
| ATS Clean (`ats`) | 100% | PASS |
| Creative Portfolio (`creative`) | 100% | PASS |
| Executive Minimal (`executive-minimal`) | 100% | PASS |
| Tech Resume (`modern-two-column`) | 100% | PASS |
| Modern Editorial (`editorial`) | 100% | PASS |

## Source fixture counts

| Section | Count |
|---------|------:|
| identity | 4 |
| summary | 1 |
| experiences | 2 |
| education | 1 |
| skills | 4 |
| tools | 4 |
| languages | 2 |
| clients | 3 |
| projects | 2 |

## Per-template section lock

### ATS Clean

| Section | Source | DOM | Blocks | Status |
|---------|-------:|----:|-------:|--------|
| identity | 4 | 4 | 1 | PASS |
| summary | 1 | 1 | 1 | PASS |
| experiences | 2 | 2 | 1 | PASS |
| education | 1 | 1 | 1 | PASS |
| skills | 4 | 4 | 2 | PASS |
| tools | 4 | 4 | 1 | PASS |
| languages | 2 | 2 | 2 | PASS |
| clients | 3 | 3 | 1 | PASS |
| projects | 2 | 2 | 1 | PASS |

### Creative Portfolio

| Section | Source | DOM | Blocks | Status |
|---------|-------:|----:|-------:|--------|
| identity | 4 | 4 | 1 | PASS |
| summary | 1 | 1 | 1 | PASS |
| experiences | 2 | 2 | 1 | PASS |
| education | 1 | 1 | 1 | PASS |
| skills | 4 | 4 | 2 | PASS |
| tools | 4 | 4 | 1 | PASS |
| languages | 2 | 2 | 2 | PASS |
| clients | 3 | 3 | 1 | PASS |
| projects | 2 | 2 | 1 | PASS |

### Executive Minimal

| Section | Source | DOM | Blocks | Status |
|---------|-------:|----:|-------:|--------|
| identity | 4 | 4 | 1 | PASS |
| summary | 1 | 1 | 1 | PASS |
| experiences | 2 | 2 | 1 | PASS |
| education | 1 | 1 | 1 | PASS |
| skills | 4 | 4 | 2 | PASS |
| tools | 4 | 4 | 1 | PASS |
| languages | 2 | 2 | 2 | PASS |
| clients | 3 | 3 | 1 | PASS |
| projects | 2 | 2 | 1 | PASS |

### Tech Resume

| Section | Source | DOM | Blocks | Status |
|---------|-------:|----:|-------:|--------|
| identity | 4 | 4 | 1 | PASS |
| summary | 1 | 1 | 1 | PASS |
| experiences | 2 | 2 | 1 | PASS |
| education | 1 | 1 | 1 | PASS |
| skills | 4 | 4 | 2 | PASS |
| tools | 4 | 4 | 1 | PASS |
| languages | 2 | 2 | 2 | PASS |
| clients | 3 | 3 | 1 | PASS |
| projects | 2 | 2 | 1 | PASS |

### Modern Editorial

| Section | Source | DOM | Blocks | Status |
|---------|-------:|----:|-------:|--------|
| identity | 4 | 4 | 1 | PASS |
| summary | 1 | 1 | 1 | PASS |
| experiences | 2 | 2 | 1 | PASS |
| education | 1 | 1 | 1 | PASS |
| skills | 4 | 4 | 2 | PASS |
| tools | 4 | 4 | 1 | PASS |
| languages | 2 | 2 | 2 | PASS |
| clients | 3 | 3 | 1 | PASS |
| projects | 2 | 2 | 1 | PASS |

## Implementation

| Piece | Path |
|-------|------|
| Lock scorer | `src/ui/templates/template-completeness.js` |
| QA gate | `src/tests/qa-template-completeness-lock.mjs` |
| Content never gated on final resume | `cv-templates.js` |

## Gate

```bash
npm run test:template-completeness-lock
```

## QA output

```
OK fixture has 2 projects
OK fixture has 2 experiences
CV_TEMPLATE_BOOT_OK
OK ats renders HTML
OK ats no blocked placeholder
OK creative renders HTML
OK creative no blocked placeholder
OK executive-minimal renders HTML
OK executive-minimal no blocked placeholder
OK modern-two-column renders HTML
OK modern-two-column no blocked placeholder
OK editorial renders HTML
OK editorial no blocked placeholder
OK ats lock 100%
OK ats identity source=4 dom=4 (100%)
OK ats identity rendered in DOM
OK ats summary source=1 dom=1 (100%)
OK ats experiences source=2 dom=2 (100%)
OK ats experiences rendered in DOM
OK ats education source=1 dom=1 (100%)
OK ats education rendered in DOM
OK ats skills source=4 dom=4 (100%)
OK ats tools source=4 dom=4 (100%)
OK ats languages source=2 dom=2 (100%)
OK ats clients source=3 dom=3 (100%)
OK ats clients rendered in DOM
OK ats projects source=2 dom=2 (100%)
OK ats projects rendered in DOM
OK creative lock 100%
OK creative identity source=4 dom=4 (100%)
OK creative identity rendered in DOM
OK creative summary source=1 dom=1 (100%)
OK creative experiences source=2 dom=2 (100%)
OK creative experiences rendered in DOM
OK creative education source=1 dom=1 (100%)
OK creative education rendered in DOM
OK creative skills source=4 dom=4 (100%)
OK creative tools source=4 dom=4 (100%)
OK creative languages source=2 dom=2 (100%)
OK creative clients source=3 dom=3 (100%)
OK creative clients rendered in DOM
OK creative projects source=2 dom=2 (100%)
OK creative projects rendered in DOM
OK executive-minimal lock 100%
OK executive-minimal identity source=4 dom=4 (100%)
OK executive-minimal identity rendered in DOM
OK executive-minimal summary source=1 dom=1 (100%)
OK executive-minimal experiences source=2 dom=2 (100%)
OK executive-minimal experiences rendered in DOM
OK executive-minimal education source=1 dom=1 (100%)
OK executive-minimal education rendered in DOM
OK executive-minimal skills source=4 dom=4 (100%)
OK executive-minimal tools source=4 dom=4 (100%)
OK executive-minimal languages source=2 dom=2 (100%)
OK executive-minimal clients source=3 dom=3 (100%)
OK executive-minimal clients rendered in DOM
OK executive-minimal projects source=2 dom=2 (100%)
OK executive-minimal projects rendered in DOM
OK modern-two-column lock 100%
OK modern-two-column identity source=4 dom=4 (100%)
OK modern-two-column identity rendered in DOM
OK modern-two-column summary source=1 dom=1 (100%)
OK modern-two-column experiences source=2 dom=2 (100%)
OK modern-two-column experiences rendered in DOM
OK modern-two-column education source=1 dom=1 (100%)
OK modern-two-column education rendered in DOM
OK modern-two-column skills source=4 dom=4 (100%)
OK modern-two-column tools source=4 dom=4 (100%)
OK modern-two-column languages source=2 dom=2 (100%)
OK modern-two-column clients source=3 dom=3 (100%)
OK modern-two-column clients rendered in DOM
OK modern-two-column projects source=2 dom=2 (100%)
OK modern-two-column projects rendered in DOM
OK editorial lock 100%
OK editorial identity source=4 dom=4 (100%)
OK editorial identity rendered in DOM
OK editorial summary source=1 dom=1 (100%)
OK editorial experiences source=2 dom=2 (100%)
OK editorial experiences rendered in DOM
OK editorial education source=1 dom=1 (100%)
OK editorial education rendered in DOM
OK editorial skills source=4 dom=4 (100%)
OK editorial tools source=4 dom=4 (100%)
OK editorial languages source=2 dom=2 (100%)
OK editorial clients source=3 dom=3 (100%)
OK editorial clients rendered in DOM
OK editorial projects source=2 dom=2 (100%)
OK editorial projects rendered in DOM
OK empty summary hidden
OK empty experiences hidden
OK empty projects hidden
OK low confidence does not strip final resume sections

PASS template-completeness-lock

(node:42892) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/src/ui/templates/template-completeness.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
```

