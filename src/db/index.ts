import Dexie, { type Table } from 'dexie';
import type { Bin, Photo } from '@/types';

class BinDatabase extends Dexie {
  bins!: Table<Bin, string>;
  photos!: Table<Photo, string>;

  constructor() {
    super('qr-bin-inventory');
    this.version(1).stores({
      bins: 'id, name, *tags, createdAt, updatedAt',
    });
    this.version(2).stores({
      bins: 'id, name, *tags, createdAt, updatedAt',
      photos: 'id, binId, createdAt',
    });
  }
}

export const db = new BinDatabase();
