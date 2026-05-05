import { createClient } from '@/lib/supabase/server';
import { withTelegramReportPhotos } from '@/lib/telegram-photos';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

async function notifyBot(event, reportId, extra = {}) {
  const notifyUrl = process.env.BOT_NOTIFY_URL;
  if (!notifyUrl) return;
  try {
    await fetch(`${notifyUrl}/notifications/report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-resikin-secret': process.env.BOT_NOTIFY_SECRET || '',
      },
      body: JSON.stringify({ event, report_id: reportId, ...extra }),
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

  return NextResponse.json({ report: withTelegramReportPhotos(report) });
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
    const { status, reject_reason, petugas_id, notes } = body;

    // Get current report
    const { data: currentReport, error: fetchError } = await supabase
      .from('reports')
      .select('status')
      .eq('id', id)
      .single();

    if (fetchError) {
      return NextResponse.json({ error: 'Laporan tidak ditemukan' }, { status: 404 });
    }

    // Get the user's profile
    const { data: userProfile } = await supabase
      .from('users')
      .select('id, name, role')
      .eq('auth_user_id', user.id)
      .single();

    // Update report status
    const updateData = { status };
    if (reject_reason) updateData.reject_reason = reject_reason;

    const { error: updateError } = await supabase
      .from('reports')
      .update(updateData)
      .eq('id', id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Record status change
    await supabase.from('status_history').insert({
      report_id: id,
      old_status: currentReport.status,
      new_status: status,
      changed_by: userProfile?.id || null,
      notes: notes || null,
    });

    // Create assignment if assigning to petugas
    if (status === 'ditugaskan' && petugas_id) {
      await supabase.from('assignments').insert({
        report_id: id,
        petugas_id,
        assigned_by: userProfile?.id,
      });
    }

    // Notify petugas when report is assigned to them
    if (status === 'ditugaskan' && petugas_id && status !== currentReport.status) {
      await notifyBot('assigned', id, { petugas_id });
    }

    // Notify the reporter when the public-facing report status changes.
    if (status && status !== currentReport.status) {
      await notifyBot('status_changed', id, {
        old_status: currentReport.status,
        new_status: status,
      });
    }

    return NextResponse.json({ success: true, status });

  } catch (err) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
