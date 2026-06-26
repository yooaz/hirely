# Hirely RC1 Final Lock

**Status:** **PASS — RC1_READY**
**Run:** 2026-06-16T07:38:40.105Z
**RC1_READY:** `true`

## Locked scope (no new features)

| Capability | RC1 |
|------------|-----|
| TXT import | ✓ |
| DOCX import | ✓ |
| Text PDF import | ✓ |
| Paste flow | ✓ |
| Scanned PDF → paste fallback | ✓ (no OCR) |
| Review | ✓ |
| Templates | ✓ |
| Export PDF | ✓ |

## Full gate suite

| Gate | Command | Result |
|------|---------|--------|
| Core boot | `run test:core-boot` | **PASS** |
| Hirely test matrix | `run qa:hirely-test-matrix` | **PASS** |
| V1 release (browser) | `run v1-release-test` | **PASS** |
| Paste guaranteed flow | `run qa:paste-guaranteed-flow` | **PASS** |
| Template isolation | `run qa:template-isolation` | **PASS** |
| Export rewrite | `run qa:export-rewrite` | **PASS** |
| PDF export report | `run pdf-export-report` | **PASS** |
| RC1 aggregate report | `run rc1-report` | **PASS** |

## V1 browser flows

| Flow | Pass | ms | Notes |
|------|------|-----|-------|
| txt | PASS | 321 | Review + Style/Export unlocked |
| docx | PASS | 189 | Review + Style/Export unlocked |
| text_pdf | PASS | 1330 | Review + Style/Export unlocked |
| paste_text | PASS | 1371 | Review + Style/Export unlocked |
| scanned_pdf | PASS | 173 | Scanned PDF → paste fallback in 173ms (V1 — no OCR) |

## Test matrix (`tests/fixtures/hirely-test-lab/`)

**6/6** fixtures — import · review · template · export

| File | Import | Review | Template | Export |
|------|--------|--------|----------|--------|
| `paste.txt` | **PASS** | **PASS** | **PASS** | **PASS** |
| `txt.txt` | **PASS** | **PASS** | **PASS** | **PASS** |
| `docx.docx` | **PASS** | **PASS** | **PASS** | **PASS** |
| `bad.pdf` | **PASS** | **PASS** | **PASS** | **PASS** |
| `scan.pdf` | **PASS** | **PASS** | **PASS** | **PASS** |
| `good.pdf` | **PASS** | **PASS** | **PASS** | **PASS** |

## PDF export

- Gate: **PASS** (100% success)

## Paste flow

- **PASS** (12/12 checks)

## Runtime lock (`index.html`)

```
HIRELY_V1_SCOPE_LOCK=true
HIRELY_OCR_DISABLED_V1=true
HIRELY_ONE_CV_SOURCE=true
HIRELY_NAVIGATION_LOCK=true
HIRELY_EXPORT_SIMPLE=true
HIRELY_RC1_READY=true
```

## Verification

```bash
npm run final-rc1-lock-report
```

Or run gates individually:

```bash
npm run test:core-boot
npm run qa:hirely-test-matrix
npm run v1-release-test
npm run qa:paste-guaranteed-flow
npm run qa:template-isolation
npm run qa:export-rewrite
npm run pdf-export-report
npm run rc1-report
```

## Ship checklist

- [x] All RC1 gates PASS
- [x] Scope frozen — no OCR, no ATS blockers on critical path
- [x] PDF export gate PASS
- [ ] Manual smoke on production URL (optional)
