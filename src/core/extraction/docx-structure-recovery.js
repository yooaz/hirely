/**
 * DOCX full extraction — OOXML walk for headers, footers, tables (nested), columns,
 * text boxes, drawing shapes, lists, hyperlinks.
 */

import { normalizeRawExtract, repairCompactWordBoundaries } from '../parsing/clean.js';
import { mammothHtmlToPlainText } from './docx-extract.js';

export const DOCX_RECOVERY_VERSION = 'DOCX_FULL_EXTRACTION_V2';
export const DOCX_RETENTION_TARGET_PCT = 90;

/**
 * @param {ArrayBuffer|Buffer|Uint8Array} buffer
 */
async function resolveJsZip() {
  if (globalThis.JSZip) return globalThis.JSZip;
  if (globalThis.HirelyLazy?.ensureJsZip) {
    await globalThis.HirelyLazy.ensureJsZip();
    return globalThis.JSZip;
  }
  const mod = await import('../vendor/csp-safe-loader.js');
  return mod.ensureJsZip();
}

/**
 * @param {ArrayBuffer|Buffer|Uint8Array} buffer
 */
export async function loadDocxZip(buffer) {
  const JSZip = await resolveJsZip();
  let bytes = buffer;
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(buffer)) {
    bytes = buffer;
  } else if (buffer instanceof ArrayBuffer) {
    bytes = buffer;
  } else if (buffer?.buffer instanceof ArrayBuffer) {
    bytes = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  }
  return JSZip.loadAsync(bytes);
}

export function normalizeForRetention(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w@.+/\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Word-level retention — share of visible tokens found in extracted text.
 */
export function measureDocxRetention(visibleText, extractedText) {
  const vis = normalizeForRetention(visibleText);
  const ext = normalizeForRetention(extractedText);
  if (!vis.length) {
    return { pct: 100, visibleWords: 0, retainedWords: 0, charVisible: 0, charExtracted: ext.length };
  }
  const words = vis.split(/\s+/).filter((w) => w.length > 1);
  const retained = words.filter((w) => ext.includes(w)).length;
  const pct = words.length ? Math.round((retained / words.length) * 100) : 100;
  return {
    pct,
    visibleWords: words.length,
    retainedWords: retained,
    charVisible: vis.length,
    charExtracted: ext.length,
  };
}

/**
 * @param {string} relsXml
 */
export function parseHyperlinkRels(relsXml) {
  const map = new Map();
  const hits = String(relsXml || '').matchAll(/<Relationship\s+([^>]+)\/>/gi);
  for (const hit of hits) {
    const attrs = hit[1];
    const id = /Id="([^"]+)"/i.exec(attrs)?.[1];
    const target = /Target="([^"]+)"/i.exec(attrs)?.[1];
    const type = /Type="([^"]+)"/i.exec(attrs)?.[1] || '';
    if (id && target && type.includes('hyperlink')) {
      const url = target.startsWith('http') ? target : target.replace(/^mailto:/i, '');
      map.set(id, url);
    }
  }
  return map;
}

