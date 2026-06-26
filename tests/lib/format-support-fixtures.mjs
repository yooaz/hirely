/**
 * Format support audit — fixture builders and paths.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { makeNodeFile } from './h7-import-catalog.mjs';
import { ensureH7Fixtures } from './h7-import-runner.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const YOAZ_FIXTURE_REL = 'tests/fixtures/yoaz-cv/fixture.txt';

/** Minimal valid 1×1 white PNG */
const TINY_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

export function escapeXml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildMinimalDocx(outPath, plainText) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hirely-fmt-docx-'));
  const wordDir = path.join(tmp, 'word');
  fs.mkdirSync(path.join(wordDir, '_rels'), { recursive: true });
  fs.mkdirSync(path.join(tmp, '_rels'), { recursive: true });
  const paragraphs = plainText
    .split('\n')
    .map(
      (line) =>
        `<w:p><w:r><w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r></w:p>`
    )
    .join('');
  fs.writeFileSync(
    path.join(wordDir, 'document.xml'),
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>${paragraphs}<w:sectPr/></w:body></w:document>`
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
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>
`
  );
  execSync(`cd "${tmp}" && zip -qr "${outPath}" .`);
}

export async function buildTextPdf(outPath, plainText) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const page = pdf.addPage([595.28, 841.89]);
  const lines = plainText.split('\n');
  let y = 800;
  for (const line of lines) {
    if (y < 48) break;
    page.drawText(line.slice(0, 90), { x: 48, y, size: 10, font });
    y -= 14;
  }
  fs.writeFileSync(outPath, await pdf.save());
}

export function buildRtfFromPlain(plainText) {
  const body = plainText
    .split('\n')
    .map((line) => `${line}\\par`)
    .join('\n');
  return `{\\rtf1\\ansi\\deff0 ${body} }`;
}

export function ensureFormatSupportFixtures(root) {
  const outDir = path.join(root, 'tests/output/format-support-audit');
  fs.mkdirSync(outDir, { recursive: true });

  const yoazPath = path.join(root, YOAZ_FIXTURE_REL);
  const yoaz = fs.existsSync(yoazPath) ? fs.readFileSync(yoazPath, 'utf8') : '';

  const h7 = ensureH7Fixtures(root);

  const txtPath = path.join(outDir, 'yoaz.txt');
  if (yoaz && !fs.existsSync(txtPath)) fs.writeFileSync(txtPath, yoaz);

  const docxPath = path.join(outDir, 'yoaz.docx');
  if (yoaz && !fs.existsSync(docxPath)) buildMinimalDocx(docxPath, yoaz);

  const docPath = path.join(outDir, 'yoaz.doc');
  if (yoaz && !fs.existsSync(docPath)) {
    fs.copyFileSync(docxPath, docPath);
  }

  const rtfPath = path.join(outDir, 'yoaz.rtf');
  if (yoaz && !fs.existsSync(rtfPath)) {
    fs.writeFileSync(rtfPath, buildRtfFromPlain(yoaz));
  }

  const pdfSelectablePath = path.join(outDir, 'yoaz-selectable.pdf');
  if (yoaz && !fs.existsSync(pdfSelectablePath)) {
    // sync build deferred — caller awaits buildTextPdf
  }

  const pngPath = path.join(outDir, 'cv-scan.png');
  if (!fs.existsSync(pngPath)) {
    fs.writeFileSync(pngPath, Buffer.from(TINY_PNG_B64, 'base64'));
  }

  const jpgPath = path.join(outDir, 'cv-scan.jpg');
  if (!fs.existsSync(jpgPath)) {
    fs.copyFileSync(pngPath, jpgPath);
  }

  const realPdf =
    h7.pdf ||
    resolveFirstExisting(root, [
      process.env.HIRELY_YOAZ_PDF,
      'tests/output/p7-final-lock/fixture.pdf',
    ]);

  return {
    outDir,
    yoaz,
    yoazPath,
    txtPath,
    docxPath,
    docPath,
    rtfPath,
    pdfSelectablePath,
    pdfReal: realPdf,
    pdfScanned: h7.scanned,
    pdfProtected: h7.corrupt,
    pngPath,
    jpgPath,
  };
}

export function resolveFirstExisting(root, candidates = []) {
  for (const p of candidates) {
    if (!p) continue;
    const abs = path.isAbsolute(p) ? p : path.join(root, p);
    if (fs.existsSync(abs)) return abs;
  }
  return null;
}

export function fileFromPath(fp, overrideName, overrideType) {
  const buf = fs.readFileSync(fp);
  const name = overrideName || path.basename(fp);
  const ext = path.extname(name).toLowerCase();
  const type =
    overrideType ||
    {
      '.pdf': 'application/pdf',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.doc': 'application/msword',
      '.rtf': 'application/rtf',
      '.txt': 'text/plain',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
    }[ext] ||
    'application/octet-stream';
  return makeNodeFile(buf, name, type);
}
