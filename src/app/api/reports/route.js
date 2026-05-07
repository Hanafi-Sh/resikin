import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { withReportGalleryList } from '@/lib/report-gallery';
import { REPORT_NOTIFICATION_EVENTS, buildReportNotificationPayload } from '@/lib/report-notifications.mjs';
import {
  hasActionableReportLocation,
  normalizeIndonesianPhone,
  normalizeManualAddress,
  normalizeReporterName,
  normalizeReportDescription,
} from '@/lib/utils';
import { KELURAHAN_IDS, REPORT_CATEGORIES } from '@/lib/constants';

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
 * GET /api/reports — List semua laporan (untuk dashboard koordinator) atau stats publik
 */
export async function GET(request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  
  // Public stats endpoint (no auth required)
  if (searchParams.get('stats') === 'true') {
    const { data, error } = await supabase
      .from('reports')
      .select('status', { count: 'exact' });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const stats = { dikirim: 0, dalam_proses: 0, selesai: 0 };
    data?.forEach((r) => {
      if (r.status === 'dikirim' || r.status === 'diterima') stats.dikirim++;
      if (r.status === 'ditugaskan' || r.status === 'dalam_proses') stats.dalam_proses++;
      if (r.status === 'selesai') stats.selesai++;
    });

    return NextResponse.json(stats);
  }

  // Protected endpoint - requires auth
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
    reports: withReportGalleryList(data),
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
    const { reporter_name, reporter_phone, category, description, latitude, longitude, address, kelurahan_id, photo_urls } = body;

    // Validation
    if (!reporter_name || !reporter_phone || !category || !description) {
      return NextResponse.json(
        { error: 'Nama, nomor HP, kategori, dan deskripsi wajib diisi' },
        { status: 400 }
      );
    }

    const normalizedName = normalizeReporterName(reporter_name);
    if (!normalizedName) {
      return NextResponse.json(
        { error: 'Nama pelapor harus 2-80 karakter dan mengandung huruf' },
        { status: 400 }
      );
    }

    const normalizedPhone = normalizeIndonesianPhone(reporter_phone);
    if (!normalizedPhone) {
      return NextResponse.json(
        { error: 'Nomor HP harus nomor Indonesia yang valid' },
        { status: 400 }
      );
    }

    const normalizedDescription = normalizeReportDescription(description);
    if (!normalizedDescription) {
      return NextResponse.json(
        { error: 'Deskripsi minimal 20 karakter dan harus menjelaskan masalah dengan jelas' },
        { status: 400 }
      );
    }

    const validCategoryIds = new Set(REPORT_CATEGORIES.map((item) => item.value));
    if (!validCategoryIds.has(category)) {
      return NextResponse.json(
        { error: 'Kategori laporan tidak valid' },
        { status: 400 }
      );
    }

    const normalizedAddress = normalizeManualAddress(address);
    if (!hasActionableReportLocation({ latitude, longitude, address })) {
      return NextResponse.json(
        { error: 'Lokasi wajib diisi melalui GPS atau alamat manual yang jelas' },
        { status: 400 }
      );
    }

    if (!KELURAHAN_IDS.has(kelurahan_id)) {
      return NextResponse.json(
        { error: 'Kelurahan lokasi masalah wajib dipilih' },
        { status: 400 }
      );
    }

    const { data: report, error: reportError } = await supabase
      .rpc('create_report_intake', {
        p_reporter_name: normalizedName,
        p_reporter_phone: normalizedPhone,
        p_category: category,
        p_description: normalizedDescription,
        p_latitude: latitude || null,
        p_longitude: longitude || null,
        p_address: normalizedAddress || address || null,
        p_kelurahan_id: kelurahan_id,
        p_photo_urls: Array.isArray(photo_urls) ? photo_urls : [],
        p_source: 'web',
        p_status_history_notes: 'Laporan dibuat oleh warga',
      })
      .single();

    if (reportError) {
      return NextResponse.json({ error: reportError.message }, { status: 500 });
    }

    // Notify koordinator for new report
    await notifyBot(REPORT_NOTIFICATION_EVENTS.CREATED, { report_id: report.id });

    return NextResponse.json({
      success: true,
      tracking_code: report.tracking_code,
      report_id: report.id,
    }, { status: 201 });

  } catch (err) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
