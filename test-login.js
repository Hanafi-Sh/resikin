require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function test() {
  console.log("Attempting login...");
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'pakhendra@resikin.id',
    password: 'pakhendrakoor',
  });

  if (error) {
    console.error("Auth error:", error.message);
    return;
  }
  
  console.log("Login success! User ID:", data.user.id);
  
  console.log("Fetching profile from 'users' table...");
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('role')
    .eq('auth_user_id', data.user.id)
    .single();
    
  if (profileError) {
    console.error("Profile fetch error:", profileError.message);
  } else {
    console.log("Profile role:", profile.role);
  }
}

test();
