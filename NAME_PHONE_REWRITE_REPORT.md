# NAME_PHONE_REWRITE_REPORT

Generated: 2026-06-12T22:18:19.596Z

## P0 status

| Item | Value |
|------|-------|
| Version | `NAME_PHONE_REWRITE_V1` |
| Name confidence gate | **85%** → reviewQueue if below |
| Phone confidence gate | **95%** → reviewQueue if below |
| QA suite | PASS (27 pass, 0 fail) |

## Name extraction rules

### Priority order

1. Top CV header (before first section break)
2. Largest valid text block on first page
3. Text line directly above email
4. Text line directly above phone
5. Contact neighbors (±2 lines)

### Hard rejects

- Business tokens: agency, studio, company, group, inc, ltd, llc, impressions, creative, design, marketing, media, portfolio, freelance
- More than 4 words
- Contains digits, `@`, or URL
- Collides with employer name

### Principle

**Missing is better than wrong** — low-confidence names cleared and routed to reviewQueue.

## Phone extraction rules

### Accept

- `+33XXXXXXXXX` (French mobile/landline)
- `0XXXXXXXXX` (French national)
- Valid international E.164 patterns

### Never merge / accept

- Year ranges: `2010-2013`, `2011 2014`, `+33… 2011-2020`
- Postal codes: `75011`
- Page numbers: `Page 2 of 3`, `2/3`
- OCR junk: `38 impressions`

### Principle

Phone displayed only when confidence ≥ **95%** and `validatePhoneStrict` passes.

## Files changed

| File | Role |
|------|------|
| `src/core/parsing/identity-extraction.js` | v2 name priority, reject rules, 85% gate |
| `src/core/parsing/phone-normalize.js` | Pollution detection, 95% gate |
| `src/core/parsing/parser-recovery.js` | `detectNameCandidates` delegates to `extractLockedIdentity` |
| `src/core/parsing/identity-name-phone-v2.js` | Public rewrite API surface |

## Verification

```bash
node src/tests/qa-name-phone-rewrite.mjs
npm run qa:phone-strict-extraction
npm run qa:identity-contact-strictness
```

## QA output

```
PASS rewrite_version
PASS name_confidence_min_85
PASS phone_confidence_min_95
PASS reject_lontac_impressions
PASS reject_38_impressions
PASS reject_year_range_name
PASS accept_yohann_azancot
PASS yoaz_name_extracted
PASS yoaz_name_confidence
PASS yoaz_not_company
PASS company_first_line_rejected
PASS combo_yoaz_phone
PASS combo_yoaz_name
PASS phone_clean_accept
PASS phone_clean_norm
PASS phone_year_pollution
PASS phone_postal_pollution
PASS phone_impressions_pollution
PASS phone_spaced_years
PASS reject_polluted_phone
PASS reject_corrupt_phone
NODE_RESUMEDATA_COUNTS {
  path: 'buildResumeData:importResult',
  experiences: 3,
  education: 0,
  skills: 1,
  tools: 0,
  languages: 0,
  clients: 0,
  projects: 0,
  unsorted: 0
}
PASS pipeline_yoaz_name
PASS pipeline_yoaz_phone
PASS pipeline_no_lontac_name
NODE_RESUMEDATA_COUNTS {
  path: 'buildResumeData:importResult',
  experiences: 3,
  education: 0,
  skills: 0,
  tools: 0,
  languages: 0,
  clients: 0,
  projects: 0,
  unsorted: 2
}
PASS polluted_phone_review
PASS extract_candidate_yoaz

═══ Name Phone Rewrite: 26/26 PASS ═══
```
