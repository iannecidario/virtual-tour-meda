const FULL_PAGE_URL = 'https://iannecidario.github.io/virtual-tour-meda/';

export function isEmbedMode() {
  try {
    return new URLSearchParams(window.location.search).get('embed') === '1';
  } catch {
    return false;
  }
}

export function setupEmbedMode({ stage } = {}) {
  const embed = isEmbedMode();
  if (!embed) {
    return {
      embed: false,
      unlockAudio: () => Promise.resolve(false),
      showAudioActivation: () => {},
    };
  }

  document.documentElement.classList.add('embed-mode');
  document.body.classList.add('embed-mode');
  document.querySelector('.app-shell')?.classList.add('embed-mode');

  const audioActivation = createAudioActivationButton();
  const fullPageLink = createFullPageLink();
  stage?.append(fullPageLink);
  document.body.append(audioActivation);

  updateFullPageLink(fullPageLink);
  document.addEventListener('fullscreenchange', () => updateFullPageLink(fullPageLink));
  document.addEventListener('webkitfullscreenchange', () => updateFullPageLink(fullPageLink));

  window.addEventListener('unhandledrejection', (event) => {
    if (isAudioBlockedError(event.reason)) {
      event.preventDefault();
      showAudioActivation(audioActivation);
    }
  });

  return {
    embed: true,
    unlockAudio: () => unlockAudio(audioActivation),
    showAudioActivation: () => showAudioActivation(audioActivation),
  };
}

export async function unlockAudio(audioActivation = null) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    audioActivation?.setAttribute('hidden', '');
    window.dispatchEvent(new CustomEvent('meda:audio-unlocked'));
    return true;
  }

  try {
    const context = new AudioContextClass();
    if (context.state === 'suspended') {
      await context.resume();
    }

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    gain.gain.value = 0;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.01);

    window.setTimeout(() => context.close?.(), 80);
    audioActivation?.setAttribute('hidden', '');
    window.dispatchEvent(new CustomEvent('meda:audio-unlocked'));
    return true;
  } catch {
    if (audioActivation) showAudioActivation(audioActivation);
    return false;
  }
}

function createAudioActivationButton() {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'embed-audio-activation';
  button.hidden = true;
  button.setAttribute('aria-label', 'Attiva audio del Virtual Tour');
  button.textContent = 'Attiva audio';
  button.addEventListener('click', () => unlockAudio(button));
  return button;
}

function createFullPageLink() {
  const link = document.createElement('a');
  link.className = 'embed-full-page-link';
  link.href = FULL_PAGE_URL;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = 'Apri il tour a pagina intera';
  link.hidden = true;
  return link;
}

function showAudioActivation(button) {
  button.hidden = false;
}

function updateFullPageLink(link) {
  const supportsFullscreen = Boolean(
    document.fullscreenEnabled
      || document.webkitFullscreenEnabled
      || document.body.requestFullscreen
      || document.body.webkitRequestFullscreen,
  );
  const isFullscreen = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
  link.hidden = supportsFullscreen || isFullscreen;
}

function isAudioBlockedError(reason) {
  const name = String(reason?.name || '');
  const message = String(reason?.message || reason || '').toLowerCase();
  return name === 'NotAllowedError'
    || message.includes('notallowed')
    || message.includes('user gesture')
    || message.includes('interact')
    || message.includes('autoplay');
}
