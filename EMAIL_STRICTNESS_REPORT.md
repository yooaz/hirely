# Email Strictness Report (P0)

**Verdict:** PASS

**Engine:** `EMAIL_STRICTNESS_V1`

**Generated:** 2026-06-12T18:56:21.636Z

**Score:** 11/11

## Mission

Prevent email corruption during import/OCR. The local-part must never be mutated or extended.

**Acceptance:** `yoaz@hotmail.fr` must **never** become `yoazg@hotmail.fr`.

## Rules

| Rule | Enforcement |
|------|-------------|
| Never mutate email local-part | `emailLocalPartAddsLetters` detects added characters |
| Never add letters | Mutated parse recovered from source or rejected |
| Extract exact email from source | `extractEmailsFromSource` — verbatim regex + loose OCR `@host tld` |
| Uncertain OCR → reviewQueue | `buildEmailReviewItem` with `sourceText` |
| Autocorrect only if obvious + reversible | Domain-only fix: `user@hotmail fr` → `user@hotmail.fr` |
| Show sourceText for review | Review items include source line |

## Acceptance result

| Case | Result |
|------|--------|
| Source `yoaz@hotmail.fr`, parsed `yoazg@hotmail.fr` | **PASS — recovered yoaz@hotmail.fr** |
| Post-sanitize display | `yoaz@hotmail.fr` |

## QA checks

| Check | Result | Detail |
|-------|--------|--------|
| version | PASS | — |
| detect_local_part_mutation | PASS | — |
| yoaz_never_becomes_yoazg | PASS | {"accept":true,"display":"yoaz@hotmail.fr","reviewRequired":true,"reason":"local_part_mutation_recovered","confidence":88,"sourceLine":"yoaz@hotmail.fr · Paris","mutation":"yoazg@hotmail.fr","recovered":"yoaz@hotmail.fr"} |
| exact_source_email | PASS | — |
| reversible_ocr_domain_only | PASS | — |
| enforce_recovers_and_queues_review | PASS | — |
| uncertain_email_to_review | PASS | — |
| identity_contact_strictness_email | PASS | — |
| import_sanitize_no_yoazg | PASS | yoaz@hotmail.fr |
| mutation_review_has_source_text | PASS | — |
| extract_exact_from_source | PASS | — |

## Implementation

- `src/core/validation/email-strictness.js` — source grounding, mutation detection, review items
- `src/core/validation/identity-contact-strictness.js` — wired before name/phone strictness
- `src/core/validation/sanitize-resume-display.js` — passes `sourceText` into contact strictness
- `src/core/parsing/identity-extraction.js` — `extractEmailFromBlob` uses source extractor
- `src/core/parsing/ocr-cleanup.js` — email mask during OCR typo repair

## Run

```bash
npm run qa:email-strictness
npm run email-strictness-report
```

## Bench output

```
PASS version
PASS detect_local_part_mutation
PASS yoaz_never_becomes_yoazg
PASS exact_source_email
PASS reversible_ocr_domain_only
PASS enforce_recovers_and_queues_review
PASS uncertain_email_to_review
PASS identity_contact_strictness_email
NODE_RESUMEDATA_COUNTS {
  path: 'buildResumeData:importResult',
  experiences: 0,
  education: 0,
  skills: 1,
  tools: 0,
  languages: 0,
  clients: 0,
  projects: 0,
  unsorted: 0
}
PASS import_sanitize_no_yoazg
PASS mutation_review_has_source_text
PASS extract_exact_from_source

═══ Email Strictness: 11/11 PASS ═══
(node:81931) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/src/core/validation/email-strictness.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
```
