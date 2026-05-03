import { useCallback, useState } from 'react';
import { useReopenCreateOnCapture } from '@/features/capture/useAutoOpenOnCapture';

export interface BinCreateFromCaptureState {
  createOpen: boolean;
  setCreateOpen: (v: boolean) => void;
  createInitialPhotos: File[] | null;
  createInitialGroups: number[] | null;
  onCreateInitialPhotosConsumed: () => void;
}

export function useBinCreateFromCapture(): BinCreateFromCaptureState {
  const [createOpen, setCreateOpenRaw] = useState(false);
  const [createInitialPhotos, setCreateInitialPhotos] = useState<File[] | null>(null);
  const [createInitialGroups, setCreateInitialGroups] = useState<number[] | null>(null);

  useReopenCreateOnCapture(useCallback((photos: File[], groups: number[] | null) => {
    setCreateInitialPhotos(photos.length > 0 ? photos : null);
    setCreateInitialGroups(groups);
    setCreateOpenRaw(true);
  }, []));

  const setCreateOpen = useCallback((v: boolean) => {
    if (!v) {
      setCreateInitialPhotos(null);
      setCreateInitialGroups(null);
    }
    setCreateOpenRaw(v);
  }, []);

  const onCreateInitialPhotosConsumed = useCallback(() => {
    setCreateInitialPhotos(null);
    setCreateInitialGroups(null);
  }, []);

  return { createOpen, setCreateOpen, createInitialPhotos, createInitialGroups, onCreateInitialPhotosConsumed };
}
