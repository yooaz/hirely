/**
 * Build isolated HTML page for recruiter scan measurement.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { A4_WIDTH_PX } from '../../core/export/pdf-export-config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../../..');

const SCAN_CSS_PATHS = [
  'src/ui/templates/cv-design-tokens.css',
  'src/ui/templates/cv-templates-professional.css',
  'src/ui/templates/cv-templates-v2-families.css',
  'src/ui/templates/cv-templates-v3-families.css',
  'src/ui/templates/cv-templates-showcase-v8.css',
  'src/ui/export/cv-a4-pages.css',
  'src/ui/templates/cv-template-density.css',
];

/**
 * @param {string} innerHtml
 * @param {string} templateId
 */
export function buildRecruiterScanHtml(innerHtml, templateId) {
  const css = SCAN_CSS_PATHS.map((p) => {
    const full = path.join(root, p);
    return fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : '';
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"/>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=DM+Sans:wght@400;500;600;700&family=EB+Garamond:wght@400;600&family=Fraunces:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600;700&family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;600&family=Lora:wght@400;500&family=Playfair+Display:wght@400;500;600&family=Roboto:wght@400;500&family=Source+Serif+4:wght@400;600&display=swap" rel="stylesheet">
<style>${css}</style>
<style>
html,body{margin:0;padding:0;background:#f4f4f5}
body{padding:24px 0}
.cv{width:${A4_WIDTH_PX}px;max-width:${A4_WIDTH_PX}px;margin:0 auto;background:#fff;box-shadow:0 8px 32px rgba(0,0,0,.08)}
</style>
</head><body>
<div class="cv cv-page template-${templateId} spacing-normal cv--live">${innerHtml}</div>
</body></html>`;
}
