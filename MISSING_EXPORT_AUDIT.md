# MISSING EXPORT AUDIT — src/core

Generated: 2026-06-25T21:00:55.418Z
Scope: all named imports in `src/core/**/*.js`

## Verdict

**PASS** — 0 missing named export(s)

## Summary

| Metric | Count |
|--------|------:|
| Core files scanned | 398 |
| Named imports checked | 3426 |
| External imports skipped | 5 |
| Missing / unresolved | 0 |

## Missing named exports

_None — every resolvable named import in src/core matches an export in its target module._

## Skipped (external modules)

5 named import(s) from npm/bare specifiers were not statically verified.

- `url` — 5 import(s)

## Method

- Parse `import { ... } from "..."` in every `src/core/**/*.js` file
- Resolve relative targets to `.js` / `index.js`
- Collect exports: direct declarations, `export { }`, `export * from`, re-exports
- Flag any named import with no matching export
