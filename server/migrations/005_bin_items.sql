CREATE TABLE IF NOT EXISTS bin_items (
  id         TEXT PRIMARY KEY,
  bin_id     TEXT NOT NULL REFERENCES bins(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  position   INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_bin_items_bin_id ON bin_items(bin_id, position);
