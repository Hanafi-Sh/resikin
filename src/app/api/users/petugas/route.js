import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/users/petugas — List semua petugas (untuk dropdown assign)
 */
export async function GET(request) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const kelurahanId = searchParams.get('kelurahan_id');

  let query = supabase
    .from('users')
    .select('id, name, phone, role, sector_id')
    .eq('role', 'petugas')
    .eq('is_active', true);

  if (kelurahanId) {
    const { data: mapping } = await supabase
      .from('sector_kelurahan')
      .select('sector_id')
      .eq('kelurahan_id', kelurahanId)
      .single();

    if (mapping?.sector_id) {
      query = query.eq('sector_id', mapping.sector_id);
    }
  }

  let { data, error } = await query.order('name');

  // Pengecualian Khusus: Selalu sertakan Mas Agus di seluruh kelurahan
  const AGUS_ID = '67b90a8a-176f-4418-b639-0a5a4cd0ec97';
  if (kelurahanId && data && !data.find(p => p.id === AGUS_ID)) {
    const { data: agus } = await supabase
      .from('users')
      .select('id, name, phone, role, sector_id')
      .eq('id', AGUS_ID)
      .single();
    
    if (agus) {
      data = [...data, agus].sort((a, b) => a.name.localeCompare(b.name));
    }
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ petugas: data || [] });
}
