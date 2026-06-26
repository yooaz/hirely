# HIRELY P0 — Stop Invented Experience Sentences

**Result:** PASS
**Generated:** 2026-06-10T18:28:06.981Z

## Problem

CV export was generating fake experience lines such as:
- `Contributed as at Present`
- `Contributed as at Nike`
- `Contributed as at Converse`
- `Contributed as at Louis Vuitton`

## Rules (locked)

- Never convert client names into experience rows
- Never generate `Contributed as at…`
- Never invent company/date/role combinations
- Clients stay in `clients[]` unless source has role + company + date
- Uncertain lines → `reviewQueue`, not `finalResumeData.experiences`

## Root causes fixed

| Layer | Issue | Fix |
|-------|-------|-----|
| `creative-experience-recovery-engine.js` | `expandClientEngagements` spawned per-client fake jobs | Clients merged into parent `clients[]`; expansion returns `[]` |
| `sanitize-resume-display.js` | `normalizeDisplayExperience` invented bullets when empty | Removed fabricated bullet templates |
| `invented-experience-guard.js` | — | New P0 guard: client-only rows, invented bullets, `expandedFromClient` |
| `undetected-label.js` | Audit missed invented bullets | Extended `FABRICATED_EXPORT_PATTERNS` + bullet scan |

## Audited modules

- Experience reconstruction — `creative-experience-recovery-engine.js`, `experience-reconstruction-engine-v2.js`
- Client recovery — `mergeClientsIntoParentExperience`, `extractCreativeClientEntities`
- Semantic repair — `experience-semantic-layer.js` (no invented bullets on empty)
- Final builder — `sanitize-resume-display.js` → `buildFinalResumeData`

## Fixture results

| Fixture | Experiences | Clients | Sample clients | Invented-free |
|---------|------------:|--------:|----------------|:-------------:|
| creative-cv | 1 | 7 | Pantone, Nike, Converse, Louis Vuitton, Marvel, Cadillac | ✓ |
| yoaz-cv | 4 | 7 | Pantone, Nike, Converse, Louis Vuitton, Marvel, Cadillac | ✓ |
| creative-experience-rich | 7 | 6 | Nike, Converse, Marvel, Cadillac, Fortune, PlayStation | ✓ |
| designer-cv-rich | 4 | 4 | Nike, Spotify, Adobe, Airbnb | ✓ |

## Acceptance

**PASS** — No fake experience sentences. Client brands render in Clients section only. Experience rows require role + company + dates.

## Run

```bash
npm run test:no-invented-experience
```
