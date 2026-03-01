import { type ComponentType, lazy } from 'react';

const RELOAD_KEY = 'openbin-chunk-reload';

export function lazyWithRetry<T extends ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>,
) {
  return lazy(() =>
    factory().catch((error: unknown) => {
      const hasReloaded = sessionStorage.getItem(RELOAD_KEY);
      if (!hasReloaded) {
        sessionStorage.setItem(RELOAD_KEY, '1');
        window.location.reload();
        // Return a never-resolving promise so React doesn't render an error
        // while the page reloads
        return new Promise<never>(() => {});
      }
      sessionStorage.removeItem(RELOAD_KEY);
      throw error;
    }),
  );
}
