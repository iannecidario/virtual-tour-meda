export const HOTSPOT_MARKER_APPEARANCE = {
  opacity: 0.82,
  activeOpacity: 1,
  activeScale: 1.12,
  zoomPivot: 28,
  zoomOpenScale: 1.08,
  zoomCloseScale: 0.72,
  desktopScale: 1,
  tabletScale: 0.9,
  mobileScale: 0.78,
  tabletMaxWidth: 1024,
  mobileMaxWidth: 760,
};

export function createDynamicHotspotAppearance(viewer, config = HOTSPOT_MARKER_APPEARANCE) {
  const target = viewer?.container;
  if (!target) return { destroy() {} };
  target.classList.add('has-dynamic-hotspot-markers');

  let animationFrame = 0;
  const update = () => {
    window.cancelAnimationFrame(animationFrame);
    animationFrame = window.requestAnimationFrame(() => {
      const zoomLevel = getZoomLevel(viewer, config.zoomPivot);
      target.style.setProperty('--marker-device-scale', getDeviceScale(config));
      target.style.setProperty('--marker-zoom-scale', getZoomScale(zoomLevel, config));
      target.style.setProperty('--marker-opacity', config.opacity);
      target.style.setProperty('--marker-active-opacity', config.activeOpacity);
      target.style.setProperty('--marker-active-scale', config.activeScale);
    });
  };

  const eventNames = ['zoom-updated', 'position-updated', 'ready'];
  eventNames.forEach((eventName) => viewer.addEventListener?.(eventName, update));
  window.addEventListener('resize', update);
  target.addEventListener('wheel', update, { passive: true });
  target.addEventListener('pointermove', update, { passive: true });
  update();

  return {
    destroy() {
      window.cancelAnimationFrame(animationFrame);
      target.classList.remove('has-dynamic-hotspot-markers');
      eventNames.forEach((eventName) => viewer.removeEventListener?.(eventName, update));
      window.removeEventListener('resize', update);
      target.removeEventListener('wheel', update);
      target.removeEventListener('pointermove', update);
    },
  };
}

function getZoomLevel(viewer, fallback) {
  if (typeof viewer.getZoomLevel === 'function') return Number(viewer.getZoomLevel()) || fallback;
  return Number(viewer.state?.zoomLvl) || fallback;
}

function getDeviceScale(config) {
  const width = window.innerWidth || document.documentElement.clientWidth || 1280;
  if (width <= config.mobileMaxWidth) return config.mobileScale;
  if (width <= config.tabletMaxWidth) return config.tabletScale;
  return config.desktopScale;
}

function getZoomScale(zoomLevel, config) {
  const zoom = Math.max(0, Math.min(100, Number(zoomLevel) || config.zoomPivot));
  if (zoom <= config.zoomPivot) {
    const progress = (config.zoomPivot - zoom) / config.zoomPivot;
    return lerp(1, config.zoomOpenScale, progress);
  }
  const progress = (zoom - config.zoomPivot) / (100 - config.zoomPivot);
  return lerp(1, config.zoomCloseScale, progress);
}

function lerp(start, end, progress) {
  return start + (end - start) * Math.max(0, Math.min(1, progress));
}
