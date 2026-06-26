# Template Data Integrity Report (P0)

**Verdict:** PASS

**Policy:** `NO_FAKE_DATA_POLICY_V1`

**Generated:** 2026-06-12T19:13:35.049Z

**Score:** 64/64

## Tenets

| Principle | Enforcement |
|-----------|-------------|
| Missing data is acceptable. | Enforced in pipeline + template render |
| Wrong data is forbidden. | Enforced in pipeline + template render |
| An empty name is better than a fake name. | Enforced in pipeline + template render |
| A missing email is better than a corrupted email. | Enforced in pipeline + template render |
| A generic template is better than a fake premium template. | Enforced in pipeline + template render |

## Implementation

| Layer | Behavior |
|-------|----------|
| Pipeline | Uncertain identity → review queue, not preview |
| `final-cv-placeholder-guard` | Strips confirm labels before commit |
| `normalizeProfile()` | Empty name/email when missing or corrupt; no employer-as-name |
| `identityPlaceholdersEnabled()` | **Off** in production — no injected confirm labels |
| `MINI_CV` | Gallery thumbs use empty fields, not undetected copy |
| `resolve()` | Unknown template id → free **ATS** (generic over fake premium) |

## Per-template (4 integrity scenarios)

| Display name | ID | Verdict | Failed |
|--------------|-----|---------|--------|
| ATS Clean | `ats-elite` | PASS | — |
| Executive Minimal | `ats-executive` | PASS | — |
| Modern Editorial | `editorial-magazine` | PASS | — |
| Creative Portfolio | `creative-director` | PASS | — |
| Tech Structured | `tech-structured` | PASS | — |
| Consultant Compact | `agency-designer` | PASS | — |
| Luxury Serif | `executive-luxury` | PASS | — |
| Startup Builder | `startup-builder` | PASS | — |
| Art Director Portfolio | `art-director-portfolio` | PASS | — |
| Classic Corporate | `swiss-editorial` | PASS | — |

Scenarios per template: **sparse** (missing name/email), **corrupted_email**, **company_as_name**, **uncertain_labels**, plus **mini** gallery thumb.

## Run

```bash
npm run qa:template-data-integrity
npm run template-data-integrity-report
```

## Bench output

```
PASS tenets_exported
PASS missing_acceptable
PASS wrong_forbidden
CV_TEMPLATE_BOOT_OK
PASS unknown_template_falls_back_to_ats
PASS ats-elite:sparse
PASS ats-elite:acceptable_name_policy
PASS ats-elite:corrupted_email
PASS ats-elite:company_as_name
PASS ats-elite:uncertain_labels
PASS ats-elite:mini_no_fake_labels
PASS ats-executive:sparse
PASS ats-executive:acceptable_name_policy
PASS ats-executive:corrupted_email
PASS ats-executive:company_as_name
PASS ats-executive:uncertain_labels
PASS ats-executive:mini_no_fake_labels
PASS editorial-magazine:sparse
PASS editorial-magazine:acceptable_name_policy
PASS editorial-magazine:corrupted_email
PASS editorial-magazine:company_as_name
PASS editorial-magazine:uncertain_labels
PASS editorial-magazine:mini_no_fake_labels
PASS creative-director:sparse
PASS creative-director:acceptable_name_policy
PASS creative-director:corrupted_email
PASS creative-director:company_as_name
PASS creative-director:uncertain_labels
PASS creative-director:mini_no_fake_labels
PASS tech-structured:sparse
PASS tech-structured:acceptable_name_policy
PASS tech-structured:corrupted_email
PASS tech-structured:company_as_name
PASS tech-structured:uncertain_labels
PASS tech-structured:mini_no_fake_labels
PASS agency-designer:sparse
PASS agency-designer:acceptable_name_policy
PASS agency-designer:corrupted_email
PASS agency-designer:company_as_name
PASS agency-designer:uncertain_labels
PASS agency-designer:mini_no_fake_labels
PASS executive-luxury:sparse
PASS executive-luxury:acceptable_name_policy
PASS executive-luxury:corrupted_email
PASS executive-luxury:company_as_name
PASS executive-luxury:uncertain_labels
PASS executive-luxury:mini_no_fake_labels
PASS startup-builder:sparse
PASS startup-builder:acceptable_name_policy
PASS startup-builder:corrupted_email
PASS startup-builder:company_as_name
PASS startup-builder:uncertain_labels
PASS startup-builder:mini_no_fake_labels
PASS art-director-portfolio:sparse
PASS art-director-portfolio:acceptable_name_policy
PASS art-director-portfolio:corrupted_email
PASS art-director-portfolio:company_as_name
PASS art-director-portfolio:uncertain_labels
PASS art-director-portfolio:mini_no_fake_labels
PASS swiss-editorial:sparse
PASS swiss-editorial:acceptable_name_policy
PASS swiss-editorial:corrupted_email
PASS swiss-editorial:company_as_name
PASS swiss-editorial:uncertain_labels
PASS swiss-editorial:mini_no_fake_labels

═══ Template Data Integrity: 64/64 PASS ═══
(node:27799) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/src/core/validation/no-fake-data-policy.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
```
