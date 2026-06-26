# Editorial Magazine Template

**Status:** PASS  
**Generated:** 2026-06-11T01:51:37.635Z  
**Template ID:** `editorial-magazine`  
**Display name:** Editorial Magazine

## Design brief

Magazine cover meets professional resume — the most beautiful template in Hirely.

Inspired by **Kinfolk**, **Wallpaper***, **Aesop**, and **Monocle**.

| Attribute | Value |
|-----------|-------|
| Cover | 54pt Cormorant display · editorial kicker · italic deck |
| Spread | 3-column grid — culture rail · feature · meta rail |
| Typography | Cormorant Garamond · Source Serif 4 · DM Sans |
| Spacing | Luxury editorial whitespace · hairline rules |
| Excluded | Chips · meta footer · photos |

## Layout

1. **Cover** — Résumé kicker · huge name · title · deck lede · contact
2. **Left rail** — Education · Languages
3. **Feature column** — Experience (display hierarchy)
4. **Right rail** — Skills · Tools · Clients · Projects · Portfolio

## Implementation

| File | Role |
|------|------|
| `src/ui/templates/cv-templates.js` | `headEditorialMagazine`, `stackEditorialMagazine`, `layoutEditorialMagazine` |
| `src/ui/templates/cv-templates-editorial-magazine.css` | Kinfolk / Monocle typography system |
| `src/ui/templates/v2/registry.js` | V2 metadata |

## QA

```bash
npm run qa:editorial-magazine-template
```

**Checks:** 39/39 passed

- [x] resolve editorial-magazine id
- [x] Editorial Magazine display name
- [x] V2 registry resolves editorial-magazine
- [x] V2 creative level 5
- [x] magazine cover
- [x] editorial kicker
- [x] huge display name
- [x] editorial deck lede
- [x] editorial spread grid
- [x] left culture rail
- [x] center feature column
- [x] right meta rail
- [x] feature section hierarchy
- [x] dedicated layout class
- [x] renders name
- [x] renders title
- [x] renders experience
- [x] renders client
- [x] renders education
- [x] renders skills
- [x] no duplicate summary section
- [x] no duplicate section titles
- [x] no cvClientChip
- [x] no cvSkillChip
- [x] no cvProgress
- [x] no cvMetaFooter
- [x] no cvPhoto
- [x] section present: skills
- [x] section present: tools
- [x] section present: clients
- [x] section present: projects
- [x] experience in feature column flow
- [x] display typography
- [x] huge cover typography
- [x] spread grid CSS
- [x] deck lede CSS
- [x] index links stylesheet
- [x] PDF export bytes (47594)
- [x] PDF page count (1)

## PDF artifact

`tests/output/editorial-magazine/editorial-magazine.pdf`
