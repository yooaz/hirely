# GENERALIZATION STRESS REPORT

Generated: 2026-06-07T23:41:37.125Z
Engine: `HIRELY_H8_GENERALIZATION_STRESS`

## Verdict

# **PASS**

**100/100** successful extractions (100%). Goal: **≥ 95%**.
Full pipeline (OCR → PDF): **100/100** (100%).

## Acceptance

| Criterion | Result |
|-----------|--------|
| Extraction success | 100% (≥ 95%) |
| Corpus size | 100 resumes |
| Archetypes | 10 |

## Pipeline

```
Synthetic CV text
  → simulateOcrScan() + postProcessOcrText
  → runHirelyImportFromText (Parser)
  → sanitizeResumeForDisplay (Normalizer)
  → HirelyTemplates.render (Renderer)
  → Playwright A4 PDF (PDF)
```

## Summary

| Metric | Value |
|--------|------:|
| Total | 100 |
| Extracted | 100 |
| Extraction rate | 100% |
| Full pipeline pass | 100 |
| Pipeline rate | 100% |

## By archetype

| Archetype | Extracted | Pipeline | Total |
|-----------|----------:|---------:|------:|
| consultant | 10 | 10 | 10 |
| designer | 10 | 10 | 10 |
| developer | 10 | 10 | 10 |
| executive | 10 | 10 | 10 |
| finance | 10 | 10 | 10 |
| healthcare | 10 | 10 | 10 |
| legal | 10 | 10 | 10 |
| marketing | 10 | 10 | 10 |
| sales | 10 | 10 | 10 |
| student | 10 | 10 | 10 |

## Module map

| File | Role |
|------|------|
| `tests/lib/h8-generalization-catalog.mjs` | 100 synthetic CV corpus |
| `tests/lib/h8-ocr-simulate.mjs` | OCR noise + postProcessOcrText |
| `src/core/pipeline/hirely-import.js` | Parser import |
| `src/core/validation/sanitize-resume-display.js` | Normalizer |
| `src/ui/templates/cv-templates.js` | Renderer |
| `src/tests/lib/pdf-export-playwright.mjs` | PDF export QA |
| `src/tests/lib/h8-stress-suite.mjs` | H8 runner |

## Verification

```bash
npm run qa:generalization-stress
npm run generalization:stress-report
```
