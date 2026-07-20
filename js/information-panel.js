const blockRenderers = [
  {
    key: 'image',
    hasContent: (hotspot) => Boolean(hotspot.image),
    render: renderImageBlock,
  },
  {
    key: 'description',
    hasContent: (hotspot) => Boolean(hotspot.description),
    render: renderDescriptionBlock,
  },
  {
    key: 'audio',
    hasContent: (hotspot) => Boolean(hotspot.audio),
    render: renderAudioBlock,
  },
  {
    key: 'youtube',
    hasContent: (hotspot) => Boolean(getYouTubeEmbedUrl(hotspot.youtube)),
    render: renderYouTubeBlock,
  },
  {
    key: 'document',
    hasContent: (hotspot) => Boolean(hotspot.document),
    render: renderDocumentBlock,
  },
  {
    key: 'externalUrl',
    hasContent: (hotspot) => isExternalUrl(hotspot.externalUrl),
    render: renderExternalLinkBlock,
  },
];

export function createInformationPanel({ element, title, category, blocks }) {
  const fields = { title, category, blocks };
  let previousFocus = null;
  const pronunciationPlayer = new Audio();
  const imageViewer = createImageViewer();
  pronunciationPlayer.preload = 'auto';

  function open(hotspot) {
    stopMedia();
    previousFocus = document.activeElement;
    fields.title.textContent = hotspot.title || hotspot.id;
    fields.category.textContent = hotspot.category || 'Hotspot';
    renderBlocks(fields.blocks, hotspot);
    element.inert = false;
    element.setAttribute('aria-hidden', 'false');
    document.body.classList.add('is-info-panel-open');
    playPronunciation(hotspot.pronunciation);
    requestAnimationFrame(() => element.querySelector('[data-info-panel-action="close"]')?.focus());
  }

  function close() {
    stopMedia();
    imageViewer.close();
    element.setAttribute('aria-hidden', 'true');
    element.inert = true;
    document.body.classList.remove('is-info-panel-open');
    if (previousFocus instanceof HTMLElement && document.contains(previousFocus) && !previousFocus.closest('[inert]')) {
      previousFocus.focus();
    }
  }

  function stopMedia() {
    imageViewer.close();
    stopPronunciation();
    fields.blocks.querySelectorAll('audio, video').forEach((player) => {
      player.pause();
      player.currentTime = 0;
    });
    fields.blocks.replaceChildren();
  }

  function playPronunciation(src) {
    if (!src) return;
    pronunciationPlayer.src = src;
    pronunciationPlayer.currentTime = 0;
    pronunciationPlayer.play().catch(() => {
      stopPronunciation();
    });
  }

  function stopPronunciation() {
    pronunciationPlayer.pause();
    pronunciationPlayer.removeAttribute('src');
    pronunciationPlayer.load();
  }

  element.querySelectorAll('[data-info-panel-action="close"]').forEach((button) => {
    button.addEventListener('click', close);
  });

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && element.getAttribute('aria-hidden') === 'false') {
      close();
    }
  });

  return { open, close };
}

function renderBlocks(container, hotspot) {
  container.replaceChildren();

  blockRenderers.forEach((block) => {
    if (block.hasContent(hotspot)) {
      container.append(block.render(hotspot));
    }
  });
}

function renderImageBlock(hotspot) {
  const figure = document.createElement('figure');
  figure.className = 'info-panel__image-block';

  const trigger = document.createElement('button');
  trigger.className = 'info-panel__image-trigger';
  trigger.type = 'button';
  trigger.setAttribute('aria-label', 'Apri immagine a schermo intero');

  const image = document.createElement('img');
  image.src = hotspot.image;
  image.alt = hotspot.title || 'Immagine hotspot';
  image.loading = 'lazy';
  image.addEventListener('error', () => {
    const message = document.createElement('p');
    message.className = 'media-error';
    message.textContent = 'Immagine non disponibile.';
    trigger.replaceWith(message);
  }, { once: true });

  trigger.append(image);
  trigger.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('meda:open-image-viewer', {
      detail: {
        src: hotspot.image,
        alt: image.alt,
      },
    }));
  });

  figure.append(trigger);
  return figure;
}

