const MOBILE_QUERY = '(max-width: 760px)';

export function createMobileControlsMenu({ mount = document.body, onResetOrientation, onExitFullscreen }) {
  const mediaQuery = window.matchMedia(MOBILE_QUERY);
  const elements = createMenuElements();
  const movableControls = [
    document.querySelector('#environments-toggle'),
    document.querySelector('#tours-toggle'),
    document.querySelector('.psv-navbar'),
    document.querySelector('.guided-tour-bar'),
  ].filter(Boolean);
  const placements = movableControls.map((element) => {
    const placeholder = document.createComment(`mobile-controls:${element.id || element.className}`);
    element.parentNode.insertBefore(placeholder, element);
    return { element, placeholder };
  });

  mount.append(elements.toggle, elements.layer);
  bindMenu();
  handleBreakpointChange();
  updateFullscreenState();

  return {
    open: openMenu,
    close: closeMenu,
    destroy() {
      closeMenu({ restoreFocus: false });
      restoreControls();
      elements.toggle.remove();
      elements.layer.remove();
      mediaQuery.removeEventListener('change', handleBreakpointChange);
      window.removeEventListener('keydown', handleKeydown);
      document.removeEventListener('fullscreenchange', updateFullscreenState);
      document.removeEventListener('webkitfullscreenchange', updateFullscreenState);
    },
  };

  function bindMenu() {
    elements.toggle.addEventListener('click', openMenu);
    elements.layer.addEventListener('click', (event) => {
      if (event.target === elements.layer || event.target.closest('[data-mobile-controls-action="close"]')) {
        closeMenu();
        return;
      }
      if (event.target.closest('[data-mobile-controls-action="reset"]')) {
        onResetOrientation?.();
        closeMenu();
        return;
      }
      if (event.target.closest('[data-mobile-controls-action="exit-fullscreen"]')) {
        onExitFullscreen?.();
        closeMenu({ restoreFocus: false });
        return;
      }
      if (event.target.closest('#environments-toggle, #tours-toggle')) {
        closeMenu({ restoreFocus: false });
      }
    });
    mediaQuery.addEventListener('change', handleBreakpointChange);
    window.addEventListener('keydown', handleKeydown);
    document.addEventListener('fullscreenchange', updateFullscreenState);
    document.addEventListener('webkitfullscreenchange', updateFullscreenState);
  }

  function handleBreakpointChange() {
    closeMenu({ restoreFocus: false });
    if (mediaQuery.matches) {
      elements.actions.replaceChildren(
        ...placements
          .filter(({ element }) => element.matches('#environments-toggle, #tours-toggle'))
          .map(({ element }) => element),
      );
      const navbar = placements.find(({ element }) => element.matches('.psv-navbar'))?.element;
      const guidedTour = placements.find(({ element }) => element.matches('.guided-tour-bar'))?.element;
      elements.content.replaceChildren(
        ...[elements.resetOrientation, navbar, guidedTour].filter(Boolean),
      );
      elements.toggle.hidden = false;
    } else {
      restoreControls();
      elements.toggle.hidden = true;
    }
  }

  function restoreControls() {
    placements.forEach(({ element, placeholder }) => {
      placeholder.parentNode?.insertBefore(element, placeholder.nextSibling);
    });
  }

  function openMenu() {
    if (!mediaQuery.matches) return;
    elements.layer.hidden = false;
    elements.layer.inert = false;
    elements.layer.setAttribute('aria-hidden', 'false');
    elements.toggle.setAttribute('aria-expanded', 'true');
    document.body.classList.add('is-mobile-controls-menu-open');
    requestAnimationFrame(() => elements.closeIcon.focus());
  }

  function closeMenu({ restoreFocus = true } = {}) {
    const wasOpen = elements.layer.getAttribute('aria-hidden') === 'false';
    elements.layer.setAttribute('aria-hidden', 'true');
    elements.layer.inert = true;
    elements.toggle.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('is-mobile-controls-menu-open');
    window.setTimeout(() => {
      if (elements.layer.getAttribute('aria-hidden') === 'true') elements.layer.hidden = true;
    }, 240);
    if (wasOpen && restoreFocus && mediaQuery.matches) elements.toggle.focus();
  }

  function handleKeydown(event) {
    if (event.key === 'Escape' && elements.layer.getAttribute('aria-hidden') === 'false') {
      closeMenu();
    }
  }

  function updateFullscreenState() {
    const isFullscreen = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
    elements.exitFullscreen.hidden = !isFullscreen;
  }
}

function createMenuElements() {
  const toggle = document.createElement('button');
  toggle.className = 'mobile-controls-toggle';
  toggle.type = 'button';
  toggle.setAttribute('aria-label', 'Apri controlli');
  toggle.setAttribute('aria-controls', 'mobile-controls-layer');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.innerHTML = '<span></span><span></span><span></span>';

  const layer = document.createElement('div');
  layer.className = 'mobile-controls-layer';
  layer.id = 'mobile-controls-layer';
  layer.hidden = true;
  layer.inert = true;
  layer.setAttribute('aria-hidden', 'true');
  layer.innerHTML = `
    <section class="mobile-controls-panel" role="dialog" aria-modal="false" aria-labelledby="mobile-controls-title">
      <header>
        <h2 id="mobile-controls-title">Controlli visita</h2>
        <button class="icon-action" type="button" data-mobile-controls-action="close" aria-label="Chiudi">
          <span aria-hidden="true">x</span>
        </button>
      </header>
      <div class="mobile-controls-actions"></div>
      <div class="mobile-controls-content">
        <button class="mobile-exit-fullscreen" type="button" data-mobile-controls-action="exit-fullscreen" hidden>
          Esci da schermo intero
        </button>
        <button class="mobile-orientation-reset" type="button" data-mobile-controls-action="reset">
          Reimposta orientamento
        </button>
      </div>
      <footer>
        <button type="button" data-mobile-controls-action="close">Chiudi</button>
      </footer>
    </section>
  `;

  return {
    toggle,
    layer,
    panel: layer.querySelector('.mobile-controls-panel'),
    actions: layer.querySelector('.mobile-controls-actions'),
    content: layer.querySelector('.mobile-controls-content'),
    closeIcon: layer.querySelector('header [data-mobile-controls-action="close"]'),
    exitFullscreen: layer.querySelector('[data-mobile-controls-action="exit-fullscreen"]'),
    resetOrientation: layer.querySelector('[data-mobile-controls-action="reset"]'),
  };
}
