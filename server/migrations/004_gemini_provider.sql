-- Per-provider AI credential storage
-- Change UNIQUE(user_id) → UNIQUE(user_id, provider), add is_active flag
CREATE TABLE IF NOT EXISTS user_ai_settings_new (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider      TEXT NOT NULL CHECK (provider IN ('openai', 'anthropic', 'gemini', 'openai-compatible')),
  api_key       TEXT NOT NULL,
  model         TEXT NOT NULL,
  endpoint_url  TEXT,
  custom_prompt  TEXT,
  command_prompt TEXT,
  query_prompt  TEXT,
  is_active     INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, provider)
);

INSERT OR IGNORE INTO user_ai_settings_new
  SELECT id, user_id, provider, api_key, model, endpoint_url, custom_prompt, command_prompt, query_prompt, 1, created_at, updated_at
  FROM user_ai_settings;

DROP TABLE IF EXISTS user_ai_settings;
ALTER TABLE user_ai_settings_new RENAME TO user_ai_settings;
CREATE INDEX IF NOT EXISTS idx_user_ai_settings_user ON user_ai_settings(user_id);
