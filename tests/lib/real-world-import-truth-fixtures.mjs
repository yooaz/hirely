/**
 * Real-world import truth — messy corpus fixtures (29+ files).
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execSync } from 'child_process';
import { PDFDocument } from 'pdf-lib';
import { applyHellLayout } from './p5-cv-hell-layouts.mjs';
import {
  buildMinimalDocx,
  buildTextPdf,
  escapeXml,
  resolveFirstExisting,
} from './format-support-fixtures.mjs';

const FIXTURE_RELS = {
  yoaz: 'tests/fixtures/yoaz-cv/fixture.txt',
  creative: 'tests/fixtures/creative-cv/fixture.txt',
  twoColumn: 'tests/fixtures/two-column-cv/fixture.txt',
  developer: 'tests/fixtures/developer-cv/fixture.txt',
  marketing: 'tests/fixtures/marketing-cv/fixture.txt',
  academic: 'tests/fixtures/academic-cv/fixture.txt',
  recruiter: 'tests/fixtures/recruiter-cv/fixture.txt',
  sales: 'tests/fixtures/sales-cv/fixture.txt',
};

function readText(root, rel) {
  const fp = path.join(root, rel);
  return fs.existsSync(fp) ? fs.readFileSync(fp, 'utf8') : '';
}

function corpusText(root, key) {
  const fromCorpus = readText(root, `tests/cv-corpus/${key}.txt`);
  if (fromCorpus) return fromCorpus;
  return readText(root, FIXTURE_RELS[key] || '');
}

/** pdf-lib StandardFonts only support WinAnsi — strip designer unicode decor. */
export function sanitizePdfPlainText(text) {
  return String(text || '')
    .replace(/[═✦◆•–—]/g, (ch) => ({ '═': '=', '✦': '*', '◆': '-', '•': '-', '–': '-', '—': '-' }[ch] || '-'))
    .replace(/[^\x09\x0a\x0d\x20-\x7e\xA0-\xFF]/g, ' ');
}

/** Two-column DOCX via w:tbl */
export async function buildColumnDocx(outPath, plainText) {
  const lines = String(plainText || '').split('\n');
  const mid = Math.max(1, Math.ceil(lines.length / 2));
  const left = lines.slice(0, mid);
  const right = lines.slice(mid);
  const cell = (rows) =>
    rows
      .map(
        (line) =>
          `<w:p><w:r><w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r></w:p>`
      )
      .join('');
  const table = `<w:tbl>
<w:tblPr><w:tblW w:w="5000" w:type="pct"/></w:tblPr>
<w:tr>
<w:tc><w:tcPr><w:tcW w:w="2500" w:type="pct"/></w:tcPr>${cell(left)}</w:tc>
<w:tc><w:tcPr><w:tcW w:w="2500" w:type="pct"/></w:tcPr>${cell(right)}</w:tc>
</w:tr>
</w:tbl>`;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hirely-col-docx-'));
  const wordDir = path.join(tmp, 'word');
  fs.mkdirSync(path.join(wordDir, '_rels'), { recursive: true });
  fs.mkdirSync(path.join(tmp, '_rels'), { recursive: true });
  fs.writeFileSync(
    path.join(wordDir, 'document.xml'),
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>${table}<w:sectPr/></w:body></w:document>`
  );
  fs.writeFileSync(
    path.join(tmp, '[Content_Types].xml'),
    `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`
  );
  fs.writeFileSync(
    path.join(tmp, '_rels', '.rels'),
    `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
  );
  fs.writeFileSync(
    path.join(wordDir, '_rels', 'document.xml.rels'),
    `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`
  );
  execSync(`cd "${tmp}" && zip -qr "${outPath}" .`);
  fs.rmSync(tmp, { recursive: true, force: true });
}

export async function renderTextToPng(page, text, outPath) {
  const pngB64 = await page.evaluate((body) => {
    const canvas = document.createElement('canvas');
    canvas.width = 850;
    canvas.height = 1100;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#1a1a1a';
    ctx.font = '15px Helvetica, Arial, sans-serif';
    let y = 44;
    for (const line of String(body).split('\n')) {
      if (y > canvas.height - 28) break;
      ctx.fillText(line.slice(0, 92), 36, y);
      y += 19;
    }
    return canvas.toDataURL('image/png').split(',')[1];
  }, text);
  fs.writeFileSync(outPath, Buffer.from(pngB64, 'base64'));
}

