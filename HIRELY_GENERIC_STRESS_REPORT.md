# HIRELY P1 — Generic Parser Stress Report

**Generated:** 2026-06-06T23:15:42.852Z
**Suite:** `hirely-p1-generic-stress-v1`

## Verdict

**PASS**

## Acceptance

| Criterion | Status |
|-----------|--------|
| No P0 production-specific parser rules | PASS (0 violations) |
| Yoaz CV parses via generic rules | PASS |
| ≥ 5/6 primary fixtures usable | PASS (6/6) |
| Universal parser gate | PASS |
| Release gate (templates + PDF) | PASS |

## Generic rules added

- `generic-career-signals.js` — role words, freelance/intern patterns, date ranges, org context
- Identity: top-line name scoring, email local-part fallback, no person literals
- Education: dictionary-driven schools (`schools.json`) + generic degree keywords
- OCR entity hints loaded from `CREATIVE_SCHOOLS` + `CREATIVE_AGENCIES` catalogs
- UI classify/suggestion heuristics use generic school/education terms only

## Specific rules removed

- `import-repair.js` — removed `mccann|graphic designer` career line regex
- `pipeline-contract.js` — removed McCann/freelance literal career signals
- `review-queue-categories.js` — removed `lisaa|créapole` education hints
- `creative-entity-guard.js` — removed inline LISAA/Créapole/McCann OCR hints
- `index.html` — demo sample uses generic Alex Martin; `?test=demo` replaces `?test=yoaz`

## Fixture results

| Fixture | Usable | Name | Email | Phone | Exp | Edu | Skills | Lang | Issues |
|---------|--------|------|-------|-------|-----|-----|--------|------|--------|
| Creative / Designer CV | PASS | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Developer CV | PASS | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Marketing CV | PASS | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Sales / Commercial CV | PASS | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Recruiter / HR CV | PASS | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Consultant / Manager CV | PASS | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Yoaz CV (generic rules verification) | PASS | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — |

## Yoaz verification (generic only)

- Name: `Yohann Azancot`
- Experience: 11
- Education: 2
- Skills+tools: 21

## Commands

```bash
npm run stress:p1
npm run stress:p1-report
node tests/lib/universal-parser-gate.mjs
```