function decodeXmlEntities(s) {
  return String(s || '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function extractRunsFromFragment(fragment) {
  const texts = [];
  const runRe = /<w:r[\s>][\s\S]*?<\/w:r>|<w:r\/>/gi;
  const runs = String(fragment || '').match(runRe) || [];
  for (const run of runs.length ? runs : [fragment]) {
    if (/<w:tab\b/i.test(run)) texts.push('\t');
    if (/<w:br\b/i.test(run)) texts.push('\n');
    const tRe = /<w:t[^>]*>([\s\S]*?)<\/w:t>/gi;
    let m;
    while ((m = tRe.exec(run)) !== null) {
      const t = decodeXmlEntities(m[1]);
      if (t) texts.push(t);
    }
  }
  return texts;
}

function extractDrawingText(fragment) {
  const texts = [];
  const aRe = /<a:t[^>]*>([\s\S]*?)<\/a:t>/gi;
  let m;
  while ((m = aRe.exec(fragment)) !== null) {
    const t = decodeXmlEntities(m[1]).trim();
    if (t) texts.push(t);
  }
  return texts;
}

function extractParagraphText(pXml, hyperlinks) {
  const parts = [];
  const isList = /<w:numPr\b/i.test(pXml);
  const hRe =
    /<w:hyperlink[^>]*r:id="([^"]+)"[^>]*>([\s\S]*?)<\/w:hyperlink>|<w:hyperlink[^>]*>([\s\S]*?)<\/w:hyperlink>/gi;
  let consumed = String(pXml || '');
  let hm;
  while ((hm = hRe.exec(pXml)) !== null) {
    const rid = hm[1];
    const inner = hm[2] || hm[3] || '';
    const label = extractRunsFromFragment(inner).join('').replace(/\s+/g, ' ').trim();
    const url = rid ? hyperlinks.get(rid) : '';
    if (label && url) parts.push(`${label} (${url})`);
    else if (label) parts.push(label);
    consumed = consumed.replace(hm[0], ' ');
  }

  const txbxRe = /<w:txbxContent[^>]*>([\s\S]*?)<\/w:txbxContent>/gi;
  let txm;
  while ((txm = txbxRe.exec(pXml)) !== null) {
    const innerLines = extractStructuredContent(txm[1], { hyperlinks });
    if (innerLines.length) parts.push(innerLines.join(' '));
    consumed = consumed.replace(txm[0], ' ');
  }

  const drawn = extractDrawingText(pXml).join(' ').trim();
  if (drawn) parts.push(drawn);

  const rest = extractRunsFromFragment(consumed).join('').replace(/\s+/g, ' ').trim();
  if (rest) parts.push(rest);
  const line = parts.join(' ').trim();
  if (!line) return '';
  return isList ? `• ${line}` : line;
}

/**
 * Match a balanced OOXML element (handles nested same-tag nodes e.g. w:p in text boxes).
 * @param {string} s
 * @param {string} localName e.g. "p", "tbl"
 * @param {number} [start]
 */
function matchBalancedTag(s, localName, start = 0) {
  const blob = String(s || '').slice(start);
  const openRe = new RegExp(`<w:${localName}(?=\\s|>)`, 'i');
  const openHit = openRe.exec(blob);
  if (!openHit) return null;
  const openIdx = start + openHit.index;
  const head = s.slice(openIdx, openIdx + 24);
  if (/<\w+:[^>]+\/>/.test(head)) {
    const self = s.slice(openIdx).match(new RegExp(`^<w:${localName}[^>]*/>`, 'i'));
    if (!self) return null;
    return { index: openIdx, end: openIdx + self[0].length, content: self[0] };
  }
  let depth = 0;
  const tagRe = new RegExp(`<(/?)w:${localName}(?=\\s|>|/)`, 'gi');
  tagRe.lastIndex = openIdx;
  let m;
  while ((m = tagRe.exec(s)) !== null) {
    const snippet = s.slice(m.index, m.index + 40);
    if (/^<w:[^>]+\/>/.test(snippet)) continue;
    if (m[1] === '/') depth--;
    else depth++;
    if (depth === 0) {
      const end = tagRe.lastIndex;
      return { index: openIdx, end, content: s.slice(openIdx, end) };
    }
  }
  return null;
}

function findNextBlock(xml, start = 0) {
  const s = String(xml || '');
  const tags = ['tbl', 'p', 'sdt'];
  let best = null;
  for (const local of tags) {
    const hit = matchBalancedTag(s, local, start);
    if (!hit) continue;
    if (!best || hit.index < best.index) {
      best = { tag: `w:${local}`, index: hit.index, end: hit.end, content: hit.content };
    }
  }
  return best;
}

/**
 * Recursive OOXML block walk — preserves document order, nested tables, drawing text.
 * @param {string} xml
 * @param {object} [opts]
 * @param {Map<string,string>} [opts.hyperlinks]
 */
