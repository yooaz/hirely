# Template Quality Gate Report (P0)

**Verdict:** PASS

**Engine:** `TEMPLATE_QUALITY_GATE_V1`

**Generated:** 2026-06-12T19:10:32.782Z

**Score:** 102/102

**First-page density floor:** 55%

## Mission

Every production template must render hire-ready output: no clipping, no overflow, no fake or parser artifacts, correct identity fields, readable at 100% zoom, and a printable A4 PDF with useful first-page density.

## Per-template summary

| Display name | ID | Page-1 fill | Blank tail | Verdict | Failed rules |
|--------------|-----|-------------|------------|---------|--------------|
| ATS Clean | `ats-elite` | 64.7% | 90.4% | PASS | — |
| Executive Minimal | `ats-executive` | 74.7% | 87.9% | PASS | — |
| Modern Editorial | `editorial-magazine` | 61.7% | 74.5% | PASS | — |
| Creative Portfolio | `creative-director` | 97.9% | 75.5% | PASS | — |
| Tech Structured | `tech-structured` | 68.7% | 84.4% | PASS | — |
| Consultant Compact | `agency-designer` | 69.2% | 86% | PASS | — |
| Luxury Serif | `executive-luxury` | 94.8% | 83.4% | PASS | — |
| Startup Builder | `startup-builder` | 70.3% | 81.9% | PASS | — |
| Art Director Portfolio | `art-director-portfolio` | 94.5% | 74.4% | PASS | — |
| Classic Corporate | `swiss-editorial` | 71.1% | 90.5% | PASS | — |

## Rules (all templates)

| Rule | Result |
|------|--------|
| no_cropped_text | PASS |
| no_excessive_blank_space | PASS |
| no_text_overflow | PASS |
| no_fake_content | PASS |
| no_parser_labels | PASS |
| no_wrong_email | PASS |
| no_company_as_name | PASS |
| readable_at_100 | PASS |
| printable_pdf | PASS |
| first_page_density_55 | PASS |

## Rule definitions

| Rule | What it checks |
|------|----------------|
| no_cropped_text | No overflow-hidden nodes with scrollHeight > clientHeight on headers/bodies |
| no_excessive_blank_space | Blank tail below last block ≤ 42% when fill is low |
| no_text_overflow | No horizontal scroll / client_crop on export DOM |
| no_fake_content | No lorem, placeholder, john/jane doe, TODO |
| no_parser_labels | No debug labels, undetected copy, or À classer leakage |
| no_wrong_email | Rendered email matches fixture; no mutated local-part |
| no_company_as_name | `cvName` passes `isAcceptableDisplayName` |
| readable_at_100 | No sub-8px body text; no scale-down transform on `.cv` |
| printable_pdf | Playwright A4 PDF + `validatePdfHardening` |
| first_page_density_55 | Page-1 content fill ≥ **55%** when 4+ sections populated |

## All checks

