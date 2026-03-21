import { useEffect } from 'react';
import { hasCapturedPhotos } from './capturedPhotos';

/** Auto-open the AI command dialog when returning from camera capture with pending photos. */
export function useAutoOpenOnCapture(
  aiEnabled: boolean,
  setCommandOpen: (v: boolean) => void,
): void {
  useEffect(() => {
    if (aiEnabled && hasCapturedPhotos()) {
      setCommandOpen(true);
    }
  }, [aiEnabled, setCommandOpen]);
}
