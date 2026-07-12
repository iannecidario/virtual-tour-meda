import { initialSceneId, scenes as fallbackScenes } from './scenes.js';
import { normalizeHotspot } from './hotspot-store.js?v=20260712-5';
import { normalizeMediaItem, normalizeMediaLibrary } from './media-store.js?v=20260712-5';
import { normalizeGuidedTours } from './guided-tour-store.js';

const PROJECT_URL = './data/project.json';

export async function loadProjectDocument() {
  try {
    const response = await fetch(`${PROJECT_URL}?v=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Project JSON non disponibile: ${response.status}`);
    }
    return normalizeProjectDocument(await response.json());
  } catch (error) {
    console.warn('Uso il progetto di fallback.', error);
    return createFallbackProject();
  }
}

export function normalizeProjectDocument(project = {}) {
  const migrated = migrateLegacyMedia(project);
  const scenes = Array.isArray(migrated.scenes) ? migrated.scenes.map(normalizeScene) : [];
  const orderedScenes = scenes.sort((a, b) => a.order - b.order);
  const initialId = migrated.settings?.initialSceneId || orderedScenes[0]?.id || '';

  return {
    ...migrated,
    version: Math.max(4, Number(migrated.version) || 4),
    settings: {
      ...(migrated.settings || {}),
      initialSceneId: initialId,
    },
    media: normalizeMediaLibrary(migrated.media),
    tours: normalizeGuidedTours(migrated.tours),
    scenes: orderedScenes.map((scene, index) => ({
      ...scene,
      order: Number(scene.order) || index + 1,
    })),
  };
}

export function normalizeScene(scene = {}) {
  const id = slugify(scene.id || scene.title || `scena-${Date.now()}`);

  return {
    ...scene,
    id,
    title: String(scene.title || scene.name || id).trim(),
    description: String(scene.description || '').trim(),
    panorama: String(scene.panorama || '').trim(),
    cover: String(scene.cover || scene.thumbnail || scene.panorama || '').trim(),
    panoramaMediaId: String(scene.panoramaMediaId || '').trim(),
    coverMediaId: String(scene.coverMediaId || '').trim(),
    order: Number(scene.order) || 1,
    defaultYaw: scene.defaultYaw || '0deg',
    defaultPitch: scene.defaultPitch || '0deg',
    defaultZoomLvl: normalizeZoomLevel(scene.defaultZoomLvl),
    defaultFov: scene.defaultFov === undefined ? '' : String(scene.defaultFov).trim(),
    settings: scene.settings && typeof scene.settings === 'object' ? scene.settings : {},
    links: Array.isArray(scene.links) ? scene.links : [],
    hotspots: Array.isArray(scene.hotspots) ? scene.hotspots.map(normalizeHotspot) : [],
  };
}

export function getInitialScene(project) {
  return getSceneById(project, project.settings.initialSceneId) || project.scenes[0];
}

export function getSceneById(project, sceneId) {
  return project.scenes.find((scene) => scene.id === sceneId);
}

export function setSceneHotspots(project, sceneId, hotspots) {
  return normalizeProjectDocument({
    ...project,
    scenes: project.scenes.map((scene) => scene.id === sceneId
      ? { ...scene, hotspots: hotspots.map(normalizeHotspot) }
      : scene),
  });
}

export function upsertScene(project, scene) {
  const nextScene = normalizeScene(scene);
  const exists = project.scenes.some((item) => item.id === nextScene.id);
  const scenes = exists
    ? project.scenes.map((item) => item.id === nextScene.id ? nextScene : item)
    : [...project.scenes, nextScene];

  return normalizeProjectDocument({ ...project, scenes });
}

export function removeScene(project, sceneId) {
  const scenes = project.scenes.filter((scene) => scene.id !== sceneId);
  const initialSceneId = project.settings.initialSceneId === sceneId ? scenes[0]?.id : project.settings.initialSceneId;
  return normalizeProjectDocument({
    ...project,
    settings: { ...project.settings, initialSceneId },
    scenes,
  });
}

