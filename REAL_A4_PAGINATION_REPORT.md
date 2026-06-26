# HIRELY P0 — Real A4 Pagination

**Result:** PASS
**Generated:** 2026-06-10T18:38:10.465Z

## Problem

Long CVs exceeded a single A4 sheet and showed:
- Orange preview warning: “Content exceeds A4 page height”
- Content packed into one page with hidden overflow

## Rules (locked)

- Never crop content
- Never compress text until unreadable
- Never hide sections
- Split sections cleanly across pages
- Repeat header only when needed (continuation pages)
- PDF export must match preview page count

## Fix

| Layer | Change |
|-------|--------|
| `cv-a4-pages.js` | Conservative `PAGE_BUDGET_PX`, finer section splitting, `rebalancePageGroups()` |
| `cv-a4-pages.js` | Split experience entries by bullet when a single row is too tall |
| `cv-a4-pages.js` | Continuation pages re-use section titles when a section resumes |
| `a4-viewport.js` | Auto `rebalanceCvA4Pages()` before showing overflow warning |

## Fixture results

| Scenario | Template | Preview sheets | PDF pages | Overflow sheets | Blank sheets | No warning |
|----------|----------|---------------:|----------:|----------------:|-------------:|:----------:|
| long-creative | creative | 2 | 2 | 0 | 0 | ✓ |
| long-executive | executive-minimal | 2 | 2 | 0 | 0 | ✓ |
| long-ats | ats | 2 | 2 | 0 | 0 | ✓ |

## Acceptance

**PASS** — Long CVs create multiple A4 pages. No overflow warning. No clipped content. No blank page. Preview ≡ PDF.

## Run

```bash
npm run test:a4-pagination
```
