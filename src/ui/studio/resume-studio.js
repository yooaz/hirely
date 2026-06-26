/**
 * Resume Studio — section rail + focused editor + suggestions (user-controlled).
 */

import {
  normalizeResumeData,
  reorderListItems,
  reorderExperiences,
  clearListSection,
} from '../../core/resume-data.js';
import { ensureResumeBlocks } from '../../core/resume-blocks.js';
import { resolveCreativeResumeMode, getStudioBlockTypes } from '../../core/creative-resume-mode.js';
import { renderResumeEditorSection, mountResumeEditor } from '../editor/resume-editor.js';
import { renderBlockCanvas, mountBlockCanvas } from './block-canvas.js';
import { renderSmartRepairCards } from './smart-repair.js';

/** Default studio rail — identity, experience, education, skills, contact */
export const STUDIO_CORE_SECTIONS = [
  { id: 'identity', label: 'Identité', count: (rd) => (rd.identity?.name || rd.identity?.title ? 1 : 0) },
  { id: 'experience', label: 'Expérience', count: (rd) => rd.experiences?.length || 0 },
  { id: 'education', label: 'Formation', count: (rd) => rd.education?.length || 0 },
  {
    id: 'skill',
    label: 'Compétences',
    count: (rd) => (rd.skills?.length || 0) + (rd.tools?.length || 0),
  },
  {
    id: 'contact',
    label: 'Contact',
    count: (rd) => {
      const id = rd.identity || {};
      return [id.email, id.phone, id.location, id.linkedin, id.website].filter((v) => String(v || '').trim()).length;
    },
  },
];

/** Collapsed by default — creative / portfolio extras */
export const STUDIO_ADVANCED_SECTIONS = [
  { id: 'summary', label: 'Résumé', count: (rd) => (rd.summary ? 1 : 0) },
  { id: 'client', label: 'Clients', count: (rd) => rd.clients?.length || 0 },
  { id: 'project', label: 'Projets', count: (rd) => rd.projects?.length || 0 },
  { id: 'publication', label: 'Publications', count: (rd) => rd.publications?.length || 0 },
  { id: 'exhibition', label: 'Expositions', count: (rd) => rd.exhibitions?.length || 0 },
  { id: 'award', label: 'Prix', count: (rd) => rd.awards?.length || 0 },
  { id: 'portfolio', label: 'Portfolio', count: (rd) => rd.portfolioLinks?.length || 0 },
  { id: 'language', label: 'Langues', count: (rd) => rd.languages?.length || 0 },
];

export const STUDIO_SECTIONS = [...STUDIO_CORE_SECTIONS, ...STUDIO_ADVANCED_SECTIONS];

const LIST_SECTION_MAP = {
  education: 'education',
  client: 'clients',
  project: 'projects',
  skill: 'skills',
  tool: 'tools',
  language: 'languages',
  publication: 'publications',
  exhibition: 'exhibitions',
  award: 'awards',
  portfolio: 'portfolioLinks',
};

function studioSectionBtn(s, rd, activeId) {
  const n = s.count(rd);
  const active = s.id === activeId ? ' active' : '';
  return `<li><button type="button" class="studioSectionBtn${active}" data-studio-section="${s.id}"><span>${s.label}</span><span class="studioCount">${n}</span></button></li>`;
}

/**
 * @param {HTMLElement} navEl
 * @param {object} data resumeData
 * @param {string} activeId
 * @param {(id: string) => void} onSelect
 */
export function renderStudioSectionNav(navEl, data, activeId, onSelect) {
  if (!navEl) return;
  const rd = normalizeResumeData(data);
  const coreItems = STUDIO_CORE_SECTIONS.map((s) => studioSectionBtn(s, rd, activeId)).join('');
  const advItems = STUDIO_ADVANCED_SECTIONS.map((s) => studioSectionBtn(s, rd, activeId)).join('');
  const advOpen = STUDIO_ADVANCED_SECTIONS.some((s) => s.id === activeId) ? ' open' : '';
  navEl.innerHTML = `<h3>Rubriques</h3><ul class="studioSectionList">${coreItems}</ul><details class="studioSectionAdvanced"${advOpen}><summary class="studioSectionAdvancedSummary">Rubriques avancées</summary><ul class="studioSectionList studioSectionList--advanced">${advItems}</ul></details>`;
  if (!navEl._studioNavBound) {
    navEl._studioNavBound = true;
    navEl.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-studio-section]');
      if (!btn) return;
      onSelect(btn.dataset.studioSection);
    });
  }
}

/**
 * @param {HTMLElement} root editor root
 * @param {object} hooks
 * @param {string} sectionId
 */
export function renderStudioSectionEditor(root, hooks, sectionId) {
  if (!root) return;
  renderResumeEditorSection(root, hooks.getResumeData(), sectionId || 'identity');
}

/**
 * @param {HTMLElement} panel
 * @param {object} opts
 */
