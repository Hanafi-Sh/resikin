import { createBrowserClient } from '@supabase/ssr';

/**
 * Create a Supabase client for use in the browser (Client Components).
 * This client is used for operations that happen on the user's browser.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
