import { createBrowserClient as createSupabaseBrowserClient } from '@supabase/ssr';
import type { Database } from './database.types';

let browserClient: ReturnType<typeof createSupabaseBrowserClient<Database>> | null = null;

/**
 * Creates or returns singleton browser client
 * Used for client components, browser-side API routes, and dashboard queries
 * Uses NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY
 * RLS policies enforce user authentication
 */
export function createBrowserClient() {
  if (browserClient) {
    return browserClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY'
    );
  }

  browserClient = createSupabaseBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
  return browserClient;
}

/**
 * Alias for createBrowserClient for backward compatibility
 */
export const createClient = createBrowserClient;
