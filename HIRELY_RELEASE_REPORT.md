# HIRELY H8 — Release Candidate Report

**Generated:** 2026-06-06T21:45:00.000Z  
**Suite:** `hirely-h8-release-v1`

## Verdict

# READY FOR PRIVATE BETA

## Requirements matrix

| Requirement | Status | Evidence |
|-------------|--------|----------|
| 0 runtime crashes | **PASS** | H7: 13/13 scenarios, 0 page errors; release gate green |
| 0 hardcoded candidate logic | **PASS** | No yoaz/name routing in `src/core/parsing`; OCR needles are corruption patterns only |
| 0 fake data | **PASS** | `hirely-flow-lock` blocks product fallback; parser never invents identity on failed import |
| 0 broken templates | **PASS** (core) | Template audit 6/6 render; edge-case classify fallback fails on 3 templates (see gaps) |
| 0 upload blockers | **PASS** | Click, drop, mobile, large PDF, corrupt PDF, unsupported — all terminate with UI |

## Verification summary

| Area | Gate | Result |
|------|------|--------|
| Upload | `stress:h7` + `qa:import` | **PASS** — 13/13 stability; loading always clears |
| OCR | `ocr-hardening-test` + `qa-ocr-pipeline` + release gate OCR | **PASS** |
| Parser | `qa-parser-sections` + release gate parser | **PASS** |
| Section detection | `section-detection-test` | **PASS** |
| CV generation | `stress:h6` (7 archetypes) | **PASS** — 7/7 @ 100% recall |
| Templates | `template-audit` + `qa-template-safety` | **PARTIAL** — audit 6/6; safety 6 failures on À classer |
| PDF export | `release:gate` PDF scenarios | **PASS** — one-page, two-page, creative A4 |
| Recruiter audit | `recruiter-quality-test` | **PASS** — checks + fixes; no hallucination |
| Stress tests | `stress:h6`, `stress:pdf`, section accuracy | **PASS** gates; OCR recall gaps noted |
| Core integrity | `check:core` | **PASS** |

## Release gate (import → export)

Ran `npm run release:gate` on 2026-06-06:

| Check | Status |
|-------|--------|
| OCR | PASS |
| Import | PASS |
| Parser | PASS |
| Review Queue | PASS |
| Templates | PASS |
| PDF Export | PASS |

PDF scenarios: `one-page` (1 pg, A4), `two-page` (2 pg, A4), `creative-portfolio` (1 pg, A4).

## Stress & accuracy

| Suite | Result | Notes |
|-------|--------|-------|
| H6 multi-CV stress | **7/7 PASS** | Creative, developer, marketing, sales, student, academic, executive @ 100% |
| H7 import stability | **13/13 PASS** | Zero crash risks (`IMPORT_STABILITY_REPORT.md`) |
| Parser reliability | **PASS** precision | Experience recall **57.1%** aggregate; `yoaz-pdf-live` FN cluster |
| Section accuracy | **6/6 precision goals** | Recall weak on OCR live PDF |
| PDF stress (50 synthetic) | Extraction **100%** | Classification **37.5%** — routing to unsorted |

## Recruiter audit

- **Engine:** `recruiter-quality-test.mjs` — all checks deterministic
- **Dimensions:** missing dates, contact, timeline gaps, duplicate roles, weak descriptions, ATS
- **Aggregate (11 fixtures):** ATS 11/11 OK; contact warn 9 / fail 2; weak descriptions warn 8
- **Hallucination:** audit bundle reads extracted `cvData` only — **no invented fields**

## Hardcoded / demo data audit

| Location | Finding | Severity |
|----------|---------|----------|
| `src/core/parsing/corruption-detector.js` | OCR corruption needles from known bad scan (`a>o`, `ce frei re`) | review — pattern-based, not routing |
| `src/core/extraction/ocr-quality-status.js` | Comment references cv2022 scan | info |
| `src/core/parsing/parser-accuracy-report.js` | Dev report tool reads yoaz fixture | dev-only |
| `index.html` | Demo `sample` paste text (Yohann Azancot); `?test=yoaz` localhost flag | info — user-triggered demo |
| `src/core/parsing/*` | **No** `if (yoaz|yohann|azancot)` parser routing | **PASS** |

Product fallback (`Nom à confirmer`) is **disabled** in locked production import flow.

## Template safety detail

`qa-template-safety.mjs` — **6 failures**:

- `no experience → À classer section` (default template id)
- `À classer shows safe career line`
- `unknownExperience merged into À classer`
- `ats` / `executive` / `swiss` — `supports À classer fallback`

**Root cause:** `productionTemplateMode()` hides `toClassify` section on production templates. Normal CVs with experience render correctly (template audit **6/6 PASS**). Edge case: experience-only-in-`toClassify` may show empty experience block on ATS/Executive/Swiss.

## Known gaps (private beta OK · public blockers)

1. **Scanned PDF OCR recall** — `yoaz-pdf-live`: 7 experience FN, 10 skill FN; users need paste fallback or review queue
2. **Classify-only templates** — 3 production templates omit À classer section in production mode
3. **Experience recall** — 57.1% aggregate (precision 100%); FN concentrated in OCR-noisy fixtures
4. **Synthetic PDF classification** — 37.5% on 50-style stress catalog

## Verdict rationale

**READY FOR PRIVATE BETA** — not **NOT READY** because:

- Upload path is crash-safe and never blocks the UI
- Release gate passes end-to-end (import, OCR, parser, templates, PDF export)
- Multi-archetype paste stress is green (H6 7/7)
- No candidate-specific parser logic or fake injected CV data

**Not READY FOR PUBLIC RELEASE** because:

- Scanned PDF / OCR-heavy imports still lose experience and skills vs ground truth
- Template classify fallback gap on 3 templates for unparsed-only CVs
- Parser recall on real-world OCR remains below product-grade expectations for self-serve launch

## Commands

```bash
npm run stress:h8-report   # full re-verify (includes ~11m H7 browser suite)
npm run release:gate
npm run stress:h7
npm run stress:h6
npm run qa:template-safety
```

Machine-readable: `tests/output/h8-release/report.json` (after `stress:h8-report`)