export function extractStructuredContent(xml, opts = {}) {
  const hyperlinks = opts.hyperlinks || new Map();
  const lines = [];
  let pos = 0;
  const s = String(xml || '');

  while (pos < s.length) {
    const block = findNextBlock(s, pos);
    if (!block) break;

    if (block.tag === 'w:tbl') {
      lines.push(...extractTableRows(block.content, hyperlinks));
    } else if (block.tag === 'w:txbxContent') {
      const inner = block.content.replace(/^<w:txbxContent[^>]*>|<\/w:txbxContent>$/gi, '');
      lines.push(...extractStructuredContent(inner, { hyperlinks }));
    } else if (block.tag === 'w:drawing') {
      const drawn = extractDrawingText(block.content).join(' ').trim();
      if (drawn) lines.push(drawn);
      const txbx = block.content.match(/<w:txbxContent[^>]*>([\s\S]*?)<\/w:txbxContent>/i);
      if (txbx) lines.push(...extractStructuredContent(txbx[1], { hyperlinks }));
    } else if (block.tag === 'w:sdt') {
      const content = block.content.match(/<w:sdtContent[^>]*>([\s\S]*?)<\/w:sdtContent>/i);
      if (content) lines.push(...extractStructuredContent(content[1], { hyperlinks }));
    } else if (block.tag === 'w:p') {
      const line = extractParagraphText(block.content, hyperlinks);
      if (line) lines.push(line);
    }

    pos = block.end;
  }

  if (!lines.length) {
    const txbxRe = /<w:txbxContent[^>]*>([\s\S]*?)<\/w:txbxContent>/gi;
    let txm;
    while ((txm = txbxRe.exec(s)) !== null) {
      lines.push(...extractStructuredContent(txm[1], { hyperlinks }));
    }
    const drawn = extractDrawingText(s).join(' ').trim();
    if (drawn) lines.push(drawn);
    const fallback = extractRunsFromFragment(s).join('').replace(/\s+/g, ' ').trim();
    if (fallback) lines.push(fallback);
  }

  return lines
    .map((l) => repairCompactWordBoundaries(l.replace(/\t/g, ' | ').replace(/\s+/g, ' ').trim()))
    .filter(Boolean);
}

/**
 * @param {string} tblXml
 * @param {Map<string,string>} hyperlinks
 */
function extractTableRows(tblXml, hyperlinks) {
  const lines = [];
  const rowRe = /<w:tr[^>]*>([\s\S]*?)<\/w:tr>/gi;
  let row;
  while ((row = rowRe.exec(tblXml)) !== null) {
    const cellRe = /<w:tc[^>]*>([\s\S]*?)<\/w:tc>/gi;
    const cells = [];
    let cell;
    let hasNestedTable = false;
    while ((cell = cellRe.exec(row[1])) !== null) {
      const inner = cell[1];
      if (/<w:tbl\b/i.test(inner)) {
        hasNestedTable = true;
        lines.push(...extractStructuredContent(inner, { hyperlinks }));
      }
      const cellLines = extractStructuredContent(inner, { hyperlinks });
      const flat = cellLines.join(' ').trim();
      if (flat) cells.push(flat);
    }
    if (!hasNestedTable && cells.length) {
      lines.push(cells.join(' | '));
    }
  }
  return lines;
}

/**
 * @param {string} xml
 * @param {object} [opts]
 * @param {Map<string,string>} [opts.hyperlinks]
 * @param {string} [opts.zone]
 */
export function extractTextFromOoxml(xml, opts = {}) {
  const hyperlinks = opts.hyperlinks || new Map();
  return extractStructuredContent(xml, { hyperlinks });
}

function sortDocxParts(parts) {
  const rank = (name) => {
    if (/header\d*\.xml$/i.test(name)) return 0;
    if (/document\.xml$/i.test(name)) return 1;
    if (/footer\d*\.xml$/i.test(name)) return 2;
    return 3;
  };
  return [...parts].sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name));
}

/**
 * @param {import('jszip')} zip
 */
