import { Viewer } from '@photo-sphere-viewer/core';
import { GyroscopePlugin } from '@photo-sphere-viewer/gyroscope-plugin';
import { MarkersPlugin } from '@photo-sphere-viewer/markers-plugin';

const viewerDefaults = {
  navbar: ['zoom', 'move', 'gyroscope', 'fullscreen'],
  mousewheel: true,
  mousemove: true,
  touchmoveTwoFingers: false,
  moveInertia: true,
  fisheye: false,
  minFov: 35,
  maxFov: 95,
  defaultZoomLvl: 28,
  loadingTxt: 'Caricamento panorama...',
};

export function createPanoramaViewer({ container, scene, onReady, onError }) {
  const viewer = new Viewer({
    ...viewerDefaults,
    container,
    panorama: scene.panorama,
    caption: scene.description,
    defaultYaw: normalizeAngle(scene.defaultYaw),
    defaultPitch: normalizeAngle(scene.defaultPitch),
    defaultZoomLvl: scene.defaultZoomLvl ?? viewerDefaults.defaultZoomLvl,
    plugins: [
      [
        MarkersPlugin,
        {
          clickEventOnMarker: false,
          markers: [],
        },
      ],
      [
        GyroscopePlugin,
        {
          touchmove: true,
          absolutePosition: true,
        },
      ],
    ],
  });

  viewer.addEventListener('ready', () => {
    applySceneInitialView(viewer, scene);
    onReady?.(viewer);
  }, { once: true });

  viewer.addEventListener('panorama-load-fail', (event) => {
    onError?.(event);
  });

  return viewer;
}

export function getMarkersPlugin(viewer) {
  return viewer.getPlugin(MarkersPlugin);
}

export async function setViewerScene(viewer, scene) {
  await viewer.setPanorama(scene.panorama, {
    caption: scene.description,
  });
  applySceneInitialView(viewer, scene);
}

export function applySceneInitialView(viewer, scene) {
  viewer.rotate({
    yaw: normalizeAngle(scene.defaultYaw),
    pitch: normalizeAngle(scene.defaultPitch),
  });
  setViewerZoom(viewer, scene.defaultZoomLvl ?? viewerDefaults.defaultZoomLvl);
}

export function setViewerZoom(viewer, zoomLevel = viewerDefaults.defaultZoomLvl) {
  const numericZoom = Number(zoomLevel);
  const normalizedZoom = Number.isFinite(numericZoom)
    ? Math.max(0, Math.min(100, numericZoom))
    : viewerDefaults.defaultZoomLvl;
  if (typeof viewer.zoom === 'function') {
    viewer.zoom(normalizedZoom);
  }
}

function normalizeAngle(value, fallback = '0deg') {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : value;
}
