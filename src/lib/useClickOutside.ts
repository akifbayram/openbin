import { type RefObject, useEffect } from 'react';

/** Attach a document `mousedown` listener that invokes `handler` when the click lands outside `ref`.
 *  Pass `disabled` (e.g. `!isOpen`) to skip attaching — useful for N list-rendered menus,
 *  where attaching on every closed menu wastes a listener per row. */
export function useClickOutside(ref: RefObject<Element | null>, handler: () => void, disabled?: boolean) {
  useEffect(() => {
    if (disabled) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        handler();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [ref, handler, disabled]);
}
