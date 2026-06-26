# Hirely — canonical build

**Canonical project:** `/Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI`  
This is the only active Hirely codebase in YOAZ_STUDIO_OS.

**Do not edit** `HIRELY_V27_IMPORT_FIX (1)`. That folder is **reference only** (no merges, no active development).

**Live source only:**

- `index.html` — app UI, extraction, scoring
- `src/ui/templates/cv-templates.js` — **8** production CV templates (see `production-template-ids.mjs`)
- `src/ui/templates/cv-templates-premium.css` — template styles

Do **not** use `public/lib/*`, `api/analyze.js`, or other legacy stacks for this product.

## Run locally

```bash
npm run dev
```

Open **http://127.0.0.1:3000/**

Pro on localhost only: `http://127.0.0.1:3000/?test=yoaz`

### Email CV export (Resend, Vercel only)

Pro users can use **Recevoir par email** on the export step. The browser builds the same PDF as download, then `POST /api/send-cv-email` sends it via [Resend](https://resend.com) (API key stays server-side).

On Vercel, set:

- `RESEND_API_KEY` — from [resend.com/api-keys](https://resend.com/api-keys)
- `RESEND_FROM` (optional) — verified sender, e.g. `Hirely <cv@yourdomain.com>`. Without a verified domain, Resend sandbox only delivers to your account email.

`npm run dev` (static server) does not run `/api/*`; use `vercel dev` or deploy to test email send.

## QA

```bash
npm run qa:smoke
```

See `CANONICAL_SOURCE.md` for details.
