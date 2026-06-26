# LinkedIn Optimizer Report

**Generated:** 2026-06-08T17:36:30.841Z
**Engine:** `LINKEDIN_OPTIMIZER_V1`
**Gate:** PASS
**Verdict:** PASS

## Scope

- **Input:** `finalResumeData` only (locked UI profile)
- **Output:** Headline, About, top skills, recruiter keywords
- **Analysis:** Current strength, missing keywords, optimization suggestions
- **No AI:** deterministic composition from CV fields

## Acceptance

| Check | Result |
|-------|--------|
| finalResumeDataOnly | PASS |
| noFakeAi | PASS |
| headlineGenerated | PASS |
| aboutGenerated | PASS |
| topSkillsGenerated | PASS |
| keywordsGenerated | PASS |
| strengthShown | PASS |
| missingKeywordsShown | PASS |
| suggestionsShown | PASS |
| thinLowerScore | PASS |

## Sample — Yoaz (real CV)

**Strength:** 100/100 (Strong)

### Headline

Graphic Designer / Illustrator | Illustration · Graphic Design | Paris

### About (excerpt)

Illustrator and graphic designer with 10+ years creating brand identities, packaging, and editorial work.

Highlights
• Freelance Illustrator / Graphic Designer — Independent / Freelance — 2011–2022: Posters, packaging, and logos for international brands
• Designer — McCann G. Agency — 2011–2014: Campaign visuals

Educ…

### Top skills

- Illustration
- Graphic Design
- Packaging
- Logo Design
- Visual Identity
- Editorial Design
- Adobe Illustrator
- Photoshop
- InDesign

### Recruiter keywords

Graphic Designer, Illustrator, Illustration, Graphic Design, Packaging, Logo Design, Visual Identity, Editorial Design, Adobe Illustrator, Photoshop, InDesign, designer, intern, freelance, editor, Freelance Illustrator / Graphic Designer

### Missing keywords

- brand identity
- creative direction
- art direction
- adobe indesign

### Suggestions

- Add "brand identity" to your headline, About, or skills if it matches your real work.
- Add "creative direction" to your headline, About, or skills if it matches your real work.
- Add "art direction" to your headline, About, or skills if it matches your real work.
- Add "adobe indesign" to your headline, About, or skills if it matches your real work.

## Thin profile contrast

- **Strength:** 20/100 (Needs work)
- **Missing keywords:** 8
- **Suggestions:** 8

## Files

- `src/core/export/linkedin-optimizer.js` — `buildLinkedInOptimization()`
- `src/tests/qa-linkedin-optimizer.mjs` — gate

## Commands

```bash
npm run qa:linkedin-optimizer
npm run linkedin-optimizer-report
```

<details><summary>Formatted export sample</summary>

```
LINKEDIN HEADLINE
Graphic Designer / Illustrator | Illustration · Graphic Design | Paris

LINKEDIN ABOUT
Illustrator and graphic designer with 10+ years creating brand identities, packaging, and editorial work.

Highlights
• Freelance Illustrator / Graphic Designer — Independent / Freelance — 2011–2022: Posters, packaging, and logos for international brands
• Designer — McCann G. Agency — 2011–2014: Campaign visuals

Education: Créapole — Visual Communication — 2008–2011

Clients & brands: Nike

TOP SKILLS
• Illustration
• Graphic Design
• Packaging
• Logo Design
• Visual Identity
• Editorial Design
• Adobe Illustrator
• Photoshop
• InDesign

RECRUITER KEYWORDS
Graphic Designer, Illustrator, Illustration, Graphic Design, Packaging, Logo Design, Visual Identity, Editorial Design, Adobe Illustrator, Photoshop, InDesign, designer, intern, freelance, editor, Freelance Illustrator / Graphic Designer

CURRENT STRENGTH: 100/100 (Strong)

MISSING KEYWORDS
• brand identity
• creative direction
• art direction
• adobe indesign

OPTIMIZATION SUGGESTIONS
• Add "brand identity" to your headline, About, or skills if it matches your real work.
• Add "creative direction" to your headline, About, or skills if it matches your real work.
• Add "art direction" to your headline, About, or skills if it matches your real work.
• Add "adobe indesign" to your headline, About, or skills if it matches your real work.
```

</details>
