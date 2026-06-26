# Golden resumes (universal parser)

Structural regression only — no hardcoded names, employers, or schools.

## Layout

- `manifest.json` — 18 cases (3× ATS, corporate, creative, scanned, docx, paste)
- Fixtures live under `tests/fixtures/` (referenced by path)

## Run

```bash
npm run qa:universal-parser
```

## Acceptance (per case)

When `rawText.length > 0`:

- Identity/contact detected **or** contact signals in `unsorted`
- Experience rows **or** career text in `unsorted`
- Education rows **or** education signals in `unsorted`
- Skills/tools **or** skill-like lines in `unsorted`
- `lossChars === 0` (zero text loss)
- No invented strict experiences (date + role/company gate)
- `structuredResume` JSON under 20k chars
