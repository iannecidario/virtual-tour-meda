export const MEDIA_CATEGORIES = [
  'Fotografie',
  'Panorami 360',
  'Audio',
  'Video',
  'Icone',
  'Documenti',
  'Altri file',
];

export function normalizeMediaLibrary(media = {}) {
  return {
    collections: Array.isArray(media.collections)
      ? media.collections.map((collection) => ({
        id: String(collection.id || '').trim(),
        name: String(collection.name || '').trim(),
      })).filter((collection) => collection.id && collection.name)
      : [],
    items: Array.isArray(media.items) ? media.items.map(normalizeMediaItem) : [],
  };
}

export function normalizeMediaItem(item = {}) {
  return {
    id: String(item.id || '').trim(),
    name: String(item.name || item.fileName || 'Media').trim(),
    description: String(item.description || '').trim(),
    category: MEDIA_CATEGORIES.includes(item.category) ? item.category : inferCategory(item),
    keywords: Array.isArray(item.keywords)
      ? item.keywords.map((keyword) => String(keyword).trim()).filter(Boolean)
      : String(item.keywords || '').split(',').map((keyword) => keyword.trim()).filter(Boolean),
    collectionId: String(item.collectionId || '').trim(),
    mimeType: String(item.mimeType || inferMimeType(item.path || item.fileName)).trim(),
    size: Math.max(0, Number(item.size) || 0),
    uploadedAt: item.uploadedAt || new Date().toISOString(),
    path: String(item.path || '').trim(),
    fileName: String(item.fileName || fileNameFromPath(item.path) || '').trim(),
  };
}

export function uniqueMediaId(project, name = 'media') {
  const ids = new Set((project.media?.items || []).map((item) => item.id));
  const base = slugify(name) || 'media';
  let candidate = base;
  let index = 2;
  while (ids.has(candidate)) {
    candidate = `${base}-${index}`;
    index += 1;
  }
  return candidate;
}

export function getMediaItem(project, mediaId) {
  return project.media?.items?.find((item) => item.id === mediaId) || null;
}

export function resolveMediaUrl(project, mediaId, fallback = '') {
  return getMediaItem(project, mediaId)?.path || fallback || '';
}

export function resolveHotspotMedia(project, hotspot) {
  return {
    ...hotspot,
    image: resolveMediaUrl(project, hotspot.imageMediaId, hotspot.image),
    audio: resolveMediaUrl(project, hotspot.audioMediaId, hotspot.audio),
    customIcon: resolveMediaUrl(project, hotspot.iconMediaId, hotspot.customIcon),
    document: resolveMediaUrl(project, hotspot.documentMediaId, hotspot.document),
  };
}

export function resolveSceneMedia(project, scene) {
  if (!scene) return null;
  return {
    ...scene,
    panorama: resolveMediaUrl(project, scene.panoramaMediaId, scene.panorama),
    cover: resolveMediaUrl(project, scene.coverMediaId, scene.cover),
  };
}

export function collectMediaUsage(project, mediaId) {
  const usage = [];
  (project.tours || []).forEach((tour) => {
    if (tour.coverMediaId === mediaId) {
      usage.push({ tourId: tour.id, sceneTitle: 'Percorsi Guidati', hotspotTitle: tour.title, kind: 'Copertina percorso' });
    }
  });
  project.scenes.forEach((scene) => {
    if (scene.panoramaMediaId === mediaId) {
      usage.push({ sceneId: scene.id, sceneTitle: scene.title, kind: 'Panorama della scena' });
    }
    if (scene.coverMediaId === mediaId) {
      usage.push({ sceneId: scene.id, sceneTitle: scene.title, kind: 'Copertina della scena' });
    }
    scene.hotspots.forEach((hotspot) => {
      const fields = [
        ['imageMediaId', 'Immagine'],
        ['audioMediaId', 'Audio'],
        ['iconMediaId', 'Icona'],
        ['documentMediaId', 'Documento'],
      ];
      fields.forEach(([field, label]) => {
        if (hotspot[field] === mediaId) {
          usage.push({
            sceneId: scene.id,
            sceneTitle: scene.title,
            hotspotId: hotspot.id,
            hotspotTitle: hotspot.title,
            kind: label,
          });
        }
      });
    });
  });
  return usage;
}

