# EXTRACTION FREEZE — active mission

**No feature work. No UI. No styles. No export.**

Product work resumes only when `npm test` (extraction release gate) passes on every commit.

## Release blocked until

| Criterion | Threshold |
|-----------|-----------|
| Coverage | > 90% |
| Experience | detected (count ≥ 1) |
| Identity | detected (valid name) |
| Pipeline loss | = 0 |
| Parser loss | < 5% |
| Designer CV (`YOAZ_CV_DESIGNER`) | PASS |
| Creative CV | PASS |
| Multi-column CV | PASS |
| Scanned PDF (OCR text path) | PASS |

## Commands

```bash
npm test                    # extraction release gate (required)
npm run golden:cv           # designer golden only
npm run setup:hooks         # pre-commit → npm test
```

## Scope allowed during freeze

- `src/core/extraction/**`
- `src/core/parsing/**`
- `src/core/layout/**`
- `src/core/validation/**` (audit gates only)
- `tests/**`, `src/tests/**` (extraction QA only)

## Out of scope (frozen)

- `index.html`, `src/ui/**`, templates styling, export/PDF, new product features
