/**
 * Block canvas — draggable, editable CV blocks (Resume Studio).
 */

import {
  BLOCK_TYPES,
  CREATIVE_BLOCK_TYPES,
  blockTypeLabel,
  createEmptyBlock,
  ensureResumeBlocks,
  addBlock,
  deleteBlock,
  duplicateBlock,
  moveBlockToIndex,
  updateBlock,
} from '../../core/resume-blocks.js';

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
}

function blockCardHtml(b, index) {
  const type = b.type;
  const label = blockTypeLabel(type);
  let fields = '';

  if (type === 'summary') {
    fields = `<textarea class="blkInput blkInput--area" data-blk-field="text" rows="3" placeholder="Résumé…">${esc(b.text)}</textarea>`;
  } else if (type === 'experience') {
    const bullets = (b.bullets || [])
      .map(
        (line, bi) =>
          `<div class="blkRow blkRow--inline"><input class="blkInput" data-blk-field="bullet" data-blk-bullet="${bi}" value="${esc(line)}" placeholder="Réalisation" /><button type="button" class="btn small ghost" data-blk-bullet-del data-blk-bullet="${bi}">×</button></div>`
      )
      .join('');
    fields = `
      <div class="blkRow"><label>Poste</label><input class="blkInput" data-blk-field="role" value="${esc(b.role)}" /></div>
      <div class="blkRow"><label>Entreprise</label><input class="blkInput" data-blk-field="company" value="${esc(b.company)}" /></div>
      <div class="blkRow"><label>Dates</label><input class="blkInput" data-blk-field="dates" value="${esc(b.dates)}" placeholder="2020 – 2024" /></div>
      <div class="blkBullets">${bullets}</div>
      <button type="button" class="btn small ghost" data-blk-add-bullet>+ Point</button>`;
  } else {
    fields = `<input class="blkInput" data-blk-field="text" value="${esc(b.text)}" placeholder="${esc(label)}…" />`;
  }

  return `
    <li class="blkCard" data-blk-id="${esc(b.id)}" data-blk-index="${index}" draggable="true">
      <div class="blkCardHead">
        <span class="blkDrag" title="Glisser pour réordonner" aria-hidden="true">⋮⋮</span>
        <span class="blkType">${esc(label)}</span>
        <div class="blkCardActions">
          <button type="button" class="btn small ghost" data-blk-dup title="Dupliquer">⧉</button>
          <button type="button" class="btn small ghost" data-blk-del title="Supprimer">×</button>
        </div>
      </div>
      <div class="blkCardBody">${fields}</div>
    </li>`;
}

function identityHtml(rd) {
  const id = rd.identity || {};
  return `
    <div class="blkIdentity">
      <h3>En-tête</h3>
      <div class="blkRow"><label>Nom</label><input class="blkInput" data-id-field="name" value="${esc(id.name)}" /></div>
      <div class="blkRow"><label>Poste</label><input class="blkInput" data-id-field="title" value="${esc(id.title)}" /></div>
      <div class="blkRow"><label>Email</label><input class="blkInput" data-id-field="email" value="${esc(id.email)}" /></div>
      <div class="blkRow"><label>Tél.</label><input class="blkInput" data-id-field="phone" value="${esc(id.phone)}" /></div>
      <div class="blkRow"><label>Lieu</label><input class="blkInput" data-id-field="location" value="${esc(id.location)}" /></div>
    </div>`;
}

function addBarHtml(types) {
  const list = types?.length ? types : BLOCK_TYPES;
  const btns = list
    .map(
      (t) =>
        `<button type="button" class="btn small ghost blkAddBtn" data-blk-add-type="${t}">+ ${esc(blockTypeLabel(t))}</button>`
    )
    .join('');
  return `<div class="blkAddBar">${btns}</div>`;
}

/**
 * @param {HTMLElement} root
 * @param {object} data resumeData
 * @param {{ blockTypes?: string[], creativeMode?: object }} [opts]
 */
export function renderBlockCanvas(root, data, opts = {}) {
  if (!root) return;
  const rd = ensureResumeBlocks(data);
  const blocks = rd.blocks || [];
  const blockTypes =
    opts.blockTypes ||
    (opts.creativeMode?.active || rd.meta?.creativeMode?.active ? CREATIVE_BLOCK_TYPES : BLOCK_TYPES);
  const list =
    blocks.length === 0
      ? '<li class="blkEmpty">Aucun bloc — ajoutez-en un ci-dessus.</li>'
      : blocks.map((b, i) => blockCardHtml(b, i)).join('');

  const creative = opts.creativeMode || rd.meta?.creativeMode;
  const badge =
    creative?.active
      ? `<span class="blkCreativeBadge" title="${esc((creative.targetRolesDetected || []).join(', '))}">Mode créatif</span>`
      : '';

  root.innerHTML = `
    <div class="blkCanvas">
      <header class="blkCanvasHead">
        <h3>Blocs ${badge}</h3>
        <p class="blkCanvasLead">${creative?.active ? 'Clients, projets, expositions, prix — pas tout dans Expérience.' : 'Modifiez l’en-tête et les blocs — l’aperçu à gauche se met à jour en direct.'}</p>
      </header>
      ${addBarHtml(blockTypes)}
      ${identityHtml(rd)}
      <ul class="blkList" id="blkList">${list}</ul>
    </div>`;
}

