# Cursor Continuation Prompt — Hirely Final Stable UI

This project is part of YALABS Studio OS.

Do not restart from zero. Preserve the current working UI: clean Apple/Linear layout, left upload card, right scoring card, bottom CV workspace, compact tabs, editable CV preview.

## Mission
Stabilize and polish Hirely into a publishable product.

## Priority fixes
1. Verify import for PDF/DOCX/TXT/image.
2. Keep raw OCR hidden; show only AI-cleaned extraction.
3. Ensure Generate Pro CV never fails: use API if available, fallback if not.
4. Improve PDF export from `#cvPreview` only.
5. Keep mobile layout usable.
6. Keep Stripe link: https://buy.stripe.com/5kQcMYeRabdn1UAcgw8IU01

## Do not
- redesign from scratch
- remove working features
- break paywall
- expose API keys in frontend
- create isolated workflow outside YOAZ_STUDIO_OS
