# HIRELY P0 — Client Detection

**Result:** PASS
**Generated:** 2026-06-10T16:20:53.800Z

## Problem

Creative CVs list client brands in bullets and prose, but the parser treated them as random text instead of `resume.clients[]`.

## CLIENT_DETECTION_ENGINE

Engine: `CLIENT_DETECTION_ENGINE` · wired in `section-engine-v2.js` when creative mode is active.

Detects:
- `Worked for:` / `Worked with:` multiline blocks
- `clients including` / `Collaborated with` bullet lists
- Entity dictionary matches (`clients.json`, `creative_clients.json`)

Anchor targets: **Nike** · **Adobe** · **Marvel** · **Apple** · **Google** · **Meta** · **Sony** · **Cadillac**

Stores: `structured.clients[]` → `resumeData.clients[]` → `cvData.clients[]` → template `cvSection--clients`.

### Worked-for sample

```
Worked for:
Nike
Adobe
Marvel
Apple
Google
Meta
Sony
Cadillac
```

Detected (8): Nike, Adobe, Marvel, Apple, Google, Meta, Sony, Cadillac

## Fixture audits

| Fixture | clients[] | cvData.clients | Anchor recall | Template section |
|---------|----------:|---------------:|--------------:|:----------------:|
| creative-cv | 8 | 7 | 100% | ✓ |
| creative-experience-rich | 7 | 6 | 100% | ✓ |

### creative-cv

**resume.clients[]:** Pantone, Nike, Louis Vuitton, Marvel, Cadillac, Fortune, Converse, Adobe

**Rendered brands:** Nike, Adobe, Marvel, Cadillac

| Expected in source | Detected |
|--------------------|----------|
| Nike | ✓ |
| Adobe | ✓ |
| Marvel | ✓ |
| Cadillac | ✓ |

### creative-experience-rich

**resume.clients[]:** Nike, PlayStation, Marvel, Converse, Cadillac, Fortune, Adobe

**Rendered brands:** Nike, Adobe, Marvel, Cadillac

| Expected in source | Detected |
|--------------------|----------|
| Nike | ✓ |
| Adobe | ✓ |
| Marvel | ✓ |
| Cadillac | ✓ |

## Rules

- Client brands must never be discarded as random unsorted text.
- `Adobe` in a client bullet is a brand; `Adobe Illustrator` in Tools is not.
- Agencies (e.g. McCann) stay in experience — not duplicated as clients when they are employers.
- Templates render `cvSection--clients` / `cvSection--clients-hero` on creative layouts.

## Acceptance

**PASS** — Creative CVs expose client history in `resume.clients[]` and templates.

## Run

```bash
npm run test:client-detection
```
