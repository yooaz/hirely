# SKILL RECOVERY REPORT

Generated: 2026-06-07T22:53:26.751Z
Engine: `harvestSkillsFromDescriptions`
Pipeline: production import + skill harvest + `sanitizeResumeForDisplay`

## Goal

**5–15 relevant skills** harvested from experience, project, and portfolio descriptions.
Reject OCR junk such as `Photograph`.

### Goal status: **MET**

## Rules enforced

- Harvest from experience roles, bullets, descriptions, and specialties
- Harvest from project and portfolio text
- Harvest from summary and explicit skills section (minus OCR garbage)
- Map branding / visual identity → Brand Identity
- Posters → Editorial Design; logos → Logo Design
- Clamp output to 5–15 skills

## Fixtures

| Fixture | Skills | In range | Photograph rejected | Creative hits |
|---------|-------:|:--------:|:-------------------:|:-------------:|
| Creative CV | 10 | ✓ | ✓ | 7/7 |
| Yoaz CV | 14 | ✓ | ✓ | 7/7 |
| Developer CV | 5 | ✓ | ✓ | 0/7 |
| Marketing CV | 5 | ✓ | ✓ | 0/7 |
| Consultant CV | 7 | ✓ | ✓ | 0/7 |
| Fragmented OCR sample | 8 | ✓ | ✓ | 6/7 |

## Creative expected skills

- Illustration
- Graphic Design
- Editorial Design
- Packaging
- Logo Design
- Brand Identity
- Art Direction

## Per-fixture output

### Creative CV (`creative-cv`)

Skills (10): Illustration · Graphic Design · Editorial Design · Packaging · Logo Design · Brand Identity · Art Direction · Visual Identity · Print Production · Poster Design

Creative matches: Illustration, Graphic Design, Editorial Design, Packaging, Logo Design, Brand Identity, Art Direction

### Yoaz CV (`yoaz-cv`)

Skills (14): Illustration · Graphic Design · Editorial Design · Packaging · Logo Design · Brand Identity · Art Direction · Visual Identity · Print Production · Poster Design · Typography · Motion Design · Branding · Mentoring

Creative matches: Illustration, Graphic Design, Editorial Design, Packaging, Logo Design, Brand Identity, Art Direction

### Developer CV (`developer-cv`)

Skills (5): System design · API design · distributed systems · mentoring · code review

### Marketing CV (`marketing-cv`)

Skills (5): Growth marketing · content strategy · campaign management · analytics · Marketing

### Consultant CV (`consultant-cv`)

Skills (7): SQL · Leadership · Strategy · financial modeling · stakeholder management · facilitation · operations

### Fragmented OCR sample (`yoaz-pdf-live-fragmented`)

Skills (8): Illustration · Graphic Design · Editorial Design · Packaging · Logo Design · Brand Identity · Visual Identity · Poster Design

Creative matches: Illustration, Graphic Design, Editorial Design, Packaging, Logo Design, Brand Identity

## Run

```bash
npm run qa:skill-recovery
npm run skill:recovery-report
```
