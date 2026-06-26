# Document Experience V1

**Generated:** 2026-06-14
**Engine:** `DOCUMENT_EXPERIENCE_V1`
**QA gate:** PASS

## Mission

Shift Hirely from **form/dashboard SaaS** to **premium document creation** — like **Apple Keynote**, **Apple Pages**, **Pitch**, and **Linear**.

The CV is the product. Chrome floats. The canvas is always center stage.

## Design principles

| Principle | Before (form SaaS) | After (document V1) |
|-----------|-------------------|---------------------|
| Layout | Split panels + step headers | Full-bleed document canvas |
| Navigation | Sticky bordered step bar | Floating glass toolbar (center top) |
| Import | Full-width form column | Compact floating card (top-left) |
| Review | Side dashboard rail | Floating inspector (top-right) |
| Export | Inline footer bar | Floating dock (bottom center) |
| Preview | Step-gated, ~72vh | **Always visible** when ready + up to **100vh** canvas |
| Motion | Instant swaps | Keynote-style fade/scale on CV updates |
| Tone | “Complete these fields” | “You are editing a document” |

## Load order

```
studio-layout.css
hirely-premium-polish.css
hirely-ui-scale.css
design-system-v3.css
document-experience-v1.css   ← wins (this layer)
```

**File:** `src/ui/document-experience-v1.css`

## Activation

`html.dex-document` is toggled when the workspace is ready (`renderProgressNav`).

CV preview shows on **all ready steps** including import (`syncResumeStudioChrome`).

## Tokens

| Token | Role |
|-------|------|
| `--dex-canvas` | Full-page document stage |
| `--dex-float-bg` | Frosted floating panels |
| `--dex-float-shadow` | Premium elevation on floats |
| `--dex-ease` | Keynote-style easing |
| `--dex-inspector-width` | Review rail (300px) |
| `--dex-import-float-width` | Import card (272px) |

## Floating controls

### Step toolbar
- Fixed center-top glass pill
- Progress track hidden — step icons only

### Import card
- Fixed top-left when on Import step
- Fades out on Edit / Style / Export (document mode)

### Review inspector
- Fixed top-right on Edit step
- Canvas gains right padding so A4 sheet never sits under the panel

### Template strip
- Sticky glass bar above canvas on Style step

### Export dock
- Fixed bottom-center on Style + Export
- Canvas bottom padding prevents overlap

## Live updates

- Existing `cvDocWrap--fade` / `cvDocWrap--in` / `cvDocWrap--keynoteIn|Out` transitions enhanced
- `#cvDoc.cv--live` shadow/opacity transition on each render
- Template gallery `scroll-behavior: smooth`

## Hidden chrome (editorial focus)

- `resumeStudioHead`, `styleStepHead`, `exportStepHead`
- `extractionQualityStep`, `cvProductHead` tabs
- Import subcopy, status rows, secondary actions when ready

## Responsive

| Breakpoint | Behavior |
|------------|----------|
| ≤900px | Inspector + import dock to bottom sheets |
| ≤640px | Step labels hidden — icon toolbar only |

## References

- **Apple Keynote** — floating toolbar, canvas-first, keynote slide transitions
- **Apple Pages** — document canvas, minimal chrome, live layout
- **Pitch** — presentation canvas + floating side notes
- **Linear** — compact glass controls, content-first density

## QA

```bash
npm run qa:document-experience-v1
npm run document-experience-v1-report
```
