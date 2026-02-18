ALTER TABLE users ADD COLUMN active_location_id TEXT REFERENCES locations(id) ON DELETE SET NULL;
