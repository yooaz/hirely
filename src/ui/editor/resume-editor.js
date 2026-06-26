/**
 * Hirely resume editor — mutates resumeData (single source of truth).
 */

import {
  normalizeResumeData,
  moveUnsortedToSection,
  addExperience,
  addEducation,
  addSkill,
  addClient,
  addTool,
  addLanguage,
  addProject,
  addPublication,
  addExhibition,
  addAward,
  addPortfolioLink,
} from '../../core/resume-data.js';

const SECTION_LABELS = {
  identity: 'Identité',
  contact: 'Contact',
  summary: 'Résumé',
  experience: 'Expérience',
  education: 'Formation',
  client: 'Clients',
  project: 'Projets',
  publication: 'Publications',
  exhibition: 'Expositions',
  award: 'Prix',
  portfolio: 'Portfolio',
  skill: 'Compétences',
  tool: 'Outils',
  language: 'Langues',
  ignore: 'Ignorer',
};

const MOVE_TARGETS = [
  'summary',
  'experience',
  'education',
  'client',
  'project',
  'skill',
  'tool',
  'language',
  'ignore',
];

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
}

function listRow(field, items, delKind, sectionId, reorderKind) {
  return (
    items
      .map((val, i) => {
        const order =
          reorderKind && items.length > 1
            ? `<div class="studioBlockOrder"><button type="button" class="btn small ghost" data-studio-reorder="${reorderKind}" data-studio-index="${i}" data-studio-dir="up" data-studio-section="${sectionId}" ${i === 0 ? 'disabled' : ''}>↑</button><button type="button" class="btn small ghost" data-studio-reorder="${reorderKind}" data-studio-index="${i}" data-studio-dir="down" data-studio-section="${sectionId}" ${i >= items.length - 1 ? 'disabled' : ''}>↓</button></div>`
            : '';
        return `${order}<div class="rdRow rdRow--inline"><input data-rd-field="${field}" data-rd-index="${i}" value="${esc(val)}" /><button type="button" class="btn small ghost" data-rd-del data-rd-del-kind="${delKind}" data-rd-del="${i}">×</button></div>`;
      })
      .join('') || '<p class="rdEmpty">—</p>'
  );
}

function sectionToolbar(title, sectionId, addKind, addLabel) {
  return `<div class="rdSectionHead"><h4>${title}</h4><div><button type="button" class="btn small" data-rd-add="${addKind}">${addLabel}</button> <button type="button" class="btn small ghost" data-studio-clear-section="${sectionId}">Vider</button></div></div>`;
}

/**
 * @param {HTMLElement} root
 * @param {object} hooks
 */
