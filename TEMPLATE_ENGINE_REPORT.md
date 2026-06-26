# TEMPLATE_ENGINE_REPORT

**Status:** FAIL
**Generated:** 2026-06-15T10:57:35.806Z

## Summary counts

| Metric | Count |
|--------|------:|
| Duplicate template registrations | **2** |
| Duplicate display names | **3** |
| Duplicate alias keys (source overwritten) | **11** |
| Invalid templates (render/shell) | **0** |
| Broken thumbnails | **0** |
| Invalid preview data cases | **0** |
| Unused templates (not in gallery surface) | **26** |

## Architecture

| Layer | Source | Role |
|-------|--------|------|
| Registry | `src/ui/templates/cv-templates.js` | `CV_TEMPLATES`, `ALIASES`, `resolve()`, `render()` |
| Loader | `index.html` → `initHirelyTemplates()` | Boot-time registry; import stub before core |
| Catalog | `production-template-ids.mjs` / `template-families-v3.mjs` | 10 production IDs + legacy alias names |
| Selection | `renderTemplates()` in `index.html` | Gallery filters `FEATURED_TEMPLATE_IDS` |
| Preview | `render()` + `renderMini()` | Full CV + gallery thumbnail HTML |

**Registry size:** 40 registrations · 38 unique IDs
**Production gallery:** 10 featured + free `ats` + gallery substitute `ats-recruiter`
**listProduction() length:** 11 (includes duplicate `creative-director`)

## Duplicate registrations

- `creative-director` — first **Creative Director** (index 5), duplicate **Creative Portfolio** (index 37); `resolve()` → **Creative Director**
- `art-director` — first **Art Director Portfolio** (index 18), duplicate **Art Director** (index 38); `resolve()` → **Creative Director**

## Duplicate display names

- **ATS Clean** — `ats`, `ats-elite`
- **Art Director Portfolio** — `art-director`, `art-director-portfolio`
- **Creative Portfolio** — `creative-portfolio`, `creative-director`

## Duplicate alias keys (last wins in object literal)

- `kinfolk-editorial`
- `creative-director-portfolio`
- `tech-engineer`
- `art-director`
- `luxury-executive`
- `mckinsey-consulting`
- `ats-recruiter`
- `ats-elite`
- `classic-corporate`
- `apple-minimal`
- `startup-founder`

## Missing templates

_None — all production / featured IDs are registered._



## Invalid templates

_All registrations render a valid CV shell with sample data._

## Broken thumbnails

_All `renderMini()` outputs include `tplMiniWrap` with content._

## Invalid preview data

_No template fabricates large output from fully empty CV input._

## Unused templates

Templates registered in `CV_TEMPLATES` but not shown in the product gallery surface (`ats`, `ats-recruiter`, or featured 10): **26**

- `mckinsey-consulting` — Consulting Elite
- `apple-minimal` — Apple Style
- `kinfolk-editorial` — Luxury Editorial
- `creative-director-portfolio` — Creative Director
- `luxury-executive` — Executive Board
- `tech-engineer` — Google Style
- `art-director` — Creative Director
- `classic-corporate` — Executive Board
- `ats-elite` — Minimal ATS
- `ats-executive` — 01 Executive
- `executive-luxury` — 01 Executive
- `swiss-editorial` — 06 Corporate
- `creative-portfolio` — Creative Director
- `portfolio-artist` — Creative Director
- `behance-showcase` — Behance Showcase
- `editorial-magazine` — 03 Creative
- `magazine-editorial` — Luxury Editorial
- `luxury-minimal` — Apple Style
- `tech-structured` — Google Style
- `startup-builder` — Startup Founder
- `art-director-portfolio` — Creative Director
- `luxury-fashion` — Luxury Fashion
- `agency-designer` — 02 Consulting
- `minimal-swiss` — Apple Style
- `visual-timeline` — Apple Style
- `illustrator-portfolio` — Creative Director

## Selection / resolve notes

- `creative-director` (**Creative Portfolio**) — shadowed by earlier CV_TEMPLATES entry; resolve() uses first match
- `art-director` (**Art Director**) — shadowed by earlier CV_TEMPLATES entry; resolve() uses first match

### Featured vs registry

| Featured ID | Registry | Display name |
|-------------|----------|--------------|
| `consulting-elite` | ✓ | Consulting Elite |
| `apple-style` | ✓ | Apple Style |
| `google-style` | ✓ | Google Style |
| `startup-founder` | ✓ | Startup Founder |
| `creative-director` | ✓ | Creative Director |
| `senior-engineer` | ✓ | Senior Engineer |
| `executive-board` | ✓ | Executive Board |
| `minimal-ats` | ✓ | Minimal ATS |
| `academic` | ✓ | Academic |
| `luxury-editorial` | ✓ | Luxury Editorial |

## Browser loader check

| Check | Value |
|-------|-------|
| Stub-only registry | false |
| Registry count | 40 (38 unique) |
| Duplicate IDs in live list | creative-director, art-director |
| TEMPLATE_REGISTRY_READY | true |
| render / renderMini | true / true |
| Featured missing in registry | none |
| Gallery cards on boot | 0 (picker visible: false) |
| Broken gallery thumbnails | 0 |



## Findings

1. **Duplicate registrations** — `creative-director` and `art-director` each appear twice in `CV_TEMPLATES`; `Array.find` keeps the first entry, so later layouts are dead code.
2. **Duplicate names** — `ATS Clean`, `Art Director Portfolio`, and `Creative Portfolio` each label multiple IDs; risks gallery confusion.
3. **Alias collisions** — 11 alias keys are declared twice in `ALIASES`; silent last-wins overrides (e.g. `art-director` → `creative-director`).
4. **Unused legacy templates** — 26 unique IDs remain registered for backwards compatibility but are not in the 10-template gallery.
5. **listProduction()** — returns 11 entries because duplicate `creative-director` passes `filter()` twice.

## Re-run

```bash
npm run qa:template-engine
```