| Check | Result | Detail |
|-------|--------|--------|
| engine_version | PASS | — |
| template_count | PASS | — |
| ats-elite:no_fake_content | PASS | — |
| ats-elite:no_parser_labels | PASS | — |
| ats-elite:no_wrong_email | PASS | alex@venture.example |
| ats-elite:no_company_as_name | PASS | Alex Morgan |
| ats-elite:no_cropped_text | PASS | clipped=0 |
| ats-elite:no_text_overflow | PASS | — |
| ats-elite:readable_at_100 | PASS | tiny=0 |
| ats-elite:first_page_density_55 | PASS | 64.7% (min 55%) |
| ats-elite:no_excessive_blank_space | PASS | tail=90.4% fill=64.7% |
| ats-elite:printable_pdf | PASS | — |
| ats-executive:no_fake_content | PASS | — |
| ats-executive:no_parser_labels | PASS | — |
| ats-executive:no_wrong_email | PASS | alex@venture.example |
| ats-executive:no_company_as_name | PASS | Alex Morgan |
| ats-executive:no_cropped_text | PASS | clipped=0 |
| ats-executive:no_text_overflow | PASS | — |
| ats-executive:readable_at_100 | PASS | tiny=0 |
| ats-executive:first_page_density_55 | PASS | 74.7% (min 55%) |
| ats-executive:no_excessive_blank_space | PASS | tail=87.9% fill=74.7% |
| ats-executive:printable_pdf | PASS | — |
| editorial-magazine:no_fake_content | PASS | — |
| editorial-magazine:no_parser_labels | PASS | — |
| editorial-magazine:no_wrong_email | PASS | alex@venture.example |
| editorial-magazine:no_company_as_name | PASS | — |
| editorial-magazine:no_cropped_text | PASS | clipped=0 |
| editorial-magazine:no_text_overflow | PASS | — |
| editorial-magazine:readable_at_100 | PASS | tiny=0 |
| editorial-magazine:first_page_density_55 | PASS | 61.7% (min 55%) |
| editorial-magazine:no_excessive_blank_space | PASS | tail=74.5% fill=61.7% |
| editorial-magazine:printable_pdf | PASS | — |
| creative-director:no_fake_content | PASS | — |
| creative-director:no_parser_labels | PASS | — |
| creative-director:no_wrong_email | PASS | alex@venture.example |
| creative-director:no_company_as_name | PASS | Alex Morgan |
| creative-director:no_cropped_text | PASS | clipped=0 |
| creative-director:no_text_overflow | PASS | — |
| creative-director:readable_at_100 | PASS | tiny=0 |
| creative-director:first_page_density_55 | PASS | 97.9% (min 55%) |
| creative-director:no_excessive_blank_space | PASS | tail=75.5% fill=97.9% |
| creative-director:printable_pdf | PASS | — |
| tech-structured:no_fake_content | PASS | — |
| tech-structured:no_parser_labels | PASS | — |
| tech-structured:no_wrong_email | PASS | alex@venture.example |
| tech-structured:no_company_as_name | PASS | Alex Morgan |
| tech-structured:no_cropped_text | PASS | clipped=0 |
| tech-structured:no_text_overflow | PASS | — |
| tech-structured:readable_at_100 | PASS | tiny=0 |
| tech-structured:first_page_density_55 | PASS | 68.7% (min 55%) |
| tech-structured:no_excessive_blank_space | PASS | tail=84.4% fill=68.7% |
| tech-structured:printable_pdf | PASS | — |
| agency-designer:no_fake_content | PASS | — |
| agency-designer:no_parser_labels | PASS | — |
| agency-designer:no_wrong_email | PASS | alex@venture.example |
| agency-designer:no_company_as_name | PASS | Alex Morgan |
| agency-designer:no_cropped_text | PASS | clipped=0 |
| agency-designer:no_text_overflow | PASS | — |
| agency-designer:readable_at_100 | PASS | tiny=0 |
| agency-designer:first_page_density_55 | PASS | 69.2% (min 55%) |
| agency-designer:no_excessive_blank_space | PASS | tail=86.0% fill=69.2% |
| agency-designer:printable_pdf | PASS | — |
| executive-luxury:no_fake_content | PASS | — |
| executive-luxury:no_parser_labels | PASS | — |
| executive-luxury:no_wrong_email | PASS | alex@venture.example |
| executive-luxury:no_company_as_name | PASS | Alex Morgan |
| executive-luxury:no_cropped_text | PASS | clipped=0 |
| executive-luxury:no_text_overflow | PASS | — |
| executive-luxury:readable_at_100 | PASS | tiny=0 |
| executive-luxury:first_page_density_55 | PASS | 94.8% (min 55%) |
| executive-luxury:no_excessive_blank_space | PASS | tail=83.4% fill=94.8% |
| executive-luxury:printable_pdf | PASS | — |
| startup-builder:no_fake_content | PASS | — |
| startup-builder:no_parser_labels | PASS | — |
| startup-builder:no_wrong_email | PASS | alex@venture.example |
| startup-builder:no_company_as_name | PASS | Alex Morgan |
| startup-builder:no_cropped_text | PASS | clipped=0 |
| startup-builder:no_text_overflow | PASS | — |
| startup-builder:readable_at_100 | PASS | tiny=0 |
| startup-builder:first_page_density_55 | PASS | 70.3% (min 55%) |
| startup-builder:no_excessive_blank_space | PASS | tail=81.9% fill=70.3% |
| startup-builder:printable_pdf | PASS | — |
| art-director-portfolio:no_fake_content | PASS | — |
| art-director-portfolio:no_parser_labels | PASS | — |
| art-director-portfolio:no_wrong_email | PASS | alex@venture.example |
| art-director-portfolio:no_company_as_name | PASS | Alex Morgan |
| art-director-portfolio:no_cropped_text | PASS | clipped=0 |
| art-director-portfolio:no_text_overflow | PASS | — |
| art-director-portfolio:readable_at_100 | PASS | tiny=0 |
| art-director-portfolio:first_page_density_55 | PASS | 94.5% (min 55%) |
| art-director-portfolio:no_excessive_blank_space | PASS | tail=74.4% fill=94.5% |
| art-director-portfolio:printable_pdf | PASS | — |
| swiss-editorial:no_fake_content | PASS | — |
| swiss-editorial:no_parser_labels | PASS | — |
| swiss-editorial:no_wrong_email | PASS | alex@venture.example |
| swiss-editorial:no_company_as_name | PASS | Alex Morgan |
| swiss-editorial:no_cropped_text | PASS | clipped=0 |
| swiss-editorial:no_text_overflow | PASS | — |
| swiss-editorial:readable_at_100 | PASS | tiny=0 |
| swiss-editorial:first_page_density_55 | PASS | 71.1% (min 55%) |
| swiss-editorial:no_excessive_blank_space | PASS | tail=90.5% fill=71.1% |
| swiss-editorial:printable_pdf | PASS | — |

