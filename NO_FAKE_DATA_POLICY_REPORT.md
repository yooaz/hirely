# NO_FAKE_DATA_POLICY_REPORT

**Status:** PASS
**Policy:** `NO_FAKE_DATA_POLICY_V1`
**Generated:** 2026-06-12T09:50:33.463Z
**QA:** 25/25 checks

## Principle

**If Hirely is unsure, it must not invent.**

- A CV with a **missing name** is acceptable.
- A CV with a **wrong name** is not acceptable.
- Low-confidence data goes to **reviewQueue**, not the preview.

## Forbidden on CV preview / export

| Category | Rule |
|----------|------|
| Fake name | Company/agency/OCR garbage never promoted to `identity.name` |
| Fake phone | Corrupted or low-confidence phones hidden (confidence &lt; 85) |
| Fake company | Client brands cannot become employer rows without role/dates |
| Fake dates | Future/impossible years stripped from experience rows |
| Fake experience | Invented bullets (`Delivered creative work…`, `Contributed as…`) blocked |

## Missing data UX

When a field is unknown, display shows **Information non détectée** — never fabricated placeholders.

## Enforcement layers

| Layer | Module |
|-------|--------|
| Policy audit | `src/core/validation/no-fake-data-policy.js` |
| Identity source priority | `src/core/parsing/identity-extraction.js` |
| Phone strict mode | `src/core/parsing/phone-normalize.js` |
| Invented experience guard | `src/core/parsing/invented-experience-guard.js` |
| Display sanitize | `src/core/validation/sanitize-resume-display.js` |
| Confidence gate | `src/core/validation/confidence-gate.js` |
| Zero invented content (H18) | `src/core/display/undetected-label.js` |

## Sample pipeline outcomes

- **Company-as-name CV:** name = `(empty / undetected)` — audit PASS
- **Corrupted phone CV:** phone = `(empty)` — routed to review: no
- **No-name CV:** name = `(empty / undetected)` — acceptable

## Verification

```bash
npm run qa:no-fake-data-policy
npm run qa:identity-false-name
npm run qa:phone-strict-extraction
npm run qa:h18-zero-invented-content
npm run no-fake-data-policy-report
```

## QA output

```
PASS policy_version
PASS missing_name_acceptable
PASS undetected_label
PASS uncertain_name_maps_undetected
PASS reject_fake_name_company
PASS reject_fake_name_garbage
PASS accept_valid_name
PASS accept_empty_name
PASS accept_uncertain_label
PASS reject_fake_phone_extra_digits
PASS reject_phone_date_pollution
PASS accept_valid_phone
PASS reject_invented_experience_bullet
PASS strip_invented_client_experience
PASS reject_future_experience_date
NODE_RESUMEDATA_COUNTS {
  path: 'buildResumeData:importResult',
  experiences: 2,
  education: 0,
  skills: 2,
  tools: 1,
  languages: 0,
  clients: 0,
  projects: 0,
  unsorted: 1
}
PASS pipeline_no_fake_company_name
PASS pipeline_lontac_audit_pass
PASS pipeline_missing_name_ok
NODE_RESUMEDATA_COUNTS {
  path: 'buildResumeData:importResult',
  experiences: 3,
  education: 0,
  skills: 0,
  tools: 0,
  languages: 0,
  clients: 0,
  projects: 0,
  unsorted: 2
}
PASS pipeline_no_fake_phone_display
PASS pipeline_bad_phone_to_review
PASS pipeline_bad_phone_audit_pass
NODE_RESUMEDATA_COUNTS {
  path: 'buildResumeData:importResult',
  experiences: 2,
  education: 0,
  skills: 1,
  tools: 1,
  languages: 0,
  clients: 0,
  projects: 0,
  unsorted: 0
}
PASS pipeline_no_name_acceptable
PASS pipeline_no_name_audit_pass
PASS audit_catches_synthetic_violations
PASS audit_forbidden_types

PASS no-fake-data-policy (25/25)

(node:2114) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/src/core/validation/no-fake-data-policy.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
```
