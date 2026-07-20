import { renderHotspots } from './hotspot-markers.js';
import { normalizeHotspot } from './hotspot-store.js';
import { resolveHotspotMedia } from './media-store.js?v=20260720-4';

export async function createHotspotViewer({ viewer, markersPlugin, scene, project, onNavigate, popup }) {
  const state = {
    project,
    scene,
    hotspots: scene.hotspots || [],
    searchMatches: new Set(),
    searchActive: false,
  };

  renderResolvedHotspots(markersPlugin, state);

  const api = {
    findHotspot: (id) => state.hotspots.find((hotspot) => hotspot.id === id),
    getHotspots: () => state.hotspots.map(normalizeHotspot),
    setProject(nextProject) {
      state.project = nextProject;
      const currentScene = nextProject.scenes.find((item) => item.id === state.scene.id);
      if (currentScene) {
        state.scene = currentScene;
        state.hotspots = currentScene.hotspots || [];
      }
      renderResolvedHotspots(markersPlugin, state);
    },
    setSearchMatches(matches, active) {
      state.searchMatches = matches;
      state.searchActive = active;
      renderResolvedHotspots(markersPlugin, state);
    },
    openHotspot(id) {
      const hotspot = api.findHotspot(id);
      if (!hotspot) return false;
      popup.open(resolveHotspotMedia(state.project, hotspot));
      highlightMarker(viewer, id);
      return true;
    },
    setScene(nextScene, nextProject = state.project) {
      state.project = nextProject;
      state.scene = nextScene;
      state.hotspots = nextScene.hotspots || [];
      renderResolvedHotspots(markersPlugin, state);
    },
  };

  markersPlugin.addEventListener('select-marker', (event) => {
    const hotspot = api.findHotspot(event.marker.id);
    if (!hotspot) return;

    if (hotspot.type === 'navigation') {
      onNavigate?.(hotspot.targetSceneId, { fromHotspot: hotspot });
      return;
    }

    showInfoMarkerState(viewer, hotspot.id);
    popup.open(resolveHotspotMedia(state.project, hotspot), event.marker.domElement);
  });

  return api;
}

function showInfoMarkerState(viewer, id) {
  const marker = viewer.container.querySelector(`.hotspot-marker[data-hotspot-id="${CSS.escape(id)}"]`);
  marker?.classList.add('is-info-open');
  window.setTimeout(() => marker?.classList.remove('is-info-open'), 900);
}

function renderResolvedHotspots(markersPlugin, state) {
  renderHotspots(markersPlugin, state.hotspots.map((hotspot) => ({
    ...resolveHotspotMedia(state.project, hotspot),
    searchState: state.searchActive
      ? state.searchMatches.has(`${state.scene.id}:${hotspot.id}`) ? 'match' : 'dim'
      : '',
  })));
}

function highlightMarker(viewer, id) {
  requestAnimationFrame(() => {
    const marker = viewer.container.querySelector(`.hotspot-marker[data-hotspot-id="${CSS.escape(id)}"]`);
    marker?.classList.add('is-search-target');
    window.setTimeout(() => marker?.classList.remove('is-search-target'), 1800);
  });
}
