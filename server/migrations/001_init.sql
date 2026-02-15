CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name  TEXT NOT NULL DEFAULT '',
  email         TEXT,
  avatar_path   TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS locations (
  id                      TEXT PRIMARY KEY,
  name                    TEXT NOT NULL,
  created_by              TEXT REFERENCES users(id) ON DELETE SET NULL,
  invite_code             TEXT UNIQUE NOT NULL,
  activity_retention_days INTEGER NOT NULL DEFAULT 90 CHECK (activity_retention_days BETWEEN 7 AND 365),
  trash_retention_days    INTEGER NOT NULL DEFAULT 30 CHECK (trash_retention_days BETWEEN 7 AND 365),
  created_at              TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at              TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS location_members (
  id            TEXT PRIMARY KEY,
  location_id   TEXT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role          TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  joined_at     TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(location_id, user_id)
);

CREATE TABLE IF NOT EXISTS areas (
  id            TEXT PRIMARY KEY,
  location_id   TEXT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  created_by    TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(location_id, name)
);
CREATE INDEX IF NOT EXISTS idx_areas_location_id ON areas(location_id);

CREATE TABLE IF NOT EXISTS bins (
  id            TEXT PRIMARY KEY,
  location_id   TEXT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  area_id       TEXT REFERENCES areas(id) ON DELETE SET NULL,
  items         TEXT NOT NULL DEFAULT '[]',
  notes         TEXT NOT NULL DEFAULT '',
  tags          TEXT NOT NULL DEFAULT '[]',
  icon          TEXT NOT NULL DEFAULT '',
  color         TEXT NOT NULL DEFAULT '',
  short_code    TEXT NOT NULL UNIQUE,
  created_by    TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at    TEXT
);

CREATE TABLE IF NOT EXISTS photos (
  id            TEXT PRIMARY KEY,
  bin_id        TEXT NOT NULL REFERENCES bins(id) ON DELETE CASCADE,
  filename      TEXT NOT NULL,
  mime_type     TEXT NOT NULL,
  size          INTEGER NOT NULL,
  storage_path  TEXT NOT NULL,
  created_by    TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tag_colors (
  id            TEXT PRIMARY KEY,
  location_id   TEXT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  tag           TEXT NOT NULL,
  color         TEXT NOT NULL,
  created_at    TEXT DEFAULT (datetime('now')),
  updated_at    TEXT DEFAULT (datetime('now')),
  UNIQUE(location_id, tag)
);

CREATE TABLE IF NOT EXISTS user_ai_settings (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider      TEXT NOT NULL CHECK (provider IN ('openai', 'anthropic', 'gemini', 'openai-compatible')),
  api_key       TEXT NOT NULL,
  model         TEXT NOT NULL,
  endpoint_url  TEXT,
  custom_prompt  TEXT,
  command_prompt TEXT,
  is_active     INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
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
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_activity_log_location ON activity_log(location_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_entity ON activity_log(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_bins_location_id ON bins(location_id);
CREATE INDEX IF NOT EXISTS idx_bins_location_updated ON bins(location_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_bins_area_id ON bins(area_id);
CREATE INDEX IF NOT EXISTS idx_bins_deleted_at ON bins(location_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_photos_bin_id ON photos(bin_id);
CREATE INDEX IF NOT EXISTS idx_location_members_user ON location_members(user_id);
CREATE INDEX IF NOT EXISTS idx_location_members_location ON location_members(location_id);
