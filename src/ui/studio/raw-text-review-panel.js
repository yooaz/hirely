/**
 * Raw text review panel — « Texte à vérifier » (keep / delete / move).
 */

export const RAW_TEXT_VERIFY_TARGETS = [
  { id: 'experience', label: 'Expérience' },
  { id: 'education', label: 'Formation' },
  { id: 'skill', label: 'Compétences' },
  { id: 'tool', label: 'Outils' },
  { id: 'language', label: 'Langues' },
  { id: 'client', label: 'Clients' },
  { id: 'summary', label: 'Profil' },
];

/**
 * @param {object} opts
 * @param {(s: string) => string} opts.esc
 * @param {object[]} opts.items
 * @param {number} [opts.ocrConfidence]
 * @param {number} [opts.maxVisible]
 */
export function renderRawTextReviewPanelHtml(opts = {}) {
  const esc = opts.esc || ((s) => String(s));
  const items = opts.items || [];
  const maxVisible = opts.maxVisible ?? 24;
  const conf = Number(opts.ocrConfidence);
  const partialWarn = String(opts.partialReadWarning || '').trim();
  const confLine =
    partialWarn
      ? `<p class="rawTextReviewConf rawTextReviewConf--low">${esc(partialWarn)}</p>`
      : Number.isFinite(conf) && conf < 60
        ? `<p class="rawTextReviewConf rawTextReviewConf--low">OCR · ${esc(String(Math.round(conf)))}% confiance</p>`
        : '';

  if (!items.length) {
    return `<div class="rawTextReviewEmpty"><p>Tout le texte suspect a été traité.</p></div>`;
  }

  const visible = items.slice(0, maxVisible);
  const rest = Math.max(0, items.length - visible.length);
  const options = RAW_TEXT_VERIFY_TARGETS.map(
    (tg) => `<option value="${esc(tg.id)}">${esc(tg.label)}</option>`
  ).join('');

  const cards = visible
    .map((it) => {
      const text = esc(String(it.text || '').trim());
      const id = esc(it.id || '');
      const line = esc(String(it.text || '').trim());
      return `<li class="rawTextReviewCard" data-verify-id="${id}">
  <p class="rawTextReviewLine">${text}</p>
  <div class="rawTextReviewActions">
    <button type="button" class="btn small" data-verify-action="keep" data-verify-id="${id}" data-verify-line="${line}">Conserver</button>
    <button type="button" class="btn small ghost" data-verify-action="delete" data-verify-id="${id}" data-verify-line="${line}">Supprimer</button>
    <select class="rawTextReviewMoveSelect" data-verify-id="${id}" data-verify-line="${line}" aria-label="Déplacer vers une section">
      <option value="">Déplacer vers…</option>
      ${options}
    </select>
  </div>
</li>`;
    })
    .join('');

  const more =
    rest > 0 ? `<li class="rawTextReviewMore">+ ${rest} autres lignes</li>` : '';

  return `${confLine}<ul class="rawTextReviewList" id="rawTextReviewList">${cards}${more}</ul>`;
}
