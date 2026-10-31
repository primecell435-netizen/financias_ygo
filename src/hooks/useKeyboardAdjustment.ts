import { useEffect } from 'react';

/**
 * useKeyboardAdjustment
 * Automatically scrolls focused input elements into view when the mobile virtual keyboard opens,
 * ensuring the input and typed text are never obscured behind the keyboard.
 */
export function useKeyboardAdjustment() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      const tagName = target.tagName?.toLowerCase();
      const isInput = tagName === 'input' || tagName === 'textarea' || tagName === 'select';
      if (!isInput) return;

      // Small delay to allow the mobile virtual keyboard to pop up and adjust viewport
      setTimeout(() => {
        try {
          target.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'nearest',
          });
        } catch {
          // Fallback if options not supported
          target.scrollIntoView(false);
        }
      }, 300);
    };

    // Also monitor VisualViewport resize for accurate keyboard detection on Android/iOS
    const visualViewport = window.visualViewport;
    const handleViewportResize = () => {
      const activeEl = document.activeElement as HTMLElement | null;
      if (!activeEl) return;

      const tagName = activeEl.tagName?.toLowerCase();
      if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
        setTimeout(() => {
          try {
            activeEl.scrollIntoView({
              behavior: 'smooth',
              block: 'center',
              inline: 'nearest',
            });
          } catch {
            activeEl.scrollIntoView(false);
          }
        }, 150);
      }
    };

    window.addEventListener('focusin', handleFocusIn, { passive: true });
    if (visualViewport) {
      visualViewport.addEventListener('resize', handleViewportResize, { passive: true });
    }

    return () => {
      window.removeEventListener('focusin', handleFocusIn);
      if (visualViewport) {
        visualViewport.removeEventListener('resize', handleViewportResize);
      }
    };
  }, []);
}
