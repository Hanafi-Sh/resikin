-- ============================================
-- ResikIn - Fix ambiguous column references in report workflow
-- Run this AFTER 006_create_report_workflow_function.sql
-- ============================================

CREATE OR REPLACE FUNCTION apply_report_workflow(
  p_report_id UUID,
  p_action TEXT,
  p_actor_user_id UUID,
  p_actor_role TEXT,
  p_petugas_id UUID DEFAULT NULL,
  p_reject_reason TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_completion_photo_urls TEXT[] DEFAULT '{}'
)
RETURNS TABLE(
  report_id UUID,
  old_status VARCHAR,
  new_status VARCHAR,
  assigned_petugas_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_status VARCHAR;
  v_new_status VARCHAR;
  v_photo_url TEXT;
BEGIN
  IF p_actor_user_id IS NULL THEN
    RAISE EXCEPTION 'actor user is required'
      USING ERRCODE = '22023';
  END IF;

  IF p_actor_role NOT IN ('koordinator', 'petugas') THEN
    RAISE EXCEPTION 'invalid actor role: %', p_actor_role
      USING ERRCODE = '22023';
  END IF;

  SELECT r.status
    INTO v_old_status
    FROM reports AS r
    WHERE r.id = p_report_id
    FOR UPDATE;

  IF v_old_status IS NULL THEN
    RAISE EXCEPTION 'report not found'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_old_status IN ('selesai', 'ditolak') THEN
    RAISE EXCEPTION 'report status % is terminal', v_old_status
      USING ERRCODE = '22023';
  END IF;

  CASE p_action
    WHEN 'accept_report' THEN
      IF p_actor_role <> 'koordinator' THEN
        RAISE EXCEPTION 'only koordinator can accept reports'
          USING ERRCODE = '42501';
      END IF;
      IF v_old_status <> 'dikirim' THEN
        RAISE EXCEPTION 'cannot accept report from status %', v_old_status
          USING ERRCODE = '22023';
      END IF;
      v_new_status := 'diterima';

      UPDATE reports
        SET status = v_new_status
        WHERE id = p_report_id;

    WHEN 'assign_report' THEN
      IF p_actor_role <> 'koordinator' THEN
        RAISE EXCEPTION 'only koordinator can assign reports'
          USING ERRCODE = '42501';
      END IF;
      IF v_old_status NOT IN ('dikirim', 'diterima') THEN
        RAISE EXCEPTION 'cannot assign report from status %', v_old_status
          USING ERRCODE = '22023';
      END IF;
      IF p_petugas_id IS NULL THEN
        RAISE EXCEPTION 'petugas_id is required for assignment'
          USING ERRCODE = '22023';
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM users AS u
        WHERE u.id = p_petugas_id
          AND u.role = 'petugas'
          AND COALESCE(u.is_active, true) = true
      ) THEN
        RAISE EXCEPTION 'assigned user must be an active petugas'
          USING ERRCODE = '22023';
      END IF;
      v_new_status := 'ditugaskan';

      UPDATE reports
        SET status = v_new_status
        WHERE id = p_report_id;

      INSERT INTO assignments (report_id, petugas_id, assigned_by)
      VALUES (p_report_id, p_petugas_id, p_actor_user_id);

    WHEN 'start_work' THEN
      IF p_actor_role <> 'petugas' THEN
        RAISE EXCEPTION 'only petugas can start assigned work'
          USING ERRCODE = '42501';
      END IF;
      IF v_old_status <> 'ditugaskan' THEN
        RAISE EXCEPTION 'cannot start work from status %', v_old_status
          USING ERRCODE = '22023';
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM assignments AS a
        WHERE a.report_id = p_report_id
          AND a.petugas_id = p_actor_user_id
      ) THEN
        RAISE EXCEPTION 'petugas is not assigned to this report'
          USING ERRCODE = '42501';
      END IF;
      v_new_status := 'dalam_proses';

      UPDATE reports
        SET status = v_new_status
        WHERE id = p_report_id;

    WHEN 'complete_work' THEN
      IF p_actor_role <> 'petugas' THEN
        RAISE EXCEPTION 'only petugas can complete assigned work'
          USING ERRCODE = '42501';
      END IF;
      IF v_old_status <> 'dalam_proses' THEN
        RAISE EXCEPTION 'cannot complete work from status %', v_old_status
          USING ERRCODE = '22023';
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM assignments AS a
        WHERE a.report_id = p_report_id
          AND a.petugas_id = p_actor_user_id
      ) THEN
        RAISE EXCEPTION 'petugas is not assigned to this report'
          USING ERRCODE = '42501';
      END IF;
      v_new_status := 'selesai';

      UPDATE reports
        SET status = v_new_status
        WHERE id = p_report_id;

      UPDATE assignments AS a
        SET completed_at = COALESCE(a.completed_at, NOW())
        WHERE a.report_id = p_report_id
          AND a.petugas_id = p_actor_user_id;

      FOREACH v_photo_url IN ARRAY COALESCE(p_completion_photo_urls, ARRAY[]::TEXT[])
      LOOP
        IF NULLIF(BTRIM(v_photo_url), '') IS NOT NULL THEN
          INSERT INTO report_photos (report_id, photo_url, type)
          VALUES (p_report_id, BTRIM(v_photo_url), 'completion');
        END IF;
      END LOOP;

    WHEN 'reject_report' THEN
      IF p_actor_role <> 'koordinator' THEN
        RAISE EXCEPTION 'only koordinator can reject reports'
          USING ERRCODE = '42501';
      END IF;
      IF NULLIF(BTRIM(COALESCE(p_reject_reason, '')), '') IS NULL THEN
        RAISE EXCEPTION 'reject_reason is required'
          USING ERRCODE = '22023';
      END IF;
      v_new_status := 'ditolak';

      UPDATE reports
        SET status = v_new_status,
            reject_reason = BTRIM(p_reject_reason)
        WHERE id = p_report_id;

    ELSE
      RAISE EXCEPTION 'unsupported workflow action: %', p_action
        USING ERRCODE = '22023';
  END CASE;

  INSERT INTO status_history (report_id, old_status, new_status, changed_by, notes)
  VALUES (
    p_report_id,
    v_old_status,
    v_new_status,
    p_actor_user_id,
    NULLIF(BTRIM(COALESCE(p_notes, '')), '')
  );

  RETURN QUERY SELECT p_report_id, v_old_status, v_new_status, p_petugas_id;
END;
$$;

GRANT EXECUTE ON FUNCTION apply_report_workflow(
  UUID,
  TEXT,
  UUID,
  TEXT,
  UUID,
  TEXT,
  TEXT,
  TEXT[]
) TO authenticated, service_role;
