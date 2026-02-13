import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { Photo, ListResponse } from '@/types';

const PHOTOS_CHANGED_EVENT = 'photos-changed';

/** Notify all usePhotos instances to refetch */
export function notifyPhotosChanged() {
  window.dispatchEvent(new Event(PHOTOS_CHANGED_EVENT));
}

export function usePhotos(binId: string | undefined) {
  const { token } = useAuth();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshCounter, setRefreshCounter] = useState(0);

  useEffect(() => {
    if (!binId || !token) {
      setPhotos([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    apiFetch<ListResponse<Photo>>(`/api/photos?bin_id=${encodeURIComponent(binId)}`)
      .then((data) => {
        if (!cancelled) {
          // Sort by created_at ascending
          const sorted = [...data.results].sort((a, b) => a.created_at.localeCompare(b.created_at));
          setPhotos(sorted);
        }
      })
      .catch(() => {
        if (!cancelled) setPhotos([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [binId, token, refreshCounter]);

  // Listen for photos-changed events
  useEffect(() => {
    const handler = () => setRefreshCounter((c) => c + 1);
    window.addEventListener(PHOTOS_CHANGED_EVENT, handler);
    return () => window.removeEventListener(PHOTOS_CHANGED_EVENT, handler);
  }, []);

  const refresh = useCallback(() => setRefreshCounter((c) => c + 1), []);

  return { photos, isLoading, refresh };
}

export function getPhotoUrl(photoId: string): string {
  const token = localStorage.getItem('sanduk-token');
  return `/api/photos/${photoId}/file${token ? `?token=${encodeURIComponent(token)}` : ''}`;
}

export async function addPhoto(binId: string, file: File): Promise<string> {
  const formData = new FormData();
  formData.append('photo', file);

  const result = await apiFetch<{ id: string }>(`/api/bins/${binId}/photos`, {
    method: 'POST',
    body: formData,
  });
  notifyPhotosChanged();
  return result.id;
}

export async function deletePhoto(id: string): Promise<Photo> {
  const photo = await apiFetch<Photo>(`/api/photos/${id}`, {
    method: 'DELETE',
  });
  notifyPhotosChanged();
  return photo;
}
