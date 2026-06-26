#!/usr/bin/env node
/**
 * P0 — DOCX structure recovery: headers, footers, tables, text boxes, lists, links.
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
  measureDocxRetention,
  DOCX_RETENTION_TARGET_PCT,
} from '../core/extraction/docx-structure-recovery.js';
import { runProductionExtractionPipeline } from '../core/pipeline/production-pipeline.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT_DIR = path.join(ROOT, 'tests/output/docx-structure-recovery');
const OUT_JSON = path.join(OUT_DIR, 'report.json');
const YOAZ_FIXTURE = path.join(ROOT, 'tests/fixtures/yoaz-cv/fixture.txt');
const DOCX_FIXTURE = path.join(ROOT, 'tests/fixtures/docx/fixture.txt');

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

function wTextBox(text) {
  return `<w:p><w:r><w:pict><v:shape><v:textbox><w:txbxContent>${wP(text)}</w:txbxContent></v:textbox></v:shape></w:pict></w:r></w:p>`;
}

function buildStructureDocx(outPath, spec) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hirely-docx-struct-'));
  const wordDir = path.join(tmp, 'word');
  fs.mkdirSync(path.join(wordDir, '_rels'), { recursive: true });
  fs.mkdirSync(path.join(tmp, '_rels'), { recursive: true });

  const body = [
    wP(spec.name),
    wP(spec.title),
    wTable(spec.tableRows || []),
    wList((spec.listItems || [])[0] || ''),
    ...(spec.listItems || []).slice(1).map((x) => wList(x)),
    wPLink('rId2', spec.linkLabel || 'Portfolio', '— creative work'),
    wTextBox(spec.textbox || ''),
    wP('Education'),
    ...(spec.education || []).map((e) => wP(e)),
  ].join('');

  const header = wP(spec.header || '');
  const footer = wP(spec.footer || '');

  fs.writeFileSync(
    path.join(wordDir, 'document.xml'),
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:v="urn:schemas-microsoft-com:vml">
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
    portfolio: (cv.portfolio || cv.portfolioLinks || []).length,
  };
}

// --- Unit: OOXML fragments ---
const tableXml = wTable([
  ['McCann Paris', 'Lead Illustrator', '2011 — 2014'],
  ['Publicis Conseil', 'Art Director', '2014 — 2016'],
]);
const tableLines = extractTextFromOoxml(tableXml);
ok(tableLines.some((l) => /McCann Paris/.test(l) && /Lead Illustrator/.test(l)), 'table cells recovered');

const listXml = wList('Photoshop') + wList('Illustrator');
const listLines = extractTextFromOoxml(listXml);
ok(listLines.every((l) => l.startsWith('•')), 'list bullets preserved');

const txLines = extractTextFromOoxml(wTextBox('Nike, Adobe, Louis Vuitton'));
ok(txLines.some((l) => /Nike/.test(l)), 'text box content recovered');

const linkXml = `<w:p xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${wLink('rId2', 'My Portfolio')}</w:p>`;
const linkLines = extractTextFromOoxml(linkXml, {
  hyperlinks: new Map([['rId2', 'https://yoaz.studio']]),
});
ok(linkLines.some((l) => /My Portfolio/.test(l) && /yoaz\.studio/.test(l)), 'hyperlink label + url');

const retention = measureDocxRetention('Yohann Azancot Nike Adobe Skills', 'Yohann Azancot Nike Adobe Skills Photoshop');
ok(retention.pct >= 90, `retention measure ${retention.pct}%`);

// --- Structured DOCX ---
const structPath = path.join(OUT_DIR, 'structure-rich.docx');
fs.mkdirSync(OUT_DIR, { recursive: true });
buildStructureDocx(structPath, {
  header: 'yoaz@hotmail.fr',
  footer: '+33 6 49 43 48 39',
  name: 'Yohann Azancot',
  title: 'Graphic Designer & Illustrator',
  tableRows: [
    ['McCann Paris', 'Lead Illustrator', '2011 — 2014'],
    ['AKQA Paris', 'Lead Visual Designer', '2022 — 2023'],
  ],
  listItems: ['Illustration', 'Graphic Design', 'Branding'],
  linkLabel: 'Portfolio',
  textbox: 'Clients: Nike, Adobe, Louis Vuitton, Marvel',
  education: ['LISAA — Web & Motion Design', 'Créapole — Visual Communication'],
});

const structBuf = fs.readFileSync(structPath);
const structRecovery = await recoverDocxStructure(structBuf.buffer.slice(structBuf.byteOffset, structBuf.byteOffset + structBuf.byteLength), mammoth);
const structAudit = auditDocxStructureRecovery(structRecovery);

ok(structAudit.headers, 'audit headers');
ok(structAudit.footers, 'audit footers');
ok(structAudit.tables, 'audit tables');
ok(structAudit.columns, 'audit columns');
ok(structAudit.textboxes, 'audit textboxes');
ok(structAudit.lists, 'audit lists');
ok(structAudit.links, 'audit links');
ok(structRecovery.retention.pct >= DOCX_RETENTION_TARGET_PCT, `retention ${structRecovery.retention.pct}% >= ${DOCX_RETENTION_TARGET_PCT}%`);

const structText = structRecovery.text;
ok(/yoaz@hotmail\.fr/i.test(structText), 'identity email from header');
ok(/McCann Paris/i.test(structText), 'experience from table');
ok(/LISAA/i.test(structText), 'education recovered');
ok(/Illustration/i.test(structText), 'skills from list');
ok(/Nike/i.test(structText), 'clients from textbox');
ok(/portfolio\.example\.com/i.test(structText), 'portfolio link recovered');

const pipeStruct = await runProductionExtractionPipeline(structText, { extractionMethod: 'docx' });
const countsStruct = sectionCounts(pipeStruct);
ok(countsStruct.experiences >= 2, 'parsed experiences from recovered docx');
ok(countsStruct.education >= 1, 'parsed education');
ok(countsStruct.skills >= 2 || /Illustration/i.test(structText), 'skills present');

// --- Yoaz fixture DOCX (full CV) ---
const yoazPath = path.join(OUT_DIR, 'yoaz-full.docx');
const yoazText = fs.readFileSync(YOAZ_FIXTURE, 'utf8');
buildStructureDocx(yoazPath, {
  header: 'yoaz@hotmail.fr · Portfolio',
  footer: 'Paris · +33 6 49 43 48 39',
  name: 'Yohann Azancot',
  title: 'Graphic Designer & Illustrator',
  tableRows: yoazText
    .split('\n')
    .filter((l) => / — /.test(l) && /\d{4}/.test(l))
    .slice(0, 6)
    .map((l) => {
      const parts = l.split(' — ');
      return [parts[0] || l, parts[1] || '', parts[2] || ''];
    }),
  listItems: ['Illustration', 'Graphic Design', 'Branding', 'Typography'],
  linkLabel: 'Portfolio',
  textbox: 'Clients: Nike, Adobe, Louis Vuitton, Marvel, Converse',
  education: ['LISAA — Web & Motion Design', 'Créapole — Visual Communication'],
});

const yoazBuf = fs.readFileSync(yoazPath);
const yoazRecovery = await recoverDocxStructure(yoazBuf.buffer.slice(yoazBuf.byteOffset, yoazBuf.byteOffset + yoazBuf.byteLength), mammoth);
ok(yoazRecovery.retention.pct >= DOCX_RETENTION_TARGET_PCT, `yoaz docx retention ${yoazRecovery.retention.pct}%`);

const pipeYoaz = await runProductionExtractionPipeline(yoazRecovery.text, { extractionMethod: 'docx' });
const countsYoaz = sectionCounts(pipeYoaz);
ok(countsYoaz.experiences >= 5, 'yoaz experiences');
ok(countsYoaz.education >= 1, 'yoaz education');
ok(/yoaz@hotmail|Yohann/i.test(yoazRecovery.text), 'yoaz identity');

// --- Simple fixture DOCX ---
const simplePath = path.join(OUT_DIR, 'marie.docx');
buildStructureDocx(simplePath, {
  header: 'marie.dupont@email.com',
  footer: 'Paris, France',
  name: 'Marie Dupont',
  title: 'Senior Product Manager',
  tableRows: [['Acme SaaS', 'Senior Product Manager', '2019 – Present']],
  listItems: ['Product strategy', 'Agile', 'SQL'],
  linkLabel: 'LinkedIn',
  textbox: 'Portfolio: product cases',
  education: ['HEC Paris — MBA 2018'],
});

const simpleText = fs.readFileSync(DOCX_FIXTURE, 'utf8');
const simpleBuf = fs.readFileSync(simplePath);
const simpleRecovery = await recoverDocxStructure(simpleBuf.buffer.slice(simpleBuf.byteOffset, simpleBuf.byteOffset + simpleBuf.byteLength), mammoth);
ok(simpleRecovery.retention.pct >= DOCX_RETENTION_TARGET_PCT, `simple docx retention ${simpleRecovery.retention.pct}%`);
ok(/marie\.dupont@email\.com/i.test(simpleRecovery.text), 'simple identity email');

const report = {
  pass: failed === 0,
  generatedAt: new Date().toISOString(),
  retentionTargetPct: DOCX_RETENTION_TARGET_PCT,
  structured: {
    retentionPct: structRecovery.retention.pct,
    audit: structAudit,
    sections: countsStruct,
  },
  yoaz: {
    retentionPct: yoazRecovery.retention.pct,
    sections: countsYoaz,
  },
  simple: {
    retentionPct: simpleRecovery.retention.pct,
    fixtureChars: simpleText.length,
    extractedChars: simpleRecovery.text.length,
  },
  auditElements: ['headers', 'footers', 'tables', 'columns', 'textboxes', 'lists', 'links'],
  recoverSections: ['identity', 'experience', 'education', 'skills', 'clients', 'portfolio'],
};

fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2));
console.log('Wrote', OUT_JSON);
process.exit(failed ? 1 : 0);
