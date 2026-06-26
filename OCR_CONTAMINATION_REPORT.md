# OCR_CONTAMINATION_REPORT

Generated: 2026-06-08T11:41:39.601Z
Verdict: **PASS**
Checks: **14/14**

## P1 — OCR Contamination Firewall

Normalization-only guards. No boot, template, or PDF changes.

### Header fields (`name`, `title`, `email`, `phone`)
- Reject section anchors: EDUCATION, FORMATION, EXPERIENCE, SKILLS, TOOLS, LANGUAGES, CLIENTS

### Education
- Reject `http`, `www`, `instagram`, `linkedin`, `behance`
- Reject years before 1950 or after current year + 1
- Reject education spans longer than 10 years

### Experience
- Split merged lines on new date ranges, company boundaries, internship keywords
- Separate internships from freelance roles

### Clients
- Only comma/bullet lists with recognized brand dictionary matches
- Never infer clients from summary, skills, or education prose

## Acceptance criteria

- ✓ No EDUCATION in header
- ✓ No URLs in education
- ✓ No future or impossible dates
- ✓ No hallucinated clients
- ✓ Internships separated from freelance roles

## Module

- `src/core/parsing/ocr-contamination-firewall.js`
- Wired at end of `normalizeCvData()` in `rich-parser.js`

## Run

```bash
npm run qa:ocr-contamination-firewall
npm run ocr-contamination-report
```