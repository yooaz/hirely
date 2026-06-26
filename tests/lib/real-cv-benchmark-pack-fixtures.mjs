/**
 * Real CV benchmark pack — messy fixture generation (cv-corpus + layout hell).
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execSync } from 'child_process';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { applyHellLayout } from './p5-cv-hell-layouts.mjs';
import {
  BENCHMARK_ALL_SLOTS,
  BENCHMARK_DOCX_SLOTS,
  BENCHMARK_IMAGE_SLOTS,
  BENCHMARK_PDF_SLOTS,
} from './real-cv-benchmark-pack-catalog.mjs';
import {
  buildMinimalDocx,
  buildTextPdf,
  escapeXml,
} from './format-support-fixtures.mjs';
import {
  buildColumnDocx,
  buildImageOnlyPdf,
  renderTextToPng,
  sanitizePdfPlainText,
} from './real-world-import-truth-fixtures.mjs';

const CORPUS_KEYS = [
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
  'creative',
  'twoColumn',
  'academic',
  'recruiter',
  'sales',
];

function readText(root, rel) {
  const fp = path.join(root, rel);
  return fs.existsSync(fp) ? fs.readFileSync(fp, 'utf8') : '';
}

function corpusText(root, key) {
  const fromCorpus = readText(root, `tests/cv-corpus/${key}.txt`);
  if (fromCorpus) return fromCorpus;
  const fromFixture = readText(root, `tests/fixtures/${key}-cv/fixture.txt`);
  if (fromFixture) return fromFixture;
  if (key === 'twoColumn') return readText(root, 'tests/fixtures/two-column-cv/fixture.txt');
  if (key === 'creative') return readText(root, 'tests/fixtures/creative-cv/fixture.txt');
  return readText(root, 'tests/cv-corpus/developer.txt');
}

function resolveBenchmarkLayout(slot) {
  switch (slot.layout) {
    case 'simple':
    case 'table':
    case 'two_column':
      return 'word';
    case 'header_footer':
      return 'executive';
    case 'scanned_image':
    case 'image_heavy':
      return 'creative-portfolio';
    case 'two_column_pdf':
      return 'agency-designer';
    case 'protected':
      return 'executive';
    case 'png':
    case 'jpg':
    case 'screenshot':
      return 'linkedin';
    default:
      return slot.layout || 'word';
  }
}

function userCorpusOverride(root, slotId) {
  const corpusDir = path.join(root, 'tests/real-world-corpus');
  if (!fs.existsSync(corpusDir)) return null;
  const patterns = [
    `${slotId}.pdf`,
    `${slotId}.docx`,
    `${slotId}.png`,
    `${slotId}.jpg`,
    `${slotId}.jpeg`,
    `benchmark-${slotId}`,
  ];
  for (const name of fs.readdirSync(corpusDir)) {
    if (name.startsWith('.') || /^readme/i.test(name)) continue;
    const lower = name.toLowerCase();
    if (patterns.some((p) => lower.includes(p.replace(/_/g, '-')) || lower === p)) {
      return path.join(corpusDir, name);
    }
  }
  return null;
}

async function buildTwoColumnPdf(outPath, plainText) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const page = pdf.addPage([595.28, 841.89]);
  const lines = String(plainText || '').split('\n');
  const mid = Math.max(1, Math.ceil(lines.length / 2));
  const left = lines.slice(0, mid);
  const right = lines.slice(mid);
  let yL = 800;
  let yR = 800;
  for (const line of left) {
    if (yL < 48) break;
    page.drawText(line.slice(0, 42), { x: 36, y: yL, size: 9, font });
    yL -= 13;
  }
  for (const line of right) {
    if (yR < 48) break;
    page.drawText(line.slice(0, 42), { x: 310, y: yR, size: 9, font });
    yR -= 13;
  }
  fs.writeFileSync(outPath, await pdf.save());
}

function buildProtectedPdfStub(outPath) {
  fs.writeFileSync(
    outPath,
    '%PDF-1.4\n% Hirely benchmark — protected/encrypted simulation\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj\nxref\n0 4\ntrailer<</Root 1 0 R/Encrypt 4 0 R>>\n%%EOF\n'
  );
}

function buildHeaderFooterDocx(outPath, plainText, contactLine) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hirely-hf-docx-'));
  const wordDir = path.join(tmpDir, 'word');
  fs.mkdirSync(path.join(wordDir, '_rels'), { recursive: true });
  fs.mkdirSync(path.join(tmpDir, '_rels'), { recursive: true });

  const bodyParas = String(plainText || '')
    .split('\n')
    .map(
      (line) =>
        `<w:p><w:r><w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r></w:p>`
    )
    .join('');

  const headerXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:p><w:r><w:t>${escapeXml(contactLine || 'contact@corp.example.com · +33 1 23 45 67 89')}</w:t></w:r></w:p>
</w:hdr>`;

  const footerXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:p><w:r><w:t>Page </w:t></w:r><w:fldSimple w:instr=" PAGE "/></w:p>
</w:ftr>`;

  fs.writeFileSync(path.join(wordDir, 'header1.xml'), headerXml);
  fs.writeFileSync(path.join(wordDir, 'footer1.xml'), footerXml);
  fs.writeFileSync(
    path.join(wordDir, 'document.xml'),
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<w:body>${bodyParas}<w:sectPr>
<w:headerReference w:type="default" r:id="rId2"/>
<w:footerReference w:type="default" r:id="rId3"/>
</w:sectPr></w:body></w:document>`
  );
  fs.writeFileSync(
    path.join(wordDir, '_rels', 'document.xml.rels'),
    `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>
</Relationships>`
  );
  fs.writeFileSync(
    path.join(wordDir, 'styles.xml'),
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"/>`
  );
  fs.writeFileSync(
    path.join(tmpDir, '[Content_Types].xml'),
    `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>
<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>
</Types>`
  );
  fs.writeFileSync(
    path.join(tmpDir, '_rels', '.rels'),
    `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
  );
  execSync(`cd "${tmpDir}" && zip -qr "${outPath}" .`);
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

async function renderScreenshotPng(page, text, outPath) {
  const pngB64 = await page.evaluate((body) => {
    const canvas = document.createElement('canvas');
    canvas.width = 900;
    canvas.height = 1200;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#e8e8e8';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(24, 56, canvas.width - 48, canvas.height - 80);
    ctx.fillStyle = '#666';
    ctx.font = '12px Helvetica, Arial, sans-serif';
    ctx.fillText('Screenshot — CV document', 36, 36);
    ctx.fillStyle = '#1a1a1a';
    ctx.font = '14px Helvetica, Arial, sans-serif';
    let y = 88;
    for (const line of String(body).split('\n')) {
      if (y > canvas.height - 40) break;
      ctx.fillText(line.slice(0, 88), 44, y);
      y += 18;
    }
    return canvas.toDataURL('image/png').split(',')[1];
  }, text);
  fs.writeFileSync(outPath, Buffer.from(pngB64, 'base64'));
}

async function renderJpegFromText(page, text, outPath) {
  const jpgB64 = await page.evaluate((body) => {
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
    return canvas.toDataURL('image/jpeg', 0.92).split(',')[1];
  }, text);
  fs.writeFileSync(outPath, Buffer.from(jpgB64, 'base64'));
}

/**
 * @param {string} root
 * @param {import('playwright').Page} [page]
 */
