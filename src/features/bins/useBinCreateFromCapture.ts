import { useCallback, useState } from 'react';
import { useReopenCreateOnCapture } from '@/features/capture/useAutoOpenOnCapture';

export interface BinCreateFromCaptureState {
  createOpen: boolean;
  setCreateOpen: (v: boolean) => void;
  createInitialPhotos: File[] | null;
  onCreateInitialPhotosConsumed: () => void;
}

export function useBinCreateFromCapture(): BinCreateFromCaptureState {
  const [createOpen, setCreateOpenRaw] = useState(false);
  const [createInitialPhotos, setCreateInitialPhotos] = useState<File[] | null>(null);

  useReopenCreateOnCapture(useCallback((photos: File[]) => {
    setCreateInitialPhotos(photos.length > 0 ? photos : null);
    setCreateOpenRaw(true);
  }, []));

  const setCreateOpen = useCallback((v: boolean) => {
    if (!v) setCreateInitialPhotos(null);
    setCreateOpenRaw(v);
  }, []);

  const onCreateInitialPhotosConsumed = useCallback(() => {
    setCreateInitialPhotos(null);
  }, []);

  return { createOpen, setCreateOpen, createInitialPhotos, onCreateInitialPhotosConsumed };
}
