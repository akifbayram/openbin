-- Track which API key was used for activity log entries
ALTER TABLE activity_log ADD COLUMN api_key_id TEXT REFERENCES api_keys(id) ON DELETE SET NULL;
