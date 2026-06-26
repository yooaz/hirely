# Yohann Azancot PDF — regression target

Mandatory fixture for parser reliability work. **Tests are expected to fail** until the pipeline meets this spec.

## Run

```bash
npm run qa:yoaz-pdf-regression
npm run qa:yoaz-pdf-regression -- --only=spatial
npm run qa:yoaz-pdf-regression -- --only=production
```

## Artifacts

| File | Role |
|------|------|
| `tests/golden/yoaz-pdf-target.expected.json` | Machine-readable target rules |
| `tests/golden/yoaz-pdf-normalized.target.snapshot.json` | Target normalized JSON snapshot |
| `tests/output/yoaz-pdf-regression/snapshot-spatial-current.json` | Current spatial pipeline output (written each run) |
| `tests/output/yoaz-pdf-regression/snapshot-production-current.json` | Current flat production output |
| `tests/output/yoaz-pdf-regression/report.json` | Pass/fail matrix |

## Layout contract (page 1)

- **Sidebar** (x &lt; 280): contact, profile, languages
- **Main column** (x ≥ 300): work experience, education, skills, interests
- **Page 2**: portfolio only — must not appear in core CV JSON

## Suites

1. **PAGE_CLASSIFICATION** — page 1 `resume_core`, page 2 `portfolio_page`
2. **SECTION_PURITY** — sidebar/main column text boundaries
3. **HARD_FAILURES** — no duplicate education, clients in skills, portfolio pollution, column merge
4. **TARGET_BEHAVIOR** — full contact, 3 experiences, 4 education, 6 skills, 9 interests
5. **SNAPSHOT_DIFF** — count/shape vs target snapshot

## Known broken baseline (production_flat)

`fixture.txt` without coordinates produces column merge (`Art Snowboard` identity, clients in skills, 1 experience). Documented in test output until Phase 1 wiring fix.
