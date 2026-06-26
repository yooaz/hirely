# Hirely Typography System

**Generated:** 2026-06-14
**Version:** `TYPOGRAPHY_SYSTEM_V1`
**QA gate:** PASS

## Goal

Move Hirely typography from average utility styling toward **Apple**, **Financial Times**, **Airbnb**, and **Stripe** quality — through deliberate pairings, line height, spacing, weight hierarchy, and paragraph rhythm.

## Reference mapping

| Brand | What we borrow | Hirely stack |
|-------|----------------|--------------|
| **Apple** | Tight display tracking, light body option, SF-grade sans | `--typo-preset-apple-*` → Inter + SF system stack |
| **Financial Times** | Serif masthead, editorial body, wide kicker tracking | `--typo-preset-ft-*` → Cormorant + Source Serif 4 |
| **Airbnb** | Warm humanist sans, comfortable paragraph rhythm | `--typo-preset-airbnb-*` → DM Sans |
| **Stripe** | Precise UI sans, mono metadata, tabular dates | `--typo-preset-stripe-*` → Inter + JetBrains Mono |

## Architecture

| Layer | Path | Role |
|-------|------|------|
| Foundation | `src/ui/typography-system.css` | Font stacks, leading, tracking, weight, rhythm tokens |
| Product UI | `src/ui/design-system-v3.css` | Maps ds3 scale → typo tokens |
| CV tokens | `src/ui/templates/cv-design-tokens.css` | Serif display + sans body defaults |
| CV density | `src/ui/templates/cv-template-density.css` | Section/block gaps + experience weights |
| V3 templates | `src/ui/templates/cv-templates-v3-families.css` | Per-template preset bindings |
| Professional base | `src/ui/templates/cv-templates-professional.css` | Shared hierarchy + paragraph rhythm |

## Font pairings

### Product chrome

| Role | Stack |
|------|-------|
| UI body | `Inter, SF Pro Text, system-ui` |
| Display headings | `Inter, SF Pro Display, system-ui` |
| Editorial accent | `Source Serif 4, Georgia` |

### CV templates (presets)

| Preset | Display | Body | Best templates |
|--------|---------|------|----------------|
| Apple | Inter / SF Display | Inter / SF Text | Apple Style |
| FT Editorial | Cormorant Garamond | Source Serif 4 | Consulting Elite, Executive Board |
| Airbnb Warm | DM Sans | DM Sans | Creative Director, Luxury Editorial, Startup Founder |
| Stripe Precision | Inter | Inter + JetBrains Mono | Senior Engineer, Minimal ATS |
| Academic | EB Garamond | Crimson Pro | Academic |

## Line height scale

| Token | Value | Use |
|-------|-------|-----|
| `--typo-leading-display` | 1.08 | Masthead / name |
| `--typo-leading-tight` | 1.22 | Section titles, roles |
| `--typo-leading-snug` | 1.38 | Subtitles, company lines |
| `--typo-leading-body` | 1.58 | Body, bullets, skills |
| `--typo-leading-relaxed` | 1.65 | Summary / deck paragraphs |
| `--typo-leading-loose` | 1.72 | Long-form editorial |
| `--typo-leading-ats` | 1.36 | Dense ATS layouts |

## Weight hierarchy

| Token | Weight | Use |
|-------|--------|-----|
| `--typo-weight-light` | 300 | Apple-style body |
| `--typo-weight-regular` | 400 | Default body, dates |
| `--typo-weight-medium` | 500 | Company, meta |
| `--typo-weight-semibold` | 600 | Roles, section kickers, UI headings |
| `--typo-weight-bold` | 700 | Primary sections, ATS names |
| `--typo-weight-heavy` | 800 | Founder / hero emphasis |

## Tracking

| Token | Value | Use |
|-------|-------|-----|
| `--typo-tracking-display` | −0.04em | Large names (Apple) |
| `--typo-tracking-title` | −0.03em | UI h2 |
| `--typo-tracking-subtitle` | −0.02em | Roles, h3 |
| `--typo-tracking-body` | −0.011em | UI body |
| `--typo-tracking-kicker` | 0.12em | Section labels (FT) |
| `--typo-tracking-masthead` | 0.18em | Board / luxury kickers |

## Spacing & paragraph rhythm

| Token | Value | Use |
|-------|-------|-----|
| `--typo-paragraph-gap` | 0.62em | UI paragraph spacing |
| `--typo-bullet-gap` | 0.48em | CV bullet stacking |
| `--typo-cv-section-gap` | 18px | Filled CV sections |
| `--typo-cv-block-gap` | 10px | Section internals |
| `--typo-cv-tight-gap` | 6px | Sparse / ATS density |

Paragraph rules applied globally on V3 CVs:

- Summary (`cvLead`) uses **relaxed** leading (1.65) with max-width 48em
- Experience bullets stack with `--typo-bullet-gap`
- Dates use **tabular numerals** for Stripe-grade alignment

## CV type scale (pt)

| Token | Size | Role |
|-------|------|------|
| `--typo-cv-name-lg` | 36pt | Apple monument name |
| `--typo-cv-masthead` | 28pt | Default masthead |
| `--typo-cv-name-md` | 24pt | Consulting / board |
| `--typo-cv-deck` | 11pt | Title / thesis |
| `--typo-cv-body` | 10pt | Body default |
| `--typo-cv-section` | 8pt | Section kicker |
| `--typo-cv-meta` | 8.5pt | Contact band |
| `--typo-cv-micro` | 7.5pt | ATS dates / rail |

## Before → After

| Dimension | Before | After |
|-----------|--------|-------|
| Display/body pairing | Inter-only everywhere | Named presets per brand reference |
| Body leading | 1.48–1.55 scattered | 1.58 unified body rhythm |
| UI weight | Magic `650` | Named `--ds3-weight-semibold` (600) |
| Section kickers | 0.14em ad-hoc | `--typo-tracking-kicker` 0.12em |
| Font loading | 6 families missing | Fraunces, Roboto, EB Garamond, Crimson Pro, Lora added |
| Paragraph rhythm | Flat margins | Bullet gap + paragraph gap tokens |

## Verification

```bash
npm run qa:typography-system
npm run typography-system-report
```

