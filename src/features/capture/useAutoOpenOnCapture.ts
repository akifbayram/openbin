import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { getCapturedReturnTarget, takeCapturedPhotos } from './capturedPhotos';

/** Reopen the bin-create dialog when returning from camera capture, seeding any captured photos. */
export function useReopenCreateOnCapture(
  onReopen: (files: File[], groups: number[] | null) => void,
): void {
  const { pathname } = useLocation();
  useEffect(() => {
    if (getCapturedReturnTarget() !== 'bin-create') return;
    const { files, groups } = takeCapturedPhotos();
    onReopen(files, groups);
  // biome-ignore lint/correctness/useExhaustiveDependencies: pathname triggers re-check on navigation back from camera
  }, [onReopen, pathname]);
}
