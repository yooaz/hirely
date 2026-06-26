/**
 * A4 CV page layout — discrete 794×1123 sheets, preview ≡ PDF export.
 */
(function (global) {
  const A4_WIDTH_PX = 794;
  const A4_HEIGHT_PX = 1123;
  const PAGE_GAP_PX = 24;
  const OVERFLOW_TOLERANCE_PX = 2;
  const PACK_SAFETY_PX = 16;
  const MAGAZINE_PACK_SLACK_PX = 28;
  const PAGE_BUDGET_PX = A4_HEIGHT_PX - PACK_SAFETY_PX;
  const MAX_REBALANCE_PASSES = 128;
  const MAX_OVERFLOW_RETRIES = 3;

  const SPLITTABLE_SECTION_RE =
    /cvSection--(experience|projects|skills|tools|languages|clients|education)/;

  /**
   * @param {HTMLElement} cvEl #cvDoc
   * @param {{ budget?: number, retried?: boolean, innerSnapshot?: HTMLElement }} [options]
   * @returns {boolean}
   */
  function layoutCvA4Pages(cvEl, options) {
    const opts = options || {};
    const packBudget = opts.budget ?? PAGE_BUDGET_PX;
    if (!cvEl || !cvEl.classList.contains('cv--live')) return false;
    const inner = cvEl.querySelector(':scope > .cvInner');
    if (!inner) return false;

    const innerSnapshot = opts.innerSnapshot || inner.cloneNode(true);
    const units = collectUnits(inner);
    if (!units.length) return false;

    const magazineBody = inner.querySelector(':scope > .cvBody.cvBody--magazine, :scope > .cvEmSpread.cvBody--magazine');
    const editorialEmBody = inner.querySelector(':scope > .cvEmSpread.cvBody--magazine');
    const meta = {
      className: inner.className,
      sectionCount: inner.getAttribute('data-section-count') || '',
      isSplit: !!inner.querySelector(':scope > .cvBody'),
      isMagazine: !!magazineBody,
      isEditorialEm: !!editorialEmBody,
      mainClass: inner.querySelector(':scope > .cvMain, :scope > .cvBody > .cvMain')?.className || 'cvMain cvMain--full',
      sideClass: inner.querySelector(':scope > .cvBody > .cvSide')?.className || 'cvSide cvSide--meta',
      sideRight: inner.classList.contains('cvLayout-sideRight'),
    };

    const host = getMeasureHost(cvEl);
    const measureBudget = packBudget - (meta.isMagazine ? MAGAZINE_PACK_SLACK_PX : 0);
    let pageGroups = packUnits(units, meta, host, measureBudget);
    pageGroups = rebalancePageGroups(pageGroups, meta, host, measureBudget);
    pageGroups = removeBlankTrailingPages(pageGroups, meta, host, measureBudget);
    if (!pageGroups.length) return false;

    const stack = document.createElement('div');
    stack.className = 'cvA4Stack';
    stack.setAttribute('data-pages', String(pageGroups.length));

    pageGroups.forEach((group, idx) => {
      const sheet = document.createElement('div');
      sheet.className = 'cvA4Sheet';
      sheet.setAttribute('data-page', String(idx + 1));
      if (idx > 0) sheet.classList.add('html2pdf__page-break-before');

      const surface = document.createElement('div');
      surface.className = 'cvA4Sheet__surface';

      const pageInner = buildPageInner(meta, group, idx === 0);
      surface.appendChild(pageInner);
      sheet.appendChild(surface);
      stack.appendChild(sheet);
    });

    cvEl.classList.add('cv--a4');
    cvEl.replaceChildren(stack);
    annotateFirstPageFill(stack);

    const page1Inner = stack.querySelector('.cvA4Sheet[data-page="1"] .cvInner');
    const overflowPx = page1Inner ? page1Inner.scrollHeight - page1Inner.clientHeight : 0;
    const retries = opts.retries || 0;
    if (overflowPx > OVERFLOW_TOLERANCE_PX && retries < MAX_OVERFLOW_RETRIES) {
      cvEl.classList.remove('cv--a4');
      cvEl.replaceChildren(innerSnapshot.cloneNode(true));
      cvEl.classList.add('cv--live');
      const tighter = Math.max(900, packBudget - overflowPx - 12);
      return layoutCvA4Pages(cvEl, {
        budget: tighter,
        retries: retries + 1,
        innerSnapshot,
      });
    }

    const measureHost = global.document.getElementById('cvA4MeasureHost');
    if (measureHost) measureHost.innerHTML = '';
    if (global.HirelyA4Viewport?.apply) {
      global.requestAnimationFrame(() => global.HirelyA4Viewport.apply());
    }
    return true;
  }

  /** @param {HTMLElement} body */
  function splittableBodyChildren(body) {
    const entries = body.querySelectorAll(
      ':scope > .cvExpList > .cvExpEntry, :scope > .cvProjectList > .cvProjectEntry, :scope > .cvUnsortedList > *'
    );
    if (entries.length > 1) return [...entries];

    const lines = body.querySelectorAll(
      ':scope > p.cvSkillLine, :scope > p.cvToolsLine, :scope > p.cvLangLine, :scope > p.cvClientLine, :scope > p.cvEduLine, :scope > .cvEduLine'
    );
    if (lines.length > 1) return [...lines];

    const list = body.querySelector(
      ':scope > .cvExpList, :scope > .cvProjectList, :scope > .cvUnsortedList'
    );
    if (list && list.children.length > 1) return [...list.children];
    if (body.children.length > 1) return [...body.children];
    return [];
  }

  /** @param {object} unit */
  function subdivideUnit(unit) {
    const el = unit?.el;
    if (!el) return [unit];
    if (unit.kind === 'section-part' && el.classList.contains('cvExpEntry')) {
      return splitExpEntryUnit(unit);
    }
    if (unit.kind === 'block' && el.classList.contains('cvSection')) {
      return explodeBlock(el, unit.zone || 'main');
    }
    return [unit];
  }

  /** @param {object} unit */
  function splitExpEntryUnit(unit) {
    const el = unit.el;
    const headNodes = [...el.querySelectorAll(':scope > .cvExpRole, :scope > .cvExpCompany, :scope > .cvExpDates')];
    const otherHead = [...el.querySelectorAll(':scope > p:not(.cvExpBullet)')].filter(
      (n) => !headNodes.includes(n)
    );
    const bullets = [...el.querySelectorAll(':scope > .cvExpBullet, :scope > .cvExpDesc li, :scope > ul li')];
    if (bullets.length <= 1) return [unit];

    const out = [];
    for (let i = 0; i < bullets.length; i++) {
      const entry = global.document.createElement('div');
      entry.className = el.className;
      if (i === 0) {
        [...headNodes, ...otherHead].forEach((n) => entry.appendChild(n.cloneNode(true)));
      }
      entry.appendChild(bullets[i].cloneNode(true));
      out.push({
        ...unit,
        el: entry,
        kind: 'section-part',
      });
    }
    return out.length ? out : [unit];
  }

  /** @param {HTMLElement} block @param {'head'|'side'|'main'} zone */
  function explodeBlock(block, zone) {
    if (!block.classList.contains('cvSection')) {
      return [{ el: block, zone, kind: 'block' }];
    }
    const body = block.querySelector(':scope > .cvSectionBody');
    const entryCount = body ? body.querySelectorAll('.cvExpEntry, .cvProjectEntry').length : 0;
    const parts = body ? splittableBodyChildren(body) : [];
    const splittable =
      parts.length > 1 &&
      (SPLITTABLE_SECTION_RE.test(block.className) || entryCount > 1);
    if (!splittable) return [{ el: block, zone, kind: 'block' }];

    const units = [];
    const title = block.querySelector(':scope > .cvSectionTitle');
    const sectionClass = block.className;
    const listWrap = body.querySelector(
      ':scope > .cvExpList, :scope > .cvProjectList, :scope > .cvUnsortedList'
    );
    const listClass = listWrap?.className || '';
    let first = true;
    for (const child of parts) {
      if (first && title) {
        units.push({ el: title, zone, kind: 'section-title', sectionClass, listClass, sectionTitle: title });
        first = false;
      }
      units.push({
        el: child,
        zone,
        kind: 'section-part',
        sectionClass,
        listClass,
        sectionTitle: title || null,
      });
    }
    return units.length ? units : [{ el: block, zone, kind: 'block' }];
  }

  /** @param {HTMLElement} inner */
  function collectUnits(inner) {
    /** @type {object[]} */
    const units = [];
    const pushContainer = (container, zone) => {
      for (const block of [...container.children]) units.push(...explodeBlock(block, zone));
    };
    for (const child of [...inner.children]) {
      if (child.classList.contains('cvBody')) {
        if (child.classList.contains('cvBody--magazine')) {
          const metaCol = child.querySelector(':scope > .cvCol--meta');
          const centerCol = child.querySelector(':scope > .cvCol--center');
          const rightCol = child.querySelector(':scope > .cvCol--right');
          const emLeft = child.querySelector(':scope > .cvEmCol--left');
          const emFeature = child.querySelector(':scope > .cvEmCol--feature');
          const emRight = child.querySelector(':scope > .cvEmCol--right');
          if (centerCol) pushContainer(centerCol, 'main');
          else if (emFeature) pushContainer(emFeature, 'main');
          if (rightCol) pushContainer(rightCol, 'right');
          else if (emRight) pushContainer(emRight, 'right');
          if (metaCol) pushContainer(metaCol, 'side');
          else if (emLeft) pushContainer(emLeft, 'side');
        } else {
          const aside = child.querySelector(':scope > .cvSide');
          const main = child.querySelector(':scope > .cvMain');
          if (main) pushContainer(main, 'main');
          if (aside) pushContainer(aside, 'side');
        }
      } else if (child.classList.contains('cvMain')) {
        pushContainer(child, 'main');
      } else {
        units.push({ el: child, zone: 'head', kind: 'block' });
      }
    }
    return units;
  }

  /** @param {object[]} units */
  function assembleZoneBlocks(units) {
    const frag = global.document.createDocumentFragment();
    let section = null;
    let sectionBody = null;
    let listWrap = null;

    const flushSection = () => {
      if (section) {
        frag.appendChild(section);
        section = null;
        sectionBody = null;
        listWrap = null;
      }
    };

    for (const u of units) {
      if (u.kind === 'section-title') {
        flushSection();
        section = global.document.createElement('section');
        section.className = u.sectionClass || 'cvSection';
        section.appendChild(u.el);
        listWrap = null;
      } else if (u.kind === 'section-part') {
        if (!section) {
          section = global.document.createElement('section');
          section.className = u.sectionClass || 'cvSection';
          if (u.sectionTitle) {
            section.appendChild(u.sectionTitle.cloneNode(true));
          }
        }
        if (!sectionBody) {
          sectionBody = global.document.createElement('div');
          sectionBody.className = 'cvSectionBody';
          section.appendChild(sectionBody);
          listWrap = null;
        }
        if (u.listClass) {
          if (!listWrap) {
            listWrap = global.document.createElement('div');
            listWrap.className = u.listClass;
            sectionBody.appendChild(listWrap);
          }
          listWrap.appendChild(u.el);
        } else {
          sectionBody.appendChild(u.el);
        }
      } else {
        flushSection();
        frag.appendChild(u.el);
      }
    }
    flushSection();
    return frag;
  }

  /** @param {{ el: HTMLElement, zone: string }[]} units */
  function packUnits(units, meta, host, budget = PAGE_BUDGET_PX) {
    /** @type {{ el: HTMLElement, zone: string }[][]} */
    const pages = [];
    let i = 0;
    while (i < units.length) {
      let fit = 0;
      for (let n = 1; n <= units.length - i; n++) {
        const slice = units.slice(i, i + n);
        const h = measurePage(host, meta, slice, pages.length === 0);
        if (h <= budget) fit = n;
        else break;
      }
      if (fit === 0) {
        const subdivided = subdivideUnit(units[i]);
        if (subdivided.length > 1) {
          units.splice(i, 1, ...subdivided);
          continue;
        }
        fit = 1;
      }
      pages.push(units.slice(i, i + fit));
      i += fit;
    }
    return pages;
  }

  /** @param {object[]} group */
  function pageGroupVisibleChars(group) {
    let n = 0;
    for (const u of group || []) {
      const t = String(u.el?.innerText || u.el?.textContent || '').replace(/\s+/g, '');
      n += t.length;
      if (u.el?.querySelector?.('img, .cvPhoto')) return Math.max(n, 32);
    }
    return n;
  }

  /** @param {object[][]} pageGroups */
  function removeBlankTrailingPages(pageGroups, meta, host, budget = PAGE_BUDGET_PX) {
    let groups = pageGroups.filter((g) => g.length && pageGroupVisibleChars(g) > 0);
    let guard = 0;
    while (groups.length > 1 && pageGroupVisibleChars(groups[groups.length - 1]) < 20 && guard++ < 16) {
      const tail = groups.pop();
      groups[groups.length - 1].push(...tail);
      groups = rebalancePageGroups(groups, meta, host, budget).filter(
        (g) => g.length && pageGroupVisibleChars(g) > 0
      );
    }
    return groups;
  }

  /** @param {object[][]} pageGroups */
  function rebalancePageGroups(pageGroups, meta, host, budget = PAGE_BUDGET_PX) {
    let groups = pageGroups.map((g) => [...g]);

    for (let pass = 0; pass < MAX_REBALANCE_PASSES; pass++) {
      let changed = false;
      for (let i = 0; i < groups.length; i++) {
        const group = groups[i];
        if (!group.length) continue;
        const h = measurePage(host, meta, group, i === 0);
        if (h <= budget) continue;

        if (group.length > 1) {
          const tail = group.pop();
          if (!groups[i + 1]) groups.push([]);
          groups[i + 1].unshift(tail);
          changed = true;
          continue;
        }

        const expanded = subdivideUnit(group[0]);
        if (expanded.length > 1) {
          groups.splice(i, 1, ...packUnits(expanded, meta, host, budget));
          changed = true;
        }
      }

      groups = groups.filter((g) => g.length);
      if (!changed) break;
    }

    return groups;
  }

  function getMeasureHost(cvEl) {
    let host = global.document.getElementById('cvA4MeasureHost');
    if (!host) {
      host = global.document.createElement('div');
      host.id = 'cvA4MeasureHost';
      host.setAttribute('aria-hidden', 'true');
      host.style.cssText =
        'position:fixed;left:-12000px;top:0;visibility:hidden;pointer-events:none;z-index:-1;overflow:visible';
      global.document.body.appendChild(host);
    }
    host.className = cvEl.className.replace(/\bcv--live\b/g, '').trim();
    host.id = 'cvA4MeasureHost';
    for (const [key, value] of Object.entries(cvEl.dataset || {})) {
      host.dataset[key] = value;
    }
    host.style.width = `${A4_WIDTH_PX}px`;
    host.style.maxWidth = `${A4_WIDTH_PX}px`;
    host.innerHTML = '';
    return host;
  }

  /** @param {{ el: HTMLElement, zone: string }[]} group */
  function measurePage(host, meta, group, isFirst) {
    const cloned = group.map((u) => ({
      el: u.el.cloneNode(true),
      zone: u.zone,
      kind: u.kind,
      sectionClass: u.sectionClass,
      listClass: u.listClass,
      sectionTitle: u.sectionTitle || null,
    }));
    const inner = buildPageInner(meta, cloned, isFirst);
    host.innerHTML = '';
    const sheet = global.document.createElement('div');
    sheet.className = 'cvA4Sheet cvA4Sheet--measure';
    sheet.style.width = `${A4_WIDTH_PX}px`;
    sheet.style.height = `${A4_HEIGHT_PX}px`;
    sheet.style.overflow = 'hidden';
    const surface = global.document.createElement('div');
    surface.className = 'cvA4Sheet__surface';
    surface.appendChild(inner);
    sheet.appendChild(surface);
    host.appendChild(sheet);
    return Math.max(inner.scrollHeight, inner.offsetHeight);
  }

  /** @param {{ el: HTMLElement, zone: string }[]} group */
  function buildPageInner(meta, group, isFirst) {
    const inner = global.document.createElement('div');
    inner.className = meta.className + (isFirst ? '' : ' cvA4Page--continue');
    if (meta.sectionCount) inner.setAttribute('data-section-count', meta.sectionCount);

    const heads = group.filter((u) => u.zone === 'head');
    const sides = group.filter((u) => u.zone === 'side');
    const mains = group.filter((u) => u.zone === 'main');
    const rights = group.filter((u) => u.zone === 'right');

    heads.forEach((u) => inner.appendChild(u.el));

    const useMagazine = isFirst && meta.isMagazine && (sides.length > 0 || mains.length > 0 || rights.length > 0);
    if (useMagazine) {
      const body = global.document.createElement('div');
      body.className = meta.isEditorialEm ? 'cvEmSpread cvBody cvBody--magazine' : 'cvBody cvBody--magazine';
      const metaCol = global.document.createElement('aside');
      metaCol.className = meta.isEditorialEm ? 'cvEmCol cvEmCol--left' : 'cvCol cvCol--meta';
      metaCol.appendChild(assembleZoneBlocks(sides));
      const centerCol = global.document.createElement('main');
      centerCol.className = meta.isEditorialEm ? 'cvEmCol cvEmCol--feature' : 'cvCol cvCol--center';
      centerCol.appendChild(assembleZoneBlocks(mains));
      const rightCol = global.document.createElement('aside');
      rightCol.className = meta.isEditorialEm ? 'cvEmCol cvEmCol--right' : 'cvCol cvCol--right';
      rightCol.appendChild(assembleZoneBlocks(rights));
      body.appendChild(metaCol);
      body.appendChild(centerCol);
      body.appendChild(rightCol);
      inner.appendChild(body);
    } else {
    const useSplit = isFirst && meta.isSplit && sides.length > 0;
    if (useSplit) {
      const body = global.document.createElement('div');
      body.className = 'cvBody';
      const aside = global.document.createElement('aside');
      aside.className = meta.sideClass;
      aside.appendChild(assembleZoneBlocks(sides));
      const main = global.document.createElement('main');
      main.className = meta.mainClass;
      main.appendChild(assembleZoneBlocks(mains));
      if (meta.sideRight) {
        body.appendChild(main);
        body.appendChild(aside);
      } else {
        body.appendChild(aside);
        body.appendChild(main);
      }
      inner.appendChild(body);
    } else {
      const main = global.document.createElement('main');
      main.className = isFirst && !meta.isSplit ? meta.mainClass : 'cvMain cvMain--full';
      main.appendChild(assembleZoneBlocks(mains));
      main.appendChild(assembleZoneBlocks(sides));
      if (main.childNodes.length) inner.appendChild(main);
    }
    }

    return inner;
  }

  /**
   * @param {HTMLElement} root .cvStageInner or .cvDocWrap
   */
  function syncA4StackMetrics(root) {
    const stack = global.document.querySelector('#cvDoc .cvA4Stack');
    const inner = root || global.document.querySelector('.cvStageInner');
    if (!inner) return { pages: 1, stackHeight: A4_HEIGHT_PX };
    const pages = stack ? stack.querySelectorAll(':scope > .cvA4Sheet').length : 1;
    const stackHeight = pages * A4_HEIGHT_PX + Math.max(0, pages - 1) * PAGE_GAP_PX;
    inner.style.setProperty('--cv-a4-pages', String(pages));
    inner.style.setProperty('--cv-a4-stack-height', `${stackHeight}px`);
    return { pages, stackHeight };
  }

  function resetCvA4Pages(cvEl) {
    if (!cvEl) return;
    cvEl.classList.remove('cv--a4');
  }

  function detectPageOverflow(root) {
    if (global.HirelyA4Viewport?.detectPageOverflow) {
      return global.HirelyA4Viewport.detectPageOverflow(root);
    }
    return { hasOverflow: false, pages: [], pageCount: 0 };
  }

  /**
   * Re-run pagination on an existing live CV (e.g. after font load).
   * @param {HTMLElement} cvEl
   */
  function annotateFirstPageFill(stack) {
    if (!stack) return;
    const sheet = stack.querySelector('.cvA4Sheet[data-page="1"]') || stack.querySelector('.cvA4Sheet');
    if (!sheet) return;
    const inner = sheet.querySelector('.cvInner');
    if (!inner) return;
    const contentPx = Math.max(inner.scrollHeight, inner.offsetHeight);
    const fillPct = Math.min(100, Math.round((contentPx / A4_HEIGHT_PX) * 1000) / 10);
    sheet.setAttribute('data-fill-pct', String(fillPct));
    sheet.setAttribute('data-content-px', String(contentPx));
  }

  function rebalanceCvA4Pages(cvEl) {
    if (!cvEl?.classList.contains('cv--a4')) return layoutCvA4Pages(cvEl);
    const stack = cvEl.querySelector(':scope > .cvA4Stack');
    if (!stack) return layoutCvA4Pages(cvEl);
    cvEl.classList.remove('cv--a4');
    const inner = global.document.createElement('div');
    inner.className = 'cvInner';
    const sheets = [...stack.querySelectorAll('.cvA4Sheet')];
    for (const sheet of sheets) {
      const pageInner = sheet.querySelector('.cvInner');
      if (pageInner) inner.appendChild(pageInner.cloneNode(true));
    }
    cvEl.replaceChildren(inner);
    cvEl.classList.add('cv--live');
    return layoutCvA4Pages(cvEl);
  }

  global.HirelyA4Pages = {
    A4_WIDTH_PX,
    A4_HEIGHT_PX,
    PAGE_GAP_PX,
    PAGE_BUDGET_PX,
    OVERFLOW_TOLERANCE_PX,
    layoutCvA4Pages,
    rebalanceCvA4Pages,
    syncA4StackMetrics,
    resetCvA4Pages,
    detectPageOverflow,
  };
})(typeof window !== 'undefined' ? window : globalThis);
