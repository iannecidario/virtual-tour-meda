export function createAudioHotspotPlayer() {
  let marker = null;
  const elements = createElements();
  const audio = elements.audio;

  audio.addEventListener('timeupdate', updateProgress);
  audio.addEventListener('loadedmetadata', updateProgress);
  audio.addEventListener('play', () => {
    elements.play.textContent = 'Pausa';
    marker?.classList.add('is-audio-playing');
  });
  audio.addEventListener('pause', () => {
    elements.play.textContent = 'Play';
    marker?.classList.remove('is-audio-playing');
  });
  audio.addEventListener('ended', () => {
    marker?.classList.remove('is-audio-playing');
    elements.root.classList.add('is-ended');
    updateProgress();
  });

  elements.play.addEventListener('click', () => {
    if (!audio.src) return;
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
  });

  elements.seek.addEventListener('input', () => {
    if (!Number.isFinite(audio.duration) || !audio.duration) return;
    audio.currentTime = (Number(elements.seek.value) / 1000) * audio.duration;
  });

  elements.volume.addEventListener('input', () => {
    audio.volume = Number(elements.volume.value);
  });

  elements.close.addEventListener('click', stop);

  function play(hotspot, source, targetMarker = null) {
    if (!source) return false;
    if (marker && marker !== targetMarker) marker.classList.remove('is-audio-playing');
    marker = targetMarker;
    elements.title.textContent = hotspot.title || 'Audio ambientale';
    elements.root.hidden = false;
    elements.root.classList.remove('is-ended');
    audio.pause();
    audio.src = source;
    audio.currentTime = 0;
    audio.volume = Number(elements.volume.value);
    updateProgress();
    audio.play().catch(() => {
      marker?.classList.remove('is-audio-playing');
    });
    return true;
  }

  function stop() {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    marker?.classList.remove('is-audio-playing');
    marker = null;
    elements.root.hidden = true;
    elements.root.classList.remove('is-ended');
    updateProgress();
  }

  function updateProgress() {
    const current = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
    const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
    elements.elapsed.textContent = formatTime(current);
    elements.duration.textContent = formatTime(duration);
    elements.seek.value = duration ? Math.round((current / duration) * 1000) : 0;
  }

  document.body.append(elements.root);
  return { play, stop };
}

function createElements() {
  const root = document.createElement('section');
  root.className = 'audio-hotspot-player';
  root.hidden = true;
  root.setAttribute('aria-label', 'Player audio ambientale');

  const play = document.createElement('button');
  play.type = 'button';
  play.className = 'audio-hotspot-player__play';
  play.textContent = 'Play';

  const title = document.createElement('strong');
  title.className = 'audio-hotspot-player__title';
  title.textContent = 'Audio ambientale';

  const elapsed = document.createElement('span');
  elapsed.className = 'audio-hotspot-player__time';
  elapsed.textContent = '0:00';

  const seek = document.createElement('input');
  seek.className = 'audio-hotspot-player__seek';
  seek.type = 'range';
  seek.min = '0';
  seek.max = '1000';
  seek.value = '0';
  seek.setAttribute('aria-label', 'Avanzamento audio');

  const duration = document.createElement('span');
  duration.className = 'audio-hotspot-player__time';
  duration.textContent = '0:00';

  const volume = document.createElement('input');
  volume.className = 'audio-hotspot-player__volume';
  volume.type = 'range';
  volume.min = '0';
  volume.max = '1';
  volume.step = '0.05';
  volume.value = '0.85';
  volume.setAttribute('aria-label', 'Volume audio');

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'audio-hotspot-player__close';
  close.setAttribute('aria-label', 'Chiudi audio');
  close.textContent = 'x';

  const audio = document.createElement('audio');
  audio.preload = 'metadata';

  root.append(play, title, elapsed, seek, duration, volume, close, audio);
  return { root, play, title, elapsed, seek, duration, volume, close, audio };
}

function formatTime(seconds = 0) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${rest}`;
}
