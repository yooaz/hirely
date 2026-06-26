# UX Simplification Report

**Generated:** 2026-06-16T06:49:24.151Z
**Target:** Complete onboarding in **under 60 seconds**
**Gate status:** **PASS** (16/16 checks)

## Canonical flow

```
UPLOAD → ANALYZE → SELECT TEMPLATE → DOWNLOAD
```

| Step | docStep | User label (EN) | FR label | Primary UI |
| --- | --- | --- | --- | --- |
| 1 | `import` | UPLOAD | Déposer | Drop PDF / Word / paste text |
| 2 | `edit` | ANALYZE | Analyser | CV preview + recruiter read sidebar; auto-advance ~1.6s when ready |
| 3 | `style` | SELECT TEMPLATE | Choisir un modèle | Template gallery only on this step |
| 4 | `export` | DOWNLOAD | Télécharger | A4 preview + Download PDF |

## Design principles applied

1. **Four steps only** — progress nav maps 1:1 to user mental model (no verify, no extraction gate screen).
2. **Recruiter language** — "Analyze" not "Parse/OCR"; "Download" not "Export packet"; loading copy describes outcomes not pipelines.
3. **Reduced cognitive load** — import panel is drop zone + paste fallback only; advanced options hidden in production CSS.
4. **Fast track** — `HIRELY_FAST_ONBOARDING` + `maybeFastTrackOnboarding()` auto-advances to template when profile is ready and review queue is empty (~1.6s on analyze step).

## Removed / hidden (production)

- LinkedIn merge block on step 1
- Format guide (supported/unsupported lists)
- Role, industry, job description, photo fields on import
- Detected profile `<details>` panel
- Extraction quality checklist before template
- Duplicate step headers (studio/style/export kicker blocks)
- MVP import banner after upload
- Technical loading labels (OCR, parser, extraction pipeline)

## Static checks

| Check | Status | Detail |
| --- | --- | --- |
| file:ux-simplification-css | PASS | — |
| index:links-ux-css | PASS | — |
| flag:fast-onboarding | PASS | — |
| fn:maybeFastTrackOnboarding | PASS | — |
| flow:4-progress-steps | PASS | — |
| label:progress-upload | PASS | — |
| label:progress-analyze | PASS | — |
| label:progress-download | PASS | — |
| hide:linkedin | PASS | — |
| hide:format-guide | PASS | — |
| hide:detected-details | PASS | — |
| hide:import-options | PASS | — |
| hide:extraction-quality-step | PASS | — |
| copy:recruiter-analyze | PASS | — |
| copy:flow-cta-download | PASS | — |
| auto:fast-track-call | PASS | — |

## Files changed

| File | Role |
| --- | --- |
| `index.html` | Step labels, i18n, fast-track, CTA copy |
| `src/ui/product/ux-simplification.css` | Hide non-essential import/review chrome |
| `scripts/ux-simplification-report.mjs` | This report |

## Verification

```bash
npm run ux-simplification-report
```

Manual 60s test:

1. Open app → click **Déposer mon CV** → upload a text PDF.
2. Wait for analyze (sidebar shows recruiter read) — should auto-advance to templates if clean CV.
3. Tap a template → **Télécharger le PDF**.

## Success criteria

| Criterion | Target |
| --- | --- |
| Steps visible to user | 4 |
| Time import → template (clean CV) | < 20s |
| Time import → PDF download (Pro) | < 60s |
| Technical terms in primary UI | None (OCR/parser/extraction hidden) |
