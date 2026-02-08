import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/db';
import {
  addPhoto,
  deletePhoto,
  restorePhoto,
  deletePhotosForBin,
  getPhotosForBin,
} from '../usePhotos';
import type { Photo } from '@/types';

async function createTestBin(id = 'test-bin') {
  await db.bins.add({
    id,
    name: 'Test Bin',
    location: '',
    items: [],
    notes: '',
    tags: [],
    icon: '',
    color: '',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return id;
}

beforeEach(async () => {
  await db.bins.clear();
  await db.photos.clear();
});

describe('addPhoto', () => {
  it('adds photo with uuid and updates bin.updatedAt', async () => {
    const binId = await createTestBin();
    const binBefore = await db.bins.get(binId);

    await new Promise((r) => setTimeout(r, 10));

    const blob = new Blob(['image data'], { type: 'image/jpeg' });
    const photoId = await addPhoto(binId, blob, 'test.jpg');

    expect(photoId).toBeDefined();
    expect(photoId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );

    const photo = await db.photos.get(photoId);
    expect(photo).toBeDefined();
    expect(photo!.binId).toBe(binId);
    expect(photo!.filename).toBe('test.jpg');
    expect(photo!.mimeType).toBe('image/jpeg');
    expect(photo!.size).toBe(blob.size);
    expect(photo!.createdAt).toBeInstanceOf(Date);

    const binAfter = await db.bins.get(binId);
    expect(binAfter!.updatedAt.getTime()).toBeGreaterThan(
      binBefore!.updatedAt.getTime()
    );
  });

  it('throws error for oversized blob (> 5MB)', async () => {
    const binId = await createTestBin();
    const content = 'x';
    const blob = new Blob([content], { type: 'image/jpeg' });
    Object.defineProperty(blob, 'size', { value: 6 * 1024 * 1024 });

    await expect(addPhoto(binId, blob, 'big.jpg')).rejects.toThrow(
      'Photo exceeds 5 MB limit'
    );
  });
});

describe('deletePhoto', () => {
  it('removes photo, returns snapshot, and updates bin.updatedAt', async () => {
    const binId = await createTestBin();
    const blob = new Blob(['image'], { type: 'image/png' });
    const photoId = await addPhoto(binId, blob, 'img.png');

    const binBefore = await db.bins.get(binId);
    await new Promise((r) => setTimeout(r, 10));

    const snapshot = await deletePhoto(photoId);

    expect(snapshot).toBeDefined();
    expect(snapshot!.id).toBe(photoId);
    expect(snapshot!.filename).toBe('img.png');

    const deleted = await db.photos.get(photoId);
    expect(deleted).toBeUndefined();

    const binAfter = await db.bins.get(binId);
    expect(binAfter!.updatedAt.getTime()).toBeGreaterThan(
      binBefore!.updatedAt.getTime()
    );
  });
});

describe('restorePhoto', () => {
  it('re-adds photo and updates bin.updatedAt', async () => {
    const binId = await createTestBin();
    const photo: Photo = {
      id: 'restored-photo',
      binId,
      data: new Blob(['photo data']),
      filename: 'restored.jpg',
      mimeType: 'image/jpeg',
      size: 10,
      createdAt: new Date(),
    };

    const binBefore = await db.bins.get(binId);
    await new Promise((r) => setTimeout(r, 10));

    await restorePhoto(photo);

    const restored = await db.photos.get('restored-photo');
    expect(restored).toBeDefined();
    expect(restored!.filename).toBe('restored.jpg');

    const binAfter = await db.bins.get(binId);
    expect(binAfter!.updatedAt.getTime()).toBeGreaterThan(
      binBefore!.updatedAt.getTime()
    );
  });
});

describe('deletePhotosForBin', () => {
  it('removes all photos for a bin', async () => {
    const binId = await createTestBin();
    const blob = new Blob(['img'], { type: 'image/jpeg' });
    await addPhoto(binId, blob, 'a.jpg');
    await addPhoto(binId, blob, 'b.jpg');

    const photosBefore = await getPhotosForBin(binId);
    expect(photosBefore).toHaveLength(2);

    await deletePhotosForBin(binId);

    const photosAfter = await getPhotosForBin(binId);
    expect(photosAfter).toHaveLength(0);
  });
});

describe('getPhotosForBin', () => {
  it('returns photos for a given bin', async () => {
    const binId1 = await createTestBin('bin-1');
    const binId2 = await createTestBin('bin-2');

    const blob = new Blob(['img'], { type: 'image/jpeg' });
    await addPhoto(binId1, blob, 'photo1.jpg');
    await addPhoto(binId1, blob, 'photo2.jpg');
    await addPhoto(binId2, blob, 'photo3.jpg');

    const photos1 = await getPhotosForBin(binId1);
    expect(photos1).toHaveLength(2);
    expect(photos1.every((p) => p.binId === binId1)).toBe(true);

    const photos2 = await getPhotosForBin(binId2);
    expect(photos2).toHaveLength(1);
    expect(photos2[0].binId).toBe(binId2);
  });
});
