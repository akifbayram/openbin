import { useCallback, useEffect, useRef } from 'react';

/**
 * Arrow-key navigation, Escape-to-close, and focus management for dropdown menus.
 * Attach `menuRef` and `onKeyDown` to the popup container. Add `role="menu"` for a11y.
 * Navigates all visible, non-disabled `<button>` children.
 */
export function useMenuKeyboard(isOpen: boolean, onClose: () => void) {
  const menuRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    requestAnimationFrame(() => {
      const first = menuRef.current?.querySelector<HTMLElement>('button:not(:disabled)');
      if (first && first.offsetWidth > 0) first.focus();
    });
  }, [isOpen]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const container = menuRef.current;
      if (!container) return;

      const items = Array.from(
        container.querySelectorAll<HTMLElement>('button:not(:disabled)'),
      ).filter((el) => el.offsetWidth > 0);
      const idx = items.indexOf(document.activeElement as HTMLElement);

      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault();
          items[(idx + 1) % items.length]?.focus();
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          items[(idx - 1 + items.length) % items.length]?.focus();
          break;
        }
        case 'Home': {
          e.preventDefault();
          items[0]?.focus();
          break;
        }
        case 'End': {
          e.preventDefault();
          items[items.length - 1]?.focus();
          break;
        }
        case 'Escape': {
          e.preventDefault();
          onClose();
          returnFocusRef.current?.focus();
          break;
        }
        case 'Tab': {
          onClose();
          break;
        }
      }
    },
    [onClose],
  );

  return { menuRef, onKeyDown };
}
