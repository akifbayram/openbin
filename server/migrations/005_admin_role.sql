-- Migrate role values from 'owner' to 'admin'
-- SQLite cannot ALTER CHECK constraints, so recreate the table.

CREATE TABLE location_members_new (
  id            TEXT PRIMARY KEY,
  location_id   TEXT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role          TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at     TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(location_id, user_id)
);

INSERT INTO location_members_new (id, location_id, user_id, role, joined_at)
  SELECT id, location_id, user_id,
         CASE WHEN role = 'owner' THEN 'admin' ELSE role END,
         joined_at
  FROM location_members;

DROP TABLE location_members;

ALTER TABLE location_members_new RENAME TO location_members;
