# EDUCATION RECALL REPORT

Generated: 2026-06-07T22:49:36.264Z
Engine: `dedupeEducationEntries`
Pipeline: production import + education normalization + `sanitizeResumeForDisplay`

## Goal

**No duplicated education blocks** — one object per school + program; merge overlapping years.

### Goal status: **MET**

## Rules enforced

- Merge rows with same school, same program, and overlapping year spans
- Keep distinct programs at the same school as separate entries
- Union merged date ranges (min start → max end)

## Acceptance fixtures

| Fixture | Expected | Detected | TP | Duplicate blocks | Recall | Precision |
|---------|----------:|---------:|---:|-----------------:|-------:|----------:|
| Developer CV | 1 | 1 | 1 | 0 | **100%** | 100% |
| Creative CV | 2 | 2 | 2 | 0 | **100%** | 100% |
| Marketing CV | 2 | 2 | 2 | 0 | **100%** | 100% |
| Consultant CV | 2 | 2 | 2 | 0 | **100%** | 100% |
| Yoaz CV | 2 | 2 | 2 | 0 | **100%** | 100% |

**Aggregate recall:** 100% (9/9 education matched)
**Duplicate blocks (all fixtures):** 0

## Créapole duplicate recovery

Input (OCR-style duplicates):
- `Créapole — Visual Communication — 2007–2009`
- `Créapole — Visual Communication — 2008–2010`
- `Créapole — Product Design — 2011–2012`
- `LISAA — Web & Motion Design — 2011–2012`

Before dedupe: **4** rows (3 Créapole)
After dedupe: **3** rows (2 Créapole)

Merged output:
- Créapole — Product Design — 2011–2012
- LISAA — Web & Motion Design — 2011–2012
- Créapole — Visual Communication — 2007–2010

## Run

```bash
npm run qa:education-dedupe
npm run qa:education-normalization
npm run education:recall-report
```
