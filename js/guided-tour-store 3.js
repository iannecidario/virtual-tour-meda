export function normalizeGuidedTours(tours = []) {
  return Array.isArray(tours) ? tours.map(normalizeGuidedTour).filter((tour) => tour.id) : [];
}

export function normalizeGuidedTour(tour = {}) {
  return {
    id: String(tour.id || '').trim(),
    title: String(tour.title || '').trim(),
    description: String(tour.description || '').trim(),
    coverMediaId: String(tour.coverMediaId || '').trim(),
    duration: Math.max(0, Number(tour.duration) || 0),
    level: String(tour.level || '').trim(),
    category: String(tour.category || '').trim(),
    language: String(tour.language || 'Italiano').trim(),
    steps: Array.isArray(tour.steps) ? tour.steps.map((step, index) => normalizeTourStep(step, index)) : [],
  };
}

export function normalizeTourStep(step = {}, index = 0) {
  return {
    id: String(step.id || `tappa-${index + 1}`).trim(),
    type: step.type === 'hotspot' ? 'hotspot' : 'scene',
    sceneId: String(step.sceneId || '').trim(),
    hotspotId: step.type === 'hotspot' ? String(step.hotspotId || '').trim() : '',
    completion: step.completion === 'automatic' ? 'automatic' : 'manual',
  };
}

export function uniqueTourId(project, value = 'nuovo-percorso') {
  const ids = new Set((project.tours || []).map((tour) => tour.id));
  const base = slugify(value) || 'nuovo-percorso';
  let id = base;
  let index = 2;
  while (ids.has(id)) id = `${base}-${index++}`;
  return id;
}

export function validateTour(project, tour) {
  const issues = [];
  tour.steps.forEach((step, index) => {
    const scene = project.scenes.find((item) => item.id === step.sceneId);
    if (!scene) {
      issues.push(`Tappa ${index + 1}: scena non disponibile.`);
      return;
    }
    if (step.type === 'hotspot' && !scene.hotspots.some((hotspot) => hotspot.id === step.hotspotId)) {
      issues.push(`Tappa ${index + 1}: hotspot non disponibile.`);
    }
  });
  return issues;
}

export function getStepLabel(project, step) {
  const scene = project.scenes.find((item) => item.id === step.sceneId);
  if (!scene) return 'Scena mancante';
  if (step.type === 'scene') return scene.title;
  const hotspot = scene.hotspots.find((item) => item.id === step.hotspotId);
  return hotspot ? `${scene.title} / ${hotspot.title || hotspot.id}` : `${scene.title} / Hotspot mancante`;
}

function slugify(value) {
  return String(value || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
