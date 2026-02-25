import { useEffect } from 'react';

const focusableSelector =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

interface UseFocusTrapOptions {
  active: boolean;
  containerRef: React.RefObject<HTMLElement | null>;
}

export function useFocusTrap({ active, containerRef }: UseFocusTrapOptions) {
  useEffect(() => {
    if (!active || !containerRef.current) return;
    const el = containerRef.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const firstFocusable = el.querySelector<HTMLElement>(focusableSelector);
    firstFocusable?.focus();

    function trapFocus(e: KeyboardEvent) {
      if (e.key !== 'Tab') return;
      const focusables = el.querySelectorAll<HTMLElement>(focusableSelector);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', trapFocus);
    return () => {
      document.removeEventListener('keydown', trapFocus);
      previouslyFocused?.focus();
    };
  }, [active, containerRef]);
}
