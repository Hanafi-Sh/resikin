import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/upload — Upload foto ke Supabase Storage
 */
export async function POST(request) {
  const requestSupabase = await createClient();
  const adminSupabase = createAdminClient();
  const supabase = adminSupabase || requestSupabase;

  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const reportId = formData.get('report_id');
    const type = formData.get('type') || 'report';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!['report', 'completion'].includes(type)) {
      return NextResponse.json({ error: 'Tipe foto tidak valid' }, { status: 400 });
    }

    if (type === 'completion' && !reportId) {
      return NextResponse.json({ error: 'report_id wajib diisi untuk foto penyelesaian' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Format file tidak didukung. Gunakan JPG, PNG, atau WebP.' },
        { status: 400 }
      );
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'Ukuran file maksimal 5MB' },
        { status: 400 }
      );
    }

    // Generate unique filename
    const ext = file.name.split('.').pop();
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const fileName = `reports/${timestamp}-${randomStr}.${ext}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('report-photos')
      .upload(fileName, file, {
        contentType: file.type,
        upsert: false,
      });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('report-photos')
      .getPublicUrl(data.path);

    let photo = null;
    if (reportId) {
      const { data: photoData, error: photoError } = await supabase
        .from('report_photos')
        .insert({
          report_id: reportId,
          photo_url: urlData.publicUrl,
          type,
        })
        .select('id, photo_url, type, uploaded_at')
        .single();

      if (photoError) {
        await supabase.storage.from('report-photos').remove([data.path]);
        return NextResponse.json({ error: photoError.message }, { status: 500 });
      }

      photo = photoData;
    }

    return NextResponse.json({
      success: true,
      url: urlData.publicUrl,
      path: data.path,
      photo,
    });

  } catch (err) {
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
