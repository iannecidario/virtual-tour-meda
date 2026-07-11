import { createHotspotViewer } from './hotspot-viewer.js';
import { createInformationPanel } from './information-panel.js';
import { createPanoramaViewer, getMarkersPlugin, setViewerScene } from './viewer.js';
import { createGuidedTourPlayer } from './guided-tour-player.js';
import { getInitialScene, getSceneById, loadProjectDocument } from './project-store.js';
import { resolveSceneMedia } from './media-store.js';
import { createMobileControlsMenu } from './mobile-controls.js?v=20260709-7';
import { createDynamicHotspotAppearance } from './hotspot-marker-config.js';

const state = {
  project: null,
  viewer: null,
  activeScene: null,
  hotspotViewer: null,
  guidedTourPlayer: null,
  history: [],
};

const elements = {
  viewer: document.querySelector('#viewer'),
  loading: document.querySelector('#loading-overlay'),
  sceneTitle: document.querySelector('#scene-title'),
  infoPanel: document.querySelector('#info-panel'),
  infoPanelTitle: document.querySelector('#info-panel-title'),
  infoPanelCategory: document.querySelector('#info-panel-category'),
  infoPanelBlocks: document.querySelector('#info-panel-blocks'),
  environmentsToggle: document.querySelector('#environments-toggle'),
  environmentsPanel: document.querySelector('#environments-panel'),
  environmentsList: document.querySelector('#environments-list'),
  message: document.querySelector('#app-message'),
};

let messageTimer = null;

function setLoading(isLoading, message = 'Caricamento panorama') {
  elements.loading?.classList.toggle('is-hidden', !isLoading);

  const label = elements.loading?.querySelector('span');
  if (label) {
    label.textContent = message;
  }
}

function showMessage(message) {
  if (!elements.message) return;
  window.clearTimeout(messageTimer);
  elements.message.textContent = message;
  elements.message.hidden = false;
  messageTimer = window.setTimeout(() => {
    elements.message.hidden = true;
  }, 5000);
}

function setActiveScene(scene) {
  state.activeScene = scene;
  document.title = `MEdA | ${scene.title}`;

  if (elements.sceneTitle) {
    elements.sceneTitle.textContent = scene.title;
  }
}

function renderEnvironments() {
  if (!elements.environmentsList) return;
  elements.environmentsList.replaceChildren(...state.project.scenes.map((scene) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.environmentSceneId = scene.id;
    button.className = scene.id === state.activeScene?.id ? 'is-active' : '';
    button.textContent = scene.title;
    return button;
  }));
}

function openEnvironmentsPanel() {
  if (!elements.environmentsPanel || !elements.environmentsToggle) return;
  elements.environmentsPanel.hidden = false;
  elements.environmentsPanel.setAttribute('aria-hidden', 'false');
  elements.environmentsToggle.setAttribute('aria-expanded', 'true');
  document.body.classList.add('is-environments-open');
}

function closeEnvironmentsPanel() {
  if (!elements.environmentsPanel || !elements.environmentsToggle) return;
  elements.environmentsPanel.setAttribute('aria-hidden', 'true');
  elements.environmentsToggle.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('is-environments-open');
  window.setTimeout(() => {
    if (elements.environmentsPanel?.getAttribute('aria-hidden') === 'true') {
      elements.environmentsPanel.hidden = true;
    }
  }, 220);
}

function toggleEnvironmentsPanel() {
  const isOpen = elements.environmentsPanel?.getAttribute('aria-hidden') === 'false';
  if (isOpen) closeEnvironmentsPanel();
  else openEnvironmentsPanel();
}

async function changeScene(sceneId, { pushHistory = true } = {}) {
  const storedScene = getSceneById(state.project, sceneId);
  const scene = storedScene ? resolveSceneMedia(state.project, storedScene) : null;
  if (!scene) {
    showMessage('La scena richiesta non e disponibile.');
    return false;
  }
  if (!scene.panorama) {
    showMessage(`Il panorama della scena "${scene.title}" non e disponibile.`);
    return false;
  }
  if (scene.id === state.activeScene?.id) return true;

  const previousScene = state.activeScene;
  if (pushHistory && state.activeScene) {
    state.history.push(state.activeScene.id);
  }

  document.body.classList.add('is-scene-transitioning');
  setLoading(true, 'Caricamento scena');
  try {
    await new Promise((resolve) => setTimeout(resolve, 140));
    await setViewerScene(state.viewer, scene);
    state.activeScene = scene;
    setActiveScene(scene);
    state.informationPanel?.close();
    state.hotspotViewer.setScene(scene, state.project);
    renderEnvironments();
    preloadLinkedScenes(scene);
    return true;
  } catch (error) {
    console.error(error);
    if (pushHistory && previousScene) state.history.pop();
    showMessage(`Impossibile caricare la scena "${scene.title}".`);
    return false;
  } finally {
    setLoading(false);
    document.body.classList.remove('is-scene-transitioning');
  }
}

