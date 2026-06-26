# Hirely Release Gate Report

**Generated:** 2026-06-06T23:16:18.583Z
**Verdict:** ✅ PASS

## Summary

| Check | Status | Notes |
|-------|--------|-------|
| OCR | PASS | OK |
| Import | PASS | OK |
| Parser | PASS | OK |
| Review Queue | PASS | OK |
| Templates | PASS | OK |
| PDF Export | PASS | OK |

## Release criteria

Pass only when:
- CV is readable (name + experience, no corruption in export)
- Import, OCR, and parser pipelines succeed
- Review queue gates low-confidence and corrupted lines
- All 12 production templates render without errors
- PDF export produces valid A4 PDFs (1-page, 2-page, creative scenarios)

Fail when:
- Corrupted text in final CV or template
- Empty CV, missing name, or missing experience
- Broken PDF or template render error

## Section details

### OCR — PASS

### Import — PASS

Reviews (non-blocking):
- review: tools inside education

Completeness: 86% (name, title, contact, experience, skills, education)

### Parser — PASS

### Review Queue — PASS

### Templates — PASS

### PDF Export — PASS

PDF scenarios:
- one-page: PASS (1 pg, A4=true)
- two-page: PASS (2 pg, A4=true)
- creative-portfolio: PASS (1 pg, A4=true)

## Commands

```bash
npm run release:gate
npm run release:notify:dry   # preview Resend summary (no send)
# Optional: RESEND_API_KEY, RESEND_FROM, HIRELY_RELEASE_NOTIFY_TO in .env.local
npm run release:notify
```

Machine-readable: `tests/output/release-gate/report.json`
