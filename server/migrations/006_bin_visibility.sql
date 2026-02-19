ALTER TABLE bins ADD COLUMN visibility TEXT NOT NULL DEFAULT 'location'
  CHECK (visibility IN ('location', 'private'));

CREATE INDEX IF NOT EXISTS idx_bins_visibility ON bins(location_id, visibility);
