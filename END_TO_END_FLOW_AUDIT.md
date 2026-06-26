# HIRELY P0 — End-to-End Flow Audit

**Result:** PASS

**Generated:** 2026-06-10T08:15:53.526Z

## Scope

Full product flow with **real uploaded CVs** (no text fixtures):

```
IMPORT → PARSE → REVIEW → TEMPLATE → EXPORT
```

### Real files tested

- `/Users/yohannazancot/Documents/cv/cv2022 yohann azancot copie.pdf`
- `/Users/yohannazancot/Documents/yohann azancot cv 2024.pdf`
- `/Users/yohannazancot/Documents/cv .docx`

Primary run: **Yoaz PDF 2022**

## Data contract

One `finalResumeData` / `getFinalCvData()` surface drives:

- Review panel (`getPendingReviewQueue` — accepted items excluded)
- CV preview (`renderCV` → `getFinalCvData`)
- Template renderer (`HirelyTemplates.render`)
- Export screen (`syncExportFinalPanel`, `prepareLockedCvExport`)
- PDF export (`downloadPDF`)

## Runtime flow markers

| Marker | When emitted |
|--------|----------------|
| `IMPORT_READY` | Terminal import success (`IMPORT_READY` / `IMPORT_PARTIAL`) |
| `REVIEW_READY` | Workspace review visible (`ensureImportReviewVisible`) |
| `PREVIEW_READY` | `#cvDoc.cv--live` with template HTML |
| `TEMPLATE_READY` | Template render complete |
| `EXPORT_READY` | Export step with valid CV data |

Captured markers:

- `TEMPLATE_READY`
- `PREVIEW_READY`
- `REVIEW_READY`
- `REVIEW_READY`
- `IMPORT_READY`
- `TEMPLATE_READY`
- `PREVIEW_READY`
- `TEMPLATE_READY`
- `PREVIEW_READY`
- `TEMPLATE_READY`
- `PREVIEW_READY`
- `EXPORT_READY`
- `TEMPLATE_READY`
- `PREVIEW_READY`
- `EXPORT_READY`

## Stage results

### BOOT

| Check | Status | Detail |
|-------|--------|--------|
| core_boot | PASS | boot=ok |

### IMPORT

| Check | Status | Detail |
|-------|--------|--------|
| real_file_import | PASS | yoaz-pdf-2022 4ms |
| import_status | PASS | IMPORT_PARTIAL |
| flow_marker_import_ready | PASS | IMPORT_READY |
| resume_data_present | PASS | Yohann Azancot |
| secondary_yoaz-pdf-2024 (optional) | WARN | paste fallback |
| secondary_yoaz-docx (optional) | WARN | paste fallback |

### PARSE

| Check | Status | Detail |
|-------|--------|--------|
| final_resume_valid | PASS | valid=true |
| experience_parsed | PASS | experiences=1 |
| cv_data_from_final | PASS | cvExp=1 |

### REVIEW

| Check | Status | Detail |
|-------|--------|--------|
| review_workspace | PASS | pending=2 |
| no_accepted_in_suggestions | PASS | acceptedInUi=0 |
| accept_removes_from_queue | PASS | 2 → 1 |

### PREVIEW

| Check | Status | Detail |
|-------|--------|--------|
| preview_live | PASS | Yohann Azancot |
| resume_matches_preview | PASS | resume="Yohann Azancot" preview="Yohann Azancot" |
| flow_marker_preview_ready | PASS | PREVIEW_READY |

### TEMPLATE

| Check | Status | Detail |
|-------|--------|--------|
| template_selected | PASS | state=creative class=template-creative |
| template_same_name_as_preview | PASS | Yohann Azancot |
| flow_marker_template_ready | PASS | TEMPLATE_READY |
| template_persists | PASS | template=creative |

### EXPORT

| Check | Status | Detail |
|-------|--------|--------|
| export_panel_visible | PASS | À compléter — Base solide — complétez les éléments ci-dessou |
| export_not_blank | PASS | score="À compléter — Base solide — complétez le" |
| export_same_resume_name | PASS | Yohann Azancot |
| flow_marker_export_ready | PASS | EXPORT_READY |
| pdf_download | PASS | 39151 bytes |

## Forbidden (must not happen)

| Rule | Check |
|------|-------|
| Review shows accepted items | PASS |
| Template uses different data than preview | PASS |
| Export screen blank | PASS |
| Selected template lost on navigation | PASS |

## Gate

```bash
npm run test:end-to-end-flow-audit
```

## QA output

```
OK [BOOT] core_boot boot=ok
OK [IMPORT] real_file_import yoaz-pdf-2022 4ms
OK [IMPORT] import_status IMPORT_PARTIAL
OK [IMPORT] flow_marker_import_ready IMPORT_READY
OK [IMPORT] resume_data_present Yohann Azancot
OK [PARSE] final_resume_valid valid=true
OK [PARSE] experience_parsed experiences=1
OK [PARSE] cv_data_from_final cvExp=1
OK [REVIEW] review_workspace pending=2
OK [REVIEW] no_accepted_in_suggestions acceptedInUi=0
OK [REVIEW] accept_removes_from_queue 2 → 1
OK [PREVIEW] preview_live Yohann Azancot
OK [PREVIEW] resume_matches_preview resume="Yohann Azancot" preview="Yohann Azancot"
OK [PREVIEW] flow_marker_preview_ready PREVIEW_READY
OK [TEMPLATE] template_selected state=creative class=template-creative
OK [TEMPLATE] template_same_name_as_preview Yohann Azancot
OK [TEMPLATE] flow_marker_template_ready TEMPLATE_READY
OK [TEMPLATE] template_persists template=creative
OK [EXPORT] export_panel_visible À compléter — Base solide — complétez les éléments ci-dessou
OK [EXPORT] export_not_blank score="À compléter — Base solide — complétez le"
OK [EXPORT] export_same_resume_name Yohann Azancot
OK [EXPORT] flow_marker_export_ready EXPORT_READY
OK [EXPORT] pdf_download 39151 bytes

PASS end-to-end-flow-audit

WARN [IMPORT] secondary_yoaz-pdf-2024 paste fallback
WARN [IMPORT] secondary_yoaz-docx paste fallback
```

