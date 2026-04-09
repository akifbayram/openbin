import type Database from 'better-sqlite3';
import type pg from 'pg';
import { createLogger } from '../../lib/logger.js';
import type { Migration } from './types.js';

const log = createLogger('db:migrations');

// ---------------------------------------------------------------------------
// Local helpers
// ---------------------------------------------------------------------------

/** Run an ALTER TABLE ADD COLUMN, ignoring "duplicate column" errors but re-throwing anything else. */
function addColumnIfNotExists(db: Database.Database, stmt: string): void {
  try {
    db.exec(stmt);
  } catch (err) {
    if (err instanceof Error && err.message.includes('duplicate column name')) return;
    throw err;
  }
}

/** Try to create a unique index; if duplicates exist, log, run dedupSql, then retry. */
function createUniqueIndexWithDedup(
  db: Database.Database,
  indexDdl: string,
  dedupSql: string,
  description: string,
): void {
  try {
    db.exec(indexDdl);
  } catch {
    log.warn(`0001_legacy: deduplicating rows — ${description}`);
    db.exec(dedupSql);
    db.exec(indexDdl);
  }
}

function countRows(db: Database.Database, table: string): number {
  const result = db.prepare(`SELECT COUNT(*) as n FROM ${table}`).get() as { n: number };
  return result.n;
}

// ---------------------------------------------------------------------------
// SQLite migrations
// ---------------------------------------------------------------------------

