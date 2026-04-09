import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { getCapturedReturnTarget, hasCapturedPhotos, setCapturedReturnTarget } from './capturedPhotos';

/** Auto-open the AI command dialog when returning from camera capture with pending photos. */
export function useAutoOpenOnCapture(
  aiEnabled: boolean,
  setCommandOpen: (v: boolean) => void,
): void {
  const { pathname } = useLocation();
  useEffect(() => {
    if (aiEnabled && hasCapturedPhotos() && getCapturedReturnTarget() !== 'bin-create') {
      setCommandOpen(true);
    }
  // biome-ignore lint/correctness/useExhaustiveDependencies: pathname triggers re-check on navigation back from camera
  }, [aiEnabled, setCommandOpen, pathname]);
}

/** Auto-open the bin create dialog when returning from camera capture (even if cancelled with no photos). */
export function useReopenCreateOnCapture(setCreateOpen: (v: boolean) => void): void {
  const { pathname } = useLocation();
  useEffect(() => {
    if (getCapturedReturnTarget() === 'bin-create') {
      setCapturedReturnTarget(null);
      setCreateOpen(true);
    }
  // biome-ignore lint/correctness/useExhaustiveDependencies: pathname triggers re-check on navigation back from camera
  }, [setCreateOpen, pathname]);
}
