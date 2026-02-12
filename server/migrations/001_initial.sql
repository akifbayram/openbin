CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username      VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  display_name  VARCHAR(100) NOT NULL DEFAULT '',
  email         VARCHAR(255),
  avatar_path   VARCHAR(500),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS locations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(100) NOT NULL,
  created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  invite_code   VARCHAR(20) UNIQUE NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS location_members (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id   UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role          VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  joined_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(location_id, user_id)
);

CREATE TABLE IF NOT EXISTS areas (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id   UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  name          VARCHAR(100) NOT NULL,
  created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(location_id, name)
);
CREATE INDEX IF NOT EXISTS idx_areas_location_id ON areas(location_id);

CREATE TABLE IF NOT EXISTS bins (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id   UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  name          VARCHAR(255) NOT NULL,
  area_id       UUID REFERENCES areas(id) ON DELETE SET NULL,
  items         TEXT[] NOT NULL DEFAULT '{}',
  notes         TEXT NOT NULL DEFAULT '',
  tags          TEXT[] NOT NULL DEFAULT '{}',
  icon          VARCHAR(50) NOT NULL DEFAULT '',
  color         VARCHAR(50) NOT NULL DEFAULT '',
  short_code    VARCHAR(6) NOT NULL UNIQUE,
  created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
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
  created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tag_colors (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id   UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  tag           TEXT NOT NULL,
  color         TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(location_id, tag)
);

ALTER TABLE tag_colors REPLICA IDENTITY FULL;

CREATE INDEX IF NOT EXISTS idx_bins_location_id ON bins(location_id);
CREATE INDEX IF NOT EXISTS idx_bins_location_updated ON bins(location_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_bins_area_id ON bins(area_id);
CREATE INDEX IF NOT EXISTS idx_photos_bin_id ON photos(bin_id);
CREATE INDEX IF NOT EXISTS idx_location_members_user ON location_members(user_id);
CREATE INDEX IF NOT EXISTS idx_location_members_location ON location_members(location_id);
