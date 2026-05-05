import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { generateTrackingCode } from '@/lib/utils';
import { withTelegramReportPhotosList } from '@/lib/telegram-photos';

export const dynamic = 'force-dynamic';

async function notifyBot(event, reportId) {
  const notifyUrl = process.env.BOT_NOTIFY_URL;
  if (!notifyUrl) return;
  try {
    await fetch(`${notifyUrl}/notifications/report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-resikin-secret': process.env.BOT_NOTIFY_SECRET || '',
      },
      body: JSON.stringify({ event, report_id: reportId }),
    });
  } catch {
    // ignore notification errors for now
  }
}

/**
 * GET /api/reports — List semua laporan (untuk dashboard koordinator)
 */
export async function GET(request) {
  const supabase = await createClient();

  // Check auth
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const category = searchParams.get('category');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');
  const offset = (page - 1) * limit;

  let query = supabase
    .from('reports')
    .select('*, report_photos(id, photo_url, type)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq('status', status);
  if (category) query = query.eq('category', category);

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    reports: withTelegramReportPhotosList(data),
    total: count,
    page,
    totalPages: Math.ceil((count || 0) / limit),
  });
}

/**
 * POST /api/reports — Buat laporan baru (publik, tanpa auth)
 */
export async function POST(request) {
  const supabase = await createClient();

  try {
    const body = await request.json();
    const { reporter_name, reporter_phone, category, description, latitude, longitude, address, photo_urls } = body;

    // Validation
    if (!reporter_name || !reporter_phone || !category || !description) {
      return NextResponse.json(
        { error: 'Nama, nomor HP, kategori, dan deskripsi wajib diisi' },
        { status: 400 }
      );
    }

    // Generate tracking code
    // Get today's report count for sequence number
    const today = new Date().toISOString().slice(0, 10);
    const { count } = await supabase
      .from('reports')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', `${today}T00:00:00`)
      .lte('created_at', `${today}T23:59:59`);

    const trackingCode = generateTrackingCode((count || 0) + 1);

    // Insert report
    const { data: report, error: reportError } = await supabase
      .from('reports')
      .insert({
        tracking_code: trackingCode,
        reporter_name,
        reporter_phone,
        category,
        description,
        latitude: latitude || null,
        longitude: longitude || null,
        address: address || null,
        status: 'dikirim',
      })
      .select()
      .single();

    if (reportError) {
      return NextResponse.json({ error: reportError.message }, { status: 500 });
    }

    // Insert photos if provided
    if (photo_urls && photo_urls.length > 0) {
      const photos = photo_urls.map((url) => ({
        report_id: report.id,
        photo_url: url,
        type: 'report',
      }));

      await supabase.from('report_photos').insert(photos);
    }

    // Insert initial status history
    await supabase.from('status_history').insert({
      report_id: report.id,
      old_status: null,
      new_status: 'dikirim',
      notes: 'Laporan dibuat oleh warga',
    });

    // Notify koordinator for new report
    await notifyBot('created', report.id);

    return NextResponse.json({
      success: true,
      tracking_code: trackingCode,
      report_id: report.id,
    }, { status: 201 });

  } catch (err) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
