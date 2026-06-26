# TEMPLATE_SECTION_ORDER_FIX_REPORT

**Status:** PASS
**Lock:** TEMPLATE_SECTION_ORDER_LOCK_V1
**Generated:** 2026-06-10T23:34:40.016Z

## Universal section order

identity → summary → experiences → clients → projects → education → skills → tools → languages

## Rules enforced

- Experience before skills/tools when experiences exist
- Clients near experience (immediately after)
- Skills/tools/languages only in compact footer (no sidebar duplication)
- A4 pagination packs main content before sidebar/meta
- No duplicate skills/tools sections across pages
- Experience visible on page 1 when experience exists

## Code changes

- `stackUniversal()` — single canonical stack for all templates
- Removed portfolio-first / creative-first reordering
- Sidebars with skills/tools removed (ATS Executive, Modern Two Column, Editorial Premium, etc.)
- `cv-a4-pages.js` — main column units packed before side/meta

## Yoaz CV (`yoaz-cv`)

**Result:** PASS

| Template | Order | Exp on P1 | Duplicates | Pass |
|----------|-------|-----------|------------|------|
| ats | identity → experiences → clients → education → skills → tools → languages | ✓ | — | ✓ |
| ats-executive | identity → experiences → clients → education → skills → tools → languages | ✓ | — | ✓ |
| creative-portfolio | identity → experiences → clients → education → skills → tools → languages | ✓ | — | ✓ |
| portfolio-artist | identity → experiences → clients → education → skills → tools → languages | ✓ | — | ✓ |
| behance-showcase | identity → experiences → clients → education → skills → tools → languages | ✓ | — | ✓ |
| editorial-magazine | identity → experiences → clients → education → skills → tools → languages | ✓ | — | ✓ |
| magazine-editorial | identity → experiences → clients → education → skills → tools → languages | ✓ | — | ✓ |
| luxury-minimal | identity → experiences → clients → education → skills → tools → languages | ✓ | — | ✓ |
| tech-structured | identity → experiences → clients → education → skills → tools → languages | ✓ | — | ✓ |
| art-director-portfolio | identity → experiences → clients → education → skills → tools → languages | ✓ | — | ✓ |
| luxury-fashion | identity → experiences → clients → education → skills → tools → languages | ✓ | — | ✓ |
| agency-designer | identity → experiences → clients → education → skills → tools → languages | ✓ | — | ✓ |
| minimal-swiss | identity → experiences → clients → education → skills → tools → languages | ✓ | — | ✓ |
| visual-timeline | identity → experiences → clients → education → skills → tools → languages | ✓ | — | ✓ |
| creative-director | identity → experiences → clients → education → skills → tools → languages | ✓ | — | ✓ |
| art-director | identity → experiences → clients → education → skills → tools → languages | ✓ | — | ✓ |
| illustrator-portfolio | identity → experiences → clients → education → skills → tools → languages | ✓ | — | ✓ |

## Second uploaded CV (`second-uploaded-cv`)

**Result:** PASS

| Template | Order | Exp on P1 | Duplicates | Pass |
|----------|-------|-----------|------------|------|
| ats | identity → experiences → clients → education → skills → tools | ✓ | — | ✓ |
| ats-executive | identity → experiences → clients → education → skills → tools | ✓ | — | ✓ |
| creative-portfolio | identity → experiences → clients → education → skills → tools | ✓ | — | ✓ |
| portfolio-artist | identity → experiences → clients → education → skills → tools | ✓ | — | ✓ |
| behance-showcase | identity → experiences → clients → education → skills → tools | ✓ | — | ✓ |
| editorial-magazine | identity → experiences → clients → education → skills → tools | ✓ | — | ✓ |
| magazine-editorial | identity → experiences → clients → education → skills → tools | ✓ | — | ✓ |
| luxury-minimal | identity → experiences → clients → education → skills → tools | ✓ | — | ✓ |
| tech-structured | identity → experiences → clients → education → skills → tools | ✓ | — | ✓ |
| art-director-portfolio | identity → experiences → clients → education → skills → tools | ✓ | — | ✓ |
| luxury-fashion | identity → experiences → clients → education → skills → tools | ✓ | — | ✓ |
| agency-designer | identity → experiences → clients → education → skills → tools | ✓ | — | ✓ |
| minimal-swiss | identity → experiences → clients → education → skills → tools | ✓ | — | ✓ |
| visual-timeline | identity → experiences → clients → education → skills → tools | ✓ | — | ✓ |
| creative-director | identity → experiences → clients → education → skills → tools | ✓ | — | ✓ |
| art-director | identity → experiences → clients → education → skills → tools | ✓ | — | ✓ |
| illustrator-portfolio | identity → experiences → clients → education → skills → tools | ✓ | — | ✓ |

## Verify

```bash
node src/tests/qa-template-section-order.mjs
node scripts/template-section-order-fix-report.mjs
```
