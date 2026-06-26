/**
 * Shared Playwright harness — real index.html → HirelyParse.handleFileImport.
 */
import fs from 'fs';
import http from 'http';
import path from 'path';

export function startStaticServer(root, port) {
  const mime = (fp) =>
    ({
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.mjs': 'text/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.pdf': 'application/pdf',
      '.txt': 'text/plain',
      '.docx':
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    })[path.extname(fp).toLowerCase()] || 'application/octet-stream';

  const server = http.createServer((req, res) => {
    const u = req.url.split('?')[0];
    let p = u === '/' ? '/index.html' : u;
    const fp = path.join(root, decodeURIComponent(p));
    if (!fp.startsWith(root) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, { 'Content-Type': mime(fp) });
    fs.createReadStream(fp).pipe(res);
  });
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}

export async function waitImportDone(page, maxMs = 300000) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    const s = await page.evaluate(() => ({
      live: document.getElementById('cvDoc')?.classList.contains('cv--live'),
      busy: document.getElementById('wsImport')?.classList.contains('wsImport--loading'),
      fallback: document.getElementById('importPasteFallback')?.classList.contains('show'),
    }));
    if ((s.live || s.fallback) && !s.busy) return s;
    await page.waitForTimeout(500);
  }
  return { live: false, timeout: true };
}

export async function browserImportFile(page, filePath, source = 'live-upload-path') {
  const buf = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const type =
    ext === '.pdf'
      ? 'application/pdf'
      : ext === '.docx'
        ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        : 'text/plain';
  await page.evaluate(
    async ({ b64, name, mimeType, src }) => {
      const bin = atob(b64);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      const file = new File([arr], name, { type: mimeType });
      await window.HirelyParse.handleFileImport(file, src);
    },
    { b64: buf.toString('base64'), name: path.basename(filePath), mimeType: type, src: source }
  );
}

export function collectLiveSnap(page) {
  return page.evaluate(() => {
    const lr = window.HirelyParse?.lastResult || {};
    const rd = lr.resumeData || null;
    const cvDoc = document.getElementById('cvDoc');
    const cvText = cvDoc?.innerText || '';
    const cvClass = cvDoc?.className || '';
    const correctionEl = cvDoc?.querySelector('.cvEmptyState--correction');
    const correctionState =
      !!correctionEl ||
      cvDoc?.classList.contains('cvEmptyState--correction') ||
      /cvEmptyState--correction/.test(cvClass) ||
      /cvRecoveryIssueList/.test(cvDoc?.innerHTML || '');
    const recoveryPanel = document.getElementById('extractionRecoveryPanel');
    const panelHasContent = (recoveryPanel?.innerHTML || '').trim().length > 60;
    const uiFlow = window.__HIRELY_UI_FLOW__ || null;
    const recoveryPanelVisible =
      (!!recoveryPanel && !recoveryPanel.classList.contains('hidden') && panelHasContent) ||
      !!(uiFlow?.recoveryPanelVisible && panelHasContent);
    return {
      cvLive: cvDoc?.classList.contains('cv--live'),
      cvClass,
      correctionState,
      recoveryPanelVisible,
      uiFlow,
      recoveryDebug: window.__HIRELY_EXTRACTION_RECOVERY_DEBUG__ || null,
      pasteFallback: document.getElementById('importPasteFallback')?.classList.contains('show'),
      cvText,
      extractionRuntime: window.__HIRELY_LAST_EXTRACTION_RUNTIME__ || null,
      importDebug: lr.importDebug || null,
      identity: rd?.identity || {},
      summary: rd?.summary || '',
      education: rd?.education || [],
      experiences: rd?.experiences || [],
      meta: rd?.meta || {},
      counts: {
        experiences: (rd?.experiences || []).length,
        education: (rd?.education || []).length,
        skills: (rd?.skills || []).length,
        tools: (rd?.tools || []).length,
      },
      hasResumeData: !!rd,
    };
  });
}

