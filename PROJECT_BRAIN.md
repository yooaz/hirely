# HIRELY — PROJECT_BRAIN.md
Part of: YOAZ_STUDIO_OS

## 0. CANONICAL PROJECT (LOCK)

**Canonical active Hirely project:** `hirely_FINAL_CURSOR_STABLE_UI`  
**Absolute path:** `/Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI`

All product work, QA, and deploys use this folder only.

**Do not develop in:** `HIRELY_V27_IMPORT_FIX (1)` — reference-only archive. Do not merge or delete V27 from this repo; ignore it for active edits.

## 1. PROJECT IDENTITY
Hirely is an AI career optimizer, not a generic CV builder. It helps users improve their professional presentation, recruiter perception, ATS compatibility and job application quality.

Vision: help people get better interviews and better jobs.
Mission: upload a CV, clean the extraction, score it like a recruiter, generate a beautiful editable CV, LinkedIn profile and cover letter.
Audience: job seekers, creatives, freelancers, designers, marketers, product/tech profiles, career changers.
Emotional direction: confidence, clarity, premium, intelligent, fast.
Positioning: AI recruiter + ATS optimizer + premium editable CV designer.
Never become: generic SaaS dashboard, Canva clone, cheap AI text generator, lifeless form app.

## 2. PRODUCT DNA
Core interactions:
- upload/import CV
- review AI-cleaned extraction
- score auto
- generate Pro CV
- edit live in template
- export beautiful PDF
- unlock Pro via Stripe

Signature UX:
- clean Apple/Linear-like interface
- left input, right scoring, bottom CV workspace
- compact tabs: Pro CV / Audit / LinkedIn / Letter
- live editable CV preview

## 3. VALIDATED ELEMENTS
Preserve:
- white/cream premium background
- dark recruiter scoring panel
- score ring + gradient bars
- editable CV preview
- template selector
- Pro CV tabs
- PDF/TXT export
- Stripe Pro pricing
- image/PDF/DOCX/TXT import

## 4. REJECTED DIRECTIONS
Avoid:
- random redesigns
- dark-only app
- huge dashboards
- flat generic SaaS UI
- noisy Canva-style templates
- empty generation failures
- raw OCR garbage as final output

## 5. DESIGN SYSTEM
Colors: cream/white base, deep black, subtle blue-purple gradient, green success.
Typography: heavy hero, clean system UI, strong section hierarchy.
Spacing: generous, editorial, breathable.
Shadows: soft premium depth.
Border radius: 14–28px.
Motion: subtle score animation, smooth template changes, no gimmicks.

## 6. UX RULES
- Never dead-end the user.
- If AI fails, generate a safe local professional draft.
- Raw OCR should be cleaned before display.
- User must always be able to edit the final CV.
- Mobile must keep one clear action per screen.
- Pro lock must be clear, not confusing.

## 7. APP STRUCTURE
Frontend: single-page static app in index.html.
Backend: Vercel serverless function /api/analyze.js.
Deployment: Vercel.
Payment: Stripe Payment Link.
Data: no persistent DB yet.
AI: Gemini via server-side environment variable only.

## 8. AI ENGINE
AI tasks:
- OCR cleanup
- recruiter scoring
- ATS scoring
- CV rewrite
- LinkedIn headline/about
- cover letter
- job-tailored improvements

Fallback:
- local expert CV generator must run if Gemini/API fails.

## 9. BUSINESS MODEL
Free:
- upload/import
- cleaned text
- score
- audit

Pro 9€:
- rewritten CV
- templates
- PDF/TXT export
- LinkedIn
- cover letter

## 10. CURRENT STATE
Functional:
- upload PDF/DOCX/TXT/image
- OCR via browser
- score
- Pro CV generation
- editable template
- PDF export
- Stripe link

Weaknesses:
- OCR still imperfect for scanned CVs
- payment is Payment Link, not server-verified webhook
- no auth/dashboard/history yet
- needs real user testing

## 11. PROBLEMS & SOLUTIONS
Problem: generation failed.
Cause: API/network/Gemini JSON failure.
Solution: API always returns JSON + frontend local fallback.

Problem: OCR messy.
Cause: scanned CV/layout columns.
Solution: clean extraction and require editable review.

Problem: PDF blank/ugly.
Cause: wrong export target.
Solution: export only #cvPreview with A4 settings.

Problem: user confusion around Pro.
Cause: unclear lock.
Solution: Free/Pro boundaries visible.

## 12. VERSION MEMORY
Validated current style:
- Apple/Linear clean layout
- dark scoring card
- bottom CV workspace
- editable CV
- compact templates/tabs

Rejected:
- broken Vite/Vercel launches from wrong folder
- over-complex versions
- UI where CV generated empty
- raw OCR visible as final CV

## 13. VISUAL REFERENCES
Apple, Linear, Notion, Framer, Arc Browser, editorial CV layouts, premium portfolio typography.

## 14. USER FEELING
User should feel:
- “my CV is understood”
- “this looks professional”
- “I can edit everything”
- “I can send this without shame”
- “this tool improves my chances”

## 15. FORBIDDEN DIRECTIONS
- generic SaaS
- cheap gradients
- fake metrics
- unreadable creative CV
- hiding essential text behind icons
- deleting working mechanics
- restarting from zero

## 16. ROADMAP
Phase 1: stable publishable MVP.
Phase 2: Tailor to Job Description.
Phase 3: Human recruiter scoring.
Phase 4: Stripe webhook/auth/dashboard/history.
Phase 5: analytics, viral sharing, ATS benchmarking.

## 17. DEPLOYMENT & PREVIEW
Deploy from YOAZ_STUDIO_OS/03_HIRELY/hirely-os.
No deploy without preview/test.
No production modification without approval.
Use Vercel.
Keep .env.local out of ZIP/Git.
Gemini key only in Vercel env.

## 18. STUDIO BRAIN COMPATIBILITY
Must stay inside YOAZ_STUDIO_OS.
Must use shared memory, preview, deployment and decision systems.
No isolated workflows.
