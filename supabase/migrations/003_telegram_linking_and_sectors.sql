-- ============================================
-- ResikIn — Migration: Telegram Linking & DLH Sectors
-- Run this AFTER 002_telegram_bot_support.sql
-- ============================================

-- 1. Sectors (DLH operational areas)
CREATE TABLE IF NOT EXISTS sectors (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL
);

-- 2. Sector ↔ Kelurahan mapping
CREATE TABLE IF NOT EXISTS sector_kelurahan (
  sector_id VARCHAR(50) NOT NULL REFERENCES sectors(id) ON DELETE CASCADE,
  kelurahan_id VARCHAR(100) NOT NULL,
  PRIMARY KEY (sector_id, kelurahan_id)
);

-- 3. Add sector_id to users (for petugas assignment)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS sector_id VARCHAR(50) REFERENCES sectors(id);

-- 4. Telegram link tokens (one-time OTP from web)
CREATE TABLE IF NOT EXISTS telegram_link_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('koordinator', 'petugas')),
  kelurahan_id VARCHAR(100),
  sector_id VARCHAR(50),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Telegram links (active mapping)
CREATE TABLE IF NOT EXISTS telegram_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('koordinator', 'petugas')),
  kelurahan_id VARCHAR(100),
  sector_id VARCHAR(50),
  telegram_id VARCHAR(64) NOT NULL,
  telegram_username VARCHAR(64),
  is_active BOOLEAN DEFAULT true,
  linked_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_telegram_links_user_role
  ON telegram_links(user_id, role);
CREATE UNIQUE INDEX IF NOT EXISTS idx_telegram_links_telegram_id
  ON telegram_links(telegram_id);
CREATE INDEX IF NOT EXISTS idx_telegram_links_kelurahan
  ON telegram_links(kelurahan_id);
CREATE INDEX IF NOT EXISTS idx_telegram_links_sector
  ON telegram_links(sector_id);
CREATE INDEX IF NOT EXISTS idx_telegram_link_tokens_user
  ON telegram_link_tokens(user_id);

-- 7. RLS
ALTER TABLE sectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE sector_kelurahan ENABLE ROW LEVEL SECURITY;
ALTER TABLE telegram_link_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE telegram_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can read sectors"
  ON sectors FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Auth users can read sector mapping"
  ON sector_kelurahan FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Auth users can create link tokens"
  ON telegram_link_tokens FOR INSERT
  WITH CHECK (
    auth.uid() = (SELECT auth_user_id FROM users WHERE id = user_id)
  );

-- 8. Seed sector data
INSERT INTO sectors (id, name) VALUES
  ('malioboro-kranggan', 'Sektor Malioboro-Kranggan'),
  ('krasak', 'Sektor Krasak'),
  ('gunungketur', 'Sektor Gunungketur'),
  ('ngasem-gading', 'Sektor Ngasem-Gading'),
  ('kotagede', 'Sektor Kotagede')
ON CONFLICT (id) DO NOTHING;

-- 9. Seed sector ↔ kelurahan mapping
INSERT INTO sector_kelurahan (sector_id, kelurahan_id) VALUES
  -- Malioboro-Kranggan
  ('malioboro-kranggan', 'bausasran'),
  ('malioboro-kranggan', 'suryatmajan'),
  ('malioboro-kranggan', 'tegalpanggung'),
  ('malioboro-kranggan', 'pringgokusuman'),
  ('malioboro-kranggan', 'sosromenduran'),
  ('malioboro-kranggan', 'bumijo'),
  ('malioboro-kranggan', 'cokrodiningratan'),
  ('malioboro-kranggan', 'gowongan'),
  ('malioboro-kranggan', 'ngampilan'),
  ('malioboro-kranggan', 'notoprajan'),
  ('malioboro-kranggan', 'bener'),
  ('malioboro-kranggan', 'karangwaru'),
  ('malioboro-kranggan', 'kricak'),
  ('malioboro-kranggan', 'tegalrejo'),

  -- Krasak
  ('krasak', 'baciro'),
  ('krasak', 'demangan'),
  ('krasak', 'klitren'),
  ('krasak', 'kotabaru'),
  ('krasak', 'terban'),

  -- Gunungketur
  ('gunungketur', 'gunungketur'),
  ('gunungketur', 'purwokinanti'),
  ('gunungketur', 'brontokusuman'),
  ('gunungketur', 'keparakan'),
  ('gunungketur', 'wirogunan'),

  -- Ngasem-Gading
  ('ngasem-gading', 'kadipaten'),
  ('ngasem-gading', 'panembahan'),
  ('ngasem-gading', 'patehan'),
  ('ngasem-gading', 'ngupasan'),
  ('ngasem-gading', 'prawirodirjan'),
  ('ngasem-gading', 'gedongkiwo'),
  ('ngasem-gading', 'mantrijeron'),
  ('ngasem-gading', 'suryodiningratan'),
  ('ngasem-gading', 'pakuncen'),
  ('ngasem-gading', 'patangpuluhan'),
  ('ngasem-gading', 'wirobrajan'),

  -- Kotagede
  ('kotagede', 'prenggan'),
  ('kotagede', 'purbayan'),
  ('kotagede', 'rejowinangun'),
  ('kotagede', 'giwangan'),
  ('kotagede', 'muja-muju'),
  ('kotagede', 'pandeyan'),
  ('kotagede', 'semaki'),
  ('kotagede', 'sorosutan'),
  ('kotagede', 'tahunan'),
  ('kotagede', 'warungboto')
ON CONFLICT DO NOTHING;
