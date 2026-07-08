export function normalizeHotspot(hotspot = {}) {
  const size = Number(hotspot.size) || 36;

  return {
    ...hotspot,
    type: hotspot.type || 'info',
    id: String(hotspot.id || '').trim(),
    title: String(hotspot.title || '').trim(),
    description: String(hotspot.description || '').trim(),
    category: String(hotspot.category || '').trim(),
    keywords: Array.isArray(hotspot.keywords)
      ? hotspot.keywords.map((keyword) => String(keyword).trim()).filter(Boolean)
      : String(hotspot.keywords || '').split(',').map((keyword) => keyword.trim()).filter(Boolean),
    icon: hotspot.icon || 'info',
    iconMediaId: String(hotspot.iconMediaId || '').trim(),
    color: hotspot.color || '#BE1622',
    borderColor: hotspot.borderColor || '#FFFFFF',
    size: Math.min(Math.max(size, 24), 72),
    imageMediaId: String(hotspot.imageMediaId || '').trim(),
    audioMediaId: String(hotspot.audioMediaId || '').trim(),
    documentMediaId: String(hotspot.documentMediaId || '').trim(),
    youtube: String(hotspot.youtube || '').trim(),
    externalUrl: String(hotspot.externalUrl || '').trim(),
    targetSceneId: String(hotspot.targetSceneId || '').trim(),
    label: String(hotspot.label || '').trim(),
    orientation: String(hotspot.orientation || '').trim(),
    visible: hotspot.visible !== false,
    yaw: Number(hotspot.yaw) || 0,
    pitch: Number(hotspot.pitch) || 0,
  };
}
