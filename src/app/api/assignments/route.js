import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/assignments — Daftar tugas untuk petugas yang sedang login
 */
export async function GET(request) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get petugas profile
  const { data: profile } = await supabase
    .from('users')
    .select('id, role')
    .eq('auth_user_id', user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');

  // For koordinator: get all assignments; for petugas: only their own
  let query = supabase
    .from('assignments')
    .select(`
      *,
      report:reports(
        id, tracking_code, category, description, address,
        latitude, longitude, status, created_at,
        report_photos(id, photo_url, type)
      ),
      petugas:users!assignments_petugas_id_fkey(id, name, phone)
    `)
    .order('assigned_at', { ascending: false });

  if (profile.role === 'petugas') {
    query = query.eq('petugas_id', profile.id);
  }

  // Filter by report status if provided
  if (status) {
    query = query.eq('report.status', status);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ assignments: data || [] });
}
