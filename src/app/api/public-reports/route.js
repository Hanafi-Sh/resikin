import { createClient } from '@/lib/supabase/server';
import { withReportGalleryList } from '@/lib/report-gallery';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/public-reports — List laporan publik (tanpa data sensitif)
 */
export async function GET(request) {
  const supabase = await createClient();

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '10');

  // We only select non-sensitive fields. No reporter_name, no reporter_phone.
  const { data, error } = await supabase
    .from('reports')
    .select('id, tracking_code, category, description, address, status, file_ids, created_at, report_photos(id, photo_url, type)')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    reports: withReportGalleryList(data),
  });
}
