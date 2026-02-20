import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Events, notify } from '@/lib/eventBus';
import { useListData } from '@/lib/useListData';
import type { Photo } from '@/types';

/** Notify all usePhotos instances to refetch */
export const notifyPhotosChanged = () => notify(Events.PHOTOS);

const sortByCreatedAsc = (results: Photo[]) =>
  [...results].sort((a, b) => a.created_at.localeCompare(b.created_at));

export function usePhotos(binId: string | undefined) {
  const { token } = useAuth();
  const { data: photos, isLoading, refresh } = useListData<Photo>(
    binId && token ? `/api/photos?bin_id=${encodeURIComponent(binId)}` : null,
    [Events.PHOTOS],
    sortByCreatedAsc,
  );
  return { photos, isLoading, refresh };
}

export function getPhotoUrl(photoId: string): string {
  return `/api/photos/${photoId}/file`;
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
