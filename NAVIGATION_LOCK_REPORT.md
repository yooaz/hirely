# Navigation Lock

**Generated:** 2026-06-16T07:11:29.781Z
**Status:** **PASS** (17/17 checks)
**Version:** `NAVIGATION_LOCK_V1` (`navigation-lock-v1`)

## Rule

| `resumeData` | Import | Review | Style | Export |
| --- | --- | --- | --- | --- |
| **Present** | ✓ | ✓ | ✓ | ✓ |
| **Absent** | ✓ | ✗ | ✗ | ✗ |

No other navigation lock is allowed when `HIRELY_NAVIGATION_LOCK=true`.

## Removed / bypassed

| Lock type | Previous behavior | Navigation lock |
| --- | --- | --- |
| Review lock | `blockReview`, review guarantee | Bypassed — `blockReview: false` |
| Template lock | `review-before-template-lock`, `isTemplateReady()` gates | `isTemplateReady() → hasNavResumeData()` |
| Export lock | `isExportReady()`, quality validator, recovery | `isExportReady() → hasNavResumeData()` |
| Premium lock | Pro template cards + `requirePro()` on PDF | Cards unlocked; PDF allowed with `resumeData` |
| Validation lock | `cv-data-protection`, INVALID status blocks nav | `getCvDataValidation()` returns no blocks |

## Runtime flag

```javascript
HIRELY_NAVIGATION_LOCK = true  // also when HIRELY_ONE_CV_SOURCE or HIRELY_V1_SCOPE_LOCK
```

## Functions (index.html)

| Function | Navigation lock behavior |
| --- | --- |
| `hasNavResumeData()` | `!!getResumeData()` |
| `guardCvDataStep(step)` | Non-import steps require `resumeData` |
| `getCvDataValidation()` | No `blockReview/Style/Export` |
| `renderProgressNav()` | Lock only when step ≠ import and no `resumeData` |
| `syncFlowPrimaryCta()` | CTA never disabled for template/export locks |
| `setDocStep()` | Legacy template/export guards wrapped in `!navigationLockActive()` |
| `downloadPDF()` | Requires `resumeData` only (no validation stack) |

## Module

`src/core/navigation/navigation-lock.js` — `isNavigationLockEnabled`, `canNavigateToStep`, `buildNavigationLockValidation`

## Static checks

| Check | Status | Detail |
| --- | --- | --- |
| file:navigation-lock-js | PASS | — |
| core:exports-navigation-lock | PASS | — |
| flag:HIRELY_NAVIGATION_LOCK | PASS | — |
| fn:navigationLockActive | PASS | — |
| fn:hasNavResumeData | PASS | — |
| guard:guardCvDataStep-resumeData | PASS | — |
| nav:isTemplateReady-resumeData | PASS | — |
| nav:isExportReady-resumeData | PASS | — |
| nav:getCvDataValidation-no-blocks | PASS | — |
| nav:progressNav-resumeData-only | PASS | — |
| nav:flowCta-never-disabled | PASS | — |
| nav:setDocStep-skips-legacy-locks | PASS | — |
| nav:download-resumeData-gate | PASS | — |
| nav:premium-template-cards-unlocked | PASS | — |
| removed:review-before-template-nav | PASS | — |
| module:hasResumeDataForNavigation | PASS | — |
| module:NAVIGATION_LOCK_VERSION | PASS | — |

## Verification

```bash
npm run navigation-lock-report
```

## Note

Review badges and quality panels may still display informational warnings. They must not disable navigation when navigation lock is active.
