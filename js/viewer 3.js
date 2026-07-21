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
  defaultYaw: scene.defaultYaw,
  defaultPitch: scene.defaultPitch,
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
  viewer.rotate({
    yaw: scene.defaultYaw || '0deg',
    pitch: scene.defaultPitch || '0deg',
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