## Fixture

Rich `finalResumeData` (Alex Morgan — product lead) via `resumeDataToTemplateView` → `HirelyTemplates.render`.

## Run

```bash
npm run qa:template-quality-gate
npm run template-quality-gate-report
```

## Bench output

```
PASS engine_version
PASS template_count
CV_TEMPLATE_BOOT_OK
PASS ats-elite:no_fake_content
PASS ats-elite:no_parser_labels
PASS ats-elite:no_wrong_email
PASS ats-elite:no_company_as_name
PASS ats-elite:no_cropped_text
PASS ats-elite:no_text_overflow
PASS ats-elite:readable_at_100
PASS ats-elite:first_page_density_55
PASS ats-elite:no_excessive_blank_space
PASS ats-elite:printable_pdf
PASS ats-executive:no_fake_content
PASS ats-executive:no_parser_labels
PASS ats-executive:no_wrong_email
PASS ats-executive:no_company_as_name
PASS ats-executive:no_cropped_text
PASS ats-executive:no_text_overflow
PASS ats-executive:readable_at_100
PASS ats-executive:first_page_density_55
PASS ats-executive:no_excessive_blank_space
PASS ats-executive:printable_pdf
PASS editorial-magazine:no_fake_content
PASS editorial-magazine:no_parser_labels
PASS editorial-magazine:no_wrong_email
PASS editorial-magazine:no_company_as_name
PASS editorial-magazine:no_cropped_text
PASS editorial-magazine:no_text_overflow
PASS editorial-magazine:readable_at_100
PASS editorial-magazine:first_page_density_55
PASS editorial-magazine:no_excessive_blank_space
PASS editorial-magazine:printable_pdf
PASS creative-director:no_fake_content
PASS creative-director:no_parser_labels
PASS creative-director:no_wrong_email
PASS creative-director:no_company_as_name
PASS creative-director:no_cropped_text
PASS creative-director:no_text_overflow
PASS creative-director:readable_at_100
PASS creative-director:first_page_density_55
PASS creative-director:no_excessive_blank_space
PASS creative-director:printable_pdf
PASS tech-structured:no_fake_content
PASS tech-structured:no_parser_labels
PASS tech-structured:no_wrong_email
PASS tech-structured:no_company_as_name
PASS tech-structured:no_cropped_text
PASS tech-structured:no_text_overflow
PASS tech-structured:readable_at_100
PASS tech-structured:first_page_density_55
PASS tech-structured:no_excessive_blank_space
PASS tech-structured:printable_pdf
PASS agency-designer:no_fake_content
PASS agency-designer:no_parser_labels
PASS agency-designer:no_wrong_email
PASS agency-designer:no_company_as_name
PASS agency-designer:no_cropped_text
PASS agency-designer:no_text_overflow
PASS agency-designer:readable_at_100
PASS agency-designer:first_page_density_55
PASS agency-designer:no_excessive_blank_space
PASS agency-designer:printable_pdf
PASS executive-luxury:no_fake_content
PASS executive-luxury:no_parser_labels
PASS executive-luxury:no_wrong_email
PASS executive-luxury:no_company_as_name
PASS executive-luxury:no_cropped_text
PASS executive-luxury:no_text_overflow
PASS executive-luxury:readable_at_100
PASS executive-luxury:first_page_density_55
PASS executive-luxury:no_excessive_blank_space
PASS executive-luxury:printable_pdf
PASS startup-builder:no_fake_content
PASS startup-builder:no_parser_labels
PASS startup-builder:no_wrong_email
PASS startup-builder:no_company_as_name
PASS startup-builder:no_cropped_text
PASS startup-builder:no_text_overflow
PASS startup-builder:readable_at_100
PASS startup-builder:first_page_density_55
PASS startup-builder:no_excessive_blank_space
PASS startup-builder:printable_pdf
PASS art-director-portfolio:no_fake_content
PASS art-director-portfolio:no_parser_labels
PASS art-director-portfolio:no_wrong_email
PASS art-director-portfolio:no_company_as_name
PASS art-director-portfolio:no_cropped_text
PASS art-director-portfolio:no_text_overflow
PASS art-director-portfolio:readable_at_100
PASS art-director-portfolio:first_page_density_55
PASS art-director-portfolio:no_excessive_blank_space
PASS art-director-portfolio:printable_pdf
PASS swiss-editorial:no_fake_content
PASS swiss-editorial:no_parser_labels
PASS swiss-editorial:no_wrong_email
PASS swiss-editorial:no_company_as_name
PASS swiss-editorial:no_cropped_text
PASS swiss-editorial:no_text_overflow
PASS swiss-editorial:readable_at_100
PASS swiss-editorial:first_page_density_55
PASS swiss-editorial:no_excessive_blank_space
PASS swiss-editorial:printable_pdf

═══ Template Quality Gate: 102/102 PASS ═══
(node:19764) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/src/core/import/import-stability-lock.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
```
