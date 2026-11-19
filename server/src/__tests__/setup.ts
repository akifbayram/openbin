import { afterAll, afterEach, beforeAll } from 'vitest';

// Set env vars BEFORE any app code is imported
process.env.DATABASE_PATH = ':memory:';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
// Per-worker dir: test files run in parallel and some clear their storage dirs
process.env.PHOTO_STORAGE_PATH = `/tmp/openbin-test-photos-${process.env.VITEST_POOL_ID ?? '0'}`;
// Ensure SQLite mode in tests (no DATABASE_URL)
delete process.env.DATABASE_URL;

const { initialize } = await import('../db/init.js');
const { getSqliteDb } = await import('../db/sqlite.js');

beforeAll(async () => {
  await initialize();
});

const TABLES = [
  'email_log',
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
  'attachments',
  'bin_custom_field_values',
  'bin_items',
  'bin_shares',
  'item_checkouts',
  'bins',
  'areas',
  'tag_colors',
  'location_custom_fields',
  'location_members',
  'locations',
  'users',
  'password_reset_tokens',
  'api_key_daily_usage',
  'ai_usage',
  'settings',
  'webhook_outbox',
  'webhook_jti_seen',
  'job_locks',
  'admin_audit_log',
  'user_limit_overrides',
  'login_history',
  'announcements',
  'user_oauth_links',
  'user_consents',
];

afterEach(() => {
  const db = getSqliteDb();
  db.pragma('foreign_keys = OFF');
  for (const table of TABLES) {
    db.exec(`DELETE FROM ${table}`);
  }
  db.pragma('foreign_keys = ON');
});

afterAll(async () => {
  // Shared-module workers reuse the engine for the next file; the process exit closes it.
  if (process.env.OPENBIN_TEST_SHARED_MODULES) return;
  const { closeThumbnailPool } = await import('../lib/thumbnailPool.js');
  await closeThumbnailPool();
  const { getEngine } = await import('../db/init.js');
  await getEngine().close();
});
