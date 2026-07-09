const MOBILE_QUERY = '(max-width: 760px)';
const INACTIVITY_DELAY = 3000;

export function createMobileControlsAutoHide({ interactionElement }) {
  const mediaQuery = window.matchMedia(MOBILE_QUERY);
  let hideTimer = null;

  const clearTimer = () => {
    window.clearTimeout(hideTimer);
    hideTimer = null;
  };

  const showControls = () => {
    document.body.classList.remove('are-mobile-controls-hidden');
    clearTimer();
    if (mediaQuery.matches && document.visibilityState !== 'hidden') {
      hideTimer = window.setTimeout(() => {
        document.body.classList.add('are-mobile-controls-hidden');
      }, INACTIVITY_DELAY);
    }
  };

  const handleBreakpointChange = () => {
    if (mediaQuery.matches) {
      showControls();
    } else {
      clearTimer();
      document.body.classList.remove('are-mobile-controls-hidden');
    }
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      showControls();
    } else {
      clearTimer();
    }
  };

  interactionElement.addEventListener('pointerdown', showControls, { passive: true });
  interactionElement.addEventListener('touchstart', showControls, { passive: true });
  mediaQuery.addEventListener('change', handleBreakpointChange);
  document.addEventListener('visibilitychange', handleVisibilityChange);
  showControls();

  return {
    show: showControls,
    destroy() {
      clearTimer();
      document.body.classList.remove('are-mobile-controls-hidden');
      interactionElement.removeEventListener('pointerdown', showControls);
      interactionElement.removeEventListener('touchstart', showControls);
      mediaQuery.removeEventListener('change', handleBreakpointChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    },
  };
}
