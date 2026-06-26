# VISUAL_QUALITY_LOCK_REPORT

**Status:** PASS
**Generated:** 2026-06-10T23:28:48.729Z
**Source:** Browser visual QA (DOM order, A4 page 1, detection parity — not JSON counts)

## Rule

A CV passes only when it **looks like a real professional CV** in the browser.

Required hierarchy: Identity → Summary → Experience → Clients/Projects → Education → Skills → Tools → Languages

## VISUAL_QA score (per template)

| Dimension | Weight |
|-----------|--------|
| Page 1 density | 20 |
| Section order | 20 |
| No giant blank zones | 15 |
| Experience on page 1 | 20 |
| No duplicated sections | 10 |
| Detection panel parity | 10 |
| Meaningful identity | 5 |

## Yoaz CV (`yoaz-cv`)

**File:** `/Users/yohannazancot/Documents/cv/cv2022 yohann azancot copie.pdf`
**Import:** IMPORT_PARTIAL (direct)
**CV result:** PASS

### Template visual results

| Template | Score | Page 1 fill | Exp on P1 | Order | Pass |
|----------|-------|-------------|-----------|-------|------|
| ats | 100/100 | 100% (554 chars) | ✓ | identity → experience → clients → education | ✓ |
| creative-portfolio | 100/100 | 100% (534 chars) | ✓ | identity → experience → clients → education | ✓ |
| editorial-magazine | 100/100 | 100% (552 chars) | ✓ | identity → experience → clients → education | ✓ |
| luxury-minimal | 100/100 | 100% (554 chars) | ✓ | identity → experience → clients → education | ✓ |
| agency-designer | 100/100 | 100% (554 chars) | ✓ | identity → experience → clients → education | ✓ |
| visual-timeline | 100/100 | 100% (554 chars) | ✓ | identity → experience → clients → education | ✓ |
| tech-structured | 100/100 | 100% (554 chars) | ✓ | identity → experience → clients → education | ✓ |
| art-director-portfolio | 100/100 | 100% (552 chars) | ✓ | identity → experience → clients → education | ✓ |

## Second uploaded CV (`second-uploaded-cv`)

**File:** `/Users/yohannazancot/Documents/yohann azancot cv 2024.pdf`
**Import:** IMPORT_NEEDS_PASTE (browser-acceptance-cache-fresh-paste)
**CV result:** PASS

### Template visual results

| Template | Score | Page 1 fill | Exp on P1 | Order | Pass |
|----------|-------|-------------|-----------|-------|------|
| ats | 100/100 | 100% (658 chars) | ✓ | identity → experience → clients → education | ✓ |
| creative-portfolio | 100/100 | 100% (713 chars) | ✓ | identity → experience → clients → education | ✓ |
| editorial-magazine | 100/100 | 100% (737 chars) | ✓ | identity → experience → clients → education | ✓ |
| luxury-minimal | 100/100 | 100% (737 chars) | ✓ | identity → experience → clients → education | ✓ |
| agency-designer | 100/100 | 100% (737 chars) | ✓ | identity → experience → clients → education | ✓ |
| visual-timeline | 100/100 | 100% (737 chars) | ✓ | identity → experience → clients → education | ✓ |
| tech-structured | 100/100 | 100% (658 chars) | ✓ | identity → experience → clients → education | ✓ |
| art-director-portfolio | 100/100 | 100% (737 chars) | ✓ | identity → experience → clients → education | ✓ |

## Verify

```bash
node src/tests/qa-visual-quality-lock.mjs
node scripts/visual-quality-lock-report.mjs
```