export function mountResumeEditor(root, hooks) {
  if (!root || root._hirelyEditorMounted) return;
  root._hirelyEditorMounted = true;

  root.addEventListener('input', (e) => {
    const el = e.target.closest('[data-rd-field]');
    if (!el) return;
    const data = normalizeResumeData(hooks.getResumeData());
    const field = el.dataset.rdField;
    const idx = el.dataset.rdIndex != null ? +el.dataset.rdIndex : -1;
    const val = el.value;
    if (field.startsWith('identity.')) {
      data.identity[field.split('.')[1]] = val;
    } else if (field === 'summary') {
      data.summary = val;
    } else if (field === 'experience.role' && idx >= 0) data.experiences[idx].role = val;
    else if (field === 'experience.company' && idx >= 0) data.experiences[idx].company = val;
    else if (field === 'experience.dates' && idx >= 0) data.experiences[idx].dates = val;
    else if (field === 'experience.bullets' && idx >= 0) {
      const bi = el.dataset.rdBullet != null ? +el.dataset.rdBullet : -1;
      if (bi >= 0) {
        if (!data.experiences[idx].bullets) data.experiences[idx].bullets = [];
        data.experiences[idx].bullets[bi] = val;
      }
    } else if (field === 'education' && idx >= 0) data.education[idx] = val;
    else if (field === 'skill' && idx >= 0) data.skills[idx] = val;
    else if (field === 'tool' && idx >= 0) data.tools[idx] = val;
    else if (field === 'language' && idx >= 0) data.languages[idx] = val;
    else if (field === 'client' && idx >= 0) data.clients[idx] = val;
    else if (field === 'project' && idx >= 0) data.projects[idx] = val;
    else if (field === 'publication' && idx >= 0) data.publications[idx] = val;
    else if (field === 'exhibition' && idx >= 0) data.exhibitions[idx] = val;
    else if (field === 'award' && idx >= 0) data.awards[idx] = val;
    else if (field === 'portfolio' && idx >= 0) data.portfolioLinks[idx] = val;
    else if (field === 'identity.linkedin') data.identity.linkedin = val;
    else if (field === 'identity.website') data.identity.website = val;
    else if (field === 'experience.bullets' && idx >= 0) {
      const bi = el.dataset.rdBullet != null ? +el.dataset.rdBullet : -1;
      if (bi >= 0) {
        if (!data.experiences[idx].bullets) data.experiences[idx].bullets = [];
        data.experiences[idx].bullets[bi] = val;
      }
    }
    hooks.setResumeData(data);
    hooks.onChange();
  });

  root.addEventListener('click', (e) => {
    const addBtn = e.target.closest('[data-rd-add]');
    if (addBtn) {
      let data = normalizeResumeData(hooks.getResumeData());
      const kind = addBtn.dataset.rdAdd;
      if (kind === 'experience') data = addExperience(data);
      else if (kind === 'education') data = addEducation(data);
      else if (kind === 'skill') data = addSkill(data);
      else if (kind === 'client') data = addClient(data);
      else if (kind === 'tool') data = addTool(data);
      else if (kind === 'language') data = addLanguage(data);
      else if (kind === 'project') data = addProject(data);
      else if (kind === 'publication') data = addPublication(data);
      else if (kind === 'exhibition') data = addExhibition(data);
      else if (kind === 'award') data = addAward(data);
      else if (kind === 'portfolio') data = addPortfolioLink(data);
      hooks.setResumeData(data);
      if (hooks.rerender) hooks.rerender();
      else renderResumeEditor(root, hooks.getResumeData());
      hooks.onChange();
      return;
    }

    const moveBtn = e.target.closest('[data-rd-move]');
    if (moveBtn) {
      const target = moveBtn.dataset.rdMove;
      const line = moveBtn.dataset.rdLine || '';
      const data = moveUnsortedToSection(hooks.getResumeData(), [line], target);
      hooks.setResumeData(data);
      if (hooks.rerender) hooks.rerender();
      else renderResumeEditor(root, hooks.getResumeData());
      hooks.onChange();
      return;
    }

    const delBtn = e.target.closest('[data-rd-del]');
    if (delBtn) {
      const data = normalizeResumeData(hooks.getResumeData());
      const idx = +delBtn.dataset.rdDel;
      const kind = delBtn.dataset.rdDelKind;
      if (kind === 'experience' && idx >= 0) data.experiences.splice(idx, 1);
      if (kind === 'education' && idx >= 0) data.education.splice(idx, 1);
      if (kind === 'skill' && idx >= 0) data.skills.splice(idx, 1);
      if (kind === 'tool' && idx >= 0) data.tools.splice(idx, 1);
      if (kind === 'language' && idx >= 0) data.languages.splice(idx, 1);
      if (kind === 'client' && idx >= 0) data.clients.splice(idx, 1);
      if (kind === 'project' && idx >= 0) data.projects.splice(idx, 1);
      if (kind === 'publication' && idx >= 0) data.publications.splice(idx, 1);
      if (kind === 'exhibition' && idx >= 0) data.exhibitions.splice(idx, 1);
      if (kind === 'award' && idx >= 0) data.awards.splice(idx, 1);
      if (kind === 'portfolio' && idx >= 0) data.portfolioLinks.splice(idx, 1);
      if (kind === 'bullet' && idx >= 0) {
        const bi = +delBtn.dataset.rdBullet;
        if (data.experiences[idx]?.bullets) data.experiences[idx].bullets.splice(bi, 1);
      }
      hooks.setResumeData(data);
      if (hooks.rerender) hooks.rerender();
      else renderResumeEditor(root, hooks.getResumeData());
      hooks.onChange();
    }
  });
}

