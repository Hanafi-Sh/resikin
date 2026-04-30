-- ============================================
-- ResikIn — Migration: Reporters Table & Category Support
-- Run this AFTER 003_multi_photo_support.sql
-- ============================================

-- 1. Create reporters table for Telegram users (warga pelapor)
CREATE TABLE IF NOT EXISTS reporters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    telegram_id VARCHAR(64) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add reporter_id FK to reports table
ALTER TABLE reports
    ADD COLUMN IF NOT EXISTS reporter_id UUID REFERENCES reporters(id);

-- 3. Index for fast lookup by telegram_id
CREATE INDEX IF NOT EXISTS idx_reporters_telegram_id ON reporters(telegram_id);

-- 4. Index for reporter_id on reports
CREATE INDEX IF NOT EXISTS idx_reports_reporter_id ON reports(reporter_id);

-- 5. Update category constraint to allow NULL (already nullable from migration 002)
--    and ensure the CHECK constraint includes all valid values
ALTER TABLE reports DROP CONSTRAINT IF EXISTS reports_category_check;
ALTER TABLE reports ADD CONSTRAINT reports_category_check CHECK (
    category IS NULL OR category IN (
        'tidak_terangkut', 'tps_penuh', 'sampah_liar', 'bau', 'lainnya'
    )
);

-- 6. Auto-update updated_at for reporters table
CREATE TRIGGER update_reporters_updated_at
    BEFORE UPDATE ON reporters
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 7. RLS for reporters table
ALTER TABLE reporters ENABLE ROW LEVEL SECURITY;

-- Public can insert reporters (bot creates them)
CREATE POLICY "Bot can create reporters"
    ON reporters FOR INSERT
    WITH CHECK (true);

-- Public can read reporters (bot needs to look up by telegram_id)
CREATE POLICY "Bot can read reporters"
    ON reporters FOR SELECT
    USING (true);

-- Public can update reporters (bot can update phone/name)
CREATE POLICY "Bot can update reporters"
    ON reporters FOR UPDATE
    USING (true);
