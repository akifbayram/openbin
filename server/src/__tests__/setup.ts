import { beforeAll, afterEach, afterAll } from 'vitest';

// Set env vars BEFORE any app code is imported
process.env.DATABASE_PATH = ':memory:';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
process.env.PHOTO_STORAGE_PATH = '/tmp/openbin-test-photos';

// Now import db (triggers DB creation with :memory: and runs schema.sql)
const { getDb } = await import('../db.js');

beforeAll(() => {
  // Schema already applied by db.ts on import
  getDb();
});

const TABLES = [
  'refresh_tokens',
  'scan_history',
  'saved_views',
  'user_preferences',
  'user_print_settings',
  'user_ai_settings',
  'api_keys',
  'pinned_bins',
  'activity_log',
  'photos',
  'bin_items',
  'bins',
  'areas',
  'tag_colors',
  'location_members',
  'locations',
  'users',
];

afterEach(() => {
  const db = getDb();
  db.pragma('foreign_keys = OFF');
  for (const table of TABLES) {
    db.exec(`DELETE FROM ${table}`);
  }
  db.pragma('foreign_keys = ON');
});

afterAll(() => {
  const db = getDb();
  db.close();
});