function sqliteLegacy(db: Database.Database): void {
  // AI settings columns
  const aiSettingsMigrations = [
    'temperature REAL',
    'max_tokens INTEGER',
    'top_p REAL',
    'request_timeout INTEGER',
    'reorganization_prompt TEXT',
  ];
  for (const colDef of aiSettingsMigrations) {
    addColumnIfNotExists(db, `ALTER TABLE user_ai_settings ADD COLUMN ${colDef}`);
  }

  addColumnIfNotExists(db, 'ALTER TABLE bin_items ADD COLUMN quantity INTEGER DEFAULT NULL');
  addColumnIfNotExists(db, 'ALTER TABLE user_ai_settings ADD COLUMN task_model_overrides TEXT');

  // Per-task-group AI model overrides
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_ai_task_overrides (
      id              TEXT PRIMARY KEY,
      user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      task_group      TEXT NOT NULL CHECK (task_group IN ('vision', 'quickText', 'deepText')),
      provider        TEXT CHECK (provider IN ('openai', 'anthropic', 'gemini', 'openai-compatible')),
      api_key         TEXT,
      model           TEXT,
      endpoint_url    TEXT,
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, task_group)
    );
    CREATE INDEX IF NOT EXISTS idx_user_ai_task_overrides_user ON user_ai_task_overrides(user_id);
  `);

  // Hierarchical areas: add parent_id column
  addColumnIfNotExists(db, 'ALTER TABLE areas ADD COLUMN parent_id TEXT REFERENCES areas(id) ON DELETE CASCADE');

  // Hierarchical areas: migrate UNIQUE constraint from (location_id, name) to (location_id, parent_id, name)
  {
    const areaTableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='areas'").get() as { sql: string } | undefined;
    if (areaTableInfo?.sql && !areaTableInfo.sql.includes('parent_id, name')) {
      const before = countRows(db, 'areas');
      db.exec('BEGIN');
      try {
        db.exec('DROP TABLE IF EXISTS areas_new');
        db.exec(`CREATE TABLE areas_new (
          id            TEXT PRIMARY KEY,
          location_id   TEXT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
          name          TEXT NOT NULL,
          parent_id     TEXT REFERENCES areas(id) ON DELETE CASCADE,
          created_by    TEXT REFERENCES users(id) ON DELETE SET NULL,
          created_at    TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
          UNIQUE(location_id, parent_id, name)
        )`);
        db.exec(`INSERT INTO areas_new (id, location_id, name, parent_id, created_by, created_at, updated_at)
          SELECT id, location_id, name, parent_id, created_by, created_at, updated_at FROM areas`);
        db.exec('DROP TABLE areas');
        db.exec('ALTER TABLE areas_new RENAME TO areas');
        db.exec('CREATE INDEX IF NOT EXISTS idx_areas_location_id ON areas(location_id)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_areas_parent_id ON areas(parent_id)');
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
      const after = countRows(db, 'areas');
      log.info(`0001_legacy: areas table rebuilt — ${before} rows before, ${after} rows after`);
    }
  }

  // Viewer role: add default_join_role to locations
  addColumnIfNotExists(db, "ALTER TABLE locations ADD COLUMN default_join_role TEXT NOT NULL DEFAULT 'member' CHECK (default_join_role IN ('member', 'viewer'))");

  // AI usage tracking (daily budget for demo users)
  db.exec([
    'CREATE TABLE IF NOT EXISTS ai_usage (',
    '  id         INTEGER PRIMARY KEY AUTOINCREMENT,',
    '  user_id    TEXT NOT NULL,',
    '  call_count INTEGER NOT NULL DEFAULT 1,',
    "  date       TEXT NOT NULL DEFAULT (date('now')),",
    "  created_at TEXT NOT NULL DEFAULT (datetime('now')),",
    '  UNIQUE(user_id, date)',
    ');',
    'CREATE INDEX IF NOT EXISTS idx_ai_usage_user_date ON ai_usage(user_id, date);',
  ].join('\n'));

  // Viewer role: widen location_members.role CHECK constraint to include 'viewer'
  // SQLite can't ALTER CHECK constraints, so recreate the table if the old constraint exists
  {
    const tableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='location_members'").get() as { sql: string } | undefined;
    if (tableInfo?.sql && !tableInfo.sql.includes("'viewer'")) {
      const before = countRows(db, 'location_members');
      db.exec('BEGIN');
      try {
        db.exec('DROP TABLE IF EXISTS location_members_new');
        db.exec(`CREATE TABLE location_members_new (
          id            TEXT PRIMARY KEY,
          location_id   TEXT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
          user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          role          TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member', 'viewer')),
          joined_at     TEXT NOT NULL DEFAULT (datetime('now')),
          UNIQUE(location_id, user_id)
        )`);
        db.exec('INSERT INTO location_members_new SELECT * FROM location_members');
        db.exec('DROP TABLE location_members');
        db.exec('ALTER TABLE location_members_new RENAME TO location_members');
        db.exec('CREATE INDEX IF NOT EXISTS idx_location_members_user ON location_members(user_id)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_location_members_location ON location_members(location_id)');
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
      const after = countRows(db, 'location_members');
      log.info(`0001_legacy: location_members table rebuilt — ${before} rows before, ${after} rows after`);
    }
  }

  // Cloud tier: plan and subscription columns for users
  addColumnIfNotExists(db, 'ALTER TABLE users ADD COLUMN plan INTEGER NOT NULL DEFAULT 1');
  addColumnIfNotExists(db, 'ALTER TABLE users ADD COLUMN sub_status INTEGER NOT NULL DEFAULT 1');
  addColumnIfNotExists(db, 'ALTER TABLE users ADD COLUMN active_until TEXT');
  addColumnIfNotExists(db, 'ALTER TABLE users ADD COLUMN previous_sub_status INTEGER');
  addColumnIfNotExists(db, 'ALTER TABLE users ADD COLUMN ai_credits_used INTEGER NOT NULL DEFAULT 0');
  addColumnIfNotExists(db, 'ALTER TABLE users ADD COLUMN ai_credits_reset_at TEXT');
  db.exec('CREATE INDEX IF NOT EXISTS idx_users_plan ON users(plan, sub_status)');

  // Global admin role
  addColumnIfNotExists(db, 'ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0');

  // Soft delete for users
  addColumnIfNotExists(db, 'ALTER TABLE users ADD COLUMN deleted_at TEXT');

  // Unique email (case-insensitive) — deduplicate before creating index on existing DBs
  createUniqueIndexWithDedup(
    db,
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique ON users(LOWER(email)) WHERE email IS NOT NULL',
    `UPDATE users SET email = NULL
     WHERE email IS NOT NULL
       AND rowid NOT IN (
         SELECT MAX(rowid) FROM users WHERE email IS NOT NULL GROUP BY LOWER(email)
       )`,
    'duplicate emails in users',
  );

  // Global settings key-value store (e.g. runtime registration mode override)
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Unique scan history per (user, bin) — deduplicate if needed
  createUniqueIndexWithDedup(
    db,
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_scan_history_user_bin ON scan_history(user_id, bin_id)',
    `DELETE FROM scan_history
     WHERE rowid NOT IN (
       SELECT MAX(rowid) FROM scan_history GROUP BY user_id, bin_id
     )`,
    'duplicate scan_history rows per (user_id, bin_id)',
  );

  // Bin sharing table
  db.exec(`
    CREATE TABLE IF NOT EXISTS bin_shares (
      id          TEXT PRIMARY KEY,
      bin_id      TEXT NOT NULL REFERENCES bins(id) ON DELETE CASCADE,
      token       TEXT NOT NULL UNIQUE,
      visibility  TEXT NOT NULL DEFAULT 'unlisted' CHECK (visibility IN ('public', 'unlisted')),
      created_by  TEXT REFERENCES users(id) ON DELETE SET NULL,
      view_count  INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      revoked_at  TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_bin_shares_token ON bin_shares(token) WHERE revoked_at IS NULL;
  `);
  createUniqueIndexWithDedup(
    db,
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_bin_shares_active ON bin_shares(bin_id) WHERE revoked_at IS NULL',
    `UPDATE bin_shares SET revoked_at = datetime('now')
     WHERE revoked_at IS NULL
       AND rowid NOT IN (
         SELECT MAX(rowid) FROM bin_shares WHERE revoked_at IS NULL GROUP BY bin_id
       )`,
    'multiple active shares per bin_id in bin_shares',
  );

  // API key daily usage tracking
  db.exec(`
    CREATE TABLE IF NOT EXISTS api_key_daily_usage (
      api_key_id    TEXT NOT NULL,
      date          TEXT NOT NULL DEFAULT (date('now')),
      request_count INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (api_key_id, date)
    );
  `);

  // Email deduplication log
  db.exec(`
    CREATE TABLE IF NOT EXISTS email_log (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      email_type TEXT NOT NULL,
      sent_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_email_log_dedup ON email_log(user_id, email_type, sent_at);
  `);

  // Webhook outbox for reliable Manager notifications
  db.exec(`CREATE TABLE IF NOT EXISTS webhook_outbox (
    id            TEXT PRIMARY KEY,
    endpoint      TEXT NOT NULL,
    payload_json  TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    sent_at       TEXT,
    attempts      INTEGER NOT NULL DEFAULT 0,
    last_error    TEXT,
    next_retry_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);
  db.exec('CREATE INDEX IF NOT EXISTS idx_webhook_outbox_pending ON webhook_outbox(next_retry_at) WHERE sent_at IS NULL');

  // Job locks for background job leader election
  db.exec(`CREATE TABLE IF NOT EXISTS job_locks (
    job_name   TEXT PRIMARY KEY,
    locked_by  TEXT NOT NULL,
    locked_at  TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL
  )`);

  // api_key_daily_usage: add FK on api_key_id -> api_keys(id) ON DELETE CASCADE
  // SQLite can't add FK via ALTER TABLE, so rebuild the table if FK is missing
  {
    const tableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='api_key_daily_usage'").get() as { sql: string } | undefined;
    if (tableInfo?.sql && !tableInfo.sql.includes('REFERENCES')) {
      const before = countRows(db, 'api_key_daily_usage');
      db.exec('BEGIN');
      try {
        db.exec('DELETE FROM api_key_daily_usage WHERE api_key_id NOT IN (SELECT id FROM api_keys)');
        db.exec('DROP TABLE IF EXISTS api_key_daily_usage_new');
        db.exec(`CREATE TABLE api_key_daily_usage_new (
          api_key_id    TEXT NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
          date          TEXT NOT NULL DEFAULT (date('now')),
          request_count INTEGER NOT NULL DEFAULT 1,
          PRIMARY KEY (api_key_id, date)
        )`);
        db.exec('INSERT INTO api_key_daily_usage_new SELECT * FROM api_key_daily_usage');
        db.exec('DROP TABLE api_key_daily_usage');
        db.exec('ALTER TABLE api_key_daily_usage_new RENAME TO api_key_daily_usage');
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
      const after = countRows(db, 'api_key_daily_usage');
      log.info(`0001_legacy: api_key_daily_usage table rebuilt — ${before} rows before, ${after} rows after`);
    }
  }

  // Atomic email dedup: one email per type per user per day
  createUniqueIndexWithDedup(
    db,
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_email_log_daily ON email_log(user_id, email_type, date(sent_at))',
    `DELETE FROM email_log
     WHERE rowid NOT IN (
       SELECT MAX(rowid) FROM email_log GROUP BY user_id, email_type, date(sent_at)
     )`,
    'duplicate email_log rows per (user_id, email_type, date)',
  );

  // AI credit periods (monthly billing-cycle tracking for Plus users)
  db.exec([
    'CREATE TABLE IF NOT EXISTS ai_credit_periods (',
    '  id           TEXT PRIMARY KEY,',
    '  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,',
    '  period_start TEXT NOT NULL,',
    '  period_end   TEXT NOT NULL,',
    '  credits_used INTEGER NOT NULL DEFAULT 0,',
    '  credits_limit INTEGER NOT NULL,',
    "  created_at   TEXT NOT NULL DEFAULT (datetime('now')),",
    '  UNIQUE(user_id, period_start)',
    ');',
    'CREATE INDEX IF NOT EXISTS idx_ai_credit_periods_user ON ai_credit_periods(user_id, period_start);',
  ].join('\n'));

  // Tag hierarchy: add parent_tag column to tag_colors
  addColumnIfNotExists(db, 'ALTER TABLE tag_colors ADD COLUMN parent_tag TEXT DEFAULT NULL');
  // Admin usage metrics: last_active_at on users
  addColumnIfNotExists(db, 'ALTER TABLE users ADD COLUMN last_active_at TEXT');

  // Admin panel: user suspension, session revocation, force password change
  addColumnIfNotExists(db, 'ALTER TABLE users ADD COLUMN suspended_at TEXT');
  addColumnIfNotExists(db, 'ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0');
  addColumnIfNotExists(db, 'ALTER TABLE users ADD COLUMN force_password_change INTEGER NOT NULL DEFAULT 0');

  // Admin audit log
  db.exec(`
    CREATE TABLE IF NOT EXISTS admin_audit_log (
      id          TEXT PRIMARY KEY,
      actor_id    TEXT NOT NULL,
      actor_name  TEXT NOT NULL,
      action      TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id   TEXT,
      target_name TEXT,
      details     TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created ON admin_audit_log(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_admin_audit_log_actor ON admin_audit_log(actor_id);
    CREATE INDEX IF NOT EXISTS idx_admin_audit_log_action ON admin_audit_log(action);
  `);

  // Per-user limit overrides
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_limit_overrides (
      id                       TEXT PRIMARY KEY,
      user_id                  TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      max_bins                 INTEGER,
      max_locations            INTEGER,
      max_photo_storage_mb     INTEGER,
      max_members_per_location INTEGER,
      activity_retention_days  INTEGER,
      ai_credits_per_month     INTEGER,
      ai_enabled               INTEGER,
      created_at               TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at               TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Login history
  db.exec(`
    CREATE TABLE IF NOT EXISTS login_history (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      ip_address TEXT,
      user_agent TEXT,
      method     TEXT NOT NULL DEFAULT 'password',
      success    INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_login_history_user ON login_history(user_id, created_at DESC);
  `);

  // OAuth provider links
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_oauth_links (
      id               TEXT PRIMARY KEY,
      user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider         TEXT NOT NULL,
      provider_user_id TEXT NOT NULL,
      email            TEXT,
      created_at       TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_oauth_provider_user ON user_oauth_links(provider, provider_user_id);
    CREATE INDEX IF NOT EXISTS idx_oauth_user_id ON user_oauth_links(user_id);
  `);

  // Announcement banners
  db.exec(`
    CREATE TABLE IF NOT EXISTS announcements (
      id           TEXT PRIMARY KEY,
      text         TEXT NOT NULL,
      type         TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'warning', 'critical')),
      dismissible  INTEGER NOT NULL DEFAULT 1,
      active       INTEGER NOT NULL DEFAULT 1,
      expires_at   TEXT,
      created_by   TEXT,
      created_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_announcements_active ON announcements(active) WHERE active = 1;
  `);

  // Item checkouts table
  db.exec(`
    CREATE TABLE IF NOT EXISTS item_checkouts (
      id              TEXT PRIMARY KEY,
      item_id         TEXT NOT NULL REFERENCES bin_items(id) ON DELETE CASCADE,
      origin_bin_id   TEXT NOT NULL,
      location_id     TEXT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
      checked_out_by  TEXT NOT NULL REFERENCES users(id),
      checked_out_at  TEXT NOT NULL DEFAULT (datetime('now')),
      returned_at     TEXT,
      returned_by     TEXT REFERENCES users(id),
      return_bin_id   TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_item_checkouts_active
      ON item_checkouts(location_id) WHERE returned_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_item_checkouts_item
      ON item_checkouts(item_id, returned_at);
  `);
}

// ---------------------------------------------------------------------------
// PostgreSQL migrations
// ---------------------------------------------------------------------------

async function postgresLegacy(pool: pg.Pool): Promise<void> {
  // Unique indexes (PG equivalent of SQLite dedup-then-create migrations)
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_scan_history_user_bin ON scan_history(user_id, bin_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_bin_shares_active ON bin_shares(bin_id) WHERE revoked_at IS NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_email_log_daily ON email_log(user_id, email_type, (left(sent_at, 10)));
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique ON users(LOWER(email)) WHERE email IS NOT NULL;
  `);

  // Per-task-group AI model overrides (new installs get it via schema.pg.sql; this handles existing DBs)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_ai_task_overrides (
      id              TEXT PRIMARY KEY,
      user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      task_group      TEXT NOT NULL CHECK (task_group IN ('vision', 'quickText', 'deepText')),
      provider        TEXT CHECK (provider IN ('openai', 'anthropic', 'gemini', 'openai-compatible')),
      api_key         TEXT,
      model           TEXT,
      endpoint_url    TEXT,
      created_at      TEXT NOT NULL DEFAULT (now()),
      updated_at      TEXT NOT NULL DEFAULT (now()),
      UNIQUE(user_id, task_group)
    );
    CREATE INDEX IF NOT EXISTS idx_user_ai_task_overrides_user ON user_ai_task_overrides(user_id);
  `);

  // api_key_daily_usage: add FK on api_key_id if missing
  await pool.query(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name = 'api_key_daily_usage' AND constraint_type = 'FOREIGN KEY'
      ) THEN
        DELETE FROM api_key_daily_usage WHERE api_key_id NOT IN (SELECT id FROM api_keys);
        ALTER TABLE api_key_daily_usage ADD CONSTRAINT fk_api_key_daily_usage_key
          FOREIGN KEY (api_key_id) REFERENCES api_keys(id) ON DELETE CASCADE;
      END IF;
    END $$;
  `);

  // Admin panel: user suspension, session revocation, force password change
  await pool.query(`
    DO $$ BEGIN
      ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_at TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS force_password_change BOOLEAN NOT NULL DEFAULT FALSE;
    END $$;
  `);

  // New admin tables (idempotent via IF NOT EXISTS in schema.pg.sql, but handle existing DBs)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_audit_log (
      id TEXT PRIMARY KEY, actor_id TEXT NOT NULL, actor_name TEXT NOT NULL,
      action TEXT NOT NULL, target_type TEXT NOT NULL, target_id TEXT,
      target_name TEXT, details JSONB, created_at TEXT NOT NULL DEFAULT (NOW())
    );
    CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created ON admin_audit_log(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_admin_audit_log_actor ON admin_audit_log(actor_id);
    CREATE INDEX IF NOT EXISTS idx_admin_audit_log_action ON admin_audit_log(action);

    CREATE TABLE IF NOT EXISTS user_limit_overrides (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      max_bins INTEGER, max_locations INTEGER, max_photo_storage_mb INTEGER,
      max_members_per_location INTEGER, activity_retention_days INTEGER,
      ai_credits_per_month INTEGER, ai_enabled INTEGER,
      created_at TEXT NOT NULL DEFAULT (NOW()), updated_at TEXT NOT NULL DEFAULT (NOW())
    );

    CREATE TABLE IF NOT EXISTS login_history (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      ip_address TEXT, user_agent TEXT, method TEXT NOT NULL DEFAULT 'password',
      success BOOLEAN NOT NULL DEFAULT TRUE, created_at TEXT NOT NULL DEFAULT (NOW())
    );
    CREATE INDEX IF NOT EXISTS idx_login_history_user ON login_history(user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS announcements (
      id TEXT PRIMARY KEY, text TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'warning', 'critical')),
      dismissible BOOLEAN NOT NULL DEFAULT TRUE, active BOOLEAN NOT NULL DEFAULT TRUE,
      expires_at TEXT, created_by TEXT, created_at TEXT NOT NULL DEFAULT (NOW())
    );
    CREATE INDEX IF NOT EXISTS idx_announcements_active ON announcements(active) WHERE active = TRUE;

    CREATE TABLE IF NOT EXISTS user_oauth_links (
      id               TEXT PRIMARY KEY,
      user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider         TEXT NOT NULL,
      provider_user_id TEXT NOT NULL,
      email            TEXT,
      created_at       TEXT NOT NULL DEFAULT (NOW())
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_oauth_provider_user ON user_oauth_links(provider, provider_user_id);
    CREATE INDEX IF NOT EXISTS idx_oauth_user_id ON user_oauth_links(user_id);
  `);

  // Allow null password_hash for OAuth-only users
  await pool.query('ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL');
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const legacy: Migration = {
  name: '0001_legacy',
  sqlite: sqliteLegacy,
  postgres: postgresLegacy,
};
