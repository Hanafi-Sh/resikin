import TrackingClient from './TrackingClient';
import { createClient } from '@/lib/supabase/server';
import { withReportGallery } from '@/lib/report-gallery';

async function getInitialReport(code) {
  if (!code) return { report: null, error: '' };

  const supabase = await createClient();
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
    return {
      report: null,
      error: 'Laporan dengan kode tracking tersebut tidak ditemukan',
    };
  }

  if (report.status_history) {
    report.status_history.sort((a, b) => new Date(a.changed_at) - new Date(b.changed_at));
  }

  return { report: withReportGallery(report), error: '' };
}

export default async function TrackingPage({ searchParams }) {
  const params = await searchParams;
  const rawCode = params?.code;
  const initialCode = Array.isArray(rawCode) ? rawCode[0] || '' : rawCode || '';
  const { report, error } = await getInitialReport(initialCode);

  return <TrackingClient initialCode={initialCode} initialReport={report} initialError={error} />;
}
