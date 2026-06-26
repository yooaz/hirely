# Hirely extraction note

Extraction now supports:
- TXT
- DOCX / DOC through Mammoth CDN
- text-based PDF through PDF.js CDN
- scanned PDF fallback OCR on the first 2 pages through Tesseract CDN
- PNG / JPG / WEBP OCR

If a browser blocks CDN scripts or the PDF is protected/very scanned, paste the CV text manually in the textarea and click "Analyze + generate". The app will still generate the editable CV and score.
