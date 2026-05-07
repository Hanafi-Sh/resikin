import { createClient } from '@/lib/supabase/server';
import { withReportGallery } from '@/lib/report-gallery';
import { NextResponse } from 'next/server';
import { REPORT_NOTIFICATION_EVENTS, buildReportNotificationPayload } from '@/lib/report-notifications.mjs';

export const dynamic = 'force-dynamic';

async function notifyBot(event, fields) {
  const notifyUrl = process.env.BOT_NOTIFY_URL;
  if (!notifyUrl) return;
  try {
    const payload = buildReportNotificationPayload(event, fields);
    await fetch(`${notifyUrl}/notifications/report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-resikin-secret': process.env.BOT_NOTIFY_SECRET || '',
      },
      body: JSON.stringify(payload),
    });
  } catch {
    // ignore notification errors for now
  }
}

/**
 * GET /api/reports/[id] — Detail laporan
 */
export async function GET(request, { params }) {
  const supabase = await createClient();
  const { id } = await params;

  // Check auth
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: report, error } = await supabase
    .from('reports')
    .select(`
      *,
      report_photos(id, photo_url, type, uploaded_at),
      assignments(
        id, assigned_at, completed_at, notes,
        petugas:users!assignments_petugas_id_fkey(id, name, phone),
        assigner:users!assignments_assigned_by_fkey(id, name)
      ),
      status_history(id, old_status, new_status, notes, changed_at)
    `)
    .eq('id', id)
    .single();

  if (error) {
    return NextResponse.json({ error: 'Laporan tidak ditemukan' }, { status: 404 });
  }

  // Sort status history by changed_at
  if (report.status_history) {
    report.status_history.sort((a, b) => new Date(a.changed_at) - new Date(b.changed_at));
  }

  return NextResponse.json({ report: withReportGallery(report) });
}

function getWorkflowAction(status, action) {
  if (action) return action;

  const actionByStatus = {
    diterima: 'accept_report',
    ditugaskan: 'assign_report',
    dalam_proses: 'start_work',
    selesai: 'complete_work',
    ditolak: 'reject_report',
  };

  return actionByStatus[status] || null;
}

/**
 * PATCH /api/reports/[id] — Update status laporan
 */
export async function PATCH(request, { params }) {
  const supabase = await createClient();
  const { id } = await params;

  // Check auth
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { status, action, reject_reason, petugas_id, notes, completion_photo_urls } = body;
    const workflowAction = getWorkflowAction(status, action);

    if (!workflowAction) {
      return NextResponse.json({ error: 'Aksi alur penanganan tidak valid' }, { status: 400 });
    }

    // Get the user's profile
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('id, name, role')
      .eq('auth_user_id', user.id)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const { data: workflowResult, error: workflowError } = await supabase
      .rpc('apply_report_workflow', {
        p_report_id: id,
        p_action: workflowAction,
        p_actor_user_id: userProfile.id,
        p_actor_role: userProfile.role,
        p_petugas_id: petugas_id || null,
        p_reject_reason: reject_reason || null,
        p_notes: notes || null,
        p_completion_photo_urls: Array.isArray(completion_photo_urls) ? completion_photo_urls : [],
      })
      .single();

    if (workflowError) {
      const statusCode = workflowError.code === '42501' ? 403 : 400;
      return NextResponse.json({ error: workflowError.message }, { status: statusCode });
    }

    // Notify petugas when report is assigned to them
    if (workflowAction === 'assign_report' && petugas_id) {
      await notifyBot(REPORT_NOTIFICATION_EVENTS.ASSIGNED, { report_id: id, petugas_id });
    }

    // Notify the reporter when the public-facing report status changes.
    if (workflowResult.new_status && workflowResult.new_status !== workflowResult.old_status) {
      await notifyBot(REPORT_NOTIFICATION_EVENTS.STATUS_CHANGED, {
        report_id: id,
        old_status: workflowResult.old_status,
        new_status: workflowResult.new_status,
      });
    }

    return NextResponse.json({ success: true, status: workflowResult.new_status });

  } catch (err) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