/**
 * @param {HTMLElement} root
 * @param {object} data resumeData
 * @param {string} [sectionId] studio mode — one section only
 */
export function renderResumeEditorSection(root, data, sectionId) {
  if (!root) return;
  const rd = normalizeResumeData(data);
  const id = sectionId || 'identity';

  const expBlock = (ex, i) => {
    const bullets = (ex.bullets || [])
      .map(
        (b, bi) =>
          `<div class="rdRow rdRow--inline"><input data-rd-field="experience.bullets" data-rd-index="${i}" data-rd-bullet="${bi}" value="${esc(b)}" placeholder="Réalisation" /><button type="button" class="btn small ghost" data-rd-del data-rd-del-kind="bullet" data-rd-del="${i}" data-rd-bullet="${bi}">×</button></div>`
      )
      .join('');
    const order =
      rd.experiences.length > 1
        ? `<div class="studioBlockOrder"><button type="button" class="btn small ghost" data-studio-reorder="experience" data-studio-index="${i}" data-studio-dir="up" data-studio-section="experience" ${i === 0 ? 'disabled' : ''}>↑</button><button type="button" class="btn small ghost" data-studio-reorder="experience" data-studio-index="${i}" data-studio-dir="down" data-studio-section="experience" ${i >= rd.experiences.length - 1 ? 'disabled' : ''}>↓</button></div>`
        : '';
    return `
    <div class="rdBlock">
      ${order}
      <div class="rdRow"><label>Poste</label><input data-rd-field="experience.role" data-rd-index="${i}" value="${esc(ex.role)}" /></div>
      <div class="rdRow"><label>Entreprise</label><input data-rd-field="experience.company" data-rd-index="${i}" value="${esc(ex.company)}" /></div>
      <div class="rdRow"><label>Dates</label><input data-rd-field="experience.dates" data-rd-index="${i}" value="${esc(ex.dates)}" /></div>
      ${bullets}
      <button type="button" class="btn small ghost" data-rd-del data-rd-del-kind="experience" data-rd-del="${i}">Supprimer</button>
    </div>`;
  };

  let body = '';
  if (id === 'identity') {
    body = `
      <div class="rdRow"><label>Nom</label><input data-rd-field="identity.name" value="${esc(rd.identity.name)}" placeholder="Prénom Nom" /></div>
      <div class="rdRow"><label>Poste</label><input data-rd-field="identity.title" value="${esc(rd.identity.title)}" placeholder="Intitulé du poste" /></div>`;
  } else if (id === 'contact') {
    body = `
      <div class="rdRow"><label>Email</label><input data-rd-field="identity.email" value="${esc(rd.identity.email)}" placeholder="email@exemple.com" /></div>
      <div class="rdRow"><label>Téléphone</label><input data-rd-field="identity.phone" value="${esc(rd.identity.phone)}" placeholder="+33 6 00 00 00 00" /></div>
      <div class="rdRow"><label>Lieu</label><input data-rd-field="identity.location" value="${esc(rd.identity.location)}" placeholder="Paris, France" /></div>
      <div class="rdRow"><label>LinkedIn</label><input data-rd-field="identity.linkedin" value="${esc(rd.identity.linkedin)}" placeholder="linkedin.com/in/…" /></div>
      <div class="rdRow"><label>Site web</label><input data-rd-field="identity.website" value="${esc(rd.identity.website)}" placeholder="https://…" /></div>
      <button type="button" class="btn small ghost" data-studio-clear-section="contact">Effacer le contact</button>`;
  } else if (id === 'summary') {
    body = `<textarea rows="5" data-rd-field="summary" placeholder="Résumé professionnel">${esc(rd.summary)}</textarea>`;
  } else if (id === 'experience') {
    body = `${sectionToolbar('Expérience', 'experience', 'experience', '+ Ajouter')}${rd.experiences.map(expBlock).join('') || '<p class="rdEmpty">Aucune expérience.</p>'}`;
  } else if (id === 'education') {
    body = `${sectionToolbar('Formation', 'education', 'education', '+ Ajouter')}${listRow('education', rd.education, 'education', 'education', 'education')}`;
  } else if (id === 'client') {
    body = `${sectionToolbar('Clients', 'client', 'client', '+ Ajouter')}${listRow('client', rd.clients, 'client', 'client', 'client')}`;
  } else if (id === 'project') {
    body = `${sectionToolbar('Projets', 'project', 'project', '+ Ajouter')}${listRow('project', rd.projects, 'project', 'project', 'project')}`;
  } else if (id === 'skill') {
    body = `${sectionToolbar('Compétences', 'skill', 'skill', '+ Compétence')}${listRow('skill', rd.skills, 'skill', 'skill', 'skill')}
      <div class="rdSubSection"><div class="rdSectionHead rdSectionHead--sub"><h5>Outils</h5><div><button type="button" class="btn small" data-rd-add="tool">+ Outil</button> <button type="button" class="btn small ghost" data-studio-clear-section="tool">Vider</button></div></div>${listRow('tool', rd.tools, 'tool', 'tool', 'tool')}</div>`;
  } else if (id === 'tool') {
    body = `${sectionToolbar('Outils', 'tool', 'tool', '+ Ajouter')}${listRow('tool', rd.tools, 'tool', 'tool', 'tool')}`;
  } else if (id === 'publication') {
    body = `${sectionToolbar('Publications', 'publication', 'publication', '+ Ajouter')}${listRow('publication', rd.publications, 'publication', 'publication', 'publication')}`;
  } else if (id === 'exhibition') {
    body = `${sectionToolbar('Expositions', 'exhibition', 'exhibition', '+ Ajouter')}${listRow('exhibition', rd.exhibitions, 'exhibition', 'exhibition', 'exhibition')}`;
  } else if (id === 'award') {
    body = `${sectionToolbar('Prix', 'award', 'award', '+ Ajouter')}${listRow('award', rd.awards, 'award', 'award', 'award')}`;
  } else if (id === 'portfolio') {
    body = `${sectionToolbar('Portfolio', 'portfolio', 'portfolio', '+ Ajouter')}${listRow('portfolio', rd.portfolioLinks, 'portfolio', 'portfolio', 'portfolio')}`;
  } else if (id === 'language') {
    body = `${sectionToolbar('Langues', 'language', 'language', '+ Ajouter')}${listRow('language', rd.languages, 'language', 'language', 'language')}`;
  }

  const label = SECTION_LABELS[id] || id;
  root.innerHTML = `<div class="rdEditor rdEditor--section"><section class="rdSection rdSection--studio"><h4>${esc(label)}</h4>${body}</section></div>`;
}

