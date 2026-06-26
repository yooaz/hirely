# Extraction Recovery Report

**Generated:** 2026-06-14
**Engine:** `EXTRACTION_RECOVERY_V1`
**Low-confidence threshold:** 70%
**QA gate:** PASS

## Policy

- When extraction confidence is low, **never fail silently**.
- Surface **Detected Issues**, **Missing Sections**, and **Low Confidence Fields**.
- Allow user correction via Fix / Add actions in the inspector panel.
- **Never output broken CVs** — placeholder or critical-missing content blocks preview and export.

## Architecture

| Layer | Path | Role |
|-------|------|------|
| Engine | `src/core/validation/extraction-recovery.js` | Aggregates readiness, placeholders, field confidence |
| UI | `src/ui/product/extraction-recovery-panel.js` | Three-section recovery inspector |
| Styles | `src/ui/product/extraction-recovery.css` | Editorial panel styling |
| Gate | `index.html` | `renderCVInner` blocks `blockRender`; `isExportReady` checks `outputSafe` |

## Fixture matrix

| Fixture | Show recovery | Output safe | Block render | Issues | Missing | Low conf |
|---------|---------------|-------------|--------------|--------|---------|----------|
| strong | true | true | false | 0 | 2 | 0 |
| weak | true | false | true | 0 | 10 | 0 |
| placeholder | true | false | true | 2 | 6 | 2 |

## UI sections

1. **Detected Issues** — pending review-queue items + placeholder violations
2. **Missing Sections** — name, email, experience, education, skills gaps
3. **Low Confidence Fields** — fields below field-confidence V2 threshold

## Verification

```bash
npm run qa:extraction-recovery
npm run extraction-recovery-report
```

