import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/db';
import { addBin, updateBin, deleteBin, restoreBin } from '../useBins';
import type { Bin, Photo } from '@/types';

beforeEach(async () => {
  await db.bins.clear();
  await db.photos.clear();
});

describe('addBin', () => {
  it('creates a bin with uuid, correct fields, and Date timestamps', async () => {
    const before = new Date();
    const id = await addBin({ name: 'My Bin', items: ['stuff inside'], notes: 'some notes', tags: ['electronics', 'cables'] });
    const after = new Date();

    expect(id).toBeDefined();
    // UUID v4 format
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );

    const bin = await db.bins.get(id);
    expect(bin).toBeDefined();
    expect(bin!.name).toBe('My Bin');
    expect(bin!.items).toEqual(['stuff inside']);
    expect(bin!.notes).toBe('some notes');
    expect(bin!.tags).toEqual(['electronics', 'cables']);
    expect(bin!.icon).toBe('');
    expect(bin!.color).toBe('');
    expect(bin!.createdAt).toBeInstanceOf(Date);
    expect(bin!.updatedAt).toBeInstanceOf(Date);
    expect(bin!.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(bin!.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
    expect(bin!.createdAt.getTime()).toBe(bin!.updatedAt.getTime());
  });

  it('uses default values for items, notes, and tags', async () => {
    const id = await addBin({ name: 'Minimal Bin' });
    const bin = await db.bins.get(id);
    expect(bin!.items).toEqual([]);
    expect(bin!.notes).toBe('');
    expect(bin!.tags).toEqual([]);
    expect(bin!.icon).toBe('');
    expect(bin!.color).toBe('');
  });

  it('creates a bin with icon and color', async () => {
    const id = await addBin({ name: 'Colored Bin', icon: 'Wrench', color: 'blue' });
    const bin = await db.bins.get(id);
    expect(bin!.icon).toBe('Wrench');
    expect(bin!.color).toBe('blue');
  });
});

describe('updateBin', () => {
  it('updates specified fields and sets new updatedAt', async () => {
    const id = await addBin({ name: 'Original', items: ['original item'], notes: 'original notes', tags: ['old'] });
    const binBefore = await db.bins.get(id);

    // Small delay to ensure updatedAt differs
    await new Promise((r) => setTimeout(r, 10));

    await updateBin(id, { name: 'Updated', tags: ['new'] });
    const binAfter = await db.bins.get(id);

    expect(binAfter!.name).toBe('Updated');
    expect(binAfter!.items).toEqual(['original item']); // unchanged
    expect(binAfter!.notes).toBe('original notes'); // unchanged
    expect(binAfter!.tags).toEqual(['new']);
    expect(binAfter!.updatedAt.getTime()).toBeGreaterThan(
      binBefore!.updatedAt.getTime()
    );
  });

  it('updates icon and color', async () => {
    const id = await addBin({ name: 'Icon Bin' });
    await updateBin(id, { icon: 'Wrench', color: 'red' });
    const bin = await db.bins.get(id);
    expect(bin!.icon).toBe('Wrench');
    expect(bin!.color).toBe('red');
  });
});

describe('deleteBin', () => {
  it('removes bin AND its photos transactionally', async () => {
    const id = await addBin({ name: 'Doomed Bin' });
    // Add photos for this bin
    await db.photos.add({
      id: 'photo-a',
      binId: id,
      data: new Blob(['a']),
      filename: 'a.jpg',
      mimeType: 'image/jpeg',
      size: 1,
      createdAt: new Date(),
    });
    await db.photos.add({
      id: 'photo-b',
      binId: id,
      data: new Blob(['b']),
      filename: 'b.jpg',
      mimeType: 'image/jpeg',
      size: 1,
      createdAt: new Date(),
    });

    await deleteBin(id);

    const bin = await db.bins.get(id);
    expect(bin).toBeUndefined();

    const photos = await db.photos.where('binId').equals(id).toArray();
    expect(photos).toHaveLength(0);
  });
});

describe('restoreBin', () => {
  it('re-adds bin and optionally photos', async () => {
    const bin: Bin = {
      id: 'restored-bin',
      name: 'Restored',
      location: '',
      items: ['restored item'],
      notes: 'restored notes',
      tags: ['restored'],
      icon: '',
      color: '',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const photos: Photo[] = [
      {
        id: 'restored-photo',
        binId: 'restored-bin',
        data: new Blob(['photo data']),
        filename: 'photo.jpg',
        mimeType: 'image/jpeg',
        size: 10,
        createdAt: new Date(),
      },
    ];

    await restoreBin(bin, photos);

    const restoredBin = await db.bins.get('restored-bin');
    expect(restoredBin).toBeDefined();
    expect(restoredBin!.name).toBe('Restored');

    const restoredPhotos = await db.photos
      .where('binId')
      .equals('restored-bin')
      .toArray();
    expect(restoredPhotos).toHaveLength(1);
    expect(restoredPhotos[0].filename).toBe('photo.jpg');
  });

  it('restores bin without photos when none provided', async () => {
    const bin: Bin = {
      id: 'bin-no-photos',
      name: 'No Photos',
      location: '',
      items: [],
      notes: '',
      tags: [],
      icon: '',
      color: '',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await restoreBin(bin);

    const restoredBin = await db.bins.get('bin-no-photos');
    expect(restoredBin).toBeDefined();
    expect(restoredBin!.name).toBe('No Photos');
  });
});
