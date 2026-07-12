export const HOTSPOT_MARKER_APPEARANCE = {
  opacity: 0.52,
  activeOpacity: 1,
  activeScale: 1.14,
  zoomPivot: 28,
  zoomOpenScale: 1.08,
  zoomCloseScale: 0.72,
  desktopScale: 1,
  tabletScale: 0.9,
  mobileScale: 0.78,
  tabletMaxWidth: 1024,
  mobileMaxWidth: 760,
  infoBackground: 'rgba(255, 253, 247, 0.72)',
  infoBorder: 'rgba(232, 230, 224, 0.82)',
  infoIcon: '#3f4248',
  infoShadow: '0 8px 22px rgba(31, 35, 40, 0.16)',
  infoActiveBorder: '#BE1622',
  infoActiveIcon: '#BE1622',
  infoActiveShadow: '0 12px 30px rgba(31, 35, 40, 0.22), 0 0 0 5px rgba(190, 22, 34, 0.16)',
  infoBlur: '10px',
  animationMs: 180,
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
      target.style.setProperty('--marker-info-background', config.infoBackground);
      target.style.setProperty('--marker-info-border', config.infoBorder);
      target.style.setProperty('--marker-info-icon', config.infoIcon);
      target.style.setProperty('--marker-info-shadow', config.infoShadow);
      target.style.setProperty('--marker-info-active-border', config.infoActiveBorder);
      target.style.setProperty('--marker-info-active-icon', config.infoActiveIcon);
      target.style.setProperty('--marker-info-active-shadow', config.infoActiveShadow);
      target.style.setProperty('--marker-info-blur', config.infoBlur);
      target.style.setProperty('--marker-animation-ms', `${config.animationMs}ms`);
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
