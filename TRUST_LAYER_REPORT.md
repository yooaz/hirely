# Trust Layer Report

**Generated:** 2026-06-16T06:49:25.023Z
**Goal:** User trusts the platform **immediately** (privacy, ATS, recruiter quality, extraction, success checks)
**Gate status:** **PASS** (20/20 checks)

## Trust pillars

| Pillar | User need | Implementation | i18n key |
| --- | --- | --- | --- |
| File privacy | Know their CV is not stored on servers | `hirelyTrustPrivacy` + lock icon on hero, import, analyze | `trustPrivacyStatement` |
| ATS compatible | PDF will pass applicant tracking systems | `hirelyTrustBadge--ats` on all trust surfaces; template cards show `.tplAts` | `trustBadgeAts` |
| Recruiter approved | Profile meets recruiter-quality bar | Badge when score ≥ 65 or high extraction confidence | `trustBadgeRecruiter / trustBadgeRecruiterPending` |
| Extraction confidence | See how reliably we read their file | `<meter>` + % after import (import, analyze, template steps) | `trustConfidenceLabel` |
| Success indicators | Concrete checklist of what was detected | Contact, experience, education, skills rows with ✓ / ! / · | `trustIndicatorsLabel + trustContact* keys` |

## Surfaces (production)

| Host | When visible | Content |
| --- | --- | --- |
| `#hirelyTrustHero` | Landing — before upload | Privacy + ATS + recruiter promise |
| `#hirelyTrustImport` | Step 1 — upload / loading | Privacy, badges, confidence when ready |
| `#hirelyTrustAnalyze` | Step 2 — analyze sidebar | Full trust card with confidence + indicators |
| `#trustStrip` | Steps 3–4 — template & download | Confidence + indicators above template gallery |

## Static checks

| Check | Status | Detail |
| --- | --- | --- |
| file:hirely-trust-layer-js | PASS | — |
| file:hirely-trust-layer-css | PASS | — |
| index:links-trust-css | PASS | — |
| index:loads-trust-js | PASS | — |
| api:HirelyTrustLayer | PASS | — |
| ui:privacy-statement | PASS | — |
| ui:ats-badge | PASS | — |
| ui:recruiter-badge | PASS | — |
| ui:extraction-confidence | PASS | — |
| ui:success-indicators | PASS | — |
| host:hirelyTrustHero | PASS | — |
| host:hirelyTrustImport | PASS | — |
| host:hirelyTrustAnalyze | PASS | — |
| host:trustStrip-workspace | PASS | — |
| fn:renderHirelyTrustLayer | PASS | — |
| wire:renderAll | PASS | — |
| prod:trust-not-hidden-ux | PASS | — |
| prod:tplAts-visible | PASS | — |
| i18n:fr-privacy | PASS | — |
| i18n:en-privacy | PASS | — |

## Files

| File | Role |
| --- | --- |
| `src/ui/product/hirely-trust-layer.js` | Render + mount trust UI |
| `src/ui/product/hirely-trust-layer.css` | Badges, privacy, confidence meter, indicators |
| `index.html` | Hosts, `renderHirelyTrustLayer()`, i18n, wiring |
| `scripts/trust-layer-report.mjs` | This report |

## Verification

```bash
npm run trust-layer-report
```

Manual trust test:

1. Open app (no upload) — hero shows **privacy statement** + **ATS compatible** badge.
2. Upload a text PDF — import panel shows **extraction confidence** % and **success indicators** (contact, experience).
3. Analyze step — sidebar trust card repeats confidence + checklist.
4. Template step — trust strip above gallery; template cards show **ATS** label.

## Success criteria

| Criterion | Target |
| --- | --- |
| Privacy visible before upload | Yes (hero) |
| ATS signal | Badge + per-template label |
| Recruiter signal | Badge when score ≥ 65 |
| Extraction confidence | Shown after successful import |
| Success indicators | ≥ 3 checks (CV read, contact, experience) |
| Gate checks | 20/20 PASS |
