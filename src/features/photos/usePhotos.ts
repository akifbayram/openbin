import { useLiveQuery } from 'dexie-react-hooks';
import { v4 as uuidv4 } from 'uuid';
import { db } from '@/db';
import type { Photo } from '@/types';

const MAX_PHOTO_SIZE = 5 * 1024 * 1024; // 5 MB

export function usePhotos(binId: string | undefined) {
  return useLiveQuery(async () => {
    if (!binId) return [];
    return db.photos.where('binId').equals(binId).sortBy('createdAt');
  }, [binId]);
}

export async function addPhoto(
  binId: string,
  data: Blob,
  filename: string
): Promise<string> {
  if (data.size > MAX_PHOTO_SIZE) {
    throw new Error('Photo exceeds 5 MB limit');
  }
  const id = uuidv4();
  await db.transaction('rw', [db.photos, db.bins], async () => {
    await db.photos.add({
      id,
      binId,
      data,
      filename,
      mimeType: data.type,
      size: data.size,
      createdAt: new Date(),
    });
    await db.bins.update(binId, { updatedAt: new Date() });
  });
  return id;
}

export async function deletePhoto(id: string): Promise<Photo | undefined> {
  let snapshot: Photo | undefined;
  await db.transaction('rw', [db.photos, db.bins], async () => {
    snapshot = await db.photos.get(id);
    if (!snapshot) return;
    await db.photos.delete(id);
    await db.bins.update(snapshot.binId, { updatedAt: new Date() });
  });
  return snapshot;
}

export async function restorePhoto(photo: Photo): Promise<void> {
  await db.transaction('rw', [db.photos, db.bins], async () => {
    await db.photos.add(photo);
    await db.bins.update(photo.binId, { updatedAt: new Date() });
  });
}

export async function deletePhotosForBin(binId: string): Promise<void> {
  await db.photos.where('binId').equals(binId).delete();
}

export async function getPhotosForBin(binId: string): Promise<Photo[]> {
  return db.photos.where('binId').equals(binId).toArray();
}
