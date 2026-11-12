import { createBrowserClient } from '@supabase/ssr';
import { getRequiredEnv } from '../env';

export function createSupabaseBrowserClient() {
  return createBrowserClient(
    getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
    getRequiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  );
}
