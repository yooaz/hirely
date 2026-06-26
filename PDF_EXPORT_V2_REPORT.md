# PDF Export V2

Generated: 2026-06-14
Engine: `PDF_EXPORT_V2`
Packet: `PDF_EXPORT_V2`

## Problem

The legacy export path captured the entire CV stack as one tall canvas (html2canvas → single JPEG → jsPDF). This produced:

- Screenshot-like output (raster blur, no crisp page boundaries)
- Clipping when `windowHeight` underestimated multi-page stacks
- Page-break bugs across `.cvA4Sheet` gaps
- Font and image shifts when preview zoom/scale was active during capture

## Solution — Premium packet export

PDF Export V2 assembles a **discrete A4 packet** page-by-page:

1. **Cover page** — candidate name, title, recruiter score, template, date
2. **Candidate summary** — contact, stats, professional summary
3. **Audit score** — recruiter / confidence / ATS scores + dimension bars
4. **Recruiter notes** — strengths, weaknesses, missing fields, interview risks
5. **Recommendations** — actionable next steps before sending
6+ **CV pages** — cloned `.cvA4Sheet` nodes from live `#cvDoc` preview (WYSIWYG)

Each page is rasterized at **794×1123 px** (scale 2) and placed on its own jsPDF A4 sheet — no cross-page clipping.

## A4 contract

| Constant | Value |
|----------|-------|
| Width (px) | 794 |
| Height (px) | 1123 |
| Width (mm) | 210 |
| Height (mm) | 297 |

## Preview ≡ export guarantees

- `HirelyA4Viewport.suspendScaleForExport()` before capture
- `applyExportMode()` on `#cvDoc` — 794px width, no transform
- CV sheets **cloned** from `.cvA4Stack .cvA4Sheet` (same DOM as preview)
- `document.fonts.ready` + 200ms settle before rasterize
- Per-page fixed `windowWidth` / `windowHeight` — no tall-stack underestimate

## Production path

```
downloadPDF()
  → prepareLockedCvExport()
  → buildPdfExportV2Context()
  → HirelyPdfExportV2.buildExportRoot(#cvDoc, packet)
  → HirelyPdfExport.exportPacketV2(exportRoot, filename)
```

Email export uses the same packet via `exportPacketV2Blob()`.

## Files

| File | Role |
|------|------|
| `src/core/export/pdf-export-v2.js` | Packet builder (cover, summary, audit, notes, recs) |
| `src/ui/export/pdf-export-v2.js` | DOM page builders + CV sheet clone |
| `src/ui/export/pdf-export-v2.css` | Fixed A4 typography for audit pages |
| `src/ui/export/hirely-pdf-export.js` | Page-by-page jsPDF assembly (`exportPacketV2`) |
| `index.html` | Wired `downloadPDF()` + `emailCV()` |

## Corpus packet preview

| Fixture | Score | Audit pages | Est. CV pages | Total pages | Cover name |
|---------|-------|-------------|---------------|-------------|------------|
| Developer CV | 73 | 5 | 2 | 7 | Candidate |
| Marketing CV | 72 | 5 | 1 | 6 | Candidate |
| Consultant CV | 84 | 5 | 2 | 7 | Candidate |
| Creative CV | 30 | 5 | 1 | 6 | Candidate |

## Sample recommendations (developer-cv)

- Strengthen Tools section
- Strengthen Summary section
- Address: Experience lacks measurable results
- Address: Summary missing
- Address: No LinkedIn profile

### Recruiter notes excerpt

**Strengths**
- Name and job title clear
- Contact information complete
- Experience section present
- 11 years experience
- Experience dates included
- Education listed

**Weaknesses**
- Experience lacks measurable results
- Summary missing
- No LinkedIn profile

## QA

```bash
npm run qa:pdf-export-v2
npm run pdf-export-v2-report
```

## Fallback

If `HirelyPdfExportV2` or `exportPacketV2` is unavailable, `downloadPDF()` falls back to legacy `exportCvToPdf()` (P6 single-stack path).
