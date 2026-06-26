/* Hirely UX P3 — 5 premium CV templates (render-only, same finalResumeData, no parser/OCR/ATS). */
(function (global) {
  function init(deps) {
    const { esc, sectionLabel, cvBlock, cvSkillsHtml, getPhotoHtml } = deps;

    /** Photo slot when UI provides getPhotoHtml (optional photo CV export). */
    function photoSlot() {
      return typeof getPhotoHtml === 'function' ? getPhotoHtml() : '';
    }

    /** User-reorderable CV sections (Pro). */
    const DEFAULT_SECTION_ORDER = Object.freeze([
      'summary',
      'experience',
      'clients',
      'projects',
      'education',
      'skills',
      'tools',
      'languages',
      'portfolio',
    ]);

    function normalizeSectionOrderKey(key) {
      const k = String(key || '').toLowerCase();
      if (k === 'experiences' || k === 'experience') return 'experience';
      if (k === 'profile') return 'summary';
      if (k === 'software') return 'tools';
      return k;
    }

    function isSectionHidden(p, key) {
      const hidden = p?.sectionHidden || p?._sectionHidden;
      if (!hidden || typeof hidden !== 'object') return false;
      return !!hidden[normalizeSectionOrderKey(key)];
    }

    function resolveSectionOrder(p) {
      const raw = p?.sectionOrder || p?._sectionOrder;
      if (!Array.isArray(raw) || !raw.length) return DEFAULT_SECTION_ORDER.slice();
      const seen = new Set();
      const out = [];
      for (const item of raw) {
        const key = normalizeSectionOrderKey(item);
        if (!DEFAULT_SECTION_ORDER.includes(key) || seen.has(key)) continue;
        if (isSectionHidden(p, key)) continue;
        seen.add(key);
        out.push(key);
      }
      for (const key of DEFAULT_SECTION_ORDER) {
        if (!seen.has(key) && !isSectionHidden(p, key)) out.push(key);
      }
      return out;
    }

    function removeHiddenSectionsFromHtml(html, p) {
      const blocks = extractCvSectionBlocks(html);
      if (!blocks.length) return html;
      let out = String(html);
      for (const block of blocks) {
        const key = classifySectionBlock(block);
        if (key && isSectionHidden(p, key)) out = out.replace(block, '');
      }
      return out;
    }

    function classifySectionBlock(sectionHtml) {
      const slugs = [...String(sectionHtml || '').matchAll(/cvSection--([a-z0-9-]+)/gi)].map((m) => m[1]);
      for (const slug of slugs) {
        if (slug === 'executive-summary' || slug === 'swiss-summary' || slug.startsWith('summary')) return 'summary';
        if (slug === 'leadership' || slug === 'startup-impact' || slug.includes('experience') || slug.includes('timeline')) {
          return 'experience';
        }
        if (slug === 'software') return 'tools';
        if (DEFAULT_SECTION_ORDER.includes(slug)) return slug;
      }
      return null;
    }

    function extractCvSectionBlocks(html) {
      const re = /<section class="cvSection[^>]*>[\s\S]*?<\/section>/gi;
      return String(html || '').match(re) || [];
    }

    /** Reorder reorderable sections inside each layout column when possible. */
    function applySectionOrderToHtml(html, order) {
      if (!html || !order?.length) return html;
      const orderIndex = new Map(order.map((k, i) => [k, i]));
      const columnRe =
        /(<(?:main|div|aside)\s+class="[^"]*(?:cvMain|cvEmCol|cvSwissCol|cvSbCol|cvVtMain|cvAdpMain|cvTsMain|cvAgMain|cvCcMain|cvCcSide|cvMkCred|cvMkCases)[^"]*"[^>]*>)([\s\S]*?)(<\/(?:main|div|aside)>)/gi;
      return String(html).replace(columnRe, (_match, open, body, close) => {
        const blocks = extractCvSectionBlocks(body);
        if (blocks.length < 2) return open + body + close;

        const classified = blocks.map((block) => ({ block, key: classifySectionBlock(block) }));
        const reorderable = classified
          .filter((c) => c.key && orderIndex.has(c.key))
          .sort((a, b) => (orderIndex.get(a.key) ?? 99) - (orderIndex.get(b.key) ?? 99));
        if (reorderable.length < 2) return open + body + close;

        let ri = 0;
        const rebuilt = classified.map((c) => {
          if (c.key && orderIndex.has(c.key)) return reorderable[ri++].block;
          return c.block;
        });

        let nextBody = body;
        for (let i = 0; i < blocks.length; i++) {
          nextBody = nextBody.replace(blocks[i], rebuilt[i]);
        }
        return open + nextBody + close;
      });
    }

    function stackFromSectionOrder(p, builders, auxBuilders = []) {
      const order = resolveSectionOrder(p);
      const parts = [];
      for (const key of order) {
        if (isSectionHidden(p, key)) continue;
        if (!builders[key]) continue;
        const html = builders[key]();
        if (html) parts.push(html);
      }
      for (const fn of auxBuilders) {
        const html = typeof fn === 'function' ? fn() : fn;
        if (html) parts.push(html);
      }
      return parts.filter(Boolean);
    }

    const TEMPLATE_BLOCKED_RE = [
      /à\s+confirmer/i,
      /^information non détectée$/i,
      /^(nom|poste|company|entreprise|role|rôle|date)\s+à\s+confirmer$/i,
      /missing\s+experience/i,
      /low\s+confidence/i,
      /confidence\s*[:\s]*\d{1,3}\s*%/i,
      /needs?\s+review/i,
      /à\s+relire/i,
      /to\s+review/i,
      /unknown\s+experience/i,
      /unsorted_career/i,
      /experience_uncertain/i,
      /exportable_fallback/i,
      /\[body\]|\[header\]|\[footer\]|\[name\]|\[email\]/i,
      /^\s*(debug|parser|pipeline|ocr|classification)\b/i,
      /lorem\s+ipsum|asdf|qwerty/i,
    ];

    const OCR_FRAGMENT_RE =
      /[\uFFFD]|[|¦‖§¶†‡•◦▪▫■□]{3,}|@@@|###|[^\x20-\x7E\u00C0-\u024F\s.,:;()\-/'&+@]{8,}/;

    const OCR_TAG_RE =
      /^(music|reading|ben|product design|graphic design|illustration|typography|branding|vector|print|logo|lea|adobe|packaging|movies?|nature|drawing|sketching)$/i;

    const PARTIAL_OCR_RE = /\b\d{1,2}[-\s]?year\s*old\b/i;

    const SECTION_LABEL_ONLY_RE =
      /^(clients?|experiences?|experience|expériences?|education|formation|summary|profile|profil|skills?|tools?|languages?|langues?|projects?|projets?|identity|identité|market reviews)$/i;

    function isTemplateBlockedText(text) {
      const s = String(text || '').trim();
      if (!s) return true;
      if (SECTION_LABEL_ONLY_RE.test(s)) return true;
      return TEMPLATE_BLOCKED_RE.some((re) => re.test(s));
    }

    function isTemplateSafeLine(line) {
      const s = String(line || '').trim();
      if (!s || s.length < 3) return false;
      if (isTemplateBlockedText(s)) return false;
      if (OCR_FRAGMENT_RE.test(s)) return false;
      if (/^[\s•·\-–—|,.;:]+$/.test(s)) return false;
      if (s.length < 24 && !/\b(19|20)\d{2}\b/.test(s) && !/@/.test(s) && !/\b(PM|CEO|CTO|Director|Manager|Designer)\b/i.test(s)) {
        if (/^\d[\d\s().+-]{6,}$/.test(s)) return false;
      }
      return true;
    }

    function isCareerLine(line) {
      const l = String(line || '').trim();
      if (!isTemplateSafeLine(l)) return false;
      if (l.length < 12) return false;
      if (/@|https?:\/\//i.test(l)) return false;
      if (/^(email|phone|linkedin|portfolio|skills?|tools?|education|formation|languages?|langues|clients?|contact|profil|profile|summary|resume|cv|experience|expériences?)\b/i.test(l)) return false;
      return true;
    }

    function linesFromRaw(raw) {
      return String(raw || '')
        .split(/\n+/)
        .map((l) => l.replace(/^[\s•\-–—*]+/, '').trim())
        .filter((l) => l.length > 8);
    }

    function toClassifyTexts(p) {
      const seen = new Set();
      const out = [];
      for (const raw of p.toClassify || []) {
        const t = String(typeof raw === 'string' ? raw : raw?.text || '').trim();
        if (!t || !isTemplateSafeLine(t)) continue;
        const key = t.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(t);
      }
      for (const t of p.unknownExperience || []) {
        const line = String(t || '').trim();
        if (!line || !isTemplateSafeLine(line)) continue;
        const key = line.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(line);
      }
      return out.slice(0, 24);
    }

    function filterRenderableList(items) {
      return (items || [])
        .map((x) => fieldRenderable(x, 'line'))
        .filter(Boolean);
    }

    function experiencesFromStructured(structured) {
      if (!structured || typeof structured !== 'object') return [];
      const out = [];
      for (const e of structured.experiences || []) {
        if (typeof e === 'string') {
          const line = fieldRenderable(e, 'line');
          if (line) out.push(line);
          continue;
        }
        const dates = String(e.dates || e.dateRange || '').trim();
        const headRaw = [e.role, e.company, dates]
          .map((x) => String(x || '').trim())
          .filter(Boolean)
          .join(' — ');
        const head = fieldRenderable(headRaw, 'line');
        const rewritten = fieldRenderable(e.rewrittenDescription || e.description || '', 'line');
        const bullets = rewritten
          ? [rewritten]
          : (e.bullets || []).map((b) => fieldRenderable(b, 'line')).filter(Boolean);
        const specialties = (e.specialties || [])
          .map((s) => fieldRenderable(s, 'line'))
          .filter(Boolean);
        if (specialties.length && (e.role || e.company)) {
          out.push({
            role: fieldRenderable(e.role, 'line') || '',
            company: fieldRenderable(e.company, 'line') || '',
            dates,
            specialties,
            bullets,
            description: rewritten || '',
            result: fieldRenderable(e.result, 'line'),
            revenue: fieldRenderable(e.revenue, 'line'),
            teamSize: fieldRenderable(e.teamSize || e.team, 'line'),
            achievement: fieldRenderable(e.achievement, 'line'),
            impact: e.impact,
          });
        } else if (head && bullets.length) out.push(`${head}: ${bullets.join(' · ')}`);
        else if (head) out.push(head);
        else if (bullets.length) out.push(bullets.slice(0, 2).join(' · '));
      }
      return out.filter((x, i, a) => a.indexOf(x) === i);
    }

    let _renderFromFinalResume = false;

    function isFinalResumeRenderInput(p) {
      return !!(
        p &&
        (p._fromFinalResumeData === true ||
          p._fromResumeData === true ||
          p._templateIsolation === true ||
          p._templateMeta?.source === 'resumeData')
      );
    }

    function isTemplateIsolationInput(p) {
      return !!(
        p &&
        (p._templateIsolation === true ||
          p._templateMeta?.isolation ||
          (p._fromResumeData === true &&
            (typeof globalThis === 'undefined' || globalThis.HIRELY_TEMPLATE_ISOLATION !== false)))
      );
    }

    function productionTemplateMode() {
      return (
        typeof document === 'undefined' ||
        !document.documentElement.classList.contains('debug-mode')
      );
    }

    function sanitizeTitleField(val) {
      let title = fieldRenderable(val, 'title');
      if (!title) return '';
      if (
        /\b(print|logo|vector|illustration|reading|typography|branding|digital art)\b/i.test(title) &&
        !/\b(designer|director|manager|lead|illustrator|developer|consultant|graphic)\b/i.test(title)
      ) {
        return '';
      }
      return title;
    }

    function mergeStructuredResume(src, safe) {
      const s = src.structuredResume;
      if (!s || typeof s !== 'object') return safe;
      const id = s.identity || {};
      if (!safe.name && id.name) safe.name = fieldRenderable(id.name, 'name');
      if (!safe.title && id.title) safe.title = sanitizeTitleField(id.title);
      if (!safe.email && id.email) safe.email = fieldRenderable(id.email, 'email');
      if (!safe.phone && id.phone) safe.phone = fieldRenderable(id.phone, 'phone');
      if (!safe.location && id.location) safe.location = fieldRenderable(id.location, 'line');
      if (!safe.linkedin && id.linkedin) safe.linkedin = fieldRenderable(id.linkedin, 'url');
      if (!safe.portfolio && (id.website || id.portfolio)) {
        safe.portfolio = fieldRenderable(id.website || id.portfolio, 'url');
      }
      if (!safe.summary && s.summary) safe.summary = fieldRenderable(s.summary, 'summary');
      const structExp = experiencesFromStructured(s);
      if (structExp.length && (!safe.experience || !safe.experience.length)) {
        safe.experience = structExp;
      }
      const fillIfEmpty = (key, list) => {
        const cur = safe[key] || [];
        if (cur.length) return;
        const incoming = filterRenderableList(list);
        if (incoming.length) safe[key] = incoming;
      };
      fillIfEmpty('education', s.education);
      fillIfEmpty('skills', s.skills);
      fillIfEmpty('tools', s.tools);
      fillIfEmpty('languages', s.languages);
      fillIfEmpty('clients', s.clients);
      fillIfEmpty('projects', s.projects);
      fillIfEmpty('exhibitions', s.exhibitions);
      fillIfEmpty('awards', s.awards);
      fillIfEmpty('publications', s.publications);
      fillIfEmpty('portfolioLinks', s.portfolioLinks);
      if (!productionTemplateMode()) {
        const acceptedUnsorted = filterRenderableList(s.unsorted);
        if (acceptedUnsorted.length) {
          safe.unsorted = acceptedUnsorted.slice(0, 12);
        }
      } else {
        safe.unsorted = [];
        safe.toClassify = [];
        safe.unknownExperience = [];
      }
      return safe;
    }

    function buildExperienceFallback(p) {
      const exp = filterRenderableList(p.experience);
      const toClassify = toClassifyTexts(p);
      if (exp.length) return { experience: exp, toClassify, fallback: false };
      if (toClassify.length) return { experience: [], toClassify, fallback: true };
      return { experience: [], toClassify: [], fallback: false };
    }

    function projectsSectionTitle() {
      const t = sectionLabel('projects');
      return t && t !== 'projects' ? t : 'Projects / Selected Work';
    }

    const SECTION_CONF_MIN = 70;

    function fieldRenderable(val, kind) {
      const s = String(val || '').trim();
      if (!s || isTemplateBlockedText(s)) return '';
      if (productionTemplateMode()) {
        if (kind === 'name' && (s.length < 2 || s.length > 80)) return '';
        if (kind === 'title' && (s.length < 2 || s.length > 72)) return '';
        if (kind === 'client' && s.length < 2) return '';
        return s;
      }
      if (!_renderFromFinalResume) {
        if (OCR_TAG_RE.test(s)) return '';
        if (PARTIAL_OCR_RE.test(s)) return '';
        if (kind === 'name' && /^(ben|music|reading)$/i.test(s)) return '';
        if (kind === 'title' && OCR_TAG_RE.test(s)) return '';
      }
      if (kind === 'line' && !isTemplateSafeLine(s)) return '';
      if (/\b(v3\s*2|gradric|mustrator|illusthatch)\b/i.test(s)) return '';
      if (/@/.test(s) && kind !== 'email') return '';
      if (/https?:\/\//i.test(s) && kind !== 'url') return '';
      if (kind === 'summary' && (s.length < 24 || /^[\W\d\s]+$/.test(s))) return '';
      if (kind === 'title' && (s.length < 3 || s.length > 72)) return '';
      if (kind === 'name' && (s.length < 2 || s.length > 80)) return '';
      if (kind === 'name' && (/(?:\b[A-Za-z]\s+){6,}/.test(s) || s.split(/\s+/).filter((w) => w.length === 1).length >= 6)) {
        return '';
      }
      if (kind === 'client' && s.length < 2) return '';
      if (kind === 'line' && s.length < 8 && !/^(adobe|figma|xd|css|html)$/i.test(s)) return '';
      return s;
    }

    function sectionConfidenceOk(p, key) {
      if (isTemplateIsolationInput(p)) return true;
      const conf = p?.sectionConfidence?.[key];
      if (conf == null || conf === undefined) return true;
      if (conf === 0) return true;
      return conf >= SECTION_CONF_MIN;
    }

    function sectionHeldForReview(p, key) {
      if (isTemplateIsolationInput(p)) return false;
      const held = p?._heldSections || [];
      return held.includes(key);
    }

    function filterSectionByConfidence(p, key, items) {
      const list = (items || []).filter(Boolean);
      if (!list.length) return [];
      if (productionTemplateMode() || _renderFromFinalResume || isTemplateIsolationInput(p)) return list;
      if (sectionHeldForReview(p, key)) return [];
      if (!sectionConfidenceOk(p, key)) return [];
      return list;
    }

    const UNDETECTED_LABEL = 'Information non détectée';
    const ID_NAME_PLACEHOLDER = 'Nom à confirmer';
    const ID_EMAIL_PLACEHOLDER = 'Email à confirmer';
    const ID_PHONE_PLACEHOLDER = 'Téléphone à confirmer';
    const ID_TITLE_PLACEHOLDER = 'Poste à compléter';
    const LEGACY_UNCERTAIN = new Set([
      ID_NAME_PLACEHOLDER,
      ID_EMAIL_PLACEHOLDER,
      ID_PHONE_PLACEHOLDER,
      'Nom à compléter',
      ID_TITLE_PLACEHOLDER,
      'Name to confirm',
      'Title to confirm',
      UNDETECTED_LABEL,
    ]);

    function isUncertainLabel(val, kind) {
      const s = String(val || '').trim();
      if (!s) return true;
      if (LEGACY_UNCERTAIN.has(s)) return true;
      if (kind === 'title' && s === ID_TITLE_PLACEHOLDER) return true;
      return false;
    }

    function identityPlaceholdersEnabled() {
      // Missing fields stay empty in production — never inject confirm labels into CV output.
      if (productionTemplateMode() || _renderFromFinalResume) return false;
      return !!(
        typeof document !== 'undefined' &&
        document.documentElement.classList.contains('hirely-identity-hints')
      );
    }

    function isRenderableEmail(email) {
      const e = String(email || '').trim().replace(/\s+/g, '');
      if (!e || isUncertainLabel(e, 'email')) return false;
      return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(e);
    }

    function nameCollidesWithEmployers(name, src) {
      const n = String(name || '').trim().toLowerCase();
      if (!n || n.length < 2) return false;
      const exp = src.experiences || src.experience || [];
      for (const e of exp) {
        let company = '';
        if (e && typeof e === 'object') company = String(e.company || '').trim();
        else if (typeof e === 'string') company = String(e.split(/[—–-]/)[1] || '').trim();
        const co = company.toLowerCase();
        if (!co) continue;
        if (co === n) return true;
        if (co.split(/[,&]/).some((part) => part.trim().toLowerCase() === n)) return true;
      }
      return /\b(inc|llc|ltd|gmbh|sarl|sas|sa|ag|corp|corporation|studio|studios|agency|agencies|group|holdings?|impressions|partners)\b/i.test(
        n
      );
    }

    function identityNameHtml(p) {
      const name = fieldRenderable(p.name, 'name');
      if (name && !isUncertainLabel(name, 'name')) {
        return `<div class="cvName" contenteditable>${esc(name)}</div>`;
      }
      if (!identityPlaceholdersEnabled()) return '';
      return `<div class="cvName cvName--placeholder" contenteditable>${esc(ID_NAME_PLACEHOLDER)}</div>`;
    }

    function identityTitleHtml(p) {
      const title = sanitizeTitleField(p.title);
      if (title && !isUncertainLabel(title, 'title')) {
        return `<div class="cvTitle" contenteditable>${esc(title)}</div>`;
      }
      if (!identityPlaceholdersEnabled()) return '';
      return `<div class="cvTitle cvTitle--placeholder" contenteditable>${esc(ID_TITLE_PLACEHOLDER)}</div>`;
    }

    function normalizeProfile(p) {
      const src = p || {};
      _renderFromFinalResume = isFinalResumeRenderInput(src);
      let name = fieldRenderable(src.name, 'name');
      let title = sanitizeTitleField(src.title);
      if (isUncertainLabel(name, 'name')) name = '';
      if (isUncertainLabel(title, 'title')) title = '';
      if (name && /^(ben|music|reading)$/i.test(name)) name = '';
      if (name && nameCollidesWithEmployers(name, src)) name = '';
      let email = fieldRenderable(src.email, 'email');
      if (email && (productionTemplateMode() || _renderFromFinalResume) && !isRenderableEmail(email)) {
        email = '';
      }
      const safe = {
        name,
        title,
        email,
        phone: fieldRenderable(src.phone, 'phone'),
        linkedin: fieldRenderable(src.linkedin, 'url'),
        portfolio: fieldRenderable(src.portfolio, 'url'),
        location: fieldRenderable(src.location, 'line'),
        summary: fieldRenderable(src.summary, 'summary'),
        experience: filterSectionByConfidence(
          src,
          'experience',
          (src.experience || []).map((x) => fieldRenderable(x, 'line')).filter(Boolean)
        ),
        unknownExperience: (src.unknownExperience || []).slice(0, 24),
        education: filterSectionByConfidence(
          src,
          'education',
          (src.education || []).map((x) => fieldRenderable(x, 'line')).filter(Boolean)
        ),
        skills: filterSectionByConfidence(
          src,
          'skills',
          (src.skills || []).map((x) => fieldRenderable(x, 'line')).filter(Boolean)
        ),
        tools: filterSectionByConfidence(
          src,
          'tools',
          (src.tools || []).map((x) => fieldRenderable(x, 'line')).filter(Boolean)
        ),
        languages: filterSectionByConfidence(
          src,
          'languages',
          (src.languages || []).map((x) => fieldRenderable(x, 'line')).filter(Boolean)
        ),
        clients: filterSectionByConfidence(
          src,
          'clients',
          (src.clients || []).map((x) => fieldRenderable(x, 'client')).filter(Boolean)
        ),
        clientLogos: Array.isArray(src.clientLogos) ? src.clientLogos.slice(0, 24) : [],
        projects: filterSectionByConfidence(
          src,
          'projects',
          (src.projects || []).map((x) => fieldRenderable(x, 'line')).filter(Boolean)
        ),
        portfolioLinks: filterSectionByConfidence(
          src,
          'portfolioLinks',
          (src.portfolioLinks || []).map((x) => fieldRenderable(x, 'url')).filter(Boolean)
        ),
        exhibitions: filterSectionByConfidence(
          src,
          'exhibitions',
          (src.exhibitions || []).map((x) => fieldRenderable(x, 'line')).filter(Boolean)
        ),
        awards: filterSectionByConfidence(
          src,
          'awards',
          (src.awards || []).map((x) => fieldRenderable(x, 'line')).filter(Boolean)
        ),
        achievements: filterSectionByConfidence(
          src,
          'achievements',
          (src.achievements || []).map((x) => fieldRenderable(x, 'line')).filter(Boolean)
        ),
        publications: filterSectionByConfidence(
          src,
          'publications',
          (src.publications || []).map((x) => fieldRenderable(x, 'line')).filter(Boolean)
        ),
        press: filterSectionByConfidence(
          src,
          'press',
          (src.press || []).map((x) => fieldRenderable(x, 'line')).filter(Boolean)
        ),
        unsorted: filterRenderableList(src.unsorted),
        toClassify: (src.toClassify || []).slice(0, 48),
        extra: [],
        raw: '',
        cleanText: '',
      };
      mergeStructuredResume(src, safe);
      const structSource = (src.experiences || []).length
        ? src.experiences
        : (src.experience || []).some((x) => x && typeof x === 'object')
          ? src.experience
          : [];
      if (structSource.length) {
        const structExp = experiencesFromStructured({ experiences: structSource });
        if (structExp.length) safe.experience = structExp;
        if (Array.isArray(src.experiences) && src.experiences.length) {
          safe.experiences = src.experiences;
        }
      }
      if (
        !productionTemplateMode() &&
        !isFinalResumeRenderInput(src) &&
        !isTemplateIsolationInput(src) &&
        (sectionHeldForReview(safe, 'summary') || !sectionConfidenceOk(src, 'summary'))
      ) {
        safe.summary = '';
      }
      const fb = buildExperienceFallback(safe);
      safe.experience = fb.experience;
      safe.toClassify = fb.toClassify;
      safe.unknownExperience = [];
      safe.unsorted = filterRenderableList(safe.unsorted);
      if (!safe.name && !safe.title && src.name) safe.name = fieldRenderable(src.name, 'name');
      if (Array.isArray(src._pendingReview) && src._pendingReview.length) {
        safe._pendingReview = src._pendingReview;
      }
      if (Array.isArray(src.sectionOrder) && src.sectionOrder.length) {
        safe.sectionOrder = resolveSectionOrder({ sectionOrder: src.sectionOrder, sectionHidden: src.sectionHidden });
      } else if (Array.isArray(src._sectionOrder) && src._sectionOrder.length) {
        safe.sectionOrder = resolveSectionOrder({ sectionOrder: src._sectionOrder, sectionHidden: src.sectionHidden });
      }
      if (src.sectionHidden && typeof src.sectionHidden === 'object') {
        safe.sectionHidden = { ...src.sectionHidden };
      }
      return safe;
    }

    function contactField(val, kind, placeholder) {
      const rendered = fieldRenderable(val, kind);
      if (rendered && !isUncertainLabel(rendered, kind)) return rendered;
      if (!identityPlaceholdersEnabled()) return '';
      return placeholder;
    }

    function contactParts(p) {
      return [
        contactField(p.location, 'line', ''),
        contactField(p.email, 'email', ID_EMAIL_PLACEHOLDER),
        contactField(p.phone, 'phone', ID_PHONE_PLACEHOLDER),
        fieldRenderable(p.portfolio, 'url'),
        fieldRenderable(p.linkedin, 'url'),
      ].filter(Boolean);
    }

    function contact(p, sep) {
      return contactParts(p).map(esc).join(sep || ' · ');
    }

    function cvLead(p) {
      if (!p.summary) return '';
      return `<p class="cvLead" contenteditable>${esc(p.summary)}</p>`;
    }

    function headClassic(p, extra, mod, o) {
      const c = contact(p);
      const lead = o && o.summaryInHead ? cvLead(p) : '';
      const m = mod ? ` ${mod}` : '';
      return `<header class="cvHead${m}">${photoSlot()}${extra || ''}${identityNameHtml(p)}${identityTitleHtml(p)}${lead}${c ? `<div class="cvContact"><p contenteditable>${c}</p></div>` : ''}</header>`;
    }

    function headGrid(p, extra, o) {
      const c = contact(p, '<br>');
      const lead = o && o.summaryInHead ? cvLead(p) : '';
      return `<header class="cvHead cvHead--grid">${photoSlot()}${extra || ''}<div class="cvHeadPrimary">${identityNameHtml(p)}${identityTitleHtml(p)}${lead}</div>${c ? `<div class="cvHeadMeta"><div class="cvContact"><p contenteditable>${c}</p></div></div>` : ''}</header>`;
    }

    function headCentered(p, extra, o, mod) {
      const c = contact(p);
      const lead = o && o.summaryInHead ? cvLead(p) : '';
      const m = mod ? ` ${mod}` : '';
      return `<header class="cvHead cvHead--center${m}">${photoSlot()}${extra || ''}${identityNameHtml(p)}${identityTitleHtml(p)}${lead}${c ? `<div class="cvContact"><p contenteditable>${c}</p></div>` : ''}</header>`;
    }

    function headSplit(p, o, mod) {
      const lead = o && o.summaryInHead ? cvLead(p) : '';
      const c = contact(p, '<br>');
      const m = mod ? ` ${mod}` : '';
      return `<header class="cvHead cvHead--split${m}">${photoSlot()}<div class="cvHeadSplitMain">${identityNameHtml(p)}${identityTitleHtml(p)}${lead}</div>${c ? `<div class="cvHeadSplitAside"><div class="cvContact"><p contenteditable>${c}</p></div></div>` : ''}</header>`;
    }

    function countPopulatedSectionsForDensity(p) {
      if (!p || typeof p !== 'object') return 0;
      let n = 0;
      if (p.name || p.title || p.email || p.phone || p.location) n += 1;
      if (p.summary) n += 1;
      if ((p.experience || []).length) n += 1;
      if ((p.education || []).length) n += 1;
      if ((p.skills || []).length) n += 1;
      if ((p.tools || []).length) n += 1;
      if ((p.languages || []).length) n += 1;
      if ((p.clients || []).length) n += 1;
      if ((p.projects || []).length) n += 1;
      return n;
    }

    let _densityProfile = null;

    /** Keep in sync with template-density.mjs DENSITY_MIN_SECTIONS_FOR_FILLED */
    const DENSITY_FILLED_THRESHOLD = 4;

    function wrap(tplId, layoutClass, html) {
      const sec = _densityProfile ? countPopulatedSectionsForDensity(_densityProfile) : 0;
      const density = sec >= DENSITY_FILLED_THRESHOLD ? 'cvDensity--filled' : 'cvDensity--sparse';
      const dataAttr = sec ? ` data-section-count="${sec}"` : '';
      return `<div class="cvInner cvLayout-professional ${layoutClass} cvTpl-${tplId} cvTpl-h20-${tplId} ${density}"${dataAttr}>${html}</div>`;
    }

    /** P2 — V2 families skip shared professional baseline for structural differentiation. */
    function wrapV2(tplId, layoutClass, html) {
      const sec = _densityProfile ? countPopulatedSectionsForDensity(_densityProfile) : 0;
      const density = sec >= DENSITY_FILLED_THRESHOLD ? 'cvDensity--filled' : 'cvDensity--sparse';
      const dataAttr = sec ? ` data-section-count="${sec}"` : '';
      return `<div class="cvInner cvLayout-v2 ${layoutClass} cvTpl-${tplId} cvTpl-v2-${tplId} ${density}"${dataAttr}>${html}</div>`;
    }

    function wrapV3(tplId, layoutClass, html) {
      const sec = _densityProfile ? countPopulatedSectionsForDensity(_densityProfile) : 0;
      const density = sec >= DENSITY_FILLED_THRESHOLD ? 'cvDensity--filled' : 'cvDensity--sparse';
      const dataAttr = sec ? ` data-section-count="${sec}"` : '';
      return `<div class="cvInner cvLayout-v2 cvLayout-v3 ${layoutClass} cvTpl-${tplId} cvTpl-v2-${tplId} cvTpl-v3-${tplId} ${density}"${dataAttr}>${html}</div>`;
    }

    function summarySection(p) {
      if (!p.summary) return '';
      const label = sectionLabel('profile');
      const title = label && label !== 'profile' ? label : 'Summary';
      return `<section class="cvSection cvSection--summary"><h3 class="cvSectionTitle">${esc(title)}</h3><div class="cvSectionBody"><p contenteditable>${esc(p.summary)}</p></div></section>`;
    }

    function normalizeCvDash(text) {
      return String(text || '').replace(/[\u2010-\u2015\u2212–—]/g, '-');
    }

    function formatStructuredExperienceHtml(e) {
      const rows = [];
      const role = String(e.role || '').trim();
      const company = String(e.company || '').trim();
      const dates = String(e.dates || '').trim();
      const specialties = Array.isArray(e.specialties) ? e.specialties.filter(Boolean) : [];
      const desc = String(e.rewrittenDescription || e.description || '').trim();
      const bullets = (e.bullets || []).map((b) => String(b || '').trim()).filter(Boolean);
      const bulletItems = bullets.length ? bullets : desc ? [desc] : [];

      if (role) rows.push(`<p class="cvExpRole" contenteditable>${esc(role)}</p>`);
      if (company) rows.push(`<p class="cvExpCompany" contenteditable>${esc(company)}</p>`);
      if (dates) rows.push(`<p class="cvExpDates" contenteditable>${esc(dates)}</p>`);
      if (specialties.length) {
        rows.push(`<p class="cvExpSpecialties" contenteditable>${esc(specialties.join(' · '))}</p>`);
      }
      for (const b of bulletItems) rows.push(`<p class="cvExpBullet" contenteditable>${esc(b)}</p>`);
      if (!rows.length) return '';
      return `<div class="cvExpEntry cvExpEntry--stacked">${rows.join('')}</div>`;
    }

    function formatExperienceEntryHtml(line) {
      if (line && typeof line === 'object' && (line.role || line.company || (line.specialties || []).length)) {
        return formatStructuredExperienceHtml(line);
      }
      const s = normalizeCvDash(String(line || '').trim());
      if (!s) return '';
      let bullets = [];
      let head = s;
      const colonIdx = s.lastIndexOf(':');
      if (colonIdx > 0) {
        const before = s.slice(0, colonIdx).trim();
        const after = s.slice(colonIdx + 1).trim();
        if (after && before.includes('—')) {
          head = before;
          bullets = after.split(/\s*·\s*/).map((b) => b.trim()).filter(Boolean);
        }
      }
      const parts = head.split(/\s*—\s*/).map((p) => p.trim()).filter(Boolean);
      const rows = [];
      if (parts[0]) rows.push(`<p class="cvExpRole" contenteditable>${esc(parts[0])}</p>`);
      if (parts[1]) rows.push(`<p class="cvExpCompany" contenteditable>${esc(parts[1])}</p>`);
      if (parts[2]) rows.push(`<p class="cvExpDates" contenteditable>${esc(parts[2])}</p>`);
      for (const b of bullets) rows.push(`<p class="cvExpBullet" contenteditable>${esc(b)}</p>`);
      if (!rows.length) rows.push(`<p contenteditable>${esc(s)}</p>`);
      return `<div class="cvExpEntry cvExpEntry--stacked">${rows.join('')}</div>`;
    }

    function experienceHtml(p, density) {
      if (!p.experience || !p.experience.length) return '';
      const dens = density ? ` cvExpList--${density}` : '';
      return `<div class="cvExpList${dens}">${p.experience.map((x) => formatExperienceEntryHtml(x)).join('')}</div>`;
    }

    function classificationPendingSection(p) {
      if (productionTemplateMode()) return '';
      const rawCount =
        (p.unsorted || []).length + (p.toClassify || []).length + (p.unknownExperience || []).length;
      if (!rawCount) return '';
      const title =
        sectionLabel('toClassify') !== 'toClassify' ? sectionLabel('toClassify') : 'À classer';
      const body = `<p class="cvPendingClassify">${rawCount} élément(s) importé(s) — ouvrez <strong>Éditer</strong> pour les placer dans les sections.</p>`;
      return `<section class="cvSection cvSection--pending"><h3 class="cvSectionTitle">${esc(title)}</h3><div class="cvSectionBody">${body}</div></section>`;
    }

    function pendingReviewSection(p) {
      if (productionTemplateMode()) return '';
      const items = (p._pendingReview || []).filter(
        (it) => it && String(it.detected || '').trim() && (it.status == null || it.status === 'pending')
      );
      if (!items.length) return '';
      const title =
        sectionLabel('pendingReview') !== 'pendingReview' ? sectionLabel('pendingReview') : 'À vérifier';
      const body = items
        .slice(0, 12)
        .map((it) => {
          const line = String(it.detected || '').trim().slice(0, 220);
          const field = String(it.field || it.detectedType || 'unknown')
            .replace(/^identity\./, '')
            .trim();
          return `<div class="cvPendingReviewEntry"><span class="cvPendingReviewField">${esc(field)}</span><p contenteditable>${esc(line)}</p></div>`;
        })
        .join('');
      return `<section class="cvSection cvSection--pendingReview"><h3 class="cvSectionTitle">${esc(title)}</h3><div class="cvSectionBody"><div class="cvPendingReviewList">${body}</div></div></section>`;
    }

    function toClassifySection(p) {
      if (productionTemplateMode()) return '';
      const all = toClassifyTexts(p);
      if (!all.length) return '';
      const title =
        sectionLabel('toClassify') !== 'toClassify' ? sectionLabel('toClassify') : 'À classer';
      const body = `<div class="cvExpList cvExpList--toClassify">${all
        .map(
          (x) =>
            `<div class="cvExpEntry cvExpEntry--toClassify" data-to-classify="1"><p contenteditable>${esc(x)}</p></div>`
        )
        .join('')}</div>`;
      return `<section class="cvSection cvSection--toClassify"><h3 class="cvSectionTitle">${esc(title)}</h3><div class="cvSectionBody">${body}</div></section>`;
    }

    function unsortedSection(p) {
      if (productionTemplateMode()) return '';
      const items = filterRenderableList(p.unsorted);
      if (!items.length) return '';
      const title =
        sectionLabel('unsorted') !== 'unsorted' ? sectionLabel('unsorted') : 'Additional information';
      const body = `<div class="cvUnsortedList">${items
        .map((x) => `<div class="cvUnsortedEntry"><p contenteditable>${esc(x)}</p></div>`)
        .join('')}</div>`;
      return `<section class="cvSection cvSection--unsorted"><h3 class="cvSectionTitle">${esc(title)}</h3><div class="cvSectionBody">${body}</div></section>`;
    }

    function experienceTimelineHtml(p) {
      if (!p.experience || !p.experience.length) return '';
      return `<div class="cvTimeline">${p.experience
        .map((x) => {
          const entry = formatExperienceEntryHtml(x);
          if (!entry) return '';
          return `<div class="cvTimelineItem"><span class="cvTimelineDot" aria-hidden="true"></span><div class="cvTimelineContent">${entry}</div></div>`;
        })
        .filter(Boolean)
        .join('')}</div>`;
    }

    function experienceTimelineSection(p) {
      if (!p.experience || !p.experience.length) return '';
      return `<section class="cvSection cvSection--experience cvSection--primary cvSection--timeline"><h3 class="cvSectionTitle">${esc(sectionLabel('experience'))}</h3><div class="cvSectionBody">${experienceTimelineHtml(p)}</div></section>`;
    }

    function experienceSection(p, density) {
      const hasKnown = p.experience && p.experience.length;
      const hasToClassify = !productionTemplateMode() && toClassifyTexts(p).length > 0;
      if (productionTemplateMode()) {
        if (!hasKnown) return '';
        return `<section class="cvSection cvSection--experience cvSection--primary"><h3 class="cvSectionTitle">${esc(sectionLabel('experience'))}</h3><div class="cvSectionBody">${experienceHtml(p, density)}</div></section>`;
      }
      if (!hasKnown && !hasToClassify) return classificationPendingSection(p);
      if (!hasKnown) return toClassifySection(p);
      const known = `<section class="cvSection cvSection--experience cvSection--primary"><h3 class="cvSectionTitle">${esc(sectionLabel('experience'))}</h3><div class="cvSectionBody">${experienceHtml(p, density)}</div></section>`;
      return hasToClassify ? `${known}${toClassifySection(p)}` : known;
    }

    function projectsSection(p) {
      if (!p.projects || !p.projects.length) return '';
      const body = `<div class="cvProjectsList">${p.projects
        .map((x) => `<div class="cvProjectEntry"><p contenteditable>${esc(x)}</p></div>`)
        .join('')}</div>`;
      return `<section class="cvSection cvSection--projects"><h3 class="cvSectionTitle">${esc(projectsSectionTitle())}</h3><div class="cvSectionBody">${body}</div></section>`;
    }

    function listEntriesSection(p, key, title) {
      const arr = p[key];
      if (!arr || !arr.length) return '';
      const body = arr
        .map((x) => `<div class="cvListEntry"><p contenteditable>${esc(x)}</p></div>`)
        .join('');
      const slug = key.replace(/Links$/, '');
      return `<section class="cvSection cvSection--${slug}"><h3 class="cvSectionTitle">${esc(title)}</h3><div class="cvSectionBody">${body}</div></section>`;
    }

    function exhibitionsSection(p) {
      return listEntriesSection(p, 'exhibitions', sectionLabel('exhibitions') || 'Exhibitions');
    }

    function awardsSection(p) {
      return listEntriesSection(p, 'awards', sectionLabel('awards') || 'Awards');
    }

    function publicationsSection(p) {
      return listEntriesSection(p, 'publications', sectionLabel('publications') || 'Publications');
    }

    function portfolioLinksForRender(p) {
      const links = [...(p.portfolioLinks || [])];
      if (p.portfolio && !links.some((x) => String(x).trim() === String(p.portfolio).trim())) {
        links.unshift(p.portfolio);
      }
      return links.filter(Boolean);
    }

    function portfolioLinksSection(p) {
      const links = portfolioLinksForRender(p);
      if (!links.length) return '';
      const body = links
        .map((x) => `<div class="cvListEntry cvPortfolioLink"><p contenteditable>${esc(x)}</p></div>`)
        .join('');
      const title = sectionLabel('portfolio') || 'Portfolio';
      return `<section class="cvSection cvSection--portfolio"><h3 class="cvSectionTitle">${esc(title)}</h3><div class="cvSectionBody">${body}</div></section>`;
    }

    function softwareSectionTitle() {
      const tools = sectionLabel('tools');
      if (tools && tools !== 'tools') return tools;
      return 'Software';
    }

    function softwareSection(p) {
      if (!p.tools || !p.tools.length) return '';
      const inner = compactToolsHtml(p.tools);
      return `<section class="cvSection cvSection--software cvSection--compact"><h3 class="cvSectionTitle">${esc(softwareSectionTitle())}</h3><div class="cvSectionBody">${inner}</div></section>`;
    }

    function layoutConsultingElite(p) {
      const head = headClassic(p, '', 'cvHead--consulting', { summaryInHead: true });
      const main = stackProfessional(p, {
        summaryInHead: true,
        expDensity: 'tight',
        metaGrid: true,
        metaCols: '2',
      });
      return wrap(
        'consultingelite',
        'cvLayout-consulting',
        `${head}<main class="cvMain cvMain--consulting">${main.join('')}</main>`
      );
    }

    function clientsSection(p, variant) {
      if (!p.clients || !p.clients.length) return '';
      const hero = variant === 'hero';
      const inner = hero
        ? `<div class="cvClientGrid">${p.clients
            .map((c) => `<span class="cvClientChip" contenteditable>${esc(c)}</span>`)
            .join('')}</div>`
        : `<p class="cvClientLine" contenteditable>${esc(p.clients.join(' · '))}</p>`;
      const mod = hero ? ' cvSection--clients-hero' : '';
      return `<section class="cvSection cvSection--clients cvSection--compact${mod}"><h3 class="cvSectionTitle">${esc(sectionLabel('clients'))}</h3><div class="cvSectionBody">${inner}</div></section>`;
    }

    function formatEducationEntryHtml(line) {
      const s = normalizeCvDash(String(line || '').trim());
      if (!s) return '';
      const parts = s.split(/\s*—\s*/).map((p) => p.trim()).filter(Boolean);
      if (parts.length >= 2) {
        const rows = [];
        if (parts[0]) rows.push(`<p class="cvEduSchool" contenteditable>${esc(parts[0])}</p>`);
        if (parts[1] && !/^(?:19|20)\d{2}(?:–(?:19|20)\d{2})?$/i.test(parts[1])) {
          rows.push(`<p class="cvEduProgram" contenteditable>${esc(parts[1])}</p>`);
        }
        const datePart = parts.length >= 3 ? parts[2] : /^(?:19|20)\d{2}/.test(parts[1]) ? parts[1] : '';
        if (datePart) rows.push(`<p class="cvEduDates" contenteditable>${esc(datePart)}</p>`);
        if (rows.length) {
          return `<div class="cvEduEntry cvEduEntry--stacked">${rows.join('')}</div>`;
        }
      }
      return `<p class="cvEduLine" contenteditable>${esc(s)}</p>`;
    }

    function educationBlock(p) {
      if (!p.education || !p.education.length) return '';
      const lines = p.education.map((x) => formatEducationEntryHtml(x)).join('');
      return `<section class="cvSection cvSection--compact cvSection--education"><h3 class="cvSectionTitle">${esc(sectionLabel('education'))}</h3><div class="cvSectionBody cvEduList">${lines}</div></section>`;
    }

    function compactToolsHtml(tools) {
      if (!tools || !tools.length) return '';
      return `<p class="cvSkillLine cvToolsLine" contenteditable>${esc(tools.join(' · '))}</p>`;
    }

    function compactLanguagesHtml(langs) {
      if (!langs || !langs.length) return '';
      const lines = langs.map((x) => `<p class="cvLangLine" contenteditable>${esc(normalizeCvDash(x))}</p>`).join('');
      return `<div class="cvLangList">${lines}</div>`;
    }

    function metaFooter(p, o) {
      const meta = [];
      if (p.skills && p.skills.length && o.skills !== false) {
        meta.push(metaSideSection('skills', sectionLabel('skills'), cvSkillsHtml(p.skills, o.chips ?? false)));
      }
      if (p.tools && p.tools.length && o.tools !== false) {
        meta.push(metaSideSection('tools', sectionLabel('tools'), compactToolsHtml(p.tools)));
      }
      if (p.languages && p.languages.length && o.langs !== false) {
        meta.push(metaSideSection('languages', sectionLabel('languages'), compactLanguagesHtml(p.languages)));
      }
      if (!meta.length) return '';
      const grid = o.metaGrid ? ' cvMetaGrid' : '';
      const cols = o.metaCols ? ` cvMetaGrid--${o.metaCols}` : '';
      return `<div class="cvMetaFooter${grid}${cols}">${meta.join('')}</div>`;
    }

    function metaSideSection(slug, title, inner) {
      if (!inner) return '';
      return `<section class="cvSection cvSection--compact cvSection--${slug}"><h3 class="cvSectionTitle">${esc(title)}</h3><div class="cvSectionBody">${inner}</div></section>`;
    }

    function sideBlocksMeta(p, opts) {
      const o = opts || {};
      const parts = [];
      if (o.contactInSide && contact(p, '<br>')) {
        parts.push(
          `<section class="cvSection cvSection--compact cvSection--meta"><h3 class="cvSectionTitle">Contact</h3><div class="cvSectionBody"><p contenteditable>${contact(p, '<br>')}</p></div></section>`
        );
      }
      if (p.skills && p.skills.length) {
        parts.push(metaSideSection('skills', sectionLabel('skills'), cvSkillsHtml(p.skills, o.chips)));
      }
      if (p.tools && p.tools.length) {
        parts.push(metaSideSection('tools', sectionLabel('tools'), compactToolsHtml(p.tools)));
      }
      if (p.languages && p.languages.length) {
        parts.push(metaSideSection('languages', sectionLabel('languages'), compactLanguagesHtml(p.languages)));
      }
      return parts;
    }

    /**
     * P0 universal order — identity (header) → summary → experience → clients → projects → education → skills/tools/languages.
     * @param {object} p cv payload
     * @param {object} o render options
     * @param {string[]} afterEducation optional blocks after education, before meta footer
     */
    function stackUniversal(p, o = {}, afterEducation = []) {
      const metaOpts = { ...o, chips: o.chips ?? false };
      const builders = {
        summary: () => (!o.summaryInHead ? summarySection(p) : ''),
        experience: () => experienceSection(p, o.expDensity || 'tight'),
        clients: () => clientsSection(p, o.clientVariant),
        projects: () => projectsSection(p),
        portfolio: () => (o.includePortfolio ? portfolioLinksSection(p) : ''),
        education: () => (p.education && p.education.length ? educationBlock(p) : ''),
        skills: () =>
          p.skills && p.skills.length && metaOpts.skills !== false
            ? metaSideSection('skills', sectionLabel('skills'), cvSkillsHtml(p.skills, metaOpts.chips ?? false))
            : '',
        tools: () =>
          p.tools && p.tools.length && metaOpts.tools !== false
            ? metaSideSection('tools', sectionLabel('tools'), compactToolsHtml(p.tools))
            : '',
        languages: () =>
          p.languages && p.languages.length && metaOpts.langs !== false
            ? metaSideSection('languages', sectionLabel('languages'), compactLanguagesHtml(p.languages))
            : '',
      };
      const aux = [
        () => unsortedSection(p),
        () => pendingReviewSection(p),
        ...afterEducation,
      ];
      return stackFromSectionOrder(p, builders, aux);
    }

    function stackProfessional(p, o) {
      return stackUniversal(p, o);
    }

    /** Allowed sections only — omit empty blocks. */
    function stackMain(p, o) {
      return stackUniversal(p, o);
    }

    function stackPortfolioFirst(p, o) {
      return stackUniversal(p, o);
    }

    function stackCreativeFirst(p, o) {
      return stackUniversal(
        p,
        { ...o, clientVariant: o.clientVariant || 'hero', includePortfolio: o.includePortfolio !== false },
        [
          exhibitionsSection(p),
          awardsSection(p),
          publicationsSection(p),
        ].filter(Boolean)
      );
    }

    function layoutAgencyPortfolio(p) {
      const head = headClassic(p, '', 'cvHead--agency', { summaryInHead: true });
      const main = stackUniversal(p, {
        summaryInHead: true,
        expDensity: 'tight',
        metaGrid: true,
        metaCols: '2',
        clientVariant: 'hero',
        includePortfolio: true,
      });
      return wrap('agencyportfolio', 'cvLayout-agency', `${head}<main class="cvMain">${main.join('')}</main>`);
    }

    function layoutLuxuryPortfolio(p) {
      const head = headCentered(p, '', { summaryInHead: true }, 'cvHead--luxury');
      const main = stackUniversal(p, {
        summaryInHead: true,
        expDensity: 'tight',
        metaGrid: true,
        metaCols: '2',
        includePortfolio: true,
      });
      return wrap('luxuryportfolio', 'cvLayout-luxury', `${head}<main class="cvMain">${main.join('')}</main>`);
    }

    function portfolioLinkPlatform(url) {
      const s = String(url || '').toLowerCase();
      if (/behance\.net|behance/.test(s)) return 'Behance';
      if (/instagram\.com|instagram/.test(s)) return 'Instagram';
      if (/dribbble\.com|dribbble/.test(s)) return 'Dribbble';
      if (/linkedin\.com|linkedin/.test(s)) return 'LinkedIn';
      if (/^https?:\/\//.test(s) || /\./.test(s)) return 'Website';
      return 'Portfolio';
    }

    function headArtDirectorPortfolio(p) {
      const lead = p.summary ? `<p class="cvAdpHeroLead" contenteditable>${esc(p.summary)}</p>` : '';
      const c = contact(p);
      return `<header class="cvHead cvHead--art-director-portfolio cvAdpHero">${photoSlot()}${identityNameHtml(p)}${identityTitleHtml(p)}${lead}${c ? `<p class="cvAdpHeroContact" contenteditable>${c}</p>` : ''}</header>`;
    }

    function adpListSection(slug, title, items, itemClass) {
      if (!items || !items.length) return '';
      const body = items.map((x) => `<p class="${itemClass}" contenteditable>${esc(x)}</p>`).join('');
      return `<section class="cvSection cvSection--${slug}"><h3 class="cvSectionTitle">${esc(title)}</h3><div class="cvSectionBody">${body}</div></section>`;
    }

    function awardsSectionArtDirector(p) {
      return adpListSection('awards', 'Awards', p.awards, 'cvAdpAward');
    }

    function pressSectionArtDirector(p) {
      const press = [...(p.publications || []), ...(p.press || [])].filter(Boolean);
      return adpListSection('press', 'Press', press, 'cvAdpPress');
    }

    function portfolioLinksSectionArtDirector(p) {
      const links = portfolioLinksForRender(p);
      if (!links.length) return '';
      const body = links
        .map((url) => {
          const platform = portfolioLinkPlatform(url);
          return `<div class="cvAdpLinkRow"><span class="cvAdpLinkLabel">${esc(platform)}</span><span class="cvAdpLinkUrl" contenteditable>${esc(url)}</span></div>`;
        })
        .join('');
      return `<section class="cvSection cvSection--portfolio cvSection--adp-links"><h3 class="cvSectionTitle">Portfolio Links</h3><div class="cvSectionBody"><div class="cvAdpLinks">${body}</div></div></section>`;
    }

    function stackArtDirectorPortfolio(p) {
      const parts = [];
      parts.push(experienceSection(p, 'tight'));
      parts.push(clientsSectionDirector(p));
      parts.push(projectsSectionDirector(p));
      parts.push(awardsSectionArtDirector(p));
      parts.push(pressSectionArtDirector(p));
      if (p.education && p.education.length) parts.push(educationBlock(p));
      if (p.skills && p.skills.length) {
        parts.push(
          `<section class="cvSection cvSection--skills cvSection--adp-skills"><h3 class="cvSectionTitle">${esc(sectionLabel('skills') || 'Skills')}</h3><div class="cvSectionBody">${cvSkillsHtml(p.skills, false)}</div></section>`
        );
      }
      if (p.tools && p.tools.length) {
        const title = sectionLabel('tools');
        parts.push(
          `<section class="cvSection cvSection--tools cvSection--adp-tools"><h3 class="cvSectionTitle">${esc(title && title !== 'tools' ? title : 'Tools')}</h3><div class="cvSectionBody">${compactToolsHtml(p.tools)}</div></section>`
        );
      }
      if (p.languages && p.languages.length) {
        const langs = p.languages.map((x) => `<p class="cvLangLine cvAdpLang" contenteditable>${esc(normalizeCvDash(x))}</p>`).join('');
        parts.push(
          `<section class="cvSection cvSection--languages cvSection--adp-languages"><h3 class="cvSectionTitle">${esc(sectionLabel('languages') || 'Languages')}</h3><div class="cvSectionBody">${langs}</div></section>`
        );
      }
      parts.push(portfolioLinksSectionArtDirector(p));
      return parts.filter(Boolean);
    }

    function layoutArtDirectorPortfolio(p) {
      const head = headArtDirectorPortfolio(p);
      const main = stackArtDirectorPortfolio(p);
      return wrap(
        'art-director-portfolio',
        'cvLayout-art-director-portfolio cvLayout-h20-art-director-portfolio',
        `${head}<main class="cvMain cvMain--art-director-portfolio">${main.join('')}</main>`
      );
    }

    function layoutArtDirector(p, tplId = 'art-director') {
      if (tplId === 'art-director-portfolio') return layoutArtDirectorPortfolio(p);
      const head = headGrid(p, '', { summaryInHead: true }, 'cvHead--art-director');
      const mainO = { expDensity: 'tight', summaryInHead: true, metaGrid: true, metaCols: '2', includePortfolio: true };
      const main = stackUniversal(p, mainO, [
        exhibitionsSection(p),
        awardsSection(p),
        publicationsSection(p),
      ]);
      return wrap(tplId, 'cvLayout-art-director cvLayout-h20-art-director', `${head}<main class="cvMain cvMain--art-director">${main.join('')}</main>`);
    }

    function layoutIllustratorPortfolio(p) {
      const head = headCentered(p, '', { summaryInHead: true }, 'cvHead--illustrator');
      const main = stackUniversal(p, {
        summaryInHead: true,
        expDensity: 'tight',
        clientVariant: 'hero',
        includePortfolio: true,
        metaGrid: true,
        metaCols: '2',
      });
      return wrap(
        'illustrator-portfolio',
        'cvLayout-illustrator cvLayout-h20-illustrator-portfolio',
        `${head}<main class="cvMain cvMain--illustrator">${main.join('')}</main>`
      );
    }

    function layoutSingle(tplId, p, o, headFn, headExtra, headMod, layoutExtra) {
      const head = headFn ? headFn(p, headExtra, o, headMod) : headClassic(p, headExtra, headMod || '', o);
      const layoutCls = layoutExtra || `cvLayout-${tplId}`;
      return wrap(tplId, `cvLayout-single ${layoutCls}`, `${head}<main class="cvMain">${stackMain(p, o).join('')}</main>`);
    }

    function layoutSide(tplId, p, sideOpts, mainOpts, right, headFn, headExtra, headMod) {
      const head = headFn ? headFn(p, headExtra, mainOpts, headMod) : headClassic(p, headExtra, headMod || '', mainOpts);
      const layoutCls = `cvLayout-split cvLayout-${tplId}${right ? ' cvLayout-sideRight' : ''}`;
      return wrap(tplId, layoutCls, `${head}<main class="cvMain cvMain--dominant">${stackUniversal(p, mainOpts).join('')}</main>`);
    }

    /* ── P2 Template System V2 — ten distinct families ── */

    function formatAtsRecruiterExpRow(e) {
      if (typeof e === 'string') {
        const parts = String(e || '').split(/\s*—\s*/).map((x) => x.trim());
        return `<div class="cvArExpRow"><span class="cvArExpDates" contenteditable>${esc(parts[2] || '')}</span><div class="cvArExpMain"><p class="cvArExpRole" contenteditable>${esc(parts[0] || e)}</p>${parts[1] ? `<p class="cvArExpCo" contenteditable>${esc(parts[1])}</p>` : ''}</div></div>`;
      }
      const role = String(e.role || '').trim();
      const company = String(e.company || '').trim();
      const dates = String(e.dates || '').trim();
      const bullets = (e.bullets || []).map((b) => `<li contenteditable>${esc(b)}</li>`).join('');
      return `<article class="cvArExpRow"><span class="cvArExpDates" contenteditable>${esc(dates)}</span><div class="cvArExpMain"><p class="cvArExpRole" contenteditable>${esc(role)}</p>${company ? `<p class="cvArExpCo" contenteditable>${esc(company)}</p>` : ''}${bullets ? `<ul class="cvArExpBullets">${bullets}</ul>` : ''}</div></article>`;
    }

    function layoutAtsRecruiter(p) {
      const c = contact(p, ' · ');
      const head = `<header class="cvHead cvHead--ats-recruiter">${photoSlot()}${identityNameHtml(p)}${identityTitleHtml(p)}</header>`;
      const band = c ? `<div class="cvArContactBand" contenteditable>${esc(c)}</div>` : '';
      const entries = (p.experiences || p.experience || []).filter(Boolean);
      const builders = {
        summary: () => (p.summary ? summarySection(p) : ''),
        experience: () =>
          entries.length
            ? `<section class="cvSection cvSection--experience cvSection--primary"><h3 class="cvSectionTitle">Experience</h3><div class="cvSectionBody"><div class="cvArExpTable">${entries.map(formatAtsRecruiterExpRow).join('')}</div></div></section>`
            : '',
        clients: () => clientsSection(p),
        projects: () => projectsSection(p),
        education: () => (p.education?.length ? educationBlock(p) : ''),
        skills: () =>
          p.skills?.length
            ? `<section class="cvSection cvSection--skills"><h3 class="cvSectionTitle">${esc(sectionLabel('skills'))}</h3><div class="cvSectionBody">${cvSkillsHtml(p.skills, false)}</div></section>`
            : '',
        tools: () =>
          p.tools?.length
            ? `<section class="cvSection cvSection--tools"><h3 class="cvSectionTitle">${esc(sectionLabel('tools') || 'Tools')}</h3><div class="cvSectionBody">${compactToolsHtml(p.tools)}</div></section>`
            : '',
        languages: () =>
          p.languages?.length
            ? `<section class="cvSection cvSection--languages"><h3 class="cvSectionTitle">${esc(sectionLabel('languages'))}</h3><div class="cvSectionBody">${p.languages.map((x) => `<p class="cvArLang" contenteditable>${esc(normalizeCvDash(x))}</p>`).join('')}</div></section>`
            : '',
        portfolio: () => '',
      };
      const main = stackFromSectionOrder(p, builders);
      return wrapV2('ats-recruiter', 'cvLayout-ats-recruiter', `${head}${band}<main class="cvMain cvMain--ats-recruiter">${main.join('')}</main>`);
    }

    function layoutMcKinseyConsulting(p) {
      const head = `<header class="cvHead cvHead--mckinsey">${photoSlot()}${identityNameHtml(p)}${identityTitleHtml(p)}<p class="cvMkContact" contenteditable>${esc(contact(p, ' · '))}</p></header>`;
      const cred = [
        p.education?.length ? educationBlock(p) : '',
        p.skills?.length ? `<section class="cvSection cvSection--skills cvSection--mk-side"><h3 class="cvSectionTitle">Core Skills</h3><div class="cvSectionBody"><p class="cvMkLine" contenteditable>${esc(p.skills.join(' · '))}</p></div></section>` : '',
        p.tools?.length ? `<section class="cvSection cvSection--tools cvSection--mk-side"><h3 class="cvSectionTitle">${esc(sectionLabel('tools') || 'Tools')}</h3><div class="cvSectionBody"><p class="cvMkLine" contenteditable>${esc(p.tools.join(' · '))}</p></div></section>` : '',
        p.languages?.length ? `<section class="cvSection cvSection--languages cvSection--mk-side"><h3 class="cvSectionTitle">${esc(sectionLabel('languages'))}</h3><div class="cvSectionBody">${p.languages.map((x) => `<p class="cvMkLine" contenteditable>${esc(normalizeCvDash(x))}</p>`).join('')}</div></section>` : '',
      ].filter(Boolean);
      const cases = [
        p.summary ? executiveSummarySection(p).replace('Executive Summary', 'Engagement Summary').replace('cvSection--executive-summary', 'cvSection--mk-summary') : '',
        leadershipExperienceLuxury(p).replace('Leadership Experience', 'Case Experience').replace('cvSection--leadership', 'cvSection--mk-cases'),
        clientsSection(p, 'hero'),
        projectsSection(p),
      ].filter(Boolean);
      const metrics = (p.experiences || []).slice(0, 3).map((e) => luxuryImpactFromEntry(e)[0]).filter(Boolean);
      const matrix = metrics.length
        ? `<div class="cvMkImpactMatrix">${metrics.map((m) => `<div class="cvMkImpactCell"><span class="cvMkImpactLabel">${esc(m.label)}</span><span class="cvMkImpactValue" contenteditable>${esc(m.value)}</span></div>`).join('')}</div>`
        : '';
      const body = `<div class="cvMkBody"><aside class="cvMkCred">${cred.join('')}</aside><div class="cvMkCases">${cases.join('')}${matrix}</div></div>`;
      return wrapV2('mckinsey-consulting', 'cvLayout-mckinsey-consulting', `${head}${body}`);
    }

    function layoutAppleMinimal(p) {
      const head = `<header class="cvHead cvHead--apple-minimal">${photoSlot()}${identityNameHtml(p)}${identityTitleHtml(p)}${p.summary ? `<p class="cvAmThesis" contenteditable>${esc(p.summary)}</p>` : ''}<p class="cvAmContact" contenteditable>${esc(contact(p, ' · '))}</p></header>`;
      const main = [
        visualTimelineSection(p),
        visualTimelineConnectedSection(p),
        clientsSection(p, 'hero'),
        projectsSection(p),
        p.skills?.length ? `<section class="cvSection cvSection--skills cvSection--am-whisper"><h3 class="cvSectionTitle">${esc(sectionLabel('skills'))}</h3><div class="cvSectionBody"><p class="cvAmWhisper" contenteditable>${esc(p.skills.join(' · '))}</p></div></section>` : '',
        p.tools?.length ? `<section class="cvSection cvSection--tools cvSection--am-whisper"><h3 class="cvSectionTitle">${esc(sectionLabel('tools') || 'Tools')}</h3><div class="cvSectionBody"><p class="cvAmWhisper" contenteditable>${esc(p.tools.join(' · '))}</p></div></section>` : '',
        p.languages?.length ? `<section class="cvSection cvSection--languages cvSection--am-whisper"><h3 class="cvSectionTitle">${esc(sectionLabel('languages'))}</h3><div class="cvSectionBody">${p.languages.map((x) => `<p class="cvAmWhisper cvLangLine" contenteditable>${esc(normalizeCvDash(x))}</p>`).join('')}</div></section>` : '',
        p.education?.length ? educationBlock(p) : '',
      ].filter(Boolean);
      return wrapV2('apple-minimal', 'cvLayout-apple-minimal', `${head}<main class="cvMain cvMain--apple-minimal">${main.join('')}</main>`);
    }

    function layoutKinfolkEditorial(p) {
      const head = headEditorialMagazine(p);
      const body = stackEditorialMagazine(p);
      return wrapV2('kinfolk-editorial', 'cvLayout-kinfolk-editorial cvLayout-editorial-magazine', `${head}${body}`);
    }

    function layoutCreativeDirectorPortfolio(p) {
      const html = layoutCreativeDirector(p);
      return html
        .replace(/creative-director/g, 'creative-director-portfolio')
        .replace('cvLayout-professional', 'cvLayout-v2')
        .replace('cvLayout-director', 'cvLayout-creative-director-portfolio');
    }

    function layoutLuxuryExecutive(p) {
      return layoutExecutiveLuxury(p);
    }

    function layoutStartupFounder(p) {
      const html = layoutStartupBuilder(p);
      return html.replace(/startup-builder/g, 'startup-founder').replace('cvLayout-professional', 'cvLayout-v2').replace('cvLayout-startup-builder', 'cvLayout-startup-founder');
    }

    function layoutTechEngineer(p) {
      const html = layoutTechStructured(p);
      return html.replace(/tech-structured/g, 'tech-engineer').replace('cvLayout-professional', 'cvLayout-v2').replace('cvLayout-tech-structured', 'cvLayout-tech-engineer');
    }

    function layoutArtDirectorFamily(p) {
      const html = layoutArtDirectorPortfolio(p);
      return html.replace(/art-director-portfolio/g, 'art-director').replace('cvLayout-professional', 'cvLayout-v2').replace('cvLayout-art-director-portfolio', 'cvLayout-art-director');
    }

    function headClassicCorporate(p) {
      const c = contact(p, ' · ');
      return `<header class="cvHead cvHead--classic-corporate"><div class="cvCcMasthead"><div class="cvCcMastheadMain">${photoSlot()}${identityNameHtml(p)}${identityTitleHtml(p)}</div>${c ? `<p class="cvCcContact" contenteditable>${esc(c)}</p>` : ''}</div><div class="cvCcRuleBand" aria-hidden="true"></div></header>`;
    }

    function classicCorpSidebarSection(slug, title, inner) {
      if (!inner) return '';
      return `<section class="cvSection cvSection--compact cvSection--${slug} cvSection--cc-side"><h3 class="cvCcSideTitle">${esc(title)}</h3><div class="cvSectionBody cvCcSideBody">${inner}</div></section>`;
    }

    function layoutClassicCorporate(p) {
      const head = headClassicCorporate(p);
      const summary = p.summary
        ? `<section class="cvSection cvSection--summary cvSection--cc-summary"><h3 class="cvCcBandTitle">${esc(sectionLabel('summary') || 'Professional Summary')}</h3><div class="cvSectionBody"><p class="cvCcLead" contenteditable>${esc(p.summary)}</p></div></section>`
        : '';
      const mainCol = [experienceSection(p, 'tight'), clientsSection(p), projectsSection(p)].filter(Boolean);
      const sideCol = [
        p.education?.length ? educationBlock(p) : '',
        p.skills?.length
          ? classicCorpSidebarSection('skills', sectionLabel('skills') || 'Skills', cvSkillsHtml(p.skills, false))
          : '',
        p.tools?.length
          ? classicCorpSidebarSection('tools', sectionLabel('tools') || 'Tools', compactToolsHtml(p.tools))
          : '',
        p.languages?.length
          ? classicCorpSidebarSection(
              'languages',
              sectionLabel('languages') || 'Languages',
              p.languages.map((x) => `<p class="cvCcLang cvLangLine" contenteditable>${esc(normalizeCvDash(x))}</p>`).join('')
            )
          : '',
      ].filter(Boolean);
      const body = `<div class="cvCcGrid"><div class="cvCcMain">${mainCol.join('')}</div><aside class="cvCcSide">${sideCol.join('')}</aside></div>`;
      return wrapV2('classic-corporate', 'cvLayout-classic-corporate', `${head}${summary}<main class="cvMain cvMain--classic-corporate">${body}</main>`);
    }

    /* ── Template Library V3 — 10 differentiated families ── */

    function layoutConsultingElite(p) {
      const head = `<header class="cvHead cvHead--v3-consulting">${photoSlot()}${identityNameHtml(p)}${identityTitleHtml(p)}<p class="cvV3CeContact" contenteditable>${esc(contact(p, ' · '))}</p></header>`;
      const rail = [
        p.education?.length ? educationBlock(p) : '',
        p.languages?.length ? `<section class="cvSection cvSection--languages"><h3 class="cvSectionTitle">${esc(sectionLabel('languages'))}</h3><div class="cvSectionBody">${p.languages.map((x) => `<p contenteditable>${esc(normalizeCvDash(x))}</p>`).join('')}</div></section>` : '',
      ].filter(Boolean);
      const main = [clientsSection(p, 'hero'), projectsSection(p)].filter(Boolean);
      const aboveFold = [
        p.summary ? summarySection(p) : '',
        leadershipExperienceLuxury(p).replace('Leadership Experience', 'Case Experience'),
        p.skills?.length ? `<section class="cvSection cvSection--skills"><h3 class="cvSectionTitle">${esc(sectionLabel('skills'))}</h3><div class="cvSectionBody">${cvSkillsHtml(p.skills, false)}</div></section>` : '',
        p.tools?.length ? `<section class="cvSection cvSection--tools"><h3 class="cvSectionTitle">${esc(sectionLabel('tools') || 'Tools')}</h3><div class="cvSectionBody">${compactToolsHtml(p.tools)}</div></section>` : '',
      ].filter(Boolean);
      const body = `${aboveFold.join('')}<div class="cvV3CeGrid"><aside class="cvV3CeRail">${rail.join('')}</aside><div class="cvV3CeMain">${main.join('')}</div></div>`;
      return wrapV3('consulting-elite', 'cvLayout-consulting-elite', `${head}${body}`);
    }

    function layoutAppleStyle(p) {
      const head = `<header class="cvHead cvHead--v3-apple">${photoSlot()}${identityNameHtml(p)}${identityTitleHtml(p)}${p.summary ? `<p class="cvV3ApThesis" contenteditable>${esc(p.summary.slice(0, 180))}${p.summary.length > 180 ? '…' : ''}</p>` : ''}<p class="cvV3ApContact" contenteditable>${esc(contact(p, ' · '))}</p></header>`;
      const spine = [
        experienceSection(p, 'tight'),
        visualTimelineConnectedSection(p),
        clientsSection(p, 'hero'),
        projectsSection(p),
        p.education?.length ? educationBlock(p) : '',
        p.skills?.length ? `<section class="cvSection cvSection--skills"><h3 class="cvSectionTitle">${esc(sectionLabel('skills'))}</h3><div class="cvSectionBody"><p contenteditable>${esc(p.skills.join(' · '))}</p></div></section>` : '',
        p.tools?.length ? `<section class="cvSection cvSection--tools"><h3 class="cvSectionTitle">${esc(sectionLabel('tools') || 'Tools')}</h3><div class="cvSectionBody"><p contenteditable>${esc(p.tools.join(' · '))}</p></div></section>` : '',
      ].filter(Boolean);
      return wrapV3('apple-style', 'cvLayout-apple-style', `${head}<main class="cvV3ApBody"><div class="cvV3ApSpine">${spine.join('')}</div></main>`);
    }

    function layoutGoogleStyle(p) {
      const head = `<div class="cvV3GgBar" aria-hidden="true"></div><header class="cvHead cvHead--v3-google">${photoSlot()}${identityNameHtml(p)}${identityTitleHtml(p)}</header>`;
      const chips = (arr) => (arr || []).map((x) => `<span class="cvV3GgChip" contenteditable>${esc(x)}</span>`).join('');
      const rail = [
        p.skills?.length ? `<section class="cvSection cvSection--skills"><h3 class="cvSectionTitle">${esc(sectionLabel('skills'))}</h3><div class="cvSectionBody">${chips(p.skills)}</div></section>` : '',
        p.tools?.length ? `<section class="cvSection cvSection--tools"><h3 class="cvSectionTitle">${esc(sectionLabel('tools') || 'Tools')}</h3><div class="cvSectionBody">${chips(p.tools)}</div></section>` : '',
        p.languages?.length ? `<section class="cvSection cvSection--languages"><h3 class="cvSectionTitle">${esc(sectionLabel('languages'))}</h3><div class="cvSectionBody">${p.languages.map((x) => `<p contenteditable>${esc(normalizeCvDash(x))}</p>`).join('')}</div></section>` : '',
      ].filter(Boolean);
      const main = [experienceSection(p, 'tight'), projectsSection(p), clientsSection(p), p.education?.length ? educationBlock(p) : ''].filter(Boolean);
      const body = `<div class="cvV3GgGrid"><aside class="cvV3GgRail">${rail.join('')}</aside><div class="cvV3GgMain">${main.join('')}</div></div>`;
      return wrapV3('google-style', 'cvLayout-google-style', `${head}${body}`);
    }

    function layoutStartupFounderV3(p) {
      const head = `<header class="cvHead cvHead--v3-founder">${photoSlot()}${identityNameHtml(p)}${identityTitleHtml(p)}${p.summary ? `<p class="cvV3SfThesis" contenteditable>${esc(p.summary)}</p>` : ''}</header>`;
      const traction = startupTractionItems(p);
      const tractionHtml = traction.length
        ? `<div class="cvV3SfTraction">${traction.map((x, i) => `<div class="cvV3SfMetric"><strong>0${i + 1}</strong> <span contenteditable>${esc(x)}</span></div>`).join('')}</div>`
        : '';
      const rail = [startupSkillsSection(p), startupToolsSection(p), startupLanguagesSection(p)].filter(Boolean);
      const main = [startupImpactSection(p), clientsSection(p, 'hero'), projectsSection(p), p.education?.length ? educationBlock(p) : ''].filter(Boolean);
      const body = `${tractionHtml}<div class="cvV3SfSplit"><aside class="cvV3SfRail">${rail.join('')}</aside><div class="cvV3SfMain">${main.join('')}</div></div>`;
      return wrapV3('startup-founder', 'cvLayout-startup-founder', `${head}${body}`);
    }

    function layoutCreativeDirectorV3(p) {
      const head = `<header class="cvHead cvHead--v3-creative">${photoSlot()}${identityNameHtml(p)}${identityTitleHtml(p)}${p.summary ? `<p class="cvV3CdDeck" contenteditable>${esc(p.summary.slice(0, 220))}</p>` : ''}</header>`;
      const main = [
        clientsSection(p, 'hero'),
        experienceSection(p, 'tight'),
        projectsSection(p),
        p.education?.length ? educationBlock(p) : '',
        p.skills?.length ? `<section class="cvSection cvSection--skills"><h3 class="cvSectionTitle">${esc(sectionLabel('skills'))}</h3><div class="cvSectionBody">${cvSkillsHtml(p.skills, false)}</div></section>` : '',
        p.tools?.length ? `<section class="cvSection cvSection--tools"><h3 class="cvSectionTitle">${esc(sectionLabel('tools') || 'Tools')}</h3><div class="cvSectionBody">${compactToolsHtml(p.tools)}</div></section>` : '',
        p.languages?.length ? `<section class="cvSection cvSection--languages"><h3 class="cvSectionTitle">${esc(sectionLabel('languages'))}</h3><div class="cvSectionBody">${p.languages.map((x) => `<p class="cvLangLine" contenteditable>${esc(normalizeCvDash(x))}</p>`).join('')}</div></section>` : '',
      ].filter(Boolean);
      return wrapV3('creative-director', 'cvLayout-creative-director', `${head}<main class="cvV3CdMain">${main.join('')}</main>`);
    }

    function formatSeniorEngineerExpCard(e) {
      const role = String(e.role || '').trim();
      const company = String(e.company || '').trim();
      const dates = String(e.dates || '').trim();
      const bullets = (e.bullets || []).map((b) => `<li contenteditable>${esc(b)}</li>`).join('');
      return `<article class="cvV3SeCard cvExpEntry"><p class="cvV3SeRole" contenteditable><strong>${esc(role)}</strong>${company ? ` · ${esc(company)}` : ''}</p>${dates ? `<p class="cvV3SeDates" contenteditable>${esc(dates)}</p>` : ''}${bullets ? `<ul>${bullets}</ul>` : ''}</article>`;
    }

    function layoutSeniorEngineer(p) {
      const head = `<header class="cvHead cvHead--v3-engineer">${photoSlot()}${identityNameHtml(p)}${identityTitleHtml(p)}<p contenteditable>${esc(contact(p, ' · '))}</p></header>`;
      const stackLines = [...(p.skills || []), ...(p.tools || [])].map((x) => `<span class="cvV3SeStackLine" contenteditable>${esc(x)}</span>`).join('');
      const entries = (p.experiences || p.experience || []).filter(Boolean);
      const main = [
        entries.length ? `<section class="cvSection cvSection--experience"><h3 class="cvSectionTitle">Systems Shipped</h3><div class="cvSectionBody">${entries.map(formatSeniorEngineerExpCard).join('')}</div></section>` : '',
        projectsSection(p),
        clientsSection(p),
        p.education?.length ? educationBlock(p) : '',
      ].filter(Boolean);
      const body = `<div class="cvV3SeGrid"><aside class="cvV3SeRail">${stackLines ? `<section class="cvSection cvSection--skills"><h3 class="cvSectionTitle">Stack</h3><div class="cvSectionBody">${stackLines}</div></section>` : ''}</aside><div class="cvV3SeMain">${main.join('')}</div></div>`;
      return wrapV3('senior-engineer', 'cvLayout-senior-engineer', `${head}${body}`);
    }

    function layoutExecutiveBoard(p) {
      const head = `<header class="cvHead cvHead--v3-board"><div class="cvV3EbRule" aria-hidden="true"></div>${photoSlot()}${identityNameHtml(p)}${identityTitleHtml(p)}<p contenteditable>${esc(contact(p, ' · '))}</p></header>`;
      const main = stackExecutiveLuxury(p);
      return wrapV3('executive-board', 'cvLayout-executive-board', `${head}<main class="cvMain cvMain--v3-board">${main.join('')}</main>`);
    }

    function formatMinimalAtsExpRow(e) {
      const role = String(e.role || '').trim();
      const company = String(e.company || '').trim();
      const dates = String(e.dates || '').trim();
      const bullets = (e.bullets || []).map((b) => `<li contenteditable>${esc(b)}</li>`).join('');
      return `<article class="cvV3MaRow cvExpEntry"><span class="cvV3MaDates" contenteditable>${esc(dates)}</span><div><p contenteditable><strong>${esc(role)}</strong>${company ? ` — ${esc(company)}` : ''}</p>${bullets ? `<ul>${bullets}</ul>` : ''}</div></article>`;
    }

    function layoutMinimalAts(p) {
      const head = `<header class="cvHead cvHead--v3-ats">${photoSlot()}${identityNameHtml(p)}${identityTitleHtml(p)}</header>`;
      const band = contact(p, ' · ') ? `<div class="cvV3MaBand" contenteditable>${esc(contact(p, ' · '))}</div>` : '';
      const entries = (p.experiences || p.experience || []).filter(Boolean);
      const builders = {
        experience: () => entries.length ? `<section class="cvSection cvSection--experience"><h3 class="cvSectionTitle">Experience</h3><div class="cvSectionBody">${entries.map(formatMinimalAtsExpRow).join('')}</div></section>` : '',
        education: () => (p.education?.length ? educationBlock(p) : ''),
        skills: () => (p.skills?.length ? `<section class="cvSection cvSection--skills"><h3 class="cvSectionTitle">${esc(sectionLabel('skills'))}</h3><div class="cvSectionBody">${cvSkillsHtml(p.skills, false)}</div></section>` : ''),
        tools: () => (p.tools?.length ? `<section class="cvSection cvSection--tools"><h3 class="cvSectionTitle">${esc(sectionLabel('tools') || 'Tools')}</h3><div class="cvSectionBody">${compactToolsHtml(p.tools)}</div></section>` : ''),
        languages: () => (p.languages?.length ? `<section class="cvSection cvSection--languages"><h3 class="cvSectionTitle">${esc(sectionLabel('languages'))}</h3><div class="cvSectionBody">${p.languages.map((x) => `<p contenteditable>${esc(normalizeCvDash(x))}</p>`).join('')}</div></section>` : ''),
        summary: () => (p.summary ? summarySection(p) : ''),
        clients: () => clientsSection(p),
        projects: () => projectsSection(p),
        portfolio: () => '',
      };
      const main = stackFromSectionOrder(p, builders);
      return wrapV3('minimal-ats', 'cvLayout-minimal-ats', `${head}${band}<main class="cvMain cvMain--v3-ats">${main.join('')}</main>`);
    }

    function formatPremiumAtsExpRow(e) {
      const role = String(e.role || '').trim();
      const company = String(e.company || '').trim();
      const dates = String(e.dates || '').trim();
      const bullets = (e.bullets || []).map((b) => `<li contenteditable>${esc(b)}</li>`).join('');
      return `<article class="cvV3PaRow cvExpEntry"><span class="cvV3PaDates" contenteditable>${esc(dates)}</span><div class="cvV3PaBody"><p contenteditable><strong>${esc(role)}</strong>${company ? ` · ${esc(company)}` : ''}</p>${bullets ? `<ul>${bullets}</ul>` : ''}</div></article>`;
    }

    function layoutPremiumAts(p) {
      const head = `<header class="cvHead cvHead--v3-premium-ats">${photoSlot()}${identityNameHtml(p)}${identityTitleHtml(p)}</header>`;
      const band = contact(p, ' · ') ? `<div class="cvV3PaBand" contenteditable>${esc(contact(p, ' · '))}</div>` : '';
      const ribbon = `<div class="cvV3PaRibbon" aria-hidden="true"><span>Premium ATS</span></div>`;
      const entries = (p.experiences || p.experience || []).filter(Boolean);
      const builders = {
        experience: () =>
          entries.length
            ? `<section class="cvSection cvSection--experience cvSection--primary"><h3 class="cvSectionTitle">Experience</h3><div class="cvSectionBody"><div class="cvV3PaTable">${entries.map(formatPremiumAtsExpRow).join('')}</div></div></section>`
            : '',
        education: () => (p.education?.length ? educationBlock(p) : ''),
        skills: () =>
          p.skills?.length
            ? `<section class="cvSection cvSection--skills"><h3 class="cvSectionTitle">${esc(sectionLabel('skills'))}</h3><div class="cvSectionBody">${cvSkillsHtml(p.skills, false)}</div></section>`
            : '',
        tools: () =>
          p.tools?.length
            ? `<section class="cvSection cvSection--tools"><h3 class="cvSectionTitle">${esc(sectionLabel('tools') || 'Tools')}</h3><div class="cvSectionBody">${compactToolsHtml(p.tools)}</div></section>`
            : '',
        languages: () =>
          p.languages?.length
            ? `<section class="cvSection cvSection--languages"><h3 class="cvSectionTitle">${esc(sectionLabel('languages'))}</h3><div class="cvSectionBody">${p.languages.map((x) => `<p contenteditable>${esc(normalizeCvDash(x))}</p>`).join('')}</div></section>`
            : '',
        summary: () => (p.summary ? summarySection(p) : ''),
        clients: () => clientsSection(p),
        projects: () => projectsSection(p),
        portfolio: () => '',
      };
      const main = stackFromSectionOrder(p, builders);
      return wrapV3('premium-ats', 'cvLayout-premium-ats', `${ribbon}${head}${band}<main class="cvMain cvMain--v3-premium-ats">${main.join('')}</main>`);
    }

    function layoutAcademic(p) {
      const head = `<header class="cvHead cvHead--v3-academic">${photoSlot()}${identityNameHtml(p)}${identityTitleHtml(p)}<p contenteditable>${esc(contact(p, ' · '))}</p></header>`;
      const pubs = [...(p.publications || []), ...(p.awards || p.achievements || [])].filter(Boolean);
      const rail = [
        p.education?.length ? educationBlock(p) : '',
        pubs.length ? `<section class="cvSection cvSection--publications"><h3 class="cvSectionTitle">Publications &amp; Awards</h3><div class="cvSectionBody">${pubs.map((x) => `<p class="cvV3AcPub" contenteditable>${esc(x)}</p>`).join('')}</div></section>` : '',
        p.skills?.length ? `<section class="cvSection cvSection--skills"><h3 class="cvSectionTitle">Research Areas</h3><div class="cvSectionBody"><p contenteditable>${esc(p.skills.join(' · '))}</p></div></section>` : '',
      ].filter(Boolean);
      const main = [p.summary ? summarySection(p) : '', experienceSection(p, 'tight'), projectsSection(p)].filter(Boolean);
      const body = `<div class="cvV3AcGrid"><aside class="cvV3AcRail">${rail.join('')}</aside><div class="cvV3AcMain">${main.join('')}</div></div>`;
      return wrapV3('academic', 'cvLayout-academic', `${head}${body}`);
    }

    function layoutLuxuryEditorialV3(p) {
      const head = `<header class="cvHead cvHead--v3-editorial">${photoSlot()}${identityNameHtml(p)}${identityTitleHtml(p)}${p.summary ? `<p class="cvEmDeck" contenteditable>${esc(p.summary)}</p>` : ''}</header>`;
      const colSide = [
        p.education?.length ? educationBlock(p) : '',
        p.skills?.length ? `<section class="cvSection cvSection--skills"><h3 class="cvSectionTitle">${esc(sectionLabel('skills'))}</h3><div class="cvSectionBody"><p contenteditable>${esc(p.skills.join(' · '))}</p></div></section>` : '',
        p.languages?.length ? `<section class="cvSection cvSection--languages"><h3 class="cvSectionTitle">${esc(sectionLabel('languages'))}</h3><div class="cvSectionBody">${p.languages.map((x) => `<p contenteditable>${esc(normalizeCvDash(x))}</p>`).join('')}</div></section>` : '',
      ].filter(Boolean);
      const colFeature = [experienceSection(p, 'tight'), clientsSection(p)].filter(Boolean);
      const colNarrow = [projectsSection(p), p.tools?.length ? `<section class="cvSection cvSection--tools"><h3 class="cvSectionTitle">${esc(sectionLabel('tools') || 'Tools')}</h3><div class="cvSectionBody">${compactToolsHtml(p.tools)}</div></section>` : ''].filter(Boolean);
      const spread = `<div class="cvV3LeSpread"><div class="cvV3LeCol cvV3LeCol--narrow">${colNarrow.join('')}</div><div class="cvV3LeCol cvV3LeCol--feature">${colFeature.join('')}</div><aside class="cvV3LeCol cvV3LeCol--side">${colSide.join('')}</aside></div>`;
      return wrapV3('luxury-editorial', 'cvLayout-luxury-editorial', `${head}${spread}`);
    }

    const PRODUCTION_TEMPLATE_IDS = [
      'ats',
      'minimal-ats',
      'creative-portfolio',
      'editorial-magazine',
      'classic-corporate',
      'tech-structured',
    ];

    function layoutAtsExecutive(p) {
      const head = headClassic(p, '', 'cvHead--ats-exec', { summaryInHead: false });
      const main = stackUniversal(p, {
        summaryInHead: false,
        expDensity: 'tight',
        metaGrid: true,
        metaCols: '3',
      });
      return wrap(
        'ats-executive',
        'cvLayout-ats-exec cvLayout-h20-ats-executive',
        `${head}<main class="cvMain cvMain--ats-exec">${main.join('')}</main>`
      );
    }

    function headAtsElite(p) {
      const c = contact(p);
      return `<header class="cvHead cvHead--ats-elite">${photoSlot()}${identityNameHtml(p)}${identityTitleHtml(p)}${c ? `<p class="cvEliteContact" contenteditable>${c}</p>` : ''}</header>`;
    }

    function eliteLineSection(slug, title, text) {
      if (!text) return '';
      return `<section class="cvSection cvSection--${slug}"><h3 class="cvSectionTitle">${esc(title)}</h3><div class="cvSectionBody"><p class="cvEliteLine" contenteditable>${esc(text)}</p></div></section>`;
    }

    function skillsSectionElite(p) {
      if (!p.skills || !p.skills.length) return '';
      const inner = cvSkillsHtml(p.skills, false);
      return `<section class="cvSection cvSection--skills"><h3 class="cvSectionTitle">${esc(sectionLabel('skills'))}</h3><div class="cvSectionBody">${inner}</div></section>`;
    }

    function toolsSectionElite(p) {
      if (!p.tools || !p.tools.length) return '';
      const title = sectionLabel('tools');
      const inner = compactToolsHtml(p.tools);
      return `<section class="cvSection cvSection--tools"><h3 class="cvSectionTitle">${esc(title && title !== 'tools' ? title : 'Tools')}</h3><div class="cvSectionBody">${inner}</div></section>`;
    }

    function languagesSectionElite(p) {
      if (!p.languages || !p.languages.length) return '';
      const lines = p.languages.map((x) => normalizeCvDash(x)).filter(Boolean);
      if (!lines.length) return '';
      return `<section class="cvSection cvSection--languages"><h3 class="cvSectionTitle">${esc(sectionLabel('languages'))}</h3><div class="cvSectionBody">${lines.map((x) => `<p class="cvLangLine cvEliteLine" contenteditable>${esc(x)}</p>`).join('')}</div></section>`;
    }

    /** ATS Elite — respects Pro section order when provided. */
    function stackAtsElite(p) {
      const builders = {
        summary: () => summarySection(p),
        experience: () => experienceSection(p, 'tight'),
        clients: () => clientsSection(p),
        projects: () => projectsSection(p),
        portfolio: () => '',
        education: () => (p.education && p.education.length ? educationBlock(p) : ''),
        skills: () => skillsSectionElite(p),
        tools: () => toolsSectionElite(p),
        languages: () => languagesSectionElite(p),
      };
      return stackFromSectionOrder(p, builders);
    }

    function layoutAtsElite(p) {
      const head = headAtsElite(p);
      const main = stackAtsElite(p);
      return wrap(
        'ats-elite',
        'cvLayout-ats-elite cvLayout-h20-ats-elite',
        `${head}<main class="cvMain cvMain--ats-elite">${main.join('')}</main>`
      );
    }

    function luxuryImpactFromEntry(e) {
      const impact = e && typeof e.impact === 'object' ? e.impact : {};
      const bullets = (e?.bullets || []).map((b) => String(b || '').trim()).filter(Boolean);
      const infer = (re) => bullets.find((b) => re.test(b)) || '';
      const metrics = [];
      const push = (label, val) => {
        const v = String(val || '').trim();
        if (v) metrics.push({ label, value: v });
      };
      push('Result', e?.result || impact.result || infer(/\b\d+[\d,.]*\s*%|\b(increased|grew|improved|reduced|delivered)\b/i));
      push('Revenue', e?.revenue || impact.revenue || infer(/\$|revenue|ARR|MRR|margin|EBITDA/i));
      push('Team', e?.teamSize || e?.team || impact.teamSize || impact.team || infer(/\b\d+[\d,]*\+?\s*(?:people|employees|FTE|team|direct reports)\b/i));
      push(
        'Achievement',
        e?.achievement || impact.achievement || bullets.find((b) => /\b(award|promoted|launched|built|led|scaled|acquired)\b/i.test(b)) || bullets[0]
      );
      const seen = new Set();
      return metrics.filter((m) => {
        const key = `${m.label}:${m.value}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    function formatExecutiveLuxuryExperienceHtml(e) {
      if (typeof e === 'string') return formatExperienceEntryHtml(e);
      const rows = [];
      const role = String(e.role || '').trim();
      const company = String(e.company || '').trim();
      const dates = String(e.dates || '').trim();
      const bullets = (e.bullets || []).map((b) => String(b || '').trim()).filter(Boolean);
      const metrics = luxuryImpactFromEntry(e);
      if (role) rows.push(`<p class="cvExpRole cvLuxuryExpRole" contenteditable>${esc(role)}</p>`);
      if (company || dates) {
        rows.push(`<p class="cvLuxuryExpMeta" contenteditable>${esc([company, dates].filter(Boolean).join(' · '))}</p>`);
      }
      if (metrics.length) {
        rows.push(
          `<div class="cvLuxuryImpact">${metrics
            .map((m) => `<div class="cvLuxuryImpactItem"><span class="cvLuxuryImpactLabel">${esc(m.label)}</span><span class="cvLuxuryImpactValue" contenteditable>${esc(m.value)}</span></div>`)
            .join('')}</div>`
        );
      }
      for (const b of bullets) rows.push(`<p class="cvLuxuryExpBullet" contenteditable>${esc(b)}</p>`);
      if (!rows.length) return '';
      return `<article class="cvLuxuryExpEntry">${rows.join('')}</article>`;
    }

    function headExecutiveLuxury(p) {
      const c = contact(p);
      return `<header class="cvHead cvHead--executive-luxury"><div class="cvLuxuryMasthead"><div class="cvLuxuryRibbon" aria-hidden="true"></div>${photoSlot()}${identityNameHtml(p)}${identityTitleHtml(p)}${c ? `<p class="cvLuxuryContact" contenteditable>${c}</p>` : ''}</div></header>`;
    }

    function executiveSummarySection(p) {
      if (!p.summary) return '';
      return `<section class="cvSection cvSection--summary cvSection--executive-summary"><h3 class="cvSectionTitle">Executive Summary</h3><div class="cvSectionBody"><p class="cvLuxurySummary" contenteditable>${esc(p.summary)}</p></div></section>`;
    }

    function leadershipExperienceLuxury(p) {
      const entries = (p.experiences || p.experience || []).filter(Boolean);
      if (!entries.length) return '';
      const body = `<div class="cvLuxuryExpList">${entries.map((x) => formatExecutiveLuxuryExperienceHtml(x)).join('')}</div>`;
      return `<section class="cvSection cvSection--experience cvSection--primary cvSection--leadership"><h3 class="cvSectionTitle">Leadership Experience</h3><div class="cvSectionBody">${body}</div></section>`;
    }

    function achievementsSectionLuxury(p) {
      const items = [...(p.achievements || []), ...(p.awards || [])].filter(Boolean);
      if (!items.length) return '';
      const body = items.map((x) => `<p class="cvLuxuryAchievement" contenteditable>${esc(x)}</p>`).join('');
      return `<section class="cvSection cvSection--achievements"><h3 class="cvSectionTitle">Achievements</h3><div class="cvSectionBody">${body}</div></section>`;
    }

    function luxuryLineSection(slug, title, text) {
      if (!text) return '';
      return `<section class="cvSection cvSection--${slug}"><h3 class="cvSectionTitle">${esc(title)}</h3><div class="cvSectionBody"><p class="cvLuxuryLine" contenteditable>${esc(text)}</p></div></section>`;
    }

    function languagesSectionLuxury(p) {
      if (!p.languages || !p.languages.length) return '';
      const lines = p.languages.map((x) => normalizeCvDash(x)).filter(Boolean);
      if (!lines.length) return '';
      return `<section class="cvSection cvSection--languages"><h3 class="cvSectionTitle">${esc(sectionLabel('languages'))}</h3><div class="cvSectionBody">${lines.map((x) => `<p class="cvLuxuryLangLine" contenteditable>${esc(x)}</p>`).join('')}</div></section>`;
    }

    function stackExecutiveLuxury(p) {
      const parts = [];
      parts.push(executiveSummarySection(p));
      parts.push(leadershipExperienceLuxury(p));
      parts.push(clientsSection(p, 'hero'));
      parts.push(projectsSection(p));
      parts.push(achievementsSectionLuxury(p));
      if (p.education && p.education.length) parts.push(educationBlock(p));
      if (p.skills && p.skills.length) {
        parts.push(
          `<section class="cvSection cvSection--skills"><h3 class="cvSectionTitle">${esc(sectionLabel('skills') || 'Skills')}</h3><div class="cvSectionBody">${cvSkillsHtml(p.skills, false)}</div></section>`
        );
      }
      if (p.tools && p.tools.length) {
        parts.push(
          `<section class="cvSection cvSection--tools"><h3 class="cvSectionTitle">${esc(sectionLabel('tools') || 'Tools')}</h3><div class="cvSectionBody">${compactToolsHtml(p.tools)}</div></section>`
        );
      }
      parts.push(languagesSectionLuxury(p));
      return parts.filter(Boolean);
    }

    function layoutExecutiveLuxury(p) {
      const head = headExecutiveLuxury(p);
      const main = stackExecutiveLuxury(p);
      return wrapV2(
        'luxury-executive',
        'cvLayout-luxury-executive cvLayout-executive-luxury',
        `${head}<main class="cvMain cvMain--executive-luxury cvMain--luxury-executive">${main.join('')}</main>`
      );
    }

    function headSwissEditorial(p) {
      const c = contact(p, '<br>');
      return `<header class="cvHead cvHead--swiss-editorial"><div class="cvSwissMasthead"><div class="cvSwissMastheadPrimary">${identityNameHtml(p)}${identityTitleHtml(p)}</div>${c ? `<div class="cvSwissMastheadAside"><p class="cvSwissContact" contenteditable>${c}</p></div>` : ''}</div></header>`;
    }

    function swissSidebarSection(slug, title, inner) {
      if (!inner) return '';
      return `<section class="cvSection cvSection--compact cvSection--${slug} cvSection--swiss-side"><h3 class="cvSectionTitle">${esc(title)}</h3><div class="cvSectionBody">${inner}</div></section>`;
    }

    function swissSummarySection(p) {
      if (!p.summary) return '';
      const title = sectionLabel('profile');
      const label = title && title !== 'profile' ? title : 'Profile';
      return `<section class="cvSection cvSection--summary cvSection--swiss-summary"><h3 class="cvSectionTitle">${esc(label)}</h3><div class="cvSectionBody"><p class="cvSwissLead" contenteditable>${esc(p.summary)}</p></div></section>`;
    }

    function stackSwissEditorial(p) {
      const secCount = countPopulatedSectionsForDensity(p);
      if (secCount >= 5) {
        const builders = {
          summary: () => swissSummarySection(p),
          experience: () => experienceSection(p, 'tight'),
          clients: () => clientsSection(p, 'hero'),
          projects: () => projectsSection(p),
          portfolio: () => '',
          education: () => (p.education && p.education.length ? educationBlock(p) : ''),
          skills: () =>
            p.skills && p.skills.length
              ? swissSidebarSection(
                  'skills',
                  sectionLabel('skills') || 'Skills',
                  `<p class="cvSwissLine cvSkillLine" contenteditable>${esc(p.skills.join(' · '))}</p>`
                )
              : '',
          tools: () => {
            if (!p.tools || !p.tools.length) return '';
            const toolsTitle = sectionLabel('tools');
            return swissSidebarSection(
              'tools',
              toolsTitle && toolsTitle !== 'tools' ? toolsTitle : 'Tools',
              `<p class="cvSwissLine cvToolsLine" contenteditable>${esc(p.tools.join(' · '))}</p>`
            );
          },
          languages: () => {
            if (!p.languages || !p.languages.length) return '';
            const langs = p.languages
              .map((x) => `<p class="cvSwissLangLine cvLangLine" contenteditable>${esc(normalizeCvDash(x))}</p>`)
              .join('');
            return swissSidebarSection('languages', sectionLabel('languages') || 'Languages', langs);
          },
        };
        return stackFromSectionOrder(p, builders);
      }
      const mainCol = [];
      mainCol.push(experienceSection(p, 'tight'));
      mainCol.push(clientsSection(p));
      mainCol.push(projectsSection(p));
      const sideCol = [];
      if (p.education && p.education.length) sideCol.push(educationBlock(p));
      if (p.skills && p.skills.length) {
        sideCol.push(swissSidebarSection('skills', sectionLabel('skills') || 'Skills', `<p class="cvSwissLine" contenteditable>${esc(p.skills.join(' · '))}</p>`));
      }
      if (p.tools && p.tools.length) {
        const toolsTitle = sectionLabel('tools');
        sideCol.push(swissSidebarSection('tools', toolsTitle && toolsTitle !== 'tools' ? toolsTitle : 'Tools', `<p class="cvSwissLine" contenteditable>${esc(p.tools.join(' · '))}</p>`));
      }
      if (p.languages && p.languages.length) {
        const langs = p.languages
          .map((x) => `<p class="cvSwissLangLine" contenteditable>${esc(normalizeCvDash(x))}</p>`)
          .join('');
        sideCol.push(swissSidebarSection('languages', sectionLabel('languages') || 'Languages', langs));
      }
      const parts = [];
      parts.push(swissSummarySection(p));
      parts.push(
        `<div class="cvSwissGrid"><div class="cvSwissCol cvSwissCol--main">${mainCol.join('')}</div><aside class="cvSwissCol cvSwissCol--side">${sideCol.join('')}</aside></div>`
      );
      return parts.filter(Boolean);
    }

    function layoutSwissEditorial(p) {
      const head = headSwissEditorial(p);
      const main = stackSwissEditorial(p);
      const stacked = countPopulatedSectionsForDensity(p) >= 5;
      const mainCls = stacked ? 'cvMain cvMain--swiss-editorial cvMain--swiss-stacked' : 'cvMain cvMain--swiss-editorial';
      return wrap(
        'swiss-editorial',
        'cvLayout-swiss-editorial cvLayout-h20-swiss-editorial',
        `${head}<main class="${mainCls}">${main.join('')}</main>`
      );
    }

    function layoutPortfolioArtist(p, tplId = 'portfolio-artist') {
      const head = headSplit(p, { summaryInHead: true }, 'cvHead--portfolio');
      const main = stackUniversal(p, {
        summaryInHead: true,
        expDensity: 'tight',
        clientVariant: 'hero',
        includePortfolio: true,
        metaGrid: true,
        metaCols: '2',
      });
      const layoutCls =
        tplId === 'creative-portfolio'
          ? 'cvLayout-portfolio cvLayout-h20-creative-portfolio'
          : 'cvLayout-portfolio cvLayout-h20-portfolio-artist';
      return wrap(tplId, layoutCls, `${head}<main class="cvMain cvMain--portfolio">${main.join('')}</main>`);
    }

    function layoutBehanceCreative(p) {
      const head = headGrid(p, '', { summaryInHead: true });
      const main = stackUniversal(p, {
        summaryInHead: true,
        expDensity: 'tight',
        clientVariant: 'hero',
        includePortfolio: true,
        metaGrid: true,
        metaCols: '2',
      });
      return wrap('behance-showcase', 'cvLayout-behance cvLayout-h20-behance-showcase', `${head}<main class="cvMain cvMain--behance">${main.join('')}</main>`);
    }

    function editorialLineSection(slug, title, inner) {
      if (!inner) return '';
      const compact = slug === 'tools' || slug === 'clients' || slug === 'languages' ? ' cvSection--compact' : '';
      return `<section class="cvSection cvSection--${slug} cvSection--editorial${compact}"><h3 class="cvEmSectionTitle">${esc(title)}</h3><div class="cvSectionBody cvEmSectionBody">${inner}</div></section>`;
    }

    function headEditorialMagazine(p) {
      const deck = p.summary ? `<p class="cvEmDeck" contenteditable>${esc(p.summary)}</p>` : '';
      const c = contact(p);
      return `<header class="cvHead cvHead--editorial-magazine cvEmCover">${photoSlot()}<span class="cvEmKicker">Résumé</span>${identityNameHtml(p).replace('class="cvName"', 'class="cvName cvEmName"')}${identityTitleHtml(p).replace('class="cvTitle"', 'class="cvTitle cvEmTitle"')}${deck}${c ? `<p class="cvEmContact" contenteditable>${c}</p>` : ''}</header>`;
    }

    function editorialClientsSection(p) {
      if (!p.clients || !p.clients.length) return '';
      const body = `<p class="cvEmClientLine" contenteditable>${esc(p.clients.join(' · '))}</p>`;
      return editorialLineSection('clients', sectionLabel('clients') || 'Selected', body);
    }

    function editorialProjectsSection(p) {
      if (!p.projects || !p.projects.length) return '';
      const body = p.projects.map((x) => `<p class="cvEmProjectLine" contenteditable>${esc(x)}</p>`).join('');
      return editorialLineSection('projects', sectionLabel('projects') || 'Projects', body);
    }

    function editorialExperienceSection(p) {
      if (!p.experience?.length && !(p.experiences || []).length) return '';
      return `<section class="cvSection cvSection--experience cvSection--primary cvSection--editorial cvSection--editorial-feature"><h3 class="cvEmSectionTitle cvEmSectionTitle--feature">${esc(sectionLabel('experience') || 'Experience')}</h3><div class="cvSectionBody cvEmSectionBody">${experienceHtml(p, 'tight')}</div></section>`;
    }

    function stackEditorialMagazine(p) {
      const left = [];
      if (p.education && p.education.length) left.push(educationBlock(p));
      if (p.languages && p.languages.length) {
        left.push(
          editorialLineSection(
            'languages',
            sectionLabel('languages') || 'Languages',
            compactLanguagesHtml(p.languages)
          )
        );
      }
      const center = [editorialExperienceSection(p)];
      const right = [];
      if (p.skills && p.skills.length) {
        right.push(
          editorialLineSection('skills', sectionLabel('skills') || 'Skills', `<p class="cvEmMetaLine" contenteditable>${esc(p.skills.join(' · '))}</p>`)
        );
      }
      if (p.tools && p.tools.length) {
        const toolsTitle = sectionLabel('tools');
        right.push(
          editorialLineSection('tools', toolsTitle && toolsTitle !== 'tools' ? toolsTitle : 'Tools', `<p class="cvEmMetaLine cvToolsLine" contenteditable>${esc(p.tools.join(' · '))}</p>`)
        );
      }
      right.push(editorialClientsSection(p));
      right.push(editorialProjectsSection(p));
      const portfolio = portfolioLinksSection(p);
      if (portfolio) {
        right.push(portfolio.replace(/cvSectionTitle/g, 'cvEmSectionTitle').replace(/cvSection--portfolio/g, 'cvSection--portfolio cvSection--editorial'));
      }
      return `<div class="cvEmSpread cvBody cvBody--magazine"><aside class="cvEmCol cvEmCol--left">${left.filter(Boolean).join('')}</aside><main class="cvEmCol cvEmCol--feature">${center.filter(Boolean).join('')}</main><aside class="cvEmCol cvEmCol--right">${right.filter(Boolean).join('')}</aside></div>`;
    }

    function layoutEditorialMagazine(p, tplId = 'magazine-editorial') {
      const head = headEditorialMagazine(p);
      const body = stackEditorialMagazine(p);
      const layoutCls =
        tplId === 'editorial-magazine'
          ? 'cvLayout-editorial-magazine cvLayout-h20-editorial-magazine'
          : 'cvLayout-editorial-magazine cvLayout-h20-magazine-editorial';
      return wrap(tplId, layoutCls, `${head}${body}`);
    }

    function layoutLuxuryMinimal(p) {
      const head = headCentered(p, '', { summaryInHead: true }, 'cvHead--luxury-minimal');
      const main = stackUniversal(p, {
        summaryInHead: true,
        expDensity: 'tight',
        includePortfolio: true,
        metaGrid: true,
        metaCols: '2',
      });
      return wrap(
        'luxury-minimal',
        'cvLayout-luxury-minimal cvLayout-h20-luxury-minimal',
        `${head}<main class="cvMain cvMain--luxury-minimal">${main.join('')}</main>`
      );
    }

    function layoutTechStructured(p) {
      const head = headClassic(p, '', 'cvHead--tech-structured', { summaryInHead: true });
      const side = sideBlocksMeta(p, { chips: true });
      const main = [experienceSection(p, 'tight'), clientsSection(p), projectsSection(p)];
      if (p.education && p.education.length) main.push(educationBlock(p));
      const body = `<div class="cvBody cvBody--tech-structured"><aside class="cvSide cvSide--tech-structured">${side.join('')}</aside><main class="cvMain cvMain--tech-structured">${main.filter(Boolean).join('')}</main></div>`;
      return wrap('tech-structured', 'cvLayout-tech-structured cvLayout-h20-tech-structured', `${head}${body}`);
    }

    function startupTractionItems(p) {
      const fromAchievements = [...(p.achievements || []), ...(p.awards || [])].filter(Boolean);
      if (fromAchievements.length >= 2) return fromAchievements.slice(0, 3);
      const metrics = [];
      for (const e of p.experiences || []) {
        for (const b of e.bullets || []) {
          const line = String(b || '').trim();
          if (line && /\d/.test(line) && metrics.length < 3) metrics.push(line);
        }
      }
      if (metrics.length) return metrics;
      return fromAchievements.slice(0, 3);
    }

    function headStartupBuilder(p) {
      const thesis = p.summary ? `<p class="cvSbThesis" contenteditable>${esc(p.summary)}</p>` : '';
      const c = contact(p);
      return `<header class="cvHead cvHead--startup-builder cvSbHero">${photoSlot()}${identityNameHtml(p)}${identityTitleHtml(p)}${thesis}${c ? `<p class="cvSbContact" contenteditable>${c}</p>` : ''}</header>`;
    }

    function startupTractionSection(p) {
      const items = startupTractionItems(p);
      if (!items.length) return '';
      const body = items
        .map((x, i) => `<div class="cvSbMetric"><span class="cvSbMetricIdx">0${i + 1}</span><p class="cvSbMetricText" contenteditable>${esc(x)}</p></div>`)
        .join('');
      return `<section class="cvSection cvSection--traction cvSection--startup"><h3 class="cvSectionTitle">Traction</h3><div class="cvSectionBody"><div class="cvSbTraction">${body}</div></div></section>`;
    }

    function startupSkillsSection(p) {
      if (!p.skills || !p.skills.length) return '';
      return `<section class="cvSection cvSection--compact cvSection--skills cvSection--startup-side"><h3 class="cvSectionTitle">${esc(sectionLabel('skills') || 'Skills')}</h3><div class="cvSectionBody">${cvSkillsHtml(p.skills, true)}</div></section>`;
    }

    function startupToolsSection(p) {
      if (!p.tools || !p.tools.length) return '';
      const title = sectionLabel('tools');
      return `<section class="cvSection cvSection--compact cvSection--tools cvSection--startup-side"><h3 class="cvSectionTitle">${esc(title && title !== 'tools' ? title : 'Tools')}</h3><div class="cvSectionBody">${compactToolsHtml(p.tools)}</div></section>`;
    }

    function startupLanguagesSection(p) {
      if (!p.languages || !p.languages.length) return '';
      const body = p.languages.map((x) => `<p class="cvSbLang" contenteditable>${esc(normalizeCvDash(x))}</p>`).join('');
      return `<section class="cvSection cvSection--languages cvSection--startup-side"><h3 class="cvSectionTitle">${esc(sectionLabel('languages') || 'Languages')}</h3><div class="cvSectionBody">${body}</div></section>`;
    }

    function startupImpactSection(p) {
      if (!p.experience?.length && !(p.experiences || []).length) return '';
      return `<section class="cvSection cvSection--experience cvSection--primary cvSection--startup-impact"><h3 class="cvSectionTitle">Roles &amp; Impact</h3><div class="cvSectionBody">${experienceHtml(p, 'tight')}</div></section>`;
    }

    function stackStartupBuilder(p) {
      const side = [startupSkillsSection(p), startupToolsSection(p), startupLanguagesSection(p)].filter(Boolean);
      const main = [startupImpactSection(p), clientsSection(p, 'hero'), projectsSection(p)].filter(Boolean);
      if (p.education && p.education.length) main.push(educationBlock(p));
      const parts = [startupTractionSection(p)];
      parts.push(
        `<div class="cvSbSplit"><aside class="cvSbRail">${side.join('')}</aside><div class="cvSbMain">${main.join('')}</div></div>`
      );
      return parts.filter(Boolean);
    }

    function layoutStartupBuilder(p) {
      const head = headStartupBuilder(p);
      const main = stackStartupBuilder(p);
      return wrap(
        'startup-builder',
        'cvLayout-startup-builder cvLayout-h20-startup-builder',
        `${head}<main class="cvMain cvMain--startup-builder">${main.join('')}</main>`
      );
    }

    function layoutLuxuryFashion(p) {
      const head = headCentered(p, '', { summaryInHead: true }, 'cvHead--luxury');
      const main = stackUniversal(p, {
        summaryInHead: true,
        expDensity: 'tight',
        includePortfolio: true,
        metaGrid: true,
        metaCols: '3',
      });
      return wrap('luxury-fashion', 'cvLayout-luxury-fashion cvLayout-h20-luxury-fashion', `${head}<main class="cvMain cvMain--luxury">${main.join('')}</main>`);
    }

    function layoutAgencyDesigner(p) {
      const head = headClassic(p, '', 'cvHead--agency-band', { summaryInHead: true });
      const side = sideBlocksMeta(p, { chips: false });
      const portfolio = portfolioLinksSection(p);
      const main = [
        experienceSection(p, 'tight'),
        clientsSection(p),
        projectsSection(p),
      ];
      if (p.education && p.education.length) main.push(educationBlock(p));
      const body = `<div class="cvBody cvBody--agency"><aside class="cvSide cvSide--agency">${side.join('')}${portfolio}</aside><main class="cvMain cvMain--agency">${main.filter(Boolean).join('')}</main></div>`;
      return wrap('agency-designer', 'cvLayout-agency-designer cvLayout-h20-agency-designer', `${head}${body}`);
    }

    function layoutMinimalSwiss(p) {
      const head = headClassic(p, '', 'cvHead--swiss', { summaryInHead: true });
      const main = stackUniversal(p, {
        summaryInHead: true,
        expDensity: 'tight',
        includePortfolio: true,
        metaGrid: true,
        metaCols: '3',
      });
      return wrap('minimal-swiss', 'cvLayout-swiss cvLayout-h20-minimal-swiss', `${head}<main class="cvMain cvMain--swiss">${main.join('')}</main>`);
    }

    function formatVisualTimelineEntryContent(e) {
      if (typeof e === 'string') {
        const s = normalizeCvDash(String(e || '').trim());
        if (!s) return '';
        let bullets = [];
        let head = s;
        const colonIdx = s.lastIndexOf(':');
        if (colonIdx > 0) {
          const before = s.slice(0, colonIdx).trim();
          const after = s.slice(colonIdx + 1).trim();
          if (after && before.includes('—')) {
            head = before;
            bullets = after.split(/\s*·\s*/).map((b) => b.trim()).filter(Boolean);
          }
        }
        const parts = head.split(/\s*—\s*/).map((p) => p.trim()).filter(Boolean);
        const role = parts[0] || '';
        const company = parts[1] || '';
        const years = parts[2] || '';
        const rows = [];
        if (role) rows.push(`<h4 class="cvExpRole cvVtRole" contenteditable>${esc(role)}</h4>`);
        if (company) rows.push(`<p class="cvVtCompany" contenteditable>${esc(company)}</p>`);
        if (years) rows.push(`<p class="cvVtYears" contenteditable>${esc(years)}</p>`);
        if (bullets.length) {
          rows.push(`<ul class="cvVtHighlights">${bullets.map((b) => `<li contenteditable>${esc(b)}</li>`).join('')}</ul>`);
        }
        return rows.join('');
      }
      const role = String(e.role || '').trim();
      const company = String(e.company || '').trim();
      const years = String(e.dates || '').trim();
      const bullets = (e.bullets || []).map((b) => String(b || '').trim()).filter(Boolean);
      const desc = String(e.rewrittenDescription || e.description || '').trim();
      const highlights = bullets.length ? bullets : desc ? [desc] : [];
      const rows = [];
      if (role) rows.push(`<h4 class="cvExpRole cvVtRole" contenteditable>${esc(role)}</h4>`);
      if (company) rows.push(`<p class="cvVtCompany" contenteditable>${esc(company)}</p>`);
      if (years) rows.push(`<p class="cvVtYears" contenteditable>${esc(years)}</p>`);
      if (highlights.length) {
        rows.push(`<ul class="cvVtHighlights">${highlights.map((b) => `<li contenteditable>${esc(b)}</li>`).join('')}</ul>`);
      }
      return rows.join('');
    }

    function visualTimelineRailHtml(p) {
      const entries = (p.experiences || p.experience || []).filter(Boolean);
      if (!entries.length) return '';
      return entries
        .map((e) => {
          const body = formatVisualTimelineEntryContent(e);
          if (!body) return '';
          return `<article class="cvVtNode"><div class="cvVtSpine" aria-hidden="true"><span class="cvVtDot"></span></div><div class="cvVtBody">${body}</div></article>`;
        })
        .filter(Boolean)
        .join('');
    }

    function visualTimelineSection(p) {
      const rail = visualTimelineRailHtml(p);
      if (!rail) return '';
      return `<section class="cvSection cvSection--experience cvSection--primary cvSection--visual-timeline"><h3 class="cvSectionTitle">Career Timeline</h3><div class="cvSectionBody"><div class="cvVtRail">${rail}</div></div></section>`;
    }

    function visualTimelineConnectedSection(p) {
      const hasClients = p.clients && p.clients.length;
      const hasProjects = p.projects && p.projects.length;
      if (!hasClients && !hasProjects) return '';
      const clientBlock = hasClients
        ? `<div class="cvVtBranch cvVtBranch--clients"><div class="cvVtBranchConnector" aria-hidden="true"></div><div class="cvVtBranchContent"><h4 class="cvVtBranchTitle">Clients</h4><div class="cvVtBranchItems">${p.clients
            .map((c) => `<span class="cvVtBranchTag" contenteditable>${esc(c)}</span>`)
            .join('')}</div></div></div>`
        : '';
      const projectBlock = hasProjects
        ? `<div class="cvVtBranch cvVtBranch--projects"><div class="cvVtBranchConnector" aria-hidden="true"></div><div class="cvVtBranchContent"><h4 class="cvVtBranchTitle">Projects</h4><div class="cvVtBranchItems">${p.projects
            .map((x) => `<p class="cvVtBranchProject" contenteditable>${esc(x)}</p>`)
            .join('')}</div></div></div>`
        : '';
      return `<section class="cvSection cvSection--connected cvSection--visual-connected"><h3 class="cvSectionTitle">Connected Work</h3><div class="cvSectionBody"><div class="cvVtConnected">${clientBlock}${projectBlock}</div></div></section>`;
    }

    function vtLineSection(slug, title, text) {
      if (!text) return '';
      return `<section class="cvSection cvSection--${slug} cvSection--vt-meta"><h3 class="cvSectionTitle">${esc(title)}</h3><div class="cvSectionBody"><p class="cvVtLine" contenteditable>${esc(text)}</p></div></section>`;
    }

    function headVisualTimeline(p) {
      const lead = p.summary ? `<p class="cvVtLead" contenteditable>${esc(p.summary)}</p>` : '';
      const c = contact(p);
      return `<header class="cvHead cvHead--visual-timeline">${identityNameHtml(p)}${identityTitleHtml(p)}${lead}${c ? `<p class="cvVtContact" contenteditable>${c}</p>` : ''}</header>`;
    }

    function stackVisualTimeline(p) {
      const parts = [];
      parts.push(visualTimelineSection(p));
      parts.push(visualTimelineConnectedSection(p));
      if (p.education && p.education.length) parts.push(educationBlock(p));
      if (p.skills && p.skills.length) {
        parts.push(vtLineSection('skills', sectionLabel('skills') || 'Skills', p.skills.join(' · ')));
      }
      if (p.tools && p.tools.length) {
        const toolsTitle = sectionLabel('tools');
        parts.push(vtLineSection('tools', toolsTitle && toolsTitle !== 'tools' ? toolsTitle : 'Tools', p.tools.join(' · ')));
      }
      if (p.languages && p.languages.length) {
        const langs = p.languages.map((x) => `<p class="cvVtLangLine" contenteditable>${esc(normalizeCvDash(x))}</p>`).join('');
        parts.push(`<section class="cvSection cvSection--languages cvSection--vt-meta"><h3 class="cvSectionTitle">${esc(sectionLabel('languages'))}</h3><div class="cvSectionBody">${langs}</div></section>`);
      }
      return parts.filter(Boolean);
    }

    function layoutVisualTimeline(p) {
      const head = headVisualTimeline(p);
      const main = stackVisualTimeline(p);
      return wrap(
        'visual-timeline',
        'cvLayout-visual-timeline cvLayout-h20-visual-timeline',
        `${head}<main class="cvMain cvMain--visual-timeline">${main.join('')}</main>`
      );
    }

    function directorClientLogos(p) {
      const raw = Array.isArray(p.clientLogos) ? p.clientLogos : [];
      return raw
        .map((item) => {
          if (!item) return null;
          if (typeof item === 'string') {
            const url = item.trim();
            return url ? { name: '', url } : null;
          }
          const name = String(item.name || item.label || '').trim();
          const url = String(item.url || item.src || item.logo || '').trim();
          return url ? { name, url } : null;
        })
        .filter(Boolean);
    }

    function headCreativeDirector(p) {
      const lead = p.summary ? `<p class="cvDirectorLead" contenteditable>${esc(p.summary)}</p>` : '';
      const c = contact(p);
      return `<header class="cvHead cvHead--director">${photoSlot()}<div class="cvDirectorIdentity">${identityNameHtml(p)}${identityTitleHtml(p)}${lead}${c ? `<p class="cvDirectorContact" contenteditable>${c}</p>` : ''}</div></header>`;
    }

    function clientsSectionDirector(p) {
      if (!p.clients || !p.clients.length) return '';
      const logos = directorClientLogos(p);
      let inner = '';
      if (logos.length) {
        inner = `<div class="cvDirectorClientLogos">${logos
          .map((logo, i) => {
            const name = logo.name || p.clients[i] || p.clients[0] || 'Client';
            return `<figure class="cvDirectorClientLogo"><img class="cvDirectorClientLogoImg" src="${esc(logo.url)}" alt="${esc(name)}" loading="lazy" /><figcaption class="cvDirectorClientLogoCap" contenteditable>${esc(name)}</figcaption></figure>`;
          })
          .join('')}</div>`;
      } else {
        inner = `<div class="cvDirectorClientGrid">${p.clients
          .map((c) => `<span class="cvDirectorClientName" contenteditable>${esc(c)}</span>`)
          .join('')}</div>`;
      }
      return `<section class="cvSection cvSection--clients cvSection--clients-director"><h3 class="cvSectionTitle">Selected Clients</h3><div class="cvSectionBody">${inner}</div></section>`;
    }

    function formatDirectorProjectHtml(line) {
      const s = normalizeCvDash(String(line || '').trim());
      if (!s) return '';
      const parts = s.split(/\s*—\s*/).map((x) => x.trim()).filter(Boolean);
      if (parts.length >= 2) {
        return `<article class="cvDirectorProject"><h4 class="cvDirectorProjectTitle" contenteditable>${esc(parts[0])}</h4><p class="cvDirectorProjectMeta" contenteditable>${esc(parts.slice(1).join(' — '))}</p></article>`;
      }
      return `<article class="cvDirectorProject"><p class="cvDirectorProjectTitle" contenteditable>${esc(s)}</p></article>`;
    }

    function projectsSectionDirector(p) {
      if (!p.projects || !p.projects.length) return '';
      const body = `<div class="cvDirectorProjects">${p.projects.map((x) => formatDirectorProjectHtml(x)).join('')}</div>`;
      return `<section class="cvSection cvSection--projects cvSection--projects-director"><h3 class="cvSectionTitle">Selected Projects</h3><div class="cvSectionBody">${body}</div></section>`;
    }

    function directorLineSection(slug, title, text) {
      if (!text) return '';
      return `<section class="cvSection cvSection--${slug} cvSection--director-meta"><h3 class="cvSectionTitle">${esc(title)}</h3><div class="cvSectionBody"><p class="cvDirectorLine" contenteditable>${esc(text)}</p></div></section>`;
    }

    function stackCreativeDirector(p) {
      const parts = [];
      parts.push(experienceTimelineSection(p));
      parts.push(clientsSectionDirector(p));
      parts.push(projectsSectionDirector(p));
      if (p.skills && p.skills.length) {
        parts.push(
          `<section class="cvSection cvSection--skills cvSection--director-meta"><h3 class="cvSectionTitle">${esc(sectionLabel('skills') || 'Skills')}</h3><div class="cvSectionBody">${cvSkillsHtml(p.skills, false)}</div></section>`
        );
      }
      if (p.tools && p.tools.length) {
        const toolsTitle = sectionLabel('tools');
        parts.push(
          `<section class="cvSection cvSection--tools cvSection--director-meta"><h3 class="cvSectionTitle">${esc(toolsTitle && toolsTitle !== 'tools' ? toolsTitle : 'Tools')}</h3><div class="cvSectionBody">${compactToolsHtml(p.tools)}</div></section>`
        );
      }
      if (p.education && p.education.length) parts.push(educationBlock(p));
      if (p.languages && p.languages.length) {
        const langs = p.languages.map((x) => `<p class="cvLangLine cvDirectorLine" contenteditable>${esc(normalizeCvDash(x))}</p>`).join('');
        parts.push(
          `<section class="cvSection cvSection--languages cvSection--director-meta"><h3 class="cvSectionTitle">${esc(sectionLabel('languages') || 'Languages')}</h3><div class="cvSectionBody">${langs}</div></section>`
        );
      }
      return parts.filter(Boolean);
    }

    function layoutCreativeDirector(p) {
      const head = headCreativeDirector(p);
      const main = stackCreativeDirector(p);
      return wrap(
        'creative-director',
        'cvLayout-director cvLayout-h20-creative-director',
        `${head}<main class="cvMain cvMain--director">${main.join('')}</main>`
      );
    }

    function layoutModernTwoColumn(p) {
      const head = headClassic(p, '', 'cvHead--modern', { summaryInHead: true });
      const main = stackUniversal(p, { expDensity: 'tight', summaryInHead: true, metaGrid: true, metaCols: '3', chips: true });
      return wrap(
        'modern-two-column',
        'cvLayout-h20-tech cvLayout-modern-two-column',
        `${head}<main class="cvMain cvMain--tech">${main.join('')}</main>`
      );
    }

    function layoutEditorialPremium(p) {
      const head = headGrid(p, '', { summaryInHead: true });
      const main = stackUniversal(p, { expDensity: 'tight', summaryInHead: true, metaGrid: true, metaCols: '2' });
      return wrap(
        'editorial',
        'cvLayout-editorial cvLayout-h20-editorial',
        `${head}<main class="cvMain cvMain--editorial">${main.join('')}</main>`
      );
    }

    function layoutCreativeMagazine(p, tplId) {
      const id = tplId || 'creative';
      const head = headSplit(p, { summaryInHead: true });
      const main = stackUniversal(p, {
        summaryInHead: true,
        expDensity: 'tight',
        clientVariant: 'hero',
        includePortfolio: true,
        metaGrid: true,
        metaCols: '2',
      });
      return wrap(id, 'cvLayout-magazine cvLayout-h20-creative', `${head}<main class="cvMain cvMain--creative">${main.join('')}</main>`);
    }

    function layoutPremiumPortfolio(p) {
      const head = headCentered(p, '', { summaryInHead: true }, 'cvHead--premium');
      const main = stackUniversal(p, {
        summaryInHead: true,
        expDensity: 'tight',
        includePortfolio: true,
        metaGrid: true,
        metaCols: '2',
      });
      return wrap('premium', 'cvLayout-luxury cvLayout-premium', `${head}<main class="cvMain">${main.join('')}</main>`);
    }

    const CV_TEMPLATES = [
      {
        id: 'ats',
        name: 'ATS Clean',
        tier: 'free',
        category: 'Professional',
        bestFor: 'Corporate · ATS scan',
        atsSafety: 'high',
        creativeLevel: 1,
        render: (p) =>
          layoutSingle(
            'ats',
            p,
            { expDensity: 'tight', metaGrid: true, metaCols: '3', summaryInHead: true, skills: true, tools: true, langs: true },
            (px, ex, o) => headClassic(px, ex, 'cvHead--ats', o),
            '',
            '',
            'cvLayout-h20-ats'
          ),
      },
      {
        id: 'consulting-elite',
        name: 'Consulting',
        tier: 'pro',
        category: 'Consulting',
        bestFor: 'MBB · strategy · case interviews',
        atsSafety: 'high',
        creativeLevel: 2,
        render: (p) => layoutConsultingElite(p),
      },
      {
        id: 'apple-style',
        name: 'Designer',
        tier: 'pro',
        category: 'Designer',
        bestFor: 'Visual designers · brand · portfolio clarity',
        atsSafety: 'high',
        creativeLevel: 2,
        render: (p) => layoutAppleStyle(p),
      },
      {
        id: 'google-style',
        name: 'Product Manager',
        tier: 'pro',
        category: 'Product Manager',
        bestFor: 'PM · roadmap · cross-functional leadership',
        atsSafety: 'high',
        creativeLevel: 2,
        render: (p) => layoutGoogleStyle(p),
      },
      {
        id: 'startup-founder',
        name: 'Startup',
        tier: 'pro',
        category: 'Startup',
        bestFor: 'Founders · operators · venture-backed',
        atsSafety: 'high',
        creativeLevel: 3,
        render: (p) => layoutStartupFounderV3(p),
      },
      {
        id: 'creative-director',
        name: 'Creative Director',
        tier: 'pro',
        category: 'Creative Director',
        bestFor: 'Creative directors · brand studios',
        atsSafety: 'high',
        creativeLevel: 4,
        render: (p) => layoutCreativeDirectorV3(p),
      },
      {
        id: 'senior-engineer',
        name: 'Engineer',
        tier: 'pro',
        category: 'Engineer',
        bestFor: 'Staff+ engineers · systems at scale',
        atsSafety: 'high',
        creativeLevel: 2,
        render: (p) => layoutSeniorEngineer(p),
      },
      {
        id: 'executive-board',
        name: 'Executive',
        tier: 'pro',
        category: 'Executive',
        bestFor: 'C-suite · board · governance',
        atsSafety: 'high',
        creativeLevel: 2,
        render: (p) => layoutExecutiveBoard(p),
      },
      {
        id: 'minimal-ats',
        name: 'Minimal ATS',
        tier: 'pro',
        category: 'Minimal ATS',
        bestFor: 'Recruiter scan · dense parse · export',
        atsSafety: 'high',
        creativeLevel: 1,
        render: (p) => layoutMinimalAts(p),
      },
      {
        id: 'premium-ats',
        name: 'Premium ATS',
        tier: 'pro',
        category: 'Premium ATS',
        bestFor: 'Enterprise ATS · premium recruiter scan · export fidelity',
        atsSafety: 'high',
        creativeLevel: 1,
        render: (p) => layoutPremiumAts(p),
      },
      {
        id: 'luxury-editorial',
        name: 'Marketing',
        tier: 'pro',
        category: 'Marketing',
        bestFor: 'Marketing · brand · campaign storytelling',
        atsSafety: 'medium',
        creativeLevel: 5,
        render: (p) => layoutLuxuryEditorialV3(p),
      },
      {
        id: 'academic',
        name: 'Academic',
        tier: 'pro',
        category: 'Academic',
        bestFor: 'Research · teaching · PhD · faculty',
        atsSafety: 'high',
        creativeLevel: 2,
        render: (p) => layoutAcademic(p),
      },
      {
        id: 'ats-recruiter',
        name: '08 Premium ATS',
        tier: 'pro',
        category: 'ATS',
        bestFor: 'Stripe · Linear · recruiter scan · dense parse',
        atsSafety: 'high',
        creativeLevel: 1,
        render: (p) => layoutAtsRecruiter(p),
      },
      {
        id: 'mckinsey-consulting',
        name: '02 Consulting',
        tier: 'pro',
        category: 'Consulting',
        bestFor: 'McKinsey · BCG · Bain · strategy cases',
        atsSafety: 'high',
        creativeLevel: 2,
        render: (p) => layoutMcKinseyConsulting(p),
      },
      {
        id: 'apple-minimal',
        name: '07 Minimal',
        tier: 'pro',
        category: 'Minimal',
        bestFor: 'Notion · document clarity · product leadership',
        atsSafety: 'high',
        creativeLevel: 2,
        render: (p) => layoutAppleMinimal(p),
      },
      {
        id: 'kinfolk-editorial',
        name: 'Kinfolk Editorial',
        tier: 'pro',
        category: 'Editorial',
        bestFor: 'Kinfolk · culture · magazine editorial',
        atsSafety: 'medium',
        creativeLevel: 5,
        render: (p) => layoutKinfolkEditorial(p),
      },
      {
        id: 'creative-director-portfolio',
        name: '03 Creative',
        tier: 'pro',
        category: 'Creative',
        bestFor: 'Airbnb · creative directors · brand studios',
        atsSafety: 'high',
        creativeLevel: 4,
        render: (p) => layoutCreativeDirectorPortfolio(p),
      },
      {
        id: 'luxury-executive',
        name: '01 Executive',
        tier: 'pro',
        category: 'Executive',
        bestFor: 'Apple · C-suite · board roles · leadership',
        atsSafety: 'high',
        creativeLevel: 2,
        render: (p) => layoutLuxuryExecutive(p),
      },

      {
        id: 'tech-engineer',
        name: '05 Tech',
        tier: 'pro',
        category: 'Tech',
        bestFor: 'Google · engineering · systems · stack-forward',
        atsSafety: 'high',
        creativeLevel: 2,
        render: (p) => layoutTechEngineer(p),
      },
      {
        id: 'art-director',
        name: 'Art Director Portfolio',
        tier: 'pro',
        category: 'Creative',
        bestFor: 'Art directors · luxury campaigns · press',
        atsSafety: 'medium',
        creativeLevel: 5,
        render: (p) => layoutArtDirectorFamily(p),
      },
      {
        id: 'classic-corporate',
        name: 'Executive Classic',
        tier: 'pro',
        category: 'Executive',
        bestFor: 'Tesla · corporate · institutional roles',
        atsSafety: 'high',
        creativeLevel: 2,
        render: (p) => layoutClassicCorporate(p),
      },
      {
        id: 'ats-elite',
        name: 'ATS Clean',
        tier: 'pro',
        category: 'ATS',
        bestFor: 'Google · Stripe · Linear · Notion · interview-ready',
        atsSafety: 'high',
        creativeLevel: 1,
        render: (p) => layoutAtsElite(p),
      },
      {
        id: 'ats-executive',
        name: 'Executive Minimal',
        tier: 'pro',
        category: 'Executive',
        bestFor: 'Leadership · board-ready · minimal hierarchy',
        atsSafety: 'high',
        creativeLevel: 2,
        render: (p) => layoutAtsExecutive(p),
      },
      {
        id: 'executive-luxury',
        name: 'Luxury Serif',
        tier: 'pro',
        category: 'Executive',
        bestFor: 'McKinsey · BCG · Goldman Sachs · Airbnb executives',
        atsSafety: 'high',
        creativeLevel: 2,
        render: (p) => layoutExecutiveLuxury(p),
      },
      {
        id: 'swiss-editorial',
        name: 'Classic Corporate',
        tier: 'pro',
        category: 'Corporate',
        bestFor: 'Neue Grafik · Monocle · Financial Times · Swiss corporate grid',
        atsSafety: 'high',
        creativeLevel: 3,
        render: (p) => layoutSwissEditorial(p),
      },
      {
        id: 'creative-portfolio',
        name: 'Creative Portfolio',
        tier: 'pro',
        category: 'Creative',
        bestFor: 'Portfolio · case studies · creative work',
        atsSafety: 'medium',
        creativeLevel: 5,
        render: (p) => layoutPortfolioArtist(p, 'creative-portfolio'),
      },
      {
        id: 'portfolio-artist',
        name: 'Portfolio Artist',
        tier: 'pro',
        category: 'Creative',
        bestFor: 'Illustration · fine art · portfolio',
        atsSafety: 'medium',
        creativeLevel: 5,
        render: (p) => layoutPortfolioArtist(p, 'portfolio-artist'),
      },
      {
        id: 'behance-showcase',
        name: 'Behance Showcase',
        tier: 'pro',
        category: 'Creative',
        bestFor: 'Behance · digital · case studies',
        atsSafety: 'medium',
        creativeLevel: 4,
        render: (p) => layoutBehanceCreative(p),
      },
      {
        id: 'editorial-magazine',
        name: 'Designer Editorial',
        tier: 'pro',
        category: 'Editorial',
        bestFor: 'Kinfolk · Wallpaper* · Aesop · Monocle · culture',
        atsSafety: 'medium',
        creativeLevel: 5,
        render: (p) => layoutEditorialMagazine(p, 'editorial-magazine'),
      },
      {
        id: 'magazine-editorial',
        name: 'Magazine Editorial',
        tier: 'pro',
        category: 'Editorial',
        bestFor: 'Magazine · culture · editorial',
        atsSafety: 'medium',
        creativeLevel: 4,
        render: (p) => layoutEditorialMagazine(p, 'magazine-editorial'),
      },
      {
        id: 'luxury-minimal',
        name: 'Luxury Minimal',
        tier: 'pro',
        category: 'Luxury',
        bestFor: 'Luxury · minimal · refined',
        atsSafety: 'high',
        creativeLevel: 3,
        render: (p) => layoutLuxuryMinimal(p),
      },
      {
        id: 'tech-structured',
        name: 'Tech Structured',
        tier: 'pro',
        category: 'Tech',
        bestFor: 'Engineering · product · structured CV',
        atsSafety: 'high',
        creativeLevel: 2,
        render: (p) => layoutTechStructured(p),
      },
      {
        id: 'startup-builder',
        name: 'Startup Builder',
        tier: 'pro',
        category: 'Startup',
        bestFor: 'Founders · operators · venture-backed roles',
        atsSafety: 'high',
        creativeLevel: 3,
        render: (p) => layoutStartupBuilder(p),
      },
      {
        id: 'art-director-portfolio',
        name: 'Art Director Portfolio',
        tier: 'pro',
        category: 'Creative',
        bestFor: 'Luxury portfolio · Behance · campaigns · creative industry',
        atsSafety: 'medium',
        creativeLevel: 5,
        render: (p) => layoutArtDirectorPortfolio(p),
      },
      {
        id: 'luxury-fashion',
        name: 'Luxury Fashion',
        tier: 'pro',
        category: 'Luxury',
        bestFor: 'Fashion · luxury · maisons',
        atsSafety: 'medium',
        creativeLevel: 4,
        render: (p) => layoutLuxuryFashion(p),
      },
      {
        id: 'agency-designer',
        name: 'Consultant Compact',
        tier: 'pro',
        category: 'Consulting',
        bestFor: 'McKinsey · BCG · boutique consulting · compact split',
        atsSafety: 'high',
        creativeLevel: 3,
        render: (p) => layoutAgencyDesigner(p),
      },
      {
        id: 'minimal-swiss',
        name: 'Minimal Swiss',
        tier: 'pro',
        category: 'Minimal',
        bestFor: 'Swiss grid · Helvetica · precision',
        atsSafety: 'high',
        creativeLevel: 2,
        render: (p) => layoutMinimalSwiss(p),
      },
      {
        id: 'visual-timeline',
        name: 'Visual Timeline',
        tier: 'pro',
        category: 'Timeline',
        bestFor: 'Apple keynote · career arc · connected clients & projects',
        atsSafety: 'high',
        creativeLevel: 3,
        render: (p) => layoutVisualTimeline(p),
      },
      {
        id: 'creative-director',
        name: 'Creative Portfolio',
        tier: 'pro',
        category: 'Creative',
        bestFor: 'Kinfolk · Wallpaper · Nike · Adobe · Apple',
        atsSafety: 'medium',
        creativeLevel: 5,
        render: (p) => layoutCreativeDirector(p),
      },
      {
        id: 'art-director',
        name: 'Art Director',
        tier: 'pro',
        category: 'Leadership',
        bestFor: 'Art direction · campaigns · brands',
        atsSafety: 'medium',
        creativeLevel: 5,
        render: (p) => layoutArtDirector(p),
      },
      {
        id: 'illustrator-portfolio',
        name: 'Illustrator Portfolio',
        tier: 'pro',
        category: 'Creative',
        bestFor: 'Illustration · editorial · fine art',
        atsSafety: 'medium',
        creativeLevel: 5,
        render: (p) => layoutIllustratorPortfolio(p),
      },
    ];

    const ALIASES = {
      ats: 'ats',
      'modern-clean': 'ats',
      'ats-clean': 'ats',
      'minimal-ats': 'minimal-ats',
      compactrecruiter: 'minimal-ats',
      'ats-recruiter': 'minimal-ats',
      'premium-ats': 'minimal-ats',
      'ats-elite': 'minimal-ats',
      academic: 'minimal-ats',
      'academic-cv': 'minimal-ats',
      research: 'minimal-ats',
      'creative-portfolio': 'creative-portfolio',
      creative: 'creative-portfolio',
      creativeportfolio: 'creative-portfolio',
      'portfolio-artist': 'creative-portfolio',
      'creative-director': 'creative-portfolio',
      'creative-director-portfolio': 'creative-portfolio',
      'behance-showcase': 'creative-portfolio',
      'art-director': 'creative-portfolio',
      'art-director-portfolio': 'creative-portfolio',
      'illustrator-portfolio': 'creative-portfolio',
      pentagram: 'creative-portfolio',
      creativedirector: 'creative-portfolio',
      motiondesigner: 'creative-portfolio',
      'motion-designer': 'creative-portfolio',
      motion: 'creative-portfolio',
      artdirector: 'creative-portfolio',
      illustrator: 'creative-portfolio',
      'premium-creatif': 'creative-portfolio',
      modernportfolio: 'creative-portfolio',
      'modern-portfolio': 'creative-portfolio',
      creatif: 'creative-portfolio',
      premium: 'creative-portfolio',
      'editorial-magazine': 'editorial-magazine',
      'magazine-editorial': 'editorial-magazine',
      'kinfolk-editorial': 'editorial-magazine',
      editorial: 'editorial-magazine',
      'luxury-editorial': 'editorial-magazine',
      'swiss-editorial': 'editorial-magazine',
      designer: 'editorial-magazine',
      marketing: 'editorial-magazine',
      'apple-style': 'editorial-magazine',
      'apple-minimal': 'editorial-magazine',
      apple: 'editorial-magazine',
      'visual-timeline': 'editorial-magazine',
      timeline: 'editorial-magazine',
      'minimal-swiss': 'editorial-magazine',
      'modern-minimal': 'editorial-magazine',
      'luxury-minimal': 'editorial-magazine',
      minimal: 'editorial-magazine',
      'premium-moderne': 'editorial-magazine',
      swiss: 'editorial-magazine',
      swisspro: 'editorial-magazine',
      'classic-corporate': 'classic-corporate',
      corporate: 'classic-corporate',
      '06-corporate': 'classic-corporate',
      executive: 'classic-corporate',
      'executive-board': 'classic-corporate',
      'luxury-executive': 'classic-corporate',
      'executive-luxury': 'classic-corporate',
      'ats-executive': 'classic-corporate',
      'executive-minimal': 'classic-corporate',
      minimaliste: 'classic-corporate',
      compact: 'classic-corporate',
      freelance: 'classic-corporate',
      'consulting-elite': 'classic-corporate',
      'mckinsey-consulting': 'classic-corporate',
      consulting: 'classic-corporate',
      consultingelite: 'classic-corporate',
      'agency-designer': 'classic-corporate',
      strategy: 'classic-corporate',
      'freelance-creative': 'classic-corporate',
      'tech-structured': 'tech-structured',
      tech: 'tech-structured',
      'tech-engineer': 'tech-structured',
      'senior-engineer': 'tech-structured',
      'staff-engineer': 'tech-structured',
      engineer: 'tech-structured',
      'google-style': 'tech-structured',
      'product-manager': 'tech-structured',
      'modern-two-column': 'tech-structured',
      'two-column': 'tech-structured',
      'tech-resume': 'tech-structured',
      sidebar: 'tech-structured',
      productdesigner: 'tech-structured',
      'product-designer': 'tech-structured',
      'startup-founder': 'tech-structured',
      'startup-builder': 'tech-structured',
      startup: 'tech-structured',
      founder: 'tech-structured',
      'premium-luxe': 'editorial-magazine',
    };

    const FREE_TEMPLATE_ID = 'ats';
    CV_TEMPLATES.forEach((t) => {
      if (!t.tier) t.tier = 'pro';
    });

    function resolve(id) {
      const key = ALIASES[id] || id;
      return CV_TEMPLATES.find((t) => t.id === key) || CV_TEMPLATES[0];
    }

    function isPremiumTemplate(id) {
      return resolve(id).tier === 'pro';
    }

    /** H18 — gallery thumb: structural skeleton only (no real brands / person names). */
    const MINI_CV = {
      name: UNDETECTED_LABEL,
      title: 'Directeur Créatif',
      email: 'email@exemple.fr',
      phone: '',
      linkedin: '',
      portfolio: '',
      location: 'Paris',
      summary: 'Direction artistique, identité de marque et campagnes print & digital.',
      experience: [
        'Directeur Artistique — Agence créative — 2020 — 2025',
        'Designer Senior — Studio indépendant — 2016 — 2020',
      ],
      education: ['École — Design visuel', '2014 — 2016'],
      skills: ['Direction artistique', 'Brand design', 'Typographie'],
      tools: ['Suite Adobe', 'Figma'],
      languages: ['Français — natif', 'Anglais — courant'],
      clients: ['Marque A', 'Marque B', 'Marque C', 'Marque D', 'Marque E', 'Marque F'],
      projects: ['Projet éditorial', 'Campagne packaging'],
    };

    function render(p, templateId) {
      if (!p) return '';
      const safe = normalizeProfile(p);
      _densityProfile = safe;
      const t = resolve(templateId);
      let html = '';
      try {
        html = t.render(safe);
        if (!html || !String(html).replace(/<[^>]+>/g, '').trim()) {
          html = t.render(normalizeProfile({ ...safe, experience: safe.experience || [] }));
        }
        html = applySectionOrderToHtml(html, resolveSectionOrder(safe));
        html = removeHiddenSectionsFromHtml(html, safe);
      } finally {
        _densityProfile = null;
      }
      return html;
    }

    function renderMini(templateId) {
      const id = resolve(templateId).id;
      const displayProfile = { ...MINI_CV, name: 'Créatif · Exemple' };
      const inner = render(displayProfile, id);
      return `<div class="tplMiniWrap tplMiniWrap--${id}" aria-hidden="true"><div class="tplMini cv template-${id} spacing-normal">${inner}</div></div>`;
    }

    function listProduction() {
      return CV_TEMPLATES.filter((t) => PRODUCTION_TEMPLATE_IDS.includes(t.id));
    }

    global.HirelyTemplates = {
      list: CV_TEMPLATES,
      listProduction,
      PRODUCTION_TEMPLATE_IDS,
      resolve,
      render,
      renderMini,
      ALIASES,
      FREE_TEMPLATE_ID,
      isPremiumTemplate,
      DEFAULT_SECTION_ORDER,
      resolveSectionOrder,
      applySectionOrderToHtml,
      classifySectionBlock,
    };
  }

  global.initHirelyTemplates = init;
  if (typeof console !== 'undefined' && console.log) {
    console.log('CV_TEMPLATE_BOOT_OK');
  }
})(typeof window !== 'undefined' ? window : global);
