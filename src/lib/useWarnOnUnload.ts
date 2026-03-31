import { useEffect } from 'react';

/** Warn the user before closing/navigating away when there are unsaved changes. */
export function useWarnOnUnload(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [dirty]);
}
