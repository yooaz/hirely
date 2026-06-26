# Real CV benchmark pack

18 messy CV files for import benchmarking — **not** single-fixture Yoaz paths.

| Pack | Count | Categories |
|------|------:|------------|
| PDF | 10 | selectable, scanned, Canva, InDesign, protected, two-column, image-heavy, creative portfolio, corporate, old export |
| DOCX | 5 | simple Word, table layout, two-column, header/footer contact, creative Word |
| Image | 3 | PNG, JPG, screenshot |

Generated under `tests/output/real-cv-benchmark-pack/`. Override slots via `tests/real-world-corpus/` (`pdf_canva.pdf`, etc.).

```bash
npm run qa:real-cv-benchmark-pack
npm run real-cv-benchmark-pack-report
```

Report: `REAL_CV_BENCHMARK_PACK_REPORT.md`
