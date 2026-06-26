# two-column-cv

**Purpose:** PDF with sidebar (contact in right column, main column left).

## Add this file

- `document.pdf` — two-column layout; contact must not merge into name line.

## Expected extraction

- Method: `pdf-text`
- Name, title, email, phone on **separate lines** after PDF.js column ordering.

## CI

`fixture.txt` matches correct reading order (see extraction-test pdf column case).