export function educationDuplicateCount(education = []) {
  const norm = education.map((e) =>
    String(e || '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim()
  );
  return norm.length - new Set(norm.filter(Boolean)).size;
}

export function experienceLinesInCvText(cvText) {
  const block =
    cvText.split(/EXPÉRIENCES|EXPERIENCE/i)[1]?.split(/FORMATION|EDUCATION|COMPÉTENCES|SKILLS/i)[0] ||
    cvText;
  return block
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 8 && /\b(19|20)\d{2}\b/.test(l)).length;
}

const UNDETECTED = /information non détectée/i;
const PLACEHOLDER_NAME = /nom à vérifier|nom à confirmer/i;

/**
 * Universal assertions for real UI upload path.
 * @param {'structured'|'preview'} [opts.mode] — structured = resumeData SSOT (PDF/OCR bridge); preview = cvDoc text (TXT simple import)
 */
export function assertLiveUploadCriteria(snap, opts = {}) {
  const failures = [];
  const pass = (cond, msg) => {
    if (!cond) failures.push(msg);
  };

  const mode = opts.mode || (snap.meta?.blockParserBridgeApplied ? 'structured' : 'preview');
  const cvText = snap.cvText || '';
  const name = snap.identity?.name || '';
  const email = snap.identity?.email || '';
  const phone = snap.identity?.phone || '';
  const hasContact = !!(email || phone);
  const cvNameLine = cvText.split('\n').map((l) => l.trim()).find((l) => l.length > 2) || '';

  pass(snap.cvLive || cvText.length > 200 || snap.correctionState, 'cvDoc live, has content, or correction state');
  pass(!snap.pasteFallback, 'no paste fallback');
  if (!snap.correctionState) {
    pass(
      !PLACEHOLDER_NAME.test(name) && !PLACEHOLDER_NAME.test(cvText) && !PLACEHOLDER_NAME.test(cvNameLine),
      'no "Nom à vérifier" in identity or cvDoc'
    );
  } else {
    pass(!/cv--raw-fallback/.test(snap.cvClass || ''), 'correction state: not raw-fallback premium');
  }
  if (hasContact || /@/.test(cvText)) {
    pass(!UNDETECTED.test(cvText), 'no "Information non détectée" in cvDoc when contact exists');
    pass(!UNDETECTED.test(name), 'no undetected label as name when contact exists');
    pass(!UNDETECTED.test(snap.identity?.title || ''), 'no undetected label as title when contact exists');
  }

  const expInPreview = experienceLinesInCvText(cvText);
  if (mode === 'structured') {
    pass(snap.counts.experiences > 1, `more than one experience in resumeData (got ${snap.counts.experiences})`);
    pass(
      expInPreview > 1 || snap.counts.experiences > 1,
      `more than one experience visible (preview=${expInPreview}, data=${snap.counts.experiences})`
    );
    pass(educationDuplicateCount(snap.education) === 0, `no duplicated education (dup=${educationDuplicateCount(snap.education)})`);
  } else {
    const expBlock = /experience/i.test(cvText);
    pass(expInPreview >= 1 || expBlock, `experience content in cvDoc (dated lines=${expInPreview})`);
    pass(!PLACEHOLDER_NAME.test(cvText), 'preview mode: no placeholder name in cvDoc');
  }

  for (const m of opts.portfolioMarkers || []) {
    pass(!cvText.toLowerCase().includes(m), `no portfolio leakage in cvDoc: ${m}`);
    pass(!(snap.summary || '').toLowerCase().includes(m), `no portfolio in summary: ${m}`);
  }

  if (opts.requireSpatialBridge) {
    pass(snap.importDebug?.import_path_winner === 'spatial_bridge', `bridge wins (got ${snap.importDebug?.import_path_winner})`);
    pass(snap.meta?.blockParserBridgeApplied === true, 'blockParserBridgeApplied on resumeData');
    pass(snap.meta?.flatRepairSkipped === true, 'flatRepairSkipped on resumeData');
    pass(snap.importDebug?.spatial_parse_input === true, 'spatial_parse_input in importDebug');
  }

  if (mode === 'structured') {
    pass(!/cv--raw-fallback/.test(snap.cvClass || ''), 'not raw-fallback preview class');
  }

  return { pass: failures.length === 0, failures };
}
