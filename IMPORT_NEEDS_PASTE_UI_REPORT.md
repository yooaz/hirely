# IMPORT_NEEDS_PASTE — UI Report

**Result:** PASS

**Generated:** 2026-06-09T16:35:49.124Z

## Scope

P0 UI fix when import ends in `IMPORT_NEEDS_PASTE` (e.g. `PDF_EXTRACTION_TIMEOUT` / `OCR_TIMEOUT`).
UI-only — no OCR, parser, template, or pricing changes.

## Requirements

| # | Requirement | Status |
|---|-------------|--------|
| ui_paste_panel_open | Paste panel opens automatically | PASS |
| ui_needs_paste_class | `wsImport--needsPaste` applied | PASS |
| ui_import_expanded_visible | Paste panel inside visible import area | PASS |
| ui_textarea_visible | Textarea visible | PASS |
| ui_textarea_focused | Textarea receives focus | PASS |
| ui_not_loading | CV spinner cleared | PASS |
| ui_pipeline_not_busy | Import pipeline busy state cleared | PASS |
| ui_progress_hidden | Progress bar hidden | PASS |
| ui_title | Title: “Lecture automatique impossible.” | PASS |
| ui_lead | Lead: “Collez le texte du CV pour continuer.” | PASS |
| ui_filename_visible | Uploaded filename stays visible | PASS |
| ui_btn_paste | Button: Coller le texte | PASS |
| ui_btn_retry | Button: Réessayer la lecture PDF | PASS |
| ui_btn_other_file | Button: Changer de fichier | PASS |
| ui_paste_in_import_area | Panel not in hidden review/product container | PASS |
| race_paste_stays_open | Late OCR events do not hide paste panel | PASS |
| race_no_spinner_restart | Late OCR events do not restart spinner | PASS |
| race_progress_stays_hidden | Late OCR events do not show progress | PASS |
| paste_review_visible | Paste → parser → review screen | PASS |
| paste_parser_name | Parsed CV shows candidate name | PASS |
| paste_panel_closed_after_import | Paste panel closes after successful paste | PASS |
| paste_pipeline_logged | Pipeline logs REVIEW_SCREEN_VISIBLE | PASS |

## Changes

- `index.html` — `ensureImportNeedsPasteVisible()`, `wsImport--needsPaste` CSS, race guards on `setProgress` / `finally`, updated copy and button labels

## QA command

```bash
npm run qa:import-needs-paste-ui
```

## Test output

```
 skills: 2, tools: 1} | PARSER_DONE | IMPORT_ERROR RangeError: Maximum call stack size exceeded
    at String.replace (<anonymous>)
    at escapeRegex (http://127.0.0.1:3105/src/data/dictionaries/match-utils.js:4:20)
    at termRegex (http://127.0.0.1:3105/src/data/dictionaries/match-utils.js:8:27)
    at findLongestDictionaryTerm (http://127.0.0.1:3105/src/data/dictionaries/json-dictionary-match.js:65:19)
    at hasEducationSchool (http://127.0.0.1:3105/src/core/parsing/education-confidence.js:92:7)
    at scoreEducationConfidence (http://127.0.0.1:3105/src/core/parsing/education-confidence.js:131:23)
    at mustNeverBeExperience (http://127.0.0.1:3105/src/core/parsing/education-confidence.js:167:15)
    at lineIsEducationData (http://127.0.0.1:3105/src/core/parsing/experience-parser.js:141:7)
    at qualifiesStrictExperience (http://127.0.0.1:3105/src/core/parsing/experience-parser.js:283:36)
    at scoreStrictExperienceEntry (http://127.0.0.1:3105/src/core/parsing/experience-parser.js:304:8) | IMPORT_ERROR RangeError: Maximum call stack size exceeded
    at String.replace (<anonymous>)
    at escapeRegex (http://127.0.0.1:3105/src/data/dictionaries/match-utils.js:4:20)
    at termRegex (http://127.0.0.1:3105/src/data/dictionaries/match-utils.js:8:27)
    at findLongestDictionaryTerm (http://127.0.0.1:3105/src/data/dictionaries/json-dictionary-match.js:65:19)
    at hasEducationSchool (http://127.0.0.1:3105/src/core/parsing/education-confidence.js:92:7)
    at scoreEducationConfidence (http://127.0.0.1:3105/src/core/parsing/education-confidence.js:131:23)
    at mustNeverBeExperience (http://127.0.0.1:3105/src/core/parsing/education-confidence.js:167:15)
    at lineIsEducationData (http://127.0.0.1:3105/src/core/parsing/experience-parser.js:141:7)
    at qualifiesStrictExperience (http://127.0.0.1:3105/src/core/parsing/experience-parser.js:283:36)
    at scoreStrictExperienceEntry (http://127.0.0.1:3105/src/core/parsing/experience-parser.js:304:8) | CORE_BOOT_FAILED RangeError: Maximum call stack size exceeded
    at String.replace (<anonymous>)
    at escapeRegex (http://127.0.0.1:3105/src/data/dictionaries/match-utils.js:4:20)
    at termRegex (http://127.0.0.1:3105/src/data/dictionaries/match-utils.js:8:27)
    at findLongestDictionaryTerm (http://127.0.0.1:3105/src/data/dictionaries/json-dictionary-match.js:65:19)
    at hasEducationSchool (http://127.0.0.1:3105/src/core/parsing/education-confidence.js:92:7)
    at scoreEducationConfidence (http://127.0.0.1:3105/src/core/parsing/education-confidence.js:131:23)
    at mustNeverBeExperience (http://127.0.0.1:3105/src/core/parsing/education-confidence.js:167:15)
    at lineIsEducationData (http://127.0.0.1:3105/src/core/parsing/experience-parser.js:141:7)
    at qualifiesStrictExperience (http://127.0.0.1:3105/src/core/parsing/experience-parser.js:283:36)
    at scoreStrictExperienceEntry (http://127.0.0.1:3105/src/core/parsing/experience-parser.js:304:8) | IMPORT_ERROR RangeError: Maximum call stack size exceeded
    at String.replace (<anonymous>)
    at escapeRegex (http://127.0.0.1:3105/src/data/dictionaries/match-utils.js:4:20)
    at termRegex (http://127.0.0.1:3105/src/data/dictionaries/match-utils.js:8:27)
    at findLongestDictionaryTerm (http://127.0.0.1:3105/src/data/dictionaries/json-dictionary-match.js:65:19)
    at hasEducationSchool (http://127.0.0.1:3105/src/core/parsing/education-confidence.js:92:7)
    at scoreEducationConfidence (http://127.0.0.1:3105/src/core/parsing/education-confidence.js:131:23)
    at mustNeverBeExperience (http://127.0.0.1:3105/src/core/parsing/education-confidence.js:167:15)
    at lineIsEducationData (http://127.0.0.1:3105/src/core/parsing/experience-parser.js:141:7)
    at qualifiesStrictExperience (http://127.0.0.1:3105/src/core/parsing/experience-parser.js:283:36)
    at scoreStrictExperienceEntry (http://127.0.0.1:3105/src/core/parsing/experience-parser.js:304:8) | REVIEW_SCREEN_VISIBLE

All IMPORT_NEEDS_PASTE UI checks passed
```
