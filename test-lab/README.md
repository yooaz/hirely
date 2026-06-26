# Hirely Test Lab

Unified testing environment for 50 CVs across countries, languages, layouts, and source types.

## Run

```bash
npm run qa:hirely-test-lab
npm run hirely-test-lab-report
```

## Dashboard

Serve the repo root and open `test-lab/index.html`:

```bash
npm run dev
# http://localhost:3001/test-lab/
```

## Output

- `tests/output/hirely-test-lab/report.json` — machine-readable results
- `TEST_LAB_RESULTS.md` — human-readable summary

## Metrics

| Metric | Measures |
|--------|----------|
| Extraction accuracy | Name, contact, experience, education, skills recall |
| Template quality | Product score + scan-zone proxy for role-matched V3 template |
| ATS score accuracy | ATS analyzer score vs expected minimum from ground truth |
| PDF quality | Export-lock readiness (finalResume + contract) |

## Catalog

50 cases in `tests/lib/hirely-test-lab-catalog.mjs`:

- 45 role × format matrix (TXT, PDF-text, PDF-scan, DOCX, PNG/JPG)
- 5 LinkedIn (PDF, export, merge)
- Countries: US, UK, FR, DE, CH, NL, ES, CA
- Languages: en, fr, de, es, nl
