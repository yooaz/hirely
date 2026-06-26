# HIRELY P1 — PDF Export Hardening

**Result:** PASS
**Generated:** 2026-06-10T17:01:29.696Z
**Engine:** `PDF_EXPORT_P6`

## Audit scope

Verify **preview ≡ exported PDF**:
- Same content (identity, sections, entries)
- Same page count (`.cvA4Sheet` count vs PDF pages)
- Same sections (clients, projects, portfolio, experience, education, skills, tools, languages)
- No disappearing blocks
- No overflow / clipping in export DOM

## Status

| Gate | Result |
|------|--------|
| P1 preview ↔ PDF parity | **PASS** |
| P6 A4 hardening (clip/overflow/pages) | **PASS** |

## A4 specification

| Unit | Width | Height |
|------|------:|-------:|
| CSS px | 794 | 1123 |
| mm | 210 | 297 |

## Margins

Playwright QA print: **12/14/12/14 mm**
Browser html2pdf: **0 margin** (pre-paginated `.cvA4Sheet` stack at 794×1123px)

## Hardening fixes (P1)

- QA export HTML now loads **`cv-templates-pack.css`** + **`cv-templates-h20.css`** (parity with live preview)
- Export mode: **`overflow: visible`** on `.cvA4Sheet`, `.cvA4Sheet__surface`, `.cvInner` (no clip before capture)
- Premium template print rules for `minimal-swiss`, `art-director`, `behance-showcase`, `magazine-editorial`, `illustrator-portfolio`
- New `auditPreviewPdfParity()` — section markers, structural DOM hints, page count, identity, clipping scan
- **`magazine-editorial` A4 fix** — `cv-a4-pages.js` now collects `.cvCol--meta/center/right` (3-column body was dropped during pagination)
- **`magazine-editorial` CSS** — grid rules applied to `template-magazine-editorial` (not only legacy `editorial-magazine` alias)

## Scenarios

| Scenario | Template | Checks |
|----------|----------|--------|
| Rich single-page | `portfolio-artist` | All sections, page parity |
| Rich multi-page | `creative-director` | 2+ pages, no clip |
| Long Swiss | `minimal-swiss` | 2+ pages, grid export |
| All 10 premium templates | production pack | Section parity per template |

## Template parity results

| Template | Preview sheets | PDF pages | Parity | Sections |
|----------|---------------:|----------:|:------:|:--------:|
| Portfolio Artist | 2 | 2 | ✓ | ✓ |
| Creative Director | 2 | 2 | ✓ | ✓ |
| Minimal Swiss | 2 | 2 | ✓ | ✓ |
| Portfolio Artist | 2 | 2 | ✓ | ✓ |
| Creative Director | 2 | 2 | ✓ | ✓ |
| Luxury Fashion | 2 | 2 | ✓ | ✓ |
| Behance Showcase | 2 | 2 | ✓ | ✓ |
| Magazine Editorial | 1 | 1 | ✓ | ✓ |
| Agency Designer | 2 | 2 | ✓ | ✓ |
| Visual Timeline | 2 | 2 | ✓ | ✓ |
| Art Director | 2 | 2 | ✓ | ✓ |
| Illustrator Portfolio | 2 | 2 | ✓ | ✓ |
| Minimal Swiss | 2 | 2 | ✓ | ✓ |

## Production templates verified

- `portfolio-artist` — Portfolio Artist
- `creative-director` — Creative Director
- `luxury-fashion` — Luxury Fashion
- `behance-showcase` — Behance Showcase
- `magazine-editorial` — Magazine Editorial
- `agency-designer` — Agency Designer
- `visual-timeline` — Visual Timeline
- `art-director` — Art Director
- `illustrator-portfolio` — Illustrator Portfolio
- `minimal-swiss` — Minimal Swiss

## Pipeline

```
Live preview:  renderCV() → layoutCvA4Pages(#cvDoc) → HirelyA4Viewport zoom
Browser PDF:   prepareLockedCvExport() → suspendScaleForExport()
               → body.export-pdf → html2pdf (794×captureH, sheet breaks)

QA PDF:        buildPdfExportHtml (+ pack CSS) → layoutCvA4Pages
               → auditPreviewPdfParity + auditExportDom → Playwright print
```

## Module map

| File | Role |
|------|------|
| `src/ui/export/hirely-pdf-export.js` | Browser html2pdf capture |
| `src/ui/export/cv-a4-pages.js` | A4 sheet pagination (preview ≡ export DOM) |
| `src/ui/export/cv-a4-pages.css` | Sheet stack + export overflow visible |
| `src/ui/templates/cv-pdf-export.css` | Print rules, break-avoid, no clip |
| `src/tests/lib/pdf-export-playwright.mjs` | QA print + `auditPreviewPdfParity` |
| `src/tests/qa-pdf-export-p1-hardening.mjs` | P1 preview↔PDF acceptance |

## Run

```bash
npm run test:pdf-export-hardening
```

## Acceptance

**PASS** — Preview and exported PDF share content, page count, and sections. No clipped or overflow-hidden export blocks detected.
