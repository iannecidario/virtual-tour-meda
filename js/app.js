import { createHotspotViewer } from './hotspot-viewer.js?v=20260721-1';
import { createInformationPanel } from './information-panel.js?v=20260721-1';
import { createPanoramaViewer, getMarkersPlugin, setViewerScene } from './viewer.js';
import { getInitialScene, getSceneById, loadProjectDocument } from './project-store.js?v=20260721-1';
import { resolveSceneMedia } from './media-store.js?v=20260721-1';
import { createMobileControlsMenu } from './mobile-controls.js?v=20260712-1';
import { createDynamicHotspotAppearance } from './hotspot-marker-config.js';
import { SCENE_TRANSITION } from './scene-transition-config.js';

const state = {
  project: null,
  viewer: null,
  activeScene: null,
  hotspotViewer: null,
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

function exitFullscreen(viewer) {
  if (document.fullscreenElement && typeof document.exitFullscreen === 'function') {
    document.exitFullscreen();
    return;
  }
  if (document.webkitFullscreenElement && typeof document.webkitExitFullscreen === 'function') {
    document.webkitExitFullscreen();
    return;
  }
  if (typeof viewer?.exitFullscreen === 'function') {
    viewer.exitFullscreen();
    return;
  }
  if (typeof viewer?.toggleFullscreen === 'function') {
    viewer.toggleFullscreen();
  }
}

async function changeScene(sceneId, { pushHistory = true, transitionHotspot = null } = {}) {
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

  const cinematic = Boolean(transitionHotspot);
  if (cinematic) {
    await runExitTransition(transitionHotspot);
  }

  document.body.classList.add('is-scene-transitioning');
  document.body.classList.toggle('is-cinematic-transitioning', cinematic);
  setLoading(!cinematic, 'Caricamento scena');
  try {
    if (!cinematic) await wait(140);
    await setViewerScene(state.viewer, scene);
    state.activeScene = scene;
    setActiveScene(scene);
    state.informationPanel?.close();
    state.hotspotViewer.setScene(scene, state.project);
    renderEnvironments();
    preloadLinkedScenes(scene);
    if (cinematic) {
      setLoading(false);
      document.body.classList.remove('is-scene-transitioning');
      await runEntryTransition(scene);
    }
    return true;
  } catch (error) {
    console.error(error);
    if (pushHistory && previousScene) state.history.pop();
    showMessage(`Impossibile caricare la scena "${scene.title}".`);
    return false;
  } finally {
    setLoading(false);
    document.body.classList.remove('is-scene-transitioning');
    document.body.classList.remove('is-cinematic-transitioning');
  }
}

async function runExitTransition(hotspot) {
  highlightHotspot(hotspot.id);
  await wait(SCENE_TRANSITION.highlightMs);
  try {
    await Promise.race([
      state.viewer.animate({
        yaw: hotspot.yaw,
        pitch: hotspot.pitch,
        zoom: SCENE_TRANSITION.approachZoomLevel,
        speed: SCENE_TRANSITION.advanceSpeed,
      }),
      wait(SCENE_TRANSITION.advanceMs),
    ]);
  } catch {
    state.viewer.rotate({ yaw: hotspot.yaw, pitch: hotspot.pitch });
  }
  await wait(SCENE_TRANSITION.fadeMs);
}

async function runEntryTransition(scene) {
  const baseZoom = Number(scene.defaultZoomLvl);
  const currentZoom = Number.isFinite(baseZoom) ? baseZoom : 28;
  const entryZoom = Math.min(100, currentZoom + SCENE_TRANSITION.entryZoomOffset);
  try {
    state.viewer.zoom(entryZoom);
    await Promise.race([
      state.viewer.animate({
        yaw: scene.defaultYaw || '0deg',
        pitch: scene.defaultPitch || '0deg',
        zoom: currentZoom,
        speed: SCENE_TRANSITION.settleSpeed,
      }),
      wait(SCENE_TRANSITION.settleMs),
    ]);
  } catch {
    state.viewer.rotate({
      yaw: scene.defaultYaw || '0deg',
      pitch: scene.defaultPitch || '0deg',
    });
  }
}

function highlightHotspot(hotspotId) {
  const marker = elements.viewer.querySelector(`.hotspot-marker[data-hotspot-id="${CSS.escape(hotspotId)}"]`);
  marker?.classList.add('is-transition-target');
  window.setTimeout(() => marker?.classList.remove('is-transition-target'), SCENE_TRANSITION.highlightMs + SCENE_TRANSITION.advanceMs);
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
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

async function initialize() {
  applyTransitionConfig();
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
        fullscreenMount: viewer.container,
        onResetOrientation: () => state.viewer.animate({
          yaw: state.activeScene.defaultYaw || 0,
          pitch: state.activeScene.defaultPitch || 0,
          speed: '3rpm',
        }),
        onExitFullscreen: () => exitFullscreen(state.viewer),
      });

      state.hotspotViewer = await createHotspotViewer({
        viewer,
        markersPlugin: getMarkersPlugin(viewer),
        scene: state.activeScene,
        project: state.project,
        onNavigate: (sceneId, options) => changeScene(sceneId, { transitionHotspot: options?.fromHotspot }),
        popup: informationPanel,
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

function applyTransitionConfig() {
  document.documentElement.style.setProperty('--scene-transition-fade-ms', `${SCENE_TRANSITION.fadeMs}ms`);
}
