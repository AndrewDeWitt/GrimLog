import 'server-only';

import { createClient } from '@supabase/supabase-js';

/**
 * Create a Supabase client with service-role privileges.
 *
 * IMPORTANT:
 * - Server-only (never import from client components).
 * - Requires SUPABASE_SERVICE_ROLE_KEY.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error('Missing env var: NEXT_PUBLIC_SUPABASE_URL');
  }
  if (!serviceRoleKey) {
    throw new Error('Missing env var: SUPABASE_SERVICE_ROLE_KEY');
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}


