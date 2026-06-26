# Template Library V3

**Generated:** 2026-06-14
**Version:** `TEMPLATE_LIBRARY_V3`
**QA gate:** PASS

## Design principle

> Every template must differ in **hierarchy**, **typography**, **spacing**, and **structure** — not merely color or font swaps.

V3 families use `wrapV3()` with scoped CSS under `.cv.template-{id}` in `cv-templates-v3-families.css`.

## Catalog

| # | Template | ID | Layout family |
|---|----------|-----|---------------|
| 1 | Consulting Elite | `consulting-elite` | consulting-split-v3 |
| 2 | Apple Style | `apple-style` | monument-timeline-v3 |
| 3 | Google Style | `google-style` | material-rail-v3 |
| 4 | Startup Founder | `startup-founder` | founder-split-v3 |
| 5 | Creative Director | `creative-director` | portfolio-hero-v3 |
| 6 | Senior Engineer | `senior-engineer` | engineer-dense-v3 |
| 7 | Executive Board | `executive-board` | executive-centered-v3 |
| 8 | Minimal ATS | `minimal-ats` | dense-ats-v3 |
| 9 | Academic | `academic` | academic-split-v3 |
| 10 | Luxury Editorial | `luxury-editorial` | editorial-spread-v3 |

## Architecture (per template)

### Consulting Elite (`consulting-elite`)

| Dimension | Architecture |
|-----------|--------------|
| **Grid** | 3/9 asymmetric split · KPI strip · impact matrix footer |
| **Hierarchy** | Engagement thesis → Case experience → Credentials rail |
| **Typography** | Cormorant Garamond display · IBM Plex Sans body · navy ink |
| **Spacing** | 28px section rhythm · 14px matrix cells · 32px masthead |
| **Emphasis** | Quantified outcomes · MBB case credibility |
| **Layout family** | `consulting-split-v3` |
| **Section order** | summary → experience → education → skills → languages |

```
┌─ Identity / masthead
├─ summary (primary)
├─ experience
└─ education · skills
```

### Apple Style (`apple-style`)

| Dimension | Architecture |
|-----------|--------------|
| **Grid** | Centered monument · left timeline spine · 56px margins |
| **Hierarchy** | Identity monument → Career spine → Skills whisper |
| **Typography** | SF Pro–style Inter · 36pt name · -0.04em tracking · hairline rules |
| **Spacing** | Apple keynote · 44px between sections · 18px spine nodes |
| **Emphasis** | Product clarity · zero decoration · document-first |
| **Layout family** | `monument-timeline-v3` |
| **Section order** | experience → education → skills → tools → languages |

```
┌─ Identity / masthead
├─ experience (primary)
├─ education
└─ skills · tools
```

### Google Style (`google-style`)

| Dimension | Architecture |
|-----------|--------------|
| **Grid** | 4-color accent bar · 26/74 skills rail · systems column |
| **Hierarchy** | Stack rail → Shipped systems → Projects |
| **Typography** | Google Sans feel · Product Sans headings · multi-hue bar |
| **Spacing** | Material 12px tight body · 20px rail gaps |
| **Emphasis** | Stack clarity · color-coded systems · parse-friendly |
| **Layout family** | `material-rail-v3` |
| **Section order** | skills → tools → experience → projects → education |

```
┌─ Identity / masthead
├─ skills (primary)
├─ tools
└─ experience · projects
```

### Startup Founder (`startup-founder`)

| Dimension | Architecture |
|-----------|--------------|
| **Grid** | Venture hero · traction metrics · 24/76 operator split |
| **Hierarchy** | Founder thesis → Traction → Roles & impact |
| **Typography** | Inter 800 display · Linear purple · mono metrics |
| **Spacing** | Operator 14px body · 28px hero · 18px rail |
| **Emphasis** | Product velocity · venture narrative |
| **Layout family** | `founder-split-v3` |
| **Section order** | summary → experience → clients → projects → education → skills |

```
┌─ Identity / masthead
├─ summary (primary)
├─ experience
└─ clients · projects
```

### Creative Director (`creative-director`)

| Dimension | Architecture |
|-----------|--------------|
| **Grid** | Hero band · 3-col client proof · asymmetric case stack |
| **Hierarchy** | Identity hero → Clients → Projects → Career |
| **Typography** | Fraunces display · DM Sans UI · warm coral accent |
| **Spacing** | Portfolio 36px hero · 16px client grid · 24px cases |
| **Emphasis** | Brand proof · creative leadership · visual hierarchy |
| **Layout family** | `portfolio-hero-v3` |
| **Section order** | clients → projects → experience → skills → education |