export function replaceMediaReferences(project, sourceId, replacementId = '') {
  const replace = (value) => value === sourceId ? replacementId : value;
  const replacementPath = getMediaItem(project, replacementId)?.path || '';
  return {
    ...project,
    tours: (project.tours || []).map((tour) => ({
      ...tour,
      coverMediaId: replace(tour.coverMediaId),
    })),
    scenes: project.scenes.map((scene) => ({
      ...scene,
      panorama: scene.panoramaMediaId === sourceId ? replacementPath : scene.panorama,
      cover: scene.coverMediaId === sourceId ? replacementPath : scene.cover,
      panoramaMediaId: replace(scene.panoramaMediaId),
      coverMediaId: replace(scene.coverMediaId),
      hotspots: scene.hotspots.map((hotspot) => ({
        ...hotspot,
        imageMediaId: replace(hotspot.imageMediaId),
        audioMediaId: replace(hotspot.audioMediaId),
        iconMediaId: replace(hotspot.iconMediaId),
        documentMediaId: replace(hotspot.documentMediaId),
      })),
    })),
  };
}

export function validateMediaLibrary(project, availableFiles = new Map()) {
  const issues = [];
  const items = project.media?.items || [];
  const pathGroups = new Map();

  items.forEach((item) => {
    const usage = collectMediaUsage(project, item.id);
    if (!usage.length) issues.push({ type: 'unused', mediaId: item.id, message: `${item.name}: file inutilizzato.` });
    if (!item.path) issues.push({ type: 'missing', mediaId: item.id, message: `${item.name}: file mancante.` });
    if (item.path && !/^https?:|^blob:|^data:/i.test(item.path) && !availableFiles.has(item.id)) {
      issues.push({ type: 'check', mediaId: item.id, message: `${item.name}: verificare che il file locale sia presente.` });
    }
    if (item.path) {
      const group = pathGroups.get(item.path) || [];
      group.push(item);
      pathGroups.set(item.path, group);
    }
  });

  pathGroups.forEach((group) => {
    if (group.length > 1) {
      issues.push({
        type: 'duplicate',
        mediaId: group[0].id,
        message: `Possibile duplicato: ${group.map((item) => item.name).join(', ')}.`,
      });
    }
  });

  project.scenes.forEach((scene) => {
    scene.hotspots.forEach((hotspot) => {
      ['imageMediaId', 'audioMediaId', 'iconMediaId', 'documentMediaId'].forEach((field) => {
        if (hotspot[field] && !getMediaItem(project, hotspot[field])) {
          issues.push({
            type: 'invalid',
            mediaId: hotspot[field],
            message: `${scene.title} / ${hotspot.title}: riferimento non valido (${field}).`,
          });
        }
      });
    });
  });
  (project.tours || []).forEach((tour) => {
    if (tour.coverMediaId && !getMediaItem(project, tour.coverMediaId)) {
      issues.push({
        type: 'invalid',
        mediaId: tour.coverMediaId,
        message: `${tour.title}: copertina percorso non valida.`,
      });
    }
  });
  return issues;
}

export function categoryForFile(file) {
  return inferCategory({ mimeType: file.type, path: file.name });
}

export function formatFileSize(bytes = 0) {
  if (!bytes) return 'Dimensione non disponibile';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / (1024 ** index)).toFixed(index ? 1 : 0)} ${units[index]}`;
}

function inferCategory(item) {
  const mime = String(item.mimeType || inferMimeType(item.path || '')).toLowerCase();
  if (mime.startsWith('image/')) return 'Fotografie';
  if (mime.startsWith('audio/')) return 'Audio';
  if (mime.startsWith('video/')) return 'Video';
  if (mime === 'application/pdf') return 'Documenti';
  return 'Altri file';
}

function inferMimeType(path = '') {
  const extension = String(path).split('.').pop()?.toLowerCase();
  return ({
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
    gif: 'image/gif', svg: 'image/svg+xml', mp3: 'audio/mpeg', wav: 'audio/wav',
    mp4: 'video/mp4', webm: 'video/webm', pdf: 'application/pdf',
  })[extension] || 'application/octet-stream';
}

function fileNameFromPath(path = '') {
  return String(path).split('/').pop()?.split('?')[0] || '';
}

function slugify(value) {
  return String(value || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
