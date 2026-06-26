# Contact Extraction Accuracy Report

**Result:** PASS

Generated: 2026-06-11T18:52:34.835Z

## Rules enforced

- Phone normalized only from valid phone patterns
- Trailing years (20, 2011, 2020) stripped — never merged with dates
- Email kept separate from phone
- Uncertain / normalized contacts routed to reviewQueue

## Fixture matrix

| Input | Expected | Actual | Uncertain | Note |
|-------|----------|--------|-----------|------|
| `+33649434839 20` | `+33649434839` | `+33649434839` | yes | trailing partial year |
| `+33 6 49 43 48 39 2011` | `+33649434839` | `+33649434839` | yes | trailing full year |
| `+33649434839 2011-2020` | `+33649434839` | `+33649434839` | yes | year range merged |
| `06 49 43 48 39` | `+33649434839` | `+33649434839` | yes | French local format |
| `john@test.fr +33649434839 20` | `+33649434839` | `+33649434839` | yes | email on same line |
| `2011-2020` | `` | `` | yes | date only — reject |

## QA harness

```
OK strip trailing year 20 — got +33649434839
OK polluted flagged uncertain
OK strip year range tail — got +33649434839
OK reject bare year range as phone
OK email stays separate
OK detectContactInfo clean phone — got +33649434839
OK detectContactInfo keeps email
OK finalResume phone clean
OK uncertain phone → reviewQueue — review count 1
OK normalizePhone helper

CONTACT_PHONE_ACCURACY_PASS

(node:23520) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/src/core/parsing/phone-normalize.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
```

## Acceptance

- Example polluted phone `+33649434839 20` → `+33649434839`
- validatePhoneStrict polluted: reject OK
- phoneHasYearOrDatePollution: true
