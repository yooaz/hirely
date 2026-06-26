# Column Reconstruction Report

Generated: 2026-06-06T23:27:58.318Z

## Summary

| Metric | Value |
| --- | --- |
| Acceptance | **PASS** |
| Fixtures evaluated | 5 |
| Hardcoded CV rules | **0** |

## Pipeline

```
columns → blocks → column_reconstruction → reading_order → document_blocks
```

Guards:
- Education grouped under `education`
- Experience grouped under `experience`
- Sidebar `skills` / `languages` / `tools` never merge into `experience`
- Cross-column geometric merge blocked (x-gap guard)

## Fixture overview

| Fixture | Layout | Multi-col | Blocks | Integrity |
| --- | --- | --- | --- | --- |
| Creative CV | left_sidebar | yes | 7 | PASS |
| Developer CV | left_sidebar | yes | 9 | PASS |
| Recruiter CV | left_sidebar | yes | 7 | PASS |
| Creative CV (simulated sidebar) | two_column | yes | 7 | PASS |
| Yoaz PDF (two-column sim) | two_column | yes | 9 | PASS |

## orderedBlocks schema

Each block includes:
- `section` — canonical section key
- `startPosition` / `endPosition` — reading-order range
- `confidence` — layout + line confidence score
- `column` — LEFT_COLUMN | RIGHT_COLUMN | FULL

## Details

### Creative CV

- Layout: `left_sidebar` (82%)
- Column split: 187.2
- Multi-column reconstruction: yes
- Section integrity: **PASS**

**orderedBlocks:**
- **body** [0–2] conf 94% col FULL — Yohann Azancot
- **summary** [3–4] conf 94% col FULL — Profile
- **experience** [5–9] conf 94% col FULL — Experience
- **education** [10–11] conf 94% col FULL — Education
- **skills** [12–13] conf 94% col FULL — Skills
- **tools** [14–15] conf 94% col FULL — Tools
- **languages** [16–18] conf 94% col FULL — Languages

### Developer CV

- Layout: `left_sidebar` (82%)
- Column split: 187.2
- Multi-column reconstruction: yes
- Section integrity: **PASS**

**orderedBlocks:**
- **body** [0–2] conf 94% col FULL — Alex Chen
- **summary** [3–4] conf 94% col FULL — Summary
- **experience** [5–8] conf 94% col FULL — Experience
- **header** [9–10] conf 94% col FULL — Software Engineer — Dropbox — 2015 – 2019
- **education** [11–12] conf 94% col FULL — Education
- **skills** [13–14] conf 94% col FULL — Skills
- **tools** [15–16] conf 94% col FULL — Tools
- **languages** [17–19] conf 94% col FULL — Languages
- **interests** [20–21] conf 94% col FULL — Interests

### Recruiter CV

- Layout: `left_sidebar` (82%)
- Column split: 187.2
- Multi-column reconstruction: yes
- Section integrity: **PASS**

**orderedBlocks:**
- **body** [0–2] conf 94% col FULL — David Okonkwo
- **summary** [3–4] conf 94% col FULL — Profile
- **experience** [5–10] conf 94% col FULL — Experience
- **education** [11–12] conf 94% col FULL — Education
- **skills** [13–14] conf 94% col FULL — Skills
- **tools** [15–16] conf 94% col FULL — Tools
- **languages** [17–19] conf 94% col FULL — Languages

### Creative CV (simulated sidebar)

- Layout: `two_column` (84%)
- Column split: 190
- Multi-column reconstruction: yes
- Section integrity: **PASS**

**orderedBlocks:**
- **summary** [0–1] conf 94% col LEFT_COLUMN — Profile
- **languages** [2–3] conf 94% col LEFT_COLUMN — Languages
- **experience** [4–4] conf 94% col RIGHT_COLUMN — Yohann Azancot
- **experience** [5–6] conf 94% col RIGHT_COLUMN — Experience
- **education** [7–8] conf 94% col RIGHT_COLUMN — Education
- **skills** [9–10] conf 94% col RIGHT_COLUMN — Skills
- **tools** [11–12] conf 94% col RIGHT_COLUMN — Tools

### Yoaz PDF (two-column sim)

- Layout: `two_column` (84%)
- Column split: 190
- Multi-column reconstruction: yes
- Section integrity: **PASS**

**orderedBlocks:**
- **experience** [0–0] conf 94% col LEFT_COLUMN — Yohann Azancot
- **summary** [1–2] conf 94% col LEFT_COLUMN — Profile
- **languages** [3–5] conf 94% col LEFT_COLUMN — Languages
- **experience** [6–8] conf 94% col RIGHT_COLUMN — Experience
- **education** [9–10] conf 94% col RIGHT_COLUMN — Education
- **skills** [11–12] conf 94% col RIGHT_COLUMN — Skills
- **tools** [13–14] conf 94% col RIGHT_COLUMN — Tools
- **clients** [15–16] conf 94% col RIGHT_COLUMN — Clients
- **interests** [17–18] conf 94% col RIGHT_COLUMN — Interests

