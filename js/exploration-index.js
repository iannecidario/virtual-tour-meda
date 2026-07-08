import { collectMediaUsage, resolveMediaUrl } from './media-store.js';

export function buildExplorationIndex(project) {
  const sceneEntries = project.scenes.map((scene) => ({
    id: `scene:${scene.id}`,
    kind: 'scene',
    sceneId: scene.id,
    sceneTitle: scene.title,
    title: scene.title,
    description: scene.description,
    category: 'Ambiente',
    keywords: scene.keywords || [],
    thumbnail: resolveMediaUrl(project, scene.coverMediaId, scene.cover),
    content: [],
  }));

  const hotspotEntries = project.scenes.flatMap((scene) => scene.hotspots.map((hotspot) => ({
    id: `hotspot:${scene.id}:${hotspot.id}`,
    kind: hotspot.type === 'navigation' ? 'link' : 'hotspot',
    sceneId: scene.id,
    sceneTitle: scene.title,
    hotspotId: hotspot.id,
    title: hotspot.title || hotspot.label || hotspot.id,
    description: stripMarkup(hotspot.description),
    category: hotspot.category || (hotspot.type === 'navigation' ? 'Navigazione' : 'Senza categoria'),
    keywords: hotspot.keywords || [],
    thumbnail: resolveMediaUrl(project, hotspot.imageMediaId),
    icon: hotspot.icon || 'info',
    content: getContentFlags(hotspot),
  })));

  const mediaEntries = (project.media?.items || []).map((item) => {
    const usage = collectMediaUsage(project, item.id);
    const hotspotUsage = usage.find((entry) => entry.hotspotId);
    return {
      id: `media:${item.id}`,
      kind: 'media',
      mediaId: item.id,
      sceneId: hotspotUsage?.sceneId || usage[0]?.sceneId || '',
      sceneTitle: hotspotUsage?.sceneTitle || usage[0]?.sceneTitle || 'Libreria',
      hotspotId: hotspotUsage?.hotspotId || '',
      title: item.name,
      description: item.description,
      category: item.category,
      keywords: item.keywords || [],
      thumbnail: item.mimeType.startsWith('image/') ? item.path : '',
      content: [mediaContentType(item.mimeType)],
    };
  });

  return [...sceneEntries, ...hotspotEntries, ...mediaEntries].map((entry) => ({
    ...entry,
    searchText: normalizeText([
      entry.title,
      entry.description,
      entry.category,
      entry.sceneTitle,
      ...entry.keywords,
    ].join(' ')),
  }));
}

export function searchExplorationIndex(index, filters = {}) {
  const query = normalizeText(filters.query || '');
  return index.filter((entry) => {
    if (query && !entry.searchText.includes(query)) return false;
    if (filters.category && entry.category !== filters.category) return false;
    if (filters.kind && entry.kind !== filters.kind) return false;
    if (filters.sceneId && entry.sceneId !== filters.sceneId) return false;
    if (filters.audio && !entry.content.includes('audio')) return false;
    if (filters.video && !entry.content.includes('video')) return false;
    if (filters.image && !entry.content.includes('image')) return false;
    if (filters.document && !entry.content.includes('document')) return false;
    return true;
  });
}

export function getExplorationStats(project, index) {
  const hotspots = index.filter((entry) => entry.kind === 'hotspot' || entry.kind === 'link');
  const media = project.media?.items || [];
  return {
    scenes: project.scenes.length,
    hotspots: hotspots.length,
    images: media.filter((item) => item.mimeType.startsWith('image/')).length,
    audio: media.filter((item) => item.mimeType.startsWith('audio/')).length,
    videos: media.filter((item) => item.mimeType.startsWith('video/')).length
      + hotspots.filter((entry) => entry.content.includes('video')).length,
    categories: new Set(hotspots.map((entry) => entry.category).filter(Boolean)).size,
  };
}

function getContentFlags(hotspot) {
  return [
    hotspot.imageMediaId && 'image',
    hotspot.audioMediaId && 'audio',
    hotspot.youtube && 'video',
    hotspot.documentMediaId && 'document',
  ].filter(Boolean);
}

function mediaContentType(mimeType = '') {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType === 'application/pdf') return 'document';
  return 'other';
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function stripMarkup(value = '') {
  const element = document.createElement('div');
  element.innerHTML = value;
  return element.textContent || '';
}
