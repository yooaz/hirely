/**
 * Studio suggestions — user places imported lines into sections.
 * Never auto-applies; user must choose a destination.
 */

export const SMART_REPAIR_TARGETS = ['experience', 'education', 'client', 'skill'];

export const CREATIVE_SMART_REPAIR_TARGETS = [
  'client',
  'project',
  'exhibition',
  'award',
  'publication',
  'portfolio',
];

/** Production studio dropdown targets (À classer). */
export const STUDIO_CLASSIFY_TARGETS = [
  'client',
  'project',
  'exhibition',
  'award',
  'publication',
  'portfolio',
  'experience',
  'education',
  'tool',
  'language',
  'ignore',
];

export const STUDIO_CLASSIFY_VISIBLE_MAX = 5;

/**
 * @param {(key: string) => string} t i18n lookup
 * @returns {{ id: string, label: string }[]}
 */
export function smartRepairTargetButtons(t, creativeActive = false) {
  const lookup = typeof t === 'function' ? t : (k) => k;
  const ids = creativeActive ? CREATIVE_SMART_REPAIR_TARGETS : SMART_REPAIR_TARGETS;
  return ids.map((id) => ({
    id,
    label: lookup(`smartRepair_move_${id}`),
  }));
}

/**
 * @param {(key: string) => string} t
 * @returns {{ id: string, label: string }[]}
 */
export function studioClassifyTargetButtons(t) {
  const lookup = typeof t === 'function' ? t : (k) => k;
  return STUDIO_CLASSIFY_TARGETS.map((id) => ({
    id,
    label: lookup(`smartRepair_move_${id}`) || lookup(`classify_${id}`) || id,
  }));
}

/**
 * @param {object} opts
 * @param {(s: string) => string} opts.esc
 * @param {object[]} opts.items classify rows
 * @param {{ id: string, label: string }[]} opts.targets
 * @param {string} [opts.lineLabel]
 * @param {boolean} [opts.compact] dropdown + ignore row
 * @param {number} [opts.maxVisible]
 * @returns {string}
 */
export function renderSmartRepairCards(opts = {}) {
  const esc = opts.esc || ((s) => String(s));
  const items = opts.items || [];
  const targets = opts.targets || [];
  const lineLabel = opts.lineLabel || 'Texte importé';
  const maxVisible = opts.maxVisible ?? STUDIO_CLASSIFY_VISIBLE_MAX;
  const compact = opts.compact !== false;

  if (compact && targets.length) {
    const visible = items.slice(0, maxVisible);
    const rest = Math.max(0, items.length - visible.length);
    const cards = visible
      .map((it) => {
        const text = esc(String(it.text || '').trim());
        const line = esc(String(it.text || '').trim());
        const id = esc(it.id || '');
        const options = targets
          .filter((tg) => tg.id !== 'ignore')
          .map(
            (tg) =>
              `<option value="${esc(tg.id)}">${esc(tg.label)}</option>`
          )
          .join('');
        const ignore = targets.find((tg) => tg.id === 'ignore');
        const ignoreBtn = ignore
          ? `<button type="button" class="btn small ghost" data-classify-target="ignore" data-classify-id="${id}" data-classify-line="${line}">${esc(ignore.label)}</button>`
          : '';
        return `<li class="toClassifyCardCompact"><p class="smartRepairLineText">${text}</p><div class="toClassifyCardRow"><select class="toClassifyMoveSelect" data-classify-id="${id}" data-classify-line="${line}" aria-label="Choisir une section"><option value="">Choisir une section…</option>${options}</select>${ignoreBtn}</div></li>`;
      })
      .join('');
    const more =
      rest > 0
        ? `<li class="toClassifyMore">+ ${rest} autres éléments</li>`
        : '';
    return `<ul class="toClassifyCompactList">${cards}${more}</ul>`;
  }

  return items
    .map((it) => {
      const text = esc(String(it.text || '').trim().slice(0, 220));
      const line = esc(String(it.text || '').trim());
      const id = esc(it.id || '');
      const moves = targets
        .map(
          (tg) =>
            `<button type="button" class="btn small classifyBtn smartRepairBtn" data-classify-target="${esc(tg.id)}" data-classify-id="${id}" data-classify-line="${line}">${esc(tg.label)}</button>`
        )
        .join('');
      return `<li class="studioSuggest--warn studioSuggest--repair"><span class="smartRepairLineTag">${esc(lineLabel)}</span><p class="smartRepairLineText">${text}</p><div class="studioSuggestActions smartRepairActions">${moves}</div></li>`;
    })
    .join('');
}
