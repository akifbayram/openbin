import { useCallback, useMemo, useState } from 'react';
import type { CapturedPhoto } from './useCapture';
import { useCapture } from './useCapture';

export interface CaptureGroup {
  id: number;
  photos: CapturedPhoto[];
}

export function useCaptureGrouping(binId?: string) {
  const baseCapture = useCapture(binId);
  const [currentGroup, setCurrentGroup] = useState(0);

  const capture = useCallback(() => {
    baseCapture.capture(currentGroup);
  }, [baseCapture.capture, currentGroup]);

  const importFiles = useCallback(
    (files: File[]) => {
      for (const file of files) {
        baseCapture.appendImportedPhoto(file, currentGroup);
      }
    },
    [baseCapture.appendImportedPhoto, currentGroup],
  );

  const nextGroup = useCallback(() => {
    setCurrentGroup((g) => g + 1);
  }, []);

  const photosInCurrentGroup = useMemo(
    () => baseCapture.photos.filter((p) => p.groupId === currentGroup).length,
    [baseCapture.photos, currentGroup],
  );

  const groups = useMemo<CaptureGroup[]>(() => {
    const order: number[] = [];
    const buckets = new Map<number, CapturedPhoto[]>();
    for (const photo of baseCapture.photos) {
      if (photo.groupId === undefined) continue;
      let bucket = buckets.get(photo.groupId);
      if (!bucket) {
        bucket = [];
        buckets.set(photo.groupId, bucket);
        order.push(photo.groupId);
      }
      bucket.push(photo);
    }
    return order.map((id) => ({ id, photos: buckets.get(id) ?? [] }));
  }, [baseCapture.photos]);

  return {
    videoRef: baseCapture.videoRef,
    isStreaming: baseCapture.isStreaming,
    error: baseCapture.error,
    photos: baseCapture.photos,
    startCamera: baseCapture.startCamera,
    cleanup: baseCapture.cleanup,
    removePhoto: baseCapture.removePhoto,
    capture,
    currentGroup,
    nextGroup,
    photosInCurrentGroup,
    groups,
    importFiles,
  };
}
