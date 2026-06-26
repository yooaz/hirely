# IDENTITY_FALSE_NAME_FIX_REPORT

**Status:** PASS
**Engine:** `IDENTITY_FALSE_NAME_FIX_V1`
**Generated:** 2026-06-12T09:31:14.788Z

## Problem

Company/agency lines (e.g. **Lontac Impressions**) were promoted to `identity.name` via experience recovery and full-document name heuristics.

## Rules enforced

- Person names only from identity/header region (before Experience/Education sections)
- Reject company/agency patterns: impressions, agency, studio, company, freelance, client, portfolio
- Reject names that collide with parsed employer companies
- Reject client-dictionary matches as person names
- Name confidence below 80 → empty display name + review label (never substitute company text)
- Experience URL-merge recovery no longer writes `recoveredName` into identity

## Code changes

| Module | Change |
|--------|--------|
| `identity-extraction.js` | `COMPANY_LIKE_NAME_RE`, `looksLikeCompanyOrAgencyName`, header-only OCR repair, confidence min 80 |
| `sanitize-resume-display.js` | Header-only name recovery; no experience→name promotion |
| `confidence-gate.js` | Company/employer collision scores 0 |

## QA summary

| Checks | Pass | Fail |
|--------|------|------|
| Total | 19 | 0 |

## Lontac Impressions regression case

- Display name: `Information non détectée`
- Import status: `IMPORT_SUCCESS`
- Experience count: 3
- Education count: 0

## Checklist

- ✓ `reject:Lontac Impressions` — valid=false
- ✓ `reject:JB Impressions` — valid=false
- ✓ `reject:Studio Azur` — valid=false
- ✓ `reject:McCann Agency` — valid=false
- ✓ `reject:Nike Client` — valid=false
- ✓ `reject:Freelance Portfolio` — valid=false
- ✓ `reject:Creative Company` — valid=false
- ✓ `accept:Sophie Martin`
- ✓ `accept:Alex Chen`
- ✓ `accept:Yohann Azancot`
- ✓ `employer_collision`
- ✓ `confidence_min_80`
- ✓ `locked_identity_no_company` — name=(empty)
- ✓ `locked_confidence_gate` — confidence=0
- ✓ `sanitize_no_company_name` — displayName=Information non détectée
- ✓ `sanitize_uncertain_label` — displayName=Information non détectée
- ✓ `score_company_zero`
- ✓ `cvdata_name_not_company` — cvName=(empty)
- ✓ `render_cvname_not_company` — renderedName=(placeholder)

## Run

```bash
npm run qa:identity-false-name
npm run identity-false-name-fix-report
```


## QA log (tail)

```
  skills: 7,
  tools: 1,
  languages: 0,
  clients: 0,
  projects: 1,
  unsorted: 1
}
PASS sanitize_no_company_name
PASS sanitize_uncertain_label
PASS score_company_zero
PASS cvdata_name_not_company
CV_TEMPLATE_BOOT_OK
PASS render_cvname_not_company

═══ Identity False Name: 19/19 PASS ═══

(node:53275) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/src/core/parsing/identity-extraction.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
```
