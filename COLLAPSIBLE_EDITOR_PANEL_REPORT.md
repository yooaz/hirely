# Collapsible Editor Panel Report

**Status:** PASS
**Date:** 2026-06-11

## Goal

Photo + section order live in a collapsible drawer so the A4 CV preview stays primary.

## UI

| Element | Implementation |
|---------|----------------|
| Toggle button | `#proCvLayoutToggle` — « Modifier la mise en page » |
| Drawer (closed by default) | `#proCvEditDrawer[hidden]` |
| Photo upload | `#proCvPhotoBtn` — « Ajouter une photo » |
| Photo on template | `#proCvPhotoTemplateToggle` — « Afficher photo sur ce modèle » |
| Section order | `#proCvSectionOrder` drag list |
| Reset order | `#proCvSectionOrderReset` — « Reset ordre » |

## Browser check (1440×900, ?pro=true)

| Metric | Value |
|--------|-------|
| Tools visible | yes |
| Drawer closed (default) | yes |
| Closed tools height | 35px |
| CV stage height | 1203px |
| Section order items | 9 |

## Acceptance

CV preview remains primary. Editor tools are available via the drawer without dominating the layout.

## Run

```bash
npm run collapsible-editor-panel-report
```
