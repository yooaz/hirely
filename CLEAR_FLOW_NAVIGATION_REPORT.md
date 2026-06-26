# HIRELY P0 — Clear Flow Navigation

**Result:** PASS
**Generated:** 2026-06-10T13:27:13.235Z

## Requirement

Users must always know the next click after import:

| Step | Title | Primary action |
|------|-------|----------------|
| 1 | Importer | Upload / paste CV |
| 2 | Relire | **Choisir un modèle** |
| 3 | Choisir un modèle | **Exporter ce CV** |
| 4 | Exporter | A4 preview + **Télécharger PDF** |

## Implementation

| Change | Location |
|--------|----------|
| 4-step progress nav (import → relire → modèle → export) | `#docNav` in `index.html` |
| Primary CTA bar per step | `#flowPrimaryCta` in `docFooter` |
| Step headers | `#resumeStudioHead`, `#styleStepHead`, `#exportStepHead` |
| Template picker only on style step | `syncResumeStudioChrome()` |
| PDF bar only on export step | `cvExportBar` + CSS |

## Browser snapshot

| Check | Value |
|-------|-------|
| Nav steps | 4 |
| Review CTA | Choisir un modèle |
| Style CTA | Exporter ce CV |
| Export PDF btn | Télécharger PDF |
| A4 preview height | 1484px |

## Gate

```bash
npm run test:clear-flow-navigation
```

## Acceptance

- [x] 4 visible steps in progress nav
- [x] After review: primary « Choisir un modèle »
- [x] After template: primary « Exporter ce CV »
- [x] Export: full A4 preview + Télécharger PDF
