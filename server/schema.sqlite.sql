CREATE TABLE IF NOT EXISTS users (
  id                 TEXT PRIMARY KEY,
  username           TEXT UNIQUE NOT NULL,
  password_hash      TEXT NOT NULL,
  display_name       TEXT NOT NULL DEFAULT '',
  email              TEXT,
  avatar_path        TEXT,
  active_location_id TEXT REFERENCES locations(id) ON DELETE SET NULL,
  plan               INTEGER NOT NULL DEFAULT 1,
  sub_status         INTEGER NOT NULL DEFAULT 1,
  active_until       TEXT,
  previous_sub_status INTEGER,
  ai_credits_used    INTEGER NOT NULL DEFAULT 0,
  ai_credits_reset_at TEXT,
  last_active_at TEXT,
  is_admin           INTEGER NOT NULL DEFAULT 0,
  deleted_at         TEXT,
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS locations (
  id                      TEXT PRIMARY KEY,
  name                    TEXT NOT NULL,
  created_by              TEXT REFERENCES users(id) ON DELETE SET NULL,
  invite_code             TEXT UNIQUE NOT NULL,
  activity_retention_days INTEGER NOT NULL DEFAULT 90 CHECK (activity_retention_days BETWEEN 7 AND 365),
  trash_retention_days    INTEGER NOT NULL DEFAULT 30 CHECK (trash_retention_days BETWEEN 7 AND 365),
  app_name                TEXT NOT NULL DEFAULT 'OpenBin',
  term_bin                TEXT NOT NULL DEFAULT '',
  term_location           TEXT NOT NULL DEFAULT '',
  term_area               TEXT NOT NULL DEFAULT '',
  default_join_role       TEXT NOT NULL DEFAULT 'member' CHECK (default_join_role IN ('member', 'viewer')),
  created_at              TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at              TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS location_members (
  id            TEXT PRIMARY KEY,
  location_id   TEXT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role          TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member', 'viewer')),
  joined_at     TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(location_id, user_id)
);

CREATE TABLE IF NOT EXISTS areas (
  id            TEXT PRIMARY KEY,
  location_id   TEXT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  parent_id     TEXT REFERENCES areas(id) ON DELETE CASCADE,
  created_by    TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(location_id, parent_id, name)
);
CREATE INDEX IF NOT EXISTS idx_areas_location_id ON areas(location_id);
CREATE INDEX IF NOT EXISTS idx_areas_parent_id ON areas(parent_id);

CREATE TABLE IF NOT EXISTS bins (
  id            TEXT PRIMARY KEY,
  short_code    TEXT NOT NULL,
  location_id   TEXT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  area_id       TEXT REFERENCES areas(id) ON DELETE SET NULL,
  notes         TEXT NOT NULL DEFAULT '',
  tags          TEXT NOT NULL DEFAULT '[]',
  icon          TEXT NOT NULL DEFAULT '',
  color         TEXT NOT NULL DEFAULT '',
  card_style    TEXT NOT NULL DEFAULT '',
  visibility    TEXT NOT NULL DEFAULT 'location' CHECK (visibility IN ('location', 'private')),
  created_by    TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at    TEXT
);

CREATE TABLE IF NOT EXISTS bin_items (
  id         TEXT PRIMARY KEY,
  bin_id     TEXT NOT NULL REFERENCES bins(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  quantity   INTEGER DEFAULT NULL,
  position   INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_bin_items_bin_id ON bin_items(bin_id, position);

CREATE TABLE IF NOT EXISTS photos (
  id            TEXT PRIMARY KEY,
  bin_id        TEXT NOT NULL REFERENCES bins(id) ON DELETE CASCADE,
  filename      TEXT NOT NULL,
  mime_type     TEXT NOT NULL,
  size          INTEGER NOT NULL,
  storage_path  TEXT NOT NULL,
  thumb_path    TEXT,
  created_by    TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tag_colors (
  id            TEXT PRIMARY KEY,
  location_id   TEXT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  tag           TEXT NOT NULL,
  color         TEXT NOT NULL,
  parent_tag    TEXT DEFAULT NULL,
  created_at    TEXT DEFAULT (datetime('now')),
  updated_at    TEXT DEFAULT (datetime('now')),
  UNIQUE(location_id, tag)
);

CREATE TABLE IF NOT EXISTS user_ai_settings (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider        TEXT NOT NULL CHECK (provider IN ('openai', 'anthropic', 'gemini', 'openai-compatible')),
  api_key         TEXT NOT NULL,
  model           TEXT NOT NULL,
  endpoint_url    TEXT,
  custom_prompt   TEXT,
  command_prompt  TEXT,
  query_prompt    TEXT,
  structure_prompt TEXT,
  reorganization_prompt TEXT,
  temperature     REAL,
  max_tokens      INTEGER,
  top_p           REAL,
  request_timeout INTEGER,
  task_model_overrides TEXT,
  is_active       INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, provider)
);
CREATE INDEX IF NOT EXISTS idx_user_ai_settings_user ON user_ai_settings(user_id);

CREATE TABLE IF NOT EXISTS user_print_settings (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  settings   TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_user_print_settings_user ON user_print_settings(user_id);

CREATE TABLE IF NOT EXISTS activity_log (
  id          TEXT PRIMARY KEY,
  location_id TEXT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  user_id     TEXT REFERENCES users(id) ON DELETE SET NULL,
  user_name   TEXT NOT NULL,
  action      TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   TEXT,
  entity_name TEXT,
  changes     TEXT,
  auth_method TEXT,
  api_key_id  TEXT REFERENCES api_keys(id) ON DELETE SET NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_activity_log_location ON activity_log(location_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_entity ON activity_log(entity_type, entity_id);

CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_used_at TEXT,
  revoked_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);

CREATE TABLE IF NOT EXISTS pinned_bins (
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bin_id     TEXT NOT NULL REFERENCES bins(id) ON DELETE CASCADE,
  position   INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, bin_id)
);
CREATE INDEX IF NOT EXISTS idx_pinned_bins_user ON pinned_bins(user_id, position);

CREATE TABLE IF NOT EXISTS user_preferences (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  settings   TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_user_preferences_user ON user_preferences(user_id);

CREATE TABLE IF NOT EXISTS saved_views (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  search_query  TEXT NOT NULL DEFAULT '',
  sort          TEXT NOT NULL DEFAULT 'updated',
  filters       TEXT NOT NULL DEFAULT '{}',
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_saved_views_user ON saved_views(user_id);

CREATE TABLE IF NOT EXISTS scan_history (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bin_id     TEXT NOT NULL REFERENCES bins(id) ON DELETE CASCADE,
  scanned_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_scan_history_user ON scan_history(user_id, scanned_at DESC);
-- idx_scan_history_user_bin created in db.ts migration (needs dedup handling for existing DBs)

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  family_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family ON refresh_tokens(family_id);

CREATE TABLE IF NOT EXISTS location_custom_fields (
  id          TEXT PRIMARY KEY,
  location_id TEXT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  position    INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(location_id, name)
);
CREATE INDEX IF NOT EXISTS idx_location_custom_fields_loc
  ON location_custom_fields(location_id, position);

CREATE TABLE IF NOT EXISTS bin_custom_field_values (
  id         TEXT PRIMARY KEY,
  bin_id     TEXT NOT NULL REFERENCES bins(id) ON DELETE CASCADE,
  field_id   TEXT NOT NULL REFERENCES location_custom_fields(id) ON DELETE CASCADE,
  value      TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(bin_id, field_id)
);
CREATE INDEX IF NOT EXISTS idx_bin_cfv_bin ON bin_custom_field_values(bin_id);
CREATE INDEX IF NOT EXISTS idx_bin_cfv_field ON bin_custom_field_values(field_id);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  expires_at TEXT NOT NULL,
  used_at    TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user ON password_reset_tokens(user_id);

CREATE INDEX IF NOT EXISTS idx_bins_location_id ON bins(location_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bins_location_short_code ON bins(location_id, short_code);
CREATE INDEX IF NOT EXISTS idx_bins_location_updated ON bins(location_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_bins_area_id ON bins(area_id);
CREATE INDEX IF NOT EXISTS idx_bins_deleted_at ON bins(location_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_bins_visibility ON bins(location_id, visibility);
CREATE INDEX IF NOT EXISTS idx_photos_bin_id ON photos(bin_id);
CREATE INDEX IF NOT EXISTS idx_location_members_user ON location_members(user_id);
CREATE INDEX IF NOT EXISTS idx_location_members_location ON location_members(location_id);
CREATE INDEX IF NOT EXISTS idx_users_plan ON users(plan, sub_status);
CREATE INDEX IF NOT EXISTS idx_users_trial ON users(sub_status, created_at);
CREATE INDEX IF NOT EXISTS idx_locations_created_by ON locations(created_by);
CREATE INDEX IF NOT EXISTS idx_photos_created_by ON photos(created_by);

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
-- idx_bin_shares_active created in db.ts migration (needs dedup handling for existing DBs)
CREATE INDEX IF NOT EXISTS idx_bin_shares_token ON bin_shares(token) WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS email_log (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email_type TEXT NOT NULL,
  sent_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_email_log_dedup ON email_log(user_id, email_type, sent_at);
-- idx_email_log_daily created in db.ts migration (needs dedup handling for existing DBs)
-- NOTE: FK on user_id added after initial release. SQLite cannot add FK constraints to
-- existing columns via ALTER TABLE, so existing DBs only get the constraint after a
-- fresh install or manual table rebuild. This matches the project's migration pattern.

CREATE TABLE IF NOT EXISTS api_key_daily_usage (
  api_key_id    TEXT NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  date          TEXT NOT NULL DEFAULT (date('now')),
  request_count INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (api_key_id, date)
);

CREATE TABLE IF NOT EXISTS ai_usage (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    TEXT NOT NULL,
  call_count INTEGER NOT NULL DEFAULT 1,
  date       TEXT NOT NULL DEFAULT (date('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, date)
);
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_date ON ai_usage(user_id, date);

CREATE TABLE IF NOT EXISTS ai_credit_periods (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period_start TEXT NOT NULL,
  period_end   TEXT NOT NULL,
  credits_used INTEGER NOT NULL DEFAULT 0,
  credits_limit INTEGER NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, period_start)
);
CREATE INDEX IF NOT EXISTS idx_ai_credit_periods_user ON ai_credit_periods(user_id, period_start);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS webhook_outbox (
  id            TEXT PRIMARY KEY,
  endpoint      TEXT NOT NULL,
  payload_json  TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  sent_at       TEXT,
  attempts      INTEGER NOT NULL DEFAULT 0,
  last_error    TEXT,
  next_retry_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_webhook_outbox_pending ON webhook_outbox(next_retry_at) WHERE sent_at IS NULL;

CREATE TABLE IF NOT EXISTS job_locks (
  job_name   TEXT PRIMARY KEY,
  locked_by  TEXT NOT NULL,
  locked_at  TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);
