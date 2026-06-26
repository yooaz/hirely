# Contact Consistency Report

**Status:** PASS
**Date:** 2026-06-11

## Goal

Detection panel reads `finalResumeData.identity` only. Email/phone normalized; no false "Téléphone non détecté" when preview shows contact.

## Rules

| Rule | Implementation |
|------|----------------|
| Email from identity | `resolveIdentityContact` → `hasIdentityEmail` |
| Phone from identity | `normalizeContactPhone` + `stripContactLineNoise` |
| No preview contradiction | `buildReviewChecklistFromFinalResume` + trusted review use identity |
| Clean contact line | `sanitizeIdentity` + pollution strip (Instagram/URLs) |

## Unit checks

| Check | Result |
|-------|--------|
| polluted contact line → email + phone | PASS ({"email":"yoaz@hotmail.fr","phone":"+33649434839","hasEmail":true,"hasPhone":true}) |
| strip instagram from phone | PASS (+33649434839) |
| checklist phone from identity | PASS (phone=true email=true) |

## Browser check (Yoaz fixture)

| Metric | Value |
|--------|-------|
| Identity email | yes |
| Identity phone | yes (+33649434839) |
| Preview contact | yoaz@hotmail.fr · +33649434839 |
| Panel phone miss text | no |

## Acceptance

Panel contact detection matches normalized `finalResumeData.identity` and CV preview.

## Run

```bash
npm run contact-consistency-report
```
