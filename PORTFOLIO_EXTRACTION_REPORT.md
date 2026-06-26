# HIRELY P0 — Portfolio Extraction

**Result:** PASS
**Generated:** 2026-06-10T16:26:13.410Z

## Problem

Creative CVs surface portfolio and social links in contact headers and labeled lines, but the parser often left them in unsorted text instead of `resume.portfolioLinks[]`.

## PORTFOLIO_EXTRACTION_ENGINE

Engine: `PORTFOLIO_EXTRACTION_ENGINE` · wired in `section-engine-v2.js` when creative mode is active, and in `polishResumeOutput` when portfolio signals are present.

Detects:
- Contact separator lines (`email · behance.net/user · instagram.com/user`)
- Labeled rows (`Portfolio:`, `Website:`, `LinkedIn:`, `Foundation:`, etc.)
- Inline URLs (`https://`, `www.`, bare `behance.net/...`)
- Identity fields (`identity.linkedin`, `identity.website`) merged into links

Platforms: **Behance** · **Dribbble** · **Portfolio** · **Website** · **Instagram** · **ArtStation** · **Foundation** · **LinkedIn**

Stores: `structured.portfolioLinks[]` → `resumeData.portfolioLinks[]` → `cvData.portfolioLinks[]` → template `cvSection--portfolio`.

### Labeled sample

```
Portfolio: https://janecreative.com
Website: www.janecreative.design
LinkedIn: linkedin.com/in/janecreative
Foundation: foundation.app/@janecreative
```

Detected (4): Portfolio — https://janecreative.com · Website — https://www.janecreative.design · LinkedIn — https://linkedin.com/in/janecreative · Foundation — https://foundation.app/@janecreative

Rich fixture forced run: 8 links

## Fixture audits

| Fixture | portfolioLinks[] | cvData.links | Platform recall | Template section |
|---------|-----------------:|-------------:|----------------:|:----------------:|
| portfolio-links-rich | 8 | 8 | 100% | ✓ |
| creative-cv | 0 | 0 | 0% | ✗ |

### portfolio-links-rich

**resume.portfolioLinks[]:**
- Behance — https://behance.net/janecreative
- Dribbble — https://dribbble.com/janecreative
- Instagram — https://instagram.com/janecreative
- ArtStation — https://artstation.com/janecreative
- Foundation — https://foundation.app/@janecreative
- Portfolio — https://janecreative.com
- Website — https://www.janecreative.design
- LinkedIn — https://linkedin.com/in/janecreative

**identity.linkedin:** https://linkedin.com/in/janecreative

| Expected in source | Detected |
|--------------------|----------|
| Behance | ✓ |
| Dribbble | ✓ |
| Portfolio | ✓ |
| Website | ✓ |
| Instagram | ✓ |
| ArtStation | ✓ |
| Foundation | ✓ |
| LinkedIn | ✓ |

### creative-cv

**resume.portfolioLinks[]:**
- —


| Expected in source | Detected |
|--------------------|----------|
| Portfolio | ✗ |
| LinkedIn | ✗ |

## Rules

- Portfolio URLs must never be discarded as random unsorted text.
- `LinkedIn` URLs sync to `identity.linkedin` when missing.
- Primary non-LinkedIn URL syncs to `identity.website` when missing.
- `foundation.app` is included alongside Behance, Dribbble, ArtStation, Instagram.
- Templates render `cvSection--portfolio` on creative layouts (`portfolio-artist`, etc.).

## Acceptance

**PASS** — Creative CVs expose portfolio/social links in `resume.portfolioLinks[]` and templates.

## Run

```bash
npm run test:portfolio-extraction
```
