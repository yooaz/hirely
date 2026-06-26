# Header Cleaner — QA Report

**Result:** PASS

**Generated:** 2026-06-08T15:55:34.763Z

## Scope

P1 header cleaner: identity fields must not contain section titles or mixed OCR blobs.

## Problem

Header mixed contact info with section anchors:

```
email / phone / EDUCATION / FORMATION / COMPETENCES
```

## Rules

Header may contain only:

- name
- title
- email
- phone
- location

Forbidden in header:

- EDUCATION
- FORMATION
- COMPETENCES
- LANGUES
- CLIENTS

Stripped section tokens are moved to `unsorted`.

## Acceptance

| Check | Status |
|-------|--------|
| Header never contains section titles | PASS |
| Email/phone extracted from polluted fields | PASS |
| Name/title/location preserved when valid | PASS |

## Implementation

- `src/core/parsing/header-cleaner.js` — `HEADER_CLEANER`
- `applyHeaderCleaner()` wired into `normalizeCvData()`
- `rejectHeaderField()` delegates to `cleanHeaderField()`

## QA command

```bash
npm run qa:header-cleaner
```

## Console output

```
OK detects EDUCATION
OK detects FORMATION
OK detects COMPETENCES
OK detects LANGUES
OK detects CLIENTS
OK allows professional title
OK strips section words (Paris)
OK keeps location token
OK email extracted (jane@example.com)
OK phone extracted (+33 6 12 34 56 78)
OK title cleaned (Graphic Designer)
OK title role preserved
OK header cleaner marker
OK header blob clean (Jane Doe | Illustrator | jane@example.com | +33 6 12 34 56 78 | Paris)
OK email kept (jane@example.com)
OK phone kept (+33 6 12 34 56 78)
OK name kept (Jane Doe)
OK title kept (Illustrator)
OK location kept (Paris)
OK normalizeCvData header has no section titles
OK normalizeCvData email (yoaz@hotmail.fr)

HEADER_CLEANER QA PASS
```
