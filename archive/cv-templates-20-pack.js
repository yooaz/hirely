/* Hirely — 20 premium CV templates (validated cvData only; empty sections hidden). */
(function (global) {
  function init(deps) {
    const { esc, sectionLabel, cvBlock, cvSkillsHtml, getPhotoHtml } = deps;

    function photoSlot() {
      return getPhotoHtml ? getPhotoHtml() : '';
    }

    function contactParts(p) {
      return [p.location, p.email, p.phone, p.portfolio, p.linkedin].filter(Boolean);
    }

    function contact(p, sep) {
      return contactParts(p).map(esc).join(sep || ' · ');
    }

    function headClassic(p, extra, mod) {
      const c = contact(p);
      const m = mod ? ` ${mod}` : '';
      return `<header class="cvHead${m}">${photoSlot()}${extra || ''}${p.name ? `<div class="cvName" contenteditable>${esc(p.name)}</div>` : ''}${p.title ? `<div class="cvTitle" contenteditable>${esc(p.title)}</div>` : ''}${c ? `<div class="cvContact"><p contenteditable>${c}</p></div>` : ''}</header>`;
    }

    function headGrid(p, extra) {
      const c = contact(p, '<br>');
      return `<header class="cvHead cvHead--grid">${photoSlot()}${extra || ''}<div class="cvHeadPrimary">${p.name ? `<div class="cvName" contenteditable>${esc(p.name)}</div>` : ''}${p.title ? `<div class="cvTitle" contenteditable>${esc(p.title)}</div>` : ''}</div>${c ? `<div class="cvHeadMeta"><div class="cvContact"><p contenteditable>${c}</p></div></div>` : ''}</header>`;
    }

    function headCentered(p, extra) {
      const c = contact(p);
      return `<header class="cvHead cvHead--center">${photoSlot()}${extra || ''}${p.name ? `<div class="cvName" contenteditable>${esc(p.name)}</div>` : ''}${p.title ? `<div class="cvTitle" contenteditable>${esc(p.title)}</div>` : ''}${c ? `<div class="cvContact"><p contenteditable>${c}</p></div>` : ''}</header>`;
    }

    function headBand(p, bandMod) {
      const c = contact(p);
      const bm = bandMod ? ` ${bandMod}` : '';
      return `<div class="cvTopBand${bm}">${photoSlot()}${p.name ? `<div class="cvName" contenteditable>${esc(p.name)}</div>` : ''}${p.title ? `<div class="cvTitle" contenteditable>${esc(p.title)}</div>` : ''}${c ? `<div class="cvContact"><p contenteditable>${c}</p></div>` : ''}</div>`;
    }

    function wrap(tplId, layoutClass, html) {
      return `<div class="cvInner ${layoutClass} cvTpl-${tplId}">${html}</div>`;
    }

    function sideBlocks(p, opts) {
      const o = opts || {};
      const parts = [];
      if (o.contactInSide && contact(p, '<br>')) {
        parts.push(`<section class="cvSection cvSection--meta"><h3 class="cvSectionTitle">Contact</h3><div class="cvSectionBody"><p contenteditable>${contact(p, '<br>')}</p></div></section>`);
      }
      if (p.skills && p.skills.length) parts.push(cvBlock(sectionLabel('skills'), cvSkillsHtml(p.skills, !!o.chips)));
      if (p.tools && p.tools.length && o.toolsInSide) parts.push(cvBlock(sectionLabel('tools'), `<p contenteditable>${esc(p.tools.join(' · '))}</p>`));
      if (p.languages && p.languages.length && o.langsInSide) {
        parts.push(cvBlock(sectionLabel('languages'), `<ul class="cvLangList">${p.languages.map((l) => `<li contenteditable>${esc(l)}</li>`).join('')}</ul>`));
      }
      return parts;
    }

    function experienceHtml(p, o) {
      if (!p.experience || !p.experience.length) return '';
      const items = p.experience.map((x) => esc(x));
      if (o.timeline) {
        return `<div class="cvTimeline">${p.experience.map((x) => `<div class="cvTimelineItem"><span class="cvTimelineDot" aria-hidden="true"></span><p contenteditable>${esc(x)}</p></div>`).join('')}</div>`;
      }
      if (o.gallery) {
        return `<div class="cvGallery">${p.experience.map((x) => `<div class="cvGalleryItem"><p contenteditable>${esc(x)}</p></div>`).join('')}</div>`;
      }
      if (o.entries) {
        return `<div class="cvExpList">${p.experience.map((x) => `<div class="cvExpEntry"><p contenteditable>${esc(x)}</p></div>`).join('')}</div>`;
      }
      if (o.numbered) {
        return `<ol class="cvExpNumbered">${p.experience.map((x) => `<li contenteditable>${esc(x)}</li>`).join('')}</ol>`;
      }
      return `<ul class="cvExpBullets">${p.experience.map((x) => `<li contenteditable>${esc(x)}</li>`).join('')}</ul>`;
    }

    function mainBlocks(p, opts) {
      const o = opts || {};
      const parts = [];
      if (p.summary) parts.push(cvBlock(sectionLabel('profile'), `<p class="cvSummary" contenteditable>${esc(p.summary)}</p>`));
      if (p.clients && p.clients.length) {
        const html = o.clientsTags
          ? `<div class="cvClientTags">${p.clients.map((c) => `<span class="cvClientTag" contenteditable>${esc(c)}</span>`).join('')}</div>`
          : o.clientsBold
            ? `<p contenteditable><strong>${esc(p.clients.join(' · '))}</strong></p>`
            : `<p contenteditable>${esc(p.clients.join(' · '))}</p>`;
        parts.push(cvBlock(sectionLabel('clients'), html));
      }
      if (p.experience && p.experience.length) {
        const body = experienceHtml(p, o);
        if (body) parts.push(cvBlock(sectionLabel('experience'), body));
      }
      if (p.education && p.education.length) {
        parts.push(cvBlock(sectionLabel('education'), `<p class="cvEduLine" contenteditable>${esc(p.education.join(' · '))}</p>`));
      }
      if (p.skills && p.skills.length && o.skillsInMain) parts.push(cvBlock(sectionLabel('skills'), cvSkillsHtml(p.skills, !!o.chips)));
      if (p.tools && p.tools.length && o.toolsInMain) parts.push(cvBlock(sectionLabel('tools'), `<p contenteditable>${esc(p.tools.join(' · '))}</p>`));
      if (p.languages && p.languages.length && o.langsInMain) {
        parts.push(cvBlock(sectionLabel('languages'), `<p contenteditable>${esc(p.languages.join(' · '))}</p>`));
      }
      return parts;
    }

    function layoutSingle(tplId, p, mainOpts, headFn, headExtra) {
      const head = headFn ? headFn(p, headExtra) : headClassic(p, headExtra);
      return wrap(tplId, 'cvLayout-single', `${head}<main class="cvMain">${mainBlocks(p, mainOpts).join('')}</main>`);
    }

    function layoutSide(tplId, p, sideOpts, mainOpts, right, headFn, headExtra) {
      const side = sideBlocks(p, sideOpts);
      const head = headFn ? headFn(p, headExtra) : headClassic(p, headExtra);
      const lr = right ? ' cvLayout-sideRight' : '';
      const body = side.length
        ? `<div class="cvBody">${right ? '' : `<aside class="cvSide">${side.join('')}</aside>`}<main class="cvMain">${mainBlocks(p, mainOpts).join('')}</main>${right ? `<aside class="cvSide">${side.join('')}</aside>` : ''}</div>`
        : `<main class="cvMain cvMain--full">${mainBlocks(p, mainOpts).join('')}</main>`;
      return wrap(tplId, `cvLayout-split${lr}`, `${head}${body}`);
    }

    function layoutBand(tplId, p, mainOpts, bandMod) {
      return wrap(tplId, 'cvLayout-band', `${headBand(p, bandMod)}<main class="cvMain cvMain-band">${mainBlocks(p, mainOpts).join('')}</main>`);
    }

    function layoutCompactColumns(tplId, p, mainOpts) {
      const meta = [];
      if (p.skills && p.skills.length) meta.push(cvBlock(sectionLabel('skills'), cvSkillsHtml(p.skills, false)));
      if (p.tools && p.tools.length) meta.push(cvBlock(sectionLabel('tools'), `<p contenteditable>${esc(p.tools.join(' · '))}</p>`));
      if (p.languages && p.languages.length) meta.push(cvBlock(sectionLabel('languages'), `<p contenteditable>${esc(p.languages.join(' · '))}</p>`));
      const main = mainBlocks(p, { ...mainOpts, skillsInMain: false, toolsInMain: false, langsInMain: false });
      return wrap(
        tplId,
        'cvLayout-compactCols',
        `${headClassic(p)}<div class="cvBody cvBody--compact">${meta.length ? `<aside class="cvAsideNarrow">${meta.join('')}</aside>` : ''}<main class="cvMain">${main.join('')}</main></div>`
      );
    }

    function layoutRail(tplId, p, mainOpts) {
      return layoutSingle(tplId, p, { ...mainOpts, entries: true }, (px, ex) => headClassic(px, ex, 'cvHead--rail'));
    }

    const CV_TEMPLATES = [
      {
        id: 'ats',
        name: 'ATS Clean',
        tier: 'free',
        category: 'Corporate',
        bestFor: 'ATS · large employers',
        atsSafety: 'high',
        creativeLevel: 1,
        layoutClass: 'layout-ats',
        icon: '⊞',
        thumb: 'thumb-ats',
        render: (p) => layoutSingle('ats', p, { toolsInMain: true, langsInMain: true }),
      },
      {
        id: 'classic-executive',
        name: 'Classic Executive',
        category: 'Executive',
        bestFor: 'Leadership · C-level',
        atsSafety: 'high',
        creativeLevel: 1,
        layoutClass: 'layout-classic-executive',
        icon: '▤',
        thumb: 'thumb-classic-executive',
        render: (p) =>
          layoutSingle(
            'classic-executive',
            p,
            { numbered: true, toolsInMain: true, langsInMain: true },
            (px, ex) => headClassic(px, ex, 'cvHead--classicExec')
          ),
      },
      {
        id: 'modern-clean',
        name: 'Modern Clean',
        category: 'Modern',
        bestFor: 'Product · SaaS · tech',
        atsSafety: 'high',
        creativeLevel: 1,
        layoutClass: 'layout-modern-clean',
        icon: '◻',
        thumb: 'thumb-modern-clean',
        render: (p) =>
          layoutSingle(
            'modern-clean',
            p,
            { entries: true, toolsInMain: true, langsInMain: true },
            (px, ex) => headClassic(px, ex, 'cvHead--modernClean')
          ),
      },
      {
        id: 'creative-minimal',
        name: 'Creative Minimal',
        category: 'Creative',
        bestFor: 'Design · studio · content',
        atsSafety: 'medium',
        creativeLevel: 2,
        layoutClass: 'layout-creative-minimal',
        icon: '◇',
        thumb: 'thumb-creative-minimal',
        render: (p) =>
          layoutSide(
            'creative-minimal',
            p,
            { chips: true, toolsInSide: true, langsInSide: true },
            { entries: true },
            false,
            (px, ex) => headClassic(px, ex, 'cvHead--creativeMinimal')
          ),
      },
      {
        id: 'mckinsey',
        name: 'McKinsey Brief',
        category: 'Consulting',
        bestFor: 'MBB · strategy roles',
        atsSafety: 'high',
        creativeLevel: 2,
        layoutClass: 'layout-mckinsey',
        icon: '◆',
        thumb: 'thumb-mckinsey',
        render: (p) => layoutSingle('mckinsey', p, { clientsBold: true, toolsInMain: true, langsInMain: true, numbered: true }, (px, ex) => headClassic(px, ex, 'cvHead--brief')),
      },
      {
        id: 'swiss',
        name: 'Swiss Grid',
        category: 'Minimal',
        bestFor: 'Design · architecture',
        atsSafety: 'high',
        creativeLevel: 2,
        layoutClass: 'layout-swiss',
        icon: '▦',
        thumb: 'thumb-swiss',
        render: (p) => layoutSide('swiss', p, { chips: true, toolsInSide: true, langsInSide: true }, {}, false, headGrid),
      },
      {
        id: 'editorial',
        name: 'Editorial Designer',
        category: 'Creative',
        bestFor: 'Magazine · studio',
        atsSafety: 'medium',
        creativeLevel: 4,
        layoutClass: 'layout-editorial',
        icon: '✦',
        thumb: 'thumb-editorial',
        render: (p) => layoutSingle('editorial', p, { skillsInMain: true, langsInMain: true, toolsInMain: true, entries: true }, (px, ex) => headClassic(px, ex, 'cvHead--serif')),
      },
      {
        id: 'portfolio',
        name: 'Portfolio Creative',
        category: 'Creative',
        bestFor: 'Portfolios · case work',
        atsSafety: 'medium',
        creativeLevel: 4,
        layoutClass: 'layout-portfolio',
        icon: '◧',
        thumb: 'thumb-portfolio',
        render: (p) => layoutSide('portfolio', p, { chips: true, toolsInSide: true, langsInSide: true }, { entries: true }, true, (px, ex) => headClassic(px, ex, 'cvHead--portfolio')),
      },
      {
        id: 'luxury',
        name: 'Luxury Monochrome',
        category: 'Premium',
        bestFor: 'Luxury · executive',
        atsSafety: 'medium',
        creativeLevel: 3,
        layoutClass: 'layout-luxury',
        icon: '◇',
        thumb: 'thumb-luxury',
        render: (p) => layoutSide('luxury', p, { chips: true, toolsInSide: true, langsInSide: true }, {}, false, (px, ex) => headClassic(px, ex, 'cvHead--luxury')),
      },
      {
        id: 'sidebar',
        name: 'Modern Sidebar Light',
        category: 'Modern',
        bestFor: 'General · readable split',
        atsSafety: 'high',
        creativeLevel: 2,
        layoutClass: 'layout-sidebar',
        icon: '▌',
        thumb: 'thumb-sidebar',
        render: (p) => layoutSide('sidebar', p, { chips: true, toolsInSide: true, langsInSide: true, contactInSide: true }, {}, false, (px, ex) => headClassic(px, ex, 'cvHead--linear')),
      },
      {
        id: 'executive',
        name: 'Executive Minimal',
        category: 'Executive',
        bestFor: 'C-level · board',
        atsSafety: 'high',
        creativeLevel: 2,
        layoutClass: 'layout-executive',
        icon: '○',
        thumb: 'thumb-executive',
        render: (p) => layoutSingle('executive', p, { clientsBold: true, toolsInMain: true, langsInMain: true, entries: true }, headCentered),
      },
      {
        id: 'tech',
        name: 'Tech Product',
        category: 'Tech',
        bestFor: 'Product · engineering',
        atsSafety: 'high',
        creativeLevel: 2,
        layoutClass: 'layout-tech',
        icon: '⌘',
        thumb: 'thumb-tech',
        render: (p) => layoutSide('tech', p, { chips: true, toolsInSide: true, langsInSide: true }, { entries: true }, false, (px, ex) => headClassic(px, ex, 'cvHead--tech')),
      },
      {
        id: 'artdirector',
        name: 'Art Director Bold',
        category: 'Creative',
        bestFor: 'Art direction · campaigns',
        atsSafety: 'low',
        creativeLevel: 5,
        layoutClass: 'layout-artdirector',
        icon: '▮',
        thumb: 'thumb-artdirector',
        render: (p) => layoutSingle('artdirector', p, { skillsInMain: true, chips: true, toolsInMain: true, entries: true }, (px, ex) => headClassic(px, ex, 'cvHead--bold')),
      },
      {
        id: 'gallery',
        name: 'Gallery Resume',
        category: 'Creative',
        bestFor: 'Visual · project grid',
        atsSafety: 'low',
        creativeLevel: 5,
        layoutClass: 'layout-gallery',
        icon: '▢',
        thumb: 'thumb-gallery',
        render: (p) => layoutSingle('gallery', p, { gallery: true, skillsInMain: true, chips: true }, (px, ex) => headClassic(px, ex, 'cvHead--gallery')),
      },
      {
        id: 'compact',
        name: 'Compact Pro',
        category: 'Corporate',
        bestFor: 'Dense CV · one page',
        atsSafety: 'high',
        creativeLevel: 1,
        layoutClass: 'layout-compact',
        icon: '≡',
        thumb: 'thumb-compact',
        render: (p) => layoutCompactColumns('compact', p, { toolsInMain: false, langsInMain: false }),
      },
      {
        id: 'darkaccent',
        name: 'Dark Accent',
        category: 'Modern',
        bestFor: 'Bold header · accent strip',
        atsSafety: 'medium',
        creativeLevel: 3,
        layoutClass: 'layout-darkaccent',
        icon: '▬',
        thumb: 'thumb-darkaccent',
        render: (p) => layoutBand('darkaccent', p, { toolsInMain: true, langsInMain: true, entries: true }, 'cvTopBand--slim'),
      },
      {
        id: 'creativeed',
        name: 'Creative Editorial',
        category: 'Creative',
        bestFor: 'Editorial · hybrid roles',
        atsSafety: 'medium',
        creativeLevel: 4,
        layoutClass: 'layout-creativeed',
        icon: '❧',
        thumb: 'thumb-creativeed',
        render: (p) => layoutSingle('creativeed', p, { skillsInMain: true, chips: true, toolsInMain: true, entries: true }, (px, ex) => headClassic(px, ex, 'cvHead--kinfolk')),
      },
      {
        id: 'signature',
        name: 'Designer Signature',
        category: 'Creative',
        bestFor: 'Personal brand · designers',
        atsSafety: 'medium',
        creativeLevel: 4,
        layoutClass: 'layout-signature',
        icon: '✒',
        thumb: 'thumb-signature',
        render: (p) => layoutSingle('signature', p, { skillsInMain: true, chips: true, entries: true }, (px, ex) => headClassic(px, `<div class="cvSignatureRule" aria-hidden="true"></div>${ex || ''}`, 'cvHead--signature')),
      },
      {
        id: 'strategy',
        name: 'Consultant Strategy',
        category: 'Consulting',
        bestFor: 'Consulting · PMO',
        atsSafety: 'high',
        creativeLevel: 2,
        layoutClass: 'layout-strategy',
        icon: '◎',
        thumb: 'thumb-strategy',
        render: (p) => layoutSingle('strategy', p, { clientsBold: true, clientsTags: false, toolsInMain: true, langsInMain: true, numbered: true }, (px, ex) => headClassic(px, ex, 'cvHead--strategy')),
      },
      {
        id: 'fashion',
        name: 'Fashion Minimal',
        category: 'Fashion',
        bestFor: 'Fashion · luxury retail',
        atsSafety: 'medium',
        creativeLevel: 4,
        layoutClass: 'layout-fashion',
        icon: '✧',
        thumb: 'thumb-fashion',
        render: (p) => layoutSingle('fashion', p, { skillsInMain: true, chips: true, langsInMain: true, toolsInMain: true }, (px, ex) => headClassic(px, ex, 'cvHead--fashion')),
      },
      {
        id: 'academic',
        name: 'Academic Clean',
        category: 'Academic',
        bestFor: 'Research · PhD · teaching',
        atsSafety: 'high',
        creativeLevel: 2,
        layoutClass: 'layout-academic',
        icon: '§',
        thumb: 'thumb-academic',
        render: (p) => layoutSingle('academic', p, { toolsInMain: true, langsInMain: true }, (px, ex) => headClassic(px, ex, 'cvHead--academic')),
      },
      {
        id: 'freelance',
        name: 'Freelance Studio',
        category: 'Freelance',
        bestFor: 'Freelance · independents',
        atsSafety: 'medium',
        creativeLevel: 3,
        layoutClass: 'layout-freelance',
        icon: '◉',
        thumb: 'thumb-freelance',
        render: (p) => layoutSingle('freelance', p, { skillsInMain: true, chips: true, toolsInMain: true, entries: true }, (px, ex) => headClassic(px, ex, 'cvHead--studio')),
      },
      {
        id: 'timeline',
        name: 'Timeline Premium',
        category: 'Premium',
        bestFor: 'Career narrative · senior',
        atsSafety: 'medium',
        creativeLevel: 3,
        layoutClass: 'layout-timeline',
        icon: '↦',
        thumb: 'thumb-timeline',
        render: (p) => layoutSingle('timeline', p, { timeline: true, toolsInMain: true, langsInMain: true, entries: false }, (px, ex) => headClassic(px, ex, 'cvHead--timeline')),
      },
    ];

    const ALIASES = { creative: 'portfolio', fashion: 'fashion', strategy: 'strategy', ats: 'ats' };
    const FREE_TEMPLATE_ID = 'ats';
    CV_TEMPLATES.forEach((t) => {
      if (!t.tier) t.tier = 'pro';
    });

    function resolve(id) {
      const key = ALIASES[id] || id;
      return CV_TEMPLATES.find((t) => t.id === key) || CV_TEMPLATES[0];
    }

    function isPremiumTemplate(id) {
      return resolve(id).id !== FREE_TEMPLATE_ID;
    }

    const MINI_CV = {
      name: 'Alex Martin',
      title: 'Senior Graphic Designer',
      email: 'alex@email.com',
      phone: '+33 6 00 00 00 00',
      linkedin: 'linkedin.com/in/alexmartin',
      portfolio: 'alexmartin.com',
      location: 'Paris, France',
      summary:
        'Creative lead with measurable impact across brand systems, campaigns, and product storytelling for global clients.',
      experience: [
        'Lead Designer — Studio Nova (2021–Present)',
        'Freelance — Nike, Adobe, Louis Vuitton',
        'Graphic Designer — McCann Paris',
      ],
      education: ['MA Visual Communication — ECAL', 'BA Design — ENSAD'],
      skills: ['Brand identity', 'Art direction', 'Typography', 'Campaign design'],
      tools: ['Figma', 'Photoshop', 'Illustrator', 'InDesign'],
      languages: ['French (native)', 'English (fluent)'],
      clients: ['Nike', 'Adobe', 'Louis Vuitton'],
    };

    function render(p, templateId) {
      if (!p) return '';
      const safe = {
        name: p.name || '',
        title: p.title || '',
        email: p.email || '',
        phone: p.phone || '',
        linkedin: p.linkedin || '',
        portfolio: p.portfolio || '',
        location: p.location || '',
        summary: p.summary || '',
        experience: (p.experience || []).filter(Boolean),
        education: (p.education || []).filter(Boolean),
        skills: (p.skills || []).filter(Boolean),
        tools: (p.tools || []).filter(Boolean),
        languages: (p.languages || []).filter(Boolean),
        clients: (p.clients || []).filter(Boolean),
      };
      const t = resolve(templateId);
      return t.render(safe);
    }

    function renderMini(templateId) {
      const id = resolve(templateId).id;
      const inner = render(MINI_CV, id);
      return `<div class="tplMiniWrap" aria-hidden="true"><div class="tplMini cv template-${id}">${inner}</div></div>`;
    }

    global.HirelyTemplates = {
      list: CV_TEMPLATES,
      resolve,
      render,
      renderMini,
      ALIASES,
      FREE_TEMPLATE_ID,
      isPremiumTemplate,
    };
  }

  global.initHirelyTemplates = init;
})(typeof window !== 'undefined' ? window : global);
