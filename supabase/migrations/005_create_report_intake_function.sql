-- ============================================
-- ResikIn - Centralized Laporan Intake
-- Run this AFTER 004_reporters_and_categories.sql
-- ============================================

CREATE OR REPLACE FUNCTION create_report_intake(
  p_reporter_name TEXT,
  p_description TEXT,
  p_reporter_phone TEXT DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_latitude NUMERIC DEFAULT NULL,
  p_longitude NUMERIC DEFAULT NULL,
  p_address TEXT DEFAULT NULL,
  p_kelurahan_id VARCHAR DEFAULT NULL,
  p_reporter_id UUID DEFAULT NULL,
  p_user_id VARCHAR DEFAULT NULL,
  p_file_ids TEXT[] DEFAULT '{}',
  p_photo_urls TEXT[] DEFAULT '{}',
  p_source VARCHAR DEFAULT 'web',
  p_metadata JSONB DEFAULT '{}',
  p_status_history_notes TEXT DEFAULT NULL
)
RETURNS TABLE(id UUID, tracking_code VARCHAR)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_report_id UUID;
  v_tracking_code VARCHAR;
  v_photo_url TEXT;
  v_attempts INTEGER := 0;
  v_notes TEXT;
BEGIN
  IF NULLIF(BTRIM(p_reporter_name), '') IS NULL THEN
    RAISE EXCEPTION 'reporter_name is required'
      USING ERRCODE = '22023';
  END IF;

  IF NULLIF(BTRIM(p_description), '') IS NULL OR LENGTH(BTRIM(p_description)) < 10 THEN
    RAISE EXCEPTION 'description must be at least 10 characters'
      USING ERRCODE = '22023';
  END IF;

  IF p_category IS NOT NULL AND p_category NOT IN (
    'tidak_terangkut', 'tps_penuh', 'sampah_liar', 'bau', 'lainnya'
  ) THEN
    RAISE EXCEPTION 'invalid report category: %', p_category
      USING ERRCODE = '22023';
  END IF;

  IF p_source IS NOT NULL AND p_source NOT IN ('web', 'telegram') THEN
    RAISE EXCEPTION 'invalid report source: %', p_source
      USING ERRCODE = '22023';
  END IF;

  LOOP
    v_attempts := v_attempts + 1;
    v_tracking_code := 'RSK-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' ||
                       LPAD(FLOOR(RANDOM() * 100000)::TEXT, 5, '0');

    BEGIN
      INSERT INTO reports (
        tracking_code,
        reporter_name,
        reporter_phone,
        reporter_id,
        user_id,
        category,
        description,
        latitude,
        longitude,
        address,
        kelurahan_id,
        file_ids,
        source,
        metadata,
        status
      )
      VALUES (
        v_tracking_code,
        BTRIM(p_reporter_name),
        NULLIF(BTRIM(COALESCE(p_reporter_phone, '')), ''),
        p_reporter_id,
        NULLIF(BTRIM(COALESCE(p_user_id, '')), ''),
        p_category,
        BTRIM(p_description),
        p_latitude,
        p_longitude,
        NULLIF(BTRIM(COALESCE(p_address, '')), ''),
        NULLIF(BTRIM(COALESCE(p_kelurahan_id, '')), ''),
        COALESCE(p_file_ids, ARRAY[]::TEXT[]),
        COALESCE(p_source, 'web'),
        COALESCE(p_metadata, '{}'::JSONB),
        'dikirim'
      )
      RETURNING reports.id INTO v_report_id;

      EXIT;
    EXCEPTION WHEN unique_violation THEN
      IF v_attempts >= 5 THEN
        RAISE;
      END IF;
    END;
  END LOOP;

  FOREACH v_photo_url IN ARRAY COALESCE(p_photo_urls, ARRAY[]::TEXT[])
  LOOP
    IF NULLIF(BTRIM(v_photo_url), '') IS NOT NULL THEN
      INSERT INTO report_photos (report_id, photo_url, type)
      VALUES (v_report_id, BTRIM(v_photo_url), 'report');
    END IF;
  END LOOP;

  v_notes := COALESCE(
    NULLIF(BTRIM(p_status_history_notes), ''),
    CASE
      WHEN COALESCE(p_source, 'web') = 'telegram' THEN 'Laporan dibuat melalui bot Telegram'
      ELSE 'Laporan dibuat oleh warga'
    END
  );

  INSERT INTO status_history (report_id, old_status, new_status, notes)
  VALUES (v_report_id, NULL, 'dikirim', v_notes);

  RETURN QUERY SELECT v_report_id, v_tracking_code;
END;
$$;

GRANT EXECUTE ON FUNCTION create_report_intake(
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  NUMERIC,
  NUMERIC,
  TEXT,
  VARCHAR,
  UUID,
  VARCHAR,
  TEXT[],
  TEXT[],
  VARCHAR,
  JSONB,
  TEXT
) TO anon, authenticated, service_role;
