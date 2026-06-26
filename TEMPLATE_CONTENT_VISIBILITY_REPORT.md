# HIRELY P0 — Template Content Visibility

**Result:** PASS
**Generated:** 2026-06-25T20:02:21.771Z

## Problem

Switching templates (e.g. Modern Editorial) hid populated sections — experience, clients, and education disappeared while only tools/languages remained in the sidebar.

## Rules

Every production template must render all available data:

- identity
- summary
- experiences
- education
- skills
- tools
- languages
- clients
- projects

- If a section has data → it must appear in the DOM
- If the page is too long → A4 pagination creates page 2+ (never clip or hide)
- Switching template must never remove CV content

## Root cause

1. `normalizeCvDataForTemplate()` stripped `_fromFinalResumeData`, so templates treated canonical CV data like low-confidence parser preview.
2. Production `fieldRenderable()` and `filterSectionByConfidence()` aggressively dropped lines when the final-resume flag was missing.

## Fix

- Preserve `_fromFinalResumeData` / `_fromResumeData` through template normalization
- In production template mode: never filter sections by confidence; show all populated fields
- Recognize `_fromResumeData` as canonical render input in templates

## Production path verification

| Flag | Preserved |
|------|-----------|
| `_fromFinalResumeData` | yes |
| `_fromResumeData` | yes |

## Template switch results (production normalize → render)

| Template | Visibility score | Status |
|----------|------------------|--------|
| ATS Clean (`ats`) | 100% | PASS |
| Minimal ATS (`minimal-ats`) | 100% | PASS |
| Creative Portfolio (`creative-portfolio`) | 100% | PASS |
| Designer Editorial (`editorial-magazine`) | 100% | PASS |
| Executive Classic (`classic-corporate`) | 100% | PASS |
| Tech Structured (`tech-structured`) | 100% | PASS |

## Modern Editorial checks

| Check | Result |
|-------|--------|
| Experience section | PASS |
| Clients section | PASS |
| Education section | PASS |
| Tools content | PASS |
| Languages content | PASS |

## Acceptance

**PASS** — Switching template does not remove CV content; all populated sections render across production templates.

## Commands

```bash
npm run test:template-content-visibility
```
