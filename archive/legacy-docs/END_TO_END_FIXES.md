# End-to-end fixes

Fixed:
- Generic hero title.
- Text quality detection to prevent broken OCR from being injected into templates.
- Safer parser: bad OCR now creates a clean fallback instead of garbage CV sections.
- CV layout no longer cuts the header/name.
- PDF export clones the document without CSS transform to avoid blank downloads.
- Better A4 sizing and typography.
- Manual paste remains the reliable fallback for protected/scanned CVs.

How to test:
1. Open index.html.
2. Click Example → Generate Pro CV.
3. Switch templates.
4. Open Audit / LinkedIn / Letter.
5. Download PDF.
6. Upload TXT/DOCX/text-PDF. If OCR is bad, paste clean text manually.