export async function discoverDocxParts(zip) {
  const parts = [];
  const names = Object.keys(zip.files || {}).filter((n) =>
    /^word\/(document|header\d+|footer\d+|footnotes|endnotes)\.xml$/i.test(n)
  );
  for (const name of names) {
    const file = zip.files[name];
    if (!file?.dir) {
      const xml = await file.async('string');
      const zone = /header/i.test(name) ? 'header' : /footer/i.test(name) ? 'footer' : 'body';
      parts.push({ name, zone, xml });
    }
  }
  if (!parts.some((p) => p.name === 'word/document.xml') && zip.files['word/document.xml']) {
    parts.unshift({
      name: 'word/document.xml',
      zone: 'body',
      xml: await zip.files['word/document.xml'].async('string'),
    });
  }
  return sortDocxParts(parts);
}

/**
 * @param {import('jszip')} zip
 * @param {string} partName
 */
export async function loadPartHyperlinks(zip, partName) {
  const base = partName.split('/').pop();
  const relPath = `word/_rels/${base}.rels`;
  const relFile = zip.files[relPath];
  if (!relFile) return new Map();
  return parseHyperlinkRels(await relFile.async('string'));
}

/**
 * @param {ArrayBuffer|Buffer|Uint8Array} buffer
 */
export async function extractVisibleCorpusFromDocx(buffer) {
  const zip = await loadDocxZip(buffer);
  const parts = await discoverDocxParts(zip);
  const lines = [];
  const audit = {
    headers: 0,
    footers: 0,
    tables: 0,
    nestedTables: 0,
    columns: 0,
    textboxes: 0,
    drawings: 0,
    lists: 0,
    links: 0,
    bodyParts: 0,
  };

  for (const part of parts) {
    const hyperlinks = await loadPartHyperlinks(zip, part.name);
    audit.links += hyperlinks.size;
    if (part.zone === 'header') audit.headers += 1;
    if (part.zone === 'footer') audit.footers += 1;
    if (part.zone === 'body') audit.bodyParts += 1;
    const tblCount = (part.xml.match(/<w:tbl\b/gi) || []).length;
    audit.tables += tblCount;
    audit.nestedTables += (part.xml.match(/<w:tc[^>]*>[\s\S]*?<w:tbl\b/gi) || []).length;
    audit.textboxes += (part.xml.match(/<w:txbxContent\b/gi) || []).length;
    audit.drawings += (part.xml.match(/<w:drawing\b/gi) || []).length;
    audit.lists += (part.xml.match(/<w:numPr\b/gi) || []).length;
    if (/<w:cols\b/i.test(part.xml)) audit.columns += 1;

    lines.push(...extractTextFromOoxml(part.xml, { hyperlinks, zone: part.zone }));
  }

  return {
    text: normalizeRawExtract(lines.join('\n')),
    lines,
    audit,
    parts: parts.map((p) => p.name),
  };
}

function salvageXmlLine(line) {
  if (!/<w:/i.test(line)) return line;
  const runs = extractRunsFromFragment(line).join('').replace(/\s+/g, ' ').trim();
  return runs || '';
}

export function mergeDocxExtractions(...sources) {
  const seen = new Set();
  const out = [];
  for (const src of sources) {
    const text = String(src || '').trim();
    if (!text) continue;
    for (const rawLine of text.split('\n')) {
      const line = salvageXmlLine(rawLine).trim();
      if (!line) continue;
      const key = normalizeForRetention(line);
      if (!key || key.length < 2 || seen.has(key)) continue;
      seen.add(key);
      out.push(line);
    }
  }
  return normalizeRawExtract(repairCompactWordBoundaries(out.join('\n')));
}

/**
 * When tables exist, never ship paragraph-only Mammoth output — force OOXML table lines in.
 */
