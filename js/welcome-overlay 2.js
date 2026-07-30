const AUTO_CLOSE_DELAY = 8000;
const CLOSE_ANIMATION_MS = 280;

export function createWelcomeOverlay({ element, initialScene, restoreFocusElement }) {
  if (!element || !initialScene || createWelcomeOverlay.wasShown) {
    return null;
  }

  createWelcomeOverlay.wasShown = true;

  const closeButton = element.querySelector('[data-welcome-overlay-action="close"]');
  const previousFocus = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : restoreFocusElement;

  let closeTimer = null;
  let closed = false;

  const close = () => {
    if (closed) return;
    closed = true;
    window.clearTimeout(closeTimer);
    element.classList.remove('is-visible');
    element.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('is-welcome-overlay-open');
    element.removeEventListener('click', handleOverlayClick);
    element.removeEventListener('keydown', handleKeydown);

    window.setTimeout(() => {
      element.hidden = true;
      const target = restoreFocusElement || previousFocus;
      if (target && typeof target.focus === 'function') {
        target.focus({ preventScroll: true });
      }
    }, CLOSE_ANIMATION_MS);
  };

  const handleOverlayClick = (event) => {
    event.stopPropagation();
    if (event.target === element || event.target.closest('[data-welcome-overlay-action="close"]')) {
      close();
    }
  };

  const handleKeydown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }

    if (event.key === 'Tab') {
      keepFocusInsideOverlay(event, element);
    }
  };

  element.hidden = false;
  element.setAttribute('aria-hidden', 'false');
  document.body.classList.add('is-welcome-overlay-open');
  element.addEventListener('click', handleOverlayClick);
  element.addEventListener('keydown', handleKeydown);
  window.requestAnimationFrame(() => element.classList.add('is-visible'));
  closeButton?.focus({ preventScroll: true });
  closeTimer = window.setTimeout(close, AUTO_CLOSE_DELAY);

  return { close };
}

createWelcomeOverlay.wasShown = false;

function keepFocusInsideOverlay(event, element) {
  const focusable = [...element.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
  )].filter((item) => !item.disabled && item.offsetParent !== null);

  if (!focusable.length) return;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
