-- ============================================
-- ResikIn — Migration: Telegram Bot Support
-- Run this AFTER 001_initial_schema.sql
-- ============================================

-- 1. Add columns needed by the Telegram bot
ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS user_id VARCHAR(64),          -- Telegram user ID
  ADD COLUMN IF NOT EXISTS file_id TEXT,                  -- Telegram photo file_id
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}',   -- flexible extra data
  ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'web'; -- 'web' or 'telegram'

-- 2. Make web-only fields nullable so bot reports can be inserted without them
ALTER TABLE reports
  ALTER COLUMN tracking_code DROP NOT NULL,
  ALTER COLUMN reporter_name DROP NOT NULL,
  ALTER COLUMN reporter_phone DROP NOT NULL,
  ALTER COLUMN category DROP NOT NULL;

-- 3. Expand the status enum to include 'pending' (used by bot)
ALTER TABLE reports DROP CONSTRAINT IF EXISTS reports_status_check;
ALTER TABLE reports ADD CONSTRAINT reports_status_check CHECK (status IN (
  'pending', 'dikirim', 'diterima', 'ditugaskan', 'dalam_proses', 'selesai', 'ditolak'
));

-- 4. Change kelurahan_id from UUID to VARCHAR to support bot's string-based IDs
--    (UUID columns reject non-UUID strings like 'baciro', 'demangan', etc.)
ALTER TABLE reports
  ALTER COLUMN kelurahan_id TYPE VARCHAR(100) USING kelurahan_id::VARCHAR;

-- 5. Add index on source for filtering reports by origin
CREATE INDEX IF NOT EXISTS idx_reports_source ON reports(source);

-- 6. Add index on user_id for looking up reports by Telegram user
CREATE INDEX IF NOT EXISTS idx_reports_user_id ON reports(user_id);

-- 7. Auto-generate tracking_code for bot reports that don't provide one
--    This trigger fills in tracking_code if it was left NULL on insert.
CREATE OR REPLACE FUNCTION generate_tracking_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tracking_code IS NULL THEN
    NEW.tracking_code := 'RSK-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' ||
                         LPAD(FLOOR(RANDOM() * 100000)::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generate_tracking_code ON reports;
CREATE TRIGGER trg_generate_tracking_code
  BEFORE INSERT ON reports
  FOR EACH ROW EXECUTE FUNCTION generate_tracking_code();
