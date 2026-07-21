const iconPaths = {
  info: '<circle cx="12" cy="12" r="9"></circle><path d="M12 10v7"></path><path d="M12 7.5h.01"></path>',
  object: '<path d="M7 9.5 12 6l5 3.5v5L12 18l-5-3.5z"></path><path d="M12 12v6"></path><path d="m7 9.5 5 3 5-3"></path>',
  room: '<path d="M5 11.5 12 6l7 5.5"></path><path d="M7 10.5V18h10v-7.5"></path>',
  story: '<path d="M7 6h10v12H7z"></path><path d="M9.5 9h5"></path><path d="M9.5 12h5"></path><path d="M9.5 15h3"></path>',
  book: '<path d="M4.5 5.5h5.2c1.3 0 2.3.4 2.3 1.5v11c0-1.1-1-1.5-2.3-1.5H4.5z"></path><path d="M19.5 5.5h-5.2c-1.3 0-2.3.4-2.3 1.5v11c0-1.1 1-1.5 2.3-1.5h5.2z"></path><path d="M12 7v11"></path><path d="M7 8.5h2.3"></path><path d="M14.7 8.5H17"></path>',
  look: '<path d="M3.5 12s3-5 8.5-5 8.5 5 8.5 5-3 5-8.5 5-8.5-5-8.5-5z"></path><circle cx="12" cy="12" r="2.5"></circle>',
  door: '<path d="M8 20V5.5A1.5 1.5 0 0 1 9.5 4H17v16"></path><path d="M6 20h14"></path><path d="M13 12h.01"></path>',
  compass: '<circle cx="12" cy="12" r="9"></circle><path d="m15 9-2 5-5 2 2-5z"></path>',
  footprint: '<path d="M8 14c-1.8 1.2-2.4 3.2-1.2 4.5 1 1.1 2.8.5 3.9-1 1.3-1.8 1.1-3.1.3-3.8-.7-.6-1.8-.4-3 .3z"></path><path d="M14.8 5.4c-1.2 1.7-1 3.4.2 4.2 1.1.7 2.7.1 3.6-1.3.9-1.5.5-3.3-.8-4-1.1-.6-2.1-.2-3 .9z"></path>',
  'arrow-up': '<path d="M12 19V5"></path><path d="m6 11 6-6 6 6"></path>',
  'arrow-right': '<path d="M5 12h14"></path><path d="m13 6 6 6-6 6"></path>',
  'arrow-down': '<path d="M12 5v14"></path><path d="m18 13-6 6-6-6"></path>',
  'arrow-left': '<path d="M19 12H5"></path><path d="m11 18-6-6 6-6"></path>',
  'arrow-forward': '<path d="M4 12h12"></path><path d="m12 7 5 5-5 5"></path><path d="M19 6v12"></path>',
  'arrow-back': '<path d="M20 12H8"></path><path d="m12 7-5 5 5 5"></path><path d="M5 6v12"></path>',
};

export function renderHotspots(markersPlugin, hotspots, selectedId = null) {
  markersPlugin.setMarkers(hotspots.map((hotspot) => hotspotToMarker(hotspot, selectedId)));
}

export function updateHotspotMarker(markersPlugin, hotspot, selectedId = null) {
  markersPlugin.updateMarker(hotspotToMarker(hotspot, selectedId));
}

export function hotspotToMarker(hotspot, selectedId = null) {
  const label = escapeHtml(hotspot.title || hotspot.id);
  const selectedClass = hotspot.id === selectedId ? ' is-selected' : '';
  const navigationClass = hotspot.type === 'navigation' ? ' is-navigation' : '';
  const literaryClass = isLiteraryHotspot(hotspot) ? ' is-literary' : '';
  const searchClass = hotspot.searchState === 'match'
    ? ' is-search-match'
    : hotspot.searchState === 'dim' ? ' is-search-dimmed' : '';
  const size = Number(hotspot.size) || 36;
  const iconSize = Math.max(16, Math.round(size * 0.53));
  const iconMarkup = hotspot.customIcon
    ? `<img src="${escapeHtml(hotspot.customIcon)}" alt="">`
    : `<svg viewBox="0 0 24 24" aria-hidden="true">${iconPaths[hotspot.icon] || iconPaths.info}</svg>`;

  return {
    id: hotspot.id,
    position: { yaw: hotspot.yaw, pitch: hotspot.pitch },
    html: `
      <button class="hotspot-marker${selectedClass}${navigationClass}${literaryClass}${searchClass}" type="button" data-hotspot-id="${escapeHtml(hotspot.id)}" style="--hotspot-size: ${size}px; --hotspot-icon-size: ${iconSize}px; --hotspot-color: ${escapeHtml(hotspot.color)}; --hotspot-border-color: ${escapeHtml(hotspot.borderColor || '#FFFFFF')}" aria-label="${label}">
        ${iconMarkup}
      </button>
    `,
    size: { width: size, height: size },
    anchor: 'center center',
    tooltip: {
      content: label,
      position: 'top center',
    },
    data: { hotspotId: hotspot.id },
    visible: hotspot.visible !== false,
  };
}

function isLiteraryHotspot(hotspot) {
  const category = String(hotspot.category || '').trim().toLowerCase();
  return hotspot.type !== 'navigation' && (category === 'letteratura' || hotspot.icon === 'book');
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
