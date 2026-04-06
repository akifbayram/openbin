import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { hasCapturedPhotos } from './capturedPhotos';

/** Auto-open the AI command dialog when returning from camera capture with pending photos. */
export function useAutoOpenOnCapture(
  aiEnabled: boolean,
  setCommandOpen: (v: boolean) => void,
): void {
  const { pathname } = useLocation();
  useEffect(() => {
    if (aiEnabled && hasCapturedPhotos()) {
      setCommandOpen(true);
    }
  }, [aiEnabled, setCommandOpen, pathname]);
}
