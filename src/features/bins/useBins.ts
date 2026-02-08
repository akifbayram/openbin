import { useLiveQuery } from 'dexie-react-hooks';
import { v4 as uuidv4 } from 'uuid';
import { db } from '@/db';
import type { Bin, Photo } from '@/types';

export type SortOption = 'updated' | 'created' | 'name';

export function useBinList(searchQuery?: string, sort: SortOption = 'updated') {
  return useLiveQuery(async () => {
    let bins: Bin[];

    if (sort === 'name') {
      bins = await db.bins.orderBy('name').toArray();
    } else if (sort === 'created') {
      bins = await db.bins.orderBy('createdAt').reverse().toArray();
    } else {
      bins = await db.bins.orderBy('updatedAt').reverse().toArray();
    }

    if (searchQuery && searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      bins = bins.filter(
        (bin) =>
          bin.name.toLowerCase().includes(q) ||
          bin.location.toLowerCase().includes(q) ||
          bin.items.some((item) => item.toLowerCase().includes(q)) ||
          bin.notes.toLowerCase().includes(q) ||
          bin.tags.some((tag) => tag.toLowerCase().includes(q))
      );
    }
    return bins;
  }, [searchQuery, sort]);
}

export function useBin(id: string | undefined) {
  return useLiveQuery(async () => {
    if (!id) return undefined;
    return db.bins.get(id);
  }, [id]);
}

export interface AddBinOptions {
  name: string;
  items?: string[];
  notes?: string;
  tags?: string[];
  location?: string;
  icon?: string;
  color?: string;
}

export async function addBin(options: AddBinOptions): Promise<string> {
  const id = uuidv4();
  const now = new Date();
  await db.bins.add({
    id,
    name: options.name,
    location: options.location ?? '',
    items: options.items ?? [],
    notes: options.notes ?? '',
    tags: options.tags ?? [],
    icon: options.icon ?? '',
    color: options.color ?? '',
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

export async function updateBin(
  id: string,
  changes: Partial<Pick<Bin, 'name' | 'location' | 'items' | 'notes' | 'tags' | 'icon' | 'color'>>
): Promise<void> {
  await db.bins.update(id, {
    ...changes,
    updatedAt: new Date(),
  });
}

export async function deleteBin(id: string): Promise<void> {
  await db.transaction('rw', [db.bins, db.photos], async () => {
    await db.photos.where('binId').equals(id).delete();
    await db.bins.delete(id);
  });
}

/** Re-add a bin (and optionally its photos) for undo. */
export async function restoreBin(bin: Bin, photos?: Photo[]): Promise<void> {
  await db.transaction('rw', [db.bins, db.photos], async () => {
    await db.bins.add(bin);
    if (photos?.length) {
      await db.photos.bulkAdd(photos);
    }
  });
}
