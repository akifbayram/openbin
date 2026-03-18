type ResizeCallback = (entry: ResizeObserverEntry) => void;

let observer: ResizeObserver | null = null;
const callbacks = new Map<Element, ResizeCallback>();

function getObserver(): ResizeObserver {
  if (!observer) {
    observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        callbacks.get(entry.target)?.(entry);
      }
    });
  }
  return observer;
}

/**
 * Observe an element for resize using a single shared ResizeObserver.
 * Returns an unsubscribe function.
 */
export function observeResize(element: Element, callback: ResizeCallback): () => void {
  callbacks.set(element, callback);
  getObserver().observe(element);
  return () => {
    callbacks.delete(element);
    getObserver().unobserve(element);
    if (callbacks.size === 0 && observer) {
      observer.disconnect();
      observer = null;
    }
  };
}
