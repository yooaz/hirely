# TEMPLATE LOCK REPORT (P5)

Generated: 2026-06-08T17:43:46.393Z
Lock: `TEMPLATE_SYSTEM_P5_LOCK`
Version: `p5`

## Status

| Gate | Result |
|------|--------|
| Production templates (3 only) | PASS |
| Same `finalResumeData` for all templates | PASS |
| Render-only (no parser / OCR / ATS) | PASS |
| PDF export | PASS |
| No horizontal crop (794px A4) | PASS |

## Locked templates

| ID | Display name | Layout |
|----|--------------|--------|
| `ats` | ATS Clean | single |
| `creative` | Creative Portfolio | magazine |
| `executive-minimal` | Executive Minimal | single |

## Rules

| Rule | Enforcement |
|------|-------------|
| Single data source | `finalResumeData` via `resumeDataToTemplateView()` |
| Render only | `true` — templates never import or parse |
| No parser duplication | `true` |
| No OCR in templates | `true` |
| No ATS scoring in templates | `true` |
| Preview = export | `true` |

## Data parity

All three templates receive the same view-model from `finalResumeData`:

- Identity: name, title, email, location
- Sections: experiences, education, skills, tools, languages, clients, projects
- Layout differs; **facts do not**

## Render samples (bytes)

- **ATS Clean**: 1916 bytes HTML
- **Creative Portfolio**: 2080 bytes HTML
- **Executive Minimal**: 1734 bytes HTML

## Module map

| File | Role |
|------|------|
| `src/ui/templates/production-template-ids.mjs` | Canonical 3-template lock |
| `src/ui/templates/cv-templates.js` | Render layers + `listProduction()` |
| `src/ui/templates/v2/view-model.js` | `finalResumeData` → template view |
| `src/ui/templates/v2/registry.js` | Template metadata + legacy aliases |
| `src/ui/templates/cv-templates-professional.css` | Typography + overflow safety |
| `src/ui/templates/cv-pdf-export.css` | A4 PDF export (no clip) |
| `index.html` | Picker uses `listProduction()` in production |

## Verification

```bash
npm run qa:template-lock
npm run template-lock-report
npm run qa:template-export
```