/**
 * @param {HTMLElement} root
 * @param {object} data resumeData
 */
export function renderResumeEditor(root, data) {
  if (!root) return;
  const rd = normalizeResumeData(data);

  const unsortedHtml =
    rd.unsorted.length === 0
      ? '<p class="rdEmpty">Aucune ligne à placer.</p>'
      : rd.unsorted
          .slice(0, 48)
          .map((line) => {
            const moves = MOVE_TARGETS.map(
              (t) =>
                `<button type="button" class="btn small ghost" data-rd-move="${t}" data-rd-line="${esc(line)}">${SECTION_LABELS[t] || t}</button>`
            ).join('');
            return `<li class="rdUnsortedItem"><p>${esc(line.slice(0, 280))}</p><div class="rdUnsortedActions">${moves}</div></li>`;
          })
          .join('');

  const expHtml = rd.experiences
    .map((ex, i) => {
      const bullets = (ex.bullets || [])
        .map(
          (b, bi) =>
            `<div class="rdRow rdRow--inline"><input data-rd-field="experience.bullets" data-rd-index="${i}" data-rd-bullet="${bi}" value="${esc(b)}" placeholder="Réalisation" /><button type="button" class="btn small ghost" data-rd-del data-rd-del-kind="bullet" data-rd-del="${i}" data-rd-bullet="${bi}">×</button></div>`
        )
        .join('');
      return `
    <div class="rdBlock">
      <div class="rdRow"><label>Poste</label><input data-rd-field="experience.role" data-rd-index="${i}" value="${esc(ex.role)}" placeholder="Ex. Graphic Designer" /></div>
      <div class="rdRow"><label>Entreprise</label><input data-rd-field="experience.company" data-rd-index="${i}" value="${esc(ex.company)}" placeholder="Ex. McCann" /></div>
      <div class="rdRow"><label>Dates</label><input data-rd-field="experience.dates" data-rd-index="${i}" value="${esc(ex.dates)}" placeholder="2011 – 2022" /></div>
      ${bullets ? `<div class="rdBullets">${bullets}</div>` : ''}
      <button type="button" class="btn small ghost" data-rd-del data-rd-del-kind="experience" data-rd-del="${i}">Supprimer</button>
    </div>`;
    })
    .join('');

  root.innerHTML = `
    <div class="rdEditor">
      <header class="rdHead"><h3>Éditer le CV</h3><p class="rdLead">Corrigez chaque section. Les lignes non placées restent dans Suggestions.</p></header>
      <section class="rdSection">
        <h4>Identité</h4>
        <div class="rdRow"><label>Nom</label><input data-rd-field="identity.name" value="${esc(rd.identity.name)}" placeholder="Information non détectée" /></div>
        <div class="rdRow"><label>Poste</label><input data-rd-field="identity.title" value="${esc(rd.identity.title)}" placeholder="Information non détectée" /></div>
        <div class="rdRow"><label>Email</label><input data-rd-field="identity.email" value="${esc(rd.identity.email)}" placeholder="email@exemple.com" /></div>
        <div class="rdRow"><label>Téléphone</label><input data-rd-field="identity.phone" value="${esc(rd.identity.phone)}" placeholder="+33 6 00 00 00 00" /></div>
        <div class="rdRow"><label>Lieu</label><input data-rd-field="identity.location" value="${esc(rd.identity.location)}" /></div>
      </section>
      <section class="rdSection">
        <h4>Résumé</h4>
        <textarea rows="3" data-rd-field="summary" placeholder="Résumé professionnel">${esc(rd.summary)}</textarea>
      </section>
      <section class="rdSection">
        <div class="rdSectionHead"><h4>Expérience</h4><button type="button" class="btn small" data-rd-add="experience">+ Ajouter une expérience</button></div>
        ${expHtml || '<p class="rdEmpty">Aucune expérience structurée.</p>'}
      </section>
      <section class="rdSection">
        <div class="rdSectionHead"><h4>Formation</h4><button type="button" class="btn small" data-rd-add="education">+ Ajouter une formation</button></div>
        ${listRow('education', rd.education, 'education')}
      </section>
      <section class="rdSection">
        <div class="rdSectionHead"><h4>Clients</h4><button type="button" class="btn small" data-rd-add="client">+ Ajouter</button></div>
        ${listRow('client', rd.clients, 'client')}
      </section>
      <section class="rdSection">
        <div class="rdSectionHead"><h4>Projets</h4><button type="button" class="btn small" data-rd-add="project">+ Ajouter un projet</button></div>
        ${listRow('project', rd.projects, 'project')}
      </section>
      <section class="rdSection">
        <div class="rdSectionHead"><h4>Compétences</h4><button type="button" class="btn small" data-rd-add="skill">+ Ajouter une compétence</button></div>
        ${listRow('skill', rd.skills, 'skill')}
      </section>
      <section class="rdSection">
        <div class="rdSectionHead"><h4>Outils</h4><button type="button" class="btn small" data-rd-add="tool">+ Ajouter un outil</button></div>
        ${listRow('tool', rd.tools, 'tool')}
      </section>
      <section class="rdSection">
        <div class="rdSectionHead"><h4>Langues</h4><button type="button" class="btn small" data-rd-add="language">+ Ajouter</button></div>
        ${listRow('language', rd.languages, 'language')}
      </section>
      <section class="rdSection rdSection--unsorted">
        <h4>À placer</h4>
        <p class="rdHint">Déplacez chaque ligne vers la bonne section.</p>
        <ul class="rdUnsorted">${unsortedHtml}</ul>
      </section>
    </div>`;
}
