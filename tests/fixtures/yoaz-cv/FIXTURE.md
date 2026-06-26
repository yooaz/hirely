# Yoaz CV fixture

Canonical creative CV used for parser regression and **GOLDEN CV** gate (`YOAZ_CV_DESIGNER`).

Golden expectations:

- **Classification** (canonical term → bucket): `tests/golden/yoaz-cv-classification.json`  
  Run: `npm run golden:yoaz`
- **Structure** (section engine): `tests/golden/cv-expectations.json`  
  Run: `npm run golden:cv`

Classification reference mappings:

| Term | Bucket |
|------|--------|
| LISAA, Créapole | education |
| Adobe Illustrator | tools |
| English, French | languages |
| Nike, Adobe, Marvel | clients |
| Packaging, Branding | skills |
| Music, Movies | interests |
