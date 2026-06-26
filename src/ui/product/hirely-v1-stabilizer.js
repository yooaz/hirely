/**
 * Hirely V1 Stabilizer — minimal safety layer for Import → Review → Style → Export.
 * Scope: no redesign, no new panels, no complex OCR. Ensures every usable text source
 * renders a readable CV and keeps the flow unblocked.
 */
(function (global) {
  'use strict';

  const MIN_RAW_TEXT = 100;
  const state = {
    rawText: '',
    cleanText: '',
    resume: null,
    hasCv: false,
    source: '',
  };

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[c]);
  }
  function xmlDecode(s) {
    const ta = document.createElement('textarea');
    ta.innerHTML = String(s || '');
    return ta.value;
  }

  function cleanText(text) {
    return String(text || '')
      .replace(/\r\n?/g, '\n')
      .replace(/\u00a0/g, ' ')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n[ \t]+/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
  function linesOf(text) {
    const normalized = cleanText(text)
      .replace(/\s+\|\s+/g, '\n')
      .replace(/\s+•\s+/g, '\n')
      .replace(/\b(EXPERIENCE|WORK EXPERIENCE|PROFESSIONAL EXPERIENCE|EXPÉRIENCE|EDUCATION|FORMATION|SKILLS|COMPÉTENCES|LANGUAGES|LANGUES|CLIENTS|PROFILE|PROFIL)\b/gi, '\n$1\n');
    return normalized
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
  }
  function firstMatch(text, re) {
    const m = String(text || '').match(re);
    return m ? m[0].trim() : '';
  }
  function detectName(lines) {
    for (const l of lines.slice(0, 12)) {
      const line = l.trim();
      if (line.length < 3 || line.length > 72) continue;
      if (/@|https?:|www\.|portfolio|facebook|instagram|tumblr|linkedin|behance|years old/i.test(line)) continue;
      if (/^(cv|resume|résumé|curriculum|profile|profil|experience|expérience|education|formation|skills|compétences)$/i.test(line)) continue;
      const words = line.match(/[A-Za-zÀ-ÿ]{2,}/g) || [];
      if (words.length >= 2 && words.length <= 5) return line;
    }
    const blob = lines.slice(0, 6).join(' ');
    const byCaps = blob.match(/\b([A-ZÀ-Ÿ][A-Za-zÀ-ÿ'’-]{2,}\s+[A-ZÀ-Ÿ][A-Za-zÀ-ÿ'’-]{2,})\b/);
    if (byCaps) return byCaps[1].trim();
    return 'Nom à vérifier';
  }
  function detectTitle(lines, name) {
    for (const l of lines.slice(0, 16)) {
      const line = cleanBulletLine(l);
      if (!line || line === name) continue;
      if (/@|https?:|www\.|portfolio|facebook|instagram|tumblr|behance|linkedin|years old/i.test(line)) continue;
      if (/^(profile|profil|experience|expérience|education|formation|skills|compétences|languages|langues)$/i.test(line)) continue;
      if (line.length >= 4 && line.length <= 90) return line;
    }
    const joined = lines.slice(0, 14).join(' ');
    const role = joined.match(/\b(Graphic Designer|Illustrator|Art Director|Product Designer|UX Designer|Creative Director|Designer|Développeur|Developer|Manager)\b/i);
    return role ? role[0] : 'Profil professionnel';
  }
  function sectionIndex(line) {
    const l = line.toLowerCase();
    if (/^(profile|profil|summary|résumé|resume|about|présentation)\b/.test(l)) return 'summary';
    if (/^(experience|expérience|employment|work|parcours|professionnel)\b/.test(l)) return 'experience';
    if (/^(education|formation|études|dipl[oô]mes)\b/.test(l)) return 'education';
    if (/^(skills|compétences|competences|expertise)\b/.test(l)) return 'skills';
    if (/^(tools|outils|software|logiciels)\b/.test(l)) return 'tools';
    if (/^(languages|langues)\b/.test(l)) return 'languages';
    if (/^(clients|references|références)\b/.test(l)) return 'clients';
    return '';
  }

  function fixJoinedWords(text) {
    return String(text || '')
      .replace(/([a-zà-ÿ])([A-ZÀ-Ÿ])/g, '$1 $2')
      .replace(/(\d{4})([A-Za-zÀ-ÿ])/g, '$1 $2')
      .replace(/([A-Za-zÀ-ÿ])(\d{4})/g, '$1 $2')
      .replace(/\b(Design|Designer|Illustrator|Illustrateur|Director|Manager|Internship|Intern|Agency|School|Communication|Visual|Product|Creation|Typography|Packaging|Portfolio|Facebook|Instagram|Tumblr|LANGUAGES|SKILLS|EDUCATION|EXPERIENCE)\b/g, ' $1 ')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/\s+([,.;:])/g, '$1')
      .trim();
  }

  function normalizeCvLines(text) {
    const raw = linesOf(text)
      .map(fixJoinedWords)
      .flatMap(splitLongCvLine)
      .map((l) => l.replace(/\s{2,}/g, ' ').trim())
      .filter(Boolean);
    return uniqueShort(raw, 220);
  }

  function cleanBulletLine(line) {
    return fixJoinedWords(line)
      .replace(/^[•\-\u2013\u2014*]\s*/, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  function compactParagraph(lines, max = 900) {
    return lines.map(cleanBulletLine).join(' ').replace(/\s{2,}/g, ' ').trim().slice(0, max);
  }



  function classifyExperienceLine(line) {
    const l = cleanBulletLine(line);
    if (!l) return null;
    const date = l.match(/\b(19|20)\d{2}\b(?:\s*[-–—]\s*(?:\b(19|20)\d{2}\b|present|présent|now|aujourd'hui))?/i)?.[0] || '';
    const cleaned = l.replace(/\s{2,}/g, ' ').trim();
    return { text: cleaned, date };
  }

  function splitLongCvLine(line) {
    const src = fixJoinedWords(line);
    const sectioned = src
      .replace(/\b(WORK EXPERIENCE|PROFESSIONAL EXPERIENCE|EXPERIENCE|EXPÉRIENCE|EDUCATION|FORMATION|SKILLS|COMPÉTENCES|LANGUAGES|LANGUES)\b/gi, '\n$1\n')
      .replace(/\s+-\s+/g, '\n')
      .replace(/\s+•\s+/g, '\n')
      .replace(/\s+\|\s+/g, '\n');
    return sectioned.split('\n').map((x) => x.trim()).filter(Boolean);
  }

  function uniqueShort(lines, limit = 40) {
    const seen = new Set();
    const out = [];
    for (const line of lines) {
      const clean = cleanBulletLine(line);
      const key = clean.toLowerCase();
      if (!clean || seen.has(key)) continue;
      seen.add(key);
      out.push(clean);
      if (out.length >= limit) break;
    }
    return out;
  }


  function parseResume(text) {
    const clean = cleanText(text);
    const lines = normalizeCvLines(clean);
    const name = detectName(lines);
    const title = detectTitle(lines, name);
    const email = firstMatch(clean, /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig);
    const phone = firstMatch(clean, /(?:\+\d{1,3}[\s.-]?)?(?:\(?\d{1,4}\)?[\s.-]?){3,}\d{2,}/g);
    const website = firstMatch(clean, /https?:\/\/[^\s]+|www\.[^\s]+|be\.net\/[^\s]+/ig);

    const buckets = { summary: [], experience: [], education: [], skills: [], tools: [], languages: [], clients: [], body: [] };
    let current = 'body';
    for (const original of lines) {
      const line = cleanBulletLine(original);
      if (!line || line === name || line === title || line === email || line === phone || line === website) continue;
      const key = sectionIndex(line);
      if (key) { current = key; continue; }
      buckets[current].push(line);
    }

    const body = buckets.body.filter((l) => {
      if (/^(portfolio|facebook|instagram|tumblr|behance|linkedin)\b/i.test(l)) return false;
      if (l.length > 145 && /portfolio|facebook|instagram|tumblr|behance/i.test(l)) return false;
      return true;
    });

    const summaryCandidates = buckets.summary.length ? buckets.summary : body.filter((l) => {
      if (/\b(19|20)\d{2}\b/.test(l)) return false;
      if (/^(freelance|intern|stage|education|formation|lisaa|créapole|creapole)/i.test(l)) return false;
      return l.length > 20;
    }).slice(0, 3);

    let expLines = buckets.experience.length ? buckets.experience : lines.filter((l) =>
      /\b(20\d{2}|19\d{2}|present|présent|freelance|designer|director|manager|intern|stage|client|nike|adobe|agency|illustrator)\b/i.test(l)
    );

    expLines = uniqueShort(expLines.map((l) => {
      const item = classifyExperienceLine(l);
      return item ? item.text : l;
    }), 18);

    const educationLines = uniqueShort((buckets.education.length ? buckets.education : lines.filter((l) =>
      /\b(lisaa|créapole|creapole|school|university|formation|education|degree|master|bachelor|visual communication|motion design)\b/i.test(l)
    )), 10);

    const skillPool = [...buckets.skills, ...buckets.tools];
    if (!skillPool.length) {
      skillPool.push(...lines.filter((l) => /illustrator|photoshop|indesign|after effects|figma|design|typography|branding|print|vector|motion|adobe|procreate|packaging/i.test(l)));
    }
    const skills = uniqueShort(
      skillPool.flatMap((l) => l.split(/[,;•|]/)).filter((l) => l.length < 70),
      24
    );

    const finalTitle = /portfolio|facebook|instagram|tumblr|behance/i.test(title) ? 'Graphic Designer & Illustrator' : title;

    return {
      identity: { name, title: finalTitle, email, phone, location: '', website, linkedin: firstMatch(clean, /linkedin\.com\/[^\s]+/ig) },
      summary: compactParagraph(summaryCandidates, 680) || 'Profil professionnel importé. Vérifiez les informations avant export.',
      experienceLines: expLines.slice(0, 24),
      educationLines,
      skills,
      languages: uniqueShort(buckets.languages, 12),
      clients: uniqueShort(buckets.clients, 20),
      rawText: clean,
    };
  }
  function renderResume(resume) {
    const id = resume.identity || {};
    const contacts = [id.email, id.phone, id.website, id.linkedin, id.location].filter(Boolean);
    const meta = contacts.map(esc).join(' · ');
    const expItems = resume.experienceLines?.length
      ? resume.experienceLines.map((l) => `<li>${esc(cleanBulletLine(l))}</li>`).join('')
      : `<li>Expérience à vérifier depuis le texte importé.</li>`;
    const edu = resume.educationLines?.length
      ? `<section class="cvSection"><h2 class="cvSectionTitle">Formation</h2><div class="cvSectionBody">${resume.educationLines.map((l) => `<p class="cvEduLine">${esc(cleanBulletLine(l))}</p>`).join('')}</div></section>`
      : '';
    const skills = resume.skills?.length
      ? `<section class="cvSection"><h2 class="cvSectionTitle">Compétences</h2><div class="cvSkills">${resume.skills.map((l) => `<span class="cvSkill">${esc(cleanBulletLine(l))}</span>`).join('')}</div></section>`
      : '';
    const languages = resume.languages?.length
      ? `<section class="cvSection"><h2 class="cvSectionTitle">Langues</h2><div class="cvSectionBody">${resume.languages.map((l) => `<p>${esc(cleanBulletLine(l))}</p>`).join('')}</div></section>`
      : '';
    return `
      <div class="cvInner hirelyV1CvInner">
        <header class="cvHead cvHeader">
          <div class="cvHeaderRule"></div>
          <h1 class="cvName">${esc(id.name || 'Nom à vérifier')}</h1>
          <p class="cvTitle">${esc(id.title || 'Profil professionnel')}</p>
          ${meta ? `<p class="cvContact">${meta}</p>` : '<p class="cvContact cvContact--missing">Contact à compléter</p>'}
        </header>
        <section class="cvSection"><h2 class="cvSectionTitle">Profil</h2><div class="cvSectionBody"><p>${esc(resume.summary || '')}</p></div></section>
        <section class="cvSection"><h2 class="cvSectionTitle">Expérience</h2><div class="cvSectionBody"><ul class="cvFallbackList">${expItems}</ul></div></section>
        ${edu}${skills}${languages}
      </div>`;
  }
  function unlockFlow() {
    const workspace = $('workspace');
    const grid = $('workspaceGrid');
    const app = $('app');
    const product = $('wsProduct');
    const preview = $('studioPreview');
    const cvPanel = $('cvPanel');
    const imp = $('wsImport');
    if (workspace) workspace.dataset.docStep = workspace.dataset.docStep || 'edit';
    if (grid) {
      grid.classList.add('workspaceGrid--ready');
      grid.classList.remove('workspaceGrid--cv-invalid', 'workspaceGrid--importing');
    }
    if (app) app.classList.add('app--workspace');
    if (product) { product.classList.add('wsProduct--ready'); product.style.display = 'flex'; }
    if (preview) preview.classList.remove('hidden');
    if (cvPanel) cvPanel.classList.remove('hidden');
    if (imp) {
      imp.classList.add('importPanel--imported', 'wsTools--ready');
      imp.classList.remove('wsImport--loading', 'wsImport--needsPaste');
    }
    ['resumeStudioHead', 'styleStepHead', 'exportStepHead'].forEach((id) => $(id)?.classList.add('hidden'));
    document.querySelectorAll('.hirelyProgressBtn').forEach((b) => { b.disabled = false; });
    const dl = $('downloadBtn');
    if (dl) dl.disabled = false;
    $('cvSkeleton')?.classList.add('hidden');
    $('progress')?.classList.add('hidden');
    $('importPasteFallback')?.classList.remove('show');
    $('importStatusWarn')?.classList.add('hidden');
    $('importLiveStatus') && ($('importLiveStatus').textContent = 'CV importé');
    global.__HIRELY_V1_STABLE_READY__ = true;
  }
  function forceReviewChrome() {
    const workspace = $('workspace');
    const grid = $('workspaceGrid');
    if (workspace) workspace.dataset.docStep = 'edit';
    if (grid) {
      grid.classList.remove('docStep-import', 'docStep-verify', 'docStep-style', 'docStep-export');
      grid.classList.add('docStep-edit', 'workspaceGrid--ready');
    }
    document.querySelectorAll('.hirelyProgressStep').forEach((li) => {
      const on = li.dataset.docStep === 'edit';
      li.classList.toggle('is-active', on);
      li.classList.toggle('is-complete', li.dataset.docStep === 'import');
    });
    document.querySelectorAll('.hirelyProgressBtn').forEach((b) => {
      b.disabled = false;
      b.removeAttribute('disabled');
      b.setAttribute('aria-disabled', 'false');
    });
    $('resumeStudioHead')?.classList.remove('hidden');
    $('studioPreview')?.classList.remove('hidden');
    $('cvPanel')?.classList.remove('hidden');
  }

  function setStep(step) {
    const next = step === 'verify' ? 'edit' : (step || 'edit');
    const workspace = $('workspace');
    const grid = $('workspaceGrid');
    if (workspace) workspace.dataset.docStep = next;
    if (grid) {
      grid.classList.remove('docStep-import', 'docStep-verify', 'docStep-edit', 'docStep-style', 'docStep-export');
      grid.classList.add('docStep-' + next, 'workspaceGrid--ready');
    }
    $('resumeStudioHead')?.classList.toggle('hidden', next !== 'edit');
    $('styleStepHead')?.classList.toggle('hidden', next !== 'style');
    $('exportStepHead')?.classList.toggle('hidden', next !== 'export');
    $('templatePickerBar')?.classList.toggle('hidden', next === 'export' ? false : false);
    $('cvExportBar')?.classList.toggle('hidden', next !== 'export');
    $('studioPreview')?.classList.remove('hidden');
    const doc = $('cvDoc');
    if (doc && state.resume) {
      doc.innerHTML = renderResume(state.resume);
      doc.className = (doc.className || 'cv cv-page') + ' cv--live hirely-v1-stable-cv';
    }
    unlockFlow();
    try { global.HirelyImportFlowV2?.syncDocStep?.(next); } catch {}
  }
  function importText(text, source = 'text') {
    const clean = cleanText(text);
    if (clean.length < MIN_RAW_TEXT) {
      showPasteFallback('Texte trop court. Collez le texte complet du CV pour continuer.');
      return false;
    }
    const resume = parseResume(clean);
    state.rawText = clean;
    state.cleanText = clean;
    state.resume = resume;
    state.hasCv = true;
    state.source = source;

    const doc = $('cvDoc');
    if (doc) {
      doc.innerHTML = renderResume(resume);
      doc.className = 'cv cv-page cv--live hirely-v1-stable-cv';
    }
    const cvText = $('cvText');
    if (cvText) cvText.value = clean;

    try {
      global.state = global.state || {};
      Object.assign(global.state, {
        rawText: clean,
        cleanText: clean,
        text: clean,
        generated: true,
        extractionConfirmed: true,
        pasteFlowComplete: true,
        lastImportStatus: 'IMPORT_READY',
        docStep: 'edit',
      });
    } catch {}

    unlockFlow();
    setStep('edit');
    setTimeout(forceReviewChrome, 80);
    setTimeout(forceReviewChrome, 350);
    setTimeout(forceReviewChrome, 1000);
    return true;
  }
  async function extractTxt(file) {
    return await file.text();
  }
  async function extractDocx(file) {
    try {
      const zipLib = global.JSZip || await global.HirelyLazy?.ensureJsZip?.();
      if (!zipLib) throw new Error('JSZip unavailable');
      const zip = await zipLib.loadAsync(await file.arrayBuffer());
      const doc = await zip.file('word/document.xml')?.async('string');
      if (!doc) throw new Error('document.xml missing');

      const paragraphs = doc
        .split(/<\/w:p>/i)
        .map((p) => {
          const parts = [];
          const re = /<w:t[^>]*>([\s\S]*?)<\/w:t>/gi;
          let m;
          while ((m = re.exec(p))) parts.push(xmlDecode(m[1]));
          return parts.join('').replace(/\s+/g, ' ').trim();
        })
        .filter(Boolean);

      if (paragraphs.length) return paragraphs.join('\n');

      const all = [];
      const re = /<w:t[^>]*>([\s\S]*?)<\/w:t>/gi;
      let m;
      while ((m = re.exec(doc))) all.push(xmlDecode(m[1]));
      return all.join('\n').trim();
    } catch (e) {
      console.warn('[Hirely V1 Stabilizer] DOCX extraction failed', e);
      return '';
    }
  }

  async function ensurePdfJsDirect() {
    if (global.pdfjsLib?.getDocument) return global.pdfjsLib;
    const candidates = [
      '/vendor/pdf.min.mjs',
      '/node_modules/pdfjs-dist/build/pdf.min.mjs',
      '/node_modules/pdfjs-dist/build/pdf.mjs'
    ];
    let lastError = null;
    for (const src of candidates) {
      try {
        const mod = await import(src);
        const pdfjs = mod?.default?.getDocument ? mod.default : mod;
        if (pdfjs?.GlobalWorkerOptions) {
          const workerUrl = new URL('/vendor/pdf.worker.min.mjs', global.location?.origin || window.location.origin).href;
          pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
          pdfjs.GlobalWorkerOptions.isEvalSupported = false;
          console.info('[Hirely PDF] worker configured', workerUrl);
        }
        global.pdfjsLib = pdfjs;
        console.info('[Hirely PDF] PDF.js loaded', src);
        return pdfjs;
      } catch (e) {
        lastError = e;
        console.warn('[Hirely PDF] PDF.js candidate failed', src, e);
      }
    }
    console.error('[Hirely PDF] PDF.js unavailable', lastError);
    return null;
  }

  async function extractPdfText(file) {
    try {
      const pdfjs = await ensurePdfJsDirect();
      if (!pdfjs?.getDocument) throw new Error('pdf.js unavailable');
      const data = new Uint8Array(await file.arrayBuffer());
      const loadingTask = pdfjs.getDocument({
        data,
        useWorkerFetch: false,
        isEvalSupported: false,
        stopAtErrors: false,
      });
      const pdf = await loadingTask.promise;
      const pages = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const items = content.items
          .map((it) => ({
            text: String(it.str || '').trim(),
            x: Number(it.transform?.[4]) || 0,
            y: Number(it.transform?.[5]) || 0,
          }))
          .filter((it) => it.text);
        items.sort((a, b) => Math.abs(b.y - a.y) > 3 ? b.y - a.y : a.x - b.x);
        const lines = [];
        for (const it of items) {
          const last = lines[lines.length - 1];
          if (!last || Math.abs(last.y - it.y) > 4) {
            lines.push({ y: it.y, parts: [it] });
          } else {
            last.parts.push(it);
          }
        }
        pages.push(lines.map((line) => {
          line.parts.sort((a, b) => a.x - b.x);
          let out = '';
          let prev = null;
          for (const part of line.parts) {
            const gap = prev ? part.x - prev.x : 0;
            if (out && gap > 10) out += ' ';
            out += part.text;
            prev = part;
          }
          return fixJoinedWords(out);
        }).filter(Boolean).join('\n'));
      }
      let extracted = pages.join('\n\n').trim();
      if (!extracted || extracted.length < MIN_RAW_TEXT) {
        // Fallback: some PDFs have broken coordinates but textContent still has strings.
        const rawPages = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent({ normalizeWhitespace: true, disableCombineTextItems: false });
          rawPages.push((content.items || []).map((it) => String(it.str || '').trim()).filter(Boolean).join(' '));
        }
        const rawExtracted = rawPages.join('\n\n').trim();
        if (rawExtracted.length > extracted.length) extracted = fixJoinedWords(rawExtracted);
      }
      if (!extracted || extracted.length < MIN_RAW_TEXT) {
        console.warn('[Hirely PDF] text too short; paste fallback', { chars: extracted.length, pages: pdf.numPages });
      } else {
        console.info('[Hirely PDF] extracted text', { chars: extracted.length, pages: pdf.numPages });
      }
      return extracted;
    } catch (e) {
      console.warn('[Hirely V1 Stabilizer] PDF text extraction failed', e);
      return '';
    }
  }
  function fileKind(file) {
    const name = String(file?.name || '').toLowerCase();
    const type = String(file?.type || '').toLowerCase();
    if (name.endsWith('.txt') || type.includes('text/plain')) return 'txt';
    if (name.endsWith('.docx') || type.includes('wordprocessingml')) return 'docx';
    if (name.endsWith('.pdf') || type.includes('pdf')) return 'pdf';
    return 'unknown';
  }
  async function handleFile(file) {
    if (!file) return false;
    $('fileName') && ($('fileName').textContent = file.name || '');
    $('importLiveStatus') && ($('importLiveStatus').textContent = 'Lecture du CV…');
    $('progress')?.classList.remove('hidden');
    let text = '';
    const kind = fileKind(file);
    if (kind === 'txt') text = await extractTxt(file);
    else if (kind === 'docx') text = await extractDocx(file);
    else if (kind === 'pdf') text = await extractPdfText(file);
    else text = '';

    if (cleanText(text).length >= MIN_RAW_TEXT) return importText(text, kind);
    if (kind === 'pdf') {
      showPasteFallback('PDF non lisible automatiquement. S’il est scanné/protégé, copiez-collez le texte du CV ci-dessous. Si c’est un PDF texte, exportez-le en TXT/DOCX ou essayez un autre PDF.');
      console.warn('[Hirely PDF] fallback requested for', file.name);
      return false;
    }
    showPasteFallback('Nous n’avons pas pu lire assez de texte. Collez le texte du CV ci-dessous pour continuer.');
    return false;
  }
  function showPasteFallback(message) {
    const panel = $('importPasteFallback');
    if (panel) {
      panel.classList.add('show');
      panel.classList.remove('hidden');
      const lead = $('importPasteFallbackLead');
      if (lead && message) lead.textContent = message;
      const title = $('importPasteFallbackTitle');
      if (title) title.textContent = 'Collez le texte de votre CV pour continuer';
      const ta = $('importPasteFallbackText');
      if (ta) setTimeout(() => ta.focus(), 50);
    }
    const imp = $('wsImport');
    if (imp) imp.classList.add('wsImport--needsPaste');
    $('progress')?.classList.add('hidden');
    $('importLiveStatus') && ($('importLiveStatus').textContent = 'Collez le texte pour continuer.');
  }
  function buildPdfBlob(text) {
    const safe = cleanText(text).split('\n').slice(0, 42).map((l) =>
      l.replace(/[\\()]/g, '\\$&').slice(0, 95)
    );
    const content = ['BT', '/F1 11 Tf', '50 790 Td'];
    safe.forEach((line, idx) => {
      if (idx > 0) content.push('0 -15 Td');
      content.push(`(${line || ' '}) Tj`);
    });
    content.push('ET');
    const stream = content.join('\n');
    const objects = [
      '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
      '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
      '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj',
      '4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
      `5 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream endobj`,
    ];
    let pdf = '%PDF-1.4\n';
    const xref = [0];
    for (const obj of objects) { xref.push(pdf.length); pdf += obj + '\n'; }
    const xrefStart = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (let i = 1; i < xref.length; i++) pdf += `${String(xref[i]).padStart(10, '0')} 00000 n \n`;
    pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
    return new Blob([pdf], { type: 'application/pdf' });
  }
  async function downloadPdf() {
    const doc = $('cvDoc');
    if (!state.hasCv && doc && (doc.innerText || '').trim().length > MIN_RAW_TEXT) {
      state.rawText = doc.innerText;
      state.cleanText = doc.innerText;
      state.hasCv = true;
    }
    const filename = 'hirely-cv.pdf';
    try {
      const html2pdf = global.html2pdf || await global.HirelyLazy?.ensureHtml2pdf?.();
      if (html2pdf && doc) {
        await html2pdf().set({
          margin: 0,
          filename,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        }).from(doc).save();
        return true;
      }
    } catch (e) {
      console.warn('[Hirely V1 Stabilizer] html2pdf fallback', e);
    }
    const blob = buildPdfBlob(state.cleanText || state.rawText || doc?.innerText || 'Hirely CV');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
    return true;
  }
  function bind() {
    const fileInput = $('fileInput');
    if (fileInput && !fileInput.__hirelyV1StableBound) {
      fileInput.__hirelyV1StableBound = true;
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        handleFile(file);
      }, true);
    }
    const drop = $('drop');
    if (drop && !drop.__hirelyV1StableBound) {
      drop.__hirelyV1StableBound = true;
      drop.addEventListener('click', () => fileInput?.click(), true);
      drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('drag'); }, true);
      drop.addEventListener('dragleave', () => drop.classList.remove('drag'), true);
      drop.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopImmediatePropagation();
        drop.classList.remove('drag');
        handleFile(e.dataTransfer?.files?.[0]);
      }, true);
    }
    const apply = $('importPasteFallbackApply');
    if (apply && !apply.__hirelyV1StableBound) {
      apply.__hirelyV1StableBound = true;
      apply.addEventListener('click', (e) => {
        const ta = $('importPasteFallbackText');
        const text = ta?.value || '';
        if (cleanText(text).length >= MIN_RAW_TEXT) {
          e.preventDefault();
          e.stopImmediatePropagation();
          importText(text, 'paste');
        }
      }, true);
    }
    document.querySelectorAll('.hirelyProgressBtn[data-doc-step]').forEach((btn) => {
      if (btn.__hirelyV1StableBound) return;
      btn.__hirelyV1StableBound = true;
      btn.addEventListener('click', (e) => {
        if (!state.hasCv && !global.__HIRELY_V1_STABLE_READY__) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        setStep(btn.dataset.docStep || 'edit');
      }, true);
    });
    const dl = $('downloadBtn');
    if (dl && !dl.__hirelyV1StableBound) {
      dl.__hirelyV1StableBound = true;
      dl.addEventListener('click', (e) => {
        if (!state.hasCv && !$('cvDoc')?.innerText) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        downloadPdf();
      }, true);
    }
    global.setDocStep = function patchedSetDocStep(step) {
      if (state.hasCv || global.__HIRELY_V1_STABLE_READY__) return setStep(step);
      return setStep(step);
    };
  }

  // Early document-level capture: runs before target listeners from the legacy import stack.
  if (!document.__hirelyV1StableEarlyChange) {
    document.__hirelyV1StableEarlyChange = true;
    document.addEventListener('change', (e) => {
      const target = e.target;
      if (!target || target.id !== 'fileInput') return;
      const file = target.files && target.files[0];
      if (!file) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      handleFile(file);
    }, true);
  }

  global.HirelyV1Stabilizer = { importText, handleFile, setStep, downloadPdf, parseResume };
  document.addEventListener('DOMContentLoaded', bind);
  setTimeout(bind, 500);
  setTimeout(bind, 1500);
})(window);
