import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function POST() {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('users')
    .select('id, role, kelurahan_id, sector_id')
    .eq('auth_user_id', user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  if (profile.role === 'koordinator' && !profile.kelurahan_id) {
    return NextResponse.json({ error: 'Kelurahan belum diset di profil' }, { status: 400 });
  }

  if (profile.role === 'petugas' && !profile.sector_id) {
    return NextResponse.json({ error: 'Sektor belum diset di profil' }, { status: 400 });
  }

  const token = crypto.randomBytes(4).toString('hex').toUpperCase();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const { error: insertError } = await supabase
    .from('telegram_link_tokens')
    .insert({
      user_id: profile.id,
      role: profile.role,
      kelurahan_id: profile.kelurahan_id || null,
      sector_id: profile.sector_id || null,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || '';
  const deepLink = botUsername ? `https://t.me/${botUsername}?start=link_${token}` : null;

  return NextResponse.json({
    token,
    expires_at: expiresAt,
    deep_link: deepLink,
  });
}
