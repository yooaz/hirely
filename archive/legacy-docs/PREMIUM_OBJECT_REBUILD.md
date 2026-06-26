# Premium object rebuild

This version simplifies the product:
- Upload is visually dominant.
- The CV document is the main object.
- Manual extraction text is hidden by default.
- CV language can be changed independently from UI language.
- Photo only appears when the user uploads one.
- Download PDF uses a cloned A4 document to avoid blank export.
- Bad OCR creates a clean fallback instead of breaking the CV.

Supported import:
- TXT
- DOCX/DOC via Mammoth CDN
- text PDF via PDF.js CDN
- scanned/image OCR via Tesseract CDN
- manual paste fallback
