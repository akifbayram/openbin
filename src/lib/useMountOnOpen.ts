import { useRef } from 'react';

/**
 * Returns `true` once `isOpen` has been truthy at least once. Use to mount heavy
 * lazy dialogs only after first open while keeping them mounted so exit/close
 * animations can play out.
 */
export function useMountOnOpen(isOpen: boolean): boolean {
  const mounted = useRef(false);
  if (isOpen) mounted.current = true;
  return mounted.current;
}
