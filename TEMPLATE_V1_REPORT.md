# TEMPLATE_V1_REPORT

Generated: 2026-06-08T11:08:55.041Z
System: HIRELY H3 (h3)
P7 prerequisite: **PASS**
Template selector QA: **PASS**

## Template selector

Three production templates in `#templateGrid` (Style step). Same `finalResumeData` for all — render layers only.

| # | ID | Display name |
|---|-----|--------------|
| 1 | `ats` | ATS Clean |
| 2 | `creative` | Creative Portfolio |
| 3 | `executive-minimal` | Executive Minimal |

## Acceptance

| Criterion | Status |
|-----------|--------|
| 3 templates selectable | ✅ |
| Preview updates on selection | ✅ |
| PDF exports selected template | ✅ |
| Same finalResumeData (name preserved) | ✅ |
| No parser logic in template HTML | ✅ |
| A4-safe preview width | ✅ |

## QA checks

| Check | Status | Detail |
|-------|--------|--------|
| `import_fixture` | PASS | live preview |
| `selector_three_cards` | PASS | count=3 ids=ats,creative,executive-minimal |
| `selector_canonical_ids` | PASS | ats,creative,executive-minimal |
| `selector_display_names` | PASS | ATS Clean \| Creative Portfolio \| Executive Minimal |
| `ats_card_visible` | PASS | ats |
| `ats_preview_updates` | PASS | active=ats class=cv cv-page template-ats spacing-normal cv--live cv--a4 |
| `ats_same_resume_data` | PASS | Yohann Azancot |
| `creative_card_visible` | PASS | creative |
| `creative_preview_updates` | PASS | active=creative class=cv cv-page template-creative spacing-normal cv--live cv--a4 |
| `creative_same_resume_data` | PASS | Yohann Azancot |
| `executive-minimal_card_visible` | PASS | executive-minimal |
| `executive-minimal_preview_updates` | PASS | active=executive-minimal class=cv cv-page template-executive-minimal spacing-normal cv--live cv--a4 |
| `executive-minimal_same_resume_data` | PASS | Yohann Azancot |
| `preview_differs_by_template` | PASS | template-ats → template-creative → template-executive-minimal |
| `a4_preview_width` | PASS | layout=794x0 a4=true |
| `ats_pdf_export` | PASS | 160069 bytes pages=2 classOk=true |
| `creative_pdf_export` | PASS | 156163 bytes pages=2 classOk=true |
| `executive-minimal_pdf_export` | PASS | 153850 bytes pages=2 classOk=true |
| `no_parser_in_template_html` | PASS | render-only |

## PDF artifacts

- `tests/output/template-v1-selector/v1-ats.pdf` — ATS Clean
- `tests/output/template-v1-selector/v1-creative.pdf` — Creative Portfolio
- `tests/output/template-v1-selector/v1-executive-minimal.pdf` — Executive Minimal

## Key files

| File | Role |
|------|------|
| `index.html` — `renderTemplates()` / `#templateGrid` | UI selector (3 cards) |
| `src/ui/templates/production-template-ids.mjs` | Canonical template IDs + labels |
| `src/ui/templates/cv-templates.js` | Render layers (no parser) |
| `src/ui/export/hirely-pdf-export.js` | PDF export uses `state.template` |

## Verification

```bash
npm run qa:p7-final-lock      # prerequisite
npm run qa:template-v1-selector
npm run template-v1-report
```

<details><summary>Selector QA stdout</summary>

```
OK import_fixture live preview
OK selector_three_cards count=3 ids=ats,creative,executive-minimal
OK selector_canonical_ids ats,creative,executive-minimal
OK selector_display_names ATS Clean | Creative Portfolio | Executive Minimal
OK ats_card_visible ats
OK ats_preview_updates active=ats class=cv cv-page template-ats spacing-normal cv--live cv--a4
OK ats_same_resume_data Yohann Azancot
OK creative_card_visible creative
OK creative_preview_updates active=creative class=cv cv-page template-creative spacing-normal cv--live cv--a4
OK creative_same_resume_data Yohann Azancot
OK executive-minimal_card_visible executive-minimal
OK executive-minimal_preview_updates active=executive-minimal class=cv cv-page template-executive-minimal spacing-normal cv--live cv--a4
OK executive-minimal_same_resume_data Yohann Azancot
OK preview_differs_by_template template-ats → template-creative → template-executive-minimal
OK a4_preview_width layout=794x0 a4=true
OK ats_pdf_export 160069 bytes pages=2 classOk=true
OK creative_pdf_export 156163 bytes pages=2 classOk=true
OK executive-minimal_pdf_export 153850 bytes pages=2 classOk=true
OK no_parser_in_template_html render-only

qa-template-v1-selector: PASS
```
</details>