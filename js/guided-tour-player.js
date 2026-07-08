import { validateTour } from './guided-tour-store.js';
import { resolveMediaUrl } from './media-store.js';

const STORAGE_KEY = 'meda-guided-tour-progress-v1';

export function createGuidedTourPlayer({ project, onOpenStep, onPreloadScene }) {
  const elements = getElements();
  const state = {
    project,
    tour: null,
    current: 0,
    completed: new Set(),
  };

  bindUi(elements, state, { onOpenStep, onPreloadScene });
  renderCatalog(elements, state);

  return {
    setProject(nextProject) {
      state.project = nextProject;
      if (state.tour) {
        state.tour = nextProject.tours.find((tour) => tour.id === state.tour.id) || null;
        if (!state.tour) stopTour(elements, state);
      }
      renderCatalog(elements, state);
      renderBar(elements, state);
    },
  };
}

function getElements() {
  return {
    toggle: document.querySelector('#tours-toggle'),
    dialog: document.querySelector('#tour-catalog-dialog'),
    list: document.querySelector('#tour-catalog-list'),
    bar: document.querySelector('#guided-tour-bar'),
    title: document.querySelector('#guided-tour-title'),
    position: document.querySelector('#guided-tour-position'),
    progress: document.querySelector('#guided-tour-progress'),
    previous: document.querySelector('[data-guided-tour-action="previous"]'),
    next: document.querySelector('[data-guided-tour-action="next"]'),
  };
}

function bindUi(elements, state, callbacks) {
  elements.toggle.addEventListener('click', () => {
    renderCatalog(elements, state);
    elements.dialog.showModal();
  });
  elements.dialog.addEventListener('click', async (event) => {
    const action = event.target.closest('[data-tour-catalog-action]')?.dataset.tourCatalogAction;
    const tourId = event.target.closest('[data-tour-id]')?.dataset.tourId;
    if (action === 'close') elements.dialog.close();
    if (action === 'start' || action === 'resume') {
      elements.dialog.close();
      await startTour(elements, state, tourId, action === 'resume', callbacks);
    }
  });
  elements.bar.addEventListener('click', async (event) => {
    const action = event.target.closest('[data-guided-tour-action]')?.dataset.guidedTourAction;
    if (action === 'stop') {
      const finished = state.tour && state.completed.size >= state.tour.steps.length;
      saveProgress(state, !finished, finished);
      stopTour(elements, state);
    }
    if (action === 'previous' && state.current > 0) {
      state.current -= 1;
      await openCurrentStep(elements, state, callbacks);
    }
    if (action === 'next' && state.tour) {
      state.completed.add(state.current);
      if (state.current < state.tour.steps.length - 1) {
        state.current += 1;
        await openCurrentStep(elements, state, callbacks);
      } else {
        saveProgress(state, false, true);
        renderBar(elements, state);
      }
    }
  });
}

async function startTour(elements, state, tourId, resume, callbacks) {
  const tour = state.project.tours.find((item) => item.id === tourId);
  if (!tour || validateTour(state.project, tour).length) return;
  const saved = resume ? readProgress()[tour.id] : null;
  state.tour = tour;
  state.current = Math.min(saved?.current || 0, tour.steps.length - 1);
  state.completed = new Set(saved?.completed || []);
  elements.bar.hidden = false;
  await openCurrentStep(elements, state, callbacks);
}

async function openCurrentStep(elements, state, callbacks) {
  const step = state.tour?.steps[state.current];
  if (!step) return;
  await callbacks.onOpenStep(step, state.tour);
  if (step.completion === 'automatic') state.completed.add(state.current);
  saveProgress(state, false);
  renderBar(elements, state);
  const nextStep = state.tour.steps[state.current + 1];
  if (nextStep) callbacks.onPreloadScene(nextStep.sceneId);
}

function renderBar(elements, state) {
  if (!state.tour) {
    elements.bar.hidden = true;
    return;
  }
  const total = state.tour.steps.length;
  const completed = state.completed.size;
  const finished = completed >= total;
  elements.title.textContent = state.tour.title;
  elements.position.textContent = finished ? 'Percorso completato' : `Tappa ${state.current + 1} di ${total}`;
  elements.progress.max = total;
  elements.progress.value = completed;
  elements.previous.disabled = state.current === 0;
  elements.next.disabled = finished;
  elements.next.textContent = state.current === total - 1 ? 'Completa' : 'Successiva';
}

function renderCatalog(elements, state) {
  const progress = readProgress();
  if (!state.project.tours.length) {
    elements.list.innerHTML = '<p class="manager-status">Nessun percorso guidato disponibile.</p>';
    return;
  }
  elements.list.innerHTML = state.project.tours.map((tour) => {
    const saved = progress[tour.id];
    const issues = validateTour(state.project, tour);
    const cover = resolveMediaUrl(state.project, tour.coverMediaId);
    const percentage = saved ? Math.round((saved.completed.length / tour.steps.length) * 100) : 0;
    return `
      <article class="tour-catalog-card" data-tour-id="${escapeHtml(tour.id)}">
        ${cover ? `<img src="${escapeHtml(cover)}" alt="" loading="lazy">` : '<div class="tour-catalog-card__placeholder">Percorso</div>'}
        <div>
          <span>${escapeHtml(tour.category || 'Percorso tematico')}</span>
          <h3>${escapeHtml(tour.title)}</h3>
          <p>${escapeHtml(tour.description)}</p>
          <small>${tour.steps.length} tappe · ${tour.duration || 0} min · ${escapeHtml(tour.level || 'Per tutti')} · ${escapeHtml(tour.language)}</small>
          ${saved?.interrupted ? `<small>Progresso salvato: ${percentage}%</small>` : ''}
          ${issues.length ? '<small>Percorso temporaneamente non disponibile</small>' : ''}
        </div>
        <button type="button" class="primary-action" data-tour-catalog-action="${saved?.interrupted ? 'resume' : 'start'}"${issues.length ? ' disabled' : ''}>
          ${saved?.interrupted ? 'Riprendi' : 'Inizia percorso'}
        </button>
      </article>
    `;
  }).join('');
}

function stopTour(elements, state) {
  state.tour = null;
  state.current = 0;
  state.completed.clear();
  elements.bar.hidden = true;
}

function saveProgress(state, interrupted = false, finished = false) {
  if (!state.tour) return;
  const progress = readProgress();
  progress[state.tour.id] = {
    current: state.current,
    completed: [...state.completed],
    interrupted,
    finished,
    updatedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Il percorso continua anche quando il browser blocca l'archiviazione locale.
  }
}

function readProgress() {
  try {
    const progress = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return progress && typeof progress === 'object' && !Array.isArray(progress) ? progress : {};
  } catch {
    return {};
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}