/**
 * @param {HTMLElement} root
 * @param {object} hooks {{ getResumeData, setResumeData, onChange }}
 */
export function mountBlockCanvas(root, hooks) {
  if (!root || root._blkCanvasMounted) return;
  root._blkCanvasMounted = true;

  const notify = (structural = false) => hooks.onChange?.({ structural });

  let dragId = null;

  root.addEventListener('dragstart', (e) => {
    const card = e.target.closest('.blkCard');
    if (!card) return;
    dragId = card.dataset.blkId;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', dragId);
    card.classList.add('blkCard--dragging');
  });

  root.addEventListener('dragend', (e) => {
    const card = e.target.closest('.blkCard');
    if (card) card.classList.remove('blkCard--dragging');
    dragId = null;
    root.querySelectorAll('.blkCard--dropTarget').forEach((el) => el.classList.remove('blkCard--dropTarget'));
  });

  root.addEventListener('dragover', (e) => {
    const card = e.target.closest('.blkCard');
    if (!card || card.dataset.blkId === dragId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    root.querySelectorAll('.blkCard--dropTarget').forEach((el) => el.classList.remove('blkCard--dropTarget'));
    card.classList.add('blkCard--dropTarget');
  });

  root.addEventListener('drop', (e) => {
    e.preventDefault();
    const target = e.target.closest('.blkCard');
    if (!target || !dragId) return;
    const toIndex = +target.dataset.blkIndex;
    let data = moveBlockToIndex(hooks.getResumeData(), dragId, toIndex);
    hooks.setResumeData(data);
    notify(true);
  });

  root.addEventListener('click', (e) => {
    const addType = e.target.closest('[data-blk-add-type]');
    if (addType) {
      hooks.setResumeData(addBlock(hooks.getResumeData(), addType.dataset.blkAddType));
      notify(true);
      return;
    }
    const dup = e.target.closest('[data-blk-dup]');
    if (dup) {
      const id = dup.closest('.blkCard')?.dataset.blkId;
      if (id) {
        hooks.setResumeData(duplicateBlock(hooks.getResumeData(), id));
        notify(true);
      }
      return;
    }
    const del = e.target.closest('[data-blk-del]');
    if (del) {
      const id = del.closest('.blkCard')?.dataset.blkId;
      if (id) {
        hooks.setResumeData(deleteBlock(hooks.getResumeData(), id));
        notify(true);
      }
      return;
    }
    const addBullet = e.target.closest('[data-blk-add-bullet]');
    if (addBullet) {
      const id = addBullet.closest('.blkCard')?.dataset.blkId;
      const rd = ensureResumeBlocks(hooks.getResumeData());
      const block = (rd.blocks || []).find((b) => b.id === id);
      if (block && block.type === 'experience') {
        const bullets = [...(block.bullets || []), ''];
        hooks.setResumeData(updateBlock(hooks.getResumeData(), id, { bullets }));
        notify(true);
      }
      return;
    }
    const delBullet = e.target.closest('[data-blk-bullet-del]');
    if (delBullet) {
      const card = delBullet.closest('.blkCard');
      const id = card?.dataset.blkId;
      const bi = +delBullet.dataset.blkBullet;
      const rd = ensureResumeBlocks(hooks.getResumeData());
      const block = (rd.blocks || []).find((b) => b.id === id);
      if (block?.bullets) {
        const bullets = block.bullets.filter((_, i) => i !== bi);
        hooks.setResumeData(updateBlock(hooks.getResumeData(), id, { bullets }));
        notify(true);
      }
    }
  });

  root.addEventListener('input', (e) => {
    const idField = e.target.closest('[data-id-field]');
    if (idField) {
      let data = ensureResumeBlocks(hooks.getResumeData());
      const field = idField.dataset.idField;
      data.identity = { ...data.identity, [field]: idField.value };
      hooks.setResumeData(data);
      notify(false);
      return;
    }

    const card = e.target.closest('.blkCard');
    if (!card) return;
    const id = card.dataset.blkId;
    const field = e.target.dataset.blkField;
    if (!id || !field) return;

    const rd = ensureResumeBlocks(hooks.getResumeData());
    const block = (rd.blocks || []).find((b) => b.id === id);
    if (!block) return;

    if (field === 'text') {
      hooks.setResumeData(updateBlock(hooks.getResumeData(), id, { text: e.target.value }));
    } else if (field === 'role' || field === 'company' || field === 'dates') {
      hooks.setResumeData(updateBlock(hooks.getResumeData(), id, { [field]: e.target.value }));
    } else if (field === 'bullet') {
      const bi = +e.target.dataset.blkBullet;
      const bullets = [...(block.bullets || [])];
      bullets[bi] = e.target.value;
      hooks.setResumeData(updateBlock(hooks.getResumeData(), id, { bullets }));
    }
    notify(false);
  });
}