export async function ensureRealCvBenchmarkPackFixtures(root, page = null) {
  const outDir = path.join(root, 'tests/output/real-cv-benchmark-pack');
  fs.mkdirSync(outDir, { recursive: true });

  const texts = Object.fromEntries(CORPUS_KEYS.map((k) => [k, corpusText(root, k)]));

  /** @type {Array<import('./real-cv-benchmark-pack-catalog.mjs').BenchmarkSlot & { path: string }>} */
  const cases = [];

  for (const slot of BENCHMARK_ALL_SLOTS) {
    const override = userCorpusOverride(root, slot.id);
    const fp = override || path.join(outDir, slot.fileName);
    const text = texts[slot.corpusKey] || texts.developer;
    const layoutId = resolveBenchmarkLayout(slot);
    const messy = sanitizePdfPlainText(applyHellLayout(text, layoutId));

    if (!override && !fs.existsSync(fp)) {
      if (slot.pack === 'pdf') {
        if (slot.layout === 'protected') {
          buildProtectedPdfStub(fp);
        } else if (slot.layout === 'scanned_image' || slot.layout === 'image_heavy') {
          if (!page) throw new Error(`Playwright page required for ${slot.id}`);
          const pngTmp = fp.replace(/\.pdf$/, '.png');
          await renderTextToPng(page, messy, pngTmp);
          await buildImageOnlyPdf(fp, fs.readFileSync(pngTmp));
        } else if (slot.layout === 'two_column_pdf') {
          await buildTwoColumnPdf(fp, messy);
        } else {
          await buildTextPdf(fp, messy);
        }
      } else if (slot.pack === 'docx') {
        if (slot.layout === 'table' || slot.layout === 'two_column') {
          await buildColumnDocx(fp, messy);
        } else if (slot.layout === 'header_footer') {
          const contact = messy.split('\n').slice(1, 4).join(' · ');
          buildHeaderFooterDocx(fp, messy, contact);
        } else {
          buildMinimalDocx(fp, messy);
        }
      } else if (slot.pack === 'image') {
        if (!page) throw new Error(`Playwright page required for ${slot.id}`);
        if (slot.layout === 'jpg') await renderJpegFromText(page, messy, fp);
        else if (slot.layout === 'screenshot') await renderScreenshotPng(page, messy, fp);
        else await renderTextToPng(page, messy, fp);
      }
    }

    if (fs.existsSync(fp)) {
      cases.push({ ...slot, path: fp });
    }
  }

  return {
    outDir,
    cases,
    counts: {
      pdf: cases.filter((c) => c.pack === 'pdf').length,
      docx: cases.filter((c) => c.pack === 'docx').length,
      image: cases.filter((c) => c.pack === 'image').length,
      total: cases.length,
    },
    texts,
  };
}

export {
  BENCHMARK_PDF_SLOTS,
  BENCHMARK_DOCX_SLOTS,
  BENCHMARK_IMAGE_SLOTS,
  BENCHMARK_ALL_SLOTS,
};
