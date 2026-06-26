# Hirely Fixed Functional Premium

Cette version reconstruit `index.html` autour de la priorité produit : extraire correctement les informations du CV, afficher un CV lisible, changer réellement de template et exporter en PDF/TXT.

## À tester

```bash
cd hirely_FINAL_CURSOR_STABLE_UI
python3 -m http.server 3037
```

Puis ouvrir :

```txt
http://localhost:3037/?test=yoaz
```

## Corrections principales

- Parser local plus robuste : nettoyage OCR, structuration name/title/contact/experience/education/skills/tools/languages/clients.
- Aucun placeholder visible dans le CV si des données existent.
- Import PDF/DOCX/TXT/Image conservé.
- Export PDF via html2pdf conservé.
- Export TXT ajouté.
- CV workspace central, lisible et séparé.
- 20 templates premium (`cv-templates.js` + `cv-templates-premium.css`) : layouts, typographie et espacement uniques par template ; données `cvData` uniquement ; sections vides masquées ; A4/PDF-safe.
- Tabs Aperçu / Audit / LinkedIn / Lettre réparées.
- UI FR/EN/NL/DE partielle.

