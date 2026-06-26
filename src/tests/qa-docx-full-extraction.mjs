#!/usr/bin/env node
/**
 * P0 — DOCX full extraction: paragraphs, tables, nested tables, headers, footers,
 * text boxes, drawing shapes, hyperlinks, bullet lists. ≥90% retention.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import mammoth from 'mammoth';
import {
  recoverDocxStructure,
  auditDocxStructureRecovery,
  extractTextFromOoxml,
  extractStructuredContent,
  measureDocxRetention,
  DOCX_RETENTION_TARGET_PCT,
  DOCX_RECOVERY_VERSION,
} from '../core/extraction/docx-structure-recovery.js';
import { runProductionExtractionPipeline } from '../core/pipeline/production-pipeline.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT_DIR = path.join(ROOT, 'tests/output/docx-full-extraction');
const OUT_JSON = path.join(OUT_DIR, 'report.json');
const YOAZ_FIXTURE = path.join(ROOT, 'tests/fixtures/yoaz-cv/fixture.txt');

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

function escapeXml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function wP(text, extra = '') {
  return `<w:p>${extra}<w:r><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
}

function wList(text) {
  return `<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>${escapeXml(text)}</w:t></w:r></w:p>`;
}

function wLink(rid, label) {
  return `<w:hyperlink r:id="${rid}"><w:r><w:t>${escapeXml(label)}</w:t></w:r></w:hyperlink>`;
}

function wPLink(rid, label, suffix = '') {
  const tail = suffix
    ? `<w:r><w:t xml:space="preserve"> ${escapeXml(suffix)}</w:t></w:r>`
    : '';
  return `<w:p>${wLink(rid, label)}${tail}</w:p>`;
}

function wTable(rows) {
  const trs = rows
    .map(
      (cells) =>
        `<w:tr>${cells.map((c) => `<w:tc>${wP(c)}</w:tc>`).join('')}</w:tr>`
    )
    .join('');
  return `<w:tbl>${trs}</w:tbl>`;
}

function wNestedTable(outerRows, innerRows) {
  const inner = wTable(innerRows);
  const trs = outerRows
    .map((cells, i) => {
      const cellXml = cells
        .map((c, j) => {
          if (i === 0 && j === 1) return `<w:tc>${inner}</w:tc>`;
          return `<w:tc>${wP(c)}</w:tc>`;
        })
        .join('');
      return `<w:tr>${cellXml}</w:tr>`;
    })
    .join('');
  return `<w:tbl>${trs}</w:tbl>`;
}

function wTextBox(text) {
  return `<w:p><w:r><w:pict><v:shape><v:textbox><w:txbxContent>${wP(text)}</w:txbxContent></v:textbox></v:shape></w:pict></w:r></w:p>`;
}

function wDrawingText(text) {
  return `<w:p><w:r><w:drawing><wp:anchor><a:graphic><a:graphicData><wps:wsp><wps:txbx><w:txbxContent>${wP(text)}</w:txbxContent></wps:txbx></wps:wsp></a:graphicData></a:graphic></wp:anchor></w:drawing></w:r></w:p>`;
}

function buildFullDocx(outPath, spec) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hirely-docx-full-'));
  const wordDir = path.join(tmp, 'word');
  fs.mkdirSync(path.join(wordDir, '_rels'), { recursive: true });
  fs.mkdirSync(path.join(tmp, '_rels'), { recursive: true });

  const tableBlock = spec.nestedTable
    ? wNestedTable(spec.nestedTable.outer, spec.nestedTable.inner)
    : wTable(spec.tableRows || []);

  const body = [
    wP(spec.name),
    wP(spec.title),
    tableBlock,
    wList((spec.listItems || [])[0] || ''),
    ...(spec.listItems || []).slice(1).map((x) => wList(x)),
    wPLink('rId2', spec.linkLabel || 'Portfolio', '— creative work'),
    wTextBox(spec.textbox || ''),
    spec.drawingText ? wDrawingText(spec.drawingText) : '',
    wP('Education'),
    ...(spec.education || []).map((e) => wP(e)),
  ].join('');

  const header = wP(spec.header || '');
  const footer = wP(spec.footer || '');

  fs.writeFileSync(
    path.join(wordDir, 'document.xml'),
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape">
<w:body>${body}<w:sectPr><w:cols w:num="2"/></w:sectPr></w:body></w:document>`
  );
  fs.writeFileSync(
    path.join(wordDir, 'header1.xml'),
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${header}</w:hdr>`
  );
  fs.writeFileSync(
    path.join(wordDir, 'footer1.xml'),
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${footer}</w:ftr>`
  );
  fs.writeFileSync(
    path.join(tmp, '[Content_Types].xml'),
    `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>
<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>
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
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://portfolio.example.com" TargetMode="External"/>
</Relationships>`
  );
  execSync(`cd "${tmp}" && zip -qr "${outPath}" .`);
}

function sectionCounts(pipe) {
  const cv = pipe?.validatedCVData || {};
  return {
    name: cv.name || '',
    email: cv.email || '',
    experiences: (cv.experience || []).length,
    education: (cv.education || []).length,
    skills: (cv.skills || []).length,
    clients: (cv.clients || []).length,
  };
}

async function recoverBuf(filePath) {
  const buf = fs.readFileSync(filePath);
  return recoverDocxStructure(
    buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
    mammoth
  );
}

fs.mkdirSync(OUT_DIR, { recursive: true });

ok(DOCX_RECOVERY_VERSION === 'DOCX_FULL_EXTRACTION_V2', 'engine version V2');

// Unit: nested table
const nestedXml = wNestedTable(
  [['Agency Group', 'Roles']],
  [
    ['McCann Paris', 'Lead Illustrator'],
    ['AKQA Paris', 'Lead Visual Designer'],
  ]
);
const nestedLines = extractStructuredContent(nestedXml);
ok(nestedLines.some((l) => /McCann Paris/.test(l)), 'nested table inner row 1');
ok(nestedLines.some((l) => /AKQA Paris/.test(l)), 'nested table inner row 2');

// Unit: drawing shape text box
const drawLines = extractStructuredContent(wDrawingText('Clients: Converse, Pantone'));
ok(drawLines.some((l) => /Converse/.test(l)), 'drawing shape text recovered');

// Unit: flat table + list + link
ok(
  extractTextFromOoxml(wTable([['DDB Paris', 'Visual Designer', '2021']])).some((l) =>
    /DDB Paris/.test(l)
  ),
  'flat table row'
);
const listLines = extractTextFromOoxml(wList('Figma') + wList('Photoshop'));
ok(listLines.every((l) => l.startsWith('•')), 'bullet lists');

// Full structured DOCX
const fullPath = path.join(OUT_DIR, 'full-structure.docx');
buildFullDocx(fullPath, {
  header: 'yoaz@hotmail.fr · LinkedIn',
  footer: '+33 6 49 43 48 39 · Paris',
  name: 'Yohann Azancot',
  title: 'Graphic Designer & Illustrator',
  nestedTable: {
    outer: [['Experience Matrix', 'Details']],
    inner: [
      ['McCann Paris', 'Lead Illustrator', '2011 — 2014'],
      ['AKQA Paris', 'Lead Visual Designer', '2022 — 2023'],
    ],
  },
  listItems: ['Illustration', 'Graphic Design', 'Branding'],
  linkLabel: 'Portfolio',
  textbox: 'Clients: Nike, Adobe, Louis Vuitton',
  drawingText: 'Tools: Photoshop, Illustrator, InDesign',
  education: ['LISAA — Web & Motion Design', 'Créapole — Visual Communication'],
});

const fullRecovery = await recoverBuf(fullPath);
const fullAudit = auditDocxStructureRecovery(fullRecovery);

ok(fullAudit.headers, 'headers extracted');
ok(fullAudit.footers, 'footers extracted');
ok(fullAudit.tables, 'tables extracted');
ok(fullAudit.nestedTables, 'nested tables detected');
ok(fullAudit.columns, 'columns detected');
ok(fullAudit.textboxes, 'textboxes extracted');
ok(fullAudit.lists, 'lists extracted');
ok(fullAudit.links, 'links extracted');
ok(
  fullRecovery.retention.pct >= DOCX_RETENTION_TARGET_PCT,
  `retention ${fullRecovery.retention.pct}% >= ${DOCX_RETENTION_TARGET_PCT}%`
);

const fullText = fullRecovery.text;
ok(/yoaz@hotmail\.fr/i.test(fullText), 'header contact email');
ok(/\+33 6 49 43 48 39/.test(fullText), 'footer contact phone');
ok(/McCann Paris/i.test(fullText), 'nested table experience');
ok(/AKQA Paris/i.test(fullText), 'nested table experience 2');
ok(/Illustration/i.test(fullText), 'bullet list skill');
ok(/Nike/i.test(fullText), 'textbox clients');
ok(/Photoshop/i.test(fullText), 'drawing shape tools');
ok(/portfolio\.example\.com/i.test(fullText), 'hyperlink url');

const pipeFull = await runProductionExtractionPipeline(fullText, { extractionMethod: 'docx' });
const countsFull = sectionCounts(pipeFull);
ok(countsFull.experiences >= 2, 'parsed nested table experiences');
ok(countsFull.education >= 1, 'parsed education');

// Mammoth-only would miss header/footer/table — merged must beat paragraph-only
ok(
  fullRecovery.text.length >= Math.max(fullRecovery.mammothText.length, 1) * 0.9,
  'merged text not paragraph-only shrink'
);
if (fullAudit.tables) {
  ok(/\|/.test(fullText) || /McCann Paris/.test(fullText), 'table content not dropped');
}

// Yoaz full CV DOCX
const yoazPath = path.join(OUT_DIR, 'yoaz-full.docx');
const yoazText = fs.readFileSync(YOAZ_FIXTURE, 'utf8');
buildFullDocx(yoazPath, {
  header: 'yoaz@hotmail.fr · Portfolio',
  footer: 'Paris · +33 6 49 43 48 39',
  name: 'Yohann Azancot',
  title: 'Graphic Designer & Illustrator',
  tableRows: yoazText
    .split('\n')
    .filter((l) => / — /.test(l) && /\d{4}/.test(l))
    .slice(0, 8)
    .map((l) => {
      const parts = l.split(' — ');
      return [parts[0] || l, parts[1] || '', parts[2] || ''];
    }),
  listItems: ['Illustration', 'Graphic Design', 'Branding', 'Typography'],
  linkLabel: 'Portfolio',
  textbox: 'Clients: Nike, Adobe, Louis Vuitton, Marvel, Converse',
  drawingText: 'Software: Photoshop, Illustrator',
  education: ['LISAA — Web & Motion Design', 'Créapole — Visual Communication'],
});

const yoazRecovery = await recoverBuf(yoazPath);
ok(
  yoazRecovery.retention.pct >= DOCX_RETENTION_TARGET_PCT,
  `yoaz retention ${yoazRecovery.retention.pct}%`
);
const pipeYoaz = await runProductionExtractionPipeline(yoazRecovery.text, { extractionMethod: 'docx' });
ok(sectionCounts(pipeYoaz).experiences >= 5, 'yoaz experiences parsed');

const report = {
  pass: failed === 0,
  engineVersion: DOCX_RECOVERY_VERSION,
  generatedAt: new Date().toISOString(),
  retentionTargetPct: DOCX_RETENTION_TARGET_PCT,
  elements: [
    'paragraphs',
    'tables',
    'nested_tables',
    'headers',
    'footers',
    'text_boxes',
    'drawing_shapes',
    'hyperlinks',
    'bullet_lists',
    'columns',
  ],
  full: {
    retentionPct: fullRecovery.retention.pct,
    audit: fullAudit,
    sections: countsFull,
    charExtracted: fullRecovery.text.length,
    charVisible: fullRecovery.visibleText.length,
  },
  yoaz: {
    retentionPct: yoazRecovery.retention.pct,
    sections: sectionCounts(pipeYoaz),
  },
  rules: {
    neverParagraphOnlyWhenTables: true,
    neverDropColumns: true,
    neverDropHeaderFooterContact: true,
  },
};

fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2));
console.log('Wrote', OUT_JSON);
process.exit(failed ? 1 : 0);
