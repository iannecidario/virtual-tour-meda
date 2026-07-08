import {
  buildExplorationIndex,
  getExplorationStats,
  searchExplorationIndex,
} from './exploration-index.js';

export function createExplorationCenter({ project, admin = false, onOpenEntry, onOpenScene, onMatchesChange }) {
  const elements = getElements();
  const state = {
    project,
    index: buildExplorationIndex(project),
    filters: emptyFilters(),
  };

  if (elements.adminStats) elements.adminStats.hidden = !admin;
  bindUi(elements, state, { onOpenEntry, onOpenScene, onMatchesChange });
  renderAll(elements, state, onMatchesChange);

  return {
    setProject(nextProject) {
      state.project = nextProject;
      state.index = buildExplorationIndex(nextProject);
      renderAll(elements, state, onMatchesChange);
    },
    close() {
      if (elements.panel.getAttribute('aria-hidden') === 'false') {
        closePanel(elements, onMatchesChange);
      }
    },
  };
}

function getElements() {
  return {
    toggle: document.querySelector('#explore-toggle'),
    panel: document.querySelector('#exploration-panel'),
    search: document.querySelector('#exploration-search'),
    form: document.querySelector('#exploration-filters'),
    category: document.querySelector('#exploration-category'),
    kind: document.querySelector('#exploration-kind'),
    scene: document.querySelector('#exploration-scene'),
    categories: document.querySelector('#exploration-categories'),
    scenes: document.querySelector('#exploration-scenes'),
    results: document.querySelector('#exploration-results'),
    count: document.querySelector('#exploration-result-count'),
    adminStats: document.querySelector('#exploration-admin-stats'),
  };
}

function bindUi(elements, state, callbacks) {
  elements.toggle.addEventListener('click', () => {
    const open = elements.panel.getAttribute('aria-hidden') === 'false';
    if (open) {
      closePanel(elements, callbacks.onMatchesChange);
    } else {
      elements.panel.setAttribute('aria-hidden', 'false');
      elements.panel.inert = false;
      elements.toggle.setAttribute('aria-expanded', 'true');
      document.body.classList.add('is-exploration-open');
      elements.search.focus();
    }
  });

  elements.panel.addEventListener('click', async (event) => {
    if (event.target.closest('[data-exploration-action="close"]')) {
      closePanel(elements, callbacks.onMatchesChange);
      return;
    }
    if (event.target.closest('[data-exploration-action="reset"]')) {
      state.filters = emptyFilters();
      elements.form.reset();
      renderAll(elements, state, callbacks.onMatchesChange);
      elements.search.focus();
      return;
    }
    const category = event.target.closest('[data-exploration-category]')?.dataset.explorationCategory;
    if (category) {
      state.filters.category = category;
      elements.category.value = category;
      renderResults(elements, state, callbacks.onMatchesChange);
      return;
    }
    const sceneId = event.target.closest('[data-exploration-scene]')?.dataset.explorationScene;
    if (sceneId) {
      await callbacks.onOpenScene(sceneId);
      closePanel(elements, callbacks.onMatchesChange);
      return;
    }
    const resultId = event.target.closest('[data-exploration-result]')?.dataset.explorationResult;
    if (resultId) {
      const entry = state.index.find((item) => item.id === resultId);
      if (entry) {
        await callbacks.onOpenEntry(entry);
        closePanel(elements, callbacks.onMatchesChange);
      }
    }
  });

  elements.form.addEventListener('input', () => {
    state.filters = {
      query: elements.search.value,
      category: elements.category.value,
      kind: elements.kind.value,
      sceneId: elements.scene.value,
      audio: elements.form.elements.audio.checked,
      video: elements.form.elements.video.checked,
      image: elements.form.elements.image.checked,
      document: elements.form.elements.document.checked,
    };
    renderResults(elements, state, callbacks.onMatchesChange);
  });

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && elements.panel.getAttribute('aria-hidden') === 'false') {
      closePanel(elements, callbacks.onMatchesChange);
    }
  });
}