function enforceTableAndHeaderFooterLines(merged, ooxmlLines = [], audit = {}) {
  if (!ooxmlLines.length) return merged;
  const hasTables = (audit.tables || 0) > 0;
  const required = [];
  for (const line of ooxmlLines) {
    const norm = normalizeForRetention(line);
    if (!norm) continue;
    const isTableRow = /\|/.test(line) && hasTables;
    const isContact =
      /@/.test(line) ||
      /\+\d/.test(line) ||
      /linkedin|portfolio|github/i.test(line);
    if (isTableRow || isContact) required.push(line.trim());
  }
  if (!required.length) return merged;
  const mergedNorm = normalizeForRetention(merged);
  const missing = required.filter((line) => !mergedNorm.includes(normalizeForRetention(line)));
  if (!missing.length) return merged;
  return normalizeRawExtract(repairCompactWordBoundaries(`${merged}\n${missing.join('\n')}`));
}

function mammothInputFromBuffer(buffer) {
  if (typeof Buffer !== 'undefined') {
    return { buffer: Buffer.from(buffer) };
  }
  return { arrayBuffer: buffer };
}

/**
 * @param {ArrayBuffer|Buffer|Uint8Array} buffer
 * @param {object} [mammoth]
 */
export async function recoverDocxStructure(buffer, mammoth) {
  let mammothText = '';
  let mammothHtmlText = '';

  if (mammoth) {
    const input = mammothInputFromBuffer(buffer);
    try {
      const html = await mammoth.convertToHtml(input);
      mammothHtmlText = mammothHtmlToPlainText(html?.value || '');
    } catch {
      /* optional */
    }
    try {
      const raw = await mammoth.extractRawText(input);
      mammothText = repairCompactWordBoundaries(String(raw?.value || ''));
    } catch {
      /* optional */
    }
  }

  let ooxml = { text: '', lines: [], audit: {}, parts: [] };
  try {
    ooxml = await extractVisibleCorpusFromDocx(buffer);
  } catch (err) {
    console.warn('HIRELY DOCX OOXML recovery failed', err);
  }

  let merged = mergeDocxExtractions(ooxml.text, mammothHtmlText, mammothText);
  merged = enforceTableAndHeaderFooterLines(merged, ooxml.lines, ooxml.audit);

  if ((ooxml.audit?.tables || 0) > 0 && ooxml.text) {
    const ooxmlNorm = normalizeForRetention(ooxml.text);
    const mergedNorm = normalizeForRetention(merged);
    const tableTokens = ooxml.lines
      .filter((l) => /\|/.test(l))
      .flatMap((l) => normalizeForRetention(l).split(/\s+/))
      .filter((w) => w.length > 3);
    const missingTable = tableTokens.some((w) => !mergedNorm.includes(w));
    if (missingTable || mergedNorm.length < ooxmlNorm.length * 0.85) {
      merged = mergeDocxExtractions(ooxml.text, merged);
    }
  }

  const visibleBaseline = ooxml.text || mammothHtmlText || mammothText;
  const retention = measureDocxRetention(visibleBaseline, merged);

  return {
    text: normalizeRawExtract(merged),
    visibleText: visibleBaseline,
    mammothText,
    mammothHtmlText,
    ooxmlText: ooxml.text,
    retention,
    recoveryAudit: {
      version: DOCX_RECOVERY_VERSION,
      ...ooxml.audit,
    },
    parts: ooxml.parts,
    meetsRetentionTarget: retention.pct >= DOCX_RETENTION_TARGET_PCT,
  };
}

export function auditDocxStructureRecovery(result) {
  const a = result?.recoveryAudit || {};
  return {
    headers: (a.headers || 0) > 0,
    footers: (a.footers || 0) > 0,
    tables: (a.tables || 0) > 0,
    nestedTables: (a.nestedTables || 0) > 0,
    columns: (a.columns || 0) > 0,
    textboxes: (a.textboxes || 0) > 0,
    drawings: (a.drawings || 0) > 0,
    lists: (a.lists || 0) > 0,
    links: (a.links || 0) > 0,
    retentionPct: result?.retention?.pct ?? 0,
    meetsTarget: Boolean(result?.meetsRetentionTarget),
  };
}
