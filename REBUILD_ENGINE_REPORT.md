# CV Rebuild Engine Report

**Generated:** 2026-06-14
**Engine:** `CV_REBUILD_ENGINE_V1`
**QA gate:** PASS

## Policy

Instead of preserving original layout, Hirely **rebuilds from extracted data**.

- **Never rely on source formatting** — columns, tabs, geometry, and layout hints are discarded.
- **Output must always be clean** — semantic fields only, normalized and contract-locked.
- Templates receive rebuilt `cvData`, not source structure.

## Pipeline

```
CV → Extract → Structure → Normalize → Rebuild
```

| Stage | Module | Role |
|-------|--------|------|
| Extract | `enterprise-engine.js`, `cv-normalizer.js` | Raw text / lines → cleaned extraction |
| Structure | `p0-pipeline.js`, `structured-resume-from-blocks.js` | Blocks → semantic `structuredResume` |
| Normalize | `cv-normalizer.js`, `resume-data.js` | Strip formatting artifacts, normalize fields |
| Rebuild | `final-resume-contract.js`, `resume-data.js` | `finalResumeData` + clean `cvData` |

## Architecture

| Layer | Path | Role |
|-------|------|------|
| Engine | `src/core/pipeline/cv-rebuild-engine.js` | Orchestrates 4-stage rebuild pipeline |
| Import wire | `src/core/pipeline/hirely-import.js` | `applyCvRebuildEngine` patches import result |
| QA | `src/tests/qa-cv-rebuild-engine.mjs` | Fixture matrix + audit gates |

## Stages

- **extract**
- **structure**
- **normalize**
- **rebuild**

## Fixture matrix

| Fixture | Audit clean | Renderable | Identity | Experiences | Violations |
|---------|-------------|------------|----------|-------------|------------|
| Yoaz TXT | true | true | Yohann Azancot | 2 | — |
| Creative paste | true | true | Yohann Azancot | 0 | — |

## Audit checks

- `never_preserves_layout` — metadata flag set
- `rebuild_engine_version` — `CV_REBUILD_ENGINE_V1`
- `no_forbidden_cv_keys` — no `_sourceLines`, layout blocks, forensic payloads
- `no_layout_meta` — no `layoutType`, `bbox`, column geometry in output meta
- `no_tab_alignment` / `no_multi_space_alignment` — source column formatting stripped
- `has_identity` — rebuilt CV has a name

## Verification

```bash
npm run qa:cv-rebuild-engine
npm run cv-rebuild-engine-report
```

