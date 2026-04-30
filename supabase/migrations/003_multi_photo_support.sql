-- ============================================
-- ResikIn — Migration: Multi-Photo Support
-- Run this AFTER 002_telegram_bot_support.sql
-- ============================================

-- 1. Add new column for multiple photo file IDs (PostgreSQL array)
ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS file_ids TEXT[] DEFAULT '{}';

-- 2. Migrate existing data: copy file_id into file_ids array
UPDATE reports
  SET file_ids = ARRAY[file_id]
  WHERE file_id IS NOT NULL
    AND (file_ids IS NULL OR file_ids = '{}');

-- 3. (Optional) Drop old file_id column after confirming migration
--    Uncomment the line below only after verifying all data has been migrated
--    and no other code depends on the old column.
-- ALTER TABLE reports DROP COLUMN IF EXISTS file_id;
