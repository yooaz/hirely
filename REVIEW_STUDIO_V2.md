# Review Studio V2

Recruiter-first review workflow for Hirely. Replaces the unfinished 3-column mix (preview / suggestions / editor) with a gated 4-step product flow.

## Product flow

| Step | ID | Purpose |
|------|-----|---------|
| 1. Import | `import` | Upload or paste CV |
| 2. Review | `edit` | Classify lines, fix gaps, read recruiter analysis |
| 3. Style | `style` | Pick template and spacing |
| 4. Export | `export` | Download PDF |

Progress nav labels: **Import → Review → Style → Export** (`progressReview` in i18n).

## Review layout (Step 2)

Three columns on `docStep-edit` (non-debug):

```
┌─────────────────┬──────────────────┬─────────────────────┐
│  LEFT           │  CENTER          │  RIGHT              │
│  A4 live preview│  Unclassified    │  Recruiter analysis │
│  (#studioPreview)│  queue          │  (#reviewStudioAnalysis)│
│                 │  (#reviewStudioCenter)                  │
└─────────────────┴──────────────────┴─────────────────────┘
```

- **Left** — existing A4 viewport + live CV (`studioPreview`, `HirelyA4Viewport`).
- **Center** — `#toClassifyPanel` moved into `#reviewStudioCenter`. User places imported lines via Smart Repair selects.
- **Right** — `#reviewStudioAnalysis` with completion %, ATS score, gaps, and detected data.

Legacy `#wsInsights` and `#studioRail` are hidden in production review mode.

## Export gate

**“Ready for export”** (`#reviewV2ReadyBadge`) appears only when all four gates pass:

| Gate | Rule |
|------|------|
| Identity ✓ | Valid name **and** (title **or** email **or** phone) |
| Experience ✓ | ≥1 experience line; fails if only unclassified lines remain |
| Education ✓ | ≥1 education entry |
| Skills ✓ | ≥1 skill or tool |

- Completion % = `(passed gates / 4) × 100`
- Style and Export steps are disabled until `exportReady`
- `downloadPDF()` returns early with `reviewV2ExportBlocked` if not ready
- No empty or partial CV can reach export without satisfying all four gates

## Recruiter analysis panel

Rendered by `renderReviewStudioV2()` in `index.html`, fed by `buildReviewReadinessReport()`:

| Block | Source |
|-------|--------|
| Completion ring | `completionPct` |
| Export badge | `exportReady` |
| Gate checklist | `gates.identity/experience/education/skills` |
| ATS score | `computeProductScoreReport().total` + band |
| Missing sections | identity, summary, experience, education, skills, languages |
| Missing dates | Experience lines without `19xx/20xx` year |
| Duplicate experiences | Normalized line dedup |
| Detected languages | `cvData.languages` |
| Detected skills | `skills` + `tools` |
| Detected contact | name, title, email, phone, linkedin, location |

## Files

| File | Role |
|------|------|
| `src/core/validation/review-readiness.js` | Gate logic + analysis report |
| `src/ui/studio/review-studio-v2.css` | 3-column layout + analysis UI |
| `src/ui/studio/studio-layout.css` | Grid areas: `preview \| center \| analysis` |
| `index.html` | DOM, `renderReviewStudioV2`, `isExportReady`, nav/download gates |
| `src/tests/qa-review-studio-v2.mjs` | Unit tests |

## QA

```bash
npm run qa:review-studio-v2
```

## Debug mode

Unchanged: classify panel stays in `#verifyPanel`, legacy insights/editor remain available when `?debug=1`.

## Verification checklist

- [ ] Import CV → lands on Review step
- [ ] Center column shows unclassified lines (or empty state)
- [ ] Right column updates completion % and ATS score live
- [ ] Style/Export nav disabled until 4 gates green
- [ ] “Prêt pour l’export” visible only when all gates pass
- [ ] PDF download blocked until export-ready
