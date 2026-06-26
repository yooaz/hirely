# Design System V3

**Generated:** 2026-06-14
**Engine:** `DESIGN_SYSTEM_V3`
**QA gate:** PASS

## Mission

Move Hirely product chrome from startup MVP toward **Apple · Linear · Arc Browser · Notion** — calm, typographic, borderless surfaces with a dominant CV canvas.

## Design principles

| Principle | V2 (MVP) | V3 (Premium) |
|-----------|----------|--------------|
| Borders | 1px everywhere | Hairline inset or none — elevation via shadow |
| Color | Blue/green/amber score rings | Monochrome ink scale |
| Hierarchy | Similar weights | Display → title → body → micro labels |
| Spacing | Tight panels | 4px grid, generous canvas breathing room |
| Controls | 10–12px buttons | 11–12px caption controls, ink primary CTA |
| Preview | ~62vh stage | **72vh** stage + container scale up to **1.22×** |
| Side rails | 168–220px | **132–196px** — preview wins |

## Load order

```
studio-layout.css
hirely-premium-polish.css
hirely-ui-scale.css
design-system-v3.css   ← wins (this system)
```

**File:** `src/ui/design-system-v3.css`

## Color system (fewer colors)

| Token | Value | Role |
|-------|-------|------|
| `--ds3-bg` | #f3f3f1 | App shell |
| `--ds3-surface` | #ffffff | Cards, panels |
| `--ds3-surface-sunken` | #ececea | Inset wells, progress hint |
| `--ds3-canvas` | #e4e4e0 | CV preview stage (Arc-style) |
| `--ds3-ink` | #111110 | Primary text + accent CTA |
| `--ds3-ink-secondary` | #3a3a38 | Secondary copy |
| `--ds3-ink-tertiary` | #868682 | Labels, hints |
| `--ds3-accent-soft` | rgba(17, 17, 16, 0.06) | Hover washes |

Semantic greens/ambers/roses in chrome are **remapped to ink** — color reserved for CV template content only.

## Typography (more hierarchy)

| Role | Token | Size | Weight | Tracking |
|------|-------|------|--------|----------|
| Display | `--ds3-text-display` | 2.5rem | 650 | -0.035em |
| Title 1 | `--ds3-text-title1` | 1.75rem | 650 | -0.03em |
| Title 2 | `--ds3-text-title2` | 1.375rem | 650 | -0.03em |
| Title 3 | `--ds3-text-title3` | 1.0625rem | 600 | -0.02em |
| Body | `--ds3-text-body` | 0.875rem | 400 | -0.012em |
| Caption | `--ds3-text-caption` | 0.75rem | 500–600 | — |
| Micro label | `--ds3-text-micro` | 0.6875rem | 600 | +0.04em (uppercase) |

**Font stack:** Inter + SF Pro system fallbacks with `font-feature-settings: cv02, cv03, cv04, cv11`.

## Spacing (better rhythm)

| Token | Value |
|-------|-------|
| `--ds3-space-1` | 4px |
| `--ds3-space-2` | 8px |
| `--ds3-space-3` | 12px |
| `--ds3-space-4` | 16px |
| `--ds3-space-5` | 20px |
| `--ds3-space-6` | 24px |
| `--ds3-space-8` | 32px |
| `--ds3-space-10` | 40px |
| `--ds3-space-12` | 48px |

## Shadows (premium elevation)

| Token | Use |
|-------|-----|
| `--ds3-shadow-xs` | Top bar, active step pill |
| `--ds3-shadow-sm` | Panels, cards, drop hover |
| `--ds3-shadow-md` | Export bar, pricing pro |
| `--ds3-shadow-lg` | Hero export step emphasis |
| `--ds3-shadow-cv` | A4 sheet on canvas (layered Apple-style) |

Panels use **shadow-only** surfaces — `border: 0` with optional `inset 0 0 0 1px` hairline for nested items.

## Layout

| Token | Value | Notes |
|-------|-------|-------|
| `--ds3-max` | 1520px | App max width |
| `--ds3-rail-width` | 132px | Insight rail (narrower) |
| `--ds3-import-max` | 196px | Import split column |

### Workspace grid

- **Ready state:** `1fr + rail` — center column absorbs all free space
- **CV stage:** `min(72vh, 920px)` with sunken `--ds3-canvas` background
- **Preview scale:** `@container cv-canvas` — up to **1.22×** on wide viewports

## Components

### Top bar
- 44px height, frosted glass (`backdrop-filter: blur(20px)`), no border
- Smaller logo (24px), caption-weight nav

### Buttons
- Default: 6×11px pad, 12px type, hairline inset ring
- Primary: ink fill, white label, subtle lift on hover
- Small: 4×8px, 11px micro type

### Progress nav
- 2px track, ink fill
- Step pills: shadow when active, no borders
- Icons: 20px monochrome circles

### Import drop
- Dashed hairline at rest → solid + shadow on drag
- Title at title-3 weight, tertiary hint copy

### Review / ATS chrome
- Score rings: monochrome tiers (quaternary → ink)
- Suggestion cards: inset hairline, no colored borders

### Template gallery
- Filter chips: pill + hairline inset
- Active card: 2px ink ring + sm shadow

## Legacy compatibility

V3 remaps existing `--bg`, `--paper`, `--ink`, `--line`, `--shadow-*`, `--hirely-*` tokens so inline `index.html` styles and older CSS layers degrade gracefully.

## Before → After

| Surface | Before | After |
|---------|--------|-------|
| `.panel` | 1px border + flat white | Borderless + `--ds3-shadow-sm` |
| `.top` | Bordered header bar | Glass, 44px, shadow-xs |
| `.cvStage` | White pad, 62vh | Canvas `#e4e4e0`, 72vh |
| `.btn` | 10px pad, blue primary | 6px pad, ink primary |
| Score rings | Green/amber/rose | Ink monochrome |
| Side rail | 168px | 132px |

## QA

```bash
npm run qa:design-system-v3
npm run design-system-v3-report
```

Checks: file presence, load order, token coverage, borderless rules, preview scaling, doc presence.

## References

- Apple Human Interface Guidelines — materials, typography scale, layered shadows
- Linear — compact controls, monochrome chrome, inset rings
- Arc Browser — sunken content canvas, calm neutrals
- Notion — uppercase micro labels, pill navigation, generous whitespace
