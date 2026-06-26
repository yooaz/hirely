# DETECTION_PANEL_CONSISTENCY_REPORT

**Status:** PASS
**Source:** `finalResumeData` only (no cvData / merged sectionCounts)
**Generated:** 2026-06-10T23:51:13.315Z

## Rule

The detection panel (`#extractionQualityStep`) must never contradict the CV preview.

| finalResumeData | Panel label |
|-----------------|-------------|
| `education.length > 0` | Formation détectée |
| `experiences.length > 0` | Expérience détectée |
| `skills.length > 0` or `tools.length > 0` | Compétences détectées |

## Code changes

- `src/ui/product/extraction-quality-step.js` — counts sections from `finalResumeData` only; object-aware education entries
- `index.html` — `buildExtractionQualityReport()` passes only `finalResumeData`
- `index.html` — `sectionCountsFromFinalResume()` handles education objects (`school`, `degree`, `display`, …)

## Yoaz CV (`yoaz-cv`)

**Result:** PASS

| Section | finalResumeData count | Panel | Preview DOM |
|---------|----------------------|-------|-------------|
| experience | 2 | ✓ Expérience détectée | ✓ |
| education | 2 | ✓ Formation détectée | ✓ |
| skills | 8 | ✓ Compétences détectées | ✓ |

## Second uploaded CV (`second-uploaded-cv`)

**Result:** PASS

| Section | finalResumeData count | Panel | Preview DOM |
|---------|----------------------|-------|-------------|
| experience | 3 | ✓ Expérience détectée | ✓ |
| education | 2 | ✓ Formation détectée | ✓ |
| skills | 11 | ✓ Compétences détectées | ✓ |

## Verify

```bash
npm run qa:detection-panel-consistency
npm run detection-panel-consistency-report
```