export function renderStudioSuggestions(panel, opts = {}) {
  if (!panel) return;
  const esc = opts.esc || ((s) => String(s));
  const classify = opts.classifyItems || [];
  const issues = opts.issues || [];
  const suggestOnly = !!opts.suggestOnly;
  const maxClassify = opts.maxClassifyItems ?? (suggestOnly ? 5 : 3);
  const parts = [];

  if (classify.length) {
    parts.push(
      renderSmartRepairCards({
        esc,
        items: classify,
        targets: opts.classifyTargets || [],
        lineLabel: opts.repairLineLabel || 'Texte importé',
        compact: opts.compactClassify !== false,
        maxVisible: maxClassify,
      })
    );
  }

  if (!suggestOnly) {
    for (const it of issues.slice(0, Math.max(0, 3 - (classify.length ? 1 : 0)))) {
      const cls = it.warn ? 'studioSuggest--warn' : '';
      parts.push(`<li class="${cls}">${esc(it.text)}</li>`);
    }
  }

  if (!parts.length) {
    parts.push(`<li class="studioSuggest--ok">${esc(opts.allOk || 'Tout est prêt.')}</li>`);
  }

  panel.classList.toggle('studioSuggestionsPanel--repair', !!(suggestOnly && classify.length));
  panel.innerHTML = `<h3>${esc(opts.title || 'Suggestions')}</h3><p class="studioSuggestLead">${esc(opts.lead || 'Conseils optionnels — vous gardez le contrôle.')}</p><ul class="studioSuggestList">${parts.join('')}</ul>`;
}

/**
 * Wire studio reorder / clear actions on editor root.
 */
export function bindStudioEditorActions(root, hooks) {
  if (!root || root._studioActionsBound) return;
  root._studioActionsBound = true;
  root.addEventListener('click', (e) => {
    const reorder = e.target.closest('[data-studio-reorder]');
    if (reorder) {
      let data = normalizeResumeData(hooks.getResumeData());
      const kind = reorder.dataset.studioReorder;
      const idx = +reorder.dataset.studioIndex;
      const dir = reorder.dataset.studioDir === 'up' ? -1 : 1;
      if (kind === 'experience') data = reorderExperiences(data, idx, dir);
      else if (LIST_SECTION_MAP[kind]) data = reorderListItems(data, LIST_SECTION_MAP[kind], idx, dir);
      hooks.setResumeData(data);
      hooks.onChange(reorder.dataset.studioSection || kind);
      return;
    }
    const clearSec = e.target.closest('[data-studio-clear-section]');
    if (clearSec) {
      const sec = clearSec.dataset.studioClearSection;
      let data = normalizeResumeData(hooks.getResumeData());
      if (sec === 'experience') data.experiences = [];
      else if (LIST_SECTION_MAP[sec]) data = clearListSection(data, LIST_SECTION_MAP[sec]);
      else if (sec === 'summary') data.summary = '';
      else if (sec === 'contact') {
        data.identity.email = '';
        data.identity.phone = '';
        data.identity.location = '';
        data.identity.linkedin = '';
        data.identity.website = '';
      }
      hooks.setResumeData(data);
      hooks.onChange(sec);
    }
  });
}

/**
 * @param {object} config
 */
export function mountResumeStudio(config) {
  const {
    navEl,
    editorRoot,
    suggestionsEl,
    getResumeData,
    setResumeData,
    onChange,
    getActiveSection,
    setActiveSection,
    getSuggestions,
    useBlockCanvas = false,
  } = config;

  const hooks = {
    getResumeData: () => ensureResumeBlocks(getResumeData()),
    setResumeData: (d) => setResumeData(ensureResumeBlocks(d)),
    onChange: (meta) => onChange?.(meta),
  };

  if (useBlockCanvas && editorRoot) {
    mountBlockCanvas(editorRoot, hooks);
  } else if (editorRoot && !editorRoot._hirelyEditorMounted) {
    mountResumeEditor(editorRoot, {
      ...hooks,
      rerender: () => renderStudioSectionEditor(editorRoot, hooks, getActiveSection?.() || 'identity'),
    });
    bindStudioEditorActions(editorRoot, {
      ...hooks,
      onChange: (sectionId) => {
        if (sectionId) setActiveSection?.(sectionId);
        onChange?.();
      },
    });
  }

  const refresh = () => {
    const data = hooks.getResumeData();
    if (useBlockCanvas && editorRoot) {
      const creative = resolveCreativeResumeMode(data);
      renderBlockCanvas(editorRoot, data, {
        creativeMode: creative,
        blockTypes: getStudioBlockTypes(creative.active) || undefined,
      });
    } else {
      const active = getActiveSection?.() || 'identity';
      renderStudioSectionNav(navEl, data, active, (id) => {
        setActiveSection?.(id);
        renderStudioSectionEditor(editorRoot, hooks, id);
        onChange?.();
      });
      renderStudioSectionEditor(editorRoot, hooks, active);
    }
    if (suggestionsEl && getSuggestions) {
      renderStudioSuggestions(suggestionsEl, getSuggestions());
    }
  };

  return { refresh, hooks };
}
