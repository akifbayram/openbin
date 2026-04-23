import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { getCapturedReturnTarget, hasCapturedPhotos, takeCapturedPhotos } from './capturedPhotos';

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

/** Reopen the bin-create dialog when returning from camera capture, seeding any captured photos. */
export function useReopenCreateOnCapture(
  onReopen: (photos: File[]) => void,
): void {
  const { pathname } = useLocation();
  useEffect(() => {
    if (getCapturedReturnTarget() !== 'bin-create') return;
    const { files } = takeCapturedPhotos();
    onReopen(files);
  // biome-ignore lint/correctness/useExhaustiveDependencies: pathname triggers re-check on navigation back from camera
  }, [onReopen, pathname]);
}
