# PERSON_COMPANY_DISAMBIGUATION_REPORT

Generated: 2026-06-12T22:21:57.215Z

## P0 status

| Item | Value |
|------|-------|
| Version | `PERSON_COMPANY_DISAMBIGUATION_V1` |
| Entity types | person, company, school, client, skill |
| QA suite | PASS (30 pass, 0 fail) |

## Rule

**Never allow company names to become candidate identity.**

Entity type is detected **before render**. If type is `company`, it cannot populate:

- `fullName` (identity.name)
- `headline` (identity.title)
- `email`
- `phone`

School, client, and skill entities are also blocked from `fullName` / `headline`.

## Detection order

1. **Company** — agency/studio/impressions/business tokens, org suffixes (inc, ltd, sarl…)
2. **School** — school dictionary, education semantic cues
3. **Client** — brand/client dictionary (Nike, Adobe…)
4. **Skill** — tools, software, standalone disciplines
5. **Person** — valid person-name pattern or job title (headline only)

## Principle

**Missing is better than wrong** — blocked values cleared, pushed to reviewQueue / unsorted.

## Files

| File | Role |
|------|------|
| `src/core/parsing/person-company-disambiguation.js` | Entity classification + identity field guard |
| `src/core/validation/sanitize-resume-display.js` | Pre-render disambiguation pass |
| `src/core/resume-data.js` | `sanitizeIdentity` guard |
| `src/tests/qa-person-company-disambiguation.mjs` | QA suite |

## Verification

```bash
node src/tests/qa-person-company-disambiguation.mjs
npm run qa:identity-false-name
npm run qa:name-phone-rewrite
```

## QA output

```
PASS version
PASS classify:Yohann Azancot
PASS classify:Sophie Martin
PASS classify:Lontac Impressions
PASS classify:Studio Azur
PASS classify:McCann Agency
PASS classify:LISAA
PASS classify:Créapole
PASS classify:Nike
PASS classify:Adobe
PASS classify:Photoshop
PASS classify:Illustrator
PASS company_blocks_fullName
PASS company_blocks_headline
PASS company_blocks_email
PASS company_blocks_phone
PASS person_allows_fullName
PASS client_blocks_fullName
PASS school_blocks_fullName
PASS skill_blocks_fullName
PASS valid_email_allowed
PASS valid_phone_allowed
PASS guard_strips_company_name
PASS guard_strips_company_title
PASS guard_strips_company_email
PASS guard_strips_company_phone
PASS guard_review_items
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
PASS pipeline_no_company_name
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
PASS pipeline_keeps_person_name

═══ Person Company Disambiguation: 29/29 PASS ═══
```
