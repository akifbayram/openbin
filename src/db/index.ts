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
    this.version(3).stores({
      bins: 'id, name, *tags, createdAt, updatedAt',
      photos: 'id, binId, createdAt',
    }).upgrade((tx) => {
      return tx.table('bins').toCollection().modify((bin) => {
        const contents: string = (bin as Record<string, unknown>).contents as string ?? '';
        bin.items = contents.split('\n').map((s: string) => s.trim()).filter(Boolean);
        bin.notes = '';
        delete (bin as Record<string, unknown>).contents;
      });
    });
    this.version(4).stores({
      bins: 'id, name, *tags, createdAt, updatedAt',
      photos: 'id, binId, createdAt',
    }).upgrade((tx) => {
      return tx.table('bins').toCollection().modify((bin) => {
        bin.location = '';
      });
    });
    this.version(5).stores({
      bins: 'id, name, *tags, createdAt, updatedAt',
      photos: 'id, binId, createdAt',
    }).upgrade((tx) => {
      return tx.table('bins').toCollection().modify((bin) => {
        bin.icon = '';
        bin.color = '';
      });
    });
  }
}

export const db = new BinDatabase();
