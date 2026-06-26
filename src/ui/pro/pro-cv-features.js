/**
 * Hirely Pro — profile photo editor + drag-and-drop section order.
 * Local state only; no server upload.
 */
(function (global) {
  const PHOTO_SUPPORTED_TEMPLATES = new Set([
    'ats-recruiter',
    'mckinsey-consulting',
    'apple-minimal',
    'kinfolk-editorial',
    'creative-director-portfolio',
    'luxury-executive',
    'startup-founder',
    'tech-engineer',
    'art-director',
    'classic-corporate',
    'creative-director',
    'executive-luxury',
    'editorial-magazine',
    'art-director-portfolio',
    'swiss-editorial',
    'visual-timeline',
    'agency-designer',
    'startup-builder',
    'tech-structured',
    'ats-elite',
    'ats',
    'ats-executive',
    'luxury-minimal',
    'creative-portfolio',
  ]);

  const PHOTO_HIDDEN_BY_DEFAULT = new Set(['ats-elite', 'ats', 'ats-executive', 'ats-recruiter']);

  const DEFAULT_SECTION_ORDER = [
    'summary',
    'experience',
    'clients',
    'projects',
    'education',
    'skills',
    'tools',
    'languages',
    'portfolio',
  ];

  const SECTION_LABELS_FR = {
    summary: 'Profil',
    experience: 'Expériences',
    clients: 'Clients',
    projects: 'Projets',
    education: 'Formation',
    skills: 'Compétences',
    tools: 'Outils',
    languages: 'Langues',
    portfolio: 'Portfolio',
  };

  function defaultPhotoEnabledForTemplate(templateId) {
    return !PHOTO_HIDDEN_BY_DEFAULT.has(String(templateId || '').toLowerCase());
  }

  function templateSupportsPhoto(templateId) {
    const id = String(templateId || '').toLowerCase();
    if (PHOTO_SUPPORTED_TEMPLATES.has(id)) return true;
    if (global.HirelyTemplates?.resolve) {
      const resolved = global.HirelyTemplates.resolve(id).id;
      if (PHOTO_SUPPORTED_TEMPLATES.has(resolved)) return true;
      if (global.HirelyTemplates.PRODUCTION_TEMPLATE_IDS?.includes(resolved)) return true;
    }
    return false;
  }

  function isPhotoActive(state, templateId) {
    if (!state?.photo) return false;
    const tpl = String(templateId || state.template || '').toLowerCase();
    if (!templateSupportsPhoto(tpl)) return false;
    const per = state.photoPerTemplate || {};
    const enabled = per[tpl] !== undefined ? !!per[tpl] : defaultPhotoEnabledForTemplate(tpl);
    return enabled && !!state.includePhoto;
  }

  function ensureSectionOrder(state) {
    if (!Array.isArray(state.sectionOrder) || !state.sectionOrder.length) {
      state.sectionOrder = DEFAULT_SECTION_ORDER.slice();
    }
    return state.sectionOrder;
  }

  function atsOrderWarning(order) {
    const o = order || DEFAULT_SECTION_ORDER;
    const exp = o.indexOf('experience');
    const skills = o.indexOf('skills');
    if (exp < 0 || skills < 0) return '';
    if (skills < exp) {
      return "L'ordre ATS recommandé place l'expérience avant les compétences.";
    }
    return '';
  }

  function initProCvFeatures(deps) {
    const { state, $, esc, requirePro, renderCV, resolveTemplateId, t } = deps;
    if (!state) return;

    ensureSectionOrder(state);
    if (!state.sectionHidden || typeof state.sectionHidden !== 'object') state.sectionHidden = {};
    if (!state.photoCrop) state.photoCrop = { zoom: 1, x: 50, y: 50 };
    if (!state.photoPerTemplate) state.photoPerTemplate = {};

    const layoutTools = $('proCvLayoutTools');
    const layoutToggle = $('proCvLayoutToggle');
    const editDrawer = $('proCvEditDrawer');
    const bar = $('proCvEditBar');
    const orderList = $('proCvSectionOrder');
    const orderResetBtn = $('proCvSectionOrderReset');
    const atsWarn = $('proCvAtsOrderWarn');
    const photoBtn = $('proCvPhotoBtn');
    const photoCropBtn = $('proCvPhotoCropBtn');
    const photoHideBtn = $('proCvPhotoHideBtn');
    const photoRemoveBtn = $('proCvPhotoRemoveBtn');
    const photoToggle = $('proCvPhotoTemplateToggle');
    const photoThumb = $('proCvPhotoThumb');
    const photoInput = $('proCvPhotoInput');
    const dialog = $('photoEditorDialog');
    const editorImg = $('photoEditorImg');
    const zoomRange = $('photoEditorZoom');
    const posXRange = $('photoEditorPosX');
    const posYRange = $('photoEditorPosY');
    const editorCancel = $('photoEditorCancel');
    const editorSave = $('photoEditorSave');
    const editorRemove = $('photoEditorRemove');

    let dragKey = null;
    let editorSource = null;

    function setDrawerOpen(open) {
      if (!editDrawer) return;
      editDrawer.hidden = !open;
      if (layoutToggle) layoutToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    function syncBarVisibility() {
      if (!layoutTools) return;
      const show = state.generated || !!state.finalResumeData || !!state.cvData;
      layoutTools.classList.toggle('hidden', !show);
      if (!show) setDrawerOpen(false);
    }

    function resetSectionOrder() {
      state.sectionOrder = DEFAULT_SECTION_ORDER.slice();
      state.sectionHidden = {};
      renderSectionOrderList();
      renderCV();
    }

    function syncPhotoThumb() {
      if (!photoThumb) return;
      if (!state.photo) {
        photoThumb.className = 'proCvPhotoThumb proCvPhotoThumb--empty';
        photoThumb.textContent = '—';
        if (photoCropBtn) photoCropBtn.classList.add('hidden');
        if (photoHideBtn) photoHideBtn.classList.add('hidden');
        if (photoRemoveBtn) photoRemoveBtn.classList.add('hidden');
        if (photoBtn) photoBtn.textContent = 'Ajouter une photo';
        return;
      }
      photoThumb.className = 'proCvPhotoThumb';
      photoThumb.innerHTML = `<img src="${esc(state.photo)}" alt="">`;
      if (photoCropBtn) photoCropBtn.classList.remove('hidden');
      if (photoHideBtn) photoHideBtn.classList.remove('hidden');
      if (photoRemoveBtn) photoRemoveBtn.classList.remove('hidden');
      if (photoBtn) photoBtn.textContent = 'Modifier la photo';
    }

    function syncPhotoTemplateToggle() {
      if (!photoToggle) return;
      const tpl = resolveTemplateId(state.template);
      const supports = templateSupportsPhoto(tpl);
      photoToggle.disabled = !supports || !state.photo;
      if (!supports) {
        photoToggle.checked = false;
        return;
      }
      const per = state.photoPerTemplate || {};
      const enabled = per[tpl] !== undefined ? !!per[tpl] : defaultPhotoEnabledForTemplate(tpl);
      photoToggle.checked = enabled && !!state.includePhoto;
    }

    function setPhotoEnabledForTemplate(enabled) {
      const tpl = resolveTemplateId(state.template);
      if (!state.photoPerTemplate) state.photoPerTemplate = {};
      state.photoPerTemplate[tpl] = !!enabled;
      state.includePhoto = !!enabled && !!state.photo;
      syncPhotoTemplateToggle();
      renderCV();
    }

    function hidePhotoOnTemplate() {
      setPhotoEnabledForTemplate(false);
    }

    function applyPhotoCropStyle() {
      const crop = global.HirelyPhotoSystemV2?.sanitizePhotoCrop
        ? global.HirelyPhotoSystemV2.sanitizePhotoCrop(state.photoCrop)
        : state.photoCrop || { zoom: 1, x: 50, y: 50 };
      const imgs = document.querySelectorAll('#cvDoc .cvPhoto');
      imgs.forEach((img) => {
        img.style.objectFit = 'cover';
        img.style.objectPosition = `${crop.x}% ${crop.y}%`;
        img.style.transform = 'none';
        img.style.transformOrigin = 'center center';
      });
    }

    function updateEditorTransform() {
      if (!editorImg) return;
      const z = Number(zoomRange?.value || state.photoCrop.zoom || 1);
      const x = Number(posXRange?.value || state.photoCrop.x || 50);
      const y = Number(posYRange?.value || state.photoCrop.y || 50);
      editorImg.style.transform = `translate(-50%, -50%) scale(${z}) translate(${(x - 50) * 1.2}%, ${(y - 50) * 1.2}%)`;
    }

    function openPhotoEditor() {
      if (!requirePro() || !state.photo || !dialog) return;
      editorSource = state.photo;
      if (editorImg) editorImg.src = editorSource;
      if (zoomRange) zoomRange.value = String(state.photoCrop?.zoom || 1);
      if (posXRange) posXRange.value = String(state.photoCrop?.x || 50);
      if (posYRange) posYRange.value = String(state.photoCrop?.y || 50);
      updateEditorTransform();
      if (typeof dialog.showModal === 'function') dialog.showModal();
    }

    function cropPhotoToDataUrl() {
      return new Promise((resolve) => {
        const src = editorSource || state.photo;
        if (!src) {
          resolve(null);
          return;
        }
        const img = new Image();
        img.onload = () => {
          const z = Number(zoomRange?.value || 1);
          const px = Number(posXRange?.value || 50);
          const py = Number(posYRange?.value || 50);
          const size = 512;
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');
          const min = Math.min(img.width, img.height);
          const base = min / z;
          const sx = ((px / 100) * img.width - base / 2);
          const sy = ((py / 100) * img.height - base / 2);
          const clampedSx = Math.max(0, Math.min(img.width - base, sx));
          const clampedSy = Math.max(0, Math.min(img.height - base, sy));
          ctx.drawImage(img, clampedSx, clampedSy, base, base, 0, 0, size, size);
          resolve(canvas.toDataURL('image/jpeg', 0.92));
        };
        img.onerror = () => resolve(src);
        img.src = src;
      });
    }

    async function savePhotoEditor() {
      const cropped = await cropPhotoToDataUrl();
      if (cropped) state.photo = cropped;
      state.photoCrop = { zoom: 1, x: 50, y: 50 };
      if (dialog?.open) dialog.close();
      const tpl = resolveTemplateId(state.template);
      if (state.photoPerTemplate[tpl] === undefined) {
        state.photoPerTemplate[tpl] = defaultPhotoEnabledForTemplate(tpl);
      }
      state.includePhoto = !!state.photoPerTemplate[tpl];
      syncPhotoThumb();
      syncPhotoTemplateToggle();
      renderCV();
      requestAnimationFrame(applyPhotoCropStyle);
    }

    function removePhoto() {
      state.photo = null;
      state.includePhoto = false;
      state.photoCrop = { zoom: 1, x: 50, y: 50 };
      if (photoInput) photoInput.value = '';
      syncPhotoThumb();
      syncPhotoTemplateToggle();
      renderCV();
    }

    function onPhotoFile(file) {
      if (!file || !requirePro()) return;
      const ok = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type);
      if (!ok) return;
      const reader = new FileReader();
      reader.onload = () => {
        const raw = reader.result;
        const autoCrop = global.HirelyPhotoSystemV2?.autoCropPhotoDataUrl;
        const finish = (result) => {
          const dataUrl = result?.dataUrl || raw;
          const focus = result?.focus || { x: 50, y: 50 };
          state.photo = dataUrl;
          state.photoCrop = { zoom: 1, x: focus.x, y: focus.y };
          const tpl = resolveTemplateId(state.template);
          if (state.photoPerTemplate[tpl] === undefined) {
            state.photoPerTemplate[tpl] = defaultPhotoEnabledForTemplate(tpl);
          }
          state.includePhoto = !!state.photoPerTemplate[tpl];
          syncPhotoThumb();
          syncPhotoTemplateToggle();
          if ($('includePhoto')) $('includePhoto').checked = !!state.includePhoto;
          openPhotoEditor();
        };
        if (autoCrop) {
          void autoCrop(raw).then(finish);
        } else {
          finish({ dataUrl: raw, focus: { x: 50, y: 50 } });
        }
      };
      reader.readAsDataURL(file);
    }

    function renderSectionOrderList() {
      if (!orderList) return;
      ensureSectionOrder(state);
      orderList.innerHTML = '';
      state.sectionOrder.forEach((key) => {
        const li = document.createElement('li');
        li.className = 'proCvSectionOrderItem';
        li.draggable = true;
        li.dataset.sectionKey = key;
        const visible = !state.sectionHidden[key];
        li.innerHTML = `<label class="proCvSectionOrderVis" title="Afficher / masquer"><input type="checkbox" class="proCvSectionVisToggle" data-section-key="${esc(key)}" ${visible ? 'checked' : ''} /></label><span class="proCvSectionOrderHandle" aria-hidden="true">⠿</span><span class="proCvSectionOrderLabel${visible ? '' : ' is-hidden-section'}">${esc(SECTION_LABELS_FR[key] || key)}</span>`;
        const visInput = li.querySelector('.proCvSectionVisToggle');
        if (visInput) {
          visInput.addEventListener('change', (e) => {
            e.stopPropagation();
            if (!requirePro()) {
              visInput.checked = !visInput.checked;
              return;
            }
            const k = visInput.dataset.sectionKey;
            if (visInput.checked) delete state.sectionHidden[k];
            else state.sectionHidden[k] = true;
            const label = li.querySelector('.proCvSectionOrderLabel');
            if (label) label.classList.toggle('is-hidden-section', !visInput.checked);
            syncAtsWarning();
            renderCV();
          });
          visInput.addEventListener('click', (e) => e.stopPropagation());
        }
        li.addEventListener('dragstart', (e) => {
          dragKey = key;
          li.classList.add('is-dragging');
          e.dataTransfer?.setData('text/plain', key);
        });
        li.addEventListener('dragend', () => {
          dragKey = null;
          li.classList.remove('is-dragging');
        });
        li.addEventListener('dragover', (e) => {
          e.preventDefault();
        });
        li.addEventListener('drop', (e) => {
          e.preventDefault();
          const from = dragKey || e.dataTransfer?.getData('text/plain');
          const to = key;
          if (!from || from === to) return;
          const order = ensureSectionOrder(state);
          const fromIdx = order.indexOf(from);
          const toIdx = order.indexOf(to);
          if (fromIdx < 0 || toIdx < 0) return;
          order.splice(fromIdx, 1);
          order.splice(toIdx, 0, from);
          renderSectionOrderList();
          syncAtsWarning();
          renderCV();
        });
        orderList.appendChild(li);
      });
      syncAtsWarning();
    }

    function syncAtsWarning() {
      if (!atsWarn) return;
      const tpl = resolveTemplateId(state.template);
      const warn = tpl === 'ats-elite' ? atsOrderWarning(state.sectionOrder) : '';
      atsWarn.textContent = warn;
      atsWarn.classList.toggle('hidden', !warn);
    }

    function syncOnTemplateChange() {
      syncPhotoTemplateToggle();
      syncAtsWarning();
    }

    if (layoutToggle) {
      layoutToggle.onclick = () => {
        if (!requirePro()) return;
        setDrawerOpen(!!editDrawer?.hidden);
      };
    }
    if (orderResetBtn) {
      orderResetBtn.onclick = () => {
        if (!requirePro()) return;
        resetSectionOrder();
      };
    }
    if (photoBtn) {
      photoBtn.onclick = () => {
        if (!requirePro()) return;
        if (state.photo) openPhotoEditor();
        else if (photoInput) photoInput.click();
      };
    }
    if (photoCropBtn) photoCropBtn.onclick = () => openPhotoEditor();
    if (photoHideBtn) photoHideBtn.onclick = () => {
      if (!requirePro()) return;
      hidePhotoOnTemplate();
    };
    if (photoRemoveBtn) photoRemoveBtn.onclick = () => {
      if (!requirePro()) return;
      removePhoto();
    };
    if (photoInput) {
      photoInput.onchange = (e) => {
        const f = e.target.files && e.target.files[0];
        if (f) onPhotoFile(f);
      };
    }
    if (photoToggle) {
      photoToggle.onchange = (e) => setPhotoEnabledForTemplate(e.target.checked);
    }
    if (editorCancel) editorCancel.onclick = () => dialog?.close();
    if (editorRemove) editorRemove.onclick = () => {
      dialog?.close();
      removePhoto();
    };
    if (editorSave) editorSave.onclick = () => void savePhotoEditor();
    [zoomRange, posXRange, posYRange].forEach((el) => {
      if (el) el.oninput = updateEditorTransform;
    });

    renderSectionOrderList();
    syncPhotoThumb();
    syncPhotoTemplateToggle();
    syncBarVisibility();
    setDrawerOpen(false);

    global.HirelyProCvFeatures = {
      DEFAULT_SECTION_ORDER,
      PHOTO_SUPPORTED_TEMPLATES,
      PHOTO_HIDDEN_BY_DEFAULT,
      templateSupportsPhoto,
      isPhotoActive,
      defaultPhotoEnabledForTemplate,
      atsOrderWarning,
      ensureSectionOrder,
      syncBarVisibility,
      setDrawerOpen,
      resetSectionOrder,
      syncOnTemplateChange,
      applyPhotoCropStyle,
      renderSectionOrderList,
      syncPhotoThumb,
      syncPhotoTemplateToggle,
      hidePhotoOnTemplate,
      removePhoto,
    };
  }

  global.initProCvFeatures = initProCvFeatures;
})(typeof window !== 'undefined' ? window : globalThis);
