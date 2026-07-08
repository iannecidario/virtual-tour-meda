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

  function open(hotspot) {
    stopMedia();
    previousFocus = document.activeElement;
    fields.title.textContent = hotspot.title || hotspot.id;
    fields.category.textContent = hotspot.category || 'Hotspot';
    renderBlocks(fields.blocks, hotspot);
    element.inert = false;
    element.setAttribute('aria-hidden', 'false');
    document.body.classList.add('is-info-panel-open');
    requestAnimationFrame(() => element.querySelector('[data-info-panel-action="close"]')?.focus());
  }

  function close() {
    stopMedia();
    element.setAttribute('aria-hidden', 'true');
    element.inert = true;
    document.body.classList.remove('is-info-panel-open');
    if (previousFocus instanceof HTMLElement && document.contains(previousFocus) && !previousFocus.closest('[inert]')) {
      previousFocus.focus();
    }
  }

  function stopMedia() {
    fields.blocks.querySelectorAll('audio, video').forEach((player) => {
      player.pause();
      player.currentTime = 0;
    });
    fields.blocks.replaceChildren();
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

  const image = document.createElement('img');
  image.src = hotspot.image;
  image.alt = hotspot.title || 'Immagine hotspot';
  image.loading = 'lazy';
  image.addEventListener('error', () => {
    const message = document.createElement('p');
    message.className = 'media-error';
    message.textContent = 'Immagine non disponibile.';
    image.replaceWith(message);
  }, { once: true });

  figure.append(image);
  return figure;
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
