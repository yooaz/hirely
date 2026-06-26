# Expert notes

Design direction:
- central editable document
- left import/review panel
- right template/options panel
- audit, LinkedIn and letter tabs
- ATS-safe and creative template families

Extraction:
- PDF.js for text PDFs
- Tesseract for image OCR / scanned fallback
- Mammoth for DOCX
- manual paste remains the robust fallback when a file is protected or OCR is poor.