function createImageViewer() {
  let overlay = null;
  let stage = null;
  let image = null;
  let previousFocus = null;
  const pointers = new Map();
  const state = {
    scale: 1,
    x: 0,
    y: 0,
    startX: 0,
    startY: 0,
    startScale: 1,
    startDistance: 0,
    dragStartX: 0,
    dragStartY: 0,
    moved: false,
    lastTapTime: 0,
  };

  function ensure() {
    if (overlay) return;

    overlay = document.createElement('aside');
    overlay.className = 'image-viewer';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.setAttribute('aria-label', 'Visualizzazione immagine');
    overlay.inert = true;

    const closeButton = document.createElement('button');
    closeButton.className = 'image-viewer__close';
    closeButton.type = 'button';
    closeButton.setAttribute('aria-label', 'Chiudi immagine');
    closeButton.textContent = 'x';

    stage = document.createElement('div');
    stage.className = 'image-viewer__stage';
    overlay.append(stage, closeButton);
    document.body.append(overlay);

    closeButton.addEventListener('click', close);
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay || event.target === stage) close();
    });
    overlay.addEventListener('wheel', onWheel, { passive: false });
    overlay.addEventListener('pointerdown', onPointerDown);
    overlay.addEventListener('pointermove', onPointerMove);
    overlay.addEventListener('pointerup', onPointerUp);
    overlay.addEventListener('pointercancel', onPointerUp);
    overlay.addEventListener('dblclick', resetFromGesture);
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && overlay.getAttribute('aria-hidden') === 'false') close();
    });
    window.addEventListener('resize', () => {
      if (overlay.getAttribute('aria-hidden') === 'false') resetTransform();
    });
    window.addEventListener('meda:open-image-viewer', (event) => {
      open(event.detail || {});
    });
  }

  function open({ src, alt }) {
    ensure();
    if (!src) return;
    previousFocus = document.activeElement;
    pointers.clear();
    resetTransform();
    state.lastTapTime = 0;
    stage.replaceChildren();
    image = document.createElement('img');
    image.className = 'image-viewer__image';
    image.draggable = false;
    image.alt = alt || 'Immagine';
    image.decoding = 'async';
    image.addEventListener('load', resetTransform, { once: true });
    image.addEventListener('error', () => {
      const message = document.createElement('p');
      message.className = 'image-viewer__error';
      message.textContent = 'Immagine non disponibile.';
      stage.replaceChildren(message);
      image = null;
    }, { once: true });
    stage.append(image);
    image.src = src;
    overlay.inert = false;
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('is-image-viewer-open');
    requestAnimationFrame(() => overlay.querySelector('.image-viewer__close')?.focus());
  }

  function close() {
    if (!overlay || overlay.getAttribute('aria-hidden') === 'true') return;
    pointers.clear();
    overlay.setAttribute('aria-hidden', 'true');
    overlay.inert = true;
    stage?.replaceChildren();
    image = null;
    document.body.classList.remove('is-image-viewer-open');
    if (previousFocus instanceof HTMLElement && document.contains(previousFocus) && !previousFocus.closest('[inert]')) {
      previousFocus.focus();
    }
  }

  function resetTransform() {
    state.scale = 1;
    state.x = 0;
    state.y = 0;
    state.startX = 0;
    state.startY = 0;
    state.startScale = 1;
    state.startDistance = 0;
    state.moved = false;
    applyTransform();
  }

  function applyTransform() {
    if (!image) return;
    image.style.transform = `translate3d(${state.x}px, ${state.y}px, 0) scale(${state.scale})`;
  }

  function onWheel(event) {
    if (!image || overlay?.getAttribute('aria-hidden') === 'true') return;
    event.preventDefault();
    const nextScale = clamp(state.scale + (-event.deltaY * 0.002), 1, 5);
    setScale(nextScale);
  }

  function onPointerDown(event) {
    if (!image || overlay?.getAttribute('aria-hidden') === 'true' || event.target.closest('.image-viewer__close')) return;
    event.preventDefault();
    if (event.pointerType === 'touch' && isDoubleTap()) {
      resetTransform();
      return;
    }
    overlay.setPointerCapture?.(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    state.moved = false;
    state.startX = state.x;
    state.startY = state.y;
    state.dragStartX = event.clientX;
    state.dragStartY = event.clientY;
    state.startScale = state.scale;
    state.startDistance = distanceBetweenPointers();
  }

  function onPointerMove(event) {
    if (!pointers.has(event.pointerId)) return;
    event.preventDefault();
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.size >= 2) {
      const nextDistance = distanceBetweenPointers();
      if (state.startDistance > 0) {
        setScale(state.startScale * (nextDistance / state.startDistance));
      }
      return;
    }

    const dx = event.clientX - state.dragStartX;
    const dy = event.clientY - state.dragStartY;
    state.moved = Math.abs(dx) > 6 || Math.abs(dy) > 6;
    if (state.scale > 1) {
      state.x = state.startX + dx;
      state.y = state.startY + dy;
      applyTransform();
    } else if (dy > 90 && Math.abs(dx) < 70) {
      close();
    }
  }

  function onPointerUp(event) {
    if (pointers.has(event.pointerId)) {
      pointers.delete(event.pointerId);
    }
    try {
      overlay?.releasePointerCapture?.(event.pointerId);
    } catch {
      // Safari puo rilasciare automaticamente il puntatore quando cambia gesto.
    }
    state.startX = state.x;
    state.startY = state.y;
    state.startScale = state.scale;
    state.startDistance = distanceBetweenPointers();
  }

  function resetFromGesture(event) {
    event.preventDefault();
    resetTransform();
  }

  function setScale(value) {
    const nextScale = clamp(value, 1, 5);
    state.scale = nextScale;
    if (nextScale === 1) {
      state.x = 0;
      state.y = 0;
    }
    applyTransform();
  }

  function isDoubleTap() {
    const now = Date.now();
    const isDouble = now - state.lastTapTime < 320;
    state.lastTapTime = now;
    return isDouble;
  }

  function distanceBetweenPointers() {
    const values = Array.from(pointers.values());
    if (values.length < 2) return 0;
    return Math.hypot(values[0].x - values[1].x, values[0].y - values[1].y);
  }

  ensure();
  return { close };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function renderDescriptionBlock(hotspot) {
  const block = document.createElement('section');
  block.className = 'info-panel__description';
  block.innerHTML = formatDescription(hotspot.description);
  return block;
}

