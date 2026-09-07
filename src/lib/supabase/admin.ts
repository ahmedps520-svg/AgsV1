import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { publicEnv, serviceRoleKey } from "@/lib/env";
import type { Database } from "@/lib/types/database";

/**
 * Service-role client. Bypasses Row Level Security, so it is used for exactly
 * one thing: provisioning and deactivating login accounts on behalf of a
 * verified school administrator (`src/server/actions/people.ts`).
 *
 * Callers MUST check the caller is an admin before using it.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(publicEnv.supabaseUrl, serviceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