function renderAll(elements, state, onMatchesChange) {
  const categories = [...new Set(state.index
    .filter((entry) => entry.kind === 'hotspot' || entry.kind === 'link')
    .map((entry) => entry.category)
    .filter(Boolean))].sort((a, b) => a.localeCompare(b, 'it'));

  fillSelect(elements.category, categories, 'Tutte le categorie', state.filters.category);
  fillSelect(elements.scene, state.project.scenes.map((scene) => ({ value: scene.id, label: scene.title })), 'Tutte le scene', state.filters.sceneId);
  elements.categories.innerHTML = categories.length
    ? categories.map((category) => `<button type="button" data-exploration-category="${escapeHtml(category)}">${escapeHtml(category)}</button>`).join('')
    : '<p>Nessuna categoria disponibile.</p>';
  elements.scenes.innerHTML = state.project.scenes
    .map((scene) => `<button type="button" data-exploration-scene="${escapeHtml(scene.id)}">${escapeHtml(scene.title)}</button>`)
    .join('');

  const stats = getExplorationStats(state.project, state.index);
  if (elements.adminStats) {
    elements.adminStats.innerHTML = Object.entries(stats)
      .map(([key, value]) => `<div><strong>${value}</strong><span>${statLabel(key)}</span></div>`)
      .join('');
  }
  renderResults(elements, state, onMatchesChange);
}

function renderResults(elements, state, onMatchesChange) {
  const results = searchExplorationIndex(state.index, state.filters);
  elements.count.textContent = `${results.length} risultati`;
  elements.results.innerHTML = results.length
    ? results.slice(0, 100).map(resultMarkup).join('')
    : '<p class="exploration-empty">Nessun contenuto corrisponde alla ricerca.</p>';

  const searchActive = hasActiveFilters(state.filters);
  const matches = new Set(results
    .filter((entry) => entry.hotspotId)
    .map((entry) => `${entry.sceneId}:${entry.hotspotId}`));
  onMatchesChange(matches, searchActive);
}

function resultMarkup(entry) {
  const icon = entry.kind === 'scene' ? 'Sala' : entry.kind === 'media' ? 'Media' : entry.kind === 'link' ? 'Vai' : 'Info';
  const description = entry.description
    ? `<p>${escapeHtml(shorten(entry.description, 125))}</p>`
    : '';
  const thumbnail = entry.thumbnail
    ? `<img src="${escapeHtml(entry.thumbnail)}" alt="" loading="lazy">`
    : `<span class="exploration-result__icon" aria-hidden="true">${icon}</span>`;
  return `
    <button class="exploration-result" type="button" data-exploration-result="${escapeHtml(entry.id)}">
      <span class="exploration-result__media">${thumbnail}</span>
      <span class="exploration-result__body">
        <strong>${escapeHtml(entry.title)}</strong>
        <small>${escapeHtml(entry.category)} · ${escapeHtml(entry.sceneTitle)}</small>
        ${description}
      </span>
    </button>
  `;
}

function fillSelect(select, items, placeholder, selected = '') {
  select.innerHTML = `<option value="">${escapeHtml(placeholder)}</option>` + items.map((item) => {
    const value = typeof item === 'string' ? item : item.value;
    const label = typeof item === 'string' ? item : item.label;
    return `<option value="${escapeHtml(value)}"${value === selected ? ' selected' : ''}>${escapeHtml(label)}</option>`;
  }).join('');
}

function closePanel(elements, onMatchesChange, clearMatches = true) {
  elements.panel.setAttribute('aria-hidden', 'true');
  elements.panel.inert = true;
  elements.toggle.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('is-exploration-open');
  if (clearMatches) onMatchesChange(new Set(), false);
  elements.toggle.focus();
}

function emptyFilters() {
  return { query: '', category: '', kind: '', sceneId: '', audio: false, video: false, image: false, document: false };
}

function hasActiveFilters(filters) {
  return Boolean(filters.query || filters.category || filters.kind || filters.sceneId
    || filters.audio || filters.video || filters.image || filters.document);
}

function shorten(value, limit) {
  const text = String(value).replace(/\s+/g, ' ').trim();
  return text.length > limit ? `${text.slice(0, limit - 1)}...` : text;
}

function statLabel(key) {
  return ({ scenes: 'Scene', hotspots: 'Hotspot', images: 'Immagini', audio: 'Audio', videos: 'Video', categories: 'Categorie' })[key];
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}