function renderAudioBlock(hotspot) {
  const block = document.createElement('section');
  block.className = 'info-panel__media-block';

  const label = document.createElement('h3');
  label.textContent = 'Audio';

  const audio = document.createElement('audio');
  audio.src = hotspot.audio;
  audio.controls = true;
  audio.preload = 'none';
  audio.addEventListener('error', () => {
    if (block.querySelector('.media-error')) return;
    const message = document.createElement('p');
    message.className = 'media-error';
    message.textContent = 'Audio non disponibile.';
    block.append(message);
  }, { once: true });

  block.append(label, audio);
  return block;
}

function renderYouTubeBlock(hotspot) {
  const block = document.createElement('section');
  block.className = 'info-panel__media-block';

  const label = document.createElement('h3');
  label.textContent = 'Video';

  const frameWrap = document.createElement('div');
  frameWrap.className = 'info-panel__video';

  const iframe = document.createElement('iframe');
  iframe.src = getYouTubeEmbedUrl(hotspot.youtube);
  iframe.title = 'Video YouTube';
  iframe.loading = 'lazy';
  iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
  iframe.allowFullscreen = true;

  frameWrap.append(iframe);
  block.append(label, frameWrap);
  return block;
}

function renderExternalLinkBlock(hotspot) {
  const link = document.createElement('a');
  link.className = 'info-panel__link';
  link.href = hotspot.externalUrl;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = 'Approfondisci';
  return link;
}

function renderDocumentBlock(hotspot) {
  const link = document.createElement('a');
  link.className = 'info-panel__link';
  link.href = hotspot.document;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = 'Apri documento';
  return link;
}

function formatDescription(value = '') {
  const allowedTags = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'BR', 'P', 'UL', 'OL', 'LI', 'A']);
  const template = document.createElement('template');
  template.innerHTML = String(value).trim().replace(/\n/g, '<br>');

  template.content.querySelectorAll('*').forEach((node) => {
    if (!allowedTags.has(node.tagName)) {
      node.replaceWith(...node.childNodes);
      return;
    }

    Array.from(node.attributes).forEach((attribute) => {
      const isSafeLink = node.tagName === 'A'
        && ['href', 'target', 'rel'].includes(attribute.name)
        && !String(attribute.value).trim().toLowerCase().startsWith('javascript:');
      if (!isSafeLink) {
        node.removeAttribute(attribute.name);
      }
    });

    if (node.tagName === 'A') {
      node.target = '_blank';
      node.rel = 'noopener noreferrer';
    }
  });

  return template.innerHTML;
}

function getYouTubeEmbedUrl(value = '') {
  const url = String(value).trim();
  if (!url) {
    return '';
  }

  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
  return match ? `https://www.youtube.com/embed/${match[1]}` : '';
}

function isExternalUrl(value = '') {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
}
