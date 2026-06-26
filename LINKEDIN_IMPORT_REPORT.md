# LinkedIn Import Report

**Generated:** 2026-06-14
**Engine:** `LINKEDIN_IMPORT_V1`
**QA gate:** PASS

## Supported sources

| Source | Detection | Parser |
|--------|-----------|--------|
| LinkedIn PDF | Filename + `linkedin.com/in`, Top Skills markers | Standard PDF extraction |
| LinkedIn profile export | `.json` / `.csv` with Profile, Positions, Skills keys | `linkedin-export-parser.js` |
| Resume PDF | Generic CV markers, default PDF path | Production import pipeline |

## Merge strategy

1. **Score each source** — field completeness × source-type weight
2. **Pick best scalar** — name, title, email, phone, LinkedIn URL, summary
3. **Merge lists** — skills, tools, education, languages with fuzzy dedupe
4. **Experience merge** — `dedupeExperienceEntries` keeps richest role block
5. **Duplicate report** — logs merged pairs and field winners

## Source quality weights

| Field | LinkedIn export | LinkedIn PDF | Resume PDF |
|-------|-----------------|--------------|------------|
| Identity / LinkedIn URL | High | High URL | Medium |
| Experience bullets | High structured | Medium | Highest |
| Skills | Highest | High | Medium |
| Summary | Medium | Medium | Highest |

## Sample merge (fixture)

| Metric | Value |
|--------|-------|
| Sources | 2 |
| Confidence | 53 |
| Experiences | 2 |
| Skills | 2 |
| Duplicates resolved | 2 |

### Field winners

- **name** ← Profile.json
- **title** ← Profile.json
- **email** ← Profile.json
- **phone** ← resume.pdf
- **location** ← Profile.json
- **linkedin** ← Profile.json

## Files

| File | Role |
|------|------|
| `src/core/import/linkedin-source-detect.js` | Source detection |
| `src/core/import/linkedin-export-parser.js` | JSON/CSV export parser |
| `src/core/import/linkedin-import-engine.js` | Merge + quality scoring |
| `src/ui/product/linkedin-import-panel.js` | Import UI summary |
| `index.html` | Multi-file drop + merge hook |

## Commands

```bash
npm run qa:linkedin-import
npm run linkedin-import-report
```
