CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username      VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  display_name  VARCHAR(100) NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS homes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(100) NOT NULL,
  created_by    UUID NOT NULL REFERENCES users(id),
  invite_code   VARCHAR(20) UNIQUE NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS home_members (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  home_id       UUID NOT NULL REFERENCES homes(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role          VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  joined_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(home_id, user_id)
);

CREATE TABLE IF NOT EXISTS bins (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  home_id       UUID NOT NULL REFERENCES homes(id) ON DELETE CASCADE,
  name          VARCHAR(255) NOT NULL,
  location      VARCHAR(255) NOT NULL DEFAULT '',
  items         TEXT[] NOT NULL DEFAULT '{}',
  notes         TEXT NOT NULL DEFAULT '',
  tags          TEXT[] NOT NULL DEFAULT '{}',
  icon          VARCHAR(50) NOT NULL DEFAULT '',
  color         VARCHAR(50) NOT NULL DEFAULT '',
  created_by    UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS photos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bin_id        UUID NOT NULL REFERENCES bins(id) ON DELETE CASCADE,
  filename      VARCHAR(255) NOT NULL,
  mime_type     VARCHAR(50) NOT NULL,
  size          INTEGER NOT NULL,
  storage_path  VARCHAR(500) NOT NULL,
  created_by    UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bins_home_id ON bins(home_id);
CREATE INDEX IF NOT EXISTS idx_bins_home_updated ON bins(home_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_photos_bin_id ON photos(bin_id);
CREATE INDEX IF NOT EXISTS idx_home_members_user ON home_members(user_id);
CREATE INDEX IF NOT EXISTS idx_home_members_home ON home_members(home_id);
