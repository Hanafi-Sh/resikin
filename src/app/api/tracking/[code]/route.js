import { createClient } from '@/lib/supabase/server';
import { withTelegramReportPhotos } from '@/lib/telegram-photos';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/tracking/[code] — Tracking laporan by tracking code (publik)
 */
export async function GET(request, { params }) {
  const supabase = await createClient();
  const { code } = await params;

  // Find report by tracking code
  const { data: report, error } = await supabase
    .from('reports')
    .select(`
      id,
      tracking_code,
      category,
      description,
      address,
      status,
      reject_reason,
      file_ids,
      created_at,
      updated_at,
      report_photos(id, photo_url, type, uploaded_at),
      status_history(id, old_status, new_status, notes, changed_at)
    `)
    .eq('tracking_code', code.toUpperCase())
    .single();

  if (error || !report) {
    return NextResponse.json(
      { error: 'Laporan dengan kode tracking tersebut tidak ditemukan' },
      { status: 404 }
    );
  }

  // Sort status history chronologically
  if (report.status_history) {
    report.status_history.sort((a, b) => new Date(a.changed_at) - new Date(b.changed_at));
  }

  return NextResponse.json({ report: withTelegramReportPhotos(report) });
}
