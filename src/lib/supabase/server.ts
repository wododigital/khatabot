import { createClient as createServiceClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

let serverClient: ReturnType<typeof createServiceClient<Database>> | null = null;

/**
 * Creates or returns singleton server client
 * Server-only client using service role key
 * Used in Route Handlers and Server Components
 * Can bypass RLS policies for bot session persistence and internal operations
 * Uses NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (server-only env var)
 */
export function createServerClient() {
  if (serverClient) {
    return serverClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Missing Supabase server environment variables: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'
    );
  }

  serverClient = createServiceClient<Database>(supabaseUrl, serviceRoleKey);
  return serverClient;
}
