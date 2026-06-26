# GENERALIZATION_PROOF_REPORT

**Status:** PASS
**Engine:** `GENERALIZATION_PROOF_V1`
**Generated:** 2026-06-12T07:46:18.620Z

## Goal

Prove the parser is generic — no production rules depend on Yoaz-specific identity, schools, agencies, or brand anchors.

## Production cleanup

Removed or generalized:

- McCann hero injection and `McCann G. Agency` display rewrite
- LISAA / Créapole hardcoded education years and formatting
- `PROJECT_ANCHOR_TARGETS` acceptance anchors
- Hardcoded `Nike projects` segmentation default
- Brand-specific suggestion-confidence shortcuts (now entity-catalog driven)
- `CREATIVE_RECOVERY_CLIENT_ANCHORS` now sourced from `CLIENT_TERMS`

## Corpus

10 non-Yoaz text CVs from `tests/cv-corpus/` (developer, designer, consultant, executive, marketing, teacher, student, engineer, nurse, freelancer).

## Acceptance per CV

- Import succeeds through production pipeline
- Identity name matches corpus
- Contact (email or phone) present
- At least one experience and one education entry
- Template render produces non-empty HTML

## Summary

| Metric | Value |
|--------|-------|
| CVs tested | 10 |
| Pass | 10 |
| Fail | 0 |
| Pass rate | 100% |

## Per-CV results

| CV | Pass | Identity | Experience | Education | Render | Notes |
|----|------|----------|------------|-----------|--------|-------|
| developer | ✓ | Alex Chen | 1 | 1 | 1762 | — |
| designer | ✓ | Jordan Garcia | 4 | 1 | 3065 | — |
| consultant | ✓ | Sophie Martin | 7 | 2 | 2452 | — |
| executive | ✓ | James Whitfield | 6 | 1 | 2028 | — |
| marketing | ✓ | Laura Bennett | 3 | 2 | 2462 | — |
| teacher | ✓ | Maria Santos | 4 | 2 | 1543 | — |
| student | ✓ | Emma Johnson | 3 | 1 | 1605 | — |
| engineer | ✓ | David Okonkwo | 3 | 1 | 1781 | — |
| nurse | ✓ | Rachel Nguyen | 3 | 1 | 1661 | — |
| freelancer | ✓ | Lucas Moreau | 6 | 1 | 2084 | — |

## Production marker audit

**PASS** — no forbidden Yoaz-specific production markers detected in audit scan.

## Run

```bash
npm run qa:generalization-proof
npm run generalization-proof-report
```


## QA log (tail)

```
  languages: 1,
  clients: 0,
  projects: 0,
  unsorted: 0
}
PASS nurse — ok
NODE_RESUMEDATA_COUNTS {
  path: 'buildResumeData:importResult',
  experiences: 6,
  education: 1,
  skills: 0,
  tools: 0,
  languages: 2,
  clients: 0,
  projects: 0,
  unsorted: 0
}
PASS freelancer — ok

═══ Generalization Proof: 10/10 (100%) PASS ═══

(node:27706) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/src/core/pipeline/hirely-import.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
```