async function openTargetEntry(entry) {
  if (entry.kind === 'scene') {
    await changeScene(entry.sceneId);
    return;
  }
  if (!entry.sceneId) return;
  const sceneOpened = await changeScene(entry.sceneId);
  if (!sceneOpened) return;

  if (!entry.hotspotId) return;
  const scene = getSceneById(state.project, entry.sceneId);
  const hotspot = scene?.hotspots.find((item) => item.id === entry.hotspotId);
  if (!hotspot) {
    showMessage('L’hotspot richiesto non e disponibile.');
    return;
  }

  try {
    await state.viewer.animate({
      yaw: hotspot.yaw,
      pitch: hotspot.pitch,
      speed: '3rpm',
    });
  } catch {
    state.viewer.rotate({ yaw: hotspot.yaw, pitch: hotspot.pitch });
  }
  if (entry.kind === 'link') {
    const marker = elements.viewer.querySelector(`.hotspot-marker[data-hotspot-id="${CSS.escape(hotspot.id)}"]`);
    marker?.classList.add('is-search-target');
    window.setTimeout(() => marker?.classList.remove('is-search-target'), 1800);
    return;
  }
  state.hotspotViewer.openHotspot(hotspot.id);
}

function preloadLinkedScenes(scene) {
  const targets = new Set((scene.hotspots || [])
    .filter((hotspot) => hotspot.type === 'navigation' && hotspot.targetSceneId)
    .map((hotspot) => hotspot.targetSceneId));
  targets.forEach((sceneId) => {
    const storedTarget = getSceneById(state.project, sceneId);
    const target = storedTarget ? resolveSceneMedia(state.project, storedTarget) : null;
    if (target?.panorama) {
      const image = new Image();
      image.src = target.panorama;
    }
  });
}

function preloadScene(sceneId) {
  const storedScene = getSceneById(state.project, sceneId);
  const scene = storedScene ? resolveSceneMedia(state.project, storedScene) : null;
  if (!scene?.panorama) return;
  const image = new Image();
  image.src = scene.panorama;
}

async function openGuidedTourStep(step) {
  if (step.type === 'scene') {
    await changeScene(step.sceneId);
    return;
  }
  const scene = getSceneById(state.project, step.sceneId);
  const hotspot = scene?.hotspots.find((item) => item.id === step.hotspotId);
  if (!hotspot) return;
  await openTargetEntry({
    kind: hotspot.type === 'navigation' ? 'link' : 'hotspot',
    sceneId: step.sceneId,
    hotspotId: step.hotspotId,
  });
}

async function initialize() {
  state.project = await loadProjectDocument();
  const initialScene = getInitialScene(state.project);
  state.activeScene = initialScene ? resolveSceneMedia(state.project, initialScene) : null;

  if (!elements.viewer || !state.activeScene) {
    setLoading(true, 'Panorama non disponibile');
    return;
  }

  setActiveScene(state.activeScene);
  setLoading(true);

  try {
    state.viewer = createPanoramaViewer({
    container: elements.viewer,
    scene: state.activeScene,
    onReady: async (viewer) => {
      setLoading(false);
      const informationPanel = createInformationPanel({
        element: elements.infoPanel,
        title: elements.infoPanelTitle,
        category: elements.infoPanelCategory,
        blocks: elements.infoPanelBlocks,
      });
      state.informationPanel = informationPanel;
      createDynamicHotspotAppearance(viewer);

      createMobileControlsMenu({
        onResetOrientation: () => state.viewer.animate({
          yaw: state.activeScene.defaultYaw || 0,
          pitch: state.activeScene.defaultPitch || 0,
          speed: '3rpm',
        }),
      });

      state.hotspotViewer = await createHotspotViewer({
        viewer,
        markersPlugin: getMarkersPlugin(viewer),
        scene: state.activeScene,
        project: state.project,
        onNavigate: (sceneId) => changeScene(sceneId),
        popup: informationPanel,
      });

      state.guidedTourPlayer = createGuidedTourPlayer({
        project: state.project,
        onOpenStep: openGuidedTourStep,
        onPreloadScene: preloadScene,
      });

      elements.environmentsToggle?.addEventListener('click', toggleEnvironmentsPanel);
      elements.environmentsPanel?.addEventListener('click', (event) => {
        if (event.target.closest('[data-environments-action="close"]')) {
          closeEnvironmentsPanel();
          return;
        }
        const button = event.target.closest('[data-environment-scene-id]');
        if (button) {
          changeScene(button.dataset.environmentSceneId);
          closeEnvironmentsPanel();
        }
      });
      document.addEventListener('click', (event) => {
        if (elements.environmentsPanel?.getAttribute('aria-hidden') !== 'false') return;
        if (event.target.closest('#environments-panel, #environments-toggle')) return;
        closeEnvironmentsPanel();
      });
      window.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') closeEnvironmentsPanel();
      });
      renderEnvironments();
      preloadLinkedScenes(state.activeScene);
    },
      onError: () => {
        setLoading(false);
        showMessage('Impossibile caricare il panorama iniziale.');
      },
    });
  } catch (error) {
    console.error(error);
    setLoading(false);
    showMessage('Il visualizzatore non puo essere avviato. Controlla il progetto e il panorama iniziale.');
  }
}

initialize();
