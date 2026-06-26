/**
 * Hirely — 8 distinct CV template HTML builders (uses cvDraft / premiumCV only).
 * Requires: escapeHtml, cvSection, photoData, HirelyCvParser (from index.html).
 */
(function (global) {
  function cvIsPlaceholder(x) {
    return global.HirelyCvParser && HirelyCvParser.isPlaceholder(x);
  }
  function cvFilter(items) {
    return (items || []).filter((x) => x && !cvIsPlaceholder(x));
  }

  function buildExperienceHtml(experience, opts) {
    opts = opts || {};
    const itemClass = opts.itemClass || 'cvExp';
    return (experience || [])
      .filter((e) => {
        const role = (e?.role || '').trim();
        const bullets = (e?.bullets || []).filter((b) => b && !cvIsPlaceholder(b));
        return role || bullets.length;
      })
      .map((e) => {
        const meta = [e.company, e.dates].filter((x) => x && !cvIsPlaceholder(x)).join(' · ');
        const bullets = (e.bullets || []).filter((b) => b && !cvIsPlaceholder(b));
        const ul = bullets.length
          ? `<ul>${bullets.map((b) => `<li contenteditable="true">${global.escapeHtml(b)}</li>`).join('')}</ul>`
          : '';
        return `<div class="${itemClass}"><p class="cvRole" contenteditable="true">${global.escapeHtml(e.role || '')}</p>${meta ? `<p class="cvMeta" contenteditable="true">${global.escapeHtml(meta)}</p>` : ''}${ul}</div>`;
      })
      .join('');
  }

  function listPara(items, joiner) {
    joiner = joiner || ' · ';
    const list = cvFilter(items);
    if (!list.length) return '';
    return `<p class="cvSkillLine" contenteditable="true">${global.escapeHtml(list.join(joiner))}</p>`;
  }

  function listUl(items) {
    const list = cvFilter(items);
    if (!list.length) return '';
    return `<ul class="cvList">${list.map((x) => `<li contenteditable="true">${global.escapeHtml(x)}</li>`).join('')}</ul>`;
  }

  function skillsTags(items) {
    const list = cvFilter(items);
    if (!list.length) return '';
    return `<ul class="cvTags">${list.map((x) => `<li contenteditable="true">${global.escapeHtml(x)}</li>`).join('')}</ul>`;
  }

  function multilinePara(items) {
    const list = cvFilter(items);
    if (!list.length) return '';
    return `<p contenteditable="true">${global.escapeHtml(list.join('\n'))}</p>`;
  }

  function photoHtml() {
    return global.photoData ? `<img class="cvPhoto" src="${global.photoData}" alt="">` : '';
  }

  function identityBlock(c, opts) {
    opts = opts || {};
    const nameTag = opts.nameTag || 'h1';
    const parts = [];
    if (c.name && !cvIsPlaceholder(c.name)) parts.push(`<${nameTag} class="cvName" contenteditable="true">${global.escapeHtml(c.name)}</${nameTag}>`);
    if (c.title && !cvIsPlaceholder(c.title)) parts.push(`<p class="cvTitle" contenteditable="true">${global.escapeHtml(c.title)}</p>`);
    if (!opts.hideContact && c.contact && !cvIsPlaceholder(c.contact)) {
      parts.push(`<p class="cvContactLine" contenteditable="true">${global.escapeHtml(c.contact)}</p>`);
    }
    return parts.join('');
  }

  function clientsFeatured(items, opts) {
    opts = opts || {};
    const list = cvFilter(items);
    if (!list.length) return '';
    const label = opts.label ? `<span class="cvClientsLabel">${global.escapeHtml(opts.label)}</span>` : '';
    const chips = list
      .map((x) => `<span class="cvClientChip" contenteditable="true">${global.escapeHtml(x)}</span>`)
      .join('');
    return `<div class="cvClientsFeatured" data-section="clients">${label}<div class="cvClientsGrid">${chips}</div></div>`;
  }

  function clientsSection(c, title) {
    title = title || 'Selected clients';
    const clients = cvFilter(c.clients);
    if (!clients.length) return '';
    return global.cvSection('clients', title, listPara(clients));
  }

  function clientsBlock(c, opts) {
    opts = opts || {};
    const clients = cvFilter(c.clients);
    if (!clients.length) return '';
    const line = global.escapeHtml(clients.join(' · '));
    const label = opts.showLabel
      ? '<span class="cvClientLabel" contenteditable="true">Selected clients</span>'
      : '';
    const mod = opts.showLabel ? ' cvClientBlock--labeled' : '';
    return `<div class="cvClientBlock${mod}" data-section="clients">${label}<p class="cvClientLine" contenteditable="true">${line}</p></div>`;
  }

  function metaSections(c, opts) {
    opts = opts || {};
    const clientsFirstBlock = opts.omitClients ? '' : opts.clientsFirst ? clientsSection(c) : '';
    const clientsLastBlock = opts.omitClients ? '' : !opts.clientsFirst ? clientsSection(c) : '';
    const skills = opts.tags
      ? global.cvSection('skills', 'Skills', skillsTags(c.skills))
      : global.cvSection('skills', 'Skills', listUl(c.skills));
    return [
      clientsFirstBlock,
      skills,
      global.cvSection('tools', 'Tools', opts.tags ? skillsTags(c.tools) : listUl(c.tools)),
      global.cvSection('languages', 'Languages', listPara(c.languages)),
      clientsLastBlock,
    ]
      .filter(Boolean)
      .join('');
  }

  function mainCoreSections(c, exp, opts) {
    opts = opts || {};
    const blocks = [];
    if (c.summary && !cvIsPlaceholder(c.summary)) {
      blocks.push(
        global.cvSection('summary', opts.summaryTitle || 'Profile', `<p contenteditable="true">${global.escapeHtml(c.summary)}</p>`)
      );
    }
    if (exp) blocks.push(global.cvSection('experience', 'Experience', exp));
    const edu = cvFilter(c.education);
    if (!opts.omitEducation && edu.length) blocks.push(global.cvSection('education', 'Education', multilinePara(edu)));
    const ach = cvFilter(c.achievements);
    if (ach.length) blocks.push(global.cvSection('achievements', 'Achievements', multilinePara(ach)));
    const ints = cvFilter(c.interests);
    if (ints.length) blocks.push(global.cvSection('interests', 'Interests', listPara(ints)));
    return blocks.join('');
  }

  function buildTplAts(cv) {
    const exp = buildExperienceHtml(cv.experience);
    const head = identityBlock(cv);
    const tail = [
      clientsSection(cv, 'Selected clients'),
      global.cvSection('skills', 'Skills', listPara(cv.skills)),
      global.cvSection('tools', 'Tools', listPara(cv.tools)),
      global.cvSection('languages', 'Languages', listPara(cv.languages)),
    ]
      .filter(Boolean)
      .join('');
    return `<article class="cvShell cvShell--ats"><div class="cvAtsRule" aria-hidden="true"></div>${head ? `<header class="cvBand cvBand--head">${head}</header>` : ''}<main class="cvStream">${mainCoreSections(cv, exp, { summaryTitle: 'Professional summary' })}${tail}</main></article>`;
  }

  function buildTplSwiss(cv) {
    const exp = buildExperienceHtml(cv.experience, { itemClass: 'cvExp cvExp--timeline' });
    const railHead = identityBlock(cv, { hideContact: true });
    const rail = [
      railHead ? `<div class="cvRailHead">${railHead}</div>` : '',
      cv.contact && !cvIsPlaceholder(cv.contact) ? global.cvSection('contact', 'Contact', `<p class="cvRailContact" contenteditable="true">${global.escapeHtml(cv.contact)}</p>`) : '',
      metaSections(cv, { tags: true }),
    ]
      .filter(Boolean)
      .join('');
    const gridCls = rail ? 'cvGrid cvGrid--swiss' : 'cvGrid cvGrid--swiss cvGrid--swiss-full';
    const aside = rail ? `<aside class="cvRail">${rail}</aside>` : '';
    return `<article class="cvShell cvShell--swiss"><div class="${gridCls}">${aside}<main class="cvPane cvPane--offset">${mainCoreSections(cv, exp, { summaryTitle: 'Profile' })}</main></div><div class="cvSwissBaseline" aria-hidden="true"></div></article>`;
  }

  function buildTplExecutive(cv) {
    const exp = buildExperienceHtml(cv.experience);
    const head = identityBlock(cv);
    const foot = [
      global.cvSection('education', 'Education', multilinePara(cv.education)),
      global.cvSection('skills', 'Skills', listPara(cv.skills)),
      global.cvSection('tools', 'Tools', listPara(cv.tools)),
      global.cvSection('languages', 'Languages', listPara(cv.languages)),
      clientsSection(cv),
    ]
      .filter(Boolean)
      .join('');
    return `<article class="cvShell cvShell--executive">${head ? `<header class="cvBand cvBand--dark">${head}</header>` : ''}<div class="cvBody"><main class="cvPane cvPane--spacious">${mainCoreSections(cv, exp, { omitEducation: true })}</main>${foot ? `<footer class="cvFoot">${foot}</footer>` : ''}</div></article>`;
  }

  function buildTplEditorial(cv) {
    const exp = buildExperienceHtml(cv.experience, { itemClass: 'cvExp cvExp--rule' });
    const photo = photoHtml();
    const mast = identityBlock(cv);
    const masthead =
      mast || photo
        ? `<header class="cvMasthead">${photo ? `<div class="cvMastheadMedia">${photo}</div>` : ''}${mast ? `<div class="cvMastheadText">${mast}</div>` : ''}</header>`
        : '';
    const aside = [
      clientsSection(cv, 'Clients & collaborators'),
      global.cvSection('skills', 'Expertise', listUl(cv.skills)),
      global.cvSection('tools', 'Tools', listUl(cv.tools)),
      global.cvSection('education', 'Education', multilinePara(cv.education)),
      global.cvSection('languages', 'Languages', listPara(cv.languages)),
    ]
      .filter(Boolean)
      .join('');
    const splitCls = aside ? 'cvSplit' : 'cvSplit cvSplit--full';
    return `<article class="cvShell cvShell--editorial">${masthead}<div class="${splitCls}"><main class="cvPane cvPane--lead">${mainCoreSections(cv, exp, { summaryTitle: 'Profile' })}</main>${aside ? `<aside class="cvPane cvPane--meta">${aside}</aside>` : ''}</div></article>`;
  }

  function buildTplPortfolio(cv) {
    const exp = buildExperienceHtml(cv.experience);
    const deck = [
      photoHtml(),
      identityBlock(cv, { hideContact: true }),
      cv.contact && !cvIsPlaceholder(cv.contact)
        ? `<p class="cvDeckContact" contenteditable="true">${global.escapeHtml(cv.contact)}</p>`
        : '',
      clientsFeatured(cv.clients, { label: 'Selected clients' }) || clientsBlock(cv, { showLabel: true }),
      metaSections(cv, { clientsFirst: true, omitClients: true, tags: true }),
    ]
      .filter(Boolean)
      .join('');
    const gridCls = deck ? 'cvGrid cvGrid--deck' : 'cvGrid cvGrid--deck cvGrid--deck-full';
    const aside = deck ? `<aside class="cvDeck">${deck}</aside>` : '';
    const main = [
      cv.summary && !cvIsPlaceholder(cv.summary)
        ? global.cvSection('summary', 'Creative profile', `<p contenteditable="true">${global.escapeHtml(cv.summary)}</p>`)
        : '',
      exp ? global.cvSection('experience', 'Experience', exp) : '',
      cvFilter(cv.education).length ? global.cvSection('education', 'Education', multilinePara(cv.education)) : '',
    ]
      .filter(Boolean)
      .join('');
    return `<article class="cvShell cvShell--portfolio"><div class="${gridCls}">${aside}<main class="cvStagePane">${main}</main></div></article>`;
  }

  function buildTplLuxury(cv) {
    const exp = buildExperienceHtml(cv.experience, { itemClass: 'cvExp cvExp--centered' });
    const head = identityBlock(cv);
    const clients = cvFilter(cv.clients);
    const clientBand = clients.length
      ? `<div class="cvLuxClients" data-section="clients"><span class="cvLuxClientsLabel">Maison &amp; clients</span><p contenteditable="true">${global.escapeHtml(clients.join(' · '))}</p></div>`
      : '';
    const tail = [
      clientBand,
      global.cvSection('skills', 'Competencies', listPara(cv.skills)),
      global.cvSection('tools', 'Tools', listPara(cv.tools)),
      global.cvSection('languages', 'Languages', listPara(cv.languages)),
      cvFilter(cv.achievements).length ? global.cvSection('achievements', 'Distinctions', multilinePara(cv.achievements)) : '',
    ]
      .filter(Boolean)
      .join('');
    return `<article class="cvShell cvShell--luxury"><div class="cvLuxFrame" aria-hidden="true"></div>${head ? `<header class="cvMonogram">${head}</header>` : ''}<div class="cvMeasure">${cv.summary && !cvIsPlaceholder(cv.summary) ? global.cvSection('summary', 'Profile', `<p contenteditable="true">${global.escapeHtml(cv.summary)}</p>`) : ''}${exp ? global.cvSection('experience', 'Experience', exp) : ''}${cvFilter(cv.education).length ? global.cvSection('education', 'Education', multilinePara(cv.education)) : ''}${tail}</div></article>`;
  }

  function buildTplSidebar(cv) {
    const exp = buildExperienceHtml(cv.experience);
    const stack = [
      photoHtml(),
      identityBlock(cv, { hideContact: true }),
      cv.contact && !cvIsPlaceholder(cv.contact)
        ? global.cvSection('contact', 'Contact', `<p class="cvStackContact" contenteditable="true">${global.escapeHtml(cv.contact)}</p>`)
        : '',
      global.cvSection('skills', 'Skills', skillsTags(cv.skills)),
      global.cvSection('tools', 'Tools', skillsTags(cv.tools)),
      global.cvSection('languages', 'Languages', listUl(cv.languages)),
    ]
      .filter(Boolean)
      .join('');
    const main = [mainCoreSections(cv, exp), clientsSection(cv)].filter(Boolean).join('');
    const gridCls = stack ? 'cvGrid cvGrid--sidebar' : 'cvGrid cvGrid--sidebar cvGrid--sidebar-full';
    const aside = stack ? `<aside class="cvStack">${stack}</aside>` : '';
    return `<article class="cvShell cvShell--sidebar"><div class="${gridCls}">${aside}<main class="cvPane">${main}</main></div></article>`;
  }

  function buildTplArt(cv) {
    const exp = buildExperienceHtml(cv.experience, { itemClass: 'cvExp cvExp--card' });
    const side = [
      photoHtml(),
      identityBlock(cv, { hideContact: true }),
      cv.contact && !cvIsPlaceholder(cv.contact)
        ? global.cvSection('contact', 'Contact', `<p contenteditable="true">${global.escapeHtml(cv.contact)}</p>`)
        : '',
      metaSections(cv, { tags: true }),
    ]
      .filter(Boolean)
      .join('');
    const main = [
      cv.summary && !cvIsPlaceholder(cv.summary) ? global.cvSection('summary', 'Creative direction', `<p class="cvLead" contenteditable="true">${global.escapeHtml(cv.summary)}</p>`) : '',
      exp ? global.cvSection('experience', 'Experience', exp) : '',
      cvFilter(cv.education).length ? global.cvSection('education', 'Education', multilinePara(cv.education)) : '',
      clientsSection(cv, 'Selected work'),
    ]
      .filter(Boolean)
      .join('');
    const gridCls = side ? 'cvGrid cvGrid--art' : 'cvGrid cvGrid--art cvGrid--art-full';
    const aside = side ? `<aside class="cvHeroSide">${side}</aside>` : '';
    return `<article class="cvShell cvShell--art"><div class="${gridCls}">${aside}<main class="cvHeroMain">${main}</main></div></article>`;
  }

  const BUILDERS = {
    ats: buildTplAts,
    swiss: buildTplSwiss,
    executive: buildTplExecutive,
    editorial: buildTplEditorial,
    portfolio: buildTplPortfolio,
    luxury: buildTplLuxury,
    sidebar: buildTplSidebar,
    art: buildTplArt,
    startup: buildTplSidebar,
  };

  function build(c, tplId) {
    const cv = global.HirelyCvParser ? HirelyCvParser.sanitizePremiumCV(c) : c;
    const id = tplId === 'startup' ? 'sidebar' : tplId;
    const fn = BUILDERS[id] || buildTplAts;
    return fn(cv);
  }

  global.HirelyCvTemplates = { build, BUILDERS };
})(typeof window !== 'undefined' ? window : globalThis);