export function reorderScene(project, sceneId, direction) {
  const scenes = [...project.scenes];
  const index = scenes.findIndex((scene) => scene.id === sceneId);
  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (index < 0 || targetIndex < 0 || targetIndex >= scenes.length) {
    return project;
  }
  [scenes[index], scenes[targetIndex]] = [scenes[targetIndex], scenes[index]];
  return normalizeProjectDocument({
    ...project,
    scenes: scenes.map((scene, orderIndex) => ({ ...scene, order: orderIndex + 1 })),
  });
}

export function duplicateScene(project, sceneId) {
  const source = getSceneById(project, sceneId);
  if (!source) {
    return project;
  }
  const id = uniqueSceneId(project, `${source.id}-copia`);
  return upsertScene(project, {
    ...structuredClone(source),
    id,
    title: `${source.title} copia`,
    order: project.scenes.length + 1,
  });
}

export function setInitialScene(project, sceneId) {
  return normalizeProjectDocument({
    ...project,
    settings: { ...project.settings, initialSceneId: sceneId },
  });
}

export async function saveProjectDocument(project) {
  const json = `${JSON.stringify(normalizeProjectDocument(project), null, 2)}\n`;
  const blob = new Blob([json], { type: 'application/json' });
  downloadBlob(blob, 'project.json');
}

export function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export function uniqueSceneId(project, base = 'nuova-scena') {
  const ids = new Set(project.scenes.map((scene) => scene.id));
  const slug = slugify(base) || 'nuova-scena';
  let candidate = slug;
  let index = 2;
  while (ids.has(candidate)) {
    candidate = `${slug}-${index}`;
    index += 1;
  }
  return candidate;
}

export function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function createFallbackProject() {
  return normalizeProjectDocument({
    version: 4,
    settings: { initialSceneId },
    media: { items: [], collections: [] },
    tours: [],
    scenes: fallbackScenes.map((scene, index) => ({
      ...scene,
      cover: scene.panorama,
      order: index + 1,
      settings: {},
      links: [],
      hotspots: [],
    })),
  });
}

function normalizeZoomLevel(value) {
  if (value === undefined || value === null || value === '') return 28;
  const zoom = Number(value);
  return Number.isFinite(zoom) ? Math.max(0, Math.min(100, zoom)) : 28;
}

function migrateLegacyMedia(project = {}) {
  const migrated = structuredClone(project);
  migrated.media = normalizeMediaLibrary(migrated.media);
  const byPath = new Map(migrated.media.items.filter((item) => item.path).map((item) => [item.path, item.id]));

  function ensureMedia(path, category, name) {
    if (!path) return '';
    if (byPath.has(path)) return byPath.get(path);
    const ids = new Set(migrated.media.items.map((item) => item.id));
    const base = slugify(name || path.split('/').pop()?.replace(/\.[^.]+$/, '')) || 'media';
    let id = base;
    let index = 2;
    while (ids.has(id)) id = `${base}-${index++}`;
    migrated.media.items.push(normalizeMediaItem({ id, name: name || base, category, path }));
    byPath.set(path, id);
    return id;
  }

  migrated.scenes = Array.isArray(migrated.scenes) ? migrated.scenes.map((scene) => ({
    ...scene,
    panoramaMediaId: scene.panoramaMediaId || ensureMedia(scene.panorama, 'Panorami 360', `${scene.title || scene.id} 360`),
    coverMediaId: scene.coverMediaId || ensureMedia(scene.cover, 'Fotografie', `${scene.title || scene.id} copertina`),
    hotspots: Array.isArray(scene.hotspots) ? scene.hotspots.map((hotspot) => {
      const next = {
        ...hotspot,
        imageMediaId: hotspot.imageMediaId || ensureMedia(hotspot.image, 'Fotografie', `${hotspot.title || hotspot.id} immagine`),
        audioMediaId: hotspot.audioMediaId || ensureMedia(hotspot.audio, 'Audio', `${hotspot.title || hotspot.id} audio`),
        iconMediaId: hotspot.iconMediaId || ensureMedia(hotspot.customIcon, 'Icone', `${hotspot.title || hotspot.id} icona`),
        documentMediaId: hotspot.documentMediaId || ensureMedia(hotspot.document, 'Documenti', `${hotspot.title || hotspot.id} documento`),
      };
      delete next.image;
      delete next.audio;
      delete next.customIcon;
      delete next.document;
      return next;
    }) : [],
  })) : [];
  return migrated;
}