export async function buildImageOnlyPdf(outPath, pngBytes) {
  const pdf = await PDFDocument.create();
  const png = await pdf.embedPng(pngBytes);
  const w = Math.min(png.width, 612);
  const h = (png.height / png.width) * w;
  const page = pdf.addPage([w, h]);
  page.drawImage(png, { x: 0, y: 0, width: w, height: h });
  fs.writeFileSync(outPath, await pdf.save());
}

/**
 * @typedef {object} TruthCase
 * @property {string} id
 * @property {string} category
 * @property {string} label
 * @property {string} fileName
 * @property {string} path
 */

/**
 * @param {string} root
 * @param {{ page?: import('playwright').Page }} [opts]
 */
export async function ensureRealWorldImportTruthFixtures(root, opts = {}) {
  const outDir = path.join(root, 'tests/output/real-world-import-truth');
  const corpusDir = path.join(root, 'tests/real-world-corpus');
  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(corpusDir, { recursive: true });

  const textKeys = [
    'developer',
    'designer',
    'consultant',
    'executive',
    'marketing',
    'freelancer',
    'nurse',
    'student',
    'teacher',
    'engineer',
    'yoaz',
    'creative',
    'twoColumn',
    'academic',
    'recruiter',
    'sales',
  ];
  const texts = Object.fromEntries(textKeys.map((k) => [k, corpusText(root, k)]));

  /** @type {TruthCase[]} */
  const cases = [];

  // 5 selectable PDFs
  for (const key of ['developer', 'designer', 'consultant', 'executive', 'marketing']) {
    const fileName = `selectable-${key}.pdf`;
    const fp = path.join(outDir, fileName);
    if (texts[key] && !fs.existsSync(fp)) await buildTextPdf(fp, texts[key]);
    cases.push({
      id: `pdf_sel_${key}`,
      category: 'pdf_selectable',
      label: `Selectable PDF — ${key}`,
      fileName,
      path: fp,
    });
  }

  // 5 scanned image-only PDFs
  for (const key of ['freelancer', 'nurse', 'student', 'teacher', 'yoaz']) {
    const fileName = `scanned-${key}.pdf`;
    const fp = path.join(outDir, fileName);
    const pngFp = fp.replace(/\.pdf$/, '.png');
    if (opts.page && texts[key] && !fs.existsSync(fp)) {
      await renderTextToPng(opts.page, texts[key], pngFp);
      await buildImageOnlyPdf(fp, fs.readFileSync(pngFp));
    }
    cases.push({
      id: `pdf_scan_${key}`,
      category: 'pdf_scanned',
      label: `Scanned PDF — ${key}`,
      fileName,
      path: fp,
    });
  }

  // 5 Canva / InDesign export-style PDFs
  const designExports = [
    { layout: 'canva', key: 'developer' },
    { layout: 'canva', key: 'designer' },
    { layout: 'canva', key: 'marketing' },
    { layout: 'indesign', key: 'consultant' },
    { layout: 'indesign', key: 'executive' },
  ];
  for (const { layout, key } of designExports) {
    const fileName = `${layout}-${key}.pdf`;
    const fp = path.join(outDir, fileName);
    if (!fs.existsSync(fp)) {
      const messy = sanitizePdfPlainText(
        applyHellLayout(texts[key] || texts.developer, layout)
      );
      await buildTextPdf(fp, messy);
    }
    cases.push({
      id: `pdf_${layout}_${key}`,
      category: 'pdf_design_export',
      label: `${layout} PDF — ${key}`,
      fileName,
      path: fp,
    });
  }

  // 5 DOCX with columns/tables
  for (const key of ['twoColumn', 'creative', 'developer', 'marketing', 'engineer']) {
    const fileName = `columns-${key}.docx`;
    const fp = path.join(outDir, fileName);
    if (!fs.existsSync(fp)) {
      await buildColumnDocx(fp, texts[key] || texts.developer);
    }
    cases.push({
      id: `docx_col_${key}`,
      category: 'docx_columns',
      label: `DOCX columns — ${key}`,
      fileName,
      path: fp,
    });
  }

  // 3 DOC legacy
  for (const key of ['developer', 'designer', 'yoaz']) {
    const fileName = `${key}-legacy.doc`;
    const fp = path.join(outDir, fileName);
    const srcKey = key === 'yoaz' ? 'creative' : key;
    const srcDocx = path.join(outDir, `columns-${srcKey}.docx`);
    if (!fs.existsSync(fp)) {
      if (fs.existsSync(srcDocx)) fs.copyFileSync(srcDocx, fp);
      else if (texts[key]) buildMinimalDocx(fp, texts[key]);
    }
    cases.push({
      id: `doc_${key}`,
      category: 'doc_legacy',
      label: `DOC legacy — ${key}`,
      fileName,
      path: fp,
    });
  }

  // 3 image CVs
  for (const key of ['developer', 'designer', 'consultant']) {
    const fileName = `cv-${key}.png`;
    const fp = path.join(outDir, fileName);
    if (opts.page && texts[key] && !fs.existsSync(fp)) {
      await renderTextToPng(opts.page, texts[key], fp);
    }
    cases.push({
      id: `img_${key}`,
      category: 'image_cv',
      label: `Image CV — ${key}`,
      fileName,
      path: fp,
    });
  }

  // 3 TXT
  for (const key of ['yoaz', 'developer', 'academic']) {
    const fileName = `${key}.txt`;
    const fp = path.join(outDir, fileName);
    if (texts[key] && !fs.existsSync(fp)) fs.writeFileSync(fp, texts[key]);
    cases.push({
      id: `txt_${key}`,
      category: 'txt_paste',
      label: `TXT — ${key}`,
      fileName,
      path: fp,
    });
  }

  // User-dropped files in tests/real-world-corpus/
  if (fs.existsSync(corpusDir)) {
    for (const name of fs.readdirSync(corpusDir)) {
      if (name.startsWith('.') || /^readme/i.test(name)) continue;
      const fp = path.join(corpusDir, name);
      if (!fs.statSync(fp).isFile()) continue;
      const ext = path.extname(name).toLowerCase();
      if (!['.pdf', '.docx', '.doc', '.png', '.jpg', '.jpeg', '.txt'].includes(ext)) continue;
      let category = 'user_corpus';
      if (ext === '.pdf') category = 'user_pdf';
      else if (ext === '.docx') category = 'user_docx';
      else if (ext === '.doc') category = 'user_doc';
      else if (['.png', '.jpg', '.jpeg'].includes(ext)) category = 'user_image';
      else if (ext === '.txt') category = 'user_txt';
      cases.push({
        id: `user_${name.replace(/[^a-z0-9]+/gi, '_')}`,
        category,
        label: `User corpus: ${name}`,
        fileName: name,
        path: fp,
      });
    }
  }

  const realPdf = resolveFirstExisting(root, [
    process.env.HIRELY_YOAZ_PDF,
    'tests/output/p7-final-lock/fixture.pdf',
  ]);
  if (realPdf) {
    cases.push({
      id: 'user_real_pdf',
      category: 'user_pdf',
      label: 'Real PDF (env)',
      fileName: path.basename(realPdf),
      path: realPdf,
    });
  }

  return {
    outDir,
    cases: cases.filter((c) => fs.existsSync(c.path)),
    texts,
    counts: {
      pdf_selectable: cases.filter((c) => c.category === 'pdf_selectable').length,
      pdf_scanned: cases.filter((c) => c.category === 'pdf_scanned').length,
      pdf_design_export: cases.filter((c) => c.category === 'pdf_design_export').length,
      docx_columns: cases.filter((c) => c.category === 'docx_columns').length,
      doc_legacy: cases.filter((c) => c.category === 'doc_legacy').length,
      image_cv: cases.filter((c) => c.category === 'image_cv').length,
      txt_paste: cases.filter((c) => c.category === 'txt_paste').length,
      user_corpus: cases.filter((c) => c.category.startsWith('user_')).length,
    },
  };
}
