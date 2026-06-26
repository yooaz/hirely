# VISIBLE QA REPORT — Yoaz PDF

Generated: 2026-06-07T14:11:13.402Z
PDF: `/Users/yohannazancot/Documents/cv/cv2022 yohann azancot copie.pdf`
Screenshots: `tests/output/visible-qa-yoaz/`

## Verdict

**FAIL**

## Browser checks

| Check | Result | Detail |
|-------|--------|--------|
| core_boot_ok | ✓ | {"bootFailed":false,"boot":null,"bannerVisible":false} |
| import_live | ✗ | paste fallback shown |
| header_name | ✗ | got "" (need person name or editable warning) |
| header_email | ✗ | missing |
| header_phone | ✗ | missing |
| preview_experience | ✗ | no section |
| preview_education_clean | ✓ |  |
| preview_clients_clean | ✗ | count=0  |
| preview_tools_clean | ✓ |  |
| preview_languages_separate | ✗ | none |
| preview_no_ocr_garbage | ✓ | clean |
| suggestions_max_3 | ✓ | visible=0 [] |
| suggestions_no_noise | ✓ | clean |
| suggestions_no_dup_accepted | ✓ | clean |
| recruiter_score_80 | ✗ | score=0 |
| checklist_email | ✗ | Email ✗ |
| checklist_phone | ✗ | Téléphone ✗ |
| checklist_expérience | ✗ | Expérience ✗ |
| checklist_formation | ✗ | Formation ✗ |
| checklist_compétence | ✗ | Compétences ✗ |
| export_pdf_download | ✗ | page.waitForEvent: Timeout 120000ms exceeded while waiting for event "download"
=========================== logs ======= |
| export_checklist_checked | ✗ | {"cvPdfExported":false,"exportChecklistOk":false,"domItems":[{"label":"Nom","ok":false},{"label":"Email","ok":false},{"l |

## Captured visible state

- **Name:** —
- **Email:** —
- **Phone:** —
- **Score:** —
- **Tools:** —
- **Languages:** —
- **Education:** —
- **Clients:** —
- **Suggestions (0):** —

### Checklist (DOM)
- ✗ Nom
- ✗ Email
- ✗ Téléphone
- ✗ Expérience
- ✗ Formation
- ✗ Compétences
- ✗ Export PDF

### Export state
- cvPdfExported: false
- export checklist: ✗

## Remaining visible blockers

- import_live — paste fallback shown
- header_name — got "" (need person name or editable warning)
- header_email — missing
- header_phone — missing
- preview_experience — no section
- preview_clients_clean — count=0 
- preview_languages_separate — none
- recruiter_score_80 — score=0
- checklist_email — Email ✗
- checklist_phone — Téléphone ✗
- checklist_expérience — Expérience ✗
- checklist_formation — Formation ✗
- checklist_compétence — Compétences ✗
- export_pdf_download — page.waitForEvent: Timeout 120000ms exceeded while waiting for event "download"
=========================== logs ===========================
waiting for event "download"
============================================================
- export_checklist_checked — {"cvPdfExported":false,"exportChecklistOk":false,"domItems":[{"label":"Nom","ok":false},{"label":"Email","ok":false},{"label":"Téléphone","ok":false},{"label":"Expérience","ok":false},{"label":"Formation","ok":false},{"label":"Compétences","ok":false},{"label":"Export PDF","ok":false}]}
