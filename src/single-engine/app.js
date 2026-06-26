
const MIN_TEXT = 80;
const $ = (id) => document.getElementById(id);

const state = {
  step: "import",
  rawText: "",
  resume: null,
  template: "modern",
  fileName: "",
};

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}

function stripXmlArtifacts(text) {
  return String(text || "")
    .replace(/<\?xml[\s\S]*?\?>/gi, " ")
    .replace(/<\/w:p>/gi, "\n")
    .replace(/<w:br\s*\/?>/gi, "\n")
    .replace(/<w:tab\s*\/?>/gi, " ")
    .replace(/<\/w:t>/gi, " ")
    .replace(/<w:t[^>]*>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\bxml:space\s*=\s*["']?preserve["']?/gi, " ")
    .replace(/\b(?:w|r|mc|wp|a|pic|wps|v|o):[a-z0-9_.-]+\b/gi, " ");
}

function normalizeCvText(text) {
  return stripXmlArtifacts(text)
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, " ")
    .replace(/[“”]/g, '"')
    .replace(/[’]/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isGarbageLine(line) {
  const l = String(line || "").trim();
  if (!l) return true;
  if (/[<>]|xml:space|<\/?w:|<\/?r:|preserve/i.test(l)) return true;
  if (/^(style|font|span|div|body|html|xml|relationship|document)$/i.test(l)) return true;
  return false;
}

function cleanText(text) {
  return normalizeCvText(text);
}

function xmlDecode(s) {
  const ta = document.createElement("textarea");
  ta.innerHTML = String(s || "");
  return ta.value;
}

function fixJoinedWords(text) {
  return String(text || "")
    .replace(/([a-zà-ÿ])([A-ZÀ-Ÿ])/g, "$1 $2")
    .replace(/(\d{4})([A-Za-zÀ-ÿ])/g, "$1 $2")
    .replace(/([A-Za-zÀ-ÿ])(\d{4})/g, "$1 $2")
    .replace(/\b(Profile|Profil|Experience|Expérience|Education|Formation|Skills|Compétences|Languages|Langues|Clients|Portfolio|Freelance|Designer|Illustrator|Director|Manager|Internship|Agency|School|Communication|Visual|Product|Creation|Typography|Packaging)\b/g, " $1 ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([,.;:])/g, "$1")
    .trim();
}

function splitLines(text) {
  return cleanText(text)
    .replace(/\s+\|\s+/g, "\n")
    .replace(/\s+•\s+/g, "\n")
    .replace(/\b(WORK EXPERIENCE|PROFESSIONAL EXPERIENCE|EXPERIENCE|EXPÉRIENCE|EDUCATION|FORMATION|SKILLS|COMPÉTENCES|LANGUAGES|LANGUES|CLIENTS|PROFILE|PROFIL)\b/gi, "\n$1\n")
    .split("\n")
    .map((l) => fixJoinedWords(normalizeCvText(l)).trim())
    .filter((l) => l && !isGarbageLine(l));
}

function unique(lines, limit = 50) {
  const seen = new Set();
  const out = [];
  for (const line of lines) {
    const clean = line.replace(/^[•\-–—*]\s*/, "").trim();
    const key = clean.toLowerCase();
    if (!clean || seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
    if (out.length >= limit) break;
  }
  return out;
}

function sectionKey(line) {
  const l = line.toLowerCase();
  if (/^(profile|profil|summary|résumé|about)\b/.test(l)) return "summary";
  if (/^(experience|expérience|work experience|professional experience|employment|parcours)\b/.test(l)) return "experience";
  if (/^(education|formation|études|dipl[oô]mes)\b/.test(l)) return "education";
  if (/^(skills|compétences|competences|expertise)\b/.test(l)) return "skills";
  if (/^(tools|outils|software|logiciels)\b/.test(l)) return "skills";
  if (/^(languages|langues)\b/.test(l)) return "languages";
  if (/^(clients|references|références)\b/.test(l)) return "clients";
  return "";
}

function firstMatch(text, re) {
  const m = String(text || "").match(re);
  return m ? m[0].trim() : "";
}

function detectName(lines) {
  for (const line of lines.slice(0, 14)) {
    if (line.length < 3 || line.length > 75) continue;
    if (/@|https?:|www\.|portfolio|facebook|instagram|tumblr|behance|linkedin|years old/i.test(line)) continue;
    if (/^(cv|resume|résumé|curriculum|profile|profil|experience|expérience|education|formation|skills|compétences)$/i.test(line)) continue;
    const words = line.match(/[A-Za-zÀ-ÿ]{2,}/g) || [];
    if (words.length >= 2 && words.length <= 5) return line;
  }
  return "Nom à vérifier";
}

function detectTitle(lines, name) {
  for (const line of lines.slice(0, 16)) {
    if (!line || line === name) continue;
    if (/@|https?:|www\.|portfolio|facebook|instagram|tumblr|behance|linkedin|years old/i.test(line)) continue;
    if (/^(profile|profil|experience|expérience|education|formation|skills|compétences|languages|langues)$/i.test(line)) continue;
    if (line.length >= 4 && line.length <= 92) return line;
  }
  const joined = lines.slice(0, 16).join(" ");
  const role = joined.match(/\b(Graphic Designer|Illustrator|Art Director|Product Designer|UX Designer|Creative Director|Designer|Developer|Manager)\b/i);
  return role ? role[0] : "Profil professionnel";
}

function parseResume(text) {
  const raw = normalizeCvText(text);
  const lines = unique(splitLines(raw), 240);
  const name = detectName(lines);
  const title = detectTitle(lines, name);
  const email = firstMatch(raw, /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig);
  const phone = firstMatch(raw, /(?:\+\d{1,3}[\s.-]?)?(?:\(?\d{1,4}\)?[\s.-]?){3,}\d{2,}/g);
  const website = firstMatch(raw, /https?:\/\/[^\s]+|www\.[^\s]+|be\.net\/[^\s]+/ig);
  const linkedin = firstMatch(raw, /linkedin\.com\/[^\s]+/ig);

  const buckets = { summary: [], experience: [], education: [], skills: [], languages: [], clients: [], body: [] };
  let current = "body";
  for (const original of lines) {
    const line = original.replace(/^[•\-–—*]\s*/, "").trim();
    if (!line || line === name || line === title || line === email || line === phone || line === website || line === linkedin) continue;
    const key = sectionKey(line);
    if (key) { current = key; continue; }
    buckets[current].push(line);
  }

  const body = buckets.body.filter((l) => {
    if (/^(portfolio|facebook|instagram|tumblr|behance|linkedin)\b/i.test(l)) return false;
    if (l.length > 150 && /portfolio|facebook|instagram|tumblr|behance/i.test(l)) return false;
    return true;
  });

  const summary = (buckets.summary.length ? buckets.summary : body.filter((l) => {
    if (/\b(19|20)\d{2}\b/.test(l)) return false;
    if (/^(freelance|intern|stage|education|formation|lisaa|créapole|creapole)/i.test(l)) return false;
    return l.length > 18;
  }).slice(0, 3)).join(" ").slice(0, 750) || "Profil professionnel importé. Vérifiez les informations avant export.";

  let experience = buckets.experience.length ? buckets.experience : lines.filter((l) =>
    /\b(20\d{2}|19\d{2}|present|présent|freelance|designer|director|manager|intern|stage|client|nike|adobe|agency|illustrator)\b/i.test(l)
  );
  experience = unique(experience, 20);

  let education = buckets.education.length ? buckets.education : lines.filter((l) =>
    /\b(lisaa|créapole|creapole|school|university|formation|education|degree|master|bachelor|visual communication|motion design)\b/i.test(l)
  );
  education = unique(education, 10);

  let skills = buckets.skills.length ? buckets.skills.flatMap((l) => l.split(/[,;•|]/)) : lines.filter((l) =>
    /illustrator|photoshop|indesign|after effects|figma|design|typography|branding|print|vector|motion|adobe|procreate|packaging|logo|digital art/i.test(l)
  );
  skills = unique(skills.map(normalizeCvText).filter((l) => l.length < 70 && !isGarbageLine(l)), 24);

  return {
    name,
    title: /portfolio|facebook|instagram|tumblr|behance/i.test(title) ? "Graphic Designer & Illustrator" : title,
    email,
    phone,
    website,
    linkedin,
    summary,
    experience,
    education,
    skills,
    languages: unique(buckets.languages, 12),
    clients: unique(buckets.clients, 18),
    raw,
  };
}

async function loadScript(src) {
  if (document.querySelector(`script[src="${src}"]`)) return;
  await new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function ensureJsZip() {
  if (window.JSZip) return window.JSZip;
  await loadScript("/vendor/jszip.min.js");
  if (!window.JSZip) throw new Error("JSZip unavailable");
  return window.JSZip;
}

async function ensurePdfJs() {
  if (window.pdfjsLib?.getDocument) return window.pdfjsLib;
  const mod = await import("/vendor/pdf.min.mjs");
  const pdfjs = mod?.default?.getDocument ? mod.default : mod;
  const workerUrl = new URL("/vendor/pdf.worker.min.mjs", window.location.origin).href;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  pdfjs.GlobalWorkerOptions.isEvalSupported = false;
  window.pdfjsLib = pdfjs;
  console.info("[Hirely Single Engine] PDF.js ready", workerUrl);
  return pdfjs;
}

async function extractTxt(file) {
  return await file.text();
}

async function extractDocx(file) {
  const JSZip = await ensureJsZip();
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const doc = await zip.file("word/document.xml")?.async("string");
  if (!doc) throw new Error("DOCX document.xml missing");

  const paragraphs = doc.split(/<\/w:p>/i).map((p) => {
    const block = p
      .replace(/<w:tab\s*\/?>/gi, " ")
      .replace(/<w:br\s*\/?>/gi, "\n");
    const parts = [];
    const re = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/gi;
    let m;
    while ((m = re.exec(block))) parts.push(xmlDecode(m[1]));
    return normalizeCvText(parts.join(" "));
  }).filter((p) => p && !isGarbageLine(p));

  return normalizeCvText(paragraphs.join("\n"));
}

async function ensureTesseract() {
  if (window.Tesseract?.recognize) return window.Tesseract;
  await loadScript("/vendor/tesseract/tesseract.min.js");
  if (!window.Tesseract?.recognize) throw new Error("Tesseract unavailable");
  return window.Tesseract;
}

async function ocrPdfPage(page, pageIndex) {
  const Tesseract = await ensureTesseract();
  const viewport = page.getViewport({ scale: 2.35 });
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { alpha: false });
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  const result = await Tesseract.recognize(canvas, "fra+eng", {
    workerPath: "/vendor/tesseract/worker.min.js",
    corePath: "/vendor/tesseract/core/tesseract-core-simd-lstm.wasm.js",
    langPath: "/vendor/tesseract/lang/",
    logger: (m) => {
      if (m?.status) console.info("[Hirely OCR]", pageIndex, m.status, m.progress || "");
    },
  });
  return normalizeCvText(result?.data?.text || "");
}

async function extractPdf(file) {
  const pdfjs = await ensurePdfJs();
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
    const content = await page.getTextContent({ normalizeWhitespace: true, disableCombineTextItems: false });
    const items = (content.items || []).map((it) => ({
      text: normalizeCvText(it.str || ""),
      x: Number(it.transform?.[4]) || 0,
      y: Number(it.transform?.[5]) || 0,
      w: Number(it.width) || 0,
      h: Number(it.height) || 0,
      eol: it.hasEOL === true,
    })).filter((it) => it.text && !isGarbageLine(it.text));

    items.sort((a, b) => Math.abs(b.y - a.y) > 3 ? b.y - a.y : a.x - b.x);
    const lines = [];
    for (const it of items) {
      const last = lines[lines.length - 1];
      const tolerance = Math.max(3.5, Math.min(8, it.h * 0.55 || 4));
      if (!last || Math.abs(last.y - it.y) > tolerance) lines.push({ y: it.y, parts: [it] });
      else last.parts.push(it);
    }

    const pageText = lines.map((line) => {
      line.parts.sort((a, b) => a.x - b.x);
      let out = "";
      let prev = null;
      for (const p of line.parts) {
        if (!prev) out += p.text;
        else {
          const gap = p.x - (prev.x + prev.w);
          const needsSpace =
            gap > 2.4 ||
            prev.eol ||
            /[a-zA-ZÀ-ÿ0-9]$/.test(out) && /^[a-zA-ZÀ-ÿ0-9]/.test(p.text);
          out += (needsSpace ? " " : "") + p.text;
        }
        prev = p;
      }
      return fixJoinedWords(normalizeCvText(out));
    }).filter((line) => line && !isGarbageLine(line)).join("\n");

    pages.push(pageText);
  }

  let extracted = normalizeCvText(pages.join("\n\n"));
  console.info("[Hirely Single Engine] PDF extracted", { chars: extracted.length, pages: pdf.numPages });

  if (extracted.length < MIN_TEXT) {
    setStatus("PDF sans texte fiable — OCR local en cours…");
    const ocrPages = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      ocrPages.push(await ocrPdfPage(page, i));
    }
    const ocrText = normalizeCvText(ocrPages.join("\n\n"));
    console.info("[Hirely Single Engine] PDF OCR extracted", { chars: ocrText.length, pages: pdf.numPages });
    if (ocrText.length > extracted.length) extracted = ocrText;
  }

  return normalizeCvText(extracted);
}

function fileKind(file) {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  if (name.endsWith(".txt") || type.includes("text/plain")) return "txt";
  if (name.endsWith(".docx") || type.includes("wordprocessingml")) return "docx";
  if (name.endsWith(".pdf") || type.includes("pdf")) return "pdf";
  return "unknown";
}

async function handleFile(file) {
  if (!file) return;
  state.fileName = file.name;
  setStatus(`Lecture de ${file.name}…`);
  hidePaste();

  try {
    const kind = fileKind(file);
    let text = "";
    if (kind === "txt") text = await extractTxt(file);
    else if (kind === "docx") text = await extractDocx(file);
    else if (kind === "pdf") text = await extractPdf(file);
    else throw new Error("Format non supporté");

    text = cleanText(text);
    if (text.length < MIN_TEXT) {
      showPaste(kind === "pdf"
        ? "Ce PDF semble scanné/protégé ou ne contient pas de texte sélectionnable. Collez le texte du CV ci-dessous."
        : "Texte trop court. Collez le texte complet du CV ci-dessous.");
      setStatus("Texte insuffisant, collage demandé.");
      return;
    }
    importText(text);
  } catch (err) {
    console.error("[Hirely Single Engine] import failed", err);
    showPaste("Import automatique impossible. Collez le texte du CV ci-dessous pour continuer.");
    setStatus("Import automatique impossible.");
  }
}

function importText(text) {
  const clean = cleanText(text);
  if (clean.length < MIN_TEXT) {
    setStatus("Texte trop court.");
    return;
  }
  state.rawText = clean;
  state.resume = parseResume(clean);
  hidePaste();
  setStep("review");
  renderAll();
  setStatus("CV importé. Vérifiez puis choisissez un modèle.");
}

function renderCv() {
  const r = state.resume;
  if (!r) return "";
  const contact = [r.email, r.phone, r.website, r.linkedin].filter(Boolean).map(esc).join(" · ");
  const exp = r.experience.length ? r.experience : ["Expérience à vérifier depuis le texte importé."];
  return `
    <div class="cvInner">
      <header class="cvHead">
        <div class="cvHeaderRule"></div>
        <h1 class="cvName">${esc(r.name)}</h1>
        <p class="cvTitle">${esc(r.title)}</p>
        <p class="cvContact">${contact || "Contact à compléter"}</p>
      </header>
      <div class="cvGrid">
        <main>
          <section class="cvSection">
            <h2 class="cvSectionTitle">Profil</h2>
            <p>${esc(r.summary)}</p>
          </section>
          <section class="cvSection">
            <h2 class="cvSectionTitle">Expérience</h2>
            <ul>${exp.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
          </section>
          ${r.education.length ? `<section class="cvSection"><h2 class="cvSectionTitle">Formation</h2>${r.education.map((x) => `<p>${esc(x)}</p>`).join("")}</section>` : ""}
        </main>
        <aside>
          ${r.skills.length ? `<section class="cvSection"><h2 class="cvSectionTitle">Compétences</h2><div class="skillList">${r.skills.map((x) => `<span class="skill">${esc(x)}</span>`).join("")}</div></section>` : ""}
          ${r.languages.length ? `<section class="cvSection"><h2 class="cvSectionTitle">Langues</h2>${r.languages.map((x) => `<p>${esc(x)}</p>`).join("")}</section>` : ""}
          ${r.clients.length ? `<section class="cvSection"><h2 class="cvSectionTitle">Clients</h2>${r.clients.map((x) => `<p>${esc(x)}</p>`).join("")}</section>` : ""}
        </aside>
      </div>
    </div>`;
}

function renderReview() {
  const r = state.resume;
  if (!r) return "";
  const rows = [
    ["Nom", r.name],
    ["Titre", r.title],
    ["Contact", [r.email, r.phone, r.website].filter(Boolean).join(" · ") || "À compléter"],
    ["Expériences", `${r.experience.length} lignes`],
    ["Formation", `${r.education.length} lignes`],
    ["Skills", `${r.skills.length} éléments`],
  ];
  return rows.map(([k, v]) => `<div class="reviewItem"><b>${esc(k)}</b><span>${esc(v)}</span></div>`).join("");
}

function renderAll() {
  if (state.resume) hidePaste();
  document.body.className = `template-${state.template}`;
  $("cvPage").innerHTML = state.resume ? renderCv() : "";
  $("reviewList").innerHTML = state.resume ? renderReview() : "";
  $("workspace").classList.toggle("show", state.step !== "import");
  $("importCard").style.display = state.step === "import" ? "block" : "none";
  $("templates").classList.toggle("show", state.step === "style");
  $("exportBox").classList.toggle("show", state.step === "export");
  document.querySelectorAll(".template").forEach((b) => b.classList.toggle("active", b.dataset.template === state.template));
}

function setStep(step) {
  if (step !== "import" && !state.resume) return;
  state.step = step;
  document.querySelectorAll(".step").forEach((el) => {
    const s = el.dataset.step;
    el.classList.toggle("active", s === step);
    el.classList.toggle("done", ["import", "review", "style", "export"].indexOf(s) < ["import", "review", "style", "export"].indexOf(step));
  });
  renderAll();
}

function showPaste(message) {
  if (state.resume) return;
  $("pastePanel").classList.add("show");
  $("pasteMessage").textContent = message;
  $("pasteText").focus();
}

function hidePaste() {
  $("pastePanel").classList.remove("show");
}

function setStatus(msg) {
  $("status").textContent = msg || "";
}

async function downloadPdf() {
  if (!state.resume) return;
  setStatus("Préparation du PDF…");
  try {
    if (!window.html2pdf) await loadScript("/vendor/html2pdf.bundle.min.js");
    await window.html2pdf().set({
      margin: 0,
      filename: `${(state.resume.name || "cv").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-hirely.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    }).from($("cvPage")).save();
    setStatus("PDF téléchargé.");
  } catch (err) {
    console.error("[Hirely Single Engine] PDF export failed", err);
    window.print();
    setStatus("Export PDF via impression navigateur.");
  }
}

function init() {
  $("fileInput").addEventListener("change", (e) => handleFile(e.target.files?.[0]));
  $("drop").addEventListener("click", () => $("fileInput").click());
  $("drop").addEventListener("dragover", (e) => { e.preventDefault(); $("drop").classList.add("drag"); });
  $("drop").addEventListener("dragleave", () => $("drop").classList.remove("drag"));
  $("drop").addEventListener("drop", (e) => {
    e.preventDefault();
    $("drop").classList.remove("drag");
    handleFile(e.dataTransfer?.files?.[0]);
  });
  $("pasteBtn").addEventListener("click", () => importText($("pasteText").value));
  $("tryOther").addEventListener("click", hidePaste);
  $("downloadBtn").addEventListener("click", downloadPdf);
  document.querySelectorAll(".step").forEach((b) => b.addEventListener("click", () => setStep(b.dataset.step)));
  document.querySelectorAll(".template").forEach((b) => b.addEventListener("click", () => {
    state.template = b.dataset.template;
    renderAll();
  }));
  renderAll();
}
document.addEventListener("DOMContentLoaded", init);