```
┌─ Identity / masthead
├─ clients (primary)
├─ projects
└─ experience · skills
```

### Senior Engineer (`senior-engineer`)

| Dimension | Architecture |
|-----------|--------------|
| **Grid** | 20/80 mono rail · dense experience cards · stack blocks |
| **Hierarchy** | Engineering identity → Stack rail → Systems shipped |
| **Typography** | JetBrains Mono accents · Inter body · GitHub-style density |
| **Spacing** | Engineering 11px tight · 8px card gaps · compact rail |
| **Emphasis** | Technical depth · systems at scale · staff-level scope |
| **Layout family** | `engineer-dense-v3` |
| **Section order** | skills → tools → experience → projects → education |

```
┌─ Identity / masthead
├─ skills (primary)
├─ tools
└─ experience · projects
```

### Executive Board (`executive-board`)

| Dimension | Architecture |
|-----------|--------------|
| **Grid** | Centered board masthead · single narrative · gold rule |
| **Hierarchy** | Board identity → Executive summary → Leadership |
| **Typography** | Source Serif 4 · IBM Plex Sans · gold hairline · slate ink |
| **Spacing** | Boardroom 40px margins · 32px section gaps |
| **Emphasis** | C-suite gravitas · governance · achievement ribbon |
| **Layout family** | `executive-centered-v3` |
| **Section order** | summary → experience → education → skills → languages |

```
┌─ Identity / masthead
├─ summary (primary)
├─ experience
└─ education · skills
```

### Minimal ATS (`minimal-ats`)

| Dimension | Architecture |
|-----------|--------------|
| **Grid** | Single column · 68ch · utility contact band · date grid |
| **Hierarchy** | Experience → Education → Skills (recruiter scan) |
| **Typography** | Inter · 8pt labels · tabular nums · pure black/white |
| **Spacing** | Ultra-dense 8px rhythm · zero ornament |
| **Emphasis** | Parse density · recruiter scan · export fidelity |
| **Layout family** | `dense-ats-v3` |
| **Section order** | experience → education → skills → tools → languages → summary |

```
┌─ Identity / masthead
├─ experience (primary)
├─ education
└─ skills · tools
```

### Academic (`academic`)

| Dimension | Architecture |
|-----------|--------------|
| **Grid** | 32/68 scholarly split · education-first rail |
| **Hierarchy** | Academic identity → Credentials → Research experience |
| **Typography** | EB Garamond · Crimson Pro body · institutional serif |
| **Spacing** | Scholarly 26px margins · 20px rail · publication blocks |
| **Emphasis** | Research · teaching · publications · degrees |
| **Layout family** | `academic-split-v3` |
| **Section order** | education → experience → skills → tools → languages |

```
┌─ Identity / masthead
├─ education (primary)
├─ experience
└─ skills · tools
```

### Luxury Editorial (`luxury-editorial`)

| Dimension | Architecture |
|-----------|--------------|
| **Grid** | Magazine cover · 22/48/30 three-column spread |
| **Hierarchy** | Cover identity → Feature column → Sidebar credentials |
| **Typography** | Playfair Display · Lora body · tracked small caps |
| **Spacing** | Editorial 24px cover · 14px column gutters · float rhythm |
| **Emphasis** | Luxury editorial · culture · magazine craft |
| **Layout family** | `editorial-spread-v3` |
| **Section order** | summary → experience → clients → education → skills |

```
┌─ Identity / masthead
├─ summary (primary)
├─ experience
└─ clients · education
```

## Files

| File | Role |
|------|------|
| `src/ui/templates/template-families-v3.mjs` | Catalog, aliases, architecture specs |
| `src/ui/templates/template-library-v3.mjs` | Production re-exports |
| `src/ui/templates/cv-templates-v3-families.css` | Structural CSS per template |
| `src/ui/templates/cv-templates.js` | V3 layout functions + `wrapV3()` |
| `src/ui/templates/ten-premium-templates.mjs` | Gallery production bridge |

## Legacy alias map (V2 → V3)

| Legacy ID | V3 canonical |
|-----------|--------------|
| `mckinsey-consulting` | `consulting-elite` |
| `apple-minimal` | `apple-style` |
| `tech-engineer` | `google-style` |
| `creative-director-portfolio` | `creative-director` |
| `luxury-executive` | `executive-board` |
| `ats-recruiter` | `minimal-ats` |
| `kinfolk-editorial` | `luxury-editorial` |

## Verification

```bash
npm run qa:template-library-v3
npm run template-library-v3-report
```

**CSS bundle:** `cv-templates-v3-families.css`
